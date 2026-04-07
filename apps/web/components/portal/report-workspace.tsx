"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Menu, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ListResponse } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";
import { localizeReportDefinition } from "@/lib/i18n/portal";
import { useLocale } from "@/lib/i18n/provider";
import { printReportDocument } from "@/lib/print";
import { ReportDefinition } from "@/types/portal";
import { EmptyState } from "../feedback/empty-state";
import { StatusBadge } from "../shared/status-badge";

interface ReportPayload {
  summary: Record<string, number>;
  rows: Array<Record<string, unknown>>;
}

interface SummaryStripItem {
  key: string;
  label: string;
  value: number;
  type: "currency" | "number";
}

interface ReportFacetConfig {
  key: string;
  label: string;
  allLabel: string;
}

const pageSizeOptions = [15, 30, 50];

const reportSearchPlaceholders: Record<string, string> = {
  checkin: "Tim kiem theo ten, ma, so dien thoai khach hang...",
  "staff-attendance": "Tim kiem theo ten, ma, so dien thoai nhan vien...",
  debt: "Theo ma hop dong, ten khach hang",
  "branch-summary": "Tim kiem theo ten chi nhanh...",
  "branch-revenue": "Theo ten chi nhanh...",
  "trainer-performance": "Theo ma PT, ten PT...",
  birthday: "Theo ten hoi vien, ma hoi vien, so dien thoai...",
  "follow-up": "Theo ten lead, nhan vien phu trach, ket qua lien he...",
  payment: "Theo ma phieu, doi tac, tham chieu, ghi chu...",
  "contract-remain": "Theo ma hop dong, khach hang, goi dich vu...",
  deposit: "Theo ma coc, khach hang, loai coc...",
  kpi: "Theo ten hoac ma nhan vien...",
  lead: "Theo ten lead, nguon lead, nhan vien phu trach...",
  "pt-training": "Tim kiem theo ten PT, ma PT, noi dung lien quan...",
  "class-attendance": "Theo ma buoi, hoi vien, PT phu trach...",
  allocation: "Theo ten chi nhanh...",
  "sales-summary": "Theo ten nhan vien, ma nhan vien, chi nhanh...",
  "package-progress": "Theo ma hop dong, khach hang, goi dich vu...",
  "card-revenue": "Theo ma phieu, hoi vien, ma hop dong...",
  "staff-review": "Theo ten nhan vien, ma nhan vien, chi nhanh...",
  "lead-status": "Theo ten lead, nguon lead, ket qua lien he...",
};

