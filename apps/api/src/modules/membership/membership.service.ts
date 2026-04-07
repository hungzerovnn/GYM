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
  CheckInTrainingSessionDto,
  ConvertContractDto,
  CreateContractDto,
  CreateServiceDto,
  CreateServicePackageDto,
  CreateTrainerDto,
  CreateTrainingSessionDto,
  UpdateContractDto,
  UpdateServiceDto,
  UpdateServicePackageDto,
  UpdateTrainerDto,
  UpdateTrainingSessionDto,
} from './membership.dto';

@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private isGlobal(user: AuthUser) {
    return user.roleCodes.some((roleCode) =>
      ['super_admin', 'system_owner'].includes(roleCode),
    );
  }

  private money(value?: string | number | null) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return new Prisma.Decimal(value);
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

  private async resolveAttachmentCountMap(
    entityType: string,
    entityIds: string[],
  ) {
    const scopedIds = Array.from(new Set(entityIds.filter(Boolean)));
    if (!scopedIds.length) {
      return new Map<string, number>();
    }

    const grouped = await this.prisma.attachment.groupBy({
      by: ['entityId'],
      where: {
        entityType,
        entityId: { in: scopedIds },
      },
      _count: {
        entityId: true,
      },
    });

    return new Map(
      grouped.map((item) => [item.entityId, item._count.entityId]),
    );
  }

  private getPercentage(current?: number | null, total?: number | null) {
    if (!total || total <= 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.max(0, Math.round(((current || 0) / total) * 100)),
    );
  }

  private getDaysRemaining(date?: Date | null) {
    if (!date) {
      return null;
    }

    return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  }

  private mapContractRecord(
    contract: any,
    userNames: Map<string, string> = new Map(),
  ) {
    const plannedSessions = Math.max(
      (contract.totalSessions || 0) + (contract.bonusSessions || 0),
      0,
    );
    const usedSessions = contract.usedSessions || 0;
    const remainingSessions =
      contract.remainingSessions !== undefined &&
      contract.remainingSessions !== null
        ? contract.remainingSessions
        : Math.max(plannedSessions - usedSessions, 0);
    const amountPaid = Number(contract.amountPaid || 0);
    const totalAmount = Number(contract.totalAmount || 0);
    const receipts = Array.isArray(contract.receipts) ? contract.receipts : [];
    const receiptAmountTotal = receipts.length
      ? receipts.reduce(
          (sum: number, receipt: any) => sum + Number(receipt.amount || 0),
          0,
        )
      : amountPaid;

    return {
      ...contract,
      histories: Array.isArray(contract.histories)
        ? contract.histories.map((history: any) => ({
            ...history,
            actedByName: userNames.get(history.actedById || '') || '',
          }))
        : contract.histories,
      items: Array.isArray(contract.items)
        ? contract.items.map((item: any) => ({
            ...item,
            serviceName: item.service?.name || '',
            servicePackageName: item.servicePackage?.name || '',
            itemLabel:
              item.description ||
              item.servicePackage?.name ||
              item.service?.name ||
              '',
          }))
        : contract.items,
      conversionsFrom: Array.isArray(contract.conversionsFrom)
        ? contract.conversionsFrom.map((conversion: any) => ({
            ...conversion,
            newContractCode: conversion.newContract?.code || '',
            newPackageName: conversion.newContract?.packageName || '',
          }))
        : contract.conversionsFrom,
      conversionsTo: Array.isArray(contract.conversionsTo)
        ? contract.conversionsTo.map((conversion: any) => ({
            ...conversion,
            oldContractCode: conversion.oldContract?.code || '',
            oldPackageName: conversion.oldContract?.packageName || '',
          }))
        : contract.conversionsTo,
      branchName: contract.branch?.name || '',
      customerName: contract.customer?.fullName || '',
      customerPhone: contract.customer?.phone || '',
      servicePackageName:
        contract.servicePackage?.name || contract.packageName || '',
      serviceName: contract.servicePackage?.service?.name || '',
      saleUserName: contract.saleUser?.fullName || '',
      trainerName: contract.trainer?.fullName || '',
      itemCount: Array.isArray(contract.items) ? contract.items.length : 0,
      receiptCount: receipts.length,
      receiptAmountTotal,
      sessionUsage: `${usedSessions}/${plannedSessions}`,
      sessionProgressPercent: this.getPercentage(usedSessions, plannedSessions),
      paidPercent: this.getPercentage(amountPaid, totalAmount),
      daysRemaining: this.getDaysRemaining(contract.endDate),
      contractInfo: [
        contract.code,
        contract.customer?.fullName,
        contract.packageName,
      ]
        .filter(Boolean)
        .join(' | '),
      remainingSessions,
    };
  }

  private mapServiceRecord(service: any) {
    const packages = Array.isArray(service.packages)
      ? service.packages.map((item: any) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          price: item.price,
          sessionCount: item.sessionCount ?? 0,
          bonusSessions: item.bonusSessions ?? 0,
          durationDays: item.durationDays ?? 0,
          status: item.status,
          contractCount: item._count?.contracts ?? 0,
        }))
      : undefined;

    return {
      id: service.id,
      branchId: service.branchId,
      branchName: service.branch?.name || '',
      code: service.code,
      name: service.name,
      category: service.category,
      description: service.description || '',
      defaultPrice: service.defaultPrice,
      durationDays: service.durationDays ?? 0,
      defaultSessions: service.defaultSessions ?? 0,
      status: service.status,
      packageCount: packages?.length ?? 0,
      activePackageCount:
        packages?.filter((item) => item.status === 'ACTIVE').length ?? 0,
      contractItemCount: service._count?.contractItems ?? 0,
      packageNames: packages?.map((item) => item.name).join(', ') || '',
      packages,
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString(),
      createdDateTime: service.createdAt.toISOString(),
      updatedDateTime: service.updatedAt.toISOString(),
    };
  }

  private mapServicePackageRecord(servicePackage: any) {
    const contracts = Array.isArray(servicePackage.contracts)
      ? servicePackage.contracts.map((contract: any) => ({
          id: contract.id,
          code: contract.code,
          customerName: contract.customer?.fullName || '',
          customerPhone: contract.customer?.phone || '',
          packageName: contract.packageName || servicePackage.name,
          status: contract.status,
          amountDue: contract.amountDue,
          endDate: contract.endDate?.toISOString() || '',
        }))
      : undefined;

    return {
      id: servicePackage.id,
      serviceId: servicePackage.serviceId,
      branchId: servicePackage.service?.branchId || '',
      branchName: servicePackage.service?.branch?.name || '',
      serviceCode: servicePackage.service?.code || '',
      serviceName: servicePackage.service?.name || '',
      serviceCategory: servicePackage.service?.category || '',
      code: servicePackage.code,
      name: servicePackage.name,
      price: servicePackage.price,
      sessionCount: servicePackage.sessionCount ?? 0,
      bonusSessions: servicePackage.bonusSessions ?? 0,
      bonusDays: servicePackage.bonusDays ?? 0,
      durationDays: servicePackage.durationDays ?? 0,
      packageType: servicePackage.packageType,
      remainingValueRule: servicePackage.remainingValueRule || '',
      description: servicePackage.description || '',
      status: servicePackage.status,
      totalSessions: Math.max(
        (servicePackage.sessionCount || 0) +
          (servicePackage.bonusSessions || 0),
        0,
      ),
      sessionLabel:
        servicePackage.bonusSessions && servicePackage.bonusSessions > 0
          ? `${servicePackage.sessionCount || 0} + ${servicePackage.bonusSessions} buoi`
          : `${servicePackage.sessionCount || 0} buoi`,
      contractCount: servicePackage._count?.contracts ?? contracts?.length ?? 0,
      activeContractCount:
        contracts?.filter((item) => item.status === 'ACTIVE').length ?? 0,
      contracts,
      createdAt: servicePackage.createdAt.toISOString(),
      updatedAt: servicePackage.updatedAt.toISOString(),
      createdDateTime: servicePackage.createdAt.toISOString(),
      updatedDateTime: servicePackage.updatedAt.toISOString(),
    };
  }

  private mapTrainerRecord(trainer: any) {
    const contracts = Array.isArray(trainer.contracts)
      ? trainer.contracts.map((contract: any) => ({
          id: contract.id,
          code: contract.code,
          customerName: contract.customer?.fullName || '',
          customerPhone: contract.customer?.phone || '',
          packageName:
            contract.servicePackage?.name || contract.packageName || '',
          status: contract.status,
          endDate: contract.endDate?.toISOString() || '',
          amountDue: contract.amountDue,
        }))
      : undefined;

    const trainingSessions = Array.isArray(trainer.trainingSessions)
      ? trainer.trainingSessions.map((session: any) => ({
          id: session.id,
          code: session.code,
          customerName: session.customer?.fullName || '',
          customerPhone: session.customer?.phone || '',
          contractCode: session.contract?.code || '',
          status: session.status,
          scheduledAt: session.scheduledAt.toISOString(),
          scheduledDateTime: session.scheduledAt.toISOString(),
          consumedSessions: session.consumedSessions ?? 0,
          outcome: session.outcome || '',
        }))
      : undefined;

    const now = Date.now();
    const upcomingSessions =
      trainingSessions?.filter(
        (session) =>
          session.status === 'SCHEDULED' &&
          new Date(session.scheduledAt).getTime() >= now,
      ) || [];
    const completedSessions =
      trainingSessions?.filter((session) => session.status === 'COMPLETED') ||
      [];
    const nextSessionDateTime = upcomingSessions
      .slice()
      .sort(
        (left, right) =>
          new Date(left.scheduledAt).getTime() -
          new Date(right.scheduledAt).getTime(),
      )[0]?.scheduledDateTime;
    const lastSessionDateTime = trainingSessions
      ?.slice()
      .sort(
        (left, right) =>
          new Date(right.scheduledAt).getTime() -
          new Date(left.scheduledAt).getTime(),
      )[0]?.scheduledDateTime;

    return {
      id: trainer.id,
      branchId: trainer.branchId,
      branchName: trainer.branch?.name || '',
      code: trainer.code,
      fullName: trainer.fullName,
      phone: trainer.phone || '',
      email: trainer.email || '',
      specialty: trainer.specialty || '',
      status: trainer.status,
      note: trainer.note || '',
      contractCount: trainer._count?.contracts ?? contracts?.length ?? 0,
      activeContractCount:
        contracts?.filter((item) => item.status === 'ACTIVE').length ?? 0,
      trainingSessionCount:
        trainer._count?.trainingSessions ?? trainingSessions?.length ?? 0,
      upcomingSessionCount: upcomingSessions.length,
      completedSessionCount: completedSessions.length,
      nextSessionDateTime: nextSessionDateTime || '',
      lastSessionDateTime: lastSessionDateTime || '',
      contracts,
      trainingSessions,
      createdAt: trainer.createdAt.toISOString(),
      updatedAt: trainer.updatedAt.toISOString(),
      createdDateTime: trainer.createdAt.toISOString(),
      updatedDateTime: trainer.updatedAt.toISOString(),
    };
  }

  private mapTrainingSessionRecord(session: any, attachmentCount = 0) {
    const attendance = Array.isArray(session.attendance)
      ? session.attendance.map((item: any) => ({
          id: item.id,
          customerName:
            item.customer?.fullName || session.customer?.fullName || '',
          status: item.status,
          checkInAt: item.checkInAt?.toISOString() || '',
          checkInDateTime: item.checkInAt?.toISOString() || '',
          consumedSessions: item.consumedSessions ?? 0,
          note: item.note || '',
        }))
      : undefined;

    return {
      id: session.id,
      branchId: session.branchId,
      branchName: session.branch?.name || '',
      contractId: session.contractId || '',
      contractCode: session.contract?.code || '',
      contractPackageName:
        session.contract?.servicePackage?.name ||
        session.contract?.packageName ||
        '',
      customerId: session.customerId,
      customerName: session.customer?.fullName || '',
      customerPhone: session.customer?.phone || '',
      trainerId: session.trainerId || '',
      trainerCode: session.trainer?.code || '',
      trainerName: session.trainer?.fullName || '',
      code: session.code,
      scheduledAt: session.scheduledAt.toISOString(),
      scheduledDateTime: session.scheduledAt.toISOString(),
      durationMinutes: session.durationMinutes ?? 0,
      location: session.location || '',
      status: session.status,
      checkInAt: session.checkInAt?.toISOString() || '',
      checkInDateTime: session.checkInAt?.toISOString() || '',
      checkOutAt: session.checkOutAt?.toISOString() || '',
      checkOutDateTime: session.checkOutAt?.toISOString() || '',
      consumedSessions: session.consumedSessions ?? 0,
      outcome: session.outcome || '',
      note: session.note || '',
      attendanceCount: attendance?.length ?? session._count?.attendance ?? 0,
      presentCount:
        attendance?.filter((item) => item.status === 'PRESENT').length ?? 0,
      attachmentCount,
      attendance,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      createdDateTime: session.createdAt.toISOString(),
      updatedDateTime: session.updatedAt.toISOString(),
    };
  }

  async listServices(query: QueryDto, user: AuthUser) {
    const where: Prisma.ServiceWhereInput = {
      deletedAt: null,
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(query.category
        ? { category: { equals: query.category, mode: 'insensitive' } }
        : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        include: {
          branch: true,
          packages: {
            where: { deletedAt: null },
            select: {
              id: true,
              code: true,
              name: true,
              price: true,
              sessionCount: true,
              bonusSessions: true,
              durationDays: true,
              status: true,
              _count: {
                select: {
                  contracts: true,
                },
              },
            },
            orderBy: [{ status: 'asc' }, { name: 'asc' }],
          },
          _count: {
            select: {
              contractItems: true,
            },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.service.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapServiceRecord(item)),
      total,
      query,
    );
  }

  async getService(id: string, user: AuthUser) {
    const service = await this.prisma.service.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        packages: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            name: true,
            price: true,
            sessionCount: true,
            bonusSessions: true,
            durationDays: true,
            status: true,
            _count: {
              select: {
                contracts: true,
              },
            },
          },
          orderBy: [{ status: 'asc' }, { name: 'asc' }],
        },
        _count: {
          select: {
            contractItems: true,
          },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return this.mapServiceRecord(service);
  }

  async createService(dto: CreateServiceDto, user: AuthUser) {
    const payload = await this.prisma.service.create({
      data: {
        ...dto,
        defaultPrice: this.money(dto.defaultPrice),
        status: (dto.status as any) || 'ACTIVE',
      },
      include: { branch: true },
    });
    await this.audit(
      user,
      'services',
      AuditAction.CREATE,
      'service',
      payload.id,
      undefined,
      payload,
    );
    return this.getService(payload.id, user);
  }

  async updateService(id: string, dto: UpdateServiceDto, user: AuthUser) {
    const before = await this.prisma.service.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Service not found');
    const payload = await this.prisma.service.update({
      where: { id },
      data: {
        ...dto,
        defaultPrice: dto.defaultPrice
          ? this.money(dto.defaultPrice)
          : undefined,
        status: dto.status as any,
      },
      include: { branch: true },
    });
    await this.audit(
      user,
      'services',
      AuditAction.UPDATE,
      'service',
      id,
      before,
      payload,
    );
    return this.getService(id, user);
  }

  async removeService(id: string, user: AuthUser) {
    const before = await this.prisma.service.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Service not found');
    const payload = await this.prisma.service.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'services',
      AuditAction.DELETE,
      'service',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listServicePackages(query: QueryDto, user: AuthUser) {
    const where: Prisma.ServicePackageWhereInput = {
      deletedAt: null,
      ...(query.packageType
        ? { packageType: { equals: query.packageType, mode: 'insensitive' } }
        : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                service: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      service:
        !this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : query.branchId
            ? { branchId: query.branchId }
            : undefined,
    };

    const [data, total] = await Promise.all([
      this.prisma.servicePackage.findMany({
        where,
        include: {
          service: { include: { branch: true } },
          _count: {
            select: {
              contracts: true,
            },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.servicePackage.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapServicePackageRecord(item)),
      total,
      query,
    );
  }

  async getServicePackage(id: string, user: AuthUser) {
    const servicePackage = await this.prisma.servicePackage.findFirst({
      where: {
        id,
        deletedAt: null,
        service:
          !this.isGlobal(user) && user.branchId
            ? { branchId: user.branchId }
            : undefined,
      },
      include: {
        service: { include: { branch: true } },
        contracts: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            packageName: true,
            status: true,
            amountDue: true,
            endDate: true,
            customer: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
          orderBy: [{ status: 'asc' }, { endDate: 'desc' }],
        },
        _count: {
          select: {
            contracts: true,
          },
        },
      },
    });

    if (!servicePackage) {
      throw new NotFoundException('Service package not found');
    }

    return this.mapServicePackageRecord(servicePackage);
  }

  async createServicePackage(dto: CreateServicePackageDto, user: AuthUser) {
    const payload = await this.prisma.servicePackage.create({
      data: {
        ...dto,
        price: this.money(dto.price),
        status: (dto.status as any) || 'ACTIVE',
      },
      include: { service: true },
    });
    await this.audit(
      user,
      'service-packages',
      AuditAction.CREATE,
      'service_package',
      payload.id,
      undefined,
      payload,
    );
    return this.getServicePackage(payload.id, user);
  }

  async updateServicePackage(
    id: string,
    dto: UpdateServicePackageDto,
    user: AuthUser,
  ) {
    const before = await this.prisma.servicePackage.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Service package not found');
    const payload = await this.prisma.servicePackage.update({
      where: { id },
      data: {
        ...dto,
        price: dto.price ? this.money(dto.price) : undefined,
        status: dto.status as any,
      },
      include: { service: true },
    });
    await this.audit(
      user,
      'service-packages',
      AuditAction.UPDATE,
      'service_package',
      id,
      before,
      payload,
    );
    return this.getServicePackage(id, user);
  }

  async removeServicePackage(id: string, user: AuthUser) {
    const before = await this.prisma.servicePackage.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Service package not found');
    const payload = await this.prisma.servicePackage.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'service-packages',
      AuditAction.DELETE,
      'service_package',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listTrainers(query: QueryDto, user: AuthUser) {
    const where: Prisma.PtTrainerWhereInput = {
      deletedAt: null,
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { specialty: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.ptTrainer.findMany({
        where,
        include: {
          branch: true,
          contracts: {
            where: { deletedAt: null },
            select: {
              id: true,
              code: true,
              packageName: true,
              status: true,
              endDate: true,
              amountDue: true,
              customer: {
                select: {
                  fullName: true,
                  phone: true,
                },
              },
              servicePackage: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: [{ status: 'asc' }, { endDate: 'desc' }],
          },
          trainingSessions: {
            where: { deletedAt: null },
            select: {
              id: true,
              code: true,
              status: true,
              scheduledAt: true,
              consumedSessions: true,
              outcome: true,
              customer: {
                select: {
                  fullName: true,
                  phone: true,
                },
              },
              contract: {
                select: {
                  code: true,
                },
              },
            },
            orderBy: [{ scheduledAt: 'desc' }],
          },
          _count: {
            select: {
              contracts: true,
              trainingSessions: true,
            },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.ptTrainer.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapTrainerRecord(item)),
      total,
      query,
    );
  }

  async getTrainer(id: string, user: AuthUser) {
    const trainer = await this.prisma.ptTrainer.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        contracts: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            packageName: true,
            status: true,
            endDate: true,
            amountDue: true,
            customer: {
              select: {
                fullName: true,
                phone: true,
              },
            },
            servicePackage: {
              select: {
                name: true,
              },
            },
          },
          orderBy: [{ status: 'asc' }, { endDate: 'desc' }],
        },
        trainingSessions: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            status: true,
            scheduledAt: true,
            consumedSessions: true,
            outcome: true,
            customer: {
              select: {
                fullName: true,
                phone: true,
              },
            },
            contract: {
              select: {
                code: true,
              },
            },
          },
          orderBy: [{ scheduledAt: 'desc' }],
        },
        _count: {
          select: {
            contracts: true,
            trainingSessions: true,
          },
        },
      },
    });

    if (!trainer) {
      throw new NotFoundException('Trainer not found');
    }

    return this.mapTrainerRecord(trainer);
  }

  async createTrainer(dto: CreateTrainerDto, user: AuthUser) {
    const payload = await this.prisma.ptTrainer.create({
      data: {
        ...dto,
        status: (dto.status as any) || 'ACTIVE',
      },
      include: { branch: true },
    });
    await this.audit(
      user,
      'trainers',
      AuditAction.CREATE,
      'trainer',
      payload.id,
      undefined,
      payload,
    );
    return this.getTrainer(payload.id, user);
  }

  async updateTrainer(id: string, dto: UpdateTrainerDto, user: AuthUser) {
    const before = await this.prisma.ptTrainer.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Trainer not found');
    const payload = await this.prisma.ptTrainer.update({
      where: { id },
      data: {
        ...dto,
        status: dto.status as any,
      },
      include: { branch: true },
    });
    await this.audit(
      user,
      'trainers',
      AuditAction.UPDATE,
      'trainer',
      id,
      before,
      payload,
    );
    return this.getTrainer(id, user);
  }

  async removeTrainer(id: string, user: AuthUser) {
    const before = await this.prisma.ptTrainer.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Trainer not found');
    const payload = await this.prisma.ptTrainer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'trainers',
      AuditAction.DELETE,
      'trainer',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listContracts(query: QueryDto, user: AuthUser) {
    const restrictToOwn = user.roleCodes.includes('sales');
    const isExpiringView = query.expiring === 'true';
    const now = new Date();
    const expiringLimit = new Date(now);
    expiringLimit.setDate(expiringLimit.getDate() + 30);
    const contractDateWhere = isExpiringView
      ? {
          endDate: {
            gte: query.dateFrom ? new Date(query.dateFrom) : now,
            lte: query.dateTo ? new Date(query.dateTo) : expiringLimit,
          },
        }
      : buildDateRange('startDate', query);
    const where: Prisma.ContractWhereInput = {
      deletedAt: null,
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(restrictToOwn ? { saleUserId: user.id } : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.paymentStatus
        ? { paymentStatus: query.paymentStatus as any }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { packageName: { contains: query.search, mode: 'insensitive' } },
              {
                customer: {
                  fullName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                saleUser: {
                  fullName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                trainer: {
                  fullName: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      ...contractDateWhere,
    };

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: {
          branch: true,
          customer: true,
          servicePackage: { include: { service: true } },
          saleUser: true,
          trainer: true,
          items: true,
          receipts: {
            where: { deletedAt: null },
            select: { id: true, amount: true },
          },
        },
        orderBy: buildSort(query, 'startDate'),
        ...buildPagination(query),
      }),
      this.prisma.contract.count({ where }),
    ]);

    return buildListResponse(
      data.map((contract) => this.mapContractRecord(contract)),
      total,
      query,
    );
  }

  async getContract(id: string, user: AuthUser) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        customer: true,
        servicePackage: { include: { service: true } },
        saleUser: true,
        trainer: true,
        items: { include: { service: true, servicePackage: true } },
        histories: { orderBy: { createdAt: 'desc' } },
        conversionsFrom: {
          include: {
            newContract: {
              select: { id: true, code: true, packageName: true, status: true },
            },
          },
        },
        conversionsTo: {
          include: {
            oldContract: {
              select: { id: true, code: true, packageName: true, status: true },
            },
          },
        },
        receipts: {
          where: { deletedAt: null },
          include: { paymentMethod: true },
        },
        trainingSessions: {
          where: { deletedAt: null },
          include: { trainer: true },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const userNames = await this.resolveUserNameMap(
      contract.histories.map((history) => history.actedById),
    );
    return this.mapContractRecord(contract, userNames);
  }

  async createContract(dto: CreateContractDto, user: AuthUser) {
    const totalAmount =
      this.money(dto.totalAmount) ||
      this.money(dto.grossAmount) ||
      new Prisma.Decimal(0);
    const amountPaid = this.money(dto.amountPaid) || new Prisma.Decimal(0);
    const totalSessions = dto.totalSessions || 0;
    const usedSessions = dto.usedSessions || 0;
    const remainingSessions =
      dto.remainingSessions !== undefined
        ? dto.remainingSessions
        : Math.max(totalSessions + (dto.bonusSessions || 0) - usedSessions, 0);
    const amountDue =
      this.money(dto.amountDue) || totalAmount.minus(amountPaid);
    const remainingValue =
      this.money(dto.remainingValue) ||
      new Prisma.Decimal(
        totalSessions > 0
          ? (Number(totalAmount) / totalSessions) *
              Math.max(totalSessions - usedSessions, 0)
          : Number(totalAmount),
      );

    const payload = await this.prisma.contract.create({
      data: {
        branchId: dto.branchId,
        customerId: dto.customerId,
        servicePackageId: dto.servicePackageId,
        saleUserId: dto.saleUserId,
        trainerId: dto.trainerId,
        code: dto.code,
        contractType: dto.contractType,
        packageName: dto.packageName,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        totalSessions,
        usedSessions,
        remainingSessions,
        bonusSessions: dto.bonusSessions || 0,
        unitPrice: this.money(dto.unitPrice),
        grossAmount: this.money(dto.grossAmount),
        discountFixed: this.money(dto.discountFixed),
        discountPercent: this.money(dto.discountPercent),
        totalDiscount: this.money(dto.totalDiscount),
        vatAmount: this.money(dto.vatAmount),
        totalAmount,
        amountPaid,
        amountDue,
        remainingValue,
        paymentStatus:
          (dto.paymentStatus as any) ||
          (Number(amountDue) > 0 ? 'PARTIAL' : 'PAID'),
        status: (dto.status as any) || 'ACTIVE',
        richNote: dto.richNote,
        note: dto.note,
        oldContractCode: dto.oldContractCode,
        items: dto.items?.length
          ? {
              create: dto.items.map((item) => ({
                ...item,
                unitPrice: this.money(item.unitPrice),
                discountAmount: this.money(item.discountAmount),
                totalAmount: this.money(item.totalAmount),
              })),
            }
          : undefined,
        histories: {
          create: {
            action: 'CREATE',
            note: 'Contract created',
            actedById: user.id,
            afterData: { code: dto.code, totalAmount: totalAmount.toString() },
          },
        },
      },
      include: {
        branch: true,
        customer: true,
        servicePackage: true,
        saleUser: true,
        trainer: true,
        items: true,
      },
    });

    await this.audit(
      user,
      'contracts',
      AuditAction.CREATE,
      'contract',
      payload.id,
      undefined,
      payload,
    );
    return payload;
  }

  async updateContract(id: string, dto: UpdateContractDto, user: AuthUser) {
    const before = await this.getContract(id, user);
    const payload = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.contractItem.deleteMany({ where: { contractId: id } });
      }

      const contract = await tx.contract.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          customerId: dto.customerId,
          servicePackageId: dto.servicePackageId,
          saleUserId: dto.saleUserId,
          trainerId: dto.trainerId,
          code: dto.code,
          contractType: dto.contractType,
          packageName: dto.packageName,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          totalSessions: dto.totalSessions,
          usedSessions: dto.usedSessions,
          remainingSessions: dto.remainingSessions,
          bonusSessions: dto.bonusSessions,
          unitPrice: dto.unitPrice ? this.money(dto.unitPrice) : undefined,
          grossAmount: dto.grossAmount
            ? this.money(dto.grossAmount)
            : undefined,
          discountFixed: dto.discountFixed
            ? this.money(dto.discountFixed)
            : undefined,
          discountPercent: dto.discountPercent
            ? this.money(dto.discountPercent)
            : undefined,
          totalDiscount: dto.totalDiscount
            ? this.money(dto.totalDiscount)
            : undefined,
          vatAmount: dto.vatAmount ? this.money(dto.vatAmount) : undefined,
          totalAmount: dto.totalAmount
            ? this.money(dto.totalAmount)
            : undefined,
          amountPaid: dto.amountPaid ? this.money(dto.amountPaid) : undefined,
          amountDue: dto.amountDue ? this.money(dto.amountDue) : undefined,
          remainingValue: dto.remainingValue
            ? this.money(dto.remainingValue)
            : undefined,
          paymentStatus: dto.paymentStatus as any,
          status: dto.status as any,
          richNote: dto.richNote,
          note: dto.note,
          oldContractCode: dto.oldContractCode,
          items: dto.items?.length
            ? {
                create: dto.items.map((item) => ({
                  ...item,
                  unitPrice: this.money(item.unitPrice),
                  discountAmount: this.money(item.discountAmount),
                  totalAmount: this.money(item.totalAmount),
                })),
              }
            : undefined,
          histories: {
            create: {
              action: 'UPDATE',
              note: 'Contract updated',
              actedById: user.id,
              beforeData: { code: before.code },
              afterData: { code: dto.code || before.code },
            },
          },
        },
        include: {
          branch: true,
          customer: true,
          servicePackage: true,
          saleUser: true,
          trainer: true,
          items: true,
        },
      });

      return contract;
    });

    await this.audit(
      user,
      'contracts',
      AuditAction.UPDATE,
      'contract',
      id,
      before,
      payload,
    );
    return payload;
  }

  async removeContract(id: string, user: AuthUser) {
    const before = await this.getContract(id, user);
    const payload = await this.prisma.contract.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'CANCELLED',
      },
    });
    await this.audit(
      user,
      'contracts',
      AuditAction.DELETE,
      'contract',
      id,
      before,
      payload,
    );
    return payload;
  }

  async convertContract(id: string, dto: ConvertContractDto, user: AuthUser) {
    const oldContract = await this.getContract(id, user);
    const newContract = await this.getContract(dto.newContractId, user);
    const payload = await this.prisma.contractConversion.create({
      data: {
        oldContractId: oldContract.id,
        newContractId: newContract.id,
        conversionType: dto.conversionType,
        differenceAmount:
          this.money(dto.differenceAmount) || new Prisma.Decimal(0),
        convertedSessions: dto.convertedSessions || 0,
        remainingValueRule: dto.remainingValueRule,
        note: dto.note,
      },
    });

    await this.prisma.contractHistory.create({
      data: {
        contractId: oldContract.id,
        action: 'CONVERSION',
        note: `Converted to ${newContract.code}`,
        actedById: user.id,
        afterData: payload as never,
      },
    });

    await this.audit(
      user,
      'contracts',
      AuditAction.UPDATE,
      'contract_conversion',
      payload.id,
      oldContract,
      payload,
    );
    return payload;
  }

  async listTrainingSessions(query: QueryDto, user: AuthUser) {
    const restrictToTrainer = user.roleCodes.includes('trainer');
    const trainerProfile = restrictToTrainer
      ? await this.prisma.ptTrainer.findFirst({
          where: {
            email: { equals: user.username, mode: 'insensitive' },
          },
        })
      : null;

    const where: Prisma.TrainingSessionWhereInput = {
      deletedAt: null,
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(restrictToTrainer && trainerProfile
        ? { trainerId: trainerProfile.id }
        : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              {
                customer: {
                  fullName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                trainer: {
                  fullName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                contract: {
                  code: { contains: query.search, mode: 'insensitive' },
                },
              },
              { location: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...buildDateRange('scheduledAt', query),
    };

    const [data, total] = await Promise.all([
      this.prisma.trainingSession.findMany({
        where,
        include: {
          branch: true,
          customer: true,
          trainer: true,
          contract: {
            include: {
              servicePackage: {
                select: {
                  name: true,
                },
              },
            },
          },
          attendance: {
            include: {
              customer: {
                select: {
                  fullName: true,
                },
              },
            },
            orderBy: [{ createdAt: 'desc' }],
          },
          _count: {
            select: {
              attendance: true,
            },
          },
        },
        orderBy: buildSort(query, 'scheduledAt'),
        ...buildPagination(query),
      }),
      this.prisma.trainingSession.count({ where }),
    ]);

    const attachmentCountMap = await this.resolveAttachmentCountMap(
      'training_session',
      data.map((item) => item.id),
    );

    return buildListResponse(
      data.map((item) =>
        this.mapTrainingSessionRecord(
          item,
          attachmentCountMap.get(item.id) || 0,
        ),
      ),
      total,
      query,
    );
  }

  async getTrainingSession(id: string, user: AuthUser) {
    const session = await this.prisma.trainingSession.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        customer: true,
        trainer: true,
        contract: {
          include: {
            servicePackage: {
              select: {
                name: true,
              },
            },
          },
        },
        attendance: {
          include: {
            customer: {
              select: {
                fullName: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
        },
        _count: {
          select: {
            attendance: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Training session not found');
    }

    const attachmentCount = await this.prisma.attachment.count({
      where: {
        entityType: 'training_session',
        entityId: session.id,
      },
    });

    return this.mapTrainingSessionRecord(session, attachmentCount);
  }

  async createTrainingSession(dto: CreateTrainingSessionDto, user: AuthUser) {
    const payload = await this.prisma.trainingSession.create({
      data: {
        ...dto,
        scheduledAt: new Date(dto.scheduledAt),
        status: (dto.status as any) || 'SCHEDULED',
      },
      include: {
        branch: true,
        customer: true,
        trainer: true,
        contract: true,
      },
    });

    await this.audit(
      user,
      'training-sessions',
      AuditAction.CREATE,
      'training_session',
      payload.id,
      undefined,
      payload,
    );
    return this.getTrainingSession(payload.id, user);
  }

  async updateTrainingSession(
    id: string,
    dto: UpdateTrainingSessionDto,
    user: AuthUser,
  ) {
    const before = await this.prisma.trainingSession.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Training session not found');
    const payload = await this.prisma.trainingSession.update({
      where: { id },
      data: {
        ...dto,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        status: dto.status as any,
      },
      include: {
        branch: true,
        customer: true,
        trainer: true,
        contract: true,
      },
    });
    await this.audit(
      user,
      'training-sessions',
      AuditAction.UPDATE,
      'training_session',
      id,
      before,
      payload,
    );
    return this.getTrainingSession(id, user);
  }

  async removeTrainingSession(id: string, user: AuthUser) {
    const before = await this.prisma.trainingSession.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Training session not found');
    const payload = await this.prisma.trainingSession.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });
    await this.audit(
      user,
      'training-sessions',
      AuditAction.DELETE,
      'training_session',
      id,
      before,
      payload,
    );
    return payload;
  }

  async checkInTrainingSession(
    id: string,
    dto: CheckInTrainingSessionDto,
    user: AuthUser,
  ) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id },
      include: { contract: true },
    });
    if (!session) throw new NotFoundException('Training session not found');

    const consumed = dto.consumedSessions || session.consumedSessions || 1;

    const payload = await this.prisma.$transaction(async (tx) => {
      const updatedSession = await tx.trainingSession.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          checkInAt: new Date(),
          outcome: dto.outcome,
          note: dto.note,
          consumedSessions: consumed,
        },
      });

      await tx.trainingAttendance.create({
        data: {
          sessionId: id,
          customerId: session.customerId,
          status: 'PRESENT',
          checkInAt: new Date(),
          consumedSessions: consumed,
          note: dto.note,
        },
      });

      if (session.contractId) {
        const contract = await tx.contract.findUniqueOrThrow({
          where: { id: session.contractId },
        });
        const nextUsedSessions = contract.usedSessions + consumed;
        const nextRemainingSessions = Math.max(
          contract.remainingSessions - consumed,
          0,
        );
        const perSessionValue =
          contract.totalSessions > 0
            ? Number(contract.totalAmount) / contract.totalSessions
            : 0;
        const remainingValue = new Prisma.Decimal(
          perSessionValue * nextRemainingSessions,
        );

        await tx.contract.update({
          where: { id: session.contractId },
          data: {
            usedSessions: nextUsedSessions,
            remainingSessions: nextRemainingSessions,
            remainingValue,
          },
        });

        await tx.contractHistory.create({
          data: {
            contractId: session.contractId,
            action: 'CHECK_IN',
            note: `Session ${session.code} completed`,
            actedById: user.id,
            afterData: {
              usedSessions: nextUsedSessions,
              remainingSessions: nextRemainingSessions,
            } as never,
          },
        });
      }

      return updatedSession;
    });

    await this.audit(
      user,
      'training-sessions',
      AuditAction.CHECK_IN,
      'training_session',
      id,
      session,
      payload,
    );
    return payload;
  }
}
