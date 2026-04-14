"use client";

import { ResourceDefinition } from "@/types/portal";

export type ReportRowActionType =
  | "birthday"
  | "class-attendance"
  | "deposit"
  | "payment"
  | "contract"
  | "card-revenue"
  | "branch-summary"
  | "kpi"
  | "lead-status"
  | "sales-summary"
  | "staff-review";

export interface ReportRowActionAccess {
  canViewContractDetails: boolean;
  canViewCustomerDetails: boolean;
  canViewDepositDetails: boolean;
  canViewExpenseDetails: boolean;
  canViewLeadDetails: boolean;
  canViewReceiptDetails: boolean;
  canViewTrainingSessionDetails: boolean;
}

export interface ReportRowActionResources {
  contract: ResourceDefinition;
  customer: ResourceDefinition;
  deposit: ResourceDefinition;
  expense: ResourceDefinition;
  lead: ResourceDefinition;
  receipt: ResourceDefinition;
  trainingSession: ResourceDefinition;
}

const reportRowActionTypeByReportType: Record<string, ReportRowActionType> = {
  birthday: "birthday",
  "branch-summary": "branch-summary",
  "card-revenue": "card-revenue",
  "class-attendance": "class-attendance",
  "contract-remain": "contract",
  debt: "contract",
  "expiring-members-revenue": "contract",
  deposit: "deposit",
  "follow-up": "lead-status",
  kpi: "kpi",
  lead: "lead-status",
  "lead-status": "lead-status",
  "social-inbox": "lead-status",
  "package-progress": "contract",
  payment: "payment",
  "sales-summary": "sales-summary",
  "staff-review": "staff-review",
};

export const salesSummaryActionFields = [
  "code",
  "staffName",
  "branch",
  "role",
  "leadsManaged",
  "convertedLeads",
  "conversionRate",
  "totalContracts",
  "membershipContracts",
  "ptContracts",
  "totalRevenue",
  "collectedAmount",
  "outstandingDebt",
  "averageContractValue",
];

export const branchSummaryActionFields = [
  "branch",
  "activeMembers",
  "newLeads",
  "convertedLeads",
  "conversionRate",
  "activeContracts",
  "collectedRevenue",
  "totalExpense",
  "netProfit",
  "outstandingDebt",
  "activeTrainers",
  "scheduledSessions",
  "averageTicket",
  "collectionRate",
];

export const kpiActionFields = [
  "code",
  "name",
  "newContracts",
  "newLeads",
  "convertedLeads",
  "revenue",
  "actualRevenue",
  "kpiPercent",
];

export const staffReviewActionFields = [
  "code",
  "staffName",
  "branch",
  "role",
  "leadsManaged",
  "convertedLeads",
  "conversionRate",
  "contractsSold",
  "totalRevenue",
  "collectedAmount",
  "followUpsPending",
  "collectionRate",
  "performanceIndex",
  "lastLoginAt",
  "status",
];

export const resolvePaymentRowType = (row: Record<string, unknown>) => String(row.type || "").trim().toLowerCase();

export const getReportRowActionType = (reportType: string): ReportRowActionType | null => reportRowActionTypeByReportType[reportType] || null;

export const canUseReportRowAction = (
  actionType: ReportRowActionType | null,
  row: Record<string, unknown>,
  access: ReportRowActionAccess,
) => {
  if (!actionType) return false;

  switch (actionType) {
    case "birthday":
      return Boolean(row.id) && access.canViewCustomerDetails;
    case "class-attendance":
      return Boolean(row.id) && access.canViewTrainingSessionDetails;
    case "deposit":
      return Boolean(row.id) && access.canViewDepositDetails;
    case "payment": {
      const paymentRowType = resolvePaymentRowType(row);
      if (paymentRowType === "receipt") return Boolean(row.id) && access.canViewReceiptDetails;
      if (paymentRowType === "expense") return Boolean(row.id) && access.canViewExpenseDetails;
      return false;
    }
    case "contract":
      return Boolean(row.id) && access.canViewContractDetails;
    case "card-revenue":
      return Boolean(row.id) && access.canViewReceiptDetails;
    case "branch-summary":
      return Boolean(String(row.branch || "").trim());
    case "kpi":
      return Boolean(String(row.name || row.code || "").trim());
    case "lead-status":
      return Boolean(row.id) && access.canViewLeadDetails;
    case "sales-summary":
      return Boolean(String(row.staffName || row.code || "").trim());
    case "staff-review":
      return Boolean(String(row.staffName || row.code || "").trim());
  }
};

export const resolveReportRowActionResource = (
  actionType: ReportRowActionType,
  row: Record<string, unknown>,
  resources: ReportRowActionResources,
) => {
  switch (actionType) {
    case "birthday":
      return resources.customer;
    case "class-attendance":
      return resources.trainingSession;
    case "deposit":
      return resources.deposit;
    case "payment": {
      const paymentRowType = resolvePaymentRowType(row);
      if (paymentRowType === "receipt") return resources.receipt;
      if (paymentRowType === "expense") return resources.expense;
      return null;
    }
    case "contract":
      return resources.contract;
    case "card-revenue":
      return resources.receipt;
    case "lead-status":
      return resources.lead;
    case "branch-summary":
    case "kpi":
    case "sales-summary":
    case "staff-review":
      return null;
  }
};