const reportColumnLabelOverrides: Record<string, string> = {
  activeContracts: "Hop dong active",
  activeCustomers: "Khach dang phu trach",
  activeMembers: "Hoi vien active",
  activeTrainers: "PT active",
  ageDays: "Tuoi lead",
  ageTurning: "Tuoi sap toi",
  amount: "So tien",
  amountDue: "So tien con no",
  amountPaid: "Da thanh toan",
  attendanceCode: "Ma cham cong",
  attendanceDate: "Ngay cham cong",
  attendanceRate: "Ty le diem danh",
  attendanceStatus: "Trang thai",
  averageContractValue: "Gia tri HD TB",
  averageTicket: "Gia tri TB",
  birthDate: "Ngay sinh",
  bookedMembers: "Luot dang ky",
  bookedSessions: "So lich dat",
  branch: "Chi nhanh",
  branchId: "Chi nhanh",
  budgetExpected: "Budget du kien",
  cancelledMembers: "Da huy",
  cancelledSessions: "Da huy",
  checkedInMembers: "Da diem danh",
  checkedInSessions: "Da check-in",
  collectedAmount: "Da thu",
  collectedRevenue: "Doanh thu",
  collectionRate: "Ty le thu",
  collectionStatus: "Trang thai thu",
  completed: "Hoan thanh",
  completedMembers: "Hoan thanh",
  completedSessions: "Da hoan thanh",
  completionRate: "Ty le hoan thanh",
  consumedSessions: "So buoi da dung",
  contractCode: "Ma hop dong",
  contractStatus: "Trang thai hop dong",
  contractsSold: "Hop dong ban duoc",
  conversionRate: "Ty le chuyen doi",
  convertedLeads: "Lead chuyen doi",
  createdAt: "Ngay tao",
  customerName: "Ho ten hoi vien",
  customersPerTrainer: "Hoi vien / PT",
  date: "Ngay",
  dateFrom: "Tu ngay",
  dateTo: "Den ngay",
  daysToExpire: "Con lai",
  daysUntilBirthday: "Con bao nhieu ngay",
  depositRevenue: "Doanh thu coc",
  endDate: "Ngay ket thuc",
  eventCount: "So lan cham cong",
  firstCheckInAt: "Gio vao",
  followUpsPending: "Follow-up ton",
  groupName: "Nhom khach",
  holdingDeposits: "Tien coc dang giu",
  lastCheckInAt: "Check-in gan nhat",
  lastCheckOutAt: "Gio ra",
  lastLoginAt: "Dang nhap gan nhat",
  lastScheduledAt: "Lich gan nhat",
  lateMinutes: "Di muon",
  leadsManaged: "Lead phu trach",
  location: "Dia diem",
  machineNames: "Thiet bi",
  memberName: "Hoi vien",
  membershipContracts: "HD hoi vien",
  membershipRevenue: "Doanh thu hoi vien",
  membershipStatus: "Trang thai",
  missed: "Vang mat",
  missedMembers: "Vang mat",
  missedSessions: "Vang mat",
  name: "Ten",
  netProfit: "Loi nhuan rong",
  newLeads: "Lead moi",
  nextBirthday: "Sinh nhat toi",
  note: "Ghi chu",
  openLeads: "Lead mo",
  originalValue: "Gia tri goc",
  outstandingDebt: "Cong no",
  overtimeMinutes: "Tang ca",
  packageName: "Dich vu - goi the",
  paymentMethod: "Thanh toan",
  paymentStatus: "Trang thai thanh toan",
  performanceIndex: "Chi so hieu suat",
  phone: "Dien thoai",
  priority: "Uu tien",
  progressPercent: "Tien do su dung",
  ptContracts: "HD PT",
  ptRevenue: "Doanh thu PT",
  receiptCode: "Ma phieu",
  receiptDate: "Ngay thu",
  remainingSessions: "So buoi con lai",
  remainingValue: "Gia tri con lai",
  rentedLockers: "Tu dang thue",
  role: "Chuc danh",
  saleUser: "Nhan vien Sale",
  scheduledSessions: "Buoi da len lich",
  sessionCode: "Ma buoi",
  sessionDate: "Ngay buoi tap",
  sessions: "Tong buoi",
  sessionStatus: "Trang thai buoi",
  shiftWindow: "Ca lam",
  sourceType: "Nguon phat sinh",
  specialty: "Chuyen mon",
  staffCode: "Ma nhan vien",
  staffName: "Nhan vien",
  supportedRevenue: "Doanh thu ho tro",
  sessionsPerTrainer: "Buoi / PT",
  totalAmount: "Tong tien",
  totalContracts: "Tong hop dong",
  totalCustomers: "Tong khach",
  totalExpense: "Tong chi phi",
  totalMinutes: "Tong phut",
  totalRevenue: "Tong doanh thu",
  totalSessions: "Tong buoi",
  trainerName: "PT phu trach",
  usedSessions: "Da dung",
  utilizationRate: "Ty le tai trong",
  verificationMethods: "Xac thuc",
  workedHours: "Tong gio",
};

const reportColumnLabelOverridesByType: Record<string, Record<string, string>> = {
  checkin: {
    code: "Ma hoi vien",
  },
  "branch-revenue": {
    membershipRevenue: "Doanh thu hoi vien",
    ptRevenue: "Doanh thu PT",
    depositRevenue: "Doanh thu coc",
  },
  birthday: {
    code: "Ma hoi vien",
    customerName: "Hoi vien",
    membershipStatus: "Trang thai hoi vien",
  },
  "follow-up": {
    code: "Ma lead",
    leadName: "Ten lead",
    source: "Nguon lead",
    assignedTo: "Nhan vien phu trach",
    status: "Trang thai lead",
    nextFollowUpAt: "Lan cham soc toi",
    appointmentAt: "Lich hen",
    lastContactResult: "Ket qua gan nhat",
    urgency: "Muc uu tien",
    hasAppointment: "Co lich hen",
    dueDate: "Den han",
  },
  payment: {
    type: "Loai phieu",
    code: "Ma phieu",
    date: "Ngay hach toan",
    partner: "Doi tac / nguoi nop",
    reference: "Ma tham chieu",
  },
  "contract-remain": {
    code: "Ma hop dong",
    customer: "Khach hang",
    servicePackage: "Goi dich vu",
    originalValue: "Gia tri goc",
    usedValue: "Da su dung",
    status: "Trang thai hop dong",
  },
  deposit: {
    code: "Ma coc",
    customer: "Khach nop coc",
    itemType: "Loai coc",
    receivedAt: "Thoi gian nhan",
    returnedAt: "Thoi gian tra",
    status: "Tinh trang coc",
  },
  kpi: {
    code: "Ma nhan vien",
    name: "Nhan vien",
    newContracts: "Hop dong moi",
    newLeads: "Lead moi",
    convertedLeads: "Lead chuyen doi",
    revenue: "Doanh thu hop dong",
    actualRevenue: "Doanh thu thuc thu",
    kpiPercent: "Muc dat KPI",
  },
  lead: {
    code: "Ma lead",
    customerName: "Ten lead",
    source: "Nguon lead",
    status: "Trang thai lead",
    potential: "Do nong",
    assignedTo: "Nhan vien phu trach",
    nextFollowUpAt: "Lan cham soc toi",
  },
  "trainer-performance": {
    code: "Ma PT",
    trainerName: "PT phu trach",
  },
  "pt-training": {
    code: "Ma PT",
    trainerName: "PT phu trach",
  },
  "class-attendance": {
    sessionCode: "Ma buoi",
    sessionDate: "Ngay buoi tap",
    memberName: "Hoi vien",
    sessionStatus: "Trang thai",
  },
  "sales-summary": {
    code: "Ma nhan vien",
    staffName: "Nhan vien",
  },
  "package-progress": {
    contractCode: "Ma hop dong",
    customerName: "Ho ten hoi vien",
  },
  "card-revenue": {
    receiptCode: "Ma phieu",
    receiptDate: "Ngay thu",
    cardType: "Loai the",
  },
  "staff-review": {
    code: "Ma nhan vien",
    staffName: "Nhan vien",
  },
  "lead-status": {
    code: "Ma lead",
    leadName: "Ten lead",
    source: "Nguon lead",
    assignedTo: "Nhan vien phu trach",
    status: "Trang thai lead",
    potential: "Do nong",
    ageDays: "Tuoi lead",
    nextFollowUpAt: "Lan cham soc toi",
    appointmentAt: "Lich hen",
    urgency: "Muc uu tien",
    lastContactResult: "Ket qua gan nhat",
  },
};

