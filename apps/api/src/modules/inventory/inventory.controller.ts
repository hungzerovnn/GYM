import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { QueryDto } from '../../common/dto/query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../../common/types/auth-user.type';
import {
  CreateProductDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  UpdateProductDto,
  UpdatePurchaseOrderDto,
  UpdateSupplierDto,
} from './inventory.dto';
import { InventoryService } from './inventory.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('products')
  @Permissions('products.view')
  listProducts(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.listProducts(query, user);
  }

  @Get('products/:id')
  @Permissions('products.view')
  getProduct(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.getProduct(id, user);
  }

  @Post('products')
  @Permissions('products.create')
  createProduct(@Body() dto: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createProduct(dto, user);
  }

  @Patch('products/:id')
  @Permissions('products.update')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.updateProduct(id, dto, user);
  }

  @Delete('products/:id')
  @Permissions('products.delete')
  removeProduct(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.removeProduct(id, user);
  }

  @Get('suppliers')
  @Permissions('suppliers.view')
  listSuppliers(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.listSuppliers(query, user);
  }

  @Get('suppliers/:id')
  @Permissions('suppliers.view')
  getSupplier(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.getSupplier(id, user);
  }

  @Post('suppliers')
  @Permissions('suppliers.create')
  createSupplier(
    @Body() dto: CreateSupplierDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.createSupplier(dto, user);
  }

  @Patch('suppliers/:id')
  @Permissions('suppliers.update')
  updateSupplier(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.updateSupplier(id, dto, user);
  }

  @Delete('suppliers/:id')
  @Permissions('suppliers.delete')
  removeSupplier(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.removeSupplier(id, user);
  }

  @Get('purchase-orders')
  @Permissions('purchase-orders.view')
  listPurchaseOrders(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.listPurchaseOrders(query, user);
  }

  @Get('purchase-orders/:id')
  @Permissions('purchase-orders.view')
  getPurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.getPurchaseOrder(id, user);
  }

  @Post('purchase-orders')
  @Permissions('purchase-orders.create')
  createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.createPurchaseOrder(dto, user);
  }

  @Patch('purchase-orders/:id')
  @Permissions('purchase-orders.update')
  updatePurchaseOrder(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.inventoryService.updatePurchaseOrder(id, dto, user);
  }

  @Delete('purchase-orders/:id')
  @Permissions('purchase-orders.delete')
  removePurchaseOrder(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.removePurchaseOrder(id, user);
  }
}
