import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { QueryDto } from '../dto/query.dto';
import { AuthUser } from '../types/auth-user.type';
import {
  buildDateRange,
  buildListResponse,
  buildPagination,
  buildSearchWhere,
  buildSort,
} from './query.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../../modules/audit-logs/audit-logs.service';

export interface CrudResourceConfig {
  model: keyof PrismaService;
  module: string;
  entityType: string;
  searchFields?: string[];
  include?: Record<string, unknown>;
  branchField?: string;
  ownerField?: string;
  statusField?: string;
  dateField?: string;
  defaultSortField?: string;
  softDelete?: boolean;
}

@Injectable()
export abstract class BaseCrudService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly auditLogsService: AuditLogsService,
  ) {}

  protected abstract readonly config: CrudResourceConfig;

  protected get model(): any {
    return (this.prisma as any)[this.config.model];
  }

  protected hasGlobalAccess(user: AuthUser) {
    return user.roleCodes.some((roleCode) =>
      ['super_admin', 'system_owner'].includes(roleCode),
    );
  }

  protected shouldRestrictToOwner(user: AuthUser) {
    return user.roleCodes.some((roleCode) =>
      ['sales', 'trainer', 'customer_care'].includes(roleCode),
    );
  }

  protected buildWhere(
    query: QueryDto,
    user: AuthUser,
    extraWhere: Record<string, unknown> = {},
  ) {
    const where: Record<string, unknown> = {
      ...extraWhere,
    };

    if (this.config.softDelete !== false) {
      where.deletedAt = null;
    }

    if (this.config.branchField && !this.hasGlobalAccess(user)) {
      where[this.config.branchField] = query.branchId || user.branchId;
    } else if (this.config.branchField && query.branchId) {
      where[this.config.branchField] = query.branchId;
    }

    if (
      this.config.ownerField &&
      this.shouldRestrictToOwner(user) &&
      !this.hasGlobalAccess(user)
    ) {
      where[this.config.ownerField] = user.id;
    }

    if (query.status && this.config.statusField) {
      where[this.config.statusField] = query.status;
    }

    const searchWhere = buildSearchWhere(
      query.search,
      this.config.searchFields || [],
    );
    if (searchWhere) {
      Object.assign(where, searchWhere);
    }

    const dateWhere = buildDateRange(
      this.config.dateField || 'createdAt',
      query,
    );
    if (dateWhere) {
      Object.assign(where, dateWhere);
    }

    if (query.expiring === 'true') {
      where.endDate = {
        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        gte: new Date(),
      };
    }

    return where;
  }

  async findAll(
    query: QueryDto,
    user: AuthUser,
    extraWhere: Record<string, unknown> = {},
  ) {
    const where = this.buildWhere(query, user, extraWhere);
    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        include: this.config.include,
        orderBy: buildSort(query, this.config.defaultSortField),
        ...buildPagination(query),
      }),
      this.model.count({ where }),
    ]);

    return buildListResponse(data, total, query);
  }

  async findOne(id: string, user: AuthUser) {
    const item = await this.model.findFirst({
      where: {
        id,
        ...this.buildWhere(new QueryDto(), user),
      },
      include: this.config.include,
    });

    if (!item) {
      throw new NotFoundException(`${this.config.entityType} not found`);
    }

    return item;
  }

  async create(data: Record<string, unknown>, user: AuthUser) {
    const payload = await this.model.create({
      data,
      include: this.config.include,
    });

    await this.auditLogsService.write({
      module: this.config.module,
      action: AuditAction.CREATE,
      userId: user.id,
      branchId: user.branchId,
      entityType: this.config.entityType,
      entityId: payload.id,
      afterData: payload,
    });

    return payload;
  }

  async update(id: string, data: Record<string, unknown>, user: AuthUser) {
    const before = await this.findOne(id, user);
    const payload = await this.model.update({
      where: { id },
      data,
      include: this.config.include,
    });

    await this.auditLogsService.write({
      module: this.config.module,
      action: AuditAction.UPDATE,
      userId: user.id,
      branchId: user.branchId,
      entityType: this.config.entityType,
      entityId: id,
      beforeData: before,
      afterData: payload,
    });

    return payload;
  }

  async remove(id: string, user: AuthUser) {
    const before = await this.findOne(id, user);
    const payload =
      this.config.softDelete === false
        ? await this.model.delete({ where: { id } })
        : await this.model.update({
            where: { id },
            data: { deletedAt: new Date() },
          });

    await this.auditLogsService.write({
      module: this.config.module,
      action: AuditAction.DELETE,
      userId: user.id,
      branchId: user.branchId,
      entityType: this.config.entityType,
      entityId: id,
      beforeData: before,
      afterData: payload,
    });

    return payload;
  }

  async restore(id: string, user: AuthUser) {
    const payload = await this.model.update({
      where: { id },
      data: { deletedAt: null },
      include: this.config.include,
    });

    await this.auditLogsService.write({
      module: this.config.module,
      action: AuditAction.RESTORE,
      userId: user.id,
      branchId: user.branchId,
      entityType: this.config.entityType,
      entityId: id,
      afterData: payload,
    });

    return payload;
  }
}