const reportValueLabelOverridesByType: Record<string, Record<string, Record<string, string>>> = {
  "follow-up": {
    source: {
      "Facebook Ads": "Facebook Ads",
      WEBSITE: "Website",
      Website: "Website",
      REFERRAL: "Referral",
      Referral: "Referral",
      "FACEBOOK ADS": "Facebook Ads",
    },
  },
  payment: {
    type: {
      RECEIPT: "Phieu thu",
      EXPENSE: "Phieu chi",
      receipt: "Phieu thu",
      expense: "Phieu chi",
    },
    reference: {
      facility: "Co so vat chat",
      marketing: "Marketing",
      utilities: "Dien nuoc",
      equipment: "Thiet bi",
      office: "Van phong",
      payroll: "Luong / cong tac",
      PRO_SHOP_RETURN: "Tra hang Pro Shop",
    },
  },
  lead: {
    source: {
      "Facebook Ads": "Facebook Ads",
      WEBSITE: "Website",
      Website: "Website",
      REFERRAL: "Referral",
      Referral: "Referral",
      "FACEBOOK ADS": "Facebook Ads",
    },
  },
  "lead-status": {
    source: {
      "Facebook Ads": "Facebook Ads",
      WEBSITE: "Website",
      Website: "Website",
      REFERRAL: "Referral",
      Referral: "Referral",
      "FACEBOOK ADS": "Facebook Ads",
    },
  },
  "card-revenue": {
    sourceType: {
      contract: "Hop dong",
    },
  },
};

const reportFacetConfigByType: Record<string, ReportFacetConfig> = {
  checkin: { key: "membershipStatus", label: "Trang thai ky HD", allLabel: "All" },
  "staff-attendance": { key: "attendanceStatus", label: "Trang thai", allLabel: "All" },
  debt: { key: "collectionStatus", label: "Trang thai thu", allLabel: "All" },
  "follow-up": { key: "urgency", label: "Muc uu tien", allLabel: "All" },
  payment: { key: "type", label: "Loai phieu", allLabel: "All" },
  "contract-remain": { key: "status", label: "Trang thai hop dong", allLabel: "All" },
  deposit: { key: "status", label: "Tinh trang coc", allLabel: "All" },
  lead: { key: "status", label: "Trang thai lead", allLabel: "All" },
};

const normalizeSearchText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const isCurrencyKey = (key: string) => {
  const normalizedKey = key.toLowerCase();
  return ["amount", "revenue", "value", "price", "debt", "profit", "ticket", "holding", "returned", "budget", "collected"].some((token) =>
    normalizedKey.includes(token),
  );
};

const isPercentKey = (key: string) => {
  const normalizedKey = key.toLowerCase();
  return normalizedKey.includes("percent") || normalizedKey.includes("rate") || normalizedKey.includes("progress") || normalizedKey.includes("index");
};

const resolveReportValueLabel = (reportType: string, key: string, value: unknown) => {
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) return "";

  const override =
    reportValueLabelOverridesByType[reportType]?.[key]?.[normalizedValue] ||
    reportValueLabelOverridesByType[reportType]?.[key]?.[normalizedValue.toUpperCase()];

  return override ? translateText(override) : resolveTextDisplay(value, key);
};

