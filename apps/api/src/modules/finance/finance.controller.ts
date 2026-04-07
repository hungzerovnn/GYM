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
  CreateDepositDto,
  CreateExpenseDto,
  CreateLockerDto,
  CreateReceiptDto,
  CreateShopReturnDto,
  CreateShopSaleDto,
  UpdateDepositDto,
  UpdateExpenseDto,
  UpdateLockerDto,
  UpdateReceiptDto,
  UpdateShopReturnDto,
  UpdateShopSaleDto,
} from './finance.dto';
import { FinanceService } from './finance.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('payment-methods')
  listPaymentMethods(@Query() query: QueryDto) {
    return this.financeService.listPaymentMethods(query);
  }

  @Get('shop-sales')
  @Permissions('receipts.view')
  listShopSales(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.financeService.listShopSales(query, user);
  }

  @Get('shop-sales/:id')
  @Permissions('receipts.view')
  getShopSale(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.getShopSale(id, user);
  }

  @Post('shop-sales')
  @Permissions('receipts.create')
  createShopSale(
    @Body() dto: CreateShopSaleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeService.createShopSale(dto, user);
  }

  @Patch('shop-sales/:id')
  @Permissions('receipts.update')
  updateShopSale(
    @Param('id') id: string,
    @Body() dto: UpdateShopSaleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeService.updateShopSale(id, dto, user);
  }

  @Delete('shop-sales/:id')
  @Permissions('receipts.delete')
  removeShopSale(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.removeShopSale(id, user);
  }

  @Get('receipts')
  @Permissions('receipts.view')
  listReceipts(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.financeService.listReceipts(query, user);
  }

  @Get('receipts/:id')
  @Permissions('receipts.view')
  getReceipt(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.getReceipt(id, user);
  }

  @Post('receipts')
  @Permissions('receipts.create')
  createReceipt(@Body() dto: CreateReceiptDto, @CurrentUser() user: AuthUser) {
    return this.financeService.createReceipt(dto, user);
  }

  @Patch('receipts/:id')
  @Permissions('receipts.update')
  updateReceipt(
    @Param('id') id: string,
    @Body() dto: UpdateReceiptDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeService.updateReceipt(id, dto, user);
  }

  @Delete('receipts/:id')
  @Permissions('receipts.delete')
  removeReceipt(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.removeReceipt(id, user);
  }

  @Get('shop-returns')
  @Permissions('expenses.view')
  listShopReturns(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.financeService.listShopReturns(query, user);
  }

  @Get('shop-returns/:id')
  @Permissions('expenses.view')
  getShopReturn(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.getShopReturn(id, user);
  }

  @Post('shop-returns')
  @Permissions('expenses.create')
  createShopReturn(
    @Body() dto: CreateShopReturnDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeService.createShopReturn(dto, user);
  }

  @Patch('shop-returns/:id')
  @Permissions('expenses.update')
  updateShopReturn(
    @Param('id') id: string,
    @Body() dto: UpdateShopReturnDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeService.updateShopReturn(id, dto, user);
  }

  @Delete('shop-returns/:id')
  @Permissions('expenses.delete')
  removeShopReturn(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.removeShopReturn(id, user);
  }

  @Get('expenses')
  @Permissions('expenses.view')
  listExpenses(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.financeService.listExpenses(query, user);
  }

  @Get('expenses/:id')
  @Permissions('expenses.view')
  getExpense(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.getExpense(id, user);
  }

  @Post('expenses')
  @Permissions('expenses.create')
  createExpense(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthUser) {
    return this.financeService.createExpense(dto, user);
  }

  @Patch('expenses/:id')
  @Permissions('expenses.update')
  updateExpense(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeService.updateExpense(id, dto, user);
  }

  @Delete('expenses/:id')
  @Permissions('expenses.delete')
  removeExpense(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.removeExpense(id, user);
  }

  @Get('lockers')
  @Permissions('lockers.view')
  listLockers(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.financeService.listLockers(query, user);
  }

  @Get('lockers/:id')
  @Permissions('lockers.view')
  getLocker(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.getLocker(id, user);
  }

  @Post('lockers')
  @Permissions('lockers.create')
  createLocker(@Body() dto: CreateLockerDto, @CurrentUser() user: AuthUser) {
    return this.financeService.createLocker(dto, user);
  }

  @Patch('lockers/:id')
  @Permissions('lockers.update')
  updateLocker(
    @Param('id') id: string,
    @Body() dto: UpdateLockerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeService.updateLocker(id, dto, user);
  }

  @Delete('lockers/:id')
  @Permissions('lockers.delete')
  removeLocker(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.removeLocker(id, user);
  }

  @Get('deposits')
  @Permissions('deposits.view')
  listDeposits(@Query() query: QueryDto, @CurrentUser() user: AuthUser) {
    return this.financeService.listDeposits(query, user);
  }

  @Get('deposits/:id')
  @Permissions('deposits.view')
  getDeposit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.getDeposit(id, user);
  }

  @Post('deposits')
  @Permissions('deposits.create')
  createDeposit(@Body() dto: CreateDepositDto, @CurrentUser() user: AuthUser) {
    return this.financeService.createDeposit(dto, user);
  }

  @Patch('deposits/:id')
  @Permissions('deposits.update')
  updateDeposit(
    @Param('id') id: string,
    @Body() dto: UpdateDepositDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.financeService.updateDeposit(id, dto, user);
  }

  @Delete('deposits/:id')
  @Permissions('deposits.delete')
  removeDeposit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.financeService.removeDeposit(id, user);
  }
}
