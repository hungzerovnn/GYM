"use client";

import { useEffect, useMemo, useRef, useState, type WheelEventHandler } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { CalendarDays, Eye, MapPin, Pencil, Phone, Printer, Trash2, UserSquare2, Wallet } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";
import { ResourceColumn } from "@/types/portal";
import { StatusBadge } from "../shared/status-badge";
import { ColumnSelector } from "./column-selector";

interface SmartDataTableProps {
  columns: ResourceColumn[];
  rows: Record<string, unknown>[];
  onView: (row: Record<string, unknown>) => void;
  onEdit?: ((row: Record<string, unknown>) => void) | undefined;
  onDelete?: ((row: Record<string, unknown>) => void) | undefined;
  onPrint?: (row: Record<string, unknown>) => void;
}

type ColumnMeta = Pick<ResourceColumn, "minWidth" | "align" | "wrap" | "multiline">;

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

const PERSON_COLUMN_KEYS = new Set([
  "fullName",
  "assignedUserName",
  "saleUserName",
  "trainerName",
  "collectorName",
  "approverName",
  "createdUserName",
  "staffName",
  "memberName",
  "leadName",
  "assignedTo",
  "saleUser",
  "currentCustomerName",
]);
const STAFF_INFO_BUNDLE_KEYS = new Set(["staffInfo"]);
const STAFF_WORK_BUNDLE_KEYS = new Set(["staffWorkInfo"]);
const STAFF_ROLES_BUNDLE_KEYS = new Set(["staffRolesInfo"]);
const STAFF_ACCOUNT_BUNDLE_KEYS = new Set(["staffAccountInfo"]);
const REGISTRATION_BUNDLE_KEYS = new Set(["registrationDate"]);
const PACKAGE_TIME_BUNDLE_KEYS = new Set(["startDate", "endDate", "startTrainingDate", "endTrainingDate"]);
const USAGE_BUNDLE_KEYS = new Set(["sessionUsage", "remainingSessions", "daysRemaining"]);

const AVATAR_SOURCE_KEYS_BY_COLUMN: Record<string, string[]> = {
  customerInfo: ["avatarUrl", "customerAvatarUrl"],
  customerName: ["customerAvatarUrl", "avatarUrl"],
  currentCustomerName: ["currentCustomerAvatarUrl", "customerAvatarUrl"],
  leadInfo: ["leadAvatarUrl"],
  fullName: ["avatarUrl"],
  staffInfo: ["avatarUrl"],
  assignedUserName: ["assignedUserAvatarUrl"],
  saleUserName: ["saleUserAvatarUrl"],
  trainerName: ["trainerAvatarUrl"],
  collectorName: ["collectorAvatarUrl"],
  approverName: ["approverAvatarUrl"],
  createdUserName: ["createdUserAvatarUrl"],
  staffName: ["staffAvatarUrl"],
  memberName: ["customerAvatarUrl"],
  leadName: ["leadAvatarUrl"],
  assignedTo: ["assignedToAvatarUrl", "assignedUserAvatarUrl"],
  saleUser: ["saleUserAvatarUrl"],
};

const resolveAvatarUrl = (row: Record<string, unknown>, columnKey?: string) => {
  const sourceKeys = columnKey ? AVATAR_SOURCE_KEYS_BY_COLUMN[columnKey] || [] : [];
  const candidates =
    sourceKeys.length > 0
      ? sourceKeys.map((key) => row[key])
      : [row.avatarUrl, row.photoUrl, row.imageUrl, row.profileImageUrl];
  const resolved = candidates.find((item) => typeof item === "string" && item.trim().length > 0);
  return typeof resolved === "string" ? resolved.trim() : "";
};

const hasMeaningfulValue = (value: unknown) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

const getFirstValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (hasMeaningfulValue(value)) {
      return String(value);
    }
  }

  return "";
};

const formatDateValue = (value: unknown) => (hasMeaningfulValue(value) ? formatDate(String(value)) : "");
const formatCurrencyValue = (value: unknown) => (hasMeaningfulValue(value) ? formatCurrency(Number(value || 0)) : "");
const formatNumberValue = (value: unknown) => (hasMeaningfulValue(value) ? String(value) : "");

type CompactLine = {
  icon?: React.ReactNode;
  text: string;
  tone?: "muted" | "accent" | "warning" | "danger" | "normal";
};