const formatCell = (reportType: string, key: string, value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";

  const normalizedKey = key.toLowerCase();
  const stringValue = typeof value === "string" ? value : String(value);

  if (isCurrencyKey(normalizedKey)) {
    return formatCurrency(Number(value));
  }

  if (typeof value === "string" && (normalizedKey === "birthdate" || normalizedKey.includes("birthday"))) {
    return formatDate(stringValue);
  }

  if (/^\d{4}-\d{2}-\d{2}t/u.test(stringValue.toLowerCase())) {
    return formatDateTime(stringValue);
  }

  if (/^\d{4}-\d{2}-\d{2}$/u.test(stringValue)) {
    return formatDate(stringValue);
  }

  if (normalizedKey.includes("date") || normalizedKey.endsWith("at")) {
    return stringValue.includes("T") ? formatDateTime(stringValue) : formatDate(stringValue);
  }

  if (isPercentKey(normalizedKey)) {
    return `${formatNumber(Number(value || 0))}%`;
  }

  if (typeof value === "boolean") {
    return translateText(value ? "Co" : "Khong");
  }

  if (normalizedKey.includes("status") || ["type", "urgency", "priority", "potential"].includes(normalizedKey)) {
    return <StatusBadge value={String(value)} />;
  }

  if (typeof value === "number") {
    return formatNumber(value);
  }

  return resolveReportValueLabel(reportType, key, value);
};

const toLabel = (reportType: string, value: string) =>
  translateText(
    reportColumnLabelOverridesByType[reportType]?.[value] ||
      reportColumnLabelOverrides[value] ||
      value.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(),
  );

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

const getVisibleColumns = (reportType: string, rows: Array<Record<string, unknown>>) => {
  const availableColumns = new Set(rows[0] ? Object.keys(rows[0]) : []);

  const preferredColumns: Record<string, string[]> = {
    checkin: [
      "code",
      "customerName",
      "branch",
      "packageName",
      "trainerName",
      "bookedSessions",
      "checkedInSessions",
      "completedSessions",
      "missedSessions",
      "cancelledSessions",
      "consumedSessions",
      "attendanceRate",
      "completionRate",
      "remainingSessions",
      "lastScheduledAt",
      "lastCheckInAt",
      "outstandingDebt",
      "membershipStatus",
    ],
    "staff-attendance": [
      "staffCode",
      "staffName",
      "attendanceDate",
      "firstCheckInAt",
      "lastCheckOutAt",
      "attendanceStatus",
      "workedHours",
      "role",
      "shiftWindow",
      "machineNames",
      "branch",
      "attendanceCode",
    ],
    debt: [
      "contractCode",
      "customerName",
      "branch",
      "saleUser",
      "packageName",
      "totalAmount",
      "amountPaid",
      "amountDue",
      "remainingValue",
      "paymentStatus",
      "endDate",
      "daysToExpire",
      "collectionStatus",
      "priority",
    ],
    "branch-summary": [
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
    ],
    "branch-revenue": ["branch", "membershipRevenue", "ptRevenue", "depositRevenue"],
    "trainer-performance": ["code", "trainerName", "sessions", "completed", "missed", "activeCustomers"],
    "follow-up": [
      "code",
      "leadName",
      "branch",
      "source",
      "assignedTo",
      "status",
      "nextFollowUpAt",
      "appointmentAt",
      "lastContactResult",
      "urgency",
      "hasAppointment",
      "dueDate",
    ],
    payment: ["date", "type", "code", "branch", "partner", "reference", "amount", "note"],
    "contract-remain": ["code", "customer", "servicePackage", "originalValue", "usedValue", "remainingValue", "amountDue", "status"],
    deposit: ["code", "branch", "customer", "itemType", "amount", "receivedAt", "returnedAt", "status"],
    kpi: ["code", "name", "newContracts", "newLeads", "convertedLeads", "revenue", "actualRevenue", "kpiPercent"],
    lead: ["code", "customerName", "branch", "source", "status", "potential", "assignedTo", "nextFollowUpAt"],
    birthday: ["code", "customerName", "branch", "groupName", "phone", "birthDate", "nextBirthday", "daysUntilBirthday", "ageTurning", "membershipStatus", "outstandingDebt"],
    "pt-training": [
      "code",
      "trainerName",
      "branch",
      "specialty",
      "activeContracts",
      "activeCustomers",
      "scheduledSessions",
      "checkedInSessions",
      "completedSessions",
      "missedSessions",
      "totalMinutes",
      "completionRate",
      "utilizationRate",
      "supportedRevenue",
      "status",
    ],
    "class-attendance": [
      "sessionCode",
      "sessionDate",
      "branch",
      "location",
      "trainerName",
      "memberName",
      "packageName",
      "bookedMembers",
      "checkedInMembers",
      "completedMembers",
      "missedMembers",
      "cancelledMembers",
      "attendanceRate",
      "consumedSessions",
      "sessionStatus",
    ],
    allocation: [
      "branch",
      "activeMembers",
      "totalCustomers",
      "openLeads",
      "activeContracts",
      "activeTrainers",
      "scheduledSessions",
      "rentedLockers",
      "holdingDeposits",
      "collectedRevenue",
      "totalExpense",
      "customersPerTrainer",
      "sessionsPerTrainer",
    ],
    "sales-summary": [
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
    ],
    "package-progress": [
      "contractCode",
      "customerName",
      "branch",
      "packageName",
      "trainerName",
      "totalSessions",
      "usedSessions",
      "remainingSessions",
      "progressPercent",
      "remainingValue",
      "endDate",
      "daysToExpire",
      "paymentStatus",
      "contractStatus",
    ],
    "card-revenue": ["receiptCode", "receiptDate", "branch", "customerName", "contractCode", "cardType", "paymentMethod", "amount", "sourceType", "note"],
    "staff-review": [
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
    ],
    "lead-status": [
      "code",
      "leadName",
      "branch",
      "source",
      "assignedTo",
      "status",
      "potential",
      "createdAt",
      "ageDays",
      "budgetExpected",
      "nextFollowUpAt",
      "appointmentAt",
      "urgency",
      "lastContactResult",
    ],
  };

  const reportColumns = preferredColumns[reportType] || Array.from(availableColumns);
  return reportColumns.filter((column) => availableColumns.has(column));
};

