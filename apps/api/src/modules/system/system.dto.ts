import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const attendanceMachineVendorValues = [
  'GENERIC',
  'ZKTECO',
  'HIKVISION',
  'SUPREMA',
  'ANVIZ',
  'RONALD_JACK',
] as const;

const attendanceMachineTypeValues = [
  'FINGERPRINT',
  'FACE',
  'CARD',
  'HYBRID',
] as const;

const attendanceMachineProtocolValues = [
  'GENERIC_EXPORT',
  'CSV_IMPORT',
  'ZK_PULL_TCP',
  'ZK_ADMS_PUSH',
  'HIKVISION_ISAPI',
  'SUPREMA_BIOSTAR',
  'GENERIC_HTTP',
] as const;

export class CreateBranchDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  openingTime?: string;

  @IsOptional()
  @IsString()
  closingTime?: string;

  @IsOptional()
  @IsInt()
  maxDepositHours?: number;

  @IsOptional()
  @IsInt()
  maxBookingsPerDay?: number;

  @IsOptional()
  @IsBoolean()
  requiresDeposit?: boolean;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateBranchDto extends PartialType(CreateBranchDto) {}

export class CreateRoleDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class CreateUserDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  username!: string;

  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsOptional()
  @IsString()
  attendanceCode?: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}

export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password!: string;
}

export class AttendanceMachineMaintenanceDto {
  @IsString()
  @IsIn([
    'TOGGLE_SYNC',
    'MARK_CONNECTED',
    'MARK_DISCONNECTED',
    'MARK_ERROR',
    'PING_MACHINE',
    'START_SYNC',
    'FINISH_SYNC',
    'PULL_ATTENDANCE_EVENTS',
    'PULL_MACHINE_CODES',
    'PUSH_STAFF_CODES',
    'PUSH_CUSTOMER_CODES',
    'SYNC_MACHINE_TIME',
    'EXPORT_MACHINE_LOG_RANGE',
    'DELETE_MACHINE_LOG_RANGE',
    'EXPORT_ALL_MACHINE_LOGS',
    'DELETE_ALL_MACHINE_LOGS',
    'LINK_MACHINE_PERSON',
    'ENROLL_FACE',
    'ENROLL_CARD',
  ])
  action!: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @IsIn(['STAFF', 'CUSTOMER'])
  personType?: string;

  @IsOptional()
  @IsString()
  personId?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  appAttendanceCode?: string;

  @IsOptional()
  @IsString()
  machineCode?: string;

  @IsOptional()
  @IsString()
  machineUserId?: string;

  @IsOptional()
  @IsString()
  cardCode?: string;

  @IsOptional()
  @IsString()
  faceImageUrl?: string;

  @IsOptional()
  @IsString()
  faceImageBase64?: string;
}

export class CreateTenantDatabaseDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  databaseName!: string;

  @IsString()
  databaseUser!: string;

  @IsString()
  @MinLength(8)
  databasePassword!: string;

  @IsString()
  adminUsername!: string;

  @IsOptional()
  @IsString()
  adminFullName?: string;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  adminPhone?: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  appUrl?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateTenantDatabaseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  adminPhone?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  appUrl?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateAttendanceMachineDto {
  @IsString()
  branchId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(attendanceMachineVendorValues)
  vendor?: string;

  @IsOptional()
  @IsString()
  @IsIn(attendanceMachineTypeValues)
  machineType?: string;

  @IsOptional()
  @IsString()
  @IsIn(attendanceMachineProtocolValues)
  protocol?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  deviceIdentifier?: string;

  @IsOptional()
  @IsString()
  connectionPort?: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  commKey?: string;

  @IsOptional()
  @IsInt()
  pollingIntervalSeconds?: number;

  @IsOptional()
  @IsBoolean()
  supportsFaceImage?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsFaceTemplate?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsCardEnrollment?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsFingerprintTemplate?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsWebhook?: boolean;

  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @IsOptional()
  @IsString()
  connectionStatus?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;
}

export class UpdateAttendanceMachineDto extends PartialType(
  CreateAttendanceMachineDto,
) {}

export class CreateStaffShiftDto {
  @IsString()
  branchId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsOptional()
  @IsInt()
  breakMinutes?: number;

  @IsOptional()
  @IsNumber()
  workHours?: number;

  @IsOptional()
  @IsInt()
  lateToleranceMinutes?: number;

  @IsOptional()
  @IsInt()
  earlyLeaveToleranceMinutes?: number;

  @IsOptional()
  @IsInt()
  overtimeAfterMinutes?: number;

  @IsOptional()
  @IsNumber()
  mealAllowance?: number;

  @IsOptional()
  @IsNumber()
  nightAllowance?: number;

  @IsOptional()
  @IsBoolean()
  isOvernight?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateStaffShiftDto extends PartialType(CreateStaffShiftDto) {}

export class CreateStaffShiftAssignmentDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  userIds!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  shiftIds?: string[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rotationCycleDays?: number;

  @IsOptional()
  @IsBoolean()
  isUnlimitedRotation?: boolean;

  @IsOptional()
  @IsBoolean()
  includeAllShifts?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateStaffShiftAssignmentDto extends PartialType(
  CreateStaffShiftAssignmentDto,
) {
  @IsOptional()
  @IsString()
  userId?: string;
}

export class CreateStaffAttendanceEventDto {
  @IsString()
  branchId!: string;

  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  attendanceMachineId?: string;

  @IsDateString()
  eventAt!: string;

  @IsString()
  @IsIn(['CHECK_IN', 'CHECK_OUT'])
  eventType!: string;

  @IsOptional()
  @IsString()
  @IsIn(['FINGERPRINT', 'FACE', 'CARD', 'MOBILE', 'MANUAL'])
  verificationMethod?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MACHINE', 'MANUAL', 'IMPORT'])
  source?: string;

  @IsOptional()
  @IsString()
  rawCode?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateStaffAttendanceEventDto extends PartialType(
  CreateStaffAttendanceEventDto,
) {}
