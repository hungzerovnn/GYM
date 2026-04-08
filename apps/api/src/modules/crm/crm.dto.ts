import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCustomerGroupDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateCustomerGroupDto extends PartialType(
  CreateCustomerGroupDto,
) {}

export class CreateCustomerSourceDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCustomerSourceDto extends PartialType(
  CreateCustomerSourceDto,
) {}

export class CreateCustomerDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsString()
  code!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  phoneSecondary?: string;

  @IsOptional()
  @IsString()
  phoneTertiary?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  customerCardNumber?: string;

  @IsOptional()
  @IsString()
  fingerprintCode?: string;

  @IsOptional()
  @IsString()
  identityNumber?: string;

  @IsOptional()
  @IsDateString()
  identityIssueDate?: string;

  @IsOptional()
  @IsString()
  identityIssuePlace?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  referralName?: string;

  @IsOptional()
  @IsDateString()
  registrationDate?: string;

  @IsOptional()
  @IsDateString()
  startTrainingDate?: string;

  @IsOptional()
  @IsDateString()
  endTrainingDate?: string;

  @IsOptional()
  @IsString()
  cardCovid?: string;

  @IsOptional()
  @IsString()
  otherInfo?: string;

  @IsOptional()
  @IsInt()
  profileCount?: number;

  @IsOptional()
  @IsString()
  serviceNote?: string;

  @IsOptional()
  @IsString()
  membershipStatus?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CreateLeadDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsString()
  code!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  demand?: string;

  @IsOptional()
  @IsString()
  campaign?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  potentialLevel?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;

  @IsOptional()
  @IsDateString()
  appointmentAt?: string;

  @IsOptional()
  @IsString()
  careNote?: string;

  @IsOptional()
  @IsString()
  lastContactResult?: string;

  @IsOptional()
  @IsString()
  budgetExpected?: string;

  @IsOptional()
  @IsString()
  convertedCustomerId?: string;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

export class CreateLeadLogDto {
  @IsString()
  activityType!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string;

  @IsOptional()
  @IsDateString()
  contactAt?: string;
}

export class BulkLeadConvertDto {
  @IsArray()
  @IsString({ each: true })
  leadIds!: string[];
}

export class ToggleMemberPresenceDto {
  @IsOptional()
  @IsString()
  attendanceMachineId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['MANUAL', 'MACHINE'])
  source?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
