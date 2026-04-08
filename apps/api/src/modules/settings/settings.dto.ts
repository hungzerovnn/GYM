import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateSmsConfigDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  provider!: string;

  @IsOptional()
  @IsString()
  apiUrl?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsInt()
  maxPerDay?: number;

  @IsOptional()
  @IsString()
  templateOtp?: string;

  @IsOptional()
  @IsString()
  templateReminder?: string;

  @IsOptional()
  @IsString()
  templateBirthday?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateEmailConfigDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  provider!: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsInt()
  port?: number;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  encryption?: string;

  @IsOptional()
  @IsString()
  fromName?: string;

  @IsOptional()
  @IsString()
  fromEmail?: string;

  @IsOptional()
  @IsInt()
  maxPerDay?: number;

  @IsOptional()
  @IsString()
  templateBirthday?: string;

  @IsOptional()
  @IsString()
  templateOtp?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateZaloConfigDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  oaName?: string;

  @IsOptional()
  @IsString()
  oaId?: string;

  @IsOptional()
  @IsString()
  appId?: string;

  @IsOptional()
  @IsString()
  appSecret?: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsInt()
  maxPerDay?: number;

  @IsOptional()
  @IsString()
  apiUrl?: string;

  @IsOptional()
  @IsBoolean()
  otpEnabled?: boolean;

  @IsOptional()
  @IsString()
  otpTemplateId?: string;

  @IsOptional()
  @IsString()
  otpTemplateDataKey?: string;

  @IsOptional()
  @IsString()
  otpPhoneOverride?: string;

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(8)
  otpCodeLength?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  otpTtlMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  otpResendCooldownSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  otpMaxRetry?: number;

  @IsOptional()
  @IsString()
  templateBirthday?: string;

  @IsOptional()
  @IsString()
  templateReminder?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBirthdayTemplateDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsString()
  name!: string;

  @IsString()
  title!: string;

  @IsString()
  content!: string;

  @IsString()
  targetType!: string;

  @IsOptional()
  @IsInt()
  remindDays?: number;

  @IsString()
  channel!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBirthdayTemplateDto extends PartialType(
  CreateBirthdayTemplateDto,
) {}

export class UpdateGeneralSettingDto {
  @IsString()
  appName!: string;

  @IsString()
  timezone!: string;

  @IsString()
  currency!: string;

  @IsString()
  dateFormat!: string;

  @IsBoolean()
  codeGeneration!: boolean;

  @IsInt()
  uploadLimitMb!: number;

  @IsOptional()
  @IsInt()
  memberPresenceOvernightGraceHours?: number;
}
