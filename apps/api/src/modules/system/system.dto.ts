import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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
    'START_SYNC',
    'FINISH_SYNC',
    'PULL_ATTENDANCE_EVENTS',
    'PULL_MACHINE_CODES',
    'PUSH_STAFF_CODES',
    'PUSH_CUSTOMER_CODES',
    'SYNC_MACHINE_TIME',
  ])
  action!: string;
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
  connectionPort?: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @IsOptional()
  @IsString()
  connectionStatus?: string;
}

export class UpdateAttendanceMachineDto extends PartialType(
  CreateAttendanceMachineDto,
) {}

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
