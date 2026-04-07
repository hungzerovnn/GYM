import { Injectable } from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  findAll(entityType?: string, entityId?: string) {
    return this.prisma.attachment.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async upload(
    file: Express.Multer.File,
    scope: { entityType: string; entityId: string; branchId?: string },
    user: AuthUser,
  ) {
    const payload = await this.prisma.attachment.create({
      data: {
        branchId: scope.branchId || user.branchId || undefined,
        entityType: scope.entityType,
        entityId: scope.entityId,
        fileName: file.originalname,
        fileUrl: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById: user.id,
      },
    });

    await this.auditLogsService.write({
      module: 'attachments',
      action: AuditAction.CREATE,
      userId: user.id,
      branchId: user.branchId,
      entityType: 'attachment',
      entityId: payload.id,
      afterData: payload,
    });

    return payload;
  }
}
