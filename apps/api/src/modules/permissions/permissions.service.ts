import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getGrantedPermissionCodes,
  systemRoles,
} from '../../common/constants/bootstrap.constants';
import {
  detailedReportPermissionCodes,
  detailedReportPermissions,
} from './report-permission-catalog';

@Injectable()
export class PermissionsService {
  private static readonly detailedReportsMigrationKey =
    'detailed_report_permissions_v1';
  private static readonly rolePermissionCatalogSyncKey =
    'role_permission_catalog_sync_v5';

  constructor(private readonly prisma: PrismaService) {}

  async ensureCatalog() {
    await this.ensureDetailedReportPermissions();
    await this.ensureRolePermissionCatalogSync();
  }

  private async ensureDetailedReportPermissions() {
    const existingPermissions = await this.prisma.permission.findMany({
      where: {
        code: {
          in: detailedReportPermissionCodes,
        },
      },
      select: {
        code: true,
      },
    });

    const existingCodes = new Set(
      existingPermissions.map((permission) => permission.code),
    );
    const missingPermissions = detailedReportPermissions.filter(
      (permission) => !existingCodes.has(permission.code),
    );

    if (missingPermissions.length) {
      await this.prisma.permission.createMany({
        data: missingPermissions.map(
          ({ code, module, action, description }) => ({
            code,
            module,
            action,
            description,
          }),
        ),
        skipDuplicates: true,
      });
    }

    const migrationApplied = await this.prisma.appSetting.findFirst({
      where: {
        branchId: null,
        group: 'system',
        key: PermissionsService.detailedReportsMigrationKey,
      },
      select: { id: true },
    });

    if (migrationApplied) {
      return;
    }

    const genericReportsPermission = await this.prisma.permission.findFirst({
      where: { code: 'reports.view' },
      select: { id: true },
    });

    const roleRows = genericReportsPermission
      ? await this.prisma.rolePermission.findMany({
          where: { permissionId: genericReportsPermission.id },
          select: { roleId: true },
        })
      : [];

    const detailedPermissions = await this.prisma.permission.findMany({
      where: {
        code: {
          in: detailedReportPermissionCodes,
        },
      },
      select: {
        id: true,
      },
    });

    if (roleRows.length && detailedPermissions.length) {
      await this.prisma.rolePermission.createMany({
        data: roleRows.flatMap((role) =>
          detailedPermissions.map((permission) => ({
            roleId: role.roleId,
            permissionId: permission.id,
          })),
        ),
        skipDuplicates: true,
      });
    }

    await this.prisma.appSetting.create({
      data: {
        branchId: null,
        group: 'system',
        key: PermissionsService.detailedReportsMigrationKey,
        value: {
          appliedAt: new Date().toISOString(),
          roleCount: roleRows.length,
          permissionCodes: detailedReportPermissionCodes,
        },
      },
    });
  }

  private async ensureRolePermissionCatalogSync() {
    const migrationApplied = await this.prisma.appSetting.findFirst({
      where: {
        branchId: null,
        group: 'system',
        key: PermissionsService.rolePermissionCatalogSyncKey,
      },
      select: { id: true },
    });

    if (migrationApplied) {
      return;
    }

    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany({
        where: {
          code: {
            in: systemRoles.map((role) => role.code),
          },
        },
        select: {
          id: true,
          code: true,
        },
      }),
      this.prisma.permission.findMany({
        select: {
          id: true,
          code: true,
        },
      }),
    ]);

    const permissionMap = new Map(
      permissions.map((permission) => [permission.code, permission.id]),
    );
    const permissionCodes = permissions.map((permission) => permission.code);

    for (const role of roles) {
      const grantedCodes = getGrantedPermissionCodes(
        role.code,
        permissionCodes,
      );
      if (!grantedCodes.length) {
        continue;
      }

      await this.prisma.rolePermission.createMany({
        data: grantedCodes
          .map((code) => permissionMap.get(code))
          .filter((permissionId): permissionId is string =>
            Boolean(permissionId),
          )
          .map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
        skipDuplicates: true,
      });
    }

    await this.prisma.appSetting.create({
      data: {
        branchId: null,
        group: 'system',
        key: PermissionsService.rolePermissionCatalogSyncKey,
        value: {
          appliedAt: new Date().toISOString(),
          roleCount: roles.length,
        },
      },
    });
  }

  async findAll() {
    await this.ensureCatalog();
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }
}
