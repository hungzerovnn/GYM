import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { QueryDto } from '../../common/dto/query.dto';
import { AuthUser } from '../../common/types/auth-user.type';
import {
  buildDateRange,
  buildListResponse,
  buildPagination,
  buildSort,
} from '../../common/utils/query.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateCustomerDto,
  CreateCustomerGroupDto,
  CreateCustomerSourceDto,
  CreateLeadDto,
  CreateLeadLogDto,
  UpdateCustomerDto,
  UpdateCustomerGroupDto,
  UpdateCustomerSourceDto,
  UpdateLeadDto,
} from './crm.dto';

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private isGlobal(user: AuthUser) {
    return user.roleCodes.some((roleCode) =>
      ['super_admin', 'system_owner'].includes(roleCode),
    );
  }

  private async audit(
    user: AuthUser,
    module: string,
    action: AuditAction,
    entityType: string,
    entityId: string,
    beforeData?: unknown,
    afterData?: unknown,
  ) {
    await this.auditLogsService.write({
      module,
      action,
      userId: user.id,
      branchId: user.branchId,
      entityType,
      entityId,
      beforeData,
      afterData,
    });
  }

  private toDate(value?: string) {
    return value ? new Date(value) : undefined;
  }

  private normalizeAttendanceCode(value?: string | null) {
    const normalized = value?.trim().toUpperCase();
    return normalized || undefined;
  }

  private mapCustomerPayload(
    dto: CreateCustomerDto | UpdateCustomerDto,
  ): Prisma.CustomerUncheckedCreateInput | Prisma.CustomerUncheckedUpdateInput {
    return {
      ...dto,
      gender: dto.gender as any,
      birthDate: this.toDate(dto.birthDate),
      identityIssueDate: this.toDate(dto.identityIssueDate),
      registrationDate: this.toDate(dto.registrationDate),
      startTrainingDate: this.toDate(dto.startTrainingDate),
      endTrainingDate: this.toDate(dto.endTrainingDate),
      membershipStatus: dto.membershipStatus as any,
    };
  }

  private async resolveUserNameMap(ids: Array<string | null | undefined>) {
    const uniqueIds = Array.from(
      new Set(ids.filter((id): id is string => Boolean(id))),
    );
    if (!uniqueIds.length) {
      return new Map<string, string>();
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, fullName: true },
    });

    return new Map(users.map((item) => [item.id, item.fullName]));
  }

  private getLeadFollowUpState(nextFollowUpAt?: Date | null) {
    if (!nextFollowUpAt) {
      return 'UNSCHEDULED';
    }

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    if (nextFollowUpAt < startOfToday) {
      return 'OVERDUE';
    }

    if (nextFollowUpAt <= endOfToday) {
      return 'TODAY';
    }

    const diffDays = Math.ceil(
      (nextFollowUpAt.getTime() - now.getTime()) / 86_400_000,
    );
    return diffDays <= 3 ? 'DUE_SOON' : 'PLANNED';
  }

  private mapLeadRecord(lead: any, userNames: Map<string, string> = new Map()) {
    const logs = Array.isArray(lead.logs)
      ? lead.logs.map((log: any) => ({
          ...log,
          performedByName: userNames.get(log.performedById || '') || '',
        }))
      : [];
    const latestLog = logs[0];

    return {
      ...lead,
      logs,
      branchName: lead.branch?.name || '',
      sourceName: lead.source?.name || '',
      assignedUserName: lead.assignedTo?.fullName || '',
      convertedCustomerName: lead.convertedCustomer?.fullName || '',
      logCount:
        typeof lead._count?.logs === 'number' ? lead._count.logs : logs.length,
      followUpState: this.getLeadFollowUpState(lead.nextFollowUpAt),
      lastActivityAt: latestLog?.contactAt || lead.updatedAt,
      lastContactResult: lead.lastContactResult || latestLog?.result || '',
      latestActivityType: latestLog?.activityType || '',
      latestPerformedByName: latestLog?.performedByName || '',
      leadAgeDays: Math.max(
        Math.ceil(
          (Date.now() - new Date(lead.createdAt).getTime()) / 86_400_000,
        ),
        0,
      ),
      leadInfo: [lead.fullName, lead.phone, lead.email]
        .filter(Boolean)
        .join(' | '),
    };
  }

  async listCustomerGroups(query: QueryDto) {
    const where: Prisma.CustomerGroupWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.customerGroup.findMany({
        where,
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.customerGroup.count({ where }),
    ]);

    return buildListResponse(data, total, query);
  }

  async getCustomerGroup(id: string) {
    const payload = await this.prisma.customerGroup.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!payload) {
      throw new NotFoundException('Customer group not found');
    }

    return payload;
  }

  async createCustomerGroup(dto: CreateCustomerGroupDto, user: AuthUser) {
    const payload = await this.prisma.customerGroup.create({ data: dto });
    await this.audit(
      user,
      'customer-groups',
      AuditAction.CREATE,
      'customer_group',
      payload.id,
      undefined,
      payload,
    );
    return payload;
  }

  async updateCustomerGroup(
    id: string,
    dto: UpdateCustomerGroupDto,
    user: AuthUser,
  ) {
    const before = await this.prisma.customerGroup.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Customer group not found');
    const payload = await this.prisma.customerGroup.update({
      where: { id },
      data: dto,
    });
    await this.audit(
      user,
      'customer-groups',
      AuditAction.UPDATE,
      'customer_group',
      id,
      before,
      payload,
    );
    return payload;
  }

  async removeCustomerGroup(id: string, user: AuthUser) {
    const before = await this.prisma.customerGroup.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Customer group not found');
    const payload = await this.prisma.customerGroup.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'customer-groups',
      AuditAction.DELETE,
      'customer_group',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listCustomerSources(query: QueryDto) {
    const where: Prisma.CustomerSourceWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.customerSource.findMany({
        where,
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.customerSource.count({ where }),
    ]);

    return buildListResponse(data, total, query);
  }

  async getCustomerSource(id: string) {
    const payload = await this.prisma.customerSource.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!payload) {
      throw new NotFoundException('Customer source not found');
    }

    return payload;
  }

  async createCustomerSource(dto: CreateCustomerSourceDto, user: AuthUser) {
    const payload = await this.prisma.customerSource.create({ data: dto });
    await this.audit(
      user,
      'customer-sources',
      AuditAction.CREATE,
      'customer_source',
      payload.id,
      undefined,
      payload,
    );
    return payload;
  }

  async updateCustomerSource(
    id: string,
    dto: UpdateCustomerSourceDto,
    user: AuthUser,
  ) {
    const before = await this.prisma.customerSource.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Customer source not found');
    const payload = await this.prisma.customerSource.update({
      where: { id },
      data: dto,
    });
    await this.audit(
      user,
      'customer-sources',
      AuditAction.UPDATE,
      'customer_source',
      id,
      before,
      payload,
    );
    return payload;
  }

  async removeCustomerSource(id: string, user: AuthUser) {
    const before = await this.prisma.customerSource.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Customer source not found');
    const payload = await this.prisma.customerSource.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'customer-sources',
      AuditAction.DELETE,
      'customer_source',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listLeadSources(query: QueryDto) {
    const where: Prisma.LeadSourceWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { channel: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.leadSource.findMany({
        where,
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.leadSource.count({ where }),
    ]);

    return buildListResponse(data, total, query);
  }

  async listCustomers(query: QueryDto, user: AuthUser) {
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { contactName: { contains: query.search, mode: 'insensitive' } },
              {
                fingerprintCode: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(query.status ? { membershipStatus: query.status as any } : {}),
      ...buildDateRange('registrationDate', query),
    };

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        include: {
          branch: true,
          group: true,
          source: true,
          assignedTo: true,
          contracts: {
            where: { deletedAt: null },
            select: { id: true },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.customer.count({ where }),
    ]);

    return buildListResponse(
      data.map((customer) => ({
        ...customer,
        customerInfo: [customer.fullName, customer.phone, customer.email]
          .filter(Boolean)
          .join(' • '),
        fullAddress: [
          customer.address,
          customer.ward,
          customer.district,
          customer.city,
        ]
          .filter(Boolean)
          .join(', '),
        branchName: customer.branch.name,
        groupName: customer.group?.name || '',
        assignedUserName: customer.assignedTo?.fullName || '',
        contractCount: customer.contracts.length,
        registrationDate: customer.registrationDate || customer.createdAt,
      })),
      total,
      query,
    );
  }

  async getCustomer(id: string, user: AuthUser) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        group: true,
        source: true,
        assignedTo: true,
        customerFiles: true,
        contracts: {
          where: { deletedAt: null },
          include: { servicePackage: true, receipts: true, histories: true },
        },
        receipts: {
          where: { deletedAt: null },
          include: { paymentMethod: true, contract: true },
        },
        trainingSessions: {
          where: { deletedAt: null },
          include: { trainer: true, contract: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return {
      ...customer,
      customerInfo: [customer.fullName, customer.phone, customer.email]
        .filter(Boolean)
        .join(' • '),
      fullAddress: [
        customer.address,
        customer.ward,
        customer.district,
        customer.city,
      ]
        .filter(Boolean)
        .join(', '),
      branchName: customer.branch.name,
      groupName: customer.group?.name || '',
      assignedUserName: customer.assignedTo?.fullName || '',
      registrationDate: customer.registrationDate || customer.createdAt,
    };
  }

  async customerTimeline(id: string, user: AuthUser) {
    const customer = await this.getCustomer(id, user);
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'customer',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      customer,
      notes: customer.note
        ? [
            {
              type: 'customer_note',
              content: customer.note,
              createdAt: customer.createdAt,
            },
          ]
        : [],
      auditLogs,
    };
  }

  async createCustomer(dto: CreateCustomerDto, user: AuthUser) {
    const payload = await this.prisma.customer.create({
      data: {
        ...this.mapCustomerPayload(dto),
        fingerprintCode:
          this.normalizeAttendanceCode(dto.fingerprintCode) ||
          this.normalizeAttendanceCode(dto.code),
        membershipStatus: (dto.membershipStatus as any) || 'PROSPECT',
      } as Prisma.CustomerUncheckedCreateInput,
      include: {
        branch: true,
        group: true,
        source: true,
        assignedTo: true,
      },
    });
    await this.audit(
      user,
      'customers',
      AuditAction.CREATE,
      'customer',
      payload.id,
      undefined,
      payload,
    );
    return payload;
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto, user: AuthUser) {
    const before = await this.prisma.customer.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Customer not found');
    const payload = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(this.mapCustomerPayload(
          dto,
        ) as Prisma.CustomerUncheckedUpdateInput),
        ...(dto.fingerprintCode !== undefined
          ? {
              fingerprintCode:
                this.normalizeAttendanceCode(dto.fingerprintCode) || null,
            }
          : {}),
      },
      include: {
        branch: true,
        group: true,
        source: true,
        assignedTo: true,
      },
    });
    await this.audit(
      user,
      'customers',
      AuditAction.UPDATE,
      'customer',
      id,
      before,
      payload,
    );
    return payload;
  }

  async removeCustomer(id: string, user: AuthUser) {
    const before = await this.prisma.customer.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Customer not found');
    const payload = await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), membershipStatus: 'INACTIVE' },
    });
    await this.audit(
      user,
      'customers',
      AuditAction.DELETE,
      'customer',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listLeads(query: QueryDto, user: AuthUser) {
    const restrictToOwn = user.roleCodes.some((roleCode) =>
      ['sales', 'customer_care'].includes(roleCode),
    );
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(restrictToOwn ? { assignedToId: user.id } : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...buildDateRange('createdAt', query),
    };

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: {
          branch: true,
          source: true,
          assignedTo: true,
          convertedCustomer: true,
          logs: {
            orderBy: { contactAt: 'desc' },
            take: 3,
          },
          _count: {
            select: { logs: true },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.lead.count({ where }),
    ]);

    const userNames = await this.resolveUserNameMap(
      data.flatMap((lead) => lead.logs.map((log) => log.performedById)),
    );

    return buildListResponse(
      data.map((lead) => this.mapLeadRecord(lead, userNames)),
      total,
      query,
    );
  }

  async getLead(id: string, user: AuthUser) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        source: true,
        assignedTo: true,
        convertedCustomer: true,
        logs: { orderBy: { contactAt: 'desc' } },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const userNames = await this.resolveUserNameMap(
      lead.logs.map((log) => log.performedById),
    );
    return this.mapLeadRecord(lead, userNames);
  }

  async createLead(dto: CreateLeadDto, user: AuthUser) {
    const payload = await this.prisma.lead.create({
      data: {
        ...dto,
        status: (dto.status as any) || 'NEW',
        potentialLevel: (dto.potentialLevel as any) || 'WARM',
        nextFollowUpAt: dto.nextFollowUpAt
          ? new Date(dto.nextFollowUpAt)
          : undefined,
        appointmentAt: dto.appointmentAt
          ? new Date(dto.appointmentAt)
          : undefined,
        budgetExpected: dto.budgetExpected
          ? new Prisma.Decimal(dto.budgetExpected)
          : undefined,
      },
      include: {
        branch: true,
        source: true,
        assignedTo: true,
      },
    });
    await this.audit(
      user,
      'leads',
      AuditAction.CREATE,
      'lead',
      payload.id,
      undefined,
      payload,
    );
    return payload;
  }

  async updateLead(id: string, dto: UpdateLeadDto, user: AuthUser) {
    const before = await this.prisma.lead.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Lead not found');
    const payload = await this.prisma.lead.update({
      where: { id },
      data: {
        ...dto,
        status: dto.status as any,
        potentialLevel: dto.potentialLevel as any,
        nextFollowUpAt: dto.nextFollowUpAt
          ? new Date(dto.nextFollowUpAt)
          : undefined,
        appointmentAt: dto.appointmentAt
          ? new Date(dto.appointmentAt)
          : undefined,
        budgetExpected: dto.budgetExpected
          ? new Prisma.Decimal(dto.budgetExpected)
          : undefined,
      },
      include: {
        branch: true,
        source: true,
        assignedTo: true,
        convertedCustomer: true,
      },
    });
    await this.audit(
      user,
      'leads',
      AuditAction.UPDATE,
      'lead',
      id,
      before,
      payload,
    );
    return payload;
  }

  async removeLead(id: string, user: AuthUser) {
    const before = await this.prisma.lead.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Lead not found');
    const payload = await this.prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });
    await this.audit(
      user,
      'leads',
      AuditAction.DELETE,
      'lead',
      id,
      before,
      payload,
    );
    return payload;
  }

  async addLeadLog(id: string, dto: CreateLeadLogDto, user: AuthUser) {
    await this.getLead(id, user);
    const payload = await this.prisma.leadLog.create({
      data: {
        leadId: id,
        activityType: dto.activityType as any,
        content: dto.content,
        result: dto.result,
        nextFollowUpAt: dto.nextFollowUpAt
          ? new Date(dto.nextFollowUpAt)
          : undefined,
        contactAt: dto.contactAt ? new Date(dto.contactAt) : new Date(),
        performedById: user.id,
      },
    });
    await this.audit(
      user,
      'leads',
      AuditAction.UPDATE,
      'lead_log',
      payload.id,
      undefined,
      payload,
    );
    return payload;
  }
}
