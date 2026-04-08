import { Injectable } from '@nestjs/common';
import { AuditAction, PrismaClient } from '@prisma/client';
import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  endOfDay,
  endOfWeek,
  isWithinInterval,
  startOfDay,
} from 'date-fns';
import { QueryDto } from '../../common/dto/query.dto';
import { AuthUser } from '../../common/types/auth-user.type';
import { resolveShiftForDate, summarizeShiftAttendance } from '../../common/utils/staff-shift.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ExportService } from './export.service';

const attendanceDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exportService: ExportService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private isGlobal(user: AuthUser) {
    return user.roleCodes.some((roleCode) =>
      ['super_admin', 'system_owner'].includes(roleCode),
    );
  }

  private branchScope(query: QueryDto, user: AuthUser) {
    return !this.isGlobal(user) && user.branchId
      ? user.branchId
      : query.branchId;
  }

  private range(query: QueryDto) {
    return {
      from: query.dateFrom
        ? startOfDay(new Date(query.dateFrom))
        : startOfDay(addDays(new Date(), -90)),
      to: query.dateTo
        ? endOfDay(new Date(query.dateTo))
        : endOfDay(new Date()),
    };
  }

  private toNumber(value: unknown) {
    return Number(value || 0);
  }

  private percent(part: number, total: number) {
    return total ? Math.round((part / total) * 100) : 0;
  }

  private sum<T>(items: T[], selector: (item: T) => number) {
    return items.reduce((sum, item) => sum + selector(item), 0);
  }

  private uniqueCount<T>(
    items: T[],
    selector: (item: T) => string | null | undefined,
  ) {
    return new Set(
      items.map(selector).filter((value): value is string => Boolean(value)),
    ).size;
  }

  private branchName(branch?: { name?: string | null } | null) {
    return branch?.name || 'Unknown';
  }

  private primaryRole(roleCodes: string[]) {
    const roleLabels: Record<string, string> = {
      super_admin: 'Super Admin',
      system_owner: 'Chu he thong',
      branch_manager: 'Quan ly chi nhanh',
      sales: 'Sales',
      accountant: 'Ke toan',
      trainer: 'PT',
      customer_care: 'CSKH',
      hr: 'Nhan su',
    };
    const ordered = [
      'branch_manager',
      'sales',
      'accountant',
      'customer_care',
      'trainer',
      'hr',
      'system_owner',
      'super_admin',
    ];
    const selected =
      ordered.find((roleCode) => roleCodes.includes(roleCode)) || roleCodes[0];
    return roleLabels[selected] || selected || 'Unknown';
  }

  private collectionStatus(amountDue: number, daysToExpire: number) {
    if (!amountDue) return 'CLEARED';
    if (daysToExpire < 0) return 'OVERDUE';
    if (daysToExpire <= 7) return 'DUE_SOON';
    return 'OPEN';
  }

  private collectionPriority(amountDue: number, daysToExpire: number) {
    if (!amountDue) return 'NORMAL';
    if (amountDue >= 5_000_000 || daysToExpire < 0) return 'HIGH';
    if (amountDue >= 1_000_000 || daysToExpire <= 7) return 'MEDIUM';
    return 'NORMAL';
  }

  private attendanceRange(query: QueryDto) {
    return {
      from: query.dateFrom
        ? startOfDay(new Date(query.dateFrom))
        : startOfDay(addDays(new Date(), -14)),
      to: query.dateTo
        ? endOfDay(new Date(query.dateTo))
        : endOfDay(new Date()),
    };
  }

  private attendanceDateKey(value: Date) {
    const parts = attendanceDateFormatter.formatToParts(value);
    const year = parts.find((part) => part.type === 'year')?.value || '0000';
    const month = parts.find((part) => part.type === 'month')?.value || '01';
    const day = parts.find((part) => part.type === 'day')?.value || '01';
    return `${year}-${month}-${day}`;
  }

  private clockLabel(minutes: number) {
    const hours = Math.floor(minutes / 60)
      .toString()
      .padStart(2, '0');
    const mins = Math.max(0, minutes % 60)
      .toString()
      .padStart(2, '0');
    return `${hours}:${mins}`;
  }

  private attendanceMoment(dateKey: string, minutes: number) {
    return new Date(`${dateKey}T${this.clockLabel(minutes)}:00+07:00`);
  }

  private staffShift(roleCodes: string[]) {
    if (roleCodes.includes('trainer')) {
      return {
        code: 'PT-MORNING',
        name: 'Ca PT sang',
        startTime: '06:00',
        endTime: '14:00',
        isOvernight: false,
      };
    }

    if (roleCodes.includes('customer_care')) {
      return {
        code: 'CSKH-DAY',
        name: 'Ca CSKH',
        startTime: '09:00',
        endTime: '18:00',
        isOvernight: false,
      };
    }

    return {
      code: 'DEFAULT-DAY',
      name: 'Ca hanh chinh',
      startTime: '08:00',
      endTime: '17:30',
      isOvernight: false,
    };
  }

  async export(
    title: string,
    format: string,
    rows: Record<string, unknown>[],
    user: AuthUser,
    module: string,
  ) {
    await this.auditLogsService.write({
      module,
      action: AuditAction.EXPORT,
      userId: user.id,
      branchId: user.branchId,
      entityType: 'report',
      entityId: title,
      metadata: { format, rowCount: rows.length },
    });

    if (format === 'xlsx') {
      return this.exportService.toXlsx(title, rows);
    }
    if (format === 'pdf') {
      return this.exportService.toPdf(title, rows);
    }
    return this.exportService.toCsv(title, rows);
  }

  async kpi(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: {
        roles: { include: { role: true } },
        contractsSold: {
          where: { createdAt: { gte: from, lte: to }, deletedAt: null },
        },
        leadsAssigned: {
          where: { createdAt: { gte: from, lte: to }, deletedAt: null },
        },
      },
    });

    const rows = users
      .filter((item) =>
        item.roles.some((role) =>
          ['sales', 'branch_manager'].includes(role.role.code),
        ),
      )
      .map((item) => {
        const leadConverted = item.leadsAssigned.filter(
          (lead) => lead.status === 'CONVERTED',
        ).length;
        const revenue = this.sum(item.contractsSold, (contract) =>
          this.toNumber(contract.totalAmount),
        );
        const actual = this.sum(item.contractsSold, (contract) =>
          this.toNumber(contract.amountPaid),
        );
        const target = 100_000_000;

        return {
          code: item.username,
          name: item.fullName,
          newContracts: item.contractsSold.length,
          newLeads: item.leadsAssigned.length,
          convertedLeads: leadConverted,
          revenue,
          actualRevenue: actual,
          kpiPercent: target ? Math.round((actual / target) * 100) : 0,
        };
      });

    return {
      summary: {
        totalRevenue: this.sum(rows, (row) => this.toNumber(row.actualRevenue)),
        totalContracts: this.sum(rows, (row) =>
          this.toNumber(row.newContracts),
        ),
      },
      rows,
    };
  }

  async lead(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const leads = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      include: { branch: true, source: true, assignedTo: true },
    });

    const rows = leads.map((lead) => ({
      code: lead.code,
      customerName: lead.fullName,
      branch: this.branchName(lead.branch),
      source: lead.source?.name || '',
      status: lead.status,
      potential: lead.potentialLevel,
      assignedTo: lead.assignedTo?.fullName || '',
      nextFollowUpAt: lead.nextFollowUpAt?.toISOString() || '',
    }));

    return {
      summary: {
        totalLead: leads.length,
        leadNew: leads.filter((lead) => lead.status === 'NEW').length,
        cared: leads.filter((lead) => lead.status !== 'NEW').length,
        closedWon: leads.filter((lead) => lead.status === 'CONVERTED').length,
        open: leads.filter(
          (lead) => !['CONVERTED', 'CANCELLED'].includes(lead.status),
        ).length,
      },
      rows,
    };
  }

  async branchRevenue(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const receipts = await this.prisma.paymentReceipt.findMany({
      where: {
        deletedAt: null,
        receiptDate: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      include: { branch: true, contract: true },
    });
    const deposits = await this.prisma.deposit.findMany({
      where: {
        deletedAt: null,
        receivedAt: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      include: { branch: true },
    });

    const rows = Object.values(
      receipts.reduce<
        Record<
          string,
          {
            branch: string;
            membershipRevenue: number;
            ptRevenue: number;
            depositRevenue: number;
          }
        >
      >((acc, receipt) => {
        const key = this.branchName(receipt.branch);
        acc[key] ||= {
          branch: key,
          membershipRevenue: 0,
          ptRevenue: 0,
          depositRevenue: 0,
        };
        if (receipt.contract?.contractType === 'pt_package') {
          acc[key].ptRevenue += this.toNumber(receipt.amount);
        } else {
          acc[key].membershipRevenue += this.toNumber(receipt.amount);
        }
        return acc;
      }, {}),
    ).map((row) => ({
      ...row,
      depositRevenue: this.sum(
        deposits.filter(
          (deposit) => this.branchName(deposit.branch) === row.branch,
        ),
        (deposit) => this.toNumber(deposit.amount),
      ),
    }));

    return {
      summary: {
        totalRevenue: this.sum(
          rows,
          (row) => row.membershipRevenue + row.ptRevenue + row.depositRevenue,
        ),
      },
      rows,
    };
  }

  async contractRemain(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const contracts = await this.prisma.contract.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: { customer: true, servicePackage: true },
      orderBy: { endDate: 'asc' },
    });

    const rows = contracts.map((contract) => ({
      code: contract.code,
      customer: contract.customer.fullName,
      servicePackage: contract.servicePackage.name,
      originalValue: this.toNumber(contract.totalAmount),
      usedValue:
        this.toNumber(contract.totalAmount) -
        this.toNumber(contract.remainingValue),
      remainingValue: this.toNumber(contract.remainingValue),
      amountDue: this.toNumber(contract.amountDue),
      status: contract.status,
    }));

    return {
      summary: {
        totalRemainingValue: this.sum(rows, (row) => row.remainingValue),
        totalDebt: this.sum(rows, (row) => row.amountDue),
      },
      rows,
    };
  }

  async payment(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const [receipts, expenses] = await Promise.all([
      this.prisma.paymentReceipt.findMany({
        where: {
          deletedAt: null,
          receiptDate: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
        include: { customer: true, contract: true, branch: true },
      }),
      this.prisma.paymentExpense.findMany({
        where: {
          deletedAt: null,
          expenseDate: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
        include: { branch: true },
      }),
    ]);

    const rows = [
      ...receipts.map((receipt) => ({
        type: 'receipt',
        code: receipt.code,
        date: receipt.receiptDate.toISOString(),
        branch: this.branchName(receipt.branch),
        partner: receipt.customer?.fullName || '',
        reference: receipt.contract?.code || '',
        amount: this.toNumber(receipt.amount),
        note: receipt.content || '',
      })),
      ...expenses.map((expense) => ({
        type: 'expense',
        code: expense.code,
        date: expense.expenseDate.toISOString(),
        branch: this.branchName(expense.branch),
        partner: expense.payeeName,
        reference: expense.expenseType,
        amount: this.toNumber(expense.amount) * -1,
        note: expense.note || '',
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    const totalReceipt = this.sum(receipts, (item) =>
      this.toNumber(item.amount),
    );
    const totalExpense = this.sum(expenses, (item) =>
      this.toNumber(item.amount),
    );

    return {
      summary: {
        totalReceipt,
        totalExpense,
        profit: totalReceipt - totalExpense,
      },
      rows,
    };
  }

  async deposit(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const deposits = await this.prisma.deposit.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: { customer: true, lockerRental: true, branch: true },
    });

    const rows = deposits.map((deposit) => ({
      code: deposit.code,
      branch: this.branchName(deposit.branch),
      customer: deposit.customer?.fullName || '',
      itemType: deposit.itemType,
      amount: this.toNumber(deposit.amount),
      receivedAt: deposit.receivedAt.toISOString(),
      returnedAt: deposit.returnedAt?.toISOString() || '',
      status: deposit.status,
    }));

    return {
      summary: {
        totalHolding: this.sum(
          deposits.filter((deposit) => deposit.status === 'HOLDING'),
          (item) => this.toNumber(item.amount),
        ),
        totalReturned: this.sum(
          deposits.filter((deposit) => deposit.status === 'RETURNED'),
          (item) => this.toNumber(item.amount),
        ),
        overdue: deposits.filter((deposit) => deposit.status === 'OVERDUE')
          .length,
      },
      rows,
    };
  }

  async trainerPerformance(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const trainers = await this.prisma.ptTrainer.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: {
        trainingSessions: {
          where: { deletedAt: null, scheduledAt: { gte: from, lte: to } },
          include: { customer: true },
        },
      },
    });

    const rows = trainers.map((trainer) => ({
      code: trainer.code,
      trainerName: trainer.fullName,
      sessions: trainer.trainingSessions.length,
      completed: trainer.trainingSessions.filter(
        (session) => session.status === 'COMPLETED',
      ).length,
      missed: trainer.trainingSessions.filter(
        (session) => session.status === 'MISSED',
      ).length,
      activeCustomers: new Set(
        trainer.trainingSessions.map((session) => session.customerId),
      ).size,
    }));

    return {
      summary: {
        totalSessions: this.sum(rows, (row) => row.sessions),
        totalCompleted: this.sum(rows, (row) => row.completed),
      },
      rows,
    };
  }

  async birthday(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const from = query.dateFrom
      ? startOfDay(new Date(query.dateFrom))
      : startOfDay(new Date());
    const to = query.dateTo
      ? endOfDay(new Date(query.dateTo))
      : endOfDay(addDays(from, 30));
    const weekEnd = endOfWeek(from, { weekStartsOn: 1 });

    const customers = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        birthDate: { not: null },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        group: true,
      },
      orderBy: { fullName: 'asc' },
    });

    const rows = customers
      .map((customer) => {
        const birthDate = customer.birthDate;
        const nextBirthday = new Date(
          from.getFullYear(),
          birthDate.getMonth(),
          birthDate.getDate(),
        );
        if (nextBirthday < from) {
          nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
        }

        return {
          code: customer.code,
          customerName: customer.fullName,
          branch: this.branchName(customer.branch),
          groupName: customer.group?.name || '',
          phone: customer.phone || '',
          birthDate: birthDate.toISOString(),
          nextBirthday: nextBirthday.toISOString(),
          daysUntilBirthday: differenceInCalendarDays(nextBirthday, from),
          ageTurning: nextBirthday.getFullYear() - birthDate.getFullYear(),
          membershipStatus: customer.membershipStatus,
          outstandingDebt: this.toNumber(customer.outstandingDebt),
        };
      })
      .filter((row) =>
        isWithinInterval(new Date(row.nextBirthday), { start: from, end: to }),
      )
      .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);

    return {
      summary: {
        totalUpcoming: rows.length,
        birthdayToday: rows.filter((row) => row.daysUntilBirthday === 0).length,
        thisWeek: rows.filter((row) =>
          isWithinInterval(new Date(row.nextBirthday), {
            start: from,
            end: weekEnd,
          }),
        ).length,
        activeMembers: rows.filter((row) => row.membershipStatus === 'ACTIVE')
          .length,
      },
      rows,
    };
  }

  async followUp(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const from = query.dateFrom
      ? startOfDay(new Date(query.dateFrom))
      : startOfDay(new Date());
    const to = query.dateTo
      ? endOfDay(new Date(query.dateTo))
      : endOfDay(addDays(from, 7));
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const leads = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['CONVERTED', 'CANCELLED'] },
        ...(branchId ? { branchId } : {}),
        OR: [
          { nextFollowUpAt: { not: null } },
          { appointmentAt: { not: null } },
        ],
      },
      include: {
        branch: true,
        assignedTo: true,
        source: true,
      },
      orderBy: { nextFollowUpAt: 'asc' },
    });

    const rows = leads
      .map((lead) => {
        const actionAt = lead.nextFollowUpAt || lead.appointmentAt;
        if (!actionAt) return null;

        const overdue = actionAt < todayStart;
        const dueToday = actionAt >= todayStart && actionAt <= todayEnd;
        const hasAppointment = Boolean(lead.appointmentAt);
        const urgency = overdue
          ? 'OVERDUE'
          : dueToday
            ? 'TODAY'
            : differenceInCalendarDays(actionAt, todayStart) <= 2
              ? 'SOON'
              : 'PLANNED';

        return {
          code: lead.code,
          leadName: lead.fullName,
          branch: this.branchName(lead.branch),
          source: lead.source?.name || '',
          assignedTo: lead.assignedTo?.fullName || '',
          status: lead.status,
          nextFollowUpAt: lead.nextFollowUpAt?.toISOString() || '',
          appointmentAt: lead.appointmentAt?.toISOString() || '',
          lastContactResult: lead.lastContactResult || '',
          urgency,
          hasAppointment,
          dueDate: actionAt.toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter(
        (row) =>
          row.urgency === 'OVERDUE' ||
          isWithinInterval(new Date(row.dueDate), { start: from, end: to }),
      )
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return {
      summary: {
        totalFollowUps: rows.length,
        overdue: rows.filter((row) => row.urgency === 'OVERDUE').length,
        dueToday: rows.filter((row) => row.urgency === 'TODAY').length,
        appointments: rows.filter((row) => row.hasAppointment).length,
      },
      rows,
    };
  }

  async checkin(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const sessions = await this.prisma.trainingSession.findMany({
      where: {
        deletedAt: null,
        scheduledAt: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        customer: true,
        trainer: true,
        contract: true,
        attendance: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const rows = Object.values(
      sessions.reduce<
        Record<
          string,
          {
            code: string;
            customerName: string;
            branch: string;
            packageName: string;
            trainerName: string;
            bookedSessions: number;
            checkedInSessions: number;
            completedSessions: number;
            missedSessions: number;
            cancelledSessions: number;
            consumedSessions: number;
            attendanceRate: number;
            completionRate: number;
            remainingSessions: number;
            lastScheduledAt: string;
            lastCheckInAt: string;
            outstandingDebt: number;
            membershipStatus: string;
          }
        >
      >((acc, session) => {
        const checkedIn =
          session.status === 'CHECKED_IN' ||
          session.status === 'COMPLETED' ||
          Boolean(session.checkInAt)
            ? 1
            : 0;
        const completed = session.status === 'COMPLETED' ? 1 : 0;
        const missed = session.status === 'MISSED' ? 1 : 0;
        const cancelled = session.status === 'CANCELLED' ? 1 : 0;

        acc[session.customerId] ||= {
          code: session.customer.code,
          customerName: session.customer.fullName,
          branch: this.branchName(session.branch),
          packageName: session.contract?.packageName || '',
          trainerName: session.trainer?.fullName || '',
          bookedSessions: 0,
          checkedInSessions: 0,
          completedSessions: 0,
          missedSessions: 0,
          cancelledSessions: 0,
          consumedSessions: 0,
          attendanceRate: 0,
          completionRate: 0,
          remainingSessions: session.contract?.remainingSessions || 0,
          lastScheduledAt: '',
          lastCheckInAt: '',
          outstandingDebt: this.toNumber(session.customer.outstandingDebt),
          membershipStatus: session.customer.membershipStatus,
        };

        acc[session.customerId].bookedSessions += 1;
        acc[session.customerId].checkedInSessions += checkedIn;
        acc[session.customerId].completedSessions += completed;
        acc[session.customerId].missedSessions += missed;
        acc[session.customerId].cancelledSessions += cancelled;
        acc[session.customerId].consumedSessions += session.consumedSessions;
        acc[session.customerId].remainingSessions =
          session.contract?.remainingSessions ||
          acc[session.customerId].remainingSessions;

        if (
          !acc[session.customerId].lastScheduledAt ||
          session.scheduledAt >
            new Date(acc[session.customerId].lastScheduledAt)
        ) {
          acc[session.customerId].lastScheduledAt =
            session.scheduledAt.toISOString();
        }

        if (
          session.checkInAt &&
          (!acc[session.customerId].lastCheckInAt ||
            session.checkInAt > new Date(acc[session.customerId].lastCheckInAt))
        ) {
          acc[session.customerId].lastCheckInAt =
            session.checkInAt.toISOString();
        }

        return acc;
      }, {}),
    )
      .map((row) => ({
        ...row,
        attendanceRate: this.percent(row.checkedInSessions, row.bookedSessions),
        completionRate: this.percent(row.completedSessions, row.bookedSessions),
      }))
      .sort(
        (a, b) =>
          b.completedSessions - a.completedSessions ||
          b.bookedSessions - a.bookedSessions,
      );

    return {
      summary: {
        totalBookings: sessions.length,
        checkedInSessions: sessions.filter(
          (session) =>
            session.status === 'CHECKED_IN' ||
            session.status === 'COMPLETED' ||
            Boolean(session.checkInAt),
        ).length,
        completedSessions: sessions.filter(
          (session) => session.status === 'COMPLETED',
        ).length,
        missedSessions: sessions.filter(
          (session) => session.status === 'MISSED',
        ).length,
        activeMembers: this.uniqueCount(
          sessions,
          (session) => session.customerId,
        ),
      },
      rows,
    };
  }

  async ptTraining(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const trainers = await this.prisma.ptTrainer.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: {
        branch: true,
        contracts: {
          where: {
            deletedAt: null,
            status: { in: ['ACTIVE', 'PAUSED'] },
          },
        },
        trainingSessions: {
          where: {
            deletedAt: null,
            scheduledAt: { gte: from, lte: to },
          },
          include: {
            customer: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const rows = trainers
      .map((trainer) => {
        const scheduledSessions = trainer.trainingSessions.length;
        const checkedInSessions = trainer.trainingSessions.filter(
          (session) =>
            session.status === 'CHECKED_IN' || session.status === 'COMPLETED',
        ).length;
        const completedSessions = trainer.trainingSessions.filter(
          (session) => session.status === 'COMPLETED',
        ).length;
        const missedSessions = trainer.trainingSessions.filter(
          (session) => session.status === 'MISSED',
        ).length;
        const totalMinutes = this.sum(
          trainer.trainingSessions,
          (session) => session.durationMinutes,
        );
        const activeContracts = trainer.contracts.filter(
          (contract) => contract.status === 'ACTIVE',
        ).length;
        const activeCustomers = this.uniqueCount(
          trainer.trainingSessions,
          (session) => session.customerId,
        );
        const supportedRevenue = this.sum(trainer.contracts, (contract) =>
          this.toNumber(contract.totalAmount),
        );

        return {
          code: trainer.code,
          trainerName: trainer.fullName,
          branch: this.branchName(trainer.branch),
          specialty: trainer.specialty || '',
          activeContracts,
          activeCustomers,
          scheduledSessions,
          checkedInSessions,
          completedSessions,
          missedSessions,
          totalMinutes,
          completionRate: this.percent(completedSessions, scheduledSessions),
          utilizationRate: this.percent(checkedInSessions, scheduledSessions),
          supportedRevenue,
          status: trainer.status,
        };
      })
      .sort(
        (a, b) =>
          b.completedSessions - a.completedSessions ||
          b.scheduledSessions - a.scheduledSessions,
      );

    return {
      summary: {
        totalTrainers: rows.length,
        totalSessions: this.sum(rows, (row) => row.scheduledSessions),
        totalCompleted: this.sum(rows, (row) => row.completedSessions),
        totalMinutes: this.sum(rows, (row) => row.totalMinutes),
        activeCustomers: this.sum(rows, (row) => row.activeCustomers),
      },
      rows,
    };
  }

  async staffAttendance(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.attendanceRange(query);
    const staffAttendanceDelegate = (this.prisma as PrismaClient)
      .staffAttendanceEvent;
    const [staffMembers, events, assignments] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          ...(branchId ? { branchId } : { branchId: { not: null } }),
        },
        include: {
          branch: true,
          roles: { include: { role: true } },
        },
        orderBy: { fullName: 'asc' },
      }),
      staffAttendanceDelegate.findMany({
        where: {
          eventAt: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
        include: {
          attendanceMachine: true,
        },
        orderBy: { eventAt: 'asc' },
      }),
      this.prisma.staffShiftAssignment.findMany({
        where: {
          deletedAt: null,
          ...(branchId ? { branchId } : {}),
        },
        include: {
          shifts: {
            where: {
              shift: {
                deletedAt: null,
              },
            },
            include: {
              shift: true,
            },
            orderBy: { sequence: 'asc' },
          },
        },
        orderBy: [{ startDate: 'desc' }, { updatedAt: 'desc' }],
      }),
    ]);

    const attendanceDates = Array.from(
      new Set(events.map((event) => this.attendanceDateKey(event.eventAt))),
    ).sort();
    const dateKeys: string[] = attendanceDates.length
      ? attendanceDates
      : [this.attendanceDateKey(from)];
    const eventsByStaffDay = events.reduce<
      Record<string, (typeof events)[number][]>
    >((acc, event) => {
      const key = `${event.userId}:${this.attendanceDateKey(event.eventAt)}`;
      acc[key] ||= [];
      acc[key].push(event);
      return acc;
    }, {});
    const assignmentsByUser = assignments.reduce<
      Record<string, (typeof assignments)[number][]>
    >((acc, assignment) => {
      acc[assignment.userId] ||= [];
      acc[assignment.userId].push(assignment);
      return acc;
    }, {});

    type StaffAttendanceRow = {
      attendanceDate: string;
      branch: string;
      staffCode: string;
      attendanceCode: string;
      staffName: string;
      role: string;
      shiftWindow: string;
      firstCheckInAt: string;
      lastCheckOutAt: string;
      eventCount: number;
      workedHours: number;
      lateMinutes: number;
      earlyLeaveMinutes: number;
      overtimeMinutes: number;
      machineNames: string;
      verificationMethods: string;
      attendanceStatus: string;
      shiftCode: string;
    };

    const rows: StaffAttendanceRow[] = staffMembers
      .flatMap((staffMember) => {
        const roleCodes = staffMember.roles.map((role) => role.role.code);
        const fallbackShift = this.staffShift(roleCodes);
        const userAssignments = assignmentsByUser[staffMember.id] || [];

        return dateKeys.map((dateKey) => {
          const targetDate = new Date(`${dateKey}T00:00:00+07:00`);
          const key = `${staffMember.id}:${dateKey}`;
          const dayEvents = (eventsByStaffDay[key] || []).sort(
            (a, b) => a.eventAt.getTime() - b.eventAt.getTime(),
          );
          const resolvedAssignmentShift = userAssignments
            .map((assignment) =>
              resolveShiftForDate(
                {
                  startDate: assignment.startDate,
                  endDate: assignment.endDate,
                  rotationCycleDays: assignment.rotationCycleDays,
                  isUnlimitedRotation: assignment.isUnlimitedRotation,
                  shifts: assignment.shifts
                    .map((item) => item.shift)
                    .filter(Boolean),
                },
                targetDate,
              ),
            )
            .find(Boolean);
          const shiftSummary = summarizeShiftAttendance({
            shift: resolvedAssignmentShift?.shift || fallbackShift,
            targetDate,
            events: dayEvents,
            now: endOfDay(targetDate),
          });
          const machineNames = Array.from(
            new Set(
              dayEvents
                .map((event) => event.attendanceMachine?.name)
                .filter((value): value is string => Boolean(value)),
            ),
          );
          const verificationMethods = Array.from(
            new Set(dayEvents.map((event) => event.verificationMethod)),
          );

          const attendanceStatus =
            shiftSummary.status === 'COMPLETED'
              ? shiftSummary.lateMinutes > 0
                ? 'LATE'
                : 'ON_TIME'
              : shiftSummary.status === 'LEFT_EARLY'
                ? 'LEFT_EARLY'
                : shiftSummary.status === 'NOT_CHECKED_IN'
                  ? 'ABSENT'
                  : shiftSummary.status;

          return {
            attendanceDate: dateKey,
            branch: this.branchName(staffMember.branch),
            staffCode: staffMember.employeeCode || staffMember.username,
            attendanceCode:
              staffMember.attendanceCode ||
              staffMember.employeeCode ||
              staffMember.username,
            staffName: staffMember.fullName,
            role: this.primaryRole(roleCodes),
            shiftWindow: shiftSummary.window?.label || '',
            firstCheckInAt: shiftSummary.firstCheckIn?.toISOString() || '',
            lastCheckOutAt: shiftSummary.lastCheckOut?.toISOString() || '',
            eventCount: dayEvents.length,
            workedHours: Math.round((shiftSummary.workedMinutes / 60) * 10) / 10,
            lateMinutes: shiftSummary.lateMinutes,
            earlyLeaveMinutes: shiftSummary.earlyLeaveMinutes,
            overtimeMinutes: shiftSummary.overtimeMinutes,
            machineNames: machineNames.join(', '),
            verificationMethods: verificationMethods.join(', '),
            attendanceStatus,
            shiftCode:
              resolvedAssignmentShift?.shift?.code || fallbackShift.code || '',
          };
        });
      })
      .sort(
        (a, b) =>
          b.attendanceDate.localeCompare(a.attendanceDate) ||
          a.branch.localeCompare(b.branch) ||
          a.staffName.localeCompare(b.staffName),
      );

    return {
      summary: {
        totalStaff: staffMembers.length,
        presentDays: rows.filter((row) => row.attendanceStatus !== 'ABSENT')
          .length,
        lateArrivals: rows.filter((row) => row.attendanceStatus === 'LATE')
          .length,
        missingCheckouts: rows.filter(
          (row) => row.attendanceStatus === 'MISSING_CHECKOUT',
        ).length,
        absentDays: rows.filter((row) => row.attendanceStatus === 'ABSENT')
          .length,
        totalWorkedHours:
          Math.round(this.sum(rows, (row) => row.workedHours) * 10) / 10,
      },
      rows,
    };
  }

  async classAttendance(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const sessions = await this.prisma.trainingSession.findMany({
      where: {
        deletedAt: null,
        scheduledAt: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        trainer: true,
        contract: true,
        customer: true,
        attendance: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const rows = sessions.map((session) => {
      const bookedMembers = Math.max(session.attendance.length, 1);
      const checkedInMembers = session.attendance.length
        ? session.attendance.filter(
            (attendance) => attendance.status === 'PRESENT',
          ).length
        : session.status === 'CHECKED_IN' || session.status === 'COMPLETED'
          ? 1
          : 0;
      const completedMembers =
        session.status === 'COMPLETED' ? Math.max(checkedInMembers, 1) : 0;
      const missedMembers =
        session.status === 'MISSED'
          ? 1
          : session.attendance.filter(
              (attendance) => attendance.status === 'ABSENT',
            ).length;
      const cancelledMembers =
        session.status === 'CANCELLED'
          ? 1
          : session.attendance.filter((attendance) =>
              ['CANCELLED', 'RESCHEDULED'].includes(attendance.status),
            ).length;

      return {
        sessionCode: session.code,
        sessionDate: session.scheduledAt.toISOString(),
        branch: this.branchName(session.branch),
        location: session.location || '',
        trainerName: session.trainer?.fullName || '',
        memberName: session.customer.fullName,
        packageName: session.contract?.packageName || '',
        bookedMembers,
        checkedInMembers,
        completedMembers,
        missedMembers,
        cancelledMembers,
        attendanceRate: this.percent(checkedInMembers, bookedMembers),
        consumedSessions: session.consumedSessions,
        sessionStatus: session.status,
      };
    });

    return {
      summary: {
        totalClasses: rows.length,
        totalBookedMembers: this.sum(rows, (row) => row.bookedMembers),
        checkedInMembers: this.sum(rows, (row) => row.checkedInMembers),
        completedMembers: this.sum(rows, (row) => row.completedMembers),
        missedMembers: this.sum(rows, (row) => row.missedMembers),
      },
      rows,
    };
  }

  async allocation(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const [
      branches,
      customers,
      leads,
      contracts,
      trainers,
      sessions,
      lockers,
      deposits,
      receipts,
      expenses,
    ] = await Promise.all([
      this.prisma.branch.findMany({
        where: { deletedAt: null, ...(branchId ? { id: branchId } : {}) },
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.findMany({
        where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.lead.findMany({
        where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.contract.findMany({
        where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.ptTrainer.findMany({
        where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.trainingSession.findMany({
        where: {
          deletedAt: null,
          scheduledAt: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.locker.findMany({
        where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.deposit.findMany({
        where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.paymentReceipt.findMany({
        where: {
          deletedAt: null,
          receiptDate: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.paymentExpense.findMany({
        where: {
          deletedAt: null,
          expenseDate: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
      }),
    ]);

    const rows = branches.map((branch) => {
      const branchCustomers = customers.filter(
        (item) => item.branchId === branch.id,
      );
      const branchLeads = leads.filter(
        (item) =>
          item.branchId === branch.id &&
          !['CONVERTED', 'CANCELLED'].includes(item.status),
      );
      const branchContracts = contracts.filter(
        (item) => item.branchId === branch.id && item.status === 'ACTIVE',
      );
      const branchTrainers = trainers.filter(
        (item) => item.branchId === branch.id && item.status === 'ACTIVE',
      );
      const branchSessions = sessions.filter(
        (item) => item.branchId === branch.id,
      );
      const branchLockers = lockers.filter(
        (item) => item.branchId === branch.id && item.status === 'RENTED',
      );
      const branchDeposits = deposits.filter(
        (item) => item.branchId === branch.id && item.status === 'HOLDING',
      );
      const collectedRevenue = this.sum(
        receipts.filter((item) => item.branchId === branch.id),
        (item) => this.toNumber(item.amount),
      );
      const totalExpense = this.sum(
        expenses.filter((item) => item.branchId === branch.id),
        (item) => this.toNumber(item.amount),
      );

      return {
        branch: branch.name,
        activeMembers: branchCustomers.filter(
          (item) => item.membershipStatus === 'ACTIVE',
        ).length,
        totalCustomers: branchCustomers.length,
        openLeads: branchLeads.length,
        activeContracts: branchContracts.length,
        activeTrainers: branchTrainers.length,
        scheduledSessions: branchSessions.length,
        rentedLockers: branchLockers.length,
        holdingDeposits: this.sum(branchDeposits, (item) =>
          this.toNumber(item.amount),
        ),
        collectedRevenue,
        totalExpense,
        customersPerTrainer: branchTrainers.length
          ? Math.round((branchCustomers.length / branchTrainers.length) * 10) /
            10
          : 0,
        sessionsPerTrainer: branchTrainers.length
          ? Math.round((branchSessions.length / branchTrainers.length) * 10) /
            10
          : 0,
      };
    });

    return {
      summary: {
        totalMembers: this.sum(rows, (row) => row.activeMembers),
        totalContracts: this.sum(rows, (row) => row.activeContracts),
        totalTrainers: this.sum(rows, (row) => row.activeTrainers),
        totalSessions: this.sum(rows, (row) => row.scheduledSessions),
      },
      rows,
    };
  }

  async salesSummary(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: {
        branch: true,
        roles: { include: { role: true } },
        contractsSold: {
          where: {
            deletedAt: null,
            createdAt: { gte: from, lte: to },
          },
        },
        leadsAssigned: {
          where: {
            deletedAt: null,
            createdAt: { gte: from, lte: to },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const rows = users
      .filter((item) => {
        const roleCodes = item.roles.map((role) => role.role.code);
        return (
          roleCodes.some((roleCode) =>
            ['sales', 'branch_manager', 'customer_care'].includes(roleCode),
          ) ||
          item.contractsSold.length > 0 ||
          item.leadsAssigned.length > 0
        );
      })
      .map((item) => {
        const roleCodes = item.roles.map((role) => role.role.code);
        const membershipContracts = item.contractsSold.filter(
          (contract) => contract.contractType === 'membership',
        ).length;
        const ptContracts = item.contractsSold.filter(
          (contract) => contract.contractType === 'pt_package',
        ).length;
        const totalRevenue = this.sum(item.contractsSold, (contract) =>
          this.toNumber(contract.totalAmount),
        );
        const collectedAmount = this.sum(item.contractsSold, (contract) =>
          this.toNumber(contract.amountPaid),
        );
        const outstandingDebt = this.sum(item.contractsSold, (contract) =>
          this.toNumber(contract.amountDue),
        );
        const convertedLeads = item.leadsAssigned.filter(
          (lead) => lead.status === 'CONVERTED',
        ).length;

        return {
          code: item.username,
          staffName: item.fullName,
          branch: this.branchName(item.branch),
          role: this.primaryRole(roleCodes),
          leadsManaged: item.leadsAssigned.length,
          convertedLeads,
          conversionRate: this.percent(
            convertedLeads,
            item.leadsAssigned.length,
          ),
          totalContracts: item.contractsSold.length,
          membershipContracts,
          ptContracts,
          totalRevenue,
          collectedAmount,
          outstandingDebt,
          averageContractValue: item.contractsSold.length
            ? Math.round(totalRevenue / item.contractsSold.length)
            : 0,
        };
      })
      .sort(
        (a, b) =>
          b.totalRevenue - a.totalRevenue ||
          b.totalContracts - a.totalContracts,
      );

    return {
      summary: {
        totalRevenue: this.sum(rows, (row) => row.totalRevenue),
        totalContracts: this.sum(rows, (row) => row.totalContracts),
        totalCollected: this.sum(rows, (row) => row.collectedAmount),
        totalDebt: this.sum(rows, (row) => row.outstandingDebt),
        totalConvertedLeads: this.sum(rows, (row) => row.convertedLeads),
      },
      rows,
    };
  }

  async debt(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const today = startOfDay(new Date());
    const contracts = await this.prisma.contract.findMany({
      where: {
        deletedAt: null,
        amountDue: { gt: 0 },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        customer: true,
        saleUser: true,
      },
      orderBy: { endDate: 'asc' },
    });

    const rows = contracts
      .map((contract) => {
        const amountDue = this.toNumber(contract.amountDue);
        const daysToExpire = differenceInCalendarDays(
          startOfDay(contract.endDate),
          today,
        );
        const collectionStatus = this.collectionStatus(amountDue, daysToExpire);

        return {
          contractCode: contract.code,
          customerName: contract.customer.fullName,
          branch: this.branchName(contract.branch),
          saleUser: contract.saleUser?.fullName || '',
          packageName: contract.packageName,
          totalAmount: this.toNumber(contract.totalAmount),
          amountPaid: this.toNumber(contract.amountPaid),
          amountDue,
          remainingValue: this.toNumber(contract.remainingValue),
          paymentStatus: contract.paymentStatus,
          endDate: contract.endDate.toISOString(),
          daysToExpire,
          collectionStatus,
          priority: this.collectionPriority(amountDue, daysToExpire),
        };
      })
      .sort(
        (a, b) => b.amountDue - a.amountDue || a.daysToExpire - b.daysToExpire,
      );

    return {
      summary: {
        totalDebt: this.sum(rows, (row) => row.amountDue),
        contractsInDebt: rows.length,
        overdueDebt: this.sum(
          rows.filter((row) => row.collectionStatus === 'OVERDUE'),
          (row) => row.amountDue,
        ),
        dueSoon: rows.filter((row) => row.collectionStatus === 'DUE_SOON')
          .length,
      },
      rows,
    };
  }

  async branchSummary(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const [
      branches,
      customers,
      leads,
      contracts,
      receipts,
      expenses,
      trainers,
      sessions,
    ] = await Promise.all([
      this.prisma.branch.findMany({
        where: { deletedAt: null, ...(branchId ? { id: branchId } : {}) },
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.findMany({
        where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.lead.findMany({
        where: {
          deletedAt: null,
          createdAt: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.contract.findMany({
        where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.paymentReceipt.findMany({
        where: {
          deletedAt: null,
          receiptDate: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.paymentExpense.findMany({
        where: {
          deletedAt: null,
          expenseDate: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
      }),
      this.prisma.ptTrainer.findMany({
        where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      }),
      this.prisma.trainingSession.findMany({
        where: {
          deletedAt: null,
          scheduledAt: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
      }),
    ]);

    const rows = branches.map((branch) => {
      const branchCustomers = customers.filter(
        (item) => item.branchId === branch.id,
      );
      const branchLeads = leads.filter((item) => item.branchId === branch.id);
      const branchContracts = contracts.filter(
        (item) => item.branchId === branch.id,
      );
      const branchReceipts = receipts.filter(
        (item) => item.branchId === branch.id,
      );
      const branchExpenses = expenses.filter(
        (item) => item.branchId === branch.id,
      );
      const branchTrainers = trainers.filter(
        (item) => item.branchId === branch.id && item.status === 'ACTIVE',
      );
      const branchSessions = sessions.filter(
        (item) => item.branchId === branch.id,
      );
      const collectedRevenue = this.sum(branchReceipts, (item) =>
        this.toNumber(item.amount),
      );
      const totalExpense = this.sum(branchExpenses, (item) =>
        this.toNumber(item.amount),
      );
      const netProfit = collectedRevenue - totalExpense;
      const totalContractValue = this.sum(branchContracts, (item) =>
        this.toNumber(item.totalAmount),
      );
      const totalCollected = this.sum(branchContracts, (item) =>
        this.toNumber(item.amountPaid),
      );

      return {
        branch: branch.name,
        activeMembers: branchCustomers.filter(
          (item) => item.membershipStatus === 'ACTIVE',
        ).length,
        newLeads: branchLeads.length,
        convertedLeads: branchLeads.filter(
          (item) => item.status === 'CONVERTED',
        ).length,
        conversionRate: this.percent(
          branchLeads.filter((item) => item.status === 'CONVERTED').length,
          branchLeads.length,
        ),
        activeContracts: branchContracts.filter(
          (item) => item.status === 'ACTIVE',
        ).length,
        collectedRevenue,
        totalExpense,
        netProfit,
        outstandingDebt: this.sum(branchCustomers, (item) =>
          this.toNumber(item.outstandingDebt),
        ),
        activeTrainers: branchTrainers.length,
        scheduledSessions: branchSessions.length,
        averageTicket: branchContracts.length
          ? Math.round(collectedRevenue / branchContracts.length)
          : 0,
        collectionRate: this.percent(totalCollected, totalContractValue),
      };
    });

    return {
      summary: {
        totalRevenue: this.sum(rows, (row) => row.collectedRevenue),
        totalExpense: this.sum(rows, (row) => row.totalExpense),
        netProfit: this.sum(rows, (row) => row.netProfit),
        totalBranches: rows.length,
      },
      rows,
    };
  }

  async packageProgress(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const today = startOfDay(new Date());
    const contracts = await this.prisma.contract.findMany({
      where: {
        deletedAt: null,
        status: { in: ['ACTIVE', 'PAUSED'] },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        customer: true,
        trainer: true,
      },
      orderBy: { endDate: 'asc' },
    });

    const rows = contracts.map((contract) => {
      const totalSessions =
        contract.totalSessions ||
        contract.usedSessions + contract.remainingSessions;
      const daysToExpire = differenceInCalendarDays(
        startOfDay(contract.endDate),
        today,
      );

      return {
        contractCode: contract.code,
        customerName: contract.customer.fullName,
        branch: this.branchName(contract.branch),
        packageName: contract.packageName,
        trainerName: contract.trainer?.fullName || '',
        totalSessions,
        usedSessions: contract.usedSessions,
        remainingSessions: contract.remainingSessions,
        progressPercent: this.percent(contract.usedSessions, totalSessions),
        remainingValue: this.toNumber(contract.remainingValue),
        endDate: contract.endDate.toISOString(),
        daysToExpire,
        paymentStatus: contract.paymentStatus,
        contractStatus: contract.status,
      };
    });

    return {
      summary: {
        totalContracts: rows.length,
        totalUsedSessions: this.sum(rows, (row) => row.usedSessions),
        totalRemainingSessions: this.sum(rows, (row) => row.remainingSessions),
        expiringSoon: rows.filter(
          (row) => row.daysToExpire >= 0 && row.daysToExpire <= 7,
        ).length,
      },
      rows,
    };
  }

  async cardRevenue(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const receipts = await this.prisma.paymentReceipt.findMany({
      where: {
        deletedAt: null,
        receiptDate: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        customer: true,
        contract: true,
        paymentMethod: true,
      },
      orderBy: { receiptDate: 'asc' },
    });

    const rows = receipts
      .filter(
        (receipt) =>
          receipt.sourceType === 'card' ||
          receipt.contract?.contractType === 'membership',
      )
      .map((receipt) => ({
        receiptCode: receipt.code,
        receiptDate: receipt.receiptDate.toISOString(),
        branch: this.branchName(receipt.branch),
        customerName: receipt.customer?.fullName || '',
        contractCode: receipt.contract?.code || '',
        cardType:
          receipt.contract?.packageName || receipt.sourceType || 'card_revenue',
        paymentMethod: receipt.paymentMethod?.name || '',
        amount: this.toNumber(receipt.amount),
        sourceType: receipt.sourceType || '',
        note: receipt.content || '',
      }));

    return {
      summary: {
        totalCardRevenue: this.sum(rows, (row) => row.amount),
        receiptCount: rows.length,
        activeCardContracts: this.uniqueCount(
          rows,
          (row) => row.contractCode || null,
        ),
        averageTicket: rows.length
          ? Math.round(this.sum(rows, (row) => row.amount) / rows.length)
          : 0,
      },
      rows,
    };
  }

  async staffReview(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      include: {
        branch: true,
        roles: { include: { role: true } },
        leadsAssigned: {
          where: {
            deletedAt: null,
            createdAt: { gte: from, lte: to },
          },
        },
        contractsSold: {
          where: {
            deletedAt: null,
            createdAt: { gte: from, lte: to },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const rows = users
      .filter((item) => {
        const roleCodes = item.roles.map((role) => role.role.code);
        return (
          roleCodes.some((roleCode) =>
            [
              'branch_manager',
              'sales',
              'accountant',
              'customer_care',
              'trainer',
              'hr',
            ].includes(roleCode),
          ) ||
          item.leadsAssigned.length > 0 ||
          item.contractsSold.length > 0
        );
      })
      .map((item) => {
        const roleCodes = item.roles.map((role) => role.role.code);
        const totalRevenue = this.sum(item.contractsSold, (contract) =>
          this.toNumber(contract.totalAmount),
        );
        const collectedAmount = this.sum(item.contractsSold, (contract) =>
          this.toNumber(contract.amountPaid),
        );
        const convertedLeads = item.leadsAssigned.filter(
          (lead) => lead.status === 'CONVERTED',
        ).length;
        const followUpsPending = item.leadsAssigned.filter(
          (lead) =>
            !['CONVERTED', 'CANCELLED'].includes(lead.status) &&
            Boolean(lead.nextFollowUpAt) &&
            lead.nextFollowUpAt <= to,
        ).length;
        const conversionRate = this.percent(
          convertedLeads,
          item.leadsAssigned.length,
        );
        const collectionRate = totalRevenue
          ? this.percent(collectedAmount, totalRevenue)
          : 0;
        const workloadIndex = Math.min(
          100,
          item.leadsAssigned.length * 10 + item.contractsSold.length * 15,
        );
        const performanceIndex = Math.round(
          conversionRate * 0.45 + collectionRate * 0.35 + workloadIndex * 0.2,
        );

        return {
          code: item.username,
          staffName: item.fullName,
          branch: this.branchName(item.branch),
          role: this.primaryRole(roleCodes),
          leadsManaged: item.leadsAssigned.length,
          convertedLeads,
          conversionRate,
          contractsSold: item.contractsSold.length,
          totalRevenue,
          collectedAmount,
          followUpsPending,
          collectionRate,
          performanceIndex,
          lastLoginAt: item.lastLoginAt?.toISOString() || '',
          status: item.status,
        };
      })
      .sort(
        (a, b) =>
          b.performanceIndex - a.performanceIndex ||
          b.totalRevenue - a.totalRevenue,
      );

    return {
      summary: {
        totalStaff: rows.length,
        totalRevenue: this.sum(rows, (row) => row.totalRevenue),
        totalConvertedLeads: this.sum(rows, (row) => row.convertedLeads),
        averagePerformance: rows.length
          ? Math.round(
              this.sum(rows, (row) => row.performanceIndex) / rows.length,
            )
          : 0,
      },
      rows,
    };
  }

  async leadStatus(query: QueryDto, user: AuthUser) {
    const branchId = this.branchScope(query, user);
    const { from, to } = this.range(query);
    const todayStart = startOfDay(new Date());
    const leads = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      include: {
        branch: true,
        source: true,
        assignedTo: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = leads.map((lead) => {
      const nextAction = lead.nextFollowUpAt || lead.appointmentAt;
      const urgency =
        nextAction &&
        nextAction < todayStart &&
        !['CONVERTED', 'CANCELLED'].includes(lead.status)
          ? 'OVERDUE'
          : nextAction &&
              differenceInCalendarDays(startOfDay(nextAction), todayStart) <= 2
            ? 'SOON'
            : 'PLANNED';

      return {
        code: lead.code,
        leadName: lead.fullName,
        branch: this.branchName(lead.branch),
        source: lead.source?.name || '',
        assignedTo: lead.assignedTo?.fullName || '',
        status: lead.status,
        potential: lead.potentialLevel,
        createdAt: lead.createdAt.toISOString(),
        ageDays: differenceInCalendarDays(
          todayStart,
          startOfDay(lead.createdAt),
        ),
        budgetExpected: this.toNumber(lead.budgetExpected),
        nextFollowUpAt: lead.nextFollowUpAt?.toISOString() || '',
        appointmentAt: lead.appointmentAt?.toISOString() || '',
        urgency,
        lastContactResult: lead.lastContactResult || '',
      };
    });

    return {
      summary: {
        totalLead: rows.length,
        hotLead: rows.filter((row) => row.potential === 'HOT').length,
        overdueFollowUps: rows.filter((row) => row.urgency === 'OVERDUE')
          .length,
        converted: rows.filter((row) => row.status === 'CONVERTED').length,
      },
      rows,
    };
  }
}
