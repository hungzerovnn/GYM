import { Injectable, NotFoundException } from '@nestjs/common';
import {
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';
import { Prisma } from '@prisma/client';
import { QueryDto } from '../../common/dto/query.dto';
import { AuthUser } from '../../common/types/auth-user.type';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private isGlobal(user: AuthUser) {
    return user.roleCodes.some((roleCode) =>
      ['super_admin', 'system_owner'].includes(roleCode),
    );
  }

  private branchScope(query: QueryDto, user: AuthUser) {
    if (!this.isGlobal(user) && user.branchId) {
      return user.branchId;
    }
    return query.branchId;
  }

  private notificationScope(
    query: QueryDto,
    user: AuthUser,
  ): Prisma.NotificationWhereInput {
    if (this.isGlobal(user)) {
      return {};
    }

    const branchId = this.branchScope(query, user);

    return {
      OR: [
        { userId: user.id },
        {
          userId: null,
          ...(branchId ? { branchId } : {}),
        },
      ],
    };
  }

  async summary(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const rangeStart = query.dateFrom ? new Date(query.dateFrom) : monthStart;
    const rangeEnd = query.dateTo ? new Date(query.dateTo) : monthEnd;

    const [
      activeMembers,
      activeContracts,
      revenueToday,
      revenueMonth,
      leads,
      convertedLeads,
      expiringContracts,
      lowRemainingContracts,
      customers,
    ] = await Promise.all([
      this.prisma.customer.count({
        where: {
          deletedAt: null,
          membershipStatus: 'ACTIVE',
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.contract.count({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.paymentReceipt.aggregate({
        where: {
          deletedAt: null,
          receiptDate: { gte: todayStart, lte: todayEnd },
          ...(branchId ? { branchId } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.paymentReceipt.aggregate({
        where: {
          deletedAt: null,
          receiptDate: { gte: monthStart, lte: monthEnd },
          ...(branchId ? { branchId } : {}),
        },
        _sum: { amount: true },
      }),
      this.prisma.lead.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: rangeStart, lte: rangeEnd },
          ...(branchId ? { branchId } : {}),
        },
        include: { source: true, assignedTo: true, branch: true },
      }),
      this.prisma.lead.count({
        where: {
          deletedAt: null,
          status: 'CONVERTED',
          convertedAt: { gte: rangeStart, lte: rangeEnd },
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.contract.count({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          endDate: { gte: new Date(), lte: subDays(new Date(), -7) },
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.contract.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          remainingSessions: { lte: 3 },
          ...(branchId ? { branchId } : {}),
        },
        include: { customer: true, trainer: true },
      }),
      this.prisma.customer.findMany({
        where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      }),
    ]);

    const receipts = await this.prisma.paymentReceipt.findMany({
      where: {
        deletedAt: null,
        receiptDate: { gte: rangeStart, lte: rangeEnd },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        contract: true,
      },
    });

    const contracts = await this.prisma.contract.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: {
        saleUser: true,
      },
    });

    const auditLogs = await this.prisma.auditLog.findMany({
      where: { ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const revenueByBranch = Object.values(
      receipts.reduce<Record<string, { branch: string; revenue: number }>>(
        (acc, receipt) => {
          const key = receipt.branch?.name || 'Unknown';
          acc[key] ||= { branch: key, revenue: 0 };
          acc[key].revenue += Number(receipt.amount);
          return acc;
        },
        {},
      ),
    );

    const revenueByService = Object.values(
      receipts.reduce<Record<string, { name: string; revenue: number }>>(
        (acc, receipt) => {
          const key = receipt.contract?.packageName || 'Other';
          acc[key] ||= { name: key, revenue: 0 };
          acc[key].revenue += Number(receipt.amount);
          return acc;
        },
        {},
      ),
    );

    const topSales = Object.values(
      contracts.reduce<
        Record<string, { name: string; contracts: number; revenue: number }>
      >((acc, contract) => {
        const key = contract.saleUser?.fullName || 'Unassigned';
        acc[key] ||= { name: key, contracts: 0, revenue: 0 };
        acc[key].contracts += 1;
        acc[key].revenue += Number(contract.totalAmount);
        return acc;
      }, {}),
    )
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const newMembersTrend = Array.from({ length: 7 }, (_, index) => {
      const day = subDays(new Date(), 6 - index);
      const label = format(day, 'dd/MM');
      const count = customers.filter(
        (customer) =>
          format(customer.createdAt, 'yyyy-MM-dd') ===
          format(day, 'yyyy-MM-dd'),
      ).length;
      return { label, count };
    });

    const leadBySource = Object.values(
      leads.reduce<Record<string, { source: string; total: number }>>(
        (acc, lead) => {
          const key = lead.source?.name || 'Unknown';
          acc[key] ||= { source: key, total: 0 };
          acc[key].total += 1;
          return acc;
        },
        {},
      ),
    );

    const actionItems = [
      { label: 'Contracts expiring in 7 days', value: expiringContracts },
      {
        label: 'PT packages with low remaining sessions',
        value: lowRemainingContracts.length,
      },
      {
        label: 'Outstanding debt to collect',
        value: customers.reduce(
          (sum, customer) => sum + Number(customer.outstandingDebt),
          0,
        ),
      },
    ];

    return {
      stats: {
        activeMembers,
        activeContracts,
        revenueToday: Number(revenueToday._sum.amount || 0),
        revenueMonth: Number(revenueMonth._sum.amount || 0),
        newLeads: leads.length,
        convertedLeads,
        expiringContracts,
        lowRemainingSessions: lowRemainingContracts.length,
        outstandingDebt: customers.reduce(
          (sum, customer) => sum + Number(customer.outstandingDebt),
          0,
        ),
      },
      topSales,
      revenueByBranch,
      revenueByService,
      newMembersTrend,
      leadBySource,
      recentActivities: auditLogs,
      actionItems,
    };
  }

  async notifications(query: QueryDto, user: AuthUser) {
    const where: Prisma.NotificationWhereInput = {
      AND: [
        this.notificationScope(query, user),
        ...(query.search
          ? [
              {
                OR: [
                  {
                    title: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    content: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
      ...(query.status === 'UNREAD'
        ? { isRead: false }
        : query.status === 'READ'
          ? { isRead: true }
          : {}),
    };

    const [data, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.pageSize || 8,
        skip: ((query.page || 1) - 1) * (query.pageSize || 8),
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          ...this.notificationScope(query, user),
          isRead: false,
        },
      }),
    ]);

    return {
      data,
      unread,
      pagination: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async markNotificationRead(id: string, user: AuthUser) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        ...this.notificationScope({ page: 1, pageSize: 10 } as QueryDto, user),
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }
}
