import { Prisma, PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import {
  defaultCustomerGroups,
  defaultCustomerSources,
  defaultLeadSources,
  defaultOtpSetting,
  defaultPaymentMethods,
  defaultSystemProfile,
  getGrantedPermissionCodes,
  modulePermissions,
  permissionActions,
  systemRoles,
} from '../common/constants/bootstrap.constants';

interface BootstrapTenantInput {
  tenantCode: string;
  tenantName: string;
  branchName: string;
  adminUsername: string;
  adminFullName: string;
  adminEmail?: string;
  adminPhone?: string;
  adminPassword: string;
}

const buildPermissionRows = () =>
  modulePermissions.flatMap((moduleName) =>
    permissionActions.map((action) => ({
      code: `${moduleName}.${action}`,
      module: moduleName,
      action,
      description: `${action} ${moduleName}`,
    })),
  );

export async function bootstrapTenantDatabase(
  prisma: PrismaClient,
  input: BootstrapTenantInput,
) {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    return {
      bootstrapped: false,
      reason: 'DATABASE_ALREADY_INITIALIZED',
    };
  }

  const permissions = await prisma.permission.createManyAndReturn({
    data: buildPermissionRows(),
  });

  const roles = await prisma.role.createManyAndReturn({
    data: systemRoles.map((role) => ({ ...role })),
  });

  const permissionMap = new Map(
    permissions.map((permission) => [permission.code, permission.id]),
  );
  const permissionCodes = permissions.map((permission) => permission.code);

  for (const role of roles) {
    const grantedCodes = getGrantedPermissionCodes(role.code, permissionCodes);
    if (!grantedCodes.length) continue;

    await prisma.rolePermission.createMany({
      data: grantedCodes.map((code) => ({
        roleId: role.id,
        permissionId: permissionMap.get(code),
      })),
      skipDuplicates: true,
    });
  }

  const branch = await prisma.branch.create({
    data: {
      code: `${input.tenantCode}-HQ`,
      name: input.branchName,
      phone: input.adminPhone,
      email: input.adminEmail,
      openingTime: '05:30',
      closingTime: '22:00',
      maxDepositHours: 24,
      maxBookingsPerDay: 120,
      requiresDeposit: false,
      note: `Khoi tao tu tenant ${input.tenantName}`,
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      branchId: branch.id,
      username: input.adminUsername,
      employeeCode: input.adminUsername.toUpperCase(),
      attendanceCode: input.adminUsername.toUpperCase(),
      fullName: input.adminFullName,
      email: input.adminEmail,
      phone: input.adminPhone,
      passwordHash: await hash(input.adminPassword, 10),
      title: 'System Administrator',
      status: 'ACTIVE',
    },
  });

  const superAdminRole = roles.find((role) => role.code === 'super_admin');
  if (superAdminRole) {
    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    });
  }

  await prisma.paymentMethod.createMany({
    data: defaultPaymentMethods.map((method) => ({ ...method })),
    skipDuplicates: true,
  });

  await prisma.customerGroup.createMany({
    data: defaultCustomerGroups.map((group) => ({ ...group })),
    skipDuplicates: true,
  });

  await prisma.customerSource.createMany({
    data: defaultCustomerSources.map((source) => ({ ...source })),
    skipDuplicates: true,
  });

  await prisma.leadSource.createMany({
    data: defaultLeadSources.map((source) => ({ ...source })),
    skipDuplicates: true,
  });

  await prisma.appSetting.createMany({
    data: [
      {
        group: 'general',
        key: 'system_profile',
        value: defaultSystemProfile as Prisma.InputJsonValue,
      },
      {
        group: 'auth',
        key: 'otp',
        value: defaultOtpSetting as Prisma.InputJsonValue,
      },
      {
        branchId: branch.id,
        group: 'branch',
        key: 'dashboard_targets',
        value: {
          dailyRevenueGoal: 0,
          monthlyRevenueGoal: 0,
          newLeadGoal: 0,
        } as Prisma.InputJsonValue,
      },
    ],
  });

  await prisma.notification.create({
    data: {
      branchId: branch.id,
      userId: adminUser.id,
      title: 'Tenant moi da san sang',
      content: `He thong ${input.tenantName} da duoc khoi tao thanh cong.`,
      type: 'SUCCESS',
      actionUrl: '/dashboard',
    },
  });

  return {
    bootstrapped: true,
    branchId: branch.id,
    adminUserId: adminUser.id,
  };
}
