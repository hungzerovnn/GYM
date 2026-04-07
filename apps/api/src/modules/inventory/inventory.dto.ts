import { PartialType } from '@nestjs/mapped-types';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsString()
  purchasePrice?: string;

  @IsOptional()
  @IsString()
  salePrice?: string;

  @IsOptional()
  @IsInt()
  stockQuantity?: number;

  @IsOptional()
  @IsInt()
  minStockQuantity?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class CreateSupplierDto {
  @IsString()
  branchId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

export class CreatePurchaseOrderItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  quantity!: number;

  @IsString()
  unitPrice!: string;

  @IsOptional()
  @IsString()
  totalPrice?: string;
}

export class CreatePurchaseOrderDto {
  @IsString()
  branchId!: string;

  @IsString()
  supplierId!: string;

  @IsString()
  code!: string;

  @IsDateString()
  orderDate!: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  totalAmount?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  createdUserId?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  items?: CreatePurchaseOrderItemDto[];
}

export class UpdatePurchaseOrderDto extends PartialType(
  CreatePurchaseOrderDto,
) {}