const buildSummaryStripItems = (reportType: string, rows: Array<Record<string, unknown>>, summary: Record<string, number>) => {
  switch (reportType) {
    case "staff-attendance":
      return [{ key: "totalWorkedHours", label: "Tong gio", value: Number(summary.totalWorkedHours || 0), type: "number" as const }];
    case "debt":
      return [
        { key: "totalAmount", label: "Tong tien", value: rows.reduce((total, row) => total + Number(row.totalAmount || 0), 0), type: "currency" as const },
        { key: "amountPaid", label: "Da thanh toan", value: rows.reduce((total, row) => total + Number(row.amountPaid || 0), 0), type: "currency" as const },
        { key: "amountDue", label: "Cong no", value: rows.reduce((total, row) => total + Number(row.amountDue || 0), 0), type: "currency" as const },
      ];
    case "branch-summary":
      return [
        { key: "collectedRevenue", label: "Doanh thu", value: rows.reduce((total, row) => total + Number(row.collectedRevenue || 0), 0), type: "currency" as const },
        { key: "totalExpense", label: "Chi phi", value: rows.reduce((total, row) => total + Number(row.totalExpense || 0), 0), type: "currency" as const },
        { key: "netProfit", label: "Loi nhuan", value: rows.reduce((total, row) => total + Number(row.netProfit || 0), 0), type: "currency" as const },
      ];
    default:
      return [];
  }
};

const rowMatchesSearch = (row: Record<string, unknown>, keyword: string) => {
  if (!keyword.trim()) return true;
  const normalizedKeyword = normalizeSearchText(keyword);
  return Object.values(row).some((value) => normalizeSearchText(value).includes(normalizedKeyword));
};

const formatSummaryValue = (item: SummaryStripItem) => (item.type === "currency" ? formatCurrency(item.value) : formatNumber(item.value));

