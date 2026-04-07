import {
  BadRequestException,
  ForbiddenException,
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
  CreateProductDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  UpdateProductDto,
  UpdatePurchaseOrderDto,
  UpdateSupplierDto,
} from './inventory.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private isGlobal(user: AuthUser) {
    return user.roleCodes.some((roleCode) =>
      ['super_admin', 'system_owner'].includes(roleCode),
    );
  }

  private assertBranchAccess(
    branchId: string | null | undefined,
    user: AuthUser,
  ) {
    if (!branchId) {
      return;
    }

    if (!this.isGlobal(user) && user.branchId && branchId !== user.branchId) {
      throw new ForbiddenException(
        'Ban chi duoc thao tac du lieu thuoc chi nhanh cua minh',
      );
    }
  }

  private money(value?: string | null) {
    return value ? new Prisma.Decimal(value) : undefined;
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

  private mapProductRecord(product: any) {
    const recentPurchaseItems = Array.isArray(product.purchaseItems)
      ? product.purchaseItems.map((item: any) => ({
          id: item.id,
          purchaseOrderId: item.purchaseOrderId,
          purchaseOrderCode: item.purchaseOrder?.code || '',
          supplierName: item.purchaseOrder?.supplier?.name || '',
          orderDate: item.purchaseOrder?.orderDate?.toISOString() || '',
          orderDateTime: item.purchaseOrder?.orderDate?.toISOString() || '',
          status: item.purchaseOrder?.status || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }))
      : undefined;

    const purchaseOrderIds = new Set(
      recentPurchaseItems
        ?.map((item) => item.purchaseOrderId)
        .filter(Boolean) || [],
    );
    const stockQuantity = Number(product.stockQuantity || 0);
    const minStockQuantity = Number(product.minStockQuantity || 0);
    const stockAlertLabel =
      stockQuantity <= 0
        ? 'Het hang'
        : minStockQuantity > 0 && stockQuantity <= minStockQuantity
          ? 'Sap het hang'
          : 'Ton on dinh';

    return {
      id: product.id,
      branchId: product.branchId,
      branchName: product.branch?.name || '',
      categoryId: product.categoryId || '',
      categoryName: product.category?.name || '',
      code: product.code,
      name: product.name,
      unit: product.unit,
      groupName: product.groupName || '',
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      stockQuantity,
      minStockQuantity,
      stockAlertLabel,
      stockValue: Number(product.purchasePrice || 0) * stockQuantity,
      purchaseItemCount:
        product._count?.purchaseItems ?? recentPurchaseItems?.length ?? 0,
      purchaseOrderCount: purchaseOrderIds.size,
      lastPurchaseDate: recentPurchaseItems?.[0]?.orderDate || '',
      recentPurchaseItems,
      status: product.status,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      createdDateTime: product.createdAt.toISOString(),
      updatedDateTime: product.updatedAt.toISOString(),
    };
  }

  private mapSupplierRecord(
    supplier: any,
    userNames: Map<string, string> = new Map(),
  ) {
    const purchaseOrders = Array.isArray(supplier.purchaseOrders)
      ? supplier.purchaseOrders.map((order: any) => ({
          id: order.id,
          code: order.code,
          orderDate: order.orderDate.toISOString(),
          expectedDate: order.expectedDate?.toISOString() || '',
          status: order.status,
          totalAmount: order.totalAmount,
          createdUserName: userNames.get(order.createdUserId || '') || '',
          itemCount: Array.isArray(order.items)
            ? order.items.length
            : (order._count?.items ?? 0),
          totalQuantity: Array.isArray(order.items)
            ? order.items.reduce(
                (sum: number, item: any) => sum + Number(item.quantity || 0),
                0,
              )
            : 0,
          productSummary: Array.isArray(order.items)
            ? order.items
                .map(
                  (item: any) => item.product?.name || item.product?.code || '',
                )
                .filter(Boolean)
                .slice(0, 3)
                .join(', ')
            : '',
        }))
      : undefined;

    return {
      id: supplier.id,
      branchId: supplier.branchId,
      branchName: supplier.branch?.name || '',
      code: supplier.code,
      name: supplier.name,
      contactName: supplier.contactName || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      note: supplier.note || '',
      purchaseOrderCount:
        purchaseOrders?.length ?? supplier._count?.purchaseOrders ?? 0,
      completedPurchaseOrderCount:
        purchaseOrders?.filter((item) => item.status === 'COMPLETED').length ??
        0,
      totalPurchaseAmount:
        purchaseOrders?.reduce(
          (sum, item) => sum + Number(item.totalAmount || 0),
          0,
        ) ?? 0,
      lastOrderDate: purchaseOrders?.[0]?.orderDate || '',
      purchaseOrders,
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
      createdDateTime: supplier.createdAt.toISOString(),
      updatedDateTime: supplier.updatedAt.toISOString(),
    };
  }

  private mapPurchaseOrderRecord(
    order: any,
    userNames: Map<string, string> = new Map(),
  ) {
    const items = Array.isArray(order.items)
      ? order.items.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          productCode: item.product?.code || '',
          productName: item.product?.name || '',
          unit: item.product?.unit || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }))
      : undefined;

    return {
      id: order.id,
      branchId: order.branchId,
      branchName: order.branch?.name || '',
      supplierId: order.supplierId,
      supplierCode: order.supplier?.code || '',
      supplierName: order.supplier?.name || '',
      supplierContactName: order.supplier?.contactName || '',
      supplierPhone: order.supplier?.phone || '',
      code: order.code,
      orderDate: order.orderDate.toISOString(),
      orderDateTime: order.orderDate.toISOString(),
      expectedDate: order.expectedDate?.toISOString() || '',
      expectedDateTime: order.expectedDate?.toISOString() || '',
      totalAmount: order.totalAmount,
      status: order.status,
      createdUserId: order.createdUserId || '',
      createdUserName: userNames.get(order.createdUserId || '') || '',
      note: order.note || '',
      itemCount: items?.length ?? 0,
      totalQuantity:
        items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) ?? 0,
      productSummary:
        items
          ?.map((item) => item.productName || item.productCode)
          .filter(Boolean)
          .slice(0, 3)
          .join(', ') || '',
      items,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      createdDateTime: order.createdAt.toISOString(),
      updatedDateTime: order.updatedAt.toISOString(),
    };
  }

  private buildPurchaseOrderItems(
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: string | Prisma.Decimal;
      totalPrice?: string | Prisma.Decimal | null;
    }>,
  ) {
    return items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: this.money(String(item.unitPrice)) || new Prisma.Decimal(0),
      totalPrice:
        this.money(
          item.totalPrice !== undefined && item.totalPrice !== null
            ? String(item.totalPrice)
            : null,
        ) || new Prisma.Decimal(Number(item.unitPrice) * item.quantity),
    }));
  }

  private calculatePurchaseOrderAmount(
    items: Array<{
      quantity: number;
      unitPrice: string | Prisma.Decimal;
      totalPrice?: string | Prisma.Decimal | null;
    }>,
    explicitAmount?: string | null,
  ) {
    if (
      explicitAmount !== undefined &&
      explicitAmount !== null &&
      explicitAmount !== ''
    ) {
      return this.money(explicitAmount) || new Prisma.Decimal(0);
    }

    return new Prisma.Decimal(
      items.reduce(
        (sum, item) =>
          sum +
          Number(
            item.totalPrice !== undefined &&
              item.totalPrice !== null &&
              item.totalPrice !== ''
              ? item.totalPrice
              : Number(item.unitPrice) * item.quantity,
          ),
        0,
      ),
    );
  }

  private async validatePurchaseOrderReferences(
    tx: Prisma.TransactionClient,
    input: {
      branchId: string;
      supplierId: string;
      items: Array<{
        productId: string;
        quantity: number;
        unitPrice: string | Prisma.Decimal;
        totalPrice?: string | Prisma.Decimal | null;
      }>;
    },
  ) {
    const supplier = await tx.supplier.findUnique({
      where: { id: input.supplierId },
      select: { id: true, branchId: true, deletedAt: true },
    });

    if (!supplier || supplier.deletedAt) {
      throw new NotFoundException('Supplier not found');
    }

    if (supplier.branchId !== input.branchId) {
      throw new BadRequestException(
        'Nha cung cap khong thuoc chi nhanh da chon',
      );
    }

    const productIds = Array.from(
      new Set(input.items.map((item) => item.productId).filter(Boolean)),
    );
    if (!productIds.length) {
      return;
    }

    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        deletedAt: null,
      },
      select: {
        id: true,
        branchId: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('Product not found');
    }

    const invalidProduct = products.find(
      (item) => item.branchId !== input.branchId,
    );
    if (invalidProduct) {
      throw new BadRequestException('San pham khong thuoc chi nhanh da chon');
    }
  }

  private async syncPurchaseOrderStock(
    tx: Prisma.TransactionClient,
    items: Array<{ productId: string; quantity: number }>,
    direction: 1 | -1,
  ) {
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: {
            increment: direction * item.quantity,
          },
        },
      });
    }
  }

  async listProducts(query: QueryDto, user: AuthUser) {
    const where: Prisma.ProductWhereInput = {
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
              { groupName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          branch: true,
          category: true,
          purchaseItems: {
            include: {
              purchaseOrder: {
                select: {
                  id: true,
                  code: true,
                  orderDate: true,
                  status: true,
                  supplier: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ createdAt: 'desc' }],
            take: 5,
          },
          _count: {
            select: {
              purchaseItems: true,
            },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.product.count({ where }),
    ]);

    return buildListResponse(
      data.map((item) => this.mapProductRecord(item)),
      total,
      query,
    );
  }

  async getProduct(id: string, user: AuthUser) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        category: true,
        purchaseItems: {
          include: {
            purchaseOrder: {
              select: {
                id: true,
                code: true,
                orderDate: true,
                status: true,
                supplier: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 12,
        },
        _count: {
          select: {
            purchaseItems: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProductRecord(product);
  }

  async createProduct(dto: CreateProductDto, user: AuthUser) {
    this.assertBranchAccess(dto.branchId, user);
    const payload = await this.prisma.product.create({
      data: {
        ...dto,
        purchasePrice: this.money(dto.purchasePrice),
        salePrice: this.money(dto.salePrice),
        status: (dto.status as any) || 'ACTIVE',
      },
      include: { branch: true, category: true },
    });
    await this.audit(
      user,
      'products',
      AuditAction.CREATE,
      'product',
      payload.id,
      undefined,
      payload,
    );
    return this.getProduct(payload.id, user);
  }

  async updateProduct(id: string, dto: UpdateProductDto, user: AuthUser) {
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Product not found');
    this.assertBranchAccess(dto.branchId || before.branchId, user);
    const payload = await this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        purchasePrice: dto.purchasePrice
          ? this.money(dto.purchasePrice)
          : undefined,
        salePrice: dto.salePrice ? this.money(dto.salePrice) : undefined,
        status: dto.status as any,
      },
      include: { branch: true, category: true },
    });
    await this.audit(
      user,
      'products',
      AuditAction.UPDATE,
      'product',
      id,
      before,
      payload,
    );
    return this.getProduct(id, user);
  }

  async removeProduct(id: string, user: AuthUser) {
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Product not found');
    this.assertBranchAccess(before.branchId, user);
    const payload = await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'products',
      AuditAction.DELETE,
      'product',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listSuppliers(query: QueryDto, user: AuthUser) {
    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      ...(!this.isGlobal(user) && user.branchId
        ? { branchId: user.branchId }
        : query.branchId
          ? { branchId: query.branchId }
          : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { contactName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        include: {
          branch: true,
          purchaseOrders: {
            where: { deletedAt: null },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ orderDate: 'desc' }],
          },
          _count: {
            select: {
              purchaseOrders: true,
            },
          },
        },
        orderBy: buildSort(query),
        ...buildPagination(query),
      }),
      this.prisma.supplier.count({ where }),
    ]);

    const userNames = await this.resolveUserNameMap(
      data.flatMap((supplier) =>
        supplier.purchaseOrders.map((order) => order.createdUserId),
      ),
    );

    return buildListResponse(
      data.map((item) => this.mapSupplierRecord(item, userNames)),
      total,
      query,
    );
  }

  async getSupplier(id: string, user: AuthUser) {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        purchaseOrders: {
          where: { deletedAt: null },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: [{ orderDate: 'desc' }],
        },
        _count: {
          select: {
            purchaseOrders: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    const userNames = await this.resolveUserNameMap(
      supplier.purchaseOrders.map((order) => order.createdUserId),
    );
    return this.mapSupplierRecord(supplier, userNames);
  }

  async createSupplier(dto: CreateSupplierDto, user: AuthUser) {
    this.assertBranchAccess(dto.branchId, user);
    const payload = await this.prisma.supplier.create({
      data: dto,
      include: { branch: true },
    });
    await this.audit(
      user,
      'suppliers',
      AuditAction.CREATE,
      'supplier',
      payload.id,
      undefined,
      payload,
    );
    return this.getSupplier(payload.id, user);
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto, user: AuthUser) {
    const before = await this.prisma.supplier.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Supplier not found');
    this.assertBranchAccess(dto.branchId || before.branchId, user);
    const payload = await this.prisma.supplier.update({
      where: { id },
      data: dto,
      include: { branch: true },
    });
    await this.audit(
      user,
      'suppliers',
      AuditAction.UPDATE,
      'supplier',
      id,
      before,
      payload,
    );
    return this.getSupplier(id, user);
  }

  async removeSupplier(id: string, user: AuthUser) {
    const before = await this.prisma.supplier.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Supplier not found');
    this.assertBranchAccess(before.branchId, user);
    const payload = await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(
      user,
      'suppliers',
      AuditAction.DELETE,
      'supplier',
      id,
      before,
      payload,
    );
    return payload;
  }

  async listPurchaseOrders(query: QueryDto, user: AuthUser) {
    const where: Prisma.PurchaseOrderWhereInput = {
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
              {
                supplier: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      ...buildDateRange('orderDate', query),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          branch: true,
          supplier: true,
          items: { include: { product: true } },
        },
        orderBy: buildSort(query, 'orderDate'),
        ...buildPagination(query),
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    const userNames = await this.resolveUserNameMap(
      data.map((item) => item.createdUserId),
    );

    return buildListResponse(
      data.map((item) => this.mapPurchaseOrderRecord(item, userNames)),
      total,
      query,
    );
  }

  async getPurchaseOrder(id: string, user: AuthUser) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(!this.isGlobal(user) && user.branchId
          ? { branchId: user.branchId }
          : {}),
      },
      include: {
        branch: true,
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Purchase order not found');
    }

    const userNames = await this.resolveUserNameMap([order.createdUserId]);
    return this.mapPurchaseOrderRecord(order, userNames);
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, user: AuthUser) {
    this.assertBranchAccess(dto.branchId, user);
    const payload = await this.prisma.$transaction(async (tx) => {
      const items = dto.items || [];
      await this.validatePurchaseOrderReferences(tx, {
        branchId: dto.branchId,
        supplierId: dto.supplierId,
        items,
      });

      const order = await tx.purchaseOrder.create({
        data: {
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          code: dto.code,
          orderDate: new Date(dto.orderDate),
          expectedDate: dto.expectedDate
            ? new Date(dto.expectedDate)
            : undefined,
          totalAmount: this.calculatePurchaseOrderAmount(
            items,
            dto.totalAmount,
          ),
          status: (dto.status as any) || 'DRAFT',
          createdUserId: dto.createdUserId || user.id,
          note: dto.note,
          items: items.length
            ? {
                create: this.buildPurchaseOrderItems(items),
              }
            : undefined,
        },
        include: {
          branch: true,
          supplier: true,
          items: { include: { product: true } },
        },
      });

      if (order.status === 'COMPLETED') {
        await this.syncPurchaseOrderStock(tx, items, 1);
      }

      return order;
    });

    await this.audit(
      user,
      'purchase-orders',
      AuditAction.CREATE,
      'purchase_order',
      payload.id,
      undefined,
      payload,
    );
    return this.getPurchaseOrder(payload.id, user);
  }

  async updatePurchaseOrder(
    id: string,
    dto: UpdatePurchaseOrderDto,
    user: AuthUser,
  ) {
    const before = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!before) throw new NotFoundException('Purchase order not found');
    this.assertBranchAccess(before.branchId, user);

    const payload = await this.prisma.$transaction(async (tx) => {
      const nextBranchId = dto.branchId || before.branchId;
      const nextSupplierId = dto.supplierId || before.supplierId;
      const nextItems = dto.items || before.items;
      const nextStatus = (dto.status as any) || before.status;

      this.assertBranchAccess(nextBranchId, user);
      await this.validatePurchaseOrderReferences(tx, {
        branchId: nextBranchId,
        supplierId: nextSupplierId,
        items: nextItems,
      });

      if (before.status === 'COMPLETED') {
        await this.syncPurchaseOrderStock(tx, before.items, -1);
      }

      if (dto.items) {
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });
      }

      const order = await tx.purchaseOrder.update({
        where: { id },
        data: {
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          code: dto.code,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
          expectedDate: dto.expectedDate
            ? new Date(dto.expectedDate)
            : undefined,
          totalAmount:
            dto.totalAmount !== undefined || dto.items
              ? this.calculatePurchaseOrderAmount(nextItems, dto.totalAmount)
              : undefined,
          status: dto.status as any,
          createdUserId: dto.createdUserId,
          note: dto.note,
          items: dto.items?.length
            ? {
                create: this.buildPurchaseOrderItems(dto.items),
              }
            : undefined,
        },
        include: {
          branch: true,
          supplier: true,
          items: { include: { product: true } },
        },
      });

      if (nextStatus === 'COMPLETED') {
        await this.syncPurchaseOrderStock(tx, nextItems, 1);
      }

      return order;
    });

    await this.audit(
      user,
      'purchase-orders',
      AuditAction.UPDATE,
      'purchase_order',
      id,
      before,
      payload,
    );
    return this.getPurchaseOrder(id, user);
  }

  async removePurchaseOrder(id: string, user: AuthUser) {
    const before = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!before) throw new NotFoundException('Purchase order not found');
    this.assertBranchAccess(before.branchId, user);
    const payload = await this.prisma.$transaction(async (tx) => {
      if (before.status === 'COMPLETED') {
        await this.syncPurchaseOrderStock(tx, before.items, -1);
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'CANCELLED',
        },
      });
    });
    await this.audit(
      user,
      'purchase-orders',
      AuditAction.DELETE,
      'purchase_order',
      id,
      before,
      payload,
    );
    return payload;
  }
}
