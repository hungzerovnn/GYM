import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { QueryDto } from '../../common/dto/query.dto';
import { AuthUser } from '../../common/types/auth-user.type';
import {
  buildDateRange,
  buildListResponse,
  buildPagination,
  buildSort,
} from '../../common/utils/query.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
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

type ShopLineItem = {
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  note?: string;
};

const SHOP_SALE_SOURCE = 'PRO_SHOP_SALE';
const SHOP_RETURN_TYPE = 'PRO_SHOP_RETURN';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private isGlobal(user: AuthUser) {
    return user.roleCodes.some((roleCode) =>
      ['super_admin', 'system_owner'].includes(roleCode),
    );
  }

  private money(value?: string | null) {
    return value ? new Prisma.Decimal(value) : undefined;
  }

  private async audit(
    user: AuthUser,
    module: string,
    action: AuditAction,
    entityType: string,
    entityId: string,
    beforeData?: unknown,
    afterData?: unknown,
  ) {
    await this.auditLogsService.write({
      module,
      action,
      userId: user.id,
      branchId: user.branchId,
      entityType,
      entityId,
      beforeData,
      afterData,
    });
  }

  private async resolveUserNameMap(ids: Array<string | null | undefined>) {
    const uniqueIds = Array.from(
      new Set(ids.filter((id): id is string => Boolean(id))),
    );
    if (!uniqueIds.length) {
      return new Map<string, string>();
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, fullName: true },
    });

    return new Map(users.map((item) => [item.id, item.fullName]));
  }

  private async syncContractBalance(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, totalAmount: true },
    });

    if (!contract) {
      return;
    }

    const receipts = await this.prisma.paymentReceipt.aggregate({
      where: { contractId, deletedAt: null },
      _sum: { amount: true },
    });
    const amountPaid = receipts._sum.amount || new Prisma.Decimal(0);
    const amountDue = contract.totalAmount.minus(amountPaid);

    await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        amountPaid,
        amountDue,
        paymentStatus:
          Number(amountPaid) <= 0
            ? 'UNPAID'
            : Number(amountDue) > 0
              ? 'PARTIAL'
              : 'PAID',
      },
    });
  }

  private asLineItems(
    value: Prisma.JsonValue | null | undefined,
  ): ShopLineItem[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter(
        (item) =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
      .map((item) => {
        const record = item as Prisma.JsonObject;

        return {
          productId: String(record.productId || ''),
          productCode: String(record.productCode || ''),
          productName: String(record.productName || ''),
          unit: String(record.unit || ''),
          quantity: Number(record.quantity || 0),
          unitPrice: String(record.unitPrice || '0'),
          totalPrice: String(record.totalPrice || '0'),
          note: record.note ? String(record.note) : undefined,
        };
      })
      .filter((item) => item.productId && item.quantity > 0);
  }

  private formatLineItemsText(items: ShopLineItem[]) {
    return items
      .map((item) =>
        [item.productCode, item.quantity, item.unitPrice, item.note]
          .filter(Boolean)
          .join(' | '),
      )
      .join('\n');
  }

  private summarizeLineItems(items: ShopLineItem[]) {
    return {
      itemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      productSummary: items
        .map((item) => `${item.productCode} x${item.quantity}`)
        .join(', '),
    };
  }

  private async parseShopLineItems(branchId: string, lineItemsText?: string) {
    if (!lineItemsText?.trim()) {
      return [] as ShopLineItem[];
    }

    const rows = lineItemsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!rows.length) {
      return [] as ShopLineItem[];
    }

    const products = await this.prisma.product.findMany({
      where: { branchId, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        salePrice: true,
      },
    });

    const productMap = new Map<string, (typeof products)[number]>();
    products.forEach((product) => {
      productMap.set(product.code.trim().toLowerCase(), product);
      productMap.set(product.name.trim().toLowerCase(), product);
    });

    return rows.map((row, index) => {
      const [
        productToken = '',
        quantityToken = '',
        unitPriceToken = '',
        noteToken = '',
      ] = row.split('|').map((part) => part.trim());

      const product = productMap.get(productToken.toLowerCase());
      if (!product) {
        throw new BadRequestException(
          `Dong hang ${index + 1}: khong tim thay san pham "${productToken}" trong chi nhanh nay`,
        );
      }

      const quantity = Number(quantityToken);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException(
          `Dong hang ${index + 1}: so luong khong hop le`,
        );
      }

      const unitPrice = unitPriceToken
        ? Number(unitPriceToken)
        : Number(product.salePrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new BadRequestException(
          `Dong hang ${index + 1}: don gia khong hop le`,
        );
      }

      return {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        unit: product.unit,
        quantity,
        unitPrice: unitPrice.toString(),
        totalPrice: (unitPrice * quantity).toString(),
        note: noteToken || undefined,
      } satisfies ShopLineItem;
    });
  }

  private resolveLineItemsAmount(
    lineItems: ShopLineItem[],
    amount?: string | null,
  ) {
    if (amount?.trim()) {
      return this.money(amount);
    }

    if (!lineItems.length) {
      return undefined;
    }

    return new Prisma.Decimal(
      lineItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0),
    );
  }

  private async adjustProductStock(
    tx: Prisma.TransactionClient,
    lineItems: ShopLineItem[],
    direction: 'increment' | 'decrement',
  ) {
    for (const item of lineItems) {
      if (direction === 'decrement') {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockQuantity: true, code: true },
        });

        if (!product) {
          throw new BadRequestException(
            `San pham ${item.productCode} khong ton tai`,
          );
        }

        if (product.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Ton kho khong du cho san pham ${product.code}`,
          );
        }
      }

      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: {
            [direction]: item.quantity,
          },
        },
      });
    }
  }

  private buildReceiptWhere(
    query: QueryDto,
    user: AuthUser,
    extraWhere: Prisma.PaymentReceiptWhereInput = {},
  ) {
    const restrictToOwn = user.roleCodes.includes('sales');

    return {
      deletedAt: null,
      ...extraWhere,
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(restrictToOwn ? { collectorId: user.id } : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              {
                code: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                content: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                customer: {
                  fullName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
      ...buildDateRange('receiptDate', query),
    } satisfies Prisma.PaymentReceiptWhereInput;
  }

  private buildExpenseWhere(
    query: QueryDto,
    user: AuthUser,
    extraWhere: Prisma.PaymentExpenseWhereInput = {},
  ) {
    return {
      deletedAt: null,
      ...extraWhere,
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              {
                code: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                payeeName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                expenseType: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                note: { contains: query.search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
      ...buildDateRange('expenseDate', query),
    } satisfies Prisma.PaymentExpenseWhereInput;
  }

  private mapReceiptRecord(
    receipt: any,
    userNames: Map<string, string> = new Map(),
  ) {
    const lineItems = this.asLineItems(receipt.lineItems);
    const summary = this.summarizeLineItems(lineItems);
    return {
      ...receipt,
      branchName: receipt.branch?.name || '',
      customerName: receipt.customer?.fullName || '',
      customerPhone: receipt.customer?.phone || '',
      contractCode: receipt.contract?.code || '',
      contractPackageName: receipt.contract?.packageName || '',
      paymentMethodName: receipt.paymentMethod?.name || '',
      collectorName: userNames.get(receipt.collectorId || '') || '',
      receiptInfo: [
        receipt.code,
        receipt.customer?.fullName,
        receipt.contract?.code,
      ]
        .filter(Boolean)
        .join(' | '),
      lineItems,
      lineItemsText: this.formatLineItemsText(lineItems),
      itemCount: summary.itemCount,
      totalQuantity: summary.totalQuantity,
      productSummary: summary.productSummary,
      sourceLabel:
        receipt.sourceType === SHOP_SALE_SOURCE
          ? 'Ban hang Pro Shop'
          : receipt.sourceType || '',
    };
  }

  private mapExpenseRecord(
    expense: any,
    userNames: Map<string, string> = new Map(),
  ) {
    const lineItems = this.asLineItems(expense.lineItems);
    const summary = this.summarizeLineItems(lineItems);
    return {
      ...expense,
      branchName: expense.branch?.name || '',
      paymentMethodName: expense.paymentMethod?.name || '',
      approverName: userNames.get(expense.approverId || '') || '',
      createdUserName: userNames.get(expense.createdUserId || '') || '',
      expenseInfo: [expense.code, expense.expenseType, expense.payeeName]
        .filter(Boolean)
        .join(' | '),
      lineItems,
      lineItemsText: this.formatLineItemsText(lineItems),
      itemCount: summary.itemCount,
      totalQuantity: summary.totalQuantity,
      productSummary: summary.productSummary,
      expenseLabel:
        expense.expenseType === SHOP_RETURN_TYPE
          ? 'Tra hang Pro Shop'
          : expense.expenseType || '',
    };
  }

  private mapLockerRecord(locker: any) {
    const rentals = Array.isArray(locker.rentals)
      ? locker.rentals.map((rental: any) => ({
          id: rental.id,
          code: rental.code,
          customerId: rental.customerId,
          customerCode: rental.customer?.code || '',
          customerName: rental.customer?.fullName || '',
          startDate: rental.startDate?.toISOString() || '',
          endDate: rental.endDate?.toISOString() || '',
          depositAmount: rental.depositAmount,
          status: rental.status,
          note: rental.note || '',
        }))
      : undefined;
    const activeRentals =
      rentals?.filter((item) => item.status === 'ACTIVE') || [];
    const currentRental = activeRentals[0] || rentals?.[0];

    return {
      id: locker.id,
      branchId: locker.branchId,
      branchName: locker.branch?.name || '',
      code: locker.code,
      name: locker.name,
      label: locker.label || '',
      price: locker.price,
      status: locker.status,
      note: locker.note || '',
      rentalCount: locker._count?.rentals ?? rentals?.length ?? 0,
      activeRentalCount: activeRentals.length,
      currentRentalCode: currentRental?.code || '',
      currentCustomerName: currentRental?.customerName || '',
      rentals,
      createdAt: locker.createdAt.toISOString(),
      updatedAt: locker.updatedAt.toISOString(),
      createdDateTime: locker.createdAt.toISOString(),
      updatedDateTime: locker.updatedAt.toISOString(),
    };
  }

  private mapDepositRecord(deposit: any) {
    return {
      id: deposit.id,
      branchId: deposit.branchId,
      branchName: deposit.branch?.name || '',
      customerId: deposit.customerId || '',
      customerCode: deposit.customer?.code || '',
      customerName: deposit.customer?.fullName || '',
      lockerRentalId: deposit.lockerRentalId || '',
      lockerRentalCode: deposit.lockerRental?.code || '',
      code: deposit.code,
      itemType: deposit.itemType,
      amount: deposit.amount,
      receivedAt: deposit.receivedAt.toISOString(),
      receivedDateTime: deposit.receivedAt.toISOString(),
      returnedAt: deposit.returnedAt?.toISOString() || '',
      returnedDateTime: deposit.returnedAt?.toISOString() || '',
      status: deposit.status,
      note: deposit.note || '',
      createdAt: deposit.createdAt.toISOString(),
      updatedAt: deposit.updatedAt.toISOString(),
      createdDateTime: deposit.createdAt.toISOString(),
      updatedDateTime: deposit.updatedAt.toISOString(),
    };
  }

  async listPaymentMethods(query: QueryDto) {
    const where: Prisma.PaymentMethodWhereInput = {
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { type: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.status ? { isActive: query.status === 'ACTIVE' } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.paymentMethod.findMany({
        where,
        orderBy: buildSort(query, 'name'),
        ...buildPagination(query),
      }),
      this.prisma.paymentMethod.count({ where }),
    ]);

    return buildListResponse(data, total, query);
  }

  async listShopSales(query: QueryDto, user: AuthUser) {
    const where = this.buildReceiptWhere(query, user, {
      sourceType: SHOP_SALE_SOURCE,
    });

    const [data, total] = await Promise.all([
      this.prisma.paymentReceipt.findMany({
        where,
        include: {
          branch: true,
          customer: true,
          contract: true,
          paymentMethod: true,
        },
        orderBy: buildSort(query, 'receiptDate'),
        ...buildPagination(query),
      }),
      this.prisma.paymentReceipt.count({ where }),
    ]);

    const userNames = await this.resolveUserNameMap(
      data.map((receipt) => receipt.collectorId),
    );

    return buildListResponse(
      data.map((receipt) => this.mapReceiptRecord(receipt, userNames)),
      total,
      query,
    );
  }

  async getShopSale(id: string, user: AuthUser) {
    const receipt = await this.prisma.paymentReceipt.findFirst({
      where: {
        id,
        deletedAt: null,
        sourceType: SHOP_SALE_SOURCE,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        customer: true,
        contract: true,
        paymentMethod: true,
      },
    });

    if (!receipt) {
      throw new NotFoundException('Shop sale not found');
    }

    const userNames = await this.resolveUserNameMap([receipt.collectorId]);
    return this.mapReceiptRecord(receipt, userNames);
  }

  async createShopSale(dto: CreateShopSaleDto, user: AuthUser) {
    const payload = await this.prisma.$transaction(async (tx) => {
      const lineItems = await this.parseShopLineItems(
        dto.branchId,
        dto.lineItemsText,
      );
      const record = await tx.paymentReceipt.create({
        data: {
          branchId: dto.branchId,
          customerId: dto.customerId,
          contractId: dto.contractId,
          paymentMethodId: dto.paymentMethodId,
          code: dto.code,
          receiptDate: new Date(dto.receiptDate),
          amount: this.resolveLineItemsAmount(lineItems, dto.amount),
          content: dto.content,
          sourceType: SHOP_SALE_SOURCE,
          lineItems: lineItems as unknown as Prisma.InputJsonValue,
          collectorId: dto.collectorId || user.id,
          status: (dto.status as any) || 'COMPLETED',
          note: dto.note,
        },
        include: {
          branch: true,
          customer: true,
          contract: true,
          paymentMethod: true,
        },
      });

      if (record.status === 'COMPLETED' && lineItems.length) {
        await this.adjustProductStock(tx, lineItems, 'decrement');
      }

      return record;
    });

    if (payload.contractId) {
      await this.syncContractBalance(payload.contractId);
    }

    await this.audit(
      user,
      'receipts',
      AuditAction.CREATE,
      'receipt',
      payload.id,
      undefined,
      payload,
    );
    const userNames = await this.resolveUserNameMap([payload.collectorId]);
    return this.mapReceiptRecord(payload, userNames);
  }

  async updateShopSale(id: string, dto: UpdateShopSaleDto, user: AuthUser) {
    const before = await this.prisma.paymentReceipt.findUnique({
      where: { id },
    });
    if (!before || before.sourceType !== SHOP_SALE_SOURCE || before.deletedAt) {
      throw new NotFoundException('Shop sale not found');
    }

    const beforeLineItems = this.asLineItems(before.lineItems);

    const payload = await this.prisma.$transaction(async (tx) => {
      if (before.status === 'COMPLETED' && beforeLineItems.length) {
        await this.adjustProductStock(tx, beforeLineItems, 'increment');
      }

      const nextBranchId = dto.branchId || before.branchId;
      const nextLineItems =
        dto.lineItemsText !== undefined
          ? await this.parseShopLineItems(nextBranchId, dto.lineItemsText)
          : beforeLineItems;
      const nextAmount =
        dto.amount !== undefined
          ? this.resolveLineItemsAmount(nextLineItems, dto.amount)
          : dto.lineItemsText !== undefined
            ? this.resolveLineItemsAmount(nextLineItems, undefined)
            : undefined;

      const record = await tx.paymentReceipt.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          customerId: dto.customerId,
          contractId: dto.contractId,
          paymentMethodId: dto.paymentMethodId,
          code: dto.code,
          receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : undefined,
          amount: nextAmount,
          content: dto.content,
          sourceType: SHOP_SALE_SOURCE,
          lineItems:
            dto.lineItemsText !== undefined
              ? (nextLineItems as unknown as Prisma.InputJsonValue)
              : undefined,
          collectorId: dto.collectorId,
          status: dto.status as any,
          note: dto.note,
        },
        include: {
          branch: true,
          customer: true,
          contract: true,
          paymentMethod: true,
        },
      });

      if (record.status === 'COMPLETED' && nextLineItems.length) {
        await this.adjustProductStock(tx, nextLineItems, 'decrement');
      }

      return record;
    });

    const contractIds = Array.from(
      new Set(
        [before.contractId, payload.contractId].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    );
    await Promise.all(
      contractIds.map((contractId) => this.syncContractBalance(contractId)),
    );

    await this.audit(
      user,
      'receipts',
      AuditAction.UPDATE,
      'receipt',
      id,
      before,
      payload,
    );
    const userNames = await this.resolveUserNameMap([payload.collectorId]);
    return this.mapReceiptRecord(payload, userNames);
  }

  async removeShopSale(id: string, user: AuthUser) {
    const before = await this.prisma.paymentReceipt.findUnique({
      where: { id },
    });
    if (!before || before.sourceType !== SHOP_SALE_SOURCE || before.deletedAt) {
      throw new NotFoundException('Shop sale not found');
    }

    const beforeLineItems = this.asLineItems(before.lineItems);

    const payload = await this.prisma.$transaction(async (tx) => {
      if (before.status === 'COMPLETED' && beforeLineItems.length) {
        await this.adjustProductStock(tx, beforeLineItems, 'increment');
      }

      return tx.paymentReceipt.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    if (before.contractId) {
      await this.syncContractBalance(before.contractId);
    }

    await this.audit(
      user,
      'receipts',
      AuditAction.DELETE,
      'receipt',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listReceipts(query: QueryDto, user: AuthUser) {
    const where = this.buildReceiptWhere(query, user, {
      NOT: { sourceType: SHOP_SALE_SOURCE },
    });

    const [data, total] = await Promise.all([
      this.prisma.paymentReceipt.findMany({
        where,
        include: {
          branch: true,
          customer: true,
          contract: true,
          paymentMethod: true,
        },
        orderBy: buildSort(query, 'receiptDate'),
        ...buildPagination(query),
      }),
      this.prisma.paymentReceipt.count({ where }),
    ]);

    const userNames = await this.resolveUserNameMap(
      data.map((receipt) => receipt.collectorId),
    );

    return buildListResponse(
      data.map((receipt) => this.mapReceiptRecord(receipt, userNames)),
      total,
      query,
    );
  }

  async getReceipt(id: string, user: AuthUser) {
    const receipt = await this.prisma.paymentReceipt.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        customer: true,
        contract: true,
        paymentMethod: true,
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    const userNames = await this.resolveUserNameMap([receipt.collectorId]);
    return this.mapReceiptRecord(receipt, userNames);
  }

  async createReceipt(dto: CreateReceiptDto, user: AuthUser) {
    const payload = await this.prisma.paymentReceipt.create({
      data: {
        ...dto,
        receiptDate: new Date(dto.receiptDate),
        amount: this.money(dto.amount),
        collectorId: dto.collectorId || user.id,
        status: (dto.status as any) || 'COMPLETED',
      },
      include: {
        branch: true,
        customer: true,
        contract: true,
        paymentMethod: true,
      },
    });

    if (payload.contractId) {
      await this.syncContractBalance(payload.contractId);
    }

    await this.audit(
      user,
      'receipts',
      AuditAction.CREATE,
      'receipt',
      payload.id,
      undefined,
      payload,
    );
    const userNames = await this.resolveUserNameMap([payload.collectorId]);
    return this.mapReceiptRecord(payload, userNames);
  }

  async updateReceipt(id: string, dto: UpdateReceiptDto, user: AuthUser) {
    const before = await this.prisma.paymentReceipt.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Receipt not found');
    const payload = await this.prisma.paymentReceipt.update({
      where: { id },
      data: {
        ...dto,
        receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : undefined,
        amount: dto.amount ? this.money(dto.amount) : undefined,
        status: dto.status as any,
      },
      include: {
        branch: true,
        customer: true,
        contract: true,
        paymentMethod: true,
      },
    });

    const contractIds = Array.from(
      new Set(
        [before.contractId, payload.contractId].filter((id): id is string =>
          Boolean(id),
        ),
      ),
    );
    await Promise.all(
      contractIds.map((contractId) => this.syncContractBalance(contractId)),
    );

    await this.audit(
      user,
      'receipts',
      AuditAction.UPDATE,
      'receipt',
      id,
      before,
      payload,
    );
    const userNames = await this.resolveUserNameMap([payload.collectorId]);
    return this.mapReceiptRecord(payload, userNames);
  }

  async removeReceipt(id: string, user: AuthUser) {
    const before = await this.prisma.paymentReceipt.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Receipt not found');
    const payload = await this.prisma.paymentReceipt.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    if (before.contractId) {
      await this.syncContractBalance(before.contractId);
    }
    await this.audit(
      user,
      'receipts',
      AuditAction.DELETE,
      'receipt',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listShopReturns(query: QueryDto, user: AuthUser) {
    const where = this.buildExpenseWhere(query, user, {
      expenseType: SHOP_RETURN_TYPE,
    });

    const [data, total] = await Promise.all([
      this.prisma.paymentExpense.findMany({
        where,
        include: { branch: true, paymentMethod: true },
        orderBy: buildSort(query, 'expenseDate'),
        ...buildPagination(query),
      }),
      this.prisma.paymentExpense.count({ where }),
    ]);

    const userNames = await this.resolveUserNameMap(
      data.flatMap((expense) => [expense.approverId, expense.createdUserId]),
    );

    return buildListResponse(
      data.map((expense) => this.mapExpenseRecord(expense, userNames)),
      total,
      query,
    );
  }

  async getShopReturn(id: string, user: AuthUser) {
    const expense = await this.prisma.paymentExpense.findFirst({
      where: {
        id,
        deletedAt: null,
        expenseType: SHOP_RETURN_TYPE,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: { branch: true, paymentMethod: true },
    });

    if (!expense) {
      throw new NotFoundException('Shop return not found');
    }

    const userNames = await this.resolveUserNameMap([
      expense.approverId,
      expense.createdUserId,
    ]);
    return this.mapExpenseRecord(expense, userNames);
  }

  async createShopReturn(dto: CreateShopReturnDto, user: AuthUser) {
    const payload = await this.prisma.$transaction(async (tx) => {
      const lineItems = await this.parseShopLineItems(
        dto.branchId,
        dto.lineItemsText,
      );
      const record = await tx.paymentExpense.create({
        data: {
          branchId: dto.branchId,
          paymentMethodId: dto.paymentMethodId,
          code: dto.code,
          expenseDate: new Date(dto.expenseDate),
          payeeName: dto.payeeName,
          expenseType: SHOP_RETURN_TYPE,
          amount: this.resolveLineItemsAmount(lineItems, dto.amount),
          lineItems: lineItems as unknown as Prisma.InputJsonValue,
          approverId: dto.approverId,
          createdUserId: dto.createdUserId || user.id,
          status: (dto.status as any) || 'COMPLETED',
          note: dto.note,
        },
        include: { branch: true, paymentMethod: true },
      });

      if (record.status === 'COMPLETED' && lineItems.length) {
        await this.adjustProductStock(tx, lineItems, 'increment');
      }

      return record;
    });

    await this.audit(
      user,
      'expenses',
      AuditAction.CREATE,
      'expense',
      payload.id,
      undefined,
      payload,
    );
    const userNames = await this.resolveUserNameMap([
      payload.approverId,
      payload.createdUserId,
    ]);
    return this.mapExpenseRecord(payload, userNames);
  }

  async updateShopReturn(id: string, dto: UpdateShopReturnDto, user: AuthUser) {
    const before = await this.prisma.paymentExpense.findUnique({
      where: { id },
    });
    if (
      !before ||
      before.expenseType !== SHOP_RETURN_TYPE ||
      before.deletedAt
    ) {
      throw new NotFoundException('Shop return not found');
    }

    const beforeLineItems = this.asLineItems(before.lineItems);

    const payload = await this.prisma.$transaction(async (tx) => {
      if (before.status === 'COMPLETED' && beforeLineItems.length) {
        await this.adjustProductStock(tx, beforeLineItems, 'decrement');
      }

      const nextBranchId = dto.branchId || before.branchId;
      const nextLineItems =
        dto.lineItemsText !== undefined
          ? await this.parseShopLineItems(nextBranchId, dto.lineItemsText)
          : beforeLineItems;
      const nextAmount =
        dto.amount !== undefined
          ? this.resolveLineItemsAmount(nextLineItems, dto.amount)
          : dto.lineItemsText !== undefined
            ? this.resolveLineItemsAmount(nextLineItems, undefined)
            : undefined;

      const record = await tx.paymentExpense.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          paymentMethodId: dto.paymentMethodId,
          code: dto.code,
          expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
          payeeName: dto.payeeName,
          expenseType: SHOP_RETURN_TYPE,
          amount: nextAmount,
          lineItems:
            dto.lineItemsText !== undefined
              ? (nextLineItems as unknown as Prisma.InputJsonValue)
              : undefined,
          approverId: dto.approverId,
          createdUserId: dto.createdUserId,
          status: dto.status as any,
          note: dto.note,
        },
        include: { branch: true, paymentMethod: true },
      });

      if (record.status === 'COMPLETED' && nextLineItems.length) {
        await this.adjustProductStock(tx, nextLineItems, 'increment');
      }

      return record;
    });

    await this.audit(
      user,
      'expenses',
      AuditAction.UPDATE,
      'expense',
      id,
      before,
      payload,
    );
    const userNames = await this.resolveUserNameMap([
      payload.approverId,
      payload.createdUserId,
    ]);
    return this.mapExpenseRecord(payload, userNames);
  }

  async removeShopReturn(id: string, user: AuthUser) {
    const before = await this.prisma.paymentExpense.findUnique({
      where: { id },
    });
    if (
      !before ||
      before.expenseType !== SHOP_RETURN_TYPE ||
      before.deletedAt
    ) {
      throw new NotFoundException('Shop return not found');
    }

    const beforeLineItems = this.asLineItems(before.lineItems);

    const payload = await this.prisma.$transaction(async (tx) => {
      if (before.status === 'COMPLETED' && beforeLineItems.length) {
        await this.adjustProductStock(tx, beforeLineItems, 'decrement');
      }

      return tx.paymentExpense.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    await this.audit(
      user,
      'expenses',
      AuditAction.DELETE,
      'expense',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listExpenses(query: QueryDto, user: AuthUser) {
    const where = this.buildExpenseWhere(query, user, {
      NOT: { expenseType: SHOP_RETURN_TYPE },
    });

    const [data, total] = await Promise.all([
      this.prisma.paymentExpense.findMany({
        where,
        include: { branch: true, paymentMethod: true },
        orderBy: buildSort(query, 'expenseDate'),
        ...buildPagination(query),
      }),
      this.prisma.paymentExpense.count({ where }),
    ]);

    const userNames = await this.resolveUserNameMap(
      data.flatMap((expense) => [expense.approverId, expense.createdUserId]),
    );

    return buildListResponse(
      data.map((expense) => this.mapExpenseRecord(expense, userNames)),
      total,
      query,
    );
  }

  async getExpense(id: string, user: AuthUser) {
    const expense = await this.prisma.paymentExpense.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: { branch: true, paymentMethod: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    const userNames = await this.resolveUserNameMap([
      expense.approverId,
      expense.createdUserId,
    ]);
    return this.mapExpenseRecord(expense, userNames);
  }

  async createExpense(dto: CreateExpenseDto, user: AuthUser) {
    const payload = await this.prisma.paymentExpense.create({
      data: {
        ...dto,
        expenseDate: new Date(dto.expenseDate),
        amount: this.money(dto.amount),
        createdUserId: dto.createdUserId || user.id,
        status: (dto.status as any) || 'COMPLETED',
      },
      include: { branch: true, paymentMethod: true },
    });
    await this.audit(
      user,
      'expenses',
      AuditAction.CREATE,
      'expense',
      payload.id,
      undefined,
      payload,
    );
    const userNames = await this.resolveUserNameMap([
      payload.approverId,
      payload.createdUserId,
    ]);
    return this.mapExpenseRecord(payload, userNames);
  }

  async updateExpense(id: string, dto: UpdateExpenseDto, user: AuthUser) {
    const before = await this.prisma.paymentExpense.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Expense not found');
    const payload = await this.prisma.paymentExpense.update({
      where: { id },
      data: {
        ...dto,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        amount: dto.amount ? this.money(dto.amount) : undefined,
        status: dto.status as any,
      },
      include: { branch: true, paymentMethod: true },
    });
    await this.audit(
      user,
      'expenses',
      AuditAction.UPDATE,
      'expense',
      id,
      before,
      payload,
    );
    const userNames = await this.resolveUserNameMap([
      payload.approverId,
      payload.createdUserId,
    ]);
    return this.mapExpenseRecord(payload, userNames);
  }

  async removeExpense(id: string, user: AuthUser) {
    const before = await this.prisma.paymentExpense.findUnique({
      where: { id },
    });
    if (!before) throw new NotFoundException('Expense not found');
    const payload = await this.prisma.paymentExpense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'expenses',
      AuditAction.DELETE,
      'expense',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listLockers(query: QueryDto, user: AuthUser) {
    const where: Prisma.LockerWhereInput = {
      deletedAt: null,
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { label: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.locker.findMany({
        where,
        include: {
          branch: true,
          rentals: {
            where: { deletedAt: null },
            include: {
              customer: {
                select: {
                  code: true,
                  fullName: true,
                },
              },
            },
            orderBy: [{ endDate: 'desc' }],
          },
          _count: {
            select: {
              rentals: true,
            },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.locker.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapLockerRecord(item)),
      total,
      query,
    );
  }

  async getLocker(id: string, user: AuthUser) {
    const payload = await this.prisma.locker.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        rentals: {
          where: { deletedAt: null },
          include: {
            customer: {
              select: {
                code: true,
                fullName: true,
              },
            },
          },
          orderBy: [{ endDate: 'desc' }],
          take: 10,
        },
        _count: {
          select: {
            rentals: true,
          },
        },
      },
    });

    if (!payload) {
      throw new NotFoundException('Locker not found');
    }

    return this.mapLockerRecord(payload);
  }

  async createLocker(dto: CreateLockerDto, user: AuthUser) {
    const payload = await this.prisma.locker.create({
      data: {
        ...dto,
        price: this.money(dto.price),
        status: (dto.status as any) || 'EMPTY',
      },
      include: {
        branch: true,
        rentals: {
          where: { deletedAt: null },
          include: {
            customer: {
              select: {
                code: true,
                fullName: true,
              },
            },
          },
        },
        _count: {
          select: {
            rentals: true,
          },
        },
      },
    });
    await this.audit(
      user,
      'lockers',
      AuditAction.CREATE,
      'locker',
      payload.id,
      undefined,
      payload,
    );
    return this.mapLockerRecord(payload);
  }

  async updateLocker(id: string, dto: UpdateLockerDto, user: AuthUser) {
    const before = await this.prisma.locker.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Locker not found');
    const payload = await this.prisma.locker.update({
      where: { id },
      data: {
        ...dto,
        price: dto.price ? this.money(dto.price) : undefined,
        status: dto.status as any,
      },
      include: {
        branch: true,
        rentals: {
          where: { deletedAt: null },
          include: {
            customer: {
              select: {
                code: true,
                fullName: true,
              },
            },
          },
        },
        _count: {
          select: {
            rentals: true,
          },
        },
      },
    });
    await this.audit(
      user,
      'lockers',
      AuditAction.UPDATE,
      'locker',
      id,
      before,
      payload,
    );
    return this.mapLockerRecord(payload);
  }

  async removeLocker(id: string, user: AuthUser) {
    const before = await this.prisma.locker.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Locker not found');
    const payload = await this.prisma.locker.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'lockers',
      AuditAction.DELETE,
      'locker',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listDeposits(query: QueryDto, user: AuthUser) {
    const where: Prisma.DepositWhereInput = {
      deletedAt: null,
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { itemType: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...buildDateRange('receivedAt', query),
    };

    const [data, total] = await Promise.all([
      this.prisma.deposit.findMany({
        where,
        include: { branch: true, customer: true, lockerRental: true },
        orderBy: buildSort(query, 'receivedAt'),
        ...buildPagination(query),
      }),
      this.prisma.deposit.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapDepositRecord(item)),
      total,
      query,
    );
  }

  async getDeposit(id: string, user: AuthUser) {
    const payload = await this.prisma.deposit.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        customer: true,
        lockerRental: true,
      },
    });

    if (!payload) {
      throw new NotFoundException('Deposit not found');
    }

    return this.mapDepositRecord(payload);
  }

  async createDeposit(dto: CreateDepositDto, user: AuthUser) {
    const payload = await this.prisma.deposit.create({
      data: {
        ...dto,
        amount: this.money(dto.amount),
        receivedAt: new Date(dto.receivedAt),
        returnedAt: dto.returnedAt ? new Date(dto.returnedAt) : undefined,
        status: (dto.status as any) || 'HOLDING',
      },
      include: { branch: true, customer: true, lockerRental: true },
    });
    await this.audit(
      user,
      'deposits',
      AuditAction.CREATE,
      'deposit',
      payload.id,
      undefined,
      payload,
    );
    return this.mapDepositRecord(payload);
  }

  async updateDeposit(id: string, dto: UpdateDepositDto, user: AuthUser) {
    const before = await this.prisma.deposit.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Deposit not found');
    const payload = await this.prisma.deposit.update({
      where: { id },
      data: {
        ...dto,
        amount: dto.amount ? this.money(dto.amount) : undefined,
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
        returnedAt: dto.returnedAt ? new Date(dto.returnedAt) : undefined,
        status: dto.status as any,
      },
      include: { branch: true, customer: true, lockerRental: true },
    });
    await this.audit(
      user,
      'deposits',
      AuditAction.UPDATE,
      'deposit',
      id,
      before,
      payload,
    );
    return this.mapDepositRecord(payload);
  }

  async removeDeposit(id: string, user: AuthUser) {
    const before = await this.prisma.deposit.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Deposit not found');
    const payload = await this.prisma.deposit.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'deposits',
      AuditAction.DELETE,
      'deposit',
      id,
      before,
      payload,
    );
    return payload;
  }
}