export function ReportWorkspace({ report }: { report: ReportDefinition }) {
  useLocale();
  const localizedReport = localizeReportDefinition(report);
  const { user, isReady } = useAuth();
  const reportType = localizedReport.baseKey || localizedReport.key;
  const canViewReport = !localizedReport.permission || user?.permissions.includes(localizedReport.permission);
  const canViewBranches = user?.permissions.includes("branches.view");
  const canViewSettings = user?.permissions.includes("settings.view");
  const [filters, setFilters] = useState<Record<string, string>>({
    branchId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(15);
  const [paginationState, setPaginationState] = useState<{ key: string; page: number }>({ key: "", page: 1 });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [modeFilter, setModeFilter] = useState(reportType === "checkin" ? "member" : reportType === "staff-attendance" ? "summary" : "default");
  const [statusFilter, setStatusFilter] = useState("");
  const [datePreset, setDatePreset] = useState<"custom" | "today">("custom");
  const effectiveBranchId = !isReady || canViewBranches || !user?.branchId || filters.branchId ? filters.branchId : user.branchId || "";
  const effectiveFilters = useMemo(() => ({ ...filters, branchId: effectiveBranchId }), [effectiveBranchId, filters]);
  const paginationResetKey = useMemo(
    () => JSON.stringify({ filters: effectiveFilters, modeFilter, pageSize, search, statusFilter }),
    [effectiveFilters, modeFilter, pageSize, search, statusFilter],
  );
  const currentPage = paginationState.key === paginationResetKey ? paginationState.page : 1;
  const setCurrentPage = (next: number | ((current: number) => number)) => {
    setPaginationState((current) => {
      const basePage = current.key === paginationResetKey ? current.page : 1;

      return {
        key: paginationResetKey,
        page: typeof next === "function" ? next(basePage) : next,
      };
    });
  };

  const branchesQuery = useQuery({
    queryKey: ["report-branches"],
    enabled: isReady && canViewReport && canViewBranches,
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/branches", { params: { pageSize: 100 } });
      return response.data.data;
    },
  });

  const reportQuery = useQuery({
    queryKey: ["report", reportType, effectiveFilters],
    enabled: isReady && canViewReport,
    queryFn: async () => {
      const response = await api.get<ReportPayload>(localizedReport.endpoint, { params: effectiveFilters });
      return response.data;
    },
  });

  const reportTemplateQuery = useQuery({
    queryKey: ["setting", "report-templates", effectiveFilters.branchId || ""],
    enabled: isReady && canViewReport && canViewSettings,
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>>("/settings/report-templates", {
        params: effectiveFilters.branchId ? { branchId: effectiveFilters.branchId } : undefined,
      });
      return response.data;
    },
  });

  const rows = useMemo(() => reportQuery.data?.rows || [], [reportQuery.data?.rows]);
  const facetConfig = reportFacetConfigByType[reportType];
  const visibleColumns = useMemo(() => getVisibleColumns(reportType, rows), [reportType, rows]);
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (!rowMatchesSearch(row, search)) return false;

      if (facetConfig?.key && statusFilter) {
        return String(row[facetConfig.key] || "") === statusFilter;
      }

      return true;
    });
  }, [facetConfig, rows, search, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const paginatedRows = useMemo(() => filteredRows.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize), [filteredRows, pageSize, safeCurrentPage]);

  const summaryEntries = useMemo(
    () =>
      localizedReport.summaryKeys.map((item) => ({
        ...item,
        value: Number(reportQuery.data?.summary?.[item.key] || 0),
        isMoney: isCurrencyKey(item.key),
      })),
    [localizedReport.summaryKeys, reportQuery.data?.summary],
  );

  const printSummary = useMemo(
    () =>
      summaryEntries.map((item) => ({
        label: item.label,
        value: item.value,
        type: item.isMoney ? ("currency" as const) : ("text" as const),
      })),
    [summaryEntries],
  );

  const activeFilters = useMemo(
    () =>
      Object.entries(effectiveFilters)
        .filter(([, value]) => value)
        .map(([key, value]) => ({
          label: toLabel(reportType, key),
          value: key === "dateFrom" || key === "dateTo" ? formatDate(value) : value,
        })),
    [effectiveFilters, reportType],
  );

  const printFilters = useMemo(
    () =>
      activeFilters.map((item) => ({
        label: item.label,
        value: item.value,
      })),
    [activeFilters],
  );

  const summaryStripItems = useMemo(
    () => {
      const customItems = buildSummaryStripItems(reportType, rows, reportQuery.data?.summary || {});
      if (customItems.length) {
        return customItems;
      }

      return summaryEntries.map((item) => ({
        key: item.key,
        label: item.label,
        value: item.value,
        type: item.isMoney ? ("currency" as const) : ("number" as const),
      }));
    },
    [reportType, rows, reportQuery.data?.summary, summaryEntries],
  );

  const branchOptions = useMemo(
    () =>
      canViewBranches
        ? (branchesQuery.data || []).map((branch) => ({
            label: String(branch.name || branch.code || translateText("Chi nhanh")),
            value: String(branch.id),
          }))
        : user?.branchId
          ? [{ label: String(user.branchName || translateText("Chi nhanh hien tai")), value: String(user.branchId) }]
          : [],
    [branchesQuery.data, canViewBranches, user],
  );

  const statusOptions = useMemo(() => {
    if (!facetConfig?.key) return [];

    return Array.from(new Set(rows.map((row) => String(row[facetConfig.key] || "")).filter(Boolean))).map((value) => ({
      label: resolveReportValueLabel(reportType, facetConfig.key, value),
      value,
    }));
  }, [facetConfig, reportType, rows]);

  const reportModeOptions =
    reportType === "checkin"
      ? [
          { label: "Check-in hoi vien", value: "member" },
          { label: "Check-in PT", value: "pt" },
        ]
      : reportType === "staff-attendance"
        ? [
            { label: "Tong hop theo ngay", value: "summary" },
            { label: "Chi tiet cham cong", value: "detail" },
            { label: "Log cham cong", value: "log" },
          ]
        : [];

  if (isReady && !canViewReport) {
    return (
      <EmptyState
        description={translateText("Vai trò hiện tại chưa được cấp quyền cho báo cáo này. Hãy mở Vai trò và bật quyền báo cáo chi tiết tương ứng.")}
        title={translateText("Không có quyền xem báo cáo")}
      />
    );
  }

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    const response = await api.get(localizedReport.endpoint, {
      params: { ...effectiveFilters, format },
      responseType: "blob",
    });
    downloadBlob(response.data, `${reportType}.${format}`);
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    printReportDocument({
      reportKey: reportType,
      title: localizedReport.title,
      subtitle: localizedReport.subtitle,
      summary: printSummary,
      filters: printFilters,
      rows: filteredRows,
      columns: visibleColumns,
      template: reportTemplateQuery.data,
      generatedBy: user?.fullName || user?.username,
    });
    setShowExportMenu(false);
  };

  const handleTodayPreset = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDatePreset("today");
    setFilters((current) => ({ ...current, dateFrom: today, dateTo: today }));
  };

  const handleCustomPreset = () => {
    setDatePreset("custom");
  };

  const shouldShowLoading = reportQuery.isLoading && !reportQuery.data;
  const rangeStart = filteredRows.length ? (safeCurrentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = filteredRows.length ? Math.min(filteredRows.length, safeCurrentPage * pageSize) : 0;

  return (
    <div className="rounded-md border-[5px] border-emerald-500 bg-[#f5f5f5] p-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <div className="grid gap-3 xl:grid-cols-[168px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="flex items-start justify-between px-2 pt-1">
            <div className="space-y-1">
              <h1 className="max-w-[120px] text-[16px] font-semibold leading-6 text-slate-900">{localizedReport.title}</h1>
              {localizedReport.subtitle ? <p className="max-w-[132px] text-[11px] leading-5 text-slate-500">{localizedReport.subtitle}</p> : null}
            </div>
            <button className="rounded-sm p-1 text-emerald-700" type="button">
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </div>

          {reportModeOptions.length ? (
            <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-slate-900">{translateText(reportType === "checkin" ? "Loai bao cao" : "Tong hop theo ngay")}</p>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
              <div className="space-y-2 text-[12px] text-slate-700">
                {reportModeOptions.map((option) => (
                  <label className="flex items-center gap-2" key={option.value}>
                    <input checked={modeFilter === option.value} name={`${reportType}-mode`} onChange={() => setModeFilter(option.value)} type="radio" />
                    <span>{translateText(option.label)}</span>
                  </label>
                ))}
              </div>
            </section>
          ) : null}

            <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-slate-900">{translateText("Chi nhanh")}</p>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] outline-none transition focus:border-emerald-400"
              onChange={(event) => setFilters((current) => ({ ...current, branchId: event.target.value }))}
              value={effectiveFilters.branchId}
            >
              <option value="">{translateText("All")}</option>
              {branchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-semibold text-slate-900">{translateText(reportType === "debt" ? "Ngay hop dong" : "Thoi gian")}</p>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </div>
            <div className="space-y-2 text-[12px] text-slate-700">
              <label className="flex items-center gap-2">
                <input checked={datePreset === "today"} name={`${reportType}-date-preset`} onChange={handleTodayPreset} type="radio" />
                <span>{translateText("Hom nay")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input checked={datePreset === "custom"} name={`${reportType}-date-preset`} onChange={handleCustomPreset} type="radio" />
                <span>{translateText("Lua chon khac")}</span>
              </label>
            </div>
            <div className="mt-3 space-y-2">
              <input
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] outline-none transition focus:border-emerald-400"
                onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                type="date"
                value={filters.dateFrom}
              />
              <input
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] outline-none transition focus:border-emerald-400"
                onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                type="date"
                value={filters.dateTo}
              />
            </div>
          </section>

          {statusOptions.length ? (
            <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-slate-900">{translateText(facetConfig?.label || "Trang thai")}</p>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
              <div className="space-y-2 text-[12px] text-slate-700">
                <label className="flex items-center gap-2">
                  <input checked={!statusFilter} name={`${reportType}-status`} onChange={() => setStatusFilter("")} type="radio" />
                  <span>{translateText(facetConfig?.allLabel || "All")}</span>
                </label>
                {statusOptions.map((option) => (
                  <label className="flex items-center gap-2" key={option.value}>
                    <input checked={statusFilter === option.value} name={`${reportType}-status`} onChange={() => setStatusFilter(option.value)} type="radio" />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          <div className="px-2 pt-1">
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="font-semibold text-slate-700">{translateText("So ban ghi")}:</span>
              <select
                className="h-8 rounded-md border border-transparent bg-transparent pr-5 text-right text-[12px] outline-none"
                onChange={(event) => setPageSize(Number(event.target.value))}
                value={pageSize}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[280px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-emerald-400"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={translateText(reportSearchPlaceholders[reportType] || "Tim kiem theo ten, ma, noi dung lien quan...")}
                value={search}
              />
            </div>

            <div className="relative ml-auto flex items-center gap-2">
              {reportType === "checkin" ? (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-[12px] font-semibold text-white transition hover:bg-emerald-700"
                  onClick={() => void reportQuery.refetch()}
                  type="button"
                >
                  <RefreshCw className="h-4 w-4" />
                  {translateText("Dong bo checkin")}
                </button>
              ) : null}

              <button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-[12px] font-semibold text-white transition hover:bg-emerald-700"
                onClick={() => setShowExportMenu((current) => !current)}
                type="button"
              >
                <Download className="h-4 w-4" />
                {translateText("Export")}
              </button>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white transition hover:bg-emerald-700"
                onClick={() => setShowExportMenu((current) => !current)}
                type="button"
              >
                <Menu className="h-4 w-4" />
              </button>

              {showExportMenu ? (
                <div className="absolute right-0 top-12 z-20 min-w-[180px] rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                  <button className="flex w-full items-center rounded px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50" onClick={() => void handleExport("csv")} type="button">
                    {translateText("Export CSV")}
                  </button>
                  <button className="flex w-full items-center rounded px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50" onClick={() => void handleExport("xlsx")} type="button">
                    {translateText("Export Excel")}
                  </button>
                  <button className="flex w-full items-center rounded px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50" onClick={() => void handleExport("pdf")} type="button">
                    {translateText("Export PDF")}
                  </button>
                  <button className="flex w-full items-center rounded px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50" onClick={handlePrint} type="button">
                    {translateText("Print")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {summaryStripItems.length ? (
            <div className="flex flex-wrap justify-end gap-10 px-2 pt-1 text-right">
              {summaryStripItems.map((item) => (
                <div key={item.key}>
                  <p className="text-[12px] font-semibold text-slate-700">{translateText(item.label)}</p>
                  <p className="mt-1 text-[18px] font-semibold text-sky-500">{formatSummaryValue(item)}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            {shouldShowLoading ? (
              <div className="h-56 animate-pulse bg-slate-100" />
            ) : reportQuery.isError ? (
              <div className="p-6">
                <EmptyState description={translateText("Không tải được báo cáo. Hãy kiểm tra API, quyền và seed data.")} title={translateText("Báo cáo gặp lỗi")} />
              </div>
            ) : (
              <>
                <div className="overflow-auto">
                  <table className="min-w-full text-[11px]">
                    <thead className="bg-slate-100 text-left text-slate-600">
                      <tr>
                        <th className="w-12 px-3 py-2.5 text-center font-semibold">
                          <input type="checkbox" />
                        </th>
                        {visibleColumns.map((column) => (
                          <th className="whitespace-nowrap px-3 py-2.5 font-semibold" key={column}>
                            {toLabel(reportType, column)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.length ? (
                        paginatedRows.map((row, index) => (
                          <tr className="border-t border-slate-100 hover:bg-emerald-50/35" key={`${safeCurrentPage}-${index}`}>
                            <td className="px-3 py-2.5 text-center">
                              <input type="checkbox" />
                            </td>
                            {visibleColumns.map((column) => (
                              <td className="whitespace-nowrap px-3 py-2.5 align-top text-slate-800" key={column}>
                                {formatCell(reportType, column, row[column])}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-8 text-center text-[12px] text-slate-500" colSpan={visibleColumns.length + 1}>
                            {translateText("Khong co ban ghi phu hop")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1">
                    <button className="rounded p-1 hover:bg-slate-200 disabled:opacity-40" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(1)} type="button">
                      <ChevronsLeft className="h-3.5 w-3.5" />
                    </button>
                    <button className="rounded p-1 hover:bg-slate-200 disabled:opacity-40" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage((current) => Math.max(1, current - 1))} type="button">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="inline-flex min-w-[28px] items-center justify-center rounded bg-slate-300 px-2 py-1 text-slate-700">{safeCurrentPage}</span>
                    <button className="rounded p-1 hover:bg-slate-200 disabled:opacity-40" disabled={safeCurrentPage >= pageCount} onClick={() => setCurrentPage((current) => Math.min(pageCount, current + 1))} type="button">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button className="rounded p-1 hover:bg-slate-200 disabled:opacity-40" disabled={safeCurrentPage >= pageCount} onClick={() => setCurrentPage(pageCount)} type="button">
                      <ChevronsRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>{`${rangeStart} - ${rangeEnd} / ${filteredRows.length} ${translateText(filteredRows.length === 1 ? "record" : "records")}`}</div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
