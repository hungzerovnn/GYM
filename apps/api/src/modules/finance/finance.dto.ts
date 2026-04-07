import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateReceiptDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsString()
  code!: string;

  @IsDateString()
  receiptDate!: string;

  @IsString()
  amount!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  collectorId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateReceiptDto extends PartialType(CreateReceiptDto) {}

export class CreateShopSaleDto extends OmitType(CreateReceiptDto, [
  'amount',
] as const) {
  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  lineItemsText?: string;
}

export class UpdateShopSaleDto extends PartialType(CreateShopSaleDto) {}

export class CreateExpenseDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @IsString()
  code!: string;

  @IsDateString()
  expenseDate!: string;

  @IsString()
  payeeName!: string;

  @IsString()
  expenseType!: string;

  @IsString()
  amount!: string;

  @IsOptional()
  @IsString()
  approverId?: string;

  @IsOptional()
  @IsString()
  createdUserId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

export class CreateShopReturnDto extends OmitType(CreateExpenseDto, [
  'expenseType',
  'amount',
] as const) {
  @IsOptional()
  @IsString()
  expenseType?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  lineItemsText?: string;
}

export class UpdateShopReturnDto extends PartialType(CreateShopReturnDto) {}

export class CreateLockerDto {
  @IsString()
  branchId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateLockerDto extends PartialType(CreateLockerDto) {}

export class CreateDepositDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  lockerRentalId?: string;

  @IsString()
  code!: string;

  @IsString()
  itemType!: string;

  @IsString()
  amount!: string;

  @IsDateString()
  receivedAt!: string;

  @IsOptional()
  @IsDateString()
  returnedAt?: string;

  @IsOptional()
  @IsString()
  processedById?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateDepositDto extends PartialType(CreateDepositDto) {}
