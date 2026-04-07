import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { execFile } from 'child_process';
import { resolve } from 'path';
import { promisify } from 'util';
import { bootstrapTenantDatabase } from '../../prisma/tenant-bootstrap.util';
import { TenantCatalogService } from '../../prisma/tenant-catalog.service';
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
  AttendanceMachineMaintenanceDto,
  CreateAttendanceMachineDto,
  CreateBranchDto,
  CreateRoleDto,
  CreateStaffAttendanceEventDto,
  CreateTenantDatabaseDto,
  CreateUserDto,
  ResetPasswordDto,
  UpdateAttendanceMachineDto,
  UpdateBranchDto,
  UpdateRoleDto,
  UpdateStaffAttendanceEventDto,
  UpdateTenantDatabaseDto,
  UpdateUserDto,
} from './system.dto';

const execFileAsync = promisify(execFile);
const attendanceDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const attendanceTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

@Injectable()
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCatalogService: TenantCatalogService,
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
    branchIdOverride?: string | null,
  ) {
    await this.auditLogsService.write({
      module,
      action,
      userId: user.id,
      branchId:
        branchIdOverride === undefined ? user.branchId : branchIdOverride,
      entityType,
      entityId,
      beforeData,
      afterData,
    });
  }

  private scopedBranchId(query: QueryDto, user: AuthUser) {
    return !this.isGlobal(user) && user.branchId
      ? user.branchId
      : query.branchId;
  }

  private assertBranchAccess(
    branchId: string | null | undefined,
    user: AuthUser,
  ) {
    if (!branchId) {
      return;
    }

    if (!this.isGlobal(user) && user.branchId && branchId !== user.branchId) {
      throw new ForbiddenException(
        'Ban chi duoc thao tac du lieu thuoc chi nhanh cua minh',
      );
    }
  }

  private attendanceDateKey(value: Date) {
    const parts = attendanceDateFormatter.formatToParts(value);
    const year = parts.find((part) => part.type === 'year')?.value || '0000';
    const month = parts.find((part) => part.type === 'month')?.value || '01';
    const day = parts.find((part) => part.type === 'day')?.value || '01';
    return `${year}-${month}-${day}`;
  }

  private attendanceTimeLabel(value: Date) {
    return attendanceTimeFormatter.format(value);
  }

  private normalizeAttendanceCode(value?: string | null) {
    const normalized = value?.trim().toUpperCase();
    return normalized || undefined;
  }

  private resolveEmployeeCode(
    input: { employeeCode?: string | null; username?: string | null },
    fallbackUsername?: string | null,
  ) {
    return (
      this.normalizeAttendanceCode(input.employeeCode) ||
      this.normalizeAttendanceCode(input.username) ||
      this.normalizeAttendanceCode(fallbackUsername)
    );
  }

  private resolveStaffAttendanceCode(
    input: {
      attendanceCode?: string | null;
      employeeCode?: string | null;
      username?: string | null;
    },
    fallbackUsername?: string | null,
  ) {
    return (
      this.normalizeAttendanceCode(input.attendanceCode) ||
      this.normalizeAttendanceCode(input.employeeCode) ||
      this.normalizeAttendanceCode(input.username) ||
      this.normalizeAttendanceCode(fallbackUsername)
    );
  }

  private mapStaffAttendanceEvent(
    event: Prisma.StaffAttendanceEventGetPayload<{
      include: {
        branch: true;
        user: { include: { roles: { include: { role: true } } } };
        attendanceMachine: true;
      };
    }>,
  ) {
    return {
      id: event.id,
      branchId: event.branchId,
      userId: event.userId,
      attendanceMachineId: event.attendanceMachineId,
      branchName: event.branch.name,
      staffCode: this.resolveEmployeeCode(event.user) || '',
      attendanceCode: this.resolveStaffAttendanceCode(event.user) || '',
      username: event.user.username,
      staffName: event.user.fullName,
      staffTitle: event.user.title || '',
      roleNames: event.user.roles.map((role) => role.role.name).join(', '),
      machineName: event.attendanceMachine?.name || '',
      machineCode: event.attendanceMachine?.code || '',
      eventAt: event.eventAt.toISOString(),
      eventDate: this.attendanceDateKey(event.eventAt),
      eventTime: this.attendanceTimeLabel(event.eventAt),
      eventDateTime: event.eventAt.toISOString(),
      eventType: event.eventType,
      verificationMethod: event.verificationMethod,
      source: event.source,
      rawCode: event.rawCode || '',
      note: event.note || '',
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      createdDateTime: event.createdAt.toISOString(),
      updatedDateTime: event.updatedAt.toISOString(),
    };
  }

  private mapBranchRecord(branch: any) {
    const users = Array.isArray(branch.users)
      ? branch.users.map((user: any) => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          title: user.title || '',
          status: user.status,
          roleNames: Array.isArray(user.roles)
            ? user.roles
                .map((item: any) => item.role?.name || '')
                .filter(Boolean)
                .join(', ')
            : '',
        }))
      : undefined;

    const attendanceMachines = Array.isArray(branch.attendanceMachines)
      ? branch.attendanceMachines.map((machine: any) => ({
          id: machine.id,
          code: machine.code,
          name: machine.name,
          host: machine.host || '',
          connectionStatus: machine.connectionStatus,
          syncEnabled: machine.syncEnabled,
          lastSyncedDateTime: machine.lastSyncedAt?.toISOString() || '',
        }))
      : undefined;

    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      phone: branch.phone || '',
      email: branch.email || '',
      address: branch.address || '',
      openingTime: branch.openingTime || '',
      closingTime: branch.closingTime || '',
      operatingHours:
        branch.openingTime || branch.closingTime
          ? [branch.openingTime || '--:--', branch.closingTime || '--:--'].join(
              ' - ',
            )
          : '',
      maxDepositHours: branch.maxDepositHours ?? 0,
      maxBookingsPerDay: branch.maxBookingsPerDay ?? 0,
      requiresDeposit: branch.requiresDeposit,
      requiresDepositLabel: branch.requiresDeposit
        ? 'Bat buoc coc'
        : 'Khong bat buoc',
      logoUrl: branch.logoUrl || '',
      note: branch.note || '',
      userCount: branch._count?.users ?? (users?.length || 0),
      customerCount: branch._count?.customers ?? 0,
      trainerCount: branch._count?.trainers ?? 0,
      attendanceMachineCount:
        branch._count?.attendanceMachines ?? (attendanceMachines?.length || 0),
      users,
      attendanceMachines,
      createdAt: branch.createdAt.toISOString(),
      updatedAt: branch.updatedAt.toISOString(),
      createdDateTime: branch.createdAt.toISOString(),
      updatedDateTime: branch.updatedAt.toISOString(),
    };
  }

  private mapRoleRecord(role: any) {
    const permissions = Array.isArray(role.permissions)
      ? role.permissions.map((item: any) => ({
          id: item.permission?.id || item.permissionId,
          permissionId: item.permission?.id || item.permissionId,
          code: item.permission?.code || '',
          module: item.permission?.module || '',
          action: item.permission?.action || '',
          description: item.permission?.description || '',
        }))
      : undefined;

    const users = Array.isArray(role.users)
      ? role.users.map((item: any) => ({
          id: item.user?.id || item.userId,
          username: item.user?.username || '',
          fullName: item.user?.fullName || '',
          branchName: item.user?.branch?.name || '',
          status: item.user?.status || '',
        }))
      : undefined;

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description || '',
      isSystem: role.isSystem,
      roleType: role.isSystem ? 'SYSTEM' : 'CUSTOM',
      permissionCount: role._count?.permissions ?? (permissions?.length || 0),
      userCount: role._count?.users ?? (users?.length || 0),
      permissionIds: permissions?.map((item) => item.permissionId) || [],
      permissionNames:
        permissions
          ?.map((item) => item.code)
          .filter(Boolean)
          .join(', ') || '',
      permissions,
      users,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
      createdDateTime: role.createdAt.toISOString(),
      updatedDateTime: role.updatedAt.toISOString(),
    };
  }

  private mapUserRecord(user: any) {
    const roles = Array.isArray(user.roles)
      ? user.roles.map((item: any) => ({
          id: item.role?.id || item.roleId,
          roleId: item.role?.id || item.roleId,
          code: item.role?.code || '',
          name: item.role?.name || '',
          description: item.role?.description || '',
        }))
      : [];

    const permissionMap = new Map<
      string,
      {
        id: string;
        code: string;
        module: string;
        action: string;
        description: string;
      }
    >();
    for (const role of Array.isArray(user.roles) ? user.roles : []) {
      for (const permissionRow of Array.isArray(role.role?.permissions)
        ? role.role.permissions
        : []) {
        const permission = permissionRow.permission;
        if (!permission?.id || permissionMap.has(permission.id)) {
          continue;
        }
        permissionMap.set(permission.id, {
          id: permission.id,
          code: permission.code || '',
          module: permission.module || '',
          action: permission.action || '',
          description: permission.description || '',
        });
      }
    }

    const permissions = Array.from(permissionMap.values());

    return {
      id: user.id,
      branchId: user.branchId || '',
      branchName: user.branch?.name || '',
      username: user.username,
      employeeCode: this.resolveEmployeeCode(user) || '',
      attendanceCode: this.resolveStaffAttendanceCode(user) || '',
      staffOptionLabel: [
        this.resolveEmployeeCode(user) || user.username,
        user.fullName,
      ]
        .filter(Boolean)
        .join(' - '),
      fullName: user.fullName,
      email: user.email || '',
      phone: user.phone || '',
      title: user.title || '',
      avatarUrl: user.avatarUrl || '',
      status: user.status,
      roleIds: roles.map((role) => role.roleId),
      roleNames: roles
        .map((role) => role.name)
        .filter(Boolean)
        .join(', '),
      roleCount: roles.length,
      roles,
      permissionCount: permissions.length,
      permissions,
      permissionSummary: permissions
        .map((permission) => permission.code)
        .join(', '),
      lastLoginAt: user.lastLoginAt?.toISOString() || '',
      lastLoginDateTime: user.lastLoginAt?.toISOString() || '',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      createdDateTime: user.createdAt.toISOString(),
      updatedDateTime: user.updatedAt.toISOString(),
    };
  }

  private mapAttendanceMachineRecord(machine: any) {
    const recentEvents = Array.isArray(machine.staffAttendanceEvents)
      ? machine.staffAttendanceEvents.map((event: any) => ({
          id: event.id,
          eventAt: event.eventAt.toISOString(),
          eventDateTime: event.eventAt.toISOString(),
          eventType: event.eventType,
          source: event.source,
          verificationMethod: event.verificationMethod,
          staffName: event.user?.fullName || '',
          staffCode: this.resolveEmployeeCode(event.user || {}) || '',
          attendanceCode:
            this.resolveStaffAttendanceCode(event.user || {}) || '',
          note: event.note || '',
        }))
      : undefined;

    return {
      id: machine.id,
      branchId: machine.branchId,
      branchName: machine.branch?.name || '',
      code: machine.code,
      name: machine.name,
      connectionPort: machine.connectionPort || '',
      host: machine.host || '',
      hasPassword: Boolean(machine.password),
      passwordStatus: machine.password ? 'Da cau hinh' : 'Chua cau hinh',
      syncEnabled: machine.syncEnabled,
      syncLabel: machine.syncEnabled ? 'Bat dong bo' : 'Tat dong bo',
      connectionStatus: machine.connectionStatus,
      eventCount:
        machine._count?.staffAttendanceEvents ?? (recentEvents?.length || 0),
      lastSyncedAt: machine.lastSyncedAt?.toISOString() || '',
      lastSyncedDateTime: machine.lastSyncedAt?.toISOString() || '',
      recentEvents,
      createdAt: machine.createdAt.toISOString(),
      updatedAt: machine.updatedAt.toISOString(),
      createdDateTime: machine.createdAt.toISOString(),
      updatedDateTime: machine.updatedAt.toISOString(),
    };
  }

  private mapAttendanceMachineStaffSyncRecord(
    user: {
      id: string;
      username?: string | null;
      employeeCode?: string | null;
      attendanceCode?: string | null;
      fullName?: string | null;
      title?: string | null;
      status?: string | null;
    },
    branchName: string,
  ) {
    return {
      recordType: 'STAFF',
      entityId: user.id,
      entityCode: this.resolveEmployeeCode(user, user.username) || '',
      displayName: user.fullName || '',
      attendanceCode:
        this.resolveStaffAttendanceCode(user, user.username) || '',
      identifier: user.username || '',
      status: user.status || '',
      note: user.title || '',
      branchName,
    };
  }

  private mapAttendanceMachineCustomerSyncRecord(
    customer: {
      id: string;
      code?: string | null;
      fullName?: string | null;
      fingerprintCode?: string | null;
      phone?: string | null;
      membershipStatus?: string | null;
      customerCardNumber?: string | null;
    },
    branchName: string,
  ) {
    return {
      recordType: 'CUSTOMER',
      entityId: customer.id,
      entityCode: customer.code || '',
      displayName: customer.fullName || '',
      attendanceCode:
        this.normalizeAttendanceCode(customer.fingerprintCode) || '',
      identifier: customer.phone || '',
      status: customer.membershipStatus || '',
      note: customer.customerCardNumber || '',
      branchName,
    };
  }

  private async listAttendanceMachineStaffSyncRecords(
    branchId: string,
    branchName: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        branchId,
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        employeeCode: true,
        attendanceCode: true,
        fullName: true,
        title: true,
        status: true,
      },
      orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
    });

    const allRecords = users.map((user) =>
      this.mapAttendanceMachineStaffSyncRecord(user, branchName),
    );
    const records = allRecords.filter((record) => record.attendanceCode);

    return {
      totalBranchRecords: users.length,
      missingCodeCount: Math.max(users.length - records.length, 0),
      allRecords,
      records,
    };
  }

  private async listAttendanceMachineCustomerSyncRecords(
    branchId: string,
    branchName: string,
  ) {
    const customers = await this.prisma.customer.findMany({
      where: {
        branchId,
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        fullName: true,
        fingerprintCode: true,
        phone: true,
        membershipStatus: true,
        customerCardNumber: true,
      },
      orderBy: [{ membershipStatus: 'asc' }, { fullName: 'asc' }],
    });

    const allRecords = customers.map((customer) =>
      this.mapAttendanceMachineCustomerSyncRecord(customer, branchName),
    );
    const records = allRecords.filter((record) => record.attendanceCode);

    return {
      totalBranchRecords: customers.length,
      missingCodeCount: Math.max(customers.length - records.length, 0),
      allRecords,
      records,
    };
  }

  private async listAttendanceMachineRecentEventRecords(
    machineId: string,
    branchId: string,
  ) {
    const events = await this.prisma.staffAttendanceEvent.findMany({
      where: {
        branchId,
        attendanceMachineId: machineId,
      },
      select: {
        id: true,
        eventAt: true,
        eventType: true,
        verificationMethod: true,
        source: true,
        rawCode: true,
        note: true,
        user: {
          select: {
            username: true,
            employeeCode: true,
            attendanceCode: true,
            fullName: true,
          },
        },
      },
      orderBy: { eventAt: 'desc' },
      take: 25,
    });

    return events.map((event) => ({
      recordType: 'EVENT',
      entityId: event.id,
      entityCode:
        this.resolveEmployeeCode(event.user || {}, event.user?.username) || '',
      displayName: event.user?.fullName || '',
      attendanceCode:
        this.resolveStaffAttendanceCode(
          event.user || {},
          event.user?.username,
        ) || '',
      identifier: event.rawCode || '',
      status: event.eventType,
      note: event.note || '',
      eventAt: event.eventAt.toISOString(),
      eventType: event.eventType,
      verificationMethod: event.verificationMethod,
      source: event.source,
    }));
  }

  private async resolveStaffAttendancePayload(
    input: {
      branchId: string;
      userId: string;
      attendanceMachineId?: string | null;
      eventAt: string;
      eventType: string;
      verificationMethod?: string;
      source?: string;
      rawCode?: string;
      note?: string;
    },
    user: AuthUser,
  ) {
    const normalizedSource = (input.source ||
      (input.attendanceMachineId ? 'MACHINE' : 'MANUAL')) as
      | 'MACHINE'
      | 'MANUAL'
      | 'IMPORT';
    const normalizedMachineId =
      normalizedSource === 'MANUAL' || normalizedSource === 'IMPORT'
        ? null
        : input.attendanceMachineId || null;

    this.assertBranchAccess(input.branchId, user);

    const staffMember = await this.prisma.user.findUnique({
      where: { id: input.userId },
      include: {
        branch: true,
      },
    });
    if (!staffMember || staffMember.deletedAt) {
      throw new NotFoundException('Nhan vien khong ton tai');
    }
    if (!staffMember.branchId) {
      throw new BadRequestException('Nhan vien nay chua duoc gan chi nhanh');
    }
    if (staffMember.branchId !== input.branchId) {
      throw new BadRequestException('Nhan vien khong thuoc chi nhanh da chon');
    }

    let attendanceMachine = null;
    if (normalizedMachineId) {
      attendanceMachine = await this.prisma.attendanceMachine.findUnique({
        where: { id: normalizedMachineId },
      });
      if (!attendanceMachine) {
        throw new NotFoundException('May cham cong khong ton tai');
      }
      if (attendanceMachine.branchId !== input.branchId) {
        throw new BadRequestException(
          'May cham cong khong thuoc chi nhanh da chon',
        );
      }
    }
    if (normalizedSource === 'MACHINE' && !attendanceMachine) {
      throw new BadRequestException(
        'Nguon MACHINE bat buoc phai chon may cham cong',
      );
    }

    const eventAt = new Date(input.eventAt);
    if (Number.isNaN(eventAt.getTime())) {
      throw new BadRequestException('Thoi diem cham cong khong hop le');
    }

    return {
      branchId: input.branchId,
      userId: input.userId,
      attendanceMachineId: normalizedMachineId,
      eventAt,
      eventType: input.eventType as any,
      verificationMethod: (input.verificationMethod ||
        (normalizedMachineId ? 'FINGERPRINT' : 'MANUAL')) as any,
      source: normalizedSource as any,
      rawCode:
        input.rawCode?.trim() ||
        this.resolveStaffAttendanceCode(staffMember, staffMember.username) ||
        '',
      note: input.note?.trim() || undefined,
    };
  }

  private assertTenantCatalogAccess(user: AuthUser) {
    if (user.tenantCode !== 'MASTER' || !this.isGlobal(user)) {
      throw new ForbiddenException(
        'Chi quan tri vien he thong moi duoc cap moi CSDL tenant',
      );
    }
  }

  private sanitizeTenantDatabase(tenant: Record<string, unknown>) {
    const { connectionUrl: _connectionUrl, ...safeTenant } = tenant;
    return safeTenant;
  }

  private getDefaultTenantAppUrl() {
    return this.tenantCatalogService.getDefaultTenantAppUrl();
  }

  private normalizeTenantCode(code: string) {
    return code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private normalizeIdentifier(value: string) {
    return value.trim();
  }

  private quoteIdentifier(value: string) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private quoteLiteral(value: string) {
    return `'${value.replace(/'/g, "''")}'`;
  }

  private assertDatabaseIdentifier(value: string, label: string) {
    if (!/^[A-Za-z][A-Za-z0-9_]{2,62}$/.test(value)) {
      throw new BadRequestException(
        `${label} chi duoc gom chu cai, so, dau gach duoi va phai bat dau bang chu cai`,
      );
    }
  }

  private assertUsername(value: string, label: string) {
    if (!/^[A-Za-z][A-Za-z0-9_.-]{2,50}$/.test(value)) {
      throw new BadRequestException(`${label} khong dung dinh dang cho phep`);
    }
  }

  private async runTenantMigrations(connectionUrl: string) {
    const schemaPath = resolve(
      __dirname,
      '../../../../../prisma/schema.prisma',
    );
    const projectRoot = resolve(schemaPath, '..', '..');
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

    try {
      await execFileAsync(
        command,
        ['prisma', 'migrate', 'deploy', '--schema', schemaPath],
        {
          cwd: projectRoot,
          env: {
            ...process.env,
            DATABASE_URL: connectionUrl,
          },
        },
      );
    } catch (error) {
      const stderr = (error as { stderr?: string }).stderr?.trim();
      throw new InternalServerErrorException(
        stderr || 'Khong the migrate schema cho tenant moi',
      );
    }
  }

  private async buildAdminDatabaseClient() {
    const masterConnection = this.tenantCatalogService.parseConnectionUrl(
      this.tenantCatalogService.getMasterConnectionUrl(),
    );
    const adminUrl = this.tenantCatalogService.buildConnectionUrl({
      ...masterConnection,
      databaseName: 'postgres',
    });

    const adminClient = new PrismaClient({
      datasourceUrl: adminUrl,
    });
    await adminClient.$connect();
    return { adminClient, masterConnection };
  }

  async listTenantDatabases(query: QueryDto, user: AuthUser) {
    this.assertTenantCatalogAccess(user);

    const where: Prisma.TenantDatabaseWhereInput = {
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { databaseName: { contains: query.search, mode: 'insensitive' } },
              { databaseUser: { contains: query.search, mode: 'insensitive' } },
              {
                adminUsername: { contains: query.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
      ...(query.status
        ? {
            isActive: query.status === 'ACTIVE',
          }
        : {}),
      ...buildDateRange('createdAt', query),
    };

    const [data, total] = await Promise.all([
      this.prisma.master.tenantDatabase.findMany({
        where,
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.master.tenantDatabase.count({ where }),
    ]);

    return buildListResponse(
      data.map((tenant) => this.sanitizeTenantDatabase(tenant)),
      total,
      query,
    );
  }

  async createTenantDatabase(dto: CreateTenantDatabaseDto, user: AuthUser) {
    this.assertTenantCatalogAccess(user);

    const tenantCode = this.normalizeTenantCode(dto.code);
    if (!tenantCode || tenantCode === 'MASTER') {
      throw new BadRequestException('Ma tenant khong hop le');
    }

    this.assertDatabaseIdentifier(dto.databaseName, 'Ten CSDL');
    this.assertDatabaseIdentifier(dto.databaseUser, 'User CSDL');
    this.assertUsername(dto.adminUsername, 'Username admin');

    const existingTenant = await this.prisma.master.tenantDatabase.findFirst({
      where: {
        OR: [
          { code: tenantCode },
          { databaseName: dto.databaseName },
          { databaseUser: dto.databaseUser },
        ],
      },
    });

    if (existingTenant) {
      throw new BadRequestException('Tenant hoac thong tin CSDL da ton tai');
    }

    const { adminClient, masterConnection } =
      await this.buildAdminDatabaseClient();
    let tenantClient: PrismaClient | null = null;
    let roleCreated = false;
    let databaseCreated = false;

    try {
      const roleExists = await adminClient.$queryRaw<
        Array<{ rolname: string }>
      >`
        SELECT rolname
        FROM pg_roles
        WHERE rolname = ${dto.databaseUser}
      `;
      if (roleExists.length) {
        throw new BadRequestException('User PostgreSQL da ton tai');
      }

      const databaseExists = await adminClient.$queryRaw<
        Array<{ datname: string }>
      >`
        SELECT datname
        FROM pg_database
        WHERE datname = ${dto.databaseName}
      `;
      if (databaseExists.length) {
        throw new BadRequestException('Ten CSDL PostgreSQL da ton tai');
      }

      await adminClient.$executeRawUnsafe(
        `CREATE ROLE ${this.quoteIdentifier(dto.databaseUser)} WITH LOGIN PASSWORD ${this.quoteLiteral(dto.databasePassword)}`,
      );
      roleCreated = true;

      await adminClient.$executeRawUnsafe(
        `CREATE DATABASE ${this.quoteIdentifier(dto.databaseName)} OWNER ${this.quoteIdentifier(dto.databaseUser)}`,
      );
      databaseCreated = true;

      const tenantConnectionUrl = this.tenantCatalogService.buildConnectionUrl({
        host: masterConnection.host,
        port: masterConnection.port,
        databaseName: dto.databaseName,
        user: dto.databaseUser,
        password: dto.databasePassword,
        schema: masterConnection.schema,
      });

      await this.runTenantMigrations(tenantConnectionUrl);

      tenantClient = new PrismaClient({
        datasourceUrl: tenantConnectionUrl,
      });
      await tenantClient.$connect();

      await bootstrapTenantDatabase(tenantClient, {
        tenantCode,
        tenantName: dto.name,
        branchName: dto.branchName?.trim() || `${dto.name} HQ`,
        adminUsername: this.normalizeIdentifier(dto.adminUsername),
        adminFullName: dto.adminFullName?.trim() || `${dto.name} Administrator`,
        adminEmail: dto.adminEmail?.trim(),
        adminPhone: dto.adminPhone?.trim(),
        adminPassword: dto.adminPassword,
      });

      const tenant = await this.prisma.master.tenantDatabase.create({
        data: {
          code: tenantCode,
          name: dto.name.trim(),
          databaseHost: masterConnection.host,
          databasePort: masterConnection.port,
          databaseName: dto.databaseName,
          databaseUser: dto.databaseUser,
          connectionUrl: tenantConnectionUrl,
          adminUsername: dto.adminUsername.trim(),
          adminEmail: dto.adminEmail?.trim(),
          branchName: dto.branchName?.trim() || `${dto.name} HQ`,
          appUrl: dto.appUrl?.trim() || this.getDefaultTenantAppUrl(),
          note: dto.note?.trim(),
          createdById: user.id,
          updatedById: user.id,
        },
      });

      await this.audit(
        user,
        'tenant-databases',
        AuditAction.CREATE,
        'tenant_database',
        tenant.id,
        undefined,
        this.sanitizeTenantDatabase(tenant),
      );

      return this.sanitizeTenantDatabase(tenant);
    } catch (error) {
      if (databaseCreated) {
        await adminClient.$executeRawUnsafe(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${this.quoteLiteral(dto.databaseName)} AND pid <> pg_backend_pid()`,
        );
        await adminClient.$executeRawUnsafe(
          `DROP DATABASE IF EXISTS ${this.quoteIdentifier(dto.databaseName)}`,
        );
      }

      if (roleCreated) {
        await adminClient.$executeRawUnsafe(
          `DROP ROLE IF EXISTS ${this.quoteIdentifier(dto.databaseUser)}`,
        );
      }

      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Khong the cap moi tenant database',
      );
    } finally {
      if (tenantClient) {
        await tenantClient.$disconnect();
      }
      await adminClient.$disconnect();
    }
  }

  async updateTenantDatabase(
    id: string,
    dto: UpdateTenantDatabaseDto,
    user: AuthUser,
  ) {
    this.assertTenantCatalogAccess(user);
    const before = await this.prisma.master.tenantDatabase.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Tenant database not found');

    const tenant = await this.prisma.master.tenantDatabase.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        adminEmail: dto.adminEmail?.trim(),
        branchName: dto.branchName?.trim(),
        appUrl: dto.appUrl?.trim(),
        note: dto.note?.trim(),
        isActive: dto.isActive,
        updatedById: user.id,
      },
    });

    await this.audit(
      user,
      'tenant-databases',
      AuditAction.UPDATE,
      'tenant_database',
      id,
      this.sanitizeTenantDatabase(before),
      this.sanitizeTenantDatabase(tenant),
    );

    return this.sanitizeTenantDatabase(tenant);
  }

  async removeTenantDatabase(id: string, user: AuthUser) {
    this.assertTenantCatalogAccess(user);
    const before = await this.prisma.master.tenantDatabase.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Tenant database not found');
    if (before.isSystem) {
      throw new BadRequestException('Khong the khoa tenant he thong mac dinh');
    }

    const tenant = await this.prisma.master.tenantDatabase.update({
      where: { id },
      data: {
        isActive: false,
        updatedById: user.id,
      },
    });

    await this.audit(
      user,
      'tenant-databases',
      AuditAction.DELETE,
      'tenant_database',
      id,
      this.sanitizeTenantDatabase(before),
      this.sanitizeTenantDatabase(tenant),
    );

    return this.sanitizeTenantDatabase(tenant);
  }

  async listBranches(query: QueryDto, user: AuthUser) {
    const where: Prisma.BranchWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...buildDateRange('createdAt', query),
      ...(!this.isGlobal(user) && user.branchId ? { id: user.branchId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              customers: true,
              trainers: true,
              attendanceMachines: true,
            },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.branch.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapBranchRecord(item)),
      total,
      query,
    );
  }

  async getBranch(id: string, user: AuthUser) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        users: {
          where: { deletedAt: null },
          include: {
            roles: {
              include: { role: true },
            },
          },
          orderBy: [{ status: 'asc' }, { fullName: 'asc' }],
        },
        attendanceMachines: {
          orderBy: [{ connectionStatus: 'asc' }, { name: 'asc' }],
        },
        _count: {
          select: {
            users: true,
            customers: true,
            trainers: true,
            attendanceMachines: true,
          },
        },
      },
    });
    if (!branch || branch.deletedAt)
      throw new NotFoundException('Branch not found');
    this.assertBranchAccess(branch.id, user);
    return this.mapBranchRecord(branch);
  }

  async createBranch(dto: CreateBranchDto, user: AuthUser) {
    const branch = await this.prisma.branch.create({
      data: dto,
      include: {
        _count: {
          select: {
            users: true,
            customers: true,
            trainers: true,
            attendanceMachines: true,
          },
        },
      },
    });
    await this.audit(
      user,
      'branches',
      AuditAction.CREATE,
      'branch',
      branch.id,
      undefined,
      branch,
    );
    return this.mapBranchRecord(branch);
  }

  async updateBranch(id: string, dto: UpdateBranchDto, user: AuthUser) {
    const before = await this.prisma.branch.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Branch not found');
    const branch = await this.prisma.branch.update({
      where: { id },
      data: dto,
      include: {
        _count: {
          select: {
            users: true,
            customers: true,
            trainers: true,
            attendanceMachines: true,
          },
        },
      },
    });
    await this.audit(
      user,
      'branches',
      AuditAction.UPDATE,
      'branch',
      id,
      before,
      branch,
    );
    return this.mapBranchRecord(branch);
  }

  async removeBranch(id: string, user: AuthUser) {
    const before = await this.prisma.branch.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Branch not found');
    const branch = await this.prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'branches',
      AuditAction.DELETE,
      'branch',
      id,
      before,
      branch,
    );
    return branch;
  }

  async listRoles(query: QueryDto) {
    const where: Prisma.RoleWhereInput = {
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
      this.prisma.role.findMany({
        where,
        include: {
          permissions: {
            include: { permission: true },
          },
          _count: {
            select: {
              users: true,
              permissions: true,
            },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.role.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapRoleRecord(item)),
      total,
      query,
    );
  }

  async getRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permission: { module: 'asc' } },
        },
        users: {
          include: {
            user: {
              include: {
                branch: true,
              },
            },
          },
          orderBy: { user: { fullName: 'asc' } },
        },
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
      },
    });
    if (!role || role.deletedAt) throw new NotFoundException('Role not found');
    return this.mapRoleRecord(role);
  }

  async createRole(dto: CreateRoleDto, user: AuthUser) {
    const role = await this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        permissions: dto.permissionIds?.length
          ? {
              createMany: {
                data: dto.permissionIds.map((permissionId) => ({
                  permissionId,
                })),
              },
            }
          : undefined,
      },
      include: {
        permissions: { include: { permission: true } },
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
      },
    });
    await this.audit(
      user,
      'roles',
      AuditAction.CREATE,
      'role',
      role.id,
      undefined,
      role,
    );
    return this.mapRoleRecord(role);
  }

  async updateRole(id: string, dto: UpdateRoleDto, user: AuthUser) {
    const before = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: true },
    });
    if (!before) throw new NotFoundException('Role not found');

    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    const role = await this.prisma.role.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        permissions: dto.permissionIds?.length
          ? {
              createMany: {
                data: dto.permissionIds.map((permissionId) => ({
                  permissionId,
                })),
              },
            }
          : undefined,
      },
      include: {
        permissions: { include: { permission: true } },
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
      },
    });

    await this.audit(
      user,
      'roles',
      AuditAction.UPDATE,
      'role',
      id,
      before,
      role,
    );
    return this.mapRoleRecord(role);
  }

  async removeRole(id: string, user: AuthUser) {
    const before = await this.prisma.role.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Role not found');
    const role = await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'roles',
      AuditAction.DELETE,
      'role',
      id,
      before,
      role,
    );
    return role;
  }

  async listUsers(query: QueryDto, user: AuthUser) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: 'insensitive' } },
              { employeeCode: { contains: query.search, mode: 'insensitive' } },
              {
                attendanceCode: { contains: query.search, mode: 'insensitive' },
              },
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(query.status ? { status: query.status as any } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          branch: true,
          roles: {
            include: { role: true },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapUserRecord(item)),
      total,
      query,
    );
  }

  async getUser(id: string, user: AuthUser) {
    const payload = await this.prisma.user.findUnique({
      where: { id },
      include: {
        branch: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });
    if (!payload || payload.deletedAt)
      throw new NotFoundException('User not found');
    this.assertBranchAccess(payload.branchId, user);
    return this.mapUserRecord(payload);
  }

  async createUser(dto: CreateUserDto, user: AuthUser) {
    const employeeCode = this.resolveEmployeeCode({
      employeeCode: dto.employeeCode,
      username: dto.username,
    });
    const attendanceCode = this.resolveStaffAttendanceCode({
      attendanceCode: dto.attendanceCode,
      employeeCode,
      username: dto.username,
    });
    const payload = await this.prisma.user.create({
      data: {
        branchId: dto.branchId,
        username: dto.username,
        employeeCode,
        attendanceCode,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash: await hash(dto.password, 10),
        title: dto.title,
        avatarUrl: dto.avatarUrl,
        status: (dto.status as any) || 'ACTIVE',
        roles: {
          createMany: {
            data: dto.roleIds.map((roleId) => ({ roleId })),
          },
        },
      },
      include: {
        branch: true,
        roles: { include: { role: true } },
      },
    });
    await this.audit(
      user,
      'users',
      AuditAction.CREATE,
      'user',
      payload.id,
      undefined,
      payload,
    );
    return this.mapUserRecord(payload);
  }

  async updateUser(id: string, dto: UpdateUserDto, user: AuthUser) {
    const before = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });
    if (!before) throw new NotFoundException('User not found');

    if (dto.roleIds) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
    }

    const nextUsername = dto.username ?? before.username;
    const employeeCode =
      dto.employeeCode !== undefined
        ? this.resolveEmployeeCode(
            { employeeCode: dto.employeeCode, username: nextUsername },
            before.username,
          )
        : before.employeeCode ||
          this.resolveEmployeeCode({ username: nextUsername }, before.username);
    const attendanceCode =
      dto.attendanceCode !== undefined
        ? this.resolveStaffAttendanceCode(
            {
              attendanceCode: dto.attendanceCode,
              employeeCode,
              username: nextUsername,
            },
            before.username,
          )
        : before.attendanceCode ||
          this.resolveStaffAttendanceCode(
            { employeeCode, username: nextUsername },
            before.username,
          );

    const payload = await this.prisma.user.update({
      where: { id },
      data: {
        branchId: dto.branchId,
        username: dto.username,
        employeeCode,
        attendanceCode,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        title: dto.title,
        avatarUrl: dto.avatarUrl,
        status: dto.status as any,
        roles: dto.roleIds?.length
          ? {
              createMany: {
                data: dto.roleIds.map((roleId) => ({ roleId })),
              },
            }
          : undefined,
      },
      include: {
        branch: true,
        roles: { include: { role: true } },
      },
    });

    await this.audit(
      user,
      'users',
      AuditAction.UPDATE,
      'user',
      id,
      before,
      payload,
    );
    return this.mapUserRecord(payload);
  }

  async resetPassword(id: string, dto: ResetPasswordDto, user: AuthUser) {
    const before = await this.prisma.user.findUnique({
      where: { id },
      include: {
        branch: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });
    if (!before || before.deletedAt)
      throw new NotFoundException('User not found');
    this.assertBranchAccess(before.branchId, user);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hash(dto.password, 10),
      },
    });
    await this.audit(
      user,
      'users',
      AuditAction.UPDATE,
      'user',
      id,
      this.mapUserRecord(before),
      { resetPassword: true },
      before.branchId,
    );
    return { success: true, id };
  }

  async removeUser(id: string, user: AuthUser) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('User not found');
    const payload = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'LOCKED' },
    });
    await this.audit(
      user,
      'users',
      AuditAction.DELETE,
      'user',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listAttendanceMachines(query: QueryDto, user: AuthUser) {
    const where: Prisma.AttendanceMachineWhereInput = {
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { host: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(query.status ? { connectionStatus: query.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.attendanceMachine.findMany({
        where,
        include: {
          branch: true,
          _count: {
            select: {
              staffAttendanceEvents: true,
            },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.attendanceMachine.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapAttendanceMachineRecord(item)),
      total,
      query,
    );
  }

  async getAttendanceMachine(id: string, user: AuthUser) {
    const payload = await this.prisma.attendanceMachine.findUnique({
      where: { id },
      include: {
        branch: true,
        staffAttendanceEvents: {
          take: 10,
          orderBy: { eventAt: 'desc' },
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            staffAttendanceEvents: true,
          },
        },
      },
    });
    if (!payload) throw new NotFoundException('Attendance machine not found');
    this.assertBranchAccess(payload.branchId, user);
    return this.mapAttendanceMachineRecord(payload);
  }

  async createAttendanceMachine(
    dto: CreateAttendanceMachineDto,
    user: AuthUser,
  ) {
    const payload = await this.prisma.attendanceMachine.create({
      data: dto,
      include: {
        branch: true,
        _count: {
          select: {
            staffAttendanceEvents: true,
          },
        },
      },
    });
    await this.audit(
      user,
      'attendance-machines',
      AuditAction.CREATE,
      'attendance_machine',
      payload.id,
      undefined,
      payload,
    );
    return this.mapAttendanceMachineRecord(payload);
  }

  async updateAttendanceMachine(
    id: string,
    dto: UpdateAttendanceMachineDto,
    user: AuthUser,
  ) {
    const before = await this.prisma.attendanceMachine.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Attendance machine not found');
    const payload = await this.prisma.attendanceMachine.update({
      where: { id },
      data: dto,
      include: {
        branch: true,
        _count: {
          select: {
            staffAttendanceEvents: true,
          },
        },
      },
    });
    await this.audit(
      user,
      'attendance-machines',
      AuditAction.UPDATE,
      'attendance_machine',
      id,
      before,
      payload,
    );
    return this.mapAttendanceMachineRecord(payload);
  }

  async maintainAttendanceMachine(
    id: string,
    dto: AttendanceMachineMaintenanceDto,
    user: AuthUser,
  ) {
    const before = await this.prisma.attendanceMachine.findUnique({
      where: { id },
      include: {
        branch: true,
        _count: {
          select: {
            staffAttendanceEvents: true,
          },
        },
      },
    });
    if (!before) throw new NotFoundException('Attendance machine not found');

    this.assertBranchAccess(before.branchId, user);

    const data: Prisma.AttendanceMachineUpdateInput = {};
    const operationAt = new Date();
    const branchName = before.branch?.name || '';
    let operationResult: Record<string, unknown> | undefined;
    let operationAuditResult: Record<string, unknown> | undefined;

    switch (dto.action) {
      case 'TOGGLE_SYNC':
        data.syncEnabled = !before.syncEnabled;
        break;
      case 'MARK_CONNECTED':
        data.connectionStatus = 'CONNECTED';
        break;
      case 'MARK_DISCONNECTED':
        data.connectionStatus = 'DISCONNECTED';
        break;
      case 'MARK_ERROR':
        data.connectionStatus = 'ERROR';
        break;
      case 'START_SYNC':
        data.connectionStatus = 'SYNCING';
        data.syncEnabled = true;
        break;
      case 'FINISH_SYNC':
        data.connectionStatus = 'CONNECTED';
        data.syncEnabled = true;
        data.lastSyncedAt = operationAt;
        break;
      case 'PULL_ATTENDANCE_EVENTS': {
        const records = await this.listAttendanceMachineRecentEventRecords(
          id,
          before.branchId,
        );
        data.connectionStatus = 'CONNECTED';
        data.syncEnabled = true;
        data.lastSyncedAt = operationAt;
        operationResult = {
          action: dto.action,
          title: 'Tai du lieu cham cong ve he thong',
          description:
            'Lay log cham cong moi nhat tu may va lam moi danh sach su kien.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          exportedAt: operationAt.toISOString(),
          totalRecords: records.length,
          preview: records.slice(0, 8),
          records,
        };
        operationAuditResult = {
          title: 'Tai du lieu cham cong ve he thong',
          totalRecords: records.length,
          exportedAt: operationAt.toISOString(),
        };
        break;
      }
      case 'PULL_MACHINE_CODES': {
        const [staffSync, customerSync] = await Promise.all([
          this.listAttendanceMachineStaffSyncRecords(
            before.branchId,
            branchName,
          ),
          this.listAttendanceMachineCustomerSyncRecords(
            before.branchId,
            branchName,
          ),
        ]);
        const records = [...staffSync.allRecords, ...customerSync.allRecords];
        operationResult = {
          action: dto.action,
          title: 'Tai ma cham cong ve may tinh',
          description:
            'Xuat danh sach ma cham cong cua nhan vien va hoi vien de doi soat hoac gan ma offline.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          exportedAt: operationAt.toISOString(),
          fileName: `attendance-machine-${before.code}-${this.attendanceDateKey(operationAt)}-codes.json`,
          totalRecords: records.length,
          staffCount: staffSync.records.length,
          customerCount: customerSync.records.length,
          missingCodeCount:
            staffSync.missingCodeCount + customerSync.missingCodeCount,
          preview: records.slice(0, 8),
          records,
        };
        operationAuditResult = {
          title: 'Tai ma cham cong ve may tinh',
          totalRecords: records.length,
          staffCount: staffSync.records.length,
          customerCount: customerSync.records.length,
          missingCodeCount:
            staffSync.missingCodeCount + customerSync.missingCodeCount,
          exportedAt: operationAt.toISOString(),
        };
        break;
      }
      case 'PUSH_STAFF_CODES': {
        const staffSync = await this.listAttendanceMachineStaffSyncRecords(
          before.branchId,
          branchName,
        );
        data.connectionStatus = 'CONNECTED';
        data.syncEnabled = true;
        data.lastSyncedAt = operationAt;
        operationResult = {
          action: dto.action,
          title: 'Tai nhan vien len may',
          description:
            'Day nhan vien co ma cham cong len may de su dung ngay tai chi nhanh.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          syncedAt: operationAt.toISOString(),
          totalRecords: staffSync.records.length,
          totalBranchRecords: staffSync.totalBranchRecords,
          missingCodeCount: staffSync.missingCodeCount,
          preview: staffSync.records.slice(0, 8),
          records: staffSync.records,
        };
        operationAuditResult = {
          title: 'Tai nhan vien len may',
          totalRecords: staffSync.records.length,
          totalBranchRecords: staffSync.totalBranchRecords,
          missingCodeCount: staffSync.missingCodeCount,
          syncedAt: operationAt.toISOString(),
        };
        break;
      }
      case 'PUSH_CUSTOMER_CODES': {
        const customerSync =
          await this.listAttendanceMachineCustomerSyncRecords(
            before.branchId,
            branchName,
          );
        data.connectionStatus = 'CONNECTED';
        data.syncEnabled = true;
        data.lastSyncedAt = operationAt;
        operationResult = {
          action: dto.action,
          title: 'Tai hoi vien len may',
          description:
            'Day hoi vien co ma van tay hoac ma cham cong len may de check-in tai cong vao.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          syncedAt: operationAt.toISOString(),
          totalRecords: customerSync.records.length,
          totalBranchRecords: customerSync.totalBranchRecords,
          missingCodeCount: customerSync.missingCodeCount,
          preview: customerSync.records.slice(0, 8),
          records: customerSync.records,
        };
        operationAuditResult = {
          title: 'Tai hoi vien len may',
          totalRecords: customerSync.records.length,
          totalBranchRecords: customerSync.totalBranchRecords,
          missingCodeCount: customerSync.missingCodeCount,
          syncedAt: operationAt.toISOString(),
        };
        break;
      }
      case 'SYNC_MACHINE_TIME':
        data.connectionStatus = 'CONNECTED';
        data.syncEnabled = true;
        data.lastSyncedAt = operationAt;
        operationResult = {
          action: dto.action,
          title: 'Dong bo gio may cham cong',
          description:
            'Cap nhat thoi gian may theo mui gio he thong de tranh lech check-in.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          syncedAt: operationAt.toISOString(),
          machineTime: operationAt.toISOString(),
          timeZone: 'Asia/Bangkok',
        };
        operationAuditResult = {
          title: 'Dong bo gio may cham cong',
          syncedAt: operationAt.toISOString(),
          timeZone: 'Asia/Bangkok',
        };
        break;
      default:
        throw new BadRequestException('Hanh dong maintenance khong hop le');
    }

    const payload = await this.prisma.attendanceMachine.update({
      where: { id },
      data,
      include: {
        branch: true,
        _count: {
          select: {
            staffAttendanceEvents: true,
          },
        },
      },
    });

    const beforeMapped = this.mapAttendanceMachineRecord(before);
    const mapped = this.mapAttendanceMachineRecord(payload);
    await this.audit(
      user,
      'attendance-machines',
      AuditAction.UPDATE,
      'attendance_machine',
      id,
      beforeMapped,
      {
        maintenanceAction: dto.action,
        operationResult: operationAuditResult,
        ...mapped,
      },
      payload.branchId,
    );

    return {
      ...mapped,
      maintenanceAction: dto.action,
      operationResult,
    };
  }

  async removeAttendanceMachine(id: string, user: AuthUser) {
    const before = await this.prisma.attendanceMachine.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Attendance machine not found');
    const payload = await this.prisma.attendanceMachine.delete({
      where: { id },
    });
    await this.audit(
      user,
      'attendance-machines',
      AuditAction.DELETE,
      'attendance_machine',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listStaffAttendanceEvents(query: QueryDto, user: AuthUser) {
    const branchId = this.scopedBranchId(query, user);
    const delegate = (this.prisma as PrismaClient).staffAttendanceEvent;

    const where: Prisma.StaffAttendanceEventWhereInput = {
      ...(query.search
        ? {
            OR: [
              {
                user: {
                  fullName: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  username: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  employeeCode: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  attendanceCode: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
              { rawCode: { contains: query.search, mode: 'insensitive' } },
              { note: { contains: query.search, mode: 'insensitive' } },
              {
                attendanceMachine: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      ...(branchId ? { branchId } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.eventType ? { eventType: query.eventType as any } : {}),
      ...(query.source ? { source: query.source as any } : {}),
      ...buildDateRange('eventAt', query),
    };

    const [data, total] = await Promise.all([
      delegate.findMany({
        where,
        include: {
          branch: true,
          user: {
            include: {
              roles: { include: { role: true } },
            },
          },
          attendanceMachine: true,
        },
        orderBy: buildSort(query, 'eventAt'),
        ...buildPagination(query),
      }),
      delegate.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapStaffAttendanceEvent(item)),
      total,
      query,
    );
  }

  async getStaffAttendanceEvent(id: string, user: AuthUser) {
    const delegate = (this.prisma as PrismaClient).staffAttendanceEvent;
    const payload = await delegate.findUnique({
      where: { id },
      include: {
        branch: true,
        user: {
          include: {
            roles: { include: { role: true } },
          },
        },
        attendanceMachine: true,
      },
    });

    if (!payload) {
      throw new NotFoundException('Su kien cham cong khong ton tai');
    }

    this.assertBranchAccess(payload.branchId, user);
    return this.mapStaffAttendanceEvent(payload);
  }

  async createStaffAttendanceEvent(
    dto: CreateStaffAttendanceEventDto,
    user: AuthUser,
  ) {
    const delegate = (this.prisma as PrismaClient).staffAttendanceEvent;
    const data = await this.resolveStaffAttendancePayload(dto, user);
    const payload = await delegate.create({
      data,
      include: {
        branch: true,
        user: {
          include: {
            roles: { include: { role: true } },
          },
        },
        attendanceMachine: true,
      },
    });

    const mapped = this.mapStaffAttendanceEvent(payload);
    await this.audit(
      user,
      'staff-attendance-events',
      AuditAction.CREATE,
      'staff_attendance_event',
      payload.id,
      undefined,
      mapped,
      payload.branchId,
    );
    return mapped;
  }

  async updateStaffAttendanceEvent(
    id: string,
    dto: UpdateStaffAttendanceEventDto,
    user: AuthUser,
  ) {
    const delegate = (this.prisma as PrismaClient).staffAttendanceEvent;
    const before = await delegate.findUnique({
      where: { id },
      include: {
        branch: true,
        user: {
          include: {
            roles: { include: { role: true } },
          },
        },
        attendanceMachine: true,
      },
    });

    if (!before) {
      throw new NotFoundException('Su kien cham cong khong ton tai');
    }

    this.assertBranchAccess(before.branchId, user);

    const data = await this.resolveStaffAttendancePayload(
      {
        branchId: dto.branchId || before.branchId,
        userId: dto.userId || before.userId,
        attendanceMachineId:
          dto.source === 'MANUAL' || dto.source === 'IMPORT'
            ? null
            : dto.attendanceMachineId !== undefined
              ? dto.attendanceMachineId
              : before.attendanceMachineId,
        eventAt: dto.eventAt || before.eventAt.toISOString(),
        eventType: dto.eventType || before.eventType,
        verificationMethod: dto.verificationMethod || before.verificationMethod,
        source: dto.source || before.source,
        rawCode:
          dto.rawCode !== undefined ? dto.rawCode : before.rawCode || undefined,
        note: dto.note !== undefined ? dto.note : before.note || undefined,
      },
      user,
    );

    const payload = await delegate.update({
      where: { id },
      data,
      include: {
        branch: true,
        user: {
          include: {
            roles: { include: { role: true } },
          },
        },
        attendanceMachine: true,
      },
    });

    const beforeMapped = this.mapStaffAttendanceEvent(before);
    const mapped = this.mapStaffAttendanceEvent(payload);
    await this.audit(
      user,
      'staff-attendance-events',
      AuditAction.UPDATE,
      'staff_attendance_event',
      id,
      beforeMapped,
      mapped,
      payload.branchId,
    );
    return mapped;
  }

  async removeStaffAttendanceEvent(id: string, user: AuthUser) {
    const delegate = (this.prisma as PrismaClient).staffAttendanceEvent;
    const before = await delegate.findUnique({
      where: { id },
      include: {
        branch: true,
        user: {
          include: {
            roles: { include: { role: true } },
          },
        },
        attendanceMachine: true,
      },
    });

    if (!before) {
      throw new NotFoundException('Su kien cham cong khong ton tai');
    }

    this.assertBranchAccess(before.branchId, user);

    await delegate.delete({ where: { id } });
    await this.audit(
      user,
      'staff-attendance-events',
      AuditAction.DELETE,
      'staff_attendance_event',
      id,
      this.mapStaffAttendanceEvent(before),
      { deleted: true },
      before.branchId,
    );

    return { success: true };
  }
}
