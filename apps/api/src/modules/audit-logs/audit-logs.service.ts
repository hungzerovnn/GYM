import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { QueryDto } from '../../common/dto/query.dto';
import {
  buildDateRange,
  buildListResponse,
  buildPagination,
} from '../../common/utils/query.util';
import { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async write(input: {
    module: string;
    action: AuditAction;
    userId?: string | null;
    branchId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    beforeData?: unknown;
    afterData?: unknown;
    metadata?: unknown;
  }) {
    return this.prisma.auditLog.create({
      data: {
        module: input.module,
        action: input.action,
        userId: input.userId,
        branchId: input.branchId,
        entityType: input.entityType,
        entityId: input.entityId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        beforeData: input.beforeData as never,
        afterData: input.afterData as never,
        metadata: input.metadata as never,
      },
    });
  }

  async findAll(query: QueryDto, user: AuthUser) {
    const where = {
      ...(user.branchId
        ? { branchId: query.branchId || user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(query.status ? { action: query.status as AuditAction } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...buildDateRange('createdAt', query),
      ...(query.search
        ? {
            OR: [
              {
                module: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                entityType: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                entityId: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...buildPagination(query),
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildListResponse(data, total, query);
  }

  async findOne(id: string, user: AuthUser) {
    const payload = await this.prisma.auditLog.findUnique({
      where: { id },
    });

    if (!payload || (user.branchId && payload.branchId !== user.branchId)) {
      throw new NotFoundException('Audit log not found');
    }

    return payload;
  }
}
