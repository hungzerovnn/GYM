import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  branchId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  defaultPrice?: string;

  @IsOptional()
  @IsInt()
  durationDays?: number;

  @IsOptional()
  @IsInt()
  defaultSessions?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

export class CreateServicePackageDto {
  @IsString()
  serviceId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @IsInt()
  sessionCount?: number;

  @IsOptional()
  @IsInt()
  bonusSessions?: number;

  @IsOptional()
  @IsInt()
  bonusDays?: number;

  @IsOptional()
  @IsInt()
  durationDays?: number;

  @IsString()
  packageType!: string;

  @IsOptional()
  @IsString()
  remainingValueRule?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateServicePackageDto extends PartialType(
  CreateServicePackageDto,
) {}

export class CreateTrainerDto {
  @IsString()
  branchId!: string;

  @IsString()
  code!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  specialty?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateTrainerDto extends PartialType(CreateTrainerDto) {}

export class CreateContractItemDto {
  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  servicePackageId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  quantity?: number;

  @IsOptional()
  @IsInt()
  sessionCount?: number;

  @IsOptional()
  @IsString()
  unitPrice?: string;

  @IsOptional()
  @IsString()
  discountAmount?: string;

  @IsOptional()
  @IsString()
  totalAmount?: string;
}

export class CreateContractDto {
  @IsString()
  branchId!: string;

  @IsString()
  customerId!: string;

  @IsString()
  servicePackageId!: string;

  @IsOptional()
  @IsString()
  saleUserId?: string;

  @IsOptional()
  @IsString()
  trainerId?: string;

  @IsString()
  code!: string;

  @IsString()
  contractType!: string;

  @IsString()
  packageName!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsInt()
  totalSessions?: number;

  @IsOptional()
  @IsInt()
  usedSessions?: number;

  @IsOptional()
  @IsInt()
  remainingSessions?: number;

  @IsOptional()
  @IsInt()
  bonusSessions?: number;

  @IsOptional()
  @IsString()
  unitPrice?: string;

  @IsOptional()
  @IsString()
  grossAmount?: string;

  @IsOptional()
  @IsString()
  discountFixed?: string;

  @IsOptional()
  @IsString()
  discountPercent?: string;

  @IsOptional()
  @IsString()
  totalDiscount?: string;

  @IsOptional()
  @IsString()
  vatAmount?: string;

  @IsOptional()
  @IsString()
  totalAmount?: string;

  @IsOptional()
  @IsString()
  amountPaid?: string;

  @IsOptional()
  @IsString()
  amountDue?: string;

  @IsOptional()
  @IsString()
  remainingValue?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  richNote?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  oldContractCode?: string;

  @IsOptional()
  @IsArray()
  items?: CreateContractItemDto[];
}

export class UpdateContractDto extends PartialType(CreateContractDto) {}

export class ConvertContractDto {
  @IsString()
  newContractId!: string;

  @IsString()
  conversionType!: string;

  @IsOptional()
  @IsString()
  differenceAmount?: string;

  @IsOptional()
  @IsInt()
  convertedSessions?: number;

  @IsOptional()
  @IsString()
  remainingValueRule?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateTrainingSessionDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  trainerId?: string;

  @IsString()
  code!: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsInt()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  consumedSessions?: number;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateTrainingSessionDto extends PartialType(
  CreateTrainingSessionDto,
) {}

export class CheckInTrainingSessionDto {
  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsInt()
  consumedSessions?: number;
}
