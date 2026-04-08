import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, MemberPresenceSource, MemberPresenceStatus, Prisma } from '@prisma/client';
import { addDays, differenceInMinutes, endOfDay, startOfDay } from 'date-fns';
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
  ToggleMemberPresenceDto,
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

  private resolveMemberPresenceCutoff(session: {
    checkInAt: Date;
    graceHours?: number | null;
  }) {
    const nextDayStart = startOfDay(addDays(session.checkInAt, 1));
    const graceHours = Math.max(0, Number(session.graceHours || 6));
    return new Date(nextDayStart.getTime() + graceHours * 3_600_000);
  }

  private async getMemberPresenceGraceHours() {
    const setting = await this.prisma.appSetting.findFirst({
      where: {
        group: 'general',
        key: 'system_profile',
      },
      select: {
        value: true,
      },
    });

    const payload =
      setting?.value &&
      !Array.isArray(setting.value) &&
      typeof setting.value === 'object'
        ? (setting.value as Record<string, unknown>)
        : {};
    const rawValue = Number(payload.memberPresenceOvernightGraceHours || 6);
    if (Number.isNaN(rawValue)) {
      return 6;
    }

    return Math.min(Math.max(Math.round(rawValue), 0), 24);
  }

  private async autoCloseExpiredMemberPresenceSessions(scope?: {
    branchId?: string;
    customerId?: string;
  }) {
    const now = new Date();
    const activeSessions = await this.prisma.memberPresenceSession.findMany({
      where: {
        status: 'ACTIVE',
        ...(scope?.branchId ? { branchId: scope.branchId } : {}),
        ...(scope?.customerId ? { customerId: scope.customerId } : {}),
      },
      select: {
        id: true,
        checkInAt: true,
        graceHours: true,
      },
    });

    const expiredSessions = activeSessions
      .map((session) => ({
        id: session.id,
        cutoffAt: this.resolveMemberPresenceCutoff(session),
      }))
      .filter((session) => session.cutoffAt.getTime() <= now.getTime());

    if (!expiredSessions.length) {
      return 0;
    }

    await this.prisma.$transaction(
      expiredSessions.map((session) =>
        this.prisma.memberPresenceSession.update({
          where: { id: session.id },
          data: {
            status: MemberPresenceStatus.AUTO_CLOSED,
            checkOutAt: session.cutoffAt,
            autoClosedAt: session.cutoffAt,
          },
        }),
      ),
    );

    return expiredSessions.length;
  }

  private mapMemberPresenceRecord(customer: any, sessions: any[]) {
    const sortedSessions = [...sessions].sort(
      (left, right) =>
        right.checkInAt.getTime() - left.checkInAt.getTime() ||
        right.createdAt.getTime() - left.createdAt.getTime(),
    );
    const activeSession =
      sortedSessions.find(
        (session) =>
          session.status === MemberPresenceStatus.ACTIVE && !session.checkOutAt,
      ) || null;
    const latestSession = sortedSessions[0] || null;
    const presenceStatus = activeSession
      ? 'ACTIVE'
      : latestSession?.status || 'NEVER_CHECKED_IN';
    const currentSessionDurationMinutes = activeSession
      ? Math.max(differenceInMinutes(new Date(), activeSession.checkInAt), 0)
      : 0;
    const nextAutoCloseAt = activeSession
      ? this.resolveMemberPresenceCutoff(activeSession)
      : null;

    return {
      id: customer.id,
      customerId: customer.id,
      code: customer.code,
      fullName: customer.fullName,
      customerInfo: customer.fullName,
      avatarUrl: customer.avatarUrl || '',
      phone: customer.phone || '',
      branchId: customer.branchId,
      branchName: customer.branch?.name || '',
      membershipStatus: customer.membershipStatus,
      attendanceCode:
        this.normalizeAttendanceCode(customer.fingerprintCode) || customer.code,
      customerCardNumber: customer.customerCardNumber || '',
      presenceStatus,
      currentSessionId: activeSession?.id || '',
      currentSessionStartedAt: activeSession?.checkInAt?.toISOString() || '',
      currentSessionDurationMinutes,
      currentSessionDurationLabel: activeSession
        ? `${currentSessionDurationMinutes} phut`
        : '',
      nextAutoCloseAt: nextAutoCloseAt?.toISOString() || '',
      lastCheckInAt:
        latestSession?.checkInAt?.toISOString() ||
        activeSession?.checkInAt?.toISOString() ||
        '',
      lastCheckOutAt: latestSession?.checkOutAt?.toISOString() || '',
      lastPresenceAt:
        activeSession?.checkInAt?.toISOString() ||
        latestSession?.checkOutAt?.toISOString() ||
        latestSession?.checkInAt?.toISOString() ||
        '',
      sessionCount: sortedSessions.length,
      toggleActionLabel:
        presenceStatus === 'ACTIVE' ? 'Xac nhan Off' : 'Xac nhan dang tap',
      presenceStatusNote:
        presenceStatus === 'ACTIVE'
          ? 'Hoi vien dang duoc xac nhan hien dien tai phong tap.'
          : presenceStatus === 'AUTO_CLOSED'
            ? 'Phien truoc da tu dong dong vi qua moc sang ngay moi.'
            : presenceStatus === 'OFF'
              ? 'Hoi vien da ket thuc buoi tap gan nhat.'
              : 'Chua co lan xac nhan hien dien nao.',
      sessions: sortedSessions.map((session) => ({
        id: session.id,
        status: session.status,
        source: session.source,
        checkInAt: session.checkInAt.toISOString(),
        checkOutAt: session.checkOutAt?.toISOString() || '',
        autoClosedAt: session.autoClosedAt?.toISOString() || '',
        durationMinutes:
          session.checkOutAt && session.checkOutAt > session.checkInAt
            ? differenceInMinutes(session.checkOutAt, session.checkInAt)
            : activeSession?.id === session.id
              ? Math.max(differenceInMinutes(new Date(), session.checkInAt), 0)
              : 0,
        attendanceMachineId: session.attendanceMachineId || '',
        machineName: session.attendanceMachine?.name || '',
        note: session.note || '',
      })),
    };
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

  async listMemberPresence(query: QueryDto, user: AuthUser) {
    const branchId =
      !this.isGlobal(user) && user.branchId ? user.branchId : query.branchId;
    await this.autoCloseExpiredMemberPresenceSessions({ branchId });

    const customers = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
        ...(query.search
          ? {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                { fullName: { contains: query.search, mode: 'insensitive' } },
                { phone: { contains: query.search, mode: 'insensitive' } },
                {
                  fingerprintCode: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        branch: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { fullName: 'asc' }],
    });

    const customerIds = customers.map((item) => item.id);
    const sessions = customerIds.length
      ? await this.prisma.memberPresenceSession.findMany({
          where: {
            customerId: { in: customerIds },
          },
          include: {
            attendanceMachine: {
              select: {
                name: true,
              },
            },
          },
          orderBy: [{ checkInAt: 'desc' }, { createdAt: 'desc' }],
        })
      : [];

    const sessionsByCustomer = sessions.reduce<Record<string, any[]>>(
      (acc, session) => {
        acc[session.customerId] ||= [];
        acc[session.customerId].push(session);
        return acc;
      },
      {},
    );
    const mapped = customers.map((customer) =>
      this.mapMemberPresenceRecord(customer, sessionsByCustomer[customer.id] || []),
    );
    const filtered = query.status
      ? mapped.filter((item) => item.presenceStatus === query.status)
      : mapped;
    const offset = (query.page - 1) * query.pageSize;
    const paged = filtered.slice(offset, offset + query.pageSize);

    return buildListResponse(paged, filtered.length, query);
  }

  async getMemberPresence(id: string, user: AuthUser) {
    await this.autoCloseExpiredMemberPresenceSessions({ customerId: id });

    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        branch: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Hoi vien khong ton tai');
    }

    if (!this.isGlobal(user) && user.branchId && customer.branchId !== user.branchId) {
      throw new NotFoundException('Hoi vien khong ton tai');
    }

    const sessions = await this.prisma.memberPresenceSession.findMany({
      where: {
        customerId: customer.id,
      },
      include: {
        attendanceMachine: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ checkInAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    return this.mapMemberPresenceRecord(customer, sessions);
  }

  async toggleMemberPresence(
    customerId: string,
    dto: ToggleMemberPresenceDto,
    user: AuthUser,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        deletedAt: null,
      },
      include: {
        branch: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Hoi vien khong ton tai');
    }

    if (!this.isGlobal(user) && user.branchId && customer.branchId !== user.branchId) {
      throw new NotFoundException('Hoi vien khong ton tai');
    }

    await this.autoCloseExpiredMemberPresenceSessions({
      customerId: customer.id,
      branchId: customer.branchId,
    });

    let attendanceMachineId: string | undefined;
    if (dto.attendanceMachineId) {
      const machine = await this.prisma.attendanceMachine.findFirst({
        where: {
          id: dto.attendanceMachineId,
          branchId: customer.branchId,
        },
        select: {
          id: true,
        },
      });
      if (!machine) {
        throw new NotFoundException(
          'May cham cong khong ton tai trong chi nhanh cua hoi vien.',
        );
      }
      attendanceMachineId = machine.id;
    }

    const activeSession = await this.prisma.memberPresenceSession.findFirst({
      where: {
        customerId: customer.id,
        status: MemberPresenceStatus.ACTIVE,
      },
      orderBy: [{ checkInAt: 'desc' }, { createdAt: 'desc' }],
    });

    const now = new Date();
    let action: AuditAction = AuditAction.UPDATE;
    let beforeData: unknown = activeSession || undefined;
    let afterData: unknown;

    if (activeSession) {
      const payload = await this.prisma.memberPresenceSession.update({
        where: { id: activeSession.id },
        data: {
          status: MemberPresenceStatus.OFF,
          checkOutAt: now,
          note:
            dto.note !== undefined ? dto.note : activeSession.note || undefined,
        },
      });
      afterData = payload;
    } else {
      const graceHours = await this.getMemberPresenceGraceHours();
      const payload = await this.prisma.memberPresenceSession.create({
        data: {
          branchId: customer.branchId,
          customerId: customer.id,
          attendanceMachineId,
          checkInAt: now,
          graceHours,
          source: (dto.source || 'MANUAL') as MemberPresenceSource,
          status: MemberPresenceStatus.ACTIVE,
          note: dto.note,
        },
      });
      action = AuditAction.CREATE;
      beforeData = undefined;
      afterData = payload;
    }

    await this.audit(
      user,
      'member-presence',
      action,
      'member_presence_session',
      String((afterData as { id?: string }).id || customer.id),
      beforeData,
      afterData,
    );

    return this.getMemberPresence(customer.id, user);
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
