import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceMachineProtocol,
  AttendanceMachineType,
  AttendanceMachineVendor,
  AuditAction,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { addDays, endOfDay, startOfDay } from 'date-fns';
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
import {
  resolveShiftForDate,
  summarizeShiftAttendance,
} from '../../common/utils/staff-shift.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AttendanceDevicesService } from '../attendance-devices/attendance-devices.service';
import { AttendanceDeviceLogRangePayload } from '../attendance-devices/attendance-device.types';
import {
  AttendanceMachineMaintenanceDto,
  CreateAttendanceMachineDto,
  CreateBranchDto,
  CreateRoleDto,
  CreateStaffShiftAssignmentDto,
  CreateStaffShiftDto,
  CreateStaffAttendanceEventDto,
  CreateTenantDatabaseDto,
  CreateUserDto,
  ResetPasswordDto,
  UpdateAttendanceMachineDto,
  UpdateBranchDto,
  UpdateRoleDto,
  UpdateStaffShiftAssignmentDto,
  UpdateStaffShiftDto,
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
    private readonly attendanceDevicesService: AttendanceDevicesService,
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

  private buildStaffShiftCode() {
    return `SHIFT-${Date.now().toString(36).toUpperCase()}`;
  }

  private buildStaffShiftAssignmentCode(
    userSeed?: string | null,
    offset = 0,
  ) {
    const baseSeed = this.normalizeAttendanceCode(userSeed) || 'STAFF';
    const entropy = Date.now().toString(36).toUpperCase();
    return `SCA-${baseSeed}-${entropy}${offset ? `-${offset + 1}` : ''}`;
  }

  private buildStaffShiftAssignmentSuggestion(
    shifts: Array<{ code?: string | null; name?: string | null }>,
    includeAllShifts: boolean,
  ) {
    if (!shifts.length) {
      return {
        code: '',
        name: '',
      };
    }

    if (includeAllShifts) {
      return {
        code: 'ALL-CA',
        name: 'Tat ca ca',
      };
    }

    const firstShift = shifts[0];
    const firstCode = this.normalizeAttendanceCode(firstShift.code) || 'SHIFT';
    const firstName = String(firstShift.name || firstShift.code || 'Ca lam').trim();

    if (shifts.length === 1) {
      return {
        code: firstCode,
        name: firstName,
      };
    }

    return {
      code: `XOAY-${firstCode}`,
      name: `Ca xoay ${shifts.length} ca`,
    };
  }

  private async resolveShiftAssignmentIncludeAllFlag(
    branchId: string,
    shiftCount: number,
    explicit?: boolean,
  ) {
    if (explicit !== undefined) {
      return explicit;
    }

    if (!shiftCount) {
      return false;
    }

    const totalShiftCount = await this.prisma.staffShift.count({
      where: {
        branchId,
        deletedAt: null,
      },
    });

    return totalShiftCount > 0 && shiftCount === totalShiftCount;
  }

  private async buildUniqueStaffShiftAssignmentCodes(
    branchId: string,
    baseCode: string,
    total: number,
  ) {
    const normalizedBase =
      this.normalizeAttendanceCode(baseCode) || this.buildStaffShiftAssignmentCode();
    const existingAssignments = await this.prisma.staffShiftAssignment.findMany({
      where: {
        branchId,
        code: {
          startsWith: normalizedBase,
        },
      },
      select: {
        code: true,
      },
    });

    const takenCodes = new Set(existingAssignments.map((item) => item.code));
    const nextCodes: string[] = [];
    let suffix = 0;

    while (nextCodes.length < total) {
      const candidate = suffix === 0 ? normalizedBase : `${normalizedBase}-${suffix}`;
      if (!takenCodes.has(candidate)) {
        nextCodes.push(candidate);
        takenCodes.add(candidate);
      }
      suffix += 1;
    }

    return nextCodes;
  }

  private resolveShiftAssignmentCycleDays(value?: number | null) {
    return Math.max(1, Number(value || 1));
  }

  private resolveShiftAssignmentEffectiveEndDate(assignment: any) {
    if (assignment.endDate) {
      return endOfDay(new Date(assignment.endDate));
    }

    if (assignment.isUnlimitedRotation) {
      return null;
    }

    const shiftCount = this.orderedAssignmentShiftLinks(assignment).length;
    if (!shiftCount) {
      return null;
    }

    const cycleDays = this.resolveShiftAssignmentCycleDays(
      assignment.rotationCycleDays,
    );
    return endOfDay(
      addDays(
        startOfDay(new Date(assignment.startDate)),
        shiftCount * cycleDays - 1,
      ),
    );
  }

  private mapStaffShiftRecord(shift: any) {
    return {
      id: shift.id,
      branchId: shift.branchId,
      branchName: shift.branch?.name || '',
      code: shift.code,
      name: shift.name,
      startTime: shift.startTime || '',
      endTime: shift.endTime || '',
      shiftWindow: [shift.startTime || '--:--', shift.endTime || '--:--']
        .join(' - ')
        .concat(shift.isOvernight ? ' (+1)' : ''),
      breakMinutes: Number(shift.breakMinutes || 0),
      workHours: Number(shift.workHours || 0),
      lateToleranceMinutes: Number(shift.lateToleranceMinutes || 0),
      earlyLeaveToleranceMinutes: Number(
        shift.earlyLeaveToleranceMinutes || 0,
      ),
      overtimeAfterMinutes: Number(shift.overtimeAfterMinutes || 0),
      mealAllowance: Number(shift.mealAllowance || 0),
      nightAllowance: Number(shift.nightAllowance || 0),
      isOvernight: Boolean(shift.isOvernight),
      overnightLabel: Boolean(shift.isOvernight) ? 'Ca qua dem' : 'Trong ngay',
      note: shift.note || '',
      assignmentCount:
        typeof shift._count?.assignments === 'number'
          ? shift._count.assignments
          : 0,
      createdAt: shift.createdAt?.toISOString() || '',
      updatedAt: shift.updatedAt?.toISOString() || '',
      createdDateTime: shift.createdAt?.toISOString() || '',
      updatedDateTime: shift.updatedAt?.toISOString() || '',
    };
  }

  private orderedAssignmentShiftLinks(assignment: any) {
    return Array.isArray(assignment.shifts)
      ? [...assignment.shifts].sort(
          (left: any, right: any) => left.sequence - right.sequence,
        )
      : [];
  }

  private resolveCurrentStaffShift(assignment: any, referenceDate = new Date()) {
    const orderedShiftLinks = this.orderedAssignmentShiftLinks(assignment);
    const pattern = {
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      rotationCycleDays: assignment.rotationCycleDays,
      isUnlimitedRotation: assignment.isUnlimitedRotation,
      shifts: orderedShiftLinks
        .map((item: any) => item.shift)
        .filter(Boolean),
    };

    if (!pattern.shifts.length) {
      return null;
    }

    const previousTargetDate = addDays(startOfDay(referenceDate), -1);
    const previousResolved = resolveShiftForDate(pattern, previousTargetDate);
    if (
      previousResolved &&
      previousResolved.window.startAt <= referenceDate &&
      previousResolved.window.endAt >= referenceDate
    ) {
      return {
        targetDate: previousTargetDate,
        ...previousResolved,
      };
    }

    const todayResolved = resolveShiftForDate(pattern, referenceDate);
    if (!todayResolved) {
      return null;
    }

    return {
      targetDate: startOfDay(referenceDate),
      ...todayResolved,
    };
  }

  private mapStaffShiftAssignmentRecord(
    assignment: any,
    eventsByUser: Record<string, Array<{ eventAt: Date; eventType: string }>> =
      {},
    referenceDate = new Date(),
  ) {
    const orderedShiftLinks = this.orderedAssignmentShiftLinks(assignment);
    const orderedShifts = orderedShiftLinks
      .map((item: any) => item.shift)
      .filter(Boolean);
    const effectiveEndDate = this.resolveShiftAssignmentEffectiveEndDate(
      assignment,
    );
    const rotationCycleDays = this.resolveShiftAssignmentCycleDays(
      assignment.rotationCycleDays,
    );
    const currentShift = this.resolveCurrentStaffShift(assignment, referenceDate);
    const targetDate = currentShift?.targetDate || startOfDay(referenceDate);
    const shiftSummary = summarizeShiftAttendance({
      shift: currentShift?.shift || null,
      targetDate,
      events: eventsByUser[assignment.userId] || [],
      now: referenceDate,
    });
    const currentShiftStatus = currentShift
      ? shiftSummary.status
      : startOfDay(referenceDate) < startOfDay(new Date(assignment.startDate))
        ? 'UPCOMING'
        : effectiveEndDate &&
            startOfDay(referenceDate) > effectiveEndDate
          ? 'EXPIRED'
          : 'UNASSIGNED';

    return {
      id: assignment.id,
      branchId: assignment.branchId,
      branchName: assignment.branch?.name || '',
      userId: assignment.userId,
      user: assignment.user
        ? {
            id: assignment.user.id,
            username: assignment.user.username,
            fullName: assignment.user.fullName,
          }
        : null,
      code: assignment.code,
      name:
        assignment.name ||
        `${assignment.user?.fullName || assignment.user?.username || 'Nhan vien'} - Phan ca`,
      staffName: assignment.user?.fullName || '',
      staffCode: this.resolveEmployeeCode(assignment.user) || '',
      attendanceCode: this.resolveStaffAttendanceCode(assignment.user) || '',
      username: assignment.user?.username || '',
      shiftIds: orderedShiftLinks.map((item: any) => item.shiftId),
      shifts: orderedShiftLinks.map((item: any) => ({
        shiftId: item.shiftId,
        sequence: item.sequence,
        shift: item.shift ? this.mapStaffShiftRecord(item.shift) : null,
      })),
      shiftCount: orderedShifts.length,
      shiftNames: orderedShifts.map((item: any) => item.name).join(' -> '),
      shiftCodes: orderedShifts.map((item: any) => item.code).join(', '),
      shiftPatternLabel: orderedShifts
        .map(
          (item: any) =>
            `${item.code || '-'} (${item.startTime || '--:--'} - ${item.endTime || '--:--'}${
              item.isOvernight ? ' +1' : ''
            })`,
        )
        .join(' -> '),
      rotationLabel:
        orderedShifts.length <= 1
          ? 'Ca co dinh'
          : assignment.isUnlimitedRotation
            ? `Ca xoay moi ${rotationCycleDays} ngay - khong thoi han`
            : `Ca xoay moi ${rotationCycleDays} ngay`,
      rotationCycleDays,
      rotationCycleLabel:
        rotationCycleDays === 1
          ? 'Doi ca moi ngay'
          : `Doi ca moi ${rotationCycleDays} ngay`,
      includeAllShifts: Boolean(assignment.includeAllShifts),
      includeAllShiftsLabel: Boolean(assignment.includeAllShifts)
        ? 'Lay tat ca ca dang active'
        : 'Chi cac ca duoc chon',
      isUnlimitedRotation: Boolean(assignment.isUnlimitedRotation),
      startDate: assignment.startDate?.toISOString() || '',
      endDate: assignment.endDate?.toISOString() || '',
      effectiveFromDate: assignment.startDate?.toISOString() || '',
      effectiveToDate: effectiveEndDate?.toISOString() || '',
      effectiveRange: effectiveEndDate
        ? `${this.attendanceDateKey(assignment.startDate)} -> ${this.attendanceDateKey(effectiveEndDate)}`
        : `${this.attendanceDateKey(assignment.startDate)} -> Khong gioi han`,
      currentShiftCode: currentShift?.shift?.code || '',
      currentShiftName: currentShift?.shift?.name || '',
      currentShiftWindow: currentShift?.window?.label || '',
      currentShiftStatus,
      currentShiftDate: currentShift?.targetDate
        ? this.attendanceDateKey(currentShift.targetDate)
        : '',
      firstCheckInAt: shiftSummary.firstCheckIn?.toISOString() || '',
      lastCheckOutAt: shiftSummary.lastCheckOut?.toISOString() || '',
      workedHours: Math.round((shiftSummary.workedMinutes / 60) * 10) / 10,
      lateMinutes: shiftSummary.lateMinutes,
      earlyLeaveMinutes: shiftSummary.earlyLeaveMinutes,
      overtimeMinutes: shiftSummary.overtimeMinutes,
      note: assignment.note || '',
      createdAt: assignment.createdAt?.toISOString() || '',
      updatedAt: assignment.updatedAt?.toISOString() || '',
      createdDateTime: assignment.createdAt?.toISOString() || '',
      updatedDateTime: assignment.updatedAt?.toISOString() || '',
    };
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
      vendor: machine.vendor || 'GENERIC',
      machineType: machine.machineType || 'FINGERPRINT',
      protocol: machine.protocol || 'GENERIC_EXPORT',
      model: machine.model || '',
      deviceIdentifier: machine.deviceIdentifier || '',
      connectionPort: machine.connectionPort || '',
      host: machine.host || '',
      username: machine.username || '',
      commKeyConfigured: Boolean(machine.commKey),
      commKeyStatus: machine.commKey ? 'Da cau hinh' : 'Chua cau hinh',
      timeZone: machine.timeZone || 'Asia/Bangkok',
      pollingIntervalSeconds:
        Number(machine.pollingIntervalSeconds || 0) || 300,
      hasPassword: Boolean(machine.password),
      passwordStatus: machine.password ? 'Da cau hinh' : 'Chua cau hinh',
      apiKeyConfigured: Boolean(machine.apiKey),
      webhookConfigured: Boolean(machine.webhookSecret),
      supportsFaceImage: Boolean(machine.supportsFaceImage),
      supportsFaceTemplate: Boolean(machine.supportsFaceTemplate),
      supportsCardEnrollment: Boolean(machine.supportsCardEnrollment),
      supportsFingerprintTemplate: Boolean(machine.supportsFingerprintTemplate),
      supportsWebhook: Boolean(machine.supportsWebhook),
      syncEnabled: machine.syncEnabled,
      syncLabel: machine.syncEnabled ? 'Bat dong bo' : 'Tat dong bo',
      connectionStatus: machine.connectionStatus,
      eventCount:
        machine._count?.staffAttendanceEvents ?? (recentEvents?.length || 0),
      lastSyncedAt: machine.lastSyncedAt?.toISOString() || '',
      lastSyncedDateTime: machine.lastSyncedAt?.toISOString() || '',
      lastHeartbeatAt: machine.lastHeartbeatAt?.toISOString() || '',
      lastHeartbeatDateTime: machine.lastHeartbeatAt?.toISOString() || '',
      lastErrorCode: machine.lastErrorCode || '',
      lastErrorMessage: machine.lastErrorMessage || '',
      lastLogCursor: machine.lastLogCursor || '',
      lastUserSyncCursor: machine.lastUserSyncCursor || '',
      recentEvents,
      createdAt: machine.createdAt.toISOString(),
      updatedAt: machine.updatedAt.toISOString(),
      createdDateTime: machine.createdAt.toISOString(),
      updatedDateTime: machine.updatedAt.toISOString(),
    };
  }

  private shouldUseAttendanceConnector(machine: {
    vendor?: string | null;
    protocol?: string | null;
  }) {
    const vendor = String(machine.vendor || '').toUpperCase();
    const protocol = String(machine.protocol || '').toUpperCase();
    return (
      vendor === 'HIKVISION' ||
      protocol === 'HIKVISION_ISAPI' ||
      vendor === 'ZKTECO' ||
      vendor === 'RONALD_JACK' ||
      protocol === 'ZK_PULL_TCP'
    );
  }

  private parseAttendanceMachineRangeBoundary(
    value: string,
    boundary: 'start' | 'end',
  ) {
    const normalized = String(value || '').trim();
    if (!normalized) {
      throw new BadRequestException(
        'Can chon day du tu ngay va den ngay cho khoang du lieu may cham cong.',
      );
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return new Date(
        `${normalized}T${
          boundary === 'start' ? '00:00:00.000' : '23:59:59.999'
        }+07:00`,
      );
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        'Khoang ngay may cham cong khong hop le. Vui long chon lai tu ngay / den ngay.',
      );
    }

    return parsed;
  }

  private resolveAttendanceMachineLogRange(
    dto: AttendanceMachineMaintenanceDto,
  ): AttendanceDeviceLogRangePayload {
    if (!dto.dateFrom || !dto.dateTo) {
      throw new BadRequestException(
        'Can chon tu ngay va den ngay cho thao tac voi du lieu may cham cong.',
      );
    }

    const startAt = this.parseAttendanceMachineRangeBoundary(
      dto.dateFrom,
      'start',
    );
    const endAt = this.parseAttendanceMachineRangeBoundary(dto.dateTo, 'end');

    if (startAt.getTime() > endAt.getTime()) {
      throw new BadRequestException('Tu ngay khong duoc lon hon den ngay.');
    }

    return {
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    };
  }

  private mapAttendanceMachineDeviceLogRecord(log: {
    machineUserId?: string;
    appAttendanceCode?: string;
    rawCode?: string;
    eventAt: string;
    eventType: 'CHECK_IN' | 'CHECK_OUT';
    verificationMethod: 'FINGERPRINT' | 'FACE' | 'CARD' | 'MOBILE' | 'MANUAL';
    externalEventId?: string;
    payload?: Record<string, unknown>;
  }) {
    const machineCode =
      this.normalizeAttendanceCode(
        log.machineUserId || log.appAttendanceCode || log.rawCode,
      ) || '';

    return {
      recordType: 'EVENT',
      entityId: log.externalEventId || `${machineCode}-${log.eventAt}`,
      entityCode: machineCode,
      displayName: machineCode || 'Machine log',
      attendanceCode: machineCode || '',
      identifier: log.rawCode || machineCode,
      status: log.eventType,
      note: log.externalEventId || '',
      eventAt: log.eventAt,
      eventType: log.eventType,
      verificationMethod: log.verificationMethod,
      source: 'DEVICE_EXPORT',
      machineUserId: log.machineUserId || '',
      rawCode: log.rawCode || '',
      payload: log.payload || {},
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

  private async resolveAttendanceEnrollmentPerson(
    branchId: string,
    dto: AttendanceMachineMaintenanceDto,
  ) {
    if (!dto.personType || !dto.personId) {
      throw new BadRequestException(
        'Can chon doi tuong can enroll khuon mat / the.',
      );
    }

    if (dto.personType === 'STAFF') {
      const user = await this.prisma.user.findFirst({
        where: {
          id: dto.personId,
          branchId,
          deletedAt: null,
        },
        select: {
          id: true,
          fullName: true,
          username: true,
          employeeCode: true,
          attendanceCode: true,
        },
      });

      if (!user) {
        throw new NotFoundException('Nhan vien khong ton tai trong chi nhanh nay');
      }

      const attendanceCode = this.resolveStaffAttendanceCode(
        user,
        user.username,
      );

      return {
        personType: 'STAFF' as const,
        personId: user.id,
        displayName: dto.displayName || user.fullName || user.username || '',
        appAttendanceCode:
          dto.appAttendanceCode ||
          attendanceCode ||
          this.resolveEmployeeCode(user, user.username) ||
          undefined,
        machineUserId:
          dto.machineUserId ||
          dto.machineCode ||
          attendanceCode ||
          this.resolveEmployeeCode(user, user.username) ||
          user.id,
        machineCode:
          dto.machineCode ||
          attendanceCode ||
          this.resolveEmployeeCode(user, user.username) ||
          user.id,
        cardCode: dto.cardCode,
        faceImageUrl: dto.faceImageUrl,
        faceImageBase64: dto.faceImageBase64,
      };
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: dto.personId,
        branchId,
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        code: true,
        fingerprintCode: true,
        customerCardNumber: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Hoi vien khong ton tai trong chi nhanh nay');
    }

    const attendanceCode =
      this.normalizeAttendanceCode(customer.fingerprintCode) ||
      this.normalizeAttendanceCode(customer.code);

    return {
      personType: 'CUSTOMER' as const,
      personId: customer.id,
      displayName: dto.displayName || customer.fullName || customer.code || '',
      appAttendanceCode:
        dto.appAttendanceCode || attendanceCode || customer.id,
      machineUserId:
        dto.machineUserId ||
        dto.machineCode ||
        attendanceCode ||
        customer.id,
      machineCode:
        dto.machineCode ||
        attendanceCode ||
        customer.id,
      cardCode: dto.cardCode || customer.customerCardNumber || undefined,
      faceImageUrl: dto.faceImageUrl,
      faceImageBase64: dto.faceImageBase64,
    };
  }

  private async saveAttendanceEnrollmentArtifacts(args: {
    machine: {
      id: string;
      branchId: string;
      code: string;
    };
    enrollmentType: 'FACE' | 'CARD';
    personType: 'STAFF' | 'CUSTOMER';
    personId: string;
    displayName?: string;
    appAttendanceCode?: string;
    machineUserId?: string;
    machineCode?: string;
    cardCode?: string;
    faceImageUrl?: string;
    faceImageBase64?: string;
    connectorResult?: Record<string, unknown>;
  }) {
    const personMap = await this.saveAttendanceMachinePersonMap({
      machine: args.machine,
      personType: args.personType,
      personId: args.personId,
      appAttendanceCode: args.appAttendanceCode,
      machineUserId: args.machineUserId,
      machineCode: args.machineCode,
      cardCode: args.cardCode,
      faceProfileId:
        args.enrollmentType === 'FACE'
          ? args.machineUserId || args.machineCode || args.personId
          : undefined,
    });

    const enrollment = await this.prisma.attendanceEnrollment.create({
      data: {
        branchId: args.machine.branchId,
        attendanceMachineId: args.machine.id,
        personMapId: personMap.id,
        personType: args.personType,
        personId: args.personId,
        enrollmentType: args.enrollmentType,
        status: 'UPLOADED_TO_MACHINE',
        capturedAt: new Date(),
        confirmedAt: new Date(),
        machineUserId: args.machineUserId,
        note: args.displayName || null,
        metadataJson: args.connectorResult as Prisma.InputJsonValue | undefined,
      },
    });

    if (args.enrollmentType === 'CARD' && args.cardCode) {
      await this.prisma.attendanceBiometricAsset.create({
        data: {
          branchId: args.machine.branchId,
          attendanceMachineId: args.machine.id,
          enrollmentId: enrollment.id,
          personType: args.personType,
          personId: args.personId,
          assetType: 'CARD_METADATA',
          storageProvider: 'LOCAL',
          source: 'UPLOAD',
          storageKey: args.cardCode,
          originalFilename: null,
          mimeType: 'text/plain',
          fileSize: args.cardCode.length,
        },
      });
    }

    if (
      args.enrollmentType === 'FACE' &&
      (args.faceImageUrl || args.faceImageBase64)
    ) {
      const storageKey =
        args.faceImageUrl ||
        `inline-face:${args.machine.code}:${args.personId}:${Date.now()}`;
      await this.prisma.attendanceBiometricAsset.create({
        data: {
          branchId: args.machine.branchId,
          attendanceMachineId: args.machine.id,
          enrollmentId: enrollment.id,
          personType: args.personType,
          personId: args.personId,
          assetType: 'FACE_IMAGE',
          storageProvider: 'LOCAL',
          source: 'UPLOAD',
          storageKey,
          originalFilename: args.displayName
            ? `${args.displayName}-face`
            : 'face-image',
          mimeType: 'image/jpeg',
          fileSize: args.faceImageBase64
            ? Math.round(args.faceImageBase64.length * 0.75)
            : undefined,
        },
      });
    }

    return {
      personMap,
      enrollment,
    };
  }

  private async saveAttendanceMachinePersonMap(args: {
    machine: {
      id: string;
      branchId: string;
    };
    personType: 'STAFF' | 'CUSTOMER';
    personId: string;
    appAttendanceCode?: string;
    machineUserId?: string;
    machineCode?: string;
    cardCode?: string;
    faceProfileId?: string;
  }) {
    const normalizedAppAttendanceCode = this.normalizeAttendanceCode(
      args.appAttendanceCode,
    );
    const normalizedMachineUserId = this.normalizeAttendanceCode(
      args.machineUserId,
    );
    const normalizedMachineCode = this.normalizeAttendanceCode(
      args.machineCode,
    );

    const duplicateKeyMatchers: Prisma.AttendanceMachinePersonMapWhereInput[] =
      [];

    if (normalizedAppAttendanceCode) {
      duplicateKeyMatchers.push({
        appAttendanceCode: {
          equals: normalizedAppAttendanceCode,
          mode: 'insensitive',
        },
      });
    }

    if (normalizedMachineUserId) {
      duplicateKeyMatchers.push({
        machineUserId: {
          equals: normalizedMachineUserId,
          mode: 'insensitive',
        },
      });
    }

    if (normalizedMachineCode) {
      duplicateKeyMatchers.push({
        machineCode: {
          equals: normalizedMachineCode,
          mode: 'insensitive',
        },
      });
    }

    if (duplicateKeyMatchers.length > 0) {
      await this.prisma.attendanceMachinePersonMap.deleteMany({
        where: {
          attendanceMachineId: args.machine.id,
          personType: args.personType,
          NOT: {
            personId: args.personId,
          },
          OR: duplicateKeyMatchers,
        },
      });
    }

    return this.prisma.attendanceMachinePersonMap.upsert({
      where: {
        attendanceMachineId_personType_personId: {
          attendanceMachineId: args.machine.id,
          personType: args.personType,
          personId: args.personId,
        },
      },
      create: {
        branchId: args.machine.branchId,
        attendanceMachineId: args.machine.id,
        personType: args.personType,
        personId: args.personId,
        appAttendanceCode: normalizedAppAttendanceCode,
        machineUserId: normalizedMachineUserId,
        machineCode: normalizedMachineCode,
        cardCode: args.cardCode,
        faceProfileId: args.faceProfileId,
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date(),
        lastError: null,
      },
      update: {
        appAttendanceCode: normalizedAppAttendanceCode,
        machineUserId: normalizedMachineUserId,
        machineCode: normalizedMachineCode,
        cardCode: args.cardCode,
        faceProfileId: args.faceProfileId,
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date(),
        lastError: null,
      },
    });
  }

  private async importAttendanceMachineLogs(args: {
    machine: {
      id: string;
      branchId: string;
    };
    logs: Array<{
      rawCode?: string;
      appAttendanceCode?: string;
      machineUserId?: string;
      eventAt: string;
      eventType: 'CHECK_IN' | 'CHECK_OUT';
      verificationMethod: 'FINGERPRINT' | 'FACE' | 'CARD' | 'MOBILE' | 'MANUAL';
      externalEventId?: string;
      payload?: Record<string, unknown>;
    }>;
  }) {
    let importedCount = 0;
    let duplicateCount = 0;
    let unmatchedCount = 0;

    for (const log of args.logs) {
      const attendanceCode = this.normalizeAttendanceCode(
        log.appAttendanceCode || log.rawCode || log.machineUserId,
      );

      if (!attendanceCode) {
        unmatchedCount += 1;
        continue;
      }

      const personMap = await this.prisma.attendanceMachinePersonMap.findFirst({
        where: {
          attendanceMachineId: args.machine.id,
          personType: 'STAFF',
          OR: [
            { machineUserId: { equals: attendanceCode, mode: 'insensitive' } },
            { machineCode: { equals: attendanceCode, mode: 'insensitive' } },
            { appAttendanceCode: { equals: attendanceCode, mode: 'insensitive' } },
          ],
        },
        orderBy: [
          { lastSyncedAt: 'desc' },
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        select: {
          personId: true,
        },
      });

      const user = personMap?.personId
        ? await this.prisma.user.findFirst({
            where: {
              id: personMap.personId,
              branchId: args.machine.branchId,
              deletedAt: null,
            },
            select: {
              id: true,
            },
          })
        : await this.prisma.user.findFirst({
            where: {
              branchId: args.machine.branchId,
              deletedAt: null,
              OR: [
                {
                  attendanceCode: { equals: attendanceCode, mode: 'insensitive' },
                },
                { employeeCode: { equals: attendanceCode, mode: 'insensitive' } },
                { username: { equals: attendanceCode, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
            },
          });

      if (!user) {
        unmatchedCount += 1;
        continue;
      }

      const eventAt = new Date(log.eventAt);
      const existing = await this.prisma.staffAttendanceEvent.findFirst({
        where: {
          branchId: args.machine.branchId,
          userId: user.id,
          attendanceMachineId: args.machine.id,
          eventAt,
          eventType: log.eventType,
          rawCode: attendanceCode,
        },
        select: { id: true },
      });

      if (existing) {
        duplicateCount += 1;
        continue;
      }

      await this.prisma.staffAttendanceEvent.create({
        data: {
          branchId: args.machine.branchId,
          userId: user.id,
          attendanceMachineId: args.machine.id,
          eventAt,
          eventType: log.eventType,
          verificationMethod: log.verificationMethod,
          source: 'MACHINE',
          rawCode: attendanceCode,
          note: log.externalEventId || undefined,
        },
      });

      importedCount += 1;
    }

    return {
      importedCount,
      duplicateCount,
      unmatchedCount,
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
    const createData: Prisma.AttendanceMachineUncheckedCreateInput = {
      branchId: dto.branchId,
      code: dto.code,
      name: dto.name,
      ...(dto.vendor
        ? { vendor: dto.vendor as AttendanceMachineVendor }
        : {}),
      ...(dto.machineType
        ? { machineType: dto.machineType as AttendanceMachineType }
        : {}),
      ...(dto.protocol
        ? { protocol: dto.protocol as AttendanceMachineProtocol }
        : {}),
      model: dto.model,
      deviceIdentifier: dto.deviceIdentifier,
      commKey: dto.commKey,
      connectionPort: dto.connectionPort,
      host: dto.host,
      username: dto.username,
      password: dto.password,
      pollingIntervalSeconds: dto.pollingIntervalSeconds,
      supportsFaceImage: dto.supportsFaceImage,
      supportsFaceTemplate: dto.supportsFaceTemplate,
      supportsCardEnrollment: dto.supportsCardEnrollment,
      supportsFingerprintTemplate: dto.supportsFingerprintTemplate,
      supportsWebhook: dto.supportsWebhook,
      syncEnabled: dto.syncEnabled,
      connectionStatus: dto.connectionStatus,
      timeZone: dto.timeZone,
    };
    const payload = await this.prisma.attendanceMachine.create({
      data: createData,
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
    const updateData: Prisma.AttendanceMachineUncheckedUpdateInput = {
      ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.vendor !== undefined
        ? { vendor: dto.vendor as AttendanceMachineVendor }
        : {}),
      ...(dto.machineType !== undefined
        ? { machineType: dto.machineType as AttendanceMachineType }
        : {}),
      ...(dto.protocol !== undefined
        ? { protocol: dto.protocol as AttendanceMachineProtocol }
        : {}),
      ...(dto.model !== undefined ? { model: dto.model } : {}),
      ...(dto.deviceIdentifier !== undefined
        ? { deviceIdentifier: dto.deviceIdentifier }
        : {}),
      ...(dto.commKey !== undefined ? { commKey: dto.commKey } : {}),
      ...(dto.connectionPort !== undefined
        ? { connectionPort: dto.connectionPort }
        : {}),
      ...(dto.host !== undefined ? { host: dto.host } : {}),
      ...(dto.username !== undefined ? { username: dto.username } : {}),
      ...(dto.password !== undefined ? { password: dto.password } : {}),
      ...(dto.pollingIntervalSeconds !== undefined
        ? { pollingIntervalSeconds: dto.pollingIntervalSeconds }
        : {}),
      ...(dto.supportsFaceImage !== undefined
        ? { supportsFaceImage: dto.supportsFaceImage }
        : {}),
      ...(dto.supportsFaceTemplate !== undefined
        ? { supportsFaceTemplate: dto.supportsFaceTemplate }
        : {}),
      ...(dto.supportsCardEnrollment !== undefined
        ? { supportsCardEnrollment: dto.supportsCardEnrollment }
        : {}),
      ...(dto.supportsFingerprintTemplate !== undefined
        ? { supportsFingerprintTemplate: dto.supportsFingerprintTemplate }
        : {}),
      ...(dto.supportsWebhook !== undefined
        ? { supportsWebhook: dto.supportsWebhook }
        : {}),
      ...(dto.syncEnabled !== undefined ? { syncEnabled: dto.syncEnabled } : {}),
      ...(dto.connectionStatus !== undefined
        ? { connectionStatus: dto.connectionStatus }
        : {}),
      ...(dto.timeZone !== undefined ? { timeZone: dto.timeZone } : {}),
    };
    const payload = await this.prisma.attendanceMachine.update({
      where: { id },
      data: updateData,
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
      case 'PING_MACHINE': {
        const connectorPingResult =
          await this.attendanceDevicesService.pingMachine(id);
        if (connectorPingResult.result.supported) {
          data.connectionStatus = 'CONNECTED';
          data.lastHeartbeatAt = operationAt;
          data.lastErrorCode = null;
          data.lastErrorMessage = null;
        }
        operationResult = {
          action: dto.action,
          title: 'Kiem tra ket noi may cham cong',
          description:
            'Doc nhanh thong tin may va xac nhan kha nang giao tiep cua connector hien tai.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          syncedAt: operationAt.toISOString(),
          totalRecords: connectorPingResult.result.supported ? 1 : 0,
          connector: connectorPingResult.connector,
          connectorResult: connectorPingResult.result,
          preview: connectorPingResult.result.supported
            ? [
                {
                  recordType: 'MACHINE',
                  entityId: before.id,
                  entityCode: before.code,
                  displayName: before.name,
                  attendanceCode: before.host || '-',
                  status: 'CONNECTED',
                  note: connectorPingResult.result.message,
                },
              ]
            : [],
        };
        operationAuditResult = {
          title: 'Kiem tra ket noi may cham cong',
          connectorKey: connectorPingResult.connector.key,
          connectorSupported: connectorPingResult.result.supported,
          syncedAt: operationAt.toISOString(),
        };
        break;
      }
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
        const connectorLogPull = this.shouldUseAttendanceConnector(before)
          ? await this.attendanceDevicesService.pullAttendanceLogs(id)
          : undefined;
        const importedSummary = connectorLogPull
          ? await this.importAttendanceMachineLogs({
              machine: {
                id: before.id,
                branchId: before.branchId,
              },
              logs: connectorLogPull.logs,
            })
          : undefined;
        const latestDeviceEventAt = connectorLogPull?.logs.reduce<string | null>(
          (latest, item) => {
            if (!latest) {
              return item.eventAt;
            }
            return new Date(item.eventAt).getTime() >
              new Date(latest).getTime()
              ? item.eventAt
              : latest;
          },
          null,
        );
        const refreshedRecords = await this.listAttendanceMachineRecentEventRecords(
          id,
          before.branchId,
        );
        data.connectionStatus = 'CONNECTED';
        data.syncEnabled = true;
        data.lastSyncedAt = operationAt;
        data.lastHeartbeatAt = connectorLogPull ? operationAt : undefined;
        data.lastLogCursor = latestDeviceEventAt || before.lastLogCursor;
        operationResult = {
          action: dto.action,
          title: 'Tai du lieu cham cong ve he thong',
          description:
            'Lay log cham cong moi nhat tu may va lam moi danh sach su kien.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          exportedAt: operationAt.toISOString(),
          totalRecords: refreshedRecords.length,
          connector: connectorLogPull?.connector,
          pulledFromDeviceCount: connectorLogPull?.logs.length || 0,
          importedCount: importedSummary?.importedCount || 0,
          duplicateCount: importedSummary?.duplicateCount || 0,
          unmatchedCount: importedSummary?.unmatchedCount || 0,
          devicePreview: connectorLogPull?.logs.slice(0, 8) || [],
          preview: refreshedRecords.slice(0, 8),
          records: refreshedRecords,
        };
        operationAuditResult = {
          title: 'Tai du lieu cham cong ve he thong',
          totalRecords: refreshedRecords.length,
          pulledFromDeviceCount: connectorLogPull?.logs.length || 0,
          importedCount: importedSummary?.importedCount || 0,
          duplicateCount: importedSummary?.duplicateCount || 0,
          unmatchedCount: importedSummary?.unmatchedCount || 0,
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
        const connectorUserPull = this.shouldUseAttendanceConnector(before)
          ? await this.attendanceDevicesService.pullMachineUsers(id)
          : undefined;
        const records = [...staffSync.allRecords, ...customerSync.allRecords];
        data.lastHeartbeatAt = connectorUserPull ? operationAt : undefined;
        data.lastUserSyncCursor = operationAt.toISOString();
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
          deviceUserCount: connectorUserPull?.users.length || 0,
          staffCount: staffSync.records.length,
          customerCount: customerSync.records.length,
          missingCodeCount:
            staffSync.missingCodeCount + customerSync.missingCodeCount,
          connector: connectorUserPull?.connector,
          machineUsersPreview: connectorUserPull?.users.slice(0, 8) || [],
          preview: records.slice(0, 8),
          records,
        };
        operationAuditResult = {
          title: 'Tai ma cham cong ve may tinh',
          totalRecords: records.length,
          deviceUserCount: connectorUserPull?.users.length || 0,
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
        const connectorPushResult = this.shouldUseAttendanceConnector(before)
          ? await this.attendanceDevicesService.pushUsers(
              id,
              staffSync.records.map((record) => ({
                personType: 'STAFF' as const,
                personId: record.entityId,
                displayName: record.displayName,
                appAttendanceCode: record.attendanceCode,
                machineUserId: record.attendanceCode || record.entityCode,
                machineCode: record.attendanceCode || record.entityCode,
                metadata: {
                  branchName: record.branchName,
                  status: record.status,
                  identifier: record.identifier,
                },
              })),
            )
          : undefined;
        data.connectionStatus = 'CONNECTED';
        data.syncEnabled = true;
        data.lastSyncedAt = operationAt;
        data.lastHeartbeatAt = connectorPushResult ? operationAt : undefined;
        data.lastUserSyncCursor = operationAt.toISOString();
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
          connector: connectorPushResult?.connector,
          connectorResult: connectorPushResult?.result,
          preview: staffSync.records.slice(0, 8),
          records: staffSync.records,
        };
        operationAuditResult = {
          title: 'Tai nhan vien len may',
          totalRecords: staffSync.records.length,
          totalBranchRecords: staffSync.totalBranchRecords,
          missingCodeCount: staffSync.missingCodeCount,
          connectorKey: connectorPushResult?.connector.key,
          connectorSupported: connectorPushResult?.result.supported,
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
        const connectorPushResult = this.shouldUseAttendanceConnector(before)
          ? await this.attendanceDevicesService.pushUsers(
              id,
              customerSync.records.map((record) => ({
                personType: 'CUSTOMER' as const,
                personId: record.entityId,
                displayName: record.displayName,
                appAttendanceCode: record.attendanceCode,
                machineUserId: record.attendanceCode || record.entityCode,
                machineCode: record.attendanceCode || record.entityCode,
                cardCode: record.note || undefined,
                metadata: {
                  branchName: record.branchName,
                  status: record.status,
                  identifier: record.identifier,
                },
              })),
            )
          : undefined;
        data.connectionStatus = 'CONNECTED';
        data.syncEnabled = true;
        data.lastSyncedAt = operationAt;
        data.lastHeartbeatAt = connectorPushResult ? operationAt : undefined;
        data.lastUserSyncCursor = operationAt.toISOString();
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
          connector: connectorPushResult?.connector,
          connectorResult: connectorPushResult?.result,
          preview: customerSync.records.slice(0, 8),
          records: customerSync.records,
        };
        operationAuditResult = {
          title: 'Tai hoi vien len may',
          totalRecords: customerSync.records.length,
          totalBranchRecords: customerSync.totalBranchRecords,
          missingCodeCount: customerSync.missingCodeCount,
          connectorKey: connectorPushResult?.connector.key,
          connectorSupported: connectorPushResult?.result.supported,
          syncedAt: operationAt.toISOString(),
        };
        break;
      }
      case 'SYNC_MACHINE_TIME': {
        const connectorSyncResult = this.shouldUseAttendanceConnector(before)
          ? await this.attendanceDevicesService.syncMachineTime(id)
          : undefined;
        data.connectionStatus = 'CONNECTED';
        data.syncEnabled = true;
        data.lastSyncedAt = operationAt;
        data.lastHeartbeatAt = connectorSyncResult ? operationAt : undefined;
        operationResult = {
          action: dto.action,
          title: 'Dong bo gio may cham cong',
          description:
            'Cap nhat thoi gian may theo mui gio he thong de tranh lech check-in.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          connector: connectorSyncResult?.connector,
          connectorResult: connectorSyncResult?.result,
          syncedAt: operationAt.toISOString(),
          machineTime: operationAt.toISOString(),
          timeZone: before.timeZone || 'Asia/Bangkok',
        };
        operationAuditResult = {
          title: 'Dong bo gio may cham cong',
          connectorKey: connectorSyncResult?.connector.key,
          connectorSupported: connectorSyncResult?.result.supported,
          syncedAt: operationAt.toISOString(),
          timeZone: before.timeZone || 'Asia/Bangkok',
        };
        break;
      }
      case 'EXPORT_MACHINE_LOG_RANGE': {
        const logRange = this.resolveAttendanceMachineLogRange(dto);
        const connectorLogExport =
          await this.attendanceDevicesService.pullAttendanceLogsByRange(
            id,
            logRange,
          );
        const exportedRecords = connectorLogExport.logs.map((item) =>
          this.mapAttendanceMachineDeviceLogRecord(item),
        );
        const liveConnector = connectorLogExport.connector.key !== 'generic-export';

        if (liveConnector) {
          data.connectionStatus = 'CONNECTED';
          data.lastHeartbeatAt = operationAt;
          data.lastErrorCode = null;
          data.lastErrorMessage = null;
        }

        operationResult = {
          action: dto.action,
          title: 'Tai du lieu tren may theo moc thoi gian',
          description:
            'Doc log raw tren may trong khoang ngay da chon va tai ve may tinh. Thao tac nay khong import du lieu vao he thong.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          exportedAt: operationAt.toISOString(),
          fileName: `attendance-machine-${before.code}-${logRange.dateFrom}-to-${logRange.dateTo}-device-logs.json`,
          totalRecords: exportedRecords.length,
          pulledFromDeviceCount: connectorLogExport.logs.length,
          connector: connectorLogExport.connector,
          rangeFrom: logRange.dateFrom,
          rangeTo: logRange.dateTo,
          devicePreview: connectorLogExport.logs.slice(0, 8),
          preview: exportedRecords.slice(0, 8),
          records: exportedRecords,
        };
        operationAuditResult = {
          title: 'Tai du lieu tren may theo moc thoi gian',
          totalRecords: exportedRecords.length,
          pulledFromDeviceCount: connectorLogExport.logs.length,
          dateFrom: logRange.dateFrom,
          dateTo: logRange.dateTo,
          exportedAt: operationAt.toISOString(),
        };
        break;
      }
      case 'EXPORT_ALL_MACHINE_LOGS': {
        const connectorLogExport =
          await this.attendanceDevicesService.pullAllAttendanceLogs(id);
        const exportedRecords = connectorLogExport.logs.map((item) =>
          this.mapAttendanceMachineDeviceLogRecord(item),
        );
        const liveConnector = connectorLogExport.connector.key !== 'generic-export';

        if (liveConnector) {
          data.connectionStatus = 'CONNECTED';
          data.lastHeartbeatAt = operationAt;
          data.lastErrorCode = null;
          data.lastErrorMessage = null;
        }

        operationResult = {
          action: dto.action,
          title: 'Tai toan bo log tren may',
          description:
            'Doc toan bo log raw dang con tren may va tai ve may tinh. Thao tac nay khong import du lieu vao he thong.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          exportedAt: operationAt.toISOString(),
          fileName: `attendance-machine-${before.code}-${this.attendanceDateKey(operationAt)}-all-device-logs.json`,
          totalRecords: exportedRecords.length,
          pulledFromDeviceCount: connectorLogExport.logs.length,
          totalMachineLogCount: connectorLogExport.logs.length,
          connector: connectorLogExport.connector,
          devicePreview: connectorLogExport.logs.slice(0, 8),
          preview: exportedRecords.slice(0, 8),
          records: exportedRecords,
        };
        operationAuditResult = {
          title: 'Tai toan bo log tren may',
          totalRecords: exportedRecords.length,
          pulledFromDeviceCount: connectorLogExport.logs.length,
          exportedAt: operationAt.toISOString(),
        };
        break;
      }
      case 'DELETE_MACHINE_LOG_RANGE': {
        const logRange = this.resolveAttendanceMachineLogRange(dto);
        const connectorDeleteResult =
          await this.attendanceDevicesService.deleteAttendanceLogsByRange(
            id,
            logRange,
          );
        const connectorMetadata =
          (connectorDeleteResult.result.metadata as
            | Record<string, unknown>
            | undefined) || {};
        const liveConnector =
          connectorDeleteResult.connector.key !== 'generic-export';
        const selectedLogCount = Number(connectorMetadata.matchedLogs || 0);
        const deletedCount = Number(connectorMetadata.deletedLogs || 0);
        const totalLogsOnDevice = Number(
          connectorMetadata.totalLogsOnDevice || 0,
        );
        const outsideRangeCount = Number(
          connectorMetadata.outsideRangeCount || 0,
        );
        const rangeCoveredAllLogs = Boolean(
          connectorMetadata.rangeCoveredAllLogs,
        );
        const deleteStrategy = String(connectorMetadata.deleteStrategy || '');
        const deleteStrategyLabel =
          deleteStrategy === 'CLEAR_ALL_ONLY'
            ? 'Xoa toan bo log tren may'
            : deleteStrategy || '';
        const previewLogs = Array.isArray(connectorMetadata.previewLogs)
          ? connectorMetadata.previewLogs
              .filter(
                (
                  item,
                ): item is {
                  machineUserId?: string;
                  appAttendanceCode?: string;
                  rawCode?: string;
                  eventAt: string;
                  eventType: 'CHECK_IN' | 'CHECK_OUT';
                  verificationMethod:
                    | 'FINGERPRINT'
                    | 'FACE'
                    | 'CARD'
                    | 'MOBILE'
                    | 'MANUAL';
                  externalEventId?: string;
                  payload?: Record<string, unknown>;
                } =>
                  Boolean(
                    item &&
                      typeof item === 'object' &&
                      'eventAt' in item &&
                      'eventType' in item &&
                      'verificationMethod' in item,
                  ),
              )
              .map((item) => this.mapAttendanceMachineDeviceLogRecord(item))
          : [];

        if (liveConnector) {
          data.connectionStatus = 'CONNECTED';
          data.lastHeartbeatAt = operationAt;
          if (connectorDeleteResult.result.supported) {
            data.lastErrorCode = null;
            data.lastErrorMessage = null;
          }
        }

        operationResult = {
          action: dto.action,
          title: 'Xoa du lieu tren may theo moc thoi gian',
          description: connectorDeleteResult.result.message,
          machineCode: before.code,
          machineName: before.name,
          branchName,
          exportedAt: operationAt.toISOString(),
          totalRecords: selectedLogCount,
          deletedCount,
          connector: connectorDeleteResult.connector,
          connectorResult: connectorDeleteResult.result,
          rangeFrom: logRange.dateFrom,
          rangeTo: logRange.dateTo,
          totalMachineLogCount: totalLogsOnDevice,
          remainingLogCount:
            connectorMetadata.remainingLogCount === null ||
            connectorMetadata.remainingLogCount === undefined
              ? undefined
              : Number(connectorMetadata.remainingLogCount),
          rangeCoveredAllLogs,
          deleteStrategy: deleteStrategyLabel,
          devicePreview: Array.isArray(connectorMetadata.previewLogs)
            ? connectorMetadata.previewLogs.slice(0, 8)
            : [],
          preview: previewLogs,
          records: previewLogs,
        };
        operationAuditResult = {
          title: 'Xoa du lieu tren may theo moc thoi gian',
          totalRecords: selectedLogCount,
          deletedCount,
          totalMachineLogCount: totalLogsOnDevice,
          outsideRangeCount,
          rangeCoveredAllLogs,
          connectorKey: connectorDeleteResult.connector.key,
          connectorSupported: connectorDeleteResult.result.supported,
          deleteStrategy,
          dateFrom: logRange.dateFrom,
          dateTo: logRange.dateTo,
          exportedAt: operationAt.toISOString(),
        };
        break;
      }
      case 'DELETE_ALL_MACHINE_LOGS': {
        const connectorDeleteResult =
          await this.attendanceDevicesService.deleteAllAttendanceLogs(id);
        const connectorMetadata =
          (connectorDeleteResult.result.metadata as
            | Record<string, unknown>
            | undefined) || {};
        const liveConnector =
          connectorDeleteResult.connector.key !== 'generic-export';
        const selectedLogCount = Number(
          connectorMetadata.matchedLogs ||
            connectorMetadata.totalLogsOnDevice ||
            0,
        );
        const deletedCount = Number(connectorMetadata.deletedLogs || 0);
        const totalLogsOnDevice = Number(
          connectorMetadata.totalLogsOnDevice || 0,
        );
        const deleteStrategy = String(connectorMetadata.deleteStrategy || '');
        const deleteStrategyLabel =
          deleteStrategy === 'CLEAR_ALL_ONLY' ||
          deleteStrategy === 'CLEAR_ALL_EXPLICIT'
            ? 'Xoa toan bo log tren may'
            : deleteStrategy || '';
        const previewLogs = Array.isArray(connectorMetadata.previewLogs)
          ? connectorMetadata.previewLogs
              .filter(
                (
                  item,
                ): item is {
                  machineUserId?: string;
                  appAttendanceCode?: string;
                  rawCode?: string;
                  eventAt: string;
                  eventType: 'CHECK_IN' | 'CHECK_OUT';
                  verificationMethod:
                    | 'FINGERPRINT'
                    | 'FACE'
                    | 'CARD'
                    | 'MOBILE'
                    | 'MANUAL';
                  externalEventId?: string;
                  payload?: Record<string, unknown>;
                } =>
                  Boolean(
                    item &&
                      typeof item === 'object' &&
                      'eventAt' in item &&
                      'eventType' in item &&
                      'verificationMethod' in item,
                  ),
              )
              .map((item) => this.mapAttendanceMachineDeviceLogRecord(item))
          : [];

        if (liveConnector) {
          data.connectionStatus = 'CONNECTED';
          data.lastHeartbeatAt = operationAt;
          if (connectorDeleteResult.result.supported) {
            data.lastErrorCode = null;
            data.lastErrorMessage = null;
          }
        }

        operationResult = {
          action: dto.action,
          title: 'Xoa toan bo log tren may',
          description: connectorDeleteResult.result.message,
          machineCode: before.code,
          machineName: before.name,
          branchName,
          exportedAt: operationAt.toISOString(),
          totalRecords: selectedLogCount,
          deletedCount,
          connector: connectorDeleteResult.connector,
          connectorResult: connectorDeleteResult.result,
          totalMachineLogCount: totalLogsOnDevice,
          remainingLogCount:
            connectorMetadata.remainingLogCount === null ||
            connectorMetadata.remainingLogCount === undefined
              ? undefined
              : Number(connectorMetadata.remainingLogCount),
          rangeCoveredAllLogs: true,
          deleteStrategy: deleteStrategyLabel,
          devicePreview: Array.isArray(connectorMetadata.previewLogs)
            ? connectorMetadata.previewLogs.slice(0, 8)
            : [],
          preview: previewLogs,
          records: previewLogs,
        };
        operationAuditResult = {
          title: 'Xoa toan bo log tren may',
          totalRecords: selectedLogCount,
          deletedCount,
          totalMachineLogCount: totalLogsOnDevice,
          connectorKey: connectorDeleteResult.connector.key,
          connectorSupported: connectorDeleteResult.result.supported,
          deleteStrategy,
          exportedAt: operationAt.toISOString(),
        };
        break;
      }
      case 'LINK_MACHINE_PERSON': {
        const person = await this.resolveAttendanceEnrollmentPerson(
          before.branchId,
          dto,
        );
        const personMap = await this.saveAttendanceMachinePersonMap({
          machine: {
            id: before.id,
            branchId: before.branchId,
          },
          personType: person.personType,
          personId: person.personId,
          appAttendanceCode: person.appAttendanceCode,
          machineUserId: person.machineUserId,
          machineCode: person.machineCode,
          cardCode: person.cardCode,
        });
        data.lastSyncedAt = operationAt;
        operationResult = {
          action: dto.action,
          title: 'Lien ket ma may voi doi tuong trong he thong',
          description:
            'Luu mapping giua machine user id va nhan vien / hoi vien hien co de cac lan pull log sau co the doi khop chinh xac.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          syncedAt: operationAt.toISOString(),
          totalRecords: 1,
          preview: [
            {
              recordType: person.personType,
              entityId: person.personId,
              entityCode: person.machineCode || person.appAttendanceCode || '-',
              displayName: person.displayName,
              attendanceCode:
                person.appAttendanceCode || person.machineUserId || '-',
              status: 'SYNCED',
              note:
                person.cardCode ||
                person.machineUserId ||
                person.machineCode ||
                '-',
            },
          ],
          records: [
            {
              personMapId: personMap.id,
            },
          ],
        };
        operationAuditResult = {
          title: 'Lien ket ma may voi doi tuong trong he thong',
          personType: person.personType,
          personId: person.personId,
          syncedAt: operationAt.toISOString(),
        };
        break;
      }
      case 'ENROLL_CARD':
      case 'ENROLL_FACE': {
        const enrollmentType =
          dto.action === 'ENROLL_FACE' ? 'FACE' : 'CARD';
        const person = await this.resolveAttendanceEnrollmentPerson(
          before.branchId,
          dto,
        );
        const connectorEnrollment =
          await this.attendanceDevicesService.createEnrollment(id, {
            personType: person.personType,
            personId: person.personId,
            enrollmentType,
            displayName: person.displayName,
            appAttendanceCode: person.appAttendanceCode,
            machineCode: person.machineCode,
            machineUserId: person.machineUserId,
            cardCode: person.cardCode,
            faceImageUrl: person.faceImageUrl,
            faceImageBase64: person.faceImageBase64,
          });
        const savedArtifacts = await this.saveAttendanceEnrollmentArtifacts({
          machine: {
            id: before.id,
            branchId: before.branchId,
            code: before.code,
          },
          enrollmentType,
          personType: person.personType,
          personId: person.personId,
          displayName: person.displayName,
          appAttendanceCode: person.appAttendanceCode,
          machineUserId: person.machineUserId,
          machineCode: person.machineCode,
          cardCode: person.cardCode,
          faceImageUrl: person.faceImageUrl,
          faceImageBase64: person.faceImageBase64,
          connectorResult: connectorEnrollment.result.metadata,
        });
        data.connectionStatus = 'CONNECTED';
        data.syncEnabled = true;
        data.lastSyncedAt = operationAt;
        operationResult = {
          action: dto.action,
          title:
            enrollmentType === 'FACE'
              ? 'Day enrollment khuon mat len may'
              : 'Day enrollment the len may',
          description:
            enrollmentType === 'FACE'
              ? 'Da tao enrollment khuon mat, cap nhat mapping va luu biometric asset tham chieu.'
              : 'Da tao enrollment the, cap nhat mapping va luu metadata the.',
          machineCode: before.code,
          machineName: before.name,
          branchName,
          syncedAt: operationAt.toISOString(),
          totalRecords: 1,
          connector: connectorEnrollment.connector,
          connectorResult: connectorEnrollment.result,
          preview: [
            {
              recordType: person.personType,
              entityId: person.personId,
              entityCode: person.machineCode || person.appAttendanceCode || '-',
              displayName: person.displayName,
              attendanceCode:
                person.appAttendanceCode || person.machineUserId || '-',
              status: connectorEnrollment.result.supported
                ? 'SYNCED'
                : 'PENDING',
              note:
                enrollmentType === 'CARD'
                  ? person.cardCode || '-'
                  : person.faceImageUrl
                    ? 'Face URL ready'
                    : person.faceImageBase64
                      ? 'Face base64 ready'
                      : '-',
            },
          ],
          records: [
            {
              personMapId: savedArtifacts.personMap.id,
              enrollmentId: savedArtifacts.enrollment.id,
            },
          ],
        };
        operationAuditResult = {
          title:
            enrollmentType === 'FACE'
              ? 'Day enrollment khuon mat len may'
              : 'Day enrollment the len may',
          personType: person.personType,
          personId: person.personId,
          connectorKey: connectorEnrollment.connector.key,
          connectorSupported: connectorEnrollment.result.supported,
          syncedAt: operationAt.toISOString(),
        };
        break;
      }
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

  private async loadShiftAssignmentEventsByUser(
    userIds: string[],
    referenceDate = new Date(),
  ) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    if (!uniqueUserIds.length) {
      return {} as Record<string, Array<{ eventAt: Date; eventType: string }>>;
    }

    const events = await this.prisma.staffAttendanceEvent.findMany({
      where: {
        userId: { in: uniqueUserIds },
        eventAt: {
          gte: startOfDay(addDays(referenceDate, -1)),
          lte: endOfDay(addDays(referenceDate, 1)),
        },
      },
      select: {
        userId: true,
        eventAt: true,
        eventType: true,
      },
      orderBy: { eventAt: 'asc' },
    });

    return events.reduce<
      Record<string, Array<{ eventAt: Date; eventType: string }>>
    >((acc, event) => {
      acc[event.userId] ||= [];
      acc[event.userId].push({
        eventAt: event.eventAt,
        eventType: event.eventType,
      });
      return acc;
    }, {});
  }

  private async resolveShiftAssignmentUsers(branchId: string, userIds: string[]) {
    const uniqueUserIds = Array.from(
      new Set(userIds.map((item) => item.trim()).filter(Boolean)),
    );
    if (!uniqueUserIds.length) {
      throw new BadRequestException('Can chon it nhat mot nhan vien de phan ca.');
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: uniqueUserIds },
        branchId,
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        employeeCode: true,
        attendanceCode: true,
        fullName: true,
      },
      orderBy: [{ fullName: 'asc' }, { username: 'asc' }],
    });

    if (users.length !== uniqueUserIds.length) {
      throw new BadRequestException(
        'Co nhan vien khong ton tai hoac khong thuoc chi nhanh da chon.',
      );
    }

    return users;
  }

  private async resolveShiftAssignmentShifts(
    branchId: string,
    input: {
      includeAllShifts?: boolean;
      shiftIds?: string[];
    },
  ) {
    if (input.includeAllShifts) {
      const shifts = await this.prisma.staffShift.findMany({
        where: {
          branchId,
          deletedAt: null,
        },
        orderBy: [{ startTime: 'asc' }, { code: 'asc' }],
      });

      if (!shifts.length) {
        throw new BadRequestException(
          'Chi nhanh nay chua co ca nao de tao lich phan ca.',
        );
      }

      return shifts;
    }

    const shiftIds = Array.from(
      new Set((input.shiftIds || []).map((item) => item.trim()).filter(Boolean)),
    );
    if (!shiftIds.length) {
      throw new BadRequestException('Can chon it nhat mot ca lam.');
    }

    const shifts = await this.prisma.staffShift.findMany({
      where: {
        id: { in: shiftIds },
        branchId,
        deletedAt: null,
      },
      orderBy: [{ startTime: 'asc' }, { code: 'asc' }],
    });

    if (shifts.length !== shiftIds.length) {
      throw new BadRequestException(
        'Co ca lam khong ton tai hoac khong thuoc chi nhanh da chon.',
      );
    }

    const shiftMap = new Map(shifts.map((item) => [item.id, item]));
    return shiftIds
      .map((id) => shiftMap.get(id))
      .filter((item): item is (typeof shifts)[number] => Boolean(item));
  }

  async listStaffShifts(query: QueryDto, user: AuthUser) {
    const branchId = this.scopedBranchId(query, user);
    const where: Prisma.StaffShiftWhereInput = {
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { startTime: { contains: query.search, mode: 'insensitive' } },
              { endTime: { contains: query.search, mode: 'insensitive' } },
              { note: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status === 'OVERNIGHT'
        ? { isOvernight: true }
        : query.status === 'DAY'
          ? { isOvernight: false }
          : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.staffShift.findMany({
        where,
        include: {
          branch: true,
          _count: {
            select: {
              assignments: true,
            },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.staffShift.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapStaffShiftRecord(item)),
      total,
      query,
    );
  }

  async getStaffShift(id: string, user: AuthUser) {
    const payload = await this.prisma.staffShift.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        branch: true,
        assignments: {
          include: {
            assignment: {
              include: {
                user: true,
              },
            },
          },
          orderBy: { sequence: 'asc' },
        },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });

    if (!payload) {
      throw new NotFoundException('Ca lam khong ton tai');
    }

    this.assertBranchAccess(payload.branchId, user);

    const mapped = this.mapStaffShiftRecord(payload);
    return {
      ...mapped,
      assignments: payload.assignments
        .map((item) => item.assignment)
        .filter((assignment) => Boolean(assignment) && !assignment.deletedAt)
        .map((assignment) => ({
          id: assignment.id,
          code: assignment.code,
          name: assignment.name || '',
          userId: assignment.userId,
          staffName: assignment.user?.fullName || '',
          username: assignment.user?.username || '',
          startDate: assignment.startDate.toISOString(),
          endDate: assignment.endDate?.toISOString() || '',
        })),
    };
  }

  async createStaffShift(dto: CreateStaffShiftDto, user: AuthUser) {
    this.assertBranchAccess(dto.branchId, user);

    const payload = await this.prisma.staffShift.create({
      data: {
        branchId: dto.branchId,
        code: dto.code || this.buildStaffShiftCode(),
        name: dto.name,
        startTime: dto.startTime,
        endTime: dto.endTime,
        breakMinutes: dto.breakMinutes ?? 0,
        workHours: dto.workHours,
        lateToleranceMinutes: dto.lateToleranceMinutes ?? 0,
        earlyLeaveToleranceMinutes: dto.earlyLeaveToleranceMinutes ?? 0,
        overtimeAfterMinutes: dto.overtimeAfterMinutes ?? 0,
        mealAllowance: dto.mealAllowance ?? 0,
        nightAllowance: dto.nightAllowance ?? 0,
        isOvernight: dto.isOvernight ?? false,
        note: dto.note,
      },
      include: {
        branch: true,
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });

    const mapped = this.mapStaffShiftRecord(payload);
    await this.audit(
      user,
      'staff-shifts',
      AuditAction.CREATE,
      'staff_shift',
      payload.id,
      undefined,
      mapped,
      payload.branchId,
    );
    return mapped;
  }

  async updateStaffShift(id: string, dto: UpdateStaffShiftDto, user: AuthUser) {
    const before = await this.prisma.staffShift.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        branch: true,
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });

    if (!before) {
      throw new NotFoundException('Ca lam khong ton tai');
    }

    this.assertBranchAccess(before.branchId, user);
    if (dto.branchId) {
      this.assertBranchAccess(dto.branchId, user);
    }

    const payload = await this.prisma.staffShift.update({
      where: { id },
      data: {
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
        ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
        ...(dto.breakMinutes !== undefined
          ? { breakMinutes: dto.breakMinutes }
          : {}),
        ...(dto.workHours !== undefined ? { workHours: dto.workHours } : {}),
        ...(dto.lateToleranceMinutes !== undefined
          ? { lateToleranceMinutes: dto.lateToleranceMinutes }
          : {}),
        ...(dto.earlyLeaveToleranceMinutes !== undefined
          ? {
              earlyLeaveToleranceMinutes: dto.earlyLeaveToleranceMinutes,
            }
          : {}),
        ...(dto.overtimeAfterMinutes !== undefined
          ? { overtimeAfterMinutes: dto.overtimeAfterMinutes }
          : {}),
        ...(dto.mealAllowance !== undefined
          ? { mealAllowance: dto.mealAllowance }
          : {}),
        ...(dto.nightAllowance !== undefined
          ? { nightAllowance: dto.nightAllowance }
          : {}),
        ...(dto.isOvernight !== undefined
          ? { isOvernight: dto.isOvernight }
          : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
      include: {
        branch: true,
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });

    const beforeMapped = this.mapStaffShiftRecord(before);
    const mapped = this.mapStaffShiftRecord(payload);
    await this.audit(
      user,
      'staff-shifts',
      AuditAction.UPDATE,
      'staff_shift',
      id,
      beforeMapped,
      mapped,
      payload.branchId,
    );
    return mapped;
  }

  async removeStaffShift(id: string, user: AuthUser) {
    const before = await this.prisma.staffShift.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        branch: true,
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });

    if (!before) {
      throw new NotFoundException('Ca lam khong ton tai');
    }

    this.assertBranchAccess(before.branchId, user);

    const payload = await this.prisma.staffShift.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
      include: {
        branch: true,
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });

    await this.audit(
      user,
      'staff-shifts',
      AuditAction.DELETE,
      'staff_shift',
      id,
      this.mapStaffShiftRecord(before),
      this.mapStaffShiftRecord(payload),
      payload.branchId,
    );
    return { success: true };
  }

  async listStaffShiftAssignments(query: QueryDto, user: AuthUser) {
    const branchId = this.scopedBranchId(query, user);
    const where: Prisma.StaffShiftAssignmentWhereInput = {
      deletedAt: null,
      ...(branchId ? { branchId } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
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
                  employeeCode: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
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
              {
                shifts: {
                  some: {
                    shift: {
                      OR: [
                        {
                          code: {
                            contains: query.search,
                            mode: 'insensitive',
                          },
                        },
                        {
                          name: {
                            contains: query.search,
                            mode: 'insensitive',
                          },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const data = await this.prisma.staffShiftAssignment.findMany({
      where,
      include: {
        branch: true,
        user: true,
        shifts: {
          where: {
            shift: {
              deletedAt: null,
            },
          },
          include: {
            shift: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { startDate: 'desc' }],
    });

    const eventsByUser = await this.loadShiftAssignmentEventsByUser(
      data.map((item) => item.userId),
    );
    const mapped = data.map((item) =>
      this.mapStaffShiftAssignmentRecord(item, eventsByUser),
    );
    const filtered = query.status
      ? mapped.filter((item) => item.currentShiftStatus === query.status)
      : mapped;
    const offset = (query.page - 1) * query.pageSize;
    const paged = filtered.slice(offset, offset + query.pageSize);

    return buildListResponse(paged, filtered.length, query);
  }

  async getStaffShiftAssignment(id: string, user: AuthUser) {
    const payload = await this.prisma.staffShiftAssignment.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        branch: true,
        user: true,
        shifts: {
          where: {
            shift: {
              deletedAt: null,
            },
          },
          include: {
            shift: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!payload) {
      throw new NotFoundException('Phan ca nhan vien khong ton tai');
    }

    this.assertBranchAccess(payload.branchId, user);
    const eventsByUser = await this.loadShiftAssignmentEventsByUser([
      payload.userId,
    ]);
    return this.mapStaffShiftAssignmentRecord(payload, eventsByUser);
  }

  async createStaffShiftAssignment(
    dto: CreateStaffShiftAssignmentDto,
    user: AuthUser,
  ) {
    this.assertBranchAccess(dto.branchId, user);

    const [users, shifts] = await Promise.all([
      this.resolveShiftAssignmentUsers(dto.branchId, dto.userIds),
      this.resolveShiftAssignmentShifts(dto.branchId, {
        includeAllShifts: dto.includeAllShifts,
        shiftIds: dto.shiftIds,
      }),
    ]);
    const includeAllShifts = await this.resolveShiftAssignmentIncludeAllFlag(
      dto.branchId,
      shifts.length,
      dto.includeAllShifts,
    );
    const derivedSuggestion = this.buildStaffShiftAssignmentSuggestion(
      shifts,
      includeAllShifts,
    );
    const desiredBaseCode =
      this.normalizeAttendanceCode(dto.code) ||
      derivedSuggestion.code ||
      this.buildStaffShiftAssignmentCode(
        users[0]?.employeeCode || users[0]?.attendanceCode || users[0]?.username,
      );
    const uniqueCodes = await this.buildUniqueStaffShiftAssignmentCodes(
      dto.branchId,
      desiredBaseCode,
      users.length,
    );
    const nextAssignmentName =
      String(dto.name || '').trim() ||
      derivedSuggestion.name ||
      `${users[0]?.fullName || 'Nhan vien'} - ${
        shifts.length > 1 ? 'Ca xoay' : shifts[0]?.name || 'Ca lam'
      }`;
    const nextStartDate = dto.startDate
      ? startOfDay(new Date(dto.startDate))
      : startOfDay(new Date());
    const nextRotationCycleDays = this.resolveShiftAssignmentCycleDays(
      dto.rotationCycleDays,
    );

    const created = await this.prisma.$transaction(
      users.map((staff, index) =>
        this.prisma.staffShiftAssignment.create({
          data: {
            branchId: dto.branchId,
            userId: staff.id,
            code: uniqueCodes[index],
            name: nextAssignmentName,
            startDate: nextStartDate,
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            rotationCycleDays: nextRotationCycleDays,
            isUnlimitedRotation: dto.isUnlimitedRotation ?? true,
            includeAllShifts,
            note: dto.note,
            shifts: {
              create: shifts.map((shift, shiftIndex) => ({
                shiftId: shift.id,
                sequence: shiftIndex,
              })),
            },
          },
          include: {
            branch: true,
            user: true,
            shifts: {
              include: {
                shift: true,
              },
              orderBy: { sequence: 'asc' },
            },
          },
        }),
      ),
    );

    const eventsByUser = await this.loadShiftAssignmentEventsByUser(
      created.map((item) => item.userId),
    );
    const mapped = created.map((item) =>
      this.mapStaffShiftAssignmentRecord(item, eventsByUser),
    );

    for (const item of mapped) {
      await this.audit(
        user,
        'staff-shift-assignments',
        AuditAction.CREATE,
        'staff_shift_assignment',
        item.id,
        undefined,
        item,
        item.branchId,
      );
    }

    return mapped.length === 1
      ? mapped[0]
      : { createdCount: mapped.length, items: mapped };
  }

  async updateStaffShiftAssignment(
    id: string,
    dto: UpdateStaffShiftAssignmentDto,
    user: AuthUser,
  ) {
    const before = await this.prisma.staffShiftAssignment.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        branch: true,
        user: true,
        shifts: {
          include: {
            shift: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!before) {
      throw new NotFoundException('Phan ca nhan vien khong ton tai');
    }

    this.assertBranchAccess(before.branchId, user);

    const nextBranchId = dto.branchId || before.branchId;
    if (dto.branchId) {
      this.assertBranchAccess(dto.branchId, user);
    }

    let nextShiftIds: string[] | undefined;
    let nextIncludeAllShifts = before.includeAllShifts;
    if (
      dto.includeAllShifts !== undefined ||
      dto.shiftIds !== undefined
    ) {
      const shifts = await this.resolveShiftAssignmentShifts(nextBranchId, {
        includeAllShifts:
          dto.includeAllShifts !== undefined
            ? dto.includeAllShifts
            : before.includeAllShifts,
        shiftIds:
          dto.shiftIds !== undefined
            ? dto.shiftIds
            : before.shifts.map((item) => item.shiftId),
      });
      nextShiftIds = shifts.map((item) => item.id);
      nextIncludeAllShifts = await this.resolveShiftAssignmentIncludeAllFlag(
        nextBranchId,
        nextShiftIds.length,
        dto.includeAllShifts,
      );
    }

    let nextUserId = before.userId;
    if (dto.userId || dto.userIds?.length) {
      const users = await this.resolveShiftAssignmentUsers(nextBranchId, [
        dto.userId || dto.userIds?.[0] || before.userId,
      ]);
      nextUserId = users[0].id;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.staffShiftAssignment.update({
        where: { id },
        data: {
          ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
          ...(dto.code !== undefined ? { code: dto.code } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(nextUserId !== before.userId ? { userId: nextUserId } : {}),
          ...(dto.startDate !== undefined
            ? { startDate: new Date(dto.startDate) }
            : {}),
          ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
          ...(dto.rotationCycleDays !== undefined
            ? {
                rotationCycleDays: this.resolveShiftAssignmentCycleDays(
                  dto.rotationCycleDays,
                ),
              }
            : {}),
          ...(dto.isUnlimitedRotation !== undefined
            ? { isUnlimitedRotation: dto.isUnlimitedRotation }
            : {}),
          ...(dto.includeAllShifts !== undefined || nextShiftIds
            ? { includeAllShifts: nextIncludeAllShifts }
            : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
        },
      });

      if (nextShiftIds) {
        await tx.staffShiftAssignmentShift.deleteMany({
          where: { assignmentId: id },
        });
        await tx.staffShiftAssignmentShift.createMany({
          data: nextShiftIds.map((shiftId, index) => ({
            assignmentId: id,
            shiftId,
            sequence: index,
          })),
        });
      }
    });

    const payload = await this.prisma.staffShiftAssignment.findFirst({
      where: { id },
      include: {
        branch: true,
        user: true,
        shifts: {
          where: {
            shift: {
              deletedAt: null,
            },
          },
          include: {
            shift: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!payload) {
      throw new NotFoundException('Phan ca nhan vien khong ton tai');
    }

    const eventsByUser = await this.loadShiftAssignmentEventsByUser([
      before.userId,
      payload.userId,
    ]);
    const beforeMapped = this.mapStaffShiftAssignmentRecord(
      before,
      eventsByUser,
    );
    const mapped = this.mapStaffShiftAssignmentRecord(payload, eventsByUser);
    await this.audit(
      user,
      'staff-shift-assignments',
      AuditAction.UPDATE,
      'staff_shift_assignment',
      id,
      beforeMapped,
      mapped,
      payload.branchId,
    );
    return mapped;
  }

  async removeStaffShiftAssignment(id: string, user: AuthUser) {
    const before = await this.prisma.staffShiftAssignment.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        branch: true,
        user: true,
        shifts: {
          where: {
            shift: {
              deletedAt: null,
            },
          },
          include: {
            shift: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!before) {
      throw new NotFoundException('Phan ca nhan vien khong ton tai');
    }

    this.assertBranchAccess(before.branchId, user);

    await this.prisma.staffShiftAssignment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    const eventsByUser = await this.loadShiftAssignmentEventsByUser([
      before.userId,
    ]);
    await this.audit(
      user,
      'staff-shift-assignments',
      AuditAction.DELETE,
      'staff_shift_assignment',
      id,
      this.mapStaffShiftAssignmentRecord(before, eventsByUser),
      { deleted: true },
      before.branchId,
    );

    return { success: true };
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