function CompactInfoCell({
  avatarUrl,
  title,
  titleNode,
  lines,
  showAvatar = false,
}: {
  avatarUrl?: string;
  title?: string;
  titleNode?: React.ReactNode;
  lines: CompactLine[];
  showAvatar?: boolean;
}) {
  const [hasError, setHasError] = useState(false);
  const normalizedTitle = String(title || "").trim();
  const initials = getAvatarInitials(normalizedTitle || "-");
  const visibleLines = lines.filter((item) => item.text.trim().length > 0);

  return (
    <div className="flex min-w-0 items-start gap-2">
      {showAvatar ? (
        avatarUrl && !hasError ? (
          <img
            alt={normalizedTitle || "Avatar"}
            className="mt-0.5 h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover"
            onError={() => setHasError(true)}
            src={avatarUrl}
          />
        ) : (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700">
            {initials}
          </div>
        )
      ) : null}
      <div className="min-w-0 space-y-1">
        {titleNode ? <div className="min-w-0 text-[11px] font-semibold leading-[1.3] text-slate-900">{titleNode}</div> : null}
        {!titleNode && normalizedTitle ? <p className="min-w-0 text-[11px] font-semibold leading-[1.3] text-slate-900">{normalizedTitle}</p> : null}
        {visibleLines.map((line, index) => (
          <div
            className={`flex min-w-0 items-start gap-1.5 text-[10px] leading-[1.3] ${
              line.tone === "accent"
                ? "text-emerald-700"
                : line.tone === "warning"
                  ? "text-amber-700"
                : line.tone === "danger"
                  ? "text-rose-600"
                  : line.tone === "muted"
                    ? "text-slate-500"
                    : "text-slate-700"
            }`}
            key={`${line.text}-${index}`}
          >
            {line.icon ? <span className="mt-[1px] shrink-0">{line.icon}</span> : null}
            <span className="min-w-0 whitespace-normal break-words">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const isCustomerContextRow = (row: Record<string, unknown>) =>
  ["customerInfo", "customerName", "servicePackageName", "contractPackageName", "customerPhone", "membershipStatus", "contractCode"].some((key) => hasMeaningfulValue(row[key]));

const buildCustomerLines = (row: Record<string, unknown>) => {
  const code = getFirstValue(row, ["fingerprintCode", "customerCode", "code", "employeeCode", "attendanceCode"]);
  const phone = getFirstValue(row, ["customerPhone", "phone", "contactPhone"]);
  const branch = getFirstValue(row, ["branchName"]);

  return [
    { icon: <UserSquare2 className="h-3 w-3" />, text: code, tone: "accent" as const },
    { icon: <Phone className="h-3 w-3" />, text: phone },
    { icon: <MapPin className="h-3 w-3" />, text: branch, tone: "muted" as const },
  ];
};

const buildLeadLines = (row: Record<string, unknown>) => {
  const code = getFirstValue(row, ["code"]);
  const phone = getFirstValue(row, ["phone", "customerPhone"]);
  const email = getFirstValue(row, ["email"]);
  const branch = getFirstValue(row, ["branchName"]);

  return [
    { icon: <UserSquare2 className="h-3 w-3" />, text: code, tone: "accent" as const },
    { icon: <Phone className="h-3 w-3" />, text: phone },
    { text: email, tone: "muted" as const },
    { icon: <MapPin className="h-3 w-3" />, text: branch, tone: "muted" as const },
  ];
};

const buildContractLines = (row: Record<string, unknown>) => {
  const contractDate = formatDateValue(getFirstValue(row, ["registrationDate", "contractDate", "createdAt"]));
  const startDate = formatDateValue(getFirstValue(row, ["startDate", "startTrainingDate"]));
  const endDate = formatDateValue(getFirstValue(row, ["endDate", "endTrainingDate"]));
  const branch = getFirstValue(row, ["branchName"]);
  const referenceCode = getFirstValue(row, ["oldContractCode", "contractCode"]);

  return [
    { icon: <CalendarDays className="h-3 w-3" />, text: contractDate ? `${translateText("Ngay")}: ${contractDate}` : "" },
    { icon: <CalendarDays className="h-3 w-3" />, text: startDate || endDate ? `${translateText("Tu")}: ${startDate || "-"} • ${translateText("Den")}: ${endDate || "-"}` : "" },
    { icon: <MapPin className="h-3 w-3" />, text: branch, tone: "muted" as const },
    { icon: <UserSquare2 className="h-3 w-3" />, text: referenceCode ? `${translateText("Tham chieu")}: ${referenceCode}` : "", tone: "muted" as const },
  ];
};

const buildServiceLines = (row: Record<string, unknown>) => {
  const serviceName = getFirstValue(row, ["serviceName"]);
  const saleName = getFirstValue(row, ["saleUserName", "assignedUserName"]);
  const trainerName = getFirstValue(row, ["trainerName"]);

  return [
    { text: serviceName && serviceName !== getFirstValue(row, ["servicePackageName", "contractPackageName"]) ? serviceName : "", tone: "muted" as const },
    { text: [saleName ? `${translateText("Sale")}: ${saleName}` : "", trainerName ? `${translateText("PT")}: ${trainerName}` : ""].filter(Boolean).join(" • "), tone: "muted" as const },
  ];
};

const buildRegistrationLines = (row: Record<string, unknown>) => {
  const groupName = getFirstValue(row, ["groupName"]);
  const assignedUserName = getFirstValue(row, ["assignedUserName", "saleUserName", "trainerName"]);
  const profileCount = formatNumberValue(getFirstValue(row, ["profileCount"]));

  return [
    { icon: <UserSquare2 className="h-3 w-3" />, text: groupName ? `${translateText("Nhom")}: ${groupName}` : "" },
    { icon: <UserSquare2 className="h-3 w-3" />, text: assignedUserName ? `${translateText("Phu trach")}: ${assignedUserName}` : "" },
    { text: profileCount ? `${translateText("So ho so")}: ${profileCount}` : "", tone: "muted" as const },
  ];
};

const buildPackageTimeLines = (row: Record<string, unknown>) => {
  const startDate = formatDateValue(getFirstValue(row, ["startDate", "startTrainingDate"]));
  const endDate = formatDateValue(getFirstValue(row, ["membershipEndDate", "endDate", "endTrainingDate"]));
  const membershipAlertStatus = getFirstValue(row, ["membershipAlertStatus"]);
  const membershipStatus = getFirstValue(row, ["membershipStatus"]);
  const rawMembershipDaysRemaining = getFirstValue(row, ["membershipDaysRemaining", "daysRemaining"]);
  const membershipDaysRemaining = rawMembershipDaysRemaining ? Number(rawMembershipDaysRemaining) : Number.NaN;
  const isExpired = membershipAlertStatus === "EXPIRED" || membershipStatus === "EXPIRED";
  const isDueSoon = membershipAlertStatus === "DUE_SOON";
  const daysRemainingText =
    Number.isFinite(membershipDaysRemaining) && membershipDaysRemaining > 0 && !isDueSoon
      ? `${translateText("Con lai")}: ${membershipDaysRemaining} ${translateText("ngay")}`
      : "";
  const warningText = isExpired
    ? `${translateText("Qua han")}: ${Math.abs(Number.isFinite(membershipDaysRemaining) ? membershipDaysRemaining : 0)} ${translateText("ngay")}`
    : isDueSoon && Number.isFinite(membershipDaysRemaining)
      ? membershipDaysRemaining === 0
        ? translateText("Het han hom nay")
        : `${translateText("Sap het han")}: ${membershipDaysRemaining} ${translateText("ngay")}`
      : "";

  return [
    { icon: <CalendarDays className="h-3 w-3" />, text: startDate ? `${translateText("Bat dau")}: ${startDate}` : "" },
    { icon: <CalendarDays className="h-3 w-3" />, text: endDate ? `${translateText("Het han")}: ${endDate}` : "", tone: isExpired ? "danger" as const : isDueSoon ? "warning" as const : "normal" as const },
    { text: daysRemainingText, tone: "accent" as const },
    { text: warningText, tone: isExpired ? "danger" as const : "warning" as const },
  ];
};

const buildUsageLines = (row: Record<string, unknown>) => {
  const sessionUsage = formatNumberValue(getFirstValue(row, ["sessionUsage"]));
  const remainingSessions = formatNumberValue(getFirstValue(row, ["remainingSessions"]));
  const totalSessions = formatNumberValue(getFirstValue(row, ["totalSessions"]));
  const bonusSessions = formatNumberValue(getFirstValue(row, ["bonusSessions"]));
  const remainingValue = formatCurrencyValue(getFirstValue(row, ["remainingValue"]));

  return [
    { text: sessionUsage ? `${translateText("Da dung / Tong")}: ${sessionUsage}` : "" },
    { text: totalSessions || remainingSessions ? `${translateText("Buoi")}: ${remainingSessions || "0"} / ${totalSessions || "-"}` : "" },
    { text: bonusSessions ? `${translateText("Buoi KM")}: ${bonusSessions}` : "" },
    { text: remainingValue ? `${translateText("Gia tri con lai")}: ${remainingValue}` : "", tone: "accent" as const },
  ];
};

const buildStaffInfoLines = (row: Record<string, unknown>) => {
  const employeeCode = getFirstValue(row, ["employeeCode", "code"]);
  const username = getFirstValue(row, ["username"]);
  const phone = getFirstValue(row, ["phone"]);

  return [
    { icon: <UserSquare2 className="h-3 w-3" />, text: employeeCode, tone: "accent" as const },
    { text: username ? `${translateText("Dang nhap")}: ${username}` : "", tone: "muted" as const },
    { icon: <Phone className="h-3 w-3" />, text: phone },
  ];
};

const buildStaffWorkLines = (row: Record<string, unknown>) => {
  const branchName = getFirstValue(row, ["branchName"]);
  const attendanceCode = getFirstValue(row, ["attendanceCode"]);
  const email = getFirstValue(row, ["email"]);

  return [
    { icon: <MapPin className="h-3 w-3" />, text: branchName, tone: "muted" as const },
    { icon: <UserSquare2 className="h-3 w-3" />, text: attendanceCode ? `${translateText("Ma cham cong")}: ${attendanceCode}` : "" },
    { text: email, tone: "muted" as const },
  ];
};

const buildStaffAccountLines = (row: Record<string, unknown>) => {
  const lastLogin = formatDateValue(getFirstValue(row, ["lastLoginDateTime"]));
  const permissionCount = formatNumberValue(getFirstValue(row, ["permissionCount"]));

  return [
    {
      icon: <CalendarDays className="h-3 w-3" />,
      text: lastLogin ? `${translateText("Dang nhap cuoi")}: ${lastLogin}` : translateText("Chua dang nhap"),
      tone: lastLogin ? ("normal" as const) : ("muted" as const),
    },
    { text: permissionCount ? `${translateText("So quyen")}: ${permissionCount}` : "", tone: "muted" as const },
  ];
};

const renderCustomerBundle = (row: Record<string, unknown>, displayValue: string) => {
  const title = getFirstValue(row, ["fullName", "customerName", "currentCustomerName"]) || displayValue;
  return <CompactInfoCell avatarUrl={resolveAvatarUrl(row, "customerName")} lines={buildCustomerLines(row)} showAvatar title={title} />;
};

const renderLeadBundle = (row: Record<string, unknown>, displayValue: string) => {
  const title =
    getFirstValue(row, ["fullName", "leadName"]) ||
    String(displayValue || "")
      .split("|")[0]
      ?.trim() ||
    displayValue;
  return <CompactInfoCell avatarUrl={resolveAvatarUrl(row, "leadInfo")} lines={buildLeadLines(row)} showAvatar title={title} />;
};

const renderContractBundle = (row: Record<string, unknown>, displayValue: string) => {
  return <CompactInfoCell lines={buildContractLines(row)} title={displayValue} />;
};

const renderServiceBundle = (row: Record<string, unknown>, displayValue: string) => {
  const statusValue = getFirstValue(row, ["status"]);
  const paymentStatusValue = getFirstValue(row, ["paymentStatus"]);

  return (
    <CompactInfoCell
      lines={buildServiceLines(row)}
      titleNode={
        <div className="space-y-1">
          <div className="whitespace-normal break-words leading-[1.3]">{displayValue || "-"}</div>
          <div className="flex flex-wrap gap-1">
            {statusValue ? <StatusBadge value={statusValue} /> : null}
            {paymentStatusValue ? <StatusBadge value={paymentStatusValue} /> : null}
          </div>
        </div>
      }
      title=""
    />
  );
};

const renderPaymentBundle = (row: Record<string, unknown>, displayValue: string) => {
  const totalAmount = formatCurrencyValue(getFirstValue(row, ["totalAmount", "amount"]));
  const amountPaid = formatCurrencyValue(getFirstValue(row, ["amountPaid"]));
  const amountDue = formatCurrencyValue(getFirstValue(row, ["amountDue"]));
  const remainingValue = formatCurrencyValue(getFirstValue(row, ["remainingValue"]));

  return (
    <CompactInfoCell
      lines={[
        { icon: <Wallet className="h-3 w-3" />, text: totalAmount ? `${translateText("Tong tien")}: ${totalAmount}` : "" },
        { text: amountPaid ? `${translateText("Da TT")}: ${amountPaid}` : "", tone: "accent" },
        { text: amountDue ? `${translateText("Con no")}: ${amountDue}` : "", tone: amountDue === formatCurrency(0) ? "accent" : "danger" },
        { text: remainingValue ? `${translateText("Gia tri con lai")}: ${remainingValue}` : "", tone: "muted" },
      ]}
      titleNode={displayValue ? <StatusBadge value={displayValue} /> : undefined}
      title=""
    />
  );
};

const renderRegistrationBundle = (row: Record<string, unknown>) => {
  const registrationDate = formatDateValue(getFirstValue(row, ["registrationDate"]));
  return <CompactInfoCell lines={buildRegistrationLines(row)} title={registrationDate || translateText("Dang ky")} />;
};

const renderPackageTimeBundle = (row: Record<string, unknown>) => {
  const startDate = formatDateValue(getFirstValue(row, ["startDate", "startTrainingDate"]));
  const endDate = formatDateValue(getFirstValue(row, ["membershipEndDate", "endDate", "endTrainingDate"]));
  return <CompactInfoCell lines={buildPackageTimeLines(row)} title={endDate || startDate || translateText("Thoi gian")} />;
};

const renderUsageBundle = (row: Record<string, unknown>, displayValue: string) => {
  const title = displayValue || getFirstValue(row, ["daysRemaining"]) || translateText("Tien do");
  return <CompactInfoCell lines={buildUsageLines(row)} title={title} />;
};

const renderStaffInfoBundle = (row: Record<string, unknown>, displayValue: string) => {
  const title = getFirstValue(row, ["fullName", "staffName"]) || displayValue;
  return <CompactInfoCell avatarUrl={resolveAvatarUrl(row, "staffInfo")} lines={buildStaffInfoLines(row)} showAvatar title={title} />;
};

const renderStaffWorkBundle = (row: Record<string, unknown>) => {
  const title = getFirstValue(row, ["title"]) || translateText("Chua cap chuc danh");
  return <CompactInfoCell lines={buildStaffWorkLines(row)} title={title} />;
};

const renderStaffRolesBundle = (row: Record<string, unknown>, displayValue: string) => {
  const roleNames = getFirstValue(row, ["roleNames"]);
  const normalizedDisplayValue = displayValue === "-" ? "" : displayValue;
  const content = roleNames || normalizedDisplayValue;

  return (
    <CompactInfoCell
      lines={[]}
      titleNode={<div className="whitespace-normal break-words leading-[1.4]">{content || translateText("Chua gan vai tro")}</div>}
      title=""
    />
  );
};

const renderStaffAccountBundle = (row: Record<string, unknown>) => {
  const statusValue = getFirstValue(row, ["status"]);

  return (
    <CompactInfoCell
      lines={buildStaffAccountLines(row)}
      titleNode={statusValue ? <StatusBadge value={statusValue} /> : <span>{translateText("Chua cap")}</span>}
      title=""
    />
  );
};

const getAvatarInitials = (label: string) => {
  const parts = label
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!parts.length) return "?";

  return parts
    .slice(0, 2)
    .map((item) => item.charAt(0).toUpperCase())
    .join("");
};

function AvatarCell({ avatarUrl, label }: { avatarUrl: string; label: string }) {
  const [hasError, setHasError] = useState(false);
  const initials = getAvatarInitials(label);

  return (
    <div className="flex min-w-0 items-center gap-2">
      {avatarUrl && !hasError ? (
        <img
          alt={label || "Avatar"}
          className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover"
          onError={() => setHasError(true)}
          src={avatarUrl}
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-700">
          {initials}
        </div>
      )}
      <span className="min-w-0 whitespace-normal break-words leading-[1.3] text-slate-900">{label || "-"}</span>
    </div>
  );
}

const renderPersonCell = (row: Record<string, unknown>, displayValue: string, columnKey: string) => (
  <AvatarCell avatarUrl={resolveAvatarUrl(row, columnKey)} label={displayValue} />
);

const getCellTitle = (
  columns: ResourceColumn[],
  columnKey: string,
  rawValue: unknown,
  row: Record<string, unknown>,
) => {
  const column = columns.find((item) => item.key === columnKey);
  if (!column) {
    return String(rawValue ?? "");
  }

  if (column.type === "currency") {
    return formatCurrency(rawValue as number);
  }

  if (column.type === "date") {
    return formatDate(String(rawValue || ""));
  }

  return resolveTextDisplay(rawValue, column.key, row);
};

const getResponsiveVisibleColumns = (columns: ResourceColumn[], viewportWidth: number) => {
  const filtered = columns.filter((column) => {
    if (viewportWidth < MOBILE_BREAKPOINT && column.hideOnMobile) {
      return false;
    }

    if (viewportWidth < TABLET_BREAKPOINT && column.hideOnTablet) {
      return false;
    }

    return true;
  });

  return (filtered.length ? filtered : columns).map((column) => column.key);
};

export function SmartDataTable({ columns, rows, onView, onEdit, onDelete, onPrint }: SmartDataTableProps) {
  const [visibleColumns, setVisibleColumns] = useState(columns.map((column) => column.key));
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const [hasCustomColumnSelection, setHasCustomColumnSelection] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const columnHelper = createColumnHelper<Record<string, unknown>>();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncVisibleColumns = () => {
      if (hasCustomColumnSelection) return;
      setVisibleColumns(getResponsiveVisibleColumns(columns, window.innerWidth));
    };

    syncVisibleColumns();
    window.addEventListener("resize", syncVisibleColumns);

    return () => {
      window.removeEventListener("resize", syncVisibleColumns);
    };
  }, [columns, hasCustomColumnSelection]);

  useEffect(() => {
    const updateOverflow = () => {
      const element = scrollContainerRef.current;
      setHasHorizontalOverflow(Boolean(element && element.scrollWidth > element.clientWidth + 1));
    };

    const frame = window.requestAnimationFrame(updateOverflow);
    window.addEventListener("resize", updateOverflow);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateOverflow);
    };
  }, [columns, rows.length, visibleColumns]);

  const tableColumns = useMemo(
    () => {
      const dataColumns = columns
        .filter((column) => visibleColumns.includes(column.key))
        .map((column) =>
          columnHelper.accessor(column.key, {
            header: translateText(column.label),
            meta: { minWidth: column.minWidth, align: column.align, wrap: column.wrap, multiline: column.multiline } satisfies ColumnMeta,
            cell: (info) => {
              const value = info.getValue();
              const displayValue = resolveTextDisplay(value, column.key, info.row.original);
              const isCustomerContext = isCustomerContextRow(info.row.original);

              if (column.key === "customerInfo" || (column.key === "customerName" && isCustomerContext)) {
                return renderCustomerBundle(info.row.original, displayValue);
              }

              if (column.key === "leadInfo") {
                return renderLeadBundle(info.row.original, displayValue);
              }

              if (STAFF_INFO_BUNDLE_KEYS.has(column.key)) {
                return renderStaffInfoBundle(info.row.original, displayValue);
              }

              if (STAFF_WORK_BUNDLE_KEYS.has(column.key)) {
                return renderStaffWorkBundle(info.row.original);
              }

              if (STAFF_ROLES_BUNDLE_KEYS.has(column.key)) {
                return renderStaffRolesBundle(info.row.original, displayValue);
              }

              if (STAFF_ACCOUNT_BUNDLE_KEYS.has(column.key)) {
                return renderStaffAccountBundle(info.row.original);
              }

              if (column.key === "code" && isCustomerContext) {
                return renderContractBundle(info.row.original, displayValue);
              }

              if ((column.key === "servicePackageName" || column.key === "contractPackageName") && isCustomerContext) {
                return renderServiceBundle(info.row.original, displayValue);
              }

              if (column.key === "paymentStatus" && (hasMeaningfulValue(info.row.original.totalAmount) || hasMeaningfulValue(info.row.original.amountDue) || hasMeaningfulValue(info.row.original.amountPaid))) {
                return renderPaymentBundle(info.row.original, displayValue);
              }

              if (REGISTRATION_BUNDLE_KEYS.has(column.key) && isCustomerContext) {
                return renderRegistrationBundle(info.row.original);
              }

              if (PACKAGE_TIME_BUNDLE_KEYS.has(column.key) && isCustomerContext) {
                return renderPackageTimeBundle(info.row.original);
              }

              if (USAGE_BUNDLE_KEYS.has(column.key) && isCustomerContext) {
                return renderUsageBundle(info.row.original, displayValue);
              }

              if (column.type === "status") {
                return <StatusBadge value={String(value || "")} />;
              }

              if (column.type === "currency") {
                return formatCurrency(value as number);
              }

              if (column.type === "date") {
                return formatDate(String(value || ""));
              }

              if (PERSON_COLUMN_KEYS.has(column.key)) {
                return renderPersonCell(info.row.original, displayValue, column.key);
              }

              return displayValue;
            },
          }),
        );

      return [
        ...dataColumns,
        columnHelper.display({
          id: "actions",
          header: translateText("Actions"),
          meta: { minWidth: onPrint ? 132 : 96, align: "center", wrap: false, multiline: false } satisfies ColumnMeta,
          cell: ({ row }) => (
            <div className="sticky right-0 flex gap-1 bg-white/95 px-1 py-0.5">
              <button className="secondary-button !rounded-[0.45rem] !p-1" onClick={() => onView(row.original)} type="button">
                <Eye className="h-3 w-3" />
              </button>
              {onEdit ? (
                <button className="secondary-button !rounded-[0.45rem] !p-1" onClick={() => onEdit(row.original)} type="button">
                  <Pencil className="h-3 w-3" />
                </button>
              ) : null}
              {onDelete ? (
                <button className="secondary-button !rounded-[0.45rem] !p-1" onClick={() => onDelete(row.original)} type="button">
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
              {onPrint ? (
                <button className="secondary-button !rounded-[0.45rem] !p-1" onClick={() => onPrint(row.original)} type="button">
                  <Printer className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ),
        }),
      ];
    },
    [columnHelper, columns, onDelete, onEdit, onPrint, onView, visibleColumns],
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleWheel: WheelEventHandler<HTMLDivElement> = (event) => {
    const element = event.currentTarget;
    if (element.scrollWidth <= element.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    element.scrollLeft += event.deltaY;
    event.preventDefault();
  };

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 px-2.5 py-1.5">
        <ColumnSelector
          columns={columns.map((column) => ({ key: column.key, label: column.label }))}
          onToggle={(column) => {
            setHasCustomColumnSelection(true);
            setVisibleColumns((current) => (current.includes(column) ? current.filter((item) => item !== column) : [...current, column]));
          }}
          visibleColumns={visibleColumns}
        />
      </div>

      <div className="overflow-x-auto overflow-y-hidden" onWheel={handleWheel} ref={scrollContainerRef}>
        <table className="w-max min-w-full text-[10px] leading-[1.35]">
          <thead className="sticky top-0 bg-slate-100 text-left text-[10px] text-slate-500">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColumnMeta | undefined;

                  return (
                    <th
                      className={`px-2 py-1.5 font-semibold ${meta?.wrap || meta?.multiline ? "whitespace-normal break-words" : "whitespace-nowrap"} ${meta?.align === "center" ? "text-center" : meta?.align === "right" ? "text-right" : "text-left"}`}
                      key={header.id}
                      style={{ minWidth: `${meta?.minWidth || 120}px`, width: meta?.minWidth ? `${meta.minWidth}px` : undefined }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr className="border-t border-slate-100 hover:bg-emerald-50/40" key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                  const rawValue = cell.getValue();
                  const title = rawValue === null || rawValue === undefined ? undefined : getCellTitle(columns, cell.column.id, rawValue, row.original);

                  return (
                    <td
                      className={`px-2 py-1.5 align-top text-[10px] ${meta?.wrap || meta?.multiline ? "whitespace-normal break-words leading-[1.3]" : "whitespace-nowrap"} ${meta?.align === "center" ? "text-center" : meta?.align === "right" ? "text-right" : "text-left"}`}
                      key={cell.id}
                      style={{ minWidth: `${meta?.minWidth || 120}px`, width: meta?.minWidth ? `${meta.minWidth}px` : undefined }}
                      title={title}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasHorizontalOverflow ? (
        <div className="border-t border-slate-200 bg-slate-50/70 px-2.5 py-1 text-[9px] text-slate-500">
          {translateText("Re chuot vao bang va lan chuot len/xuong de cuon ngang.")}
        </div>
      ) : null}
    </div>
  );
}
