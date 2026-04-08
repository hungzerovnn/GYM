"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Printer, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, ListResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";
import { printResourceRecord } from "@/lib/print";
import { buildResourcePrintEntries, getResourceDetailConfig, resolveResourcePrintProfile } from "@/lib/resource-meta";
import { ResourceDefinition } from "@/types/portal";
import { EmptyState } from "../feedback/empty-state";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { AttachmentList } from "../shared/attachment-list";
import { AuditLogTable } from "../shared/audit-log-table";
import { DetailDrawer, DetailSection, DetailSummaryItem } from "../shared/detail-drawer";
import { StatusBadge } from "../shared/status-badge";
import { Timeline } from "../shared/timeline";

const renderMiniTable = (
  headers: string[],
  rows: Array<Array<React.ReactNode>>,
  emptyTitle: string,
  emptyDescription: string,
) => {
  if (!rows.length) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />;
  }

  return (
    <div className="overflow-auto rounded-[0.8rem] border border-slate-200">
      <table className="min-w-full text-[11px]">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            {headers.map((header) => (
              <th className="px-3 py-2 font-semibold" key={header}>
                {translateText(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t border-slate-100 align-top" key={index}>
              {row.map((cell, cellIndex) => (
                <td className="px-3 py-2" key={cellIndex}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const renderInfoCard = (
  eyebrow: string,
  title: string,
  description?: React.ReactNode,
) => (
  <div className="rounded-[0.8rem] border border-slate-200 bg-slate-50 p-4">
    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{translateText(eyebrow)}</p>
    <p className="mt-1.5 text-[14px] font-semibold text-slate-900">{title || "-"}</p>
    {description ? <div className="mt-1.5 text-[12px] text-slate-500">{description}</div> : null}
  </div>
);

const formatSnapshotValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const toApiErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "response" in error) {
    const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
};

const resolveAssetUrl = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const apiBase = String(api.defaults.baseURL || "").replace(/\/api\/?$/, "");
  if (!apiBase) return normalized;
  return `${apiBase}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
};

type AttendanceMachineOperationRecord = Record<string, unknown>;

type AttendanceMachineConnectorRecord = {
  key?: string;
  displayName?: string;
  vendor?: string;
};

type AttendanceMachineConnectorActionRecord = {
  supported?: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

type AttendanceMachineOperationResult = {
  action?: string;
  title?: string;
  description?: string;
  fileName?: string;
  machineCode?: string;
  machineName?: string;
  branchName?: string;
  syncedAt?: string;
  exportedAt?: string;
  machineTime?: string;
  timeZone?: string;
  totalRecords?: number;
  totalBranchRecords?: number;
  staffCount?: number;
  customerCount?: number;
  missingCodeCount?: number;
  importedCount?: number;
  duplicateCount?: number;
  unmatchedCount?: number;
  pulledFromDeviceCount?: number;
  deviceUserCount?: number;
  deletedCount?: number;
  totalMachineLogCount?: number;
  remainingLogCount?: number;
  rangeFrom?: string;
  rangeTo?: string;
  rangeCoveredAllLogs?: boolean;
  deleteStrategy?: string;
  connector?: AttendanceMachineConnectorRecord;
  connectorResult?: AttendanceMachineConnectorActionRecord;
  preview?: AttendanceMachineOperationRecord[];
  records?: AttendanceMachineOperationRecord[];
  machineUsersPreview?: AttendanceMachineOperationRecord[];
  devicePreview?: AttendanceMachineOperationRecord[];
};

type AttendanceMachineOperationState = {
  selectedId: string;
  result: AttendanceMachineOperationResult;
};

type AttendanceMachineMaintenancePayload = {
  action: string;
  personType?: "STAFF" | "CUSTOMER";
  personId?: string;
  displayName?: string;
  appAttendanceCode?: string;
  machineCode?: string;
  machineUserId?: string;
  cardCode?: string;
  faceImageUrl?: string;
  faceImageBase64?: string;
  dateFrom?: string;
  dateTo?: string;
};

type AttendanceEnrollmentDraft = {
  personType: "STAFF" | "CUSTOMER";
  personId: string;
  machineUserId: string;
  cardCode: string;
  faceImageUrl: string;
};

type AttendanceMachineLogRangeDraft = {
  dateFrom: string;
  dateTo: string;
};

const attendanceMachineRecordTypeLabel = (value: unknown) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "STAFF") return translateText("Nhan vien");
  if (normalized === "CUSTOMER") return translateText("Hoi vien");
  return translateText("Su kien");
};

const csvEscape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const downloadTextFile = (content: string, filename: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
    anchor.remove();
  }, 1500);
};

const downloadAttendanceMachineExport = (records: AttendanceMachineOperationRecord[], filename: string) => {
  if (!records.length) return;

  const headers = [
    translateText("Loai"),
    translateText("Ma"),
    translateText("Ten"),
    translateText("Ma cham cong"),
    translateText("Trang thai"),
    translateText("Ghi chu"),
    translateText("Thoi diem"),
    translateText("Nguon"),
  ];

  const rows = records.map((record) =>
    [
      attendanceMachineRecordTypeLabel(record.recordType),
      record.entityCode || "",
      record.displayName || "",
      record.attendanceCode || record.identifier || "",
      record.status || record.eventType || "",
      record.note || "",
      record.eventAt ? formatDateTime(String(record.eventAt)) : "",
      record.source || "",
    ].map(csvEscape),
  );

  const csv = ["\uFEFF" + headers.map(csvEscape).join(","), ...rows.map((row) => row.join(","))].join("\n");
  const nextFilename = filename.replace(/\.json$/iu, ".csv");
  downloadTextFile(csv, nextFilename, "text/csv;charset=utf-8;");
};

const downloadAttendanceMachineLogRangeExport = (
  records: AttendanceMachineOperationRecord[],
  filename: string,
) => {
  if (!records.length) return;

  const headers = [
    translateText("Ma tren may"),
    translateText("Thoi diem"),
    translateText("Loai"),
    translateText("Xac thuc"),
    translateText("Nguon"),
    translateText("Chi tiet"),
  ];

  const rows = records.map((record) =>
    [
      record.machineUserId || record.attendanceCode || record.entityCode || record.rawCode || "",
      record.eventAt ? formatDateTime(String(record.eventAt)) : "",
      record.eventType || record.status || "",
      record.verificationMethod || "",
      record.source || "",
      record.note || record.rawCode || "",
    ].map(csvEscape),
  );

  const csv = ["\uFEFF" + headers.map(csvEscape).join(","), ...rows.map((row) => row.join(","))].join("\n");
  const nextFilename = filename.replace(/\.json$/iu, ".csv");
  downloadTextFile(csv, nextFilename, "text/csv;charset=utf-8;");
};

type OperationContractCloneLabels = {
  overview: string;
  timeline: string;
  receipts: string;
  items: string;
  sessions: string;
  conversions: string;
};

const operationContractCloneLabels: Record<string, OperationContractCloneLabels> = {
  "operations-contract-upgrade": {
    overview: "Ho so nang cap",
    timeline: "Lich su nang cap",
    receipts: "Thanh toan",
    items: "Hang muc nang cap",
    sessions: "Lich tap",
    conversions: "Quy doi / chenh lech",
  },
  "operations-contract-freeze": {
    overview: "Thong tin bao luu",
    timeline: "Lich su bao luu",
    receipts: "Thanh toan",
    items: "Goi tam dung",
    sessions: "Lich tap",
    conversions: "Dieu chinh hop dong",
  },
  "operations-service-registration": {
    overview: "Ho so dang ky",
    timeline: "Lich su dang ky",
    receipts: "Thanh toan",
    items: "Goi dang ky",
    sessions: "Lich tap",
    conversions: "Dieu chinh hop dong",
  },
  "operations-contract-renewal": {
    overview: "Ho so gia han",
    timeline: "Lich su gia han",
    receipts: "Thanh toan",
    items: "Goi hien tai",
    sessions: "Lich tap",
    conversions: "Dieu chinh hop dong",
  },
  "operations-contract-transfer": {
    overview: "Ho so chuyen nhuong",
    timeline: "Lich su chuyen nhuong",
    receipts: "Thanh toan",
    items: "Goi dang chuyen",
    sessions: "Lich tap",
    conversions: "Dieu chinh hop dong",
  },
  "operations-branch-transfer": {
    overview: "Thong tin dieu chuyen",
    timeline: "Lich su dieu chuyen",
    receipts: "Thanh toan",
    items: "Goi dang tap",
    sessions: "Lich tap",
    conversions: "Dieu chinh hop dong",
  },
  "operations-contract-conversion": {
    overview: "Ho so chuyen doi",
    timeline: "Lich su chuyen doi",
    receipts: "Thanh toan",
    items: "Goi chuyen doi",
    sessions: "Lich tap",
    conversions: "Quy doi / chenh lech",
  },
  "operations-contract-cancel": {
    overview: "Ho so huy",
    timeline: "Lich su huy",
    receipts: "Thanh toan",
    items: "Goi da huy",
    sessions: "Lich tap",
    conversions: "Dieu chinh hop dong",
  },
};

const resourceCloneFieldLabelOverrides: Record<string, Record<string, string>> = {
  "operations-towels": {
    categoryName: "Danh muc vat tu",
    groupName: "Nhom cap phat",
    stockQuantity: "So luong ton",
    minStockQuantity: "Nguong toi thieu",
    stockAlertLabel: "Muc canh bao",
    lastPurchaseDate: "Lan nhap gan nhat",
  },
  "operations-loyalty": {
    groupName: "Hang loyalty",
    assignedUserName: "Nhan vien CSKH",
    registrationDate: "Ngay dang ky loyalty",
    startTrainingDate: "Bat dau uu dai",
    endTrainingDate: "Het han uu dai",
  },
  "pt-schedule-penalty-history": {
    action: "Hanh dong penalty",
    entityType: "Doi tuong lien quan",
    ipAddress: "Nguon truy cap",
    userAgent: "Trinh duyet / client",
    beforeData: "Du lieu truoc",
    afterData: "Du lieu sau",
    metadata: "Du lieu bo sung",
    createdAt: "Thoi gian ghi nhan",
  },
};

const formatDateRangeLabel = (startValue: unknown, endValue: unknown) => {
  const start = String(startValue || "").trim();
  const end = String(endValue || "").trim();

  if (!start && !end) return "-";

  const formattedStart = start ? formatDate(start) : translateText("Chua co");
  const formattedEnd = end ? formatDate(end) : translateText("Chua co");
  return `${formattedStart} - ${formattedEnd}`;
};

function PreviewAssetCard({
  eyebrow,
  title,
  assetUrl,
  description,
  openLabel,
  emptyMessage,
  altFallback,
}: {
  eyebrow: string;
  title: string;
  assetUrl?: string;
  description?: React.ReactNode;
  openLabel?: string;
  emptyMessage?: string;
  altFallback?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const normalizedUrl = String(assetUrl || "").trim();
  const canPreview = Boolean(normalizedUrl) && !hasError;

  return (
    <div className="rounded-[0.8rem] border border-slate-200 bg-slate-50 p-4 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{translateText(eyebrow)}</p>
          <p className="mt-1.5 text-[14px] font-semibold text-slate-900">{title || "-"}</p>
        </div>
        {normalizedUrl ? (
          <a
            className="secondary-button !h-auto !rounded-[0.58rem] !px-3 !py-1.5 text-[11px]"
            href={normalizedUrl}
            rel="noreferrer"
            target="_blank"
          >
            {translateText(openLabel || "Mo tep anh")}
          </a>
        ) : null}
      </div>
      {description ? <div className="mt-1.5 text-[12px] text-slate-500">{description}</div> : null}
      <div className="mt-3 overflow-hidden rounded-[0.75rem] border border-slate-200 bg-white">
        {canPreview ? (
          <img
            alt={title || translateText(altFallback || "Anh preview")}
            className="h-40 w-full object-contain bg-white p-3"
            onError={() => setHasError(true)}
            src={normalizedUrl}
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-slate-100 px-4 text-center text-[12px] text-slate-500">
            {translateText(normalizedUrl ? "Khong tai duoc hinh preview." : emptyMessage || "Chua cau hinh hinh anh.")}
          </div>
        )}
      </div>
      {normalizedUrl ? <div className="mt-2.5 break-all text-[11px] text-slate-500">{normalizedUrl}</div> : null}
    </div>
  );
}

export function ResourceDetailDrawer({
  resource,
  selected,
  open,
  onClose,
  printTemplate,
  printFilters = [],
}: {
  resource: ResourceDefinition;
  selected: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
  printTemplate?: Record<string, unknown> | null;
  printFilters?: Array<{ label: string; value: unknown }>;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [attendanceMachineOperationResult, setAttendanceMachineOperationResult] = useState<AttendanceMachineOperationState | null>(null);
  const [uploadingAttendanceFaceImage, setUploadingAttendanceFaceImage] = useState(false);
  const [attendanceFaceUploadError, setAttendanceFaceUploadError] = useState<string | null>(null);
  const [attendanceMachineLogRangeDraft, setAttendanceMachineLogRangeDraft] = useState<AttendanceMachineLogRangeDraft>({
    dateFrom: "",
    dateTo: "",
  });
  const [attendanceEnrollmentDraft, setAttendanceEnrollmentDraft] = useState<AttendanceEnrollmentDraft>({
    personType: "STAFF",
    personId: "",
    machineUserId: "",
    cardCode: "",
    faceImageUrl: "",
  });
  const detailKey = resource.baseKey || resource.key;
  const normalizedDetailKey = detailKey === "shop-sales" ? "receipts" : detailKey === "shop-returns" ? "expenses" : detailKey;
  const config = selected?.id ? getResourceDetailConfig(resource) : undefined;
  const selectedId = String(selected?.id || "");
  const canViewAttachments = user?.permissions.includes("attachments.view");
  const canUploadAttachments = user?.permissions.includes("attachments.create");
  const canViewAuditLogs = user?.permissions.includes("audit-logs.view");
  const canResetPassword = normalizedDetailKey === "users" && user?.permissions.includes("users.update");
  const canMaintainAttendanceMachine = normalizedDetailKey === "attendance-machines" && user?.permissions.includes("attendance-machines.update");
  const canToggleMemberPresence = normalizedDetailKey === "member-presence" && user?.permissions.includes("member-presence.update");
  const printProfile = resolveResourcePrintProfile(resource);
  const isClassScheduleBooking = resource.key === "class-schedule-bookings";
  const isClassScheduleClass = resource.key === "class-schedule-classes";
  const isClassScheduleTimetable = resource.key === "class-schedule-timetable";
  const isClassScheduleGroupPt = resource.key === "class-schedule-group-pt";
  const isClassScheduleLineCategory = resource.key === "class-schedule-line-categories";
  const isClassScheduleLineSchedule = resource.key === "class-schedule-line-schedule";
  const isClassScheduleBookingAttachment = resource.key === "class-schedule-booking-attachments";
  const isStaffExerciseLibrary = resource.key === "staff-exercise-library";
  const isStaffStage = resource.key === "staff-stages";
  const isStaffProgram = resource.key === "staff-programs";
  const isOperationsServicePriceBook = resource.key === "operations-service-price-book";
  const isOperationsTowels = resource.key === "operations-towels";
  const isOperationsLoyalty = resource.key === "operations-loyalty";
  const isPtSchedulePenaltyHistory = resource.key === "pt-schedule-penalty-history";
  const contractCloneLabels = operationContractCloneLabels[resource.key];
  const isClassScheduleTrainingClone =
    isClassScheduleBooking ||
    isClassScheduleTimetable ||
    isClassScheduleGroupPt ||
    isClassScheduleLineSchedule ||
    isClassScheduleBookingAttachment;

  const detailQuery = useQuery({
    queryKey: ["resource-detail", resource.key, selectedId],
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>>(config!.detailEndpoint(selectedId));
      return response.data;
    },
    enabled: open && Boolean(config && selectedId),
  });

  const timelineQuery = useQuery({
    queryKey: ["resource-timeline", resource.key, selectedId],
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>>(config!.timelineEndpoint!(selectedId));
      return response.data;
    },
    enabled: open && Boolean(config?.timelineEndpoint && selectedId),
  });

  const attachmentsQuery = useQuery({
    queryKey: ["resource-attachments", resource.key, selectedId],
    queryFn: async () => {
      const response = await api.get<Array<Record<string, unknown>>>("/attachments", {
        params: { entityType: config!.entityType, entityId: selectedId },
      });
      return response.data;
    },
    enabled: open && Boolean(config && selectedId && canViewAttachments),
  });

  const auditQuery = useQuery({
    queryKey: ["resource-audit", resource.key, selectedId],
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/audit-logs", {
        params: { pageSize: 20, entityType: config!.entityType, entityId: selectedId },
      });
      return response.data.data;
    },
    enabled: open && Boolean(config && selectedId && canViewAuditLogs),
  });

  const detailData = (detailQuery.data || selected || {}) as Record<string, unknown>;
  const activeAttendanceMachineOperationResult =
    open && attendanceMachineOperationResult?.selectedId === selectedId ? attendanceMachineOperationResult.result : null;
  const attendanceMachineBranchId = String(detailData.branchId || "");

  const attendanceMachineUsersQuery = useQuery({
    queryKey: ["attendance-machine-users", selectedId, attendanceMachineBranchId],
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/users", {
        params: { branchId: attendanceMachineBranchId, page: 1, pageSize: 100, sortBy: "fullName", sortOrder: "asc" },
      });
      return response.data.data;
    },
    enabled: open && normalizedDetailKey === "attendance-machines" && canMaintainAttendanceMachine && Boolean(attendanceMachineBranchId),
  });

  const attendanceMachineCustomersQuery = useQuery({
    queryKey: ["attendance-machine-customers", selectedId, attendanceMachineBranchId],
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/customers", {
        params: { branchId: attendanceMachineBranchId, page: 1, pageSize: 100, sortBy: "fullName", sortOrder: "asc" },
      });
      return response.data.data;
    },
    enabled: open && normalizedDetailKey === "attendance-machines" && canMaintainAttendanceMachine && Boolean(attendanceMachineBranchId),
  });

  const attendanceMachineUsers = attendanceMachineUsersQuery.data || [];
  const attendanceMachineCustomers = attendanceMachineCustomersQuery.data || [];
  const attendanceEnrollmentOptions = (
    attendanceEnrollmentDraft.personType === "STAFF"
      ? attendanceMachineUsers
      : attendanceMachineCustomers
  ).map((item) => {
    const code =
      attendanceEnrollmentDraft.personType === "STAFF"
        ? String(item.attendanceCode || item.employeeCode || item.username || item.id || "")
        : String(item.fingerprintCode || item.code || item.id || "");
    return {
      id: String(item.id || ""),
      label:
        attendanceEnrollmentDraft.personType === "STAFF"
          ? `${String(item.fullName || item.username || "-")} - ${code || "-"}`
          : `${String(item.fullName || item.code || "-")} - ${code || "-"}`,
      displayName: String(item.fullName || item.username || item.code || ""),
      attendanceCode: code,
      cardCode: String(item.customerCardNumber || ""),
    };
  });
  const selectedAttendanceEnrollmentOption =
    attendanceEnrollmentOptions.find((item) => item.id === attendanceEnrollmentDraft.personId) || null;

  const refreshResourceData = async () => {
    await queryClient.invalidateQueries({ queryKey: [resource.key] });
    await queryClient.invalidateQueries({ queryKey: ["resource-detail", resource.key, selectedId] });
    if (config && selectedId) {
      await detailQuery.refetch();
    }
  };

  const handleAttendanceFaceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAttendanceFaceImage(true);
      setAttendanceFaceUploadError(null);

      const formData = new FormData();
      formData.append("file", file);

      const entityType = "attendance_machine_face";
      const entityId = `${selectedId || "draft-machine"}-${attendanceEnrollmentDraft.personId || attendanceEnrollmentDraft.personType.toLowerCase()}-face`;
      const params = new URLSearchParams({ entityType, entityId });

      if (attendanceMachineBranchId) {
        params.set("branchId", attendanceMachineBranchId);
      }

      const response = await api.post(`/attachments/upload?${params.toString()}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const nextUrl = resolveAssetUrl(String(response.data?.fileUrl || ""));
      setAttendanceEnrollmentDraft((current) => ({
        ...current,
        faceImageUrl: nextUrl,
      }));
      toast.success(translateText("Da tai anh khuon mat len va cap nhat URL."));
    } catch (error) {
      const message = toApiErrorMessage(error, translateText("Upload anh khuon mat that bai."));
      setAttendanceFaceUploadError(message);
      toast.error(message);
    } finally {
      setUploadingAttendanceFaceImage(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const submitAttendanceMachineLogRangeAction = async (action: "EXPORT_MACHINE_LOG_RANGE" | "DELETE_MACHINE_LOG_RANGE") => {
    const dateFrom = attendanceMachineLogRangeDraft.dateFrom.trim();
    const dateTo = attendanceMachineLogRangeDraft.dateTo.trim();

    if (!dateFrom || !dateTo) {
      toast.error(translateText("Can chon day du tu ngay va den ngay cho khoang du lieu may cham cong."));
      return;
    }

    if (new Date(`${dateFrom}T00:00:00`).getTime() > new Date(`${dateTo}T00:00:00`).getTime()) {
      toast.error(translateText("Tu ngay khong duoc lon hon den ngay."));
      return;
    }

    await attendanceMachineMaintenanceMutation.mutateAsync({
      action,
      dateFrom,
      dateTo,
    });
  };

  const submitAttendanceMachineFullLogAction = async (action: "EXPORT_ALL_MACHINE_LOGS" | "DELETE_ALL_MACHINE_LOGS") => {
    if (action === "DELETE_ALL_MACHINE_LOGS") {
      const confirmed = window.confirm(
        translateText(
          "Ban co chac muon xoa toan bo log tren may cham cong? Du lieu sau khi xoa se khong the phuc hoi tren thiet bi.",
        ),
      );

      if (!confirmed) {
        return;
      }
    }

    await attendanceMachineMaintenanceMutation.mutateAsync({
      action,
    });
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async (password: string) => api.post(`/users/${selectedId}/reset-password`, { password }),
    onSuccess: async () => {
      toast.success(translateText("Da reset mat khau cho tai khoan nay."));
      setResetPasswordOpen(false);
      await refreshResourceData();
    },
  });

  const attendanceMachineMaintenanceMutation = useMutation({
    mutationFn: async (payload: AttendanceMachineMaintenancePayload) =>
      api.post<Record<string, unknown>>(`/attendance-machines/${selectedId}/maintenance`, payload),
    onSuccess: async (response, payload) => {
      const action = payload.action;
      const operationResult = (response.data.operationResult || null) as AttendanceMachineOperationResult | null;
      setAttendanceMachineOperationResult(operationResult ? { selectedId, result: operationResult } : null);

      if (action === "PULL_MACHINE_CODES" && operationResult?.records?.length) {
        downloadAttendanceMachineExport(
          operationResult.records,
          String(operationResult.fileName || `attendance-machine-${String(detailData.code || selectedId || "export")}.csv`),
        );
      }

      if ((action === "EXPORT_MACHINE_LOG_RANGE" || action === "EXPORT_ALL_MACHINE_LOGS") && operationResult?.records?.length) {
        downloadAttendanceMachineLogRangeExport(
          operationResult.records,
          String(operationResult.fileName || `attendance-machine-${String(detailData.code || selectedId || "export")}-device-logs.csv`),
        );
      }

      const successMessageMap: Record<string, string> = {
        TOGGLE_SYNC: detailData.syncEnabled ? "Da tat dong bo cho may cham cong." : "Da bat dong bo cho may cham cong.",
        PING_MACHINE: "Da kiem tra ket noi may cham cong.",
        PULL_ATTENDANCE_EVENTS: "Da tai du lieu cham cong tu may ve he thong.",
        PULL_MACHINE_CODES: "Da xuat danh sach ma cham cong ve may tinh.",
        PUSH_STAFF_CODES: "Da tai nhan vien len may cham cong.",
        PUSH_CUSTOMER_CODES: "Da tai hoi vien len may cham cong.",
        SYNC_MACHINE_TIME: "Da dong bo thoi gian may cham cong.",
        EXPORT_MACHINE_LOG_RANGE: "Da tai du lieu tren may theo moc thoi gian ve may tinh.",
        DELETE_MACHINE_LOG_RANGE: "Da xu ly thao tac xoa du lieu tren may theo moc thoi gian.",
        EXPORT_ALL_MACHINE_LOGS: "Da tai toan bo log tren may ve may tinh.",
        DELETE_ALL_MACHINE_LOGS: "Da xu ly thao tac xoa toan bo log tren may.",
        LINK_MACHINE_PERSON: "Da luu lien ket ma may voi doi tuong trong he thong.",
        ENROLL_FACE: "Da day enrollment khuon mat len may cham cong.",
        ENROLL_CARD: "Da day enrollment the len may cham cong.",
        START_SYNC: "Da danh dau may dang dong bo.",
        FINISH_SYNC: "Da ghi nhan may dong bo xong.",
        MARK_CONNECTED: "Da cap nhat trang thai ket noi.",
        MARK_DISCONNECTED: "Da cap nhat trang thai mat ket noi.",
        MARK_ERROR: "Da danh dau may dang gap loi.",
      };
      const successMessage = translateText(successMessageMap[action] || "Da danh dau may dang gap loi.");

      if ((action === "DELETE_MACHINE_LOG_RANGE" || action === "DELETE_ALL_MACHINE_LOGS") && operationResult?.connectorResult?.supported === false) {
        toast.error(translateText(String(operationResult.connectorResult.message || successMessage)));
      } else {
        toast.success(successMessage);
      }
      await refreshResourceData();
    },
    onError: (error) => {
      toast.error(toApiErrorMessage(error, translateText("Khong cap nhat duoc may cham cong.")));
    },
  });

  const memberPresenceToggleMutation = useMutation({
    mutationFn: async () => api.post<Record<string, unknown>>(`/member-presence/${selectedId}/toggle`, {}),
    onSuccess: async (response) => {
      const nextStatus = String(response.data?.presenceStatus || "");
      toast.success(
        translateText(
          nextStatus === "ACTIVE"
            ? "Da xac nhan hoi vien dang tap."
            : "Da xac nhan hoi vien da off.",
        ),
      );
      await refreshResourceData();
    },
    onError: (error) => {
      toast.error(
        toApiErrorMessage(
          error,
          translateText("Khong cap nhat duoc trang thai hien dien hoi vien."),
        ),
      );
    },
  });

  const activeAttendanceMachineMaintenanceAction =
    attendanceMachineMaintenanceMutation.isPending
      ? attendanceMachineMaintenanceMutation.variables?.action || null
      : null;

  const resetPasswordError = resetPasswordMutation.error
    ? toApiErrorMessage(resetPasswordMutation.error, translateText("Khong reset duoc mat khau."))
    : null;

  const handlePrintRecord = async () => {
    if (!printProfile) return;

    let record = detailData;

    if (config && selectedId && !detailQuery.data) {
      const result = await detailQuery.refetch();
      if (result.data) {
        record = result.data;
      }
    }

    printResourceRecord({
      title: `${resource.title} ${String(record.code || record.id || "").trim()}`.trim(),
      subtitle: resource.subtitle,
      entries: buildResourcePrintEntries(resource, record),
      record,
      filters: printFilters,
      template: printTemplate,
      profile: printProfile,
    });
  };

  const summaryItems: DetailSummaryItem[] = (() => {
    if (!selected) return [];

    if (isClassScheduleBooking) {
      return [
        { label: "Trang thai", value: detailData.status, type: "status" },
        { label: "Lich dat", value: detailData.scheduledDateTime, type: "datetime" },
        { label: "Hoi vien", value: detailData.customerName },
        { label: "PT phu trach", value: detailData.trainerName },
        { label: "Khu vuc", value: detailData.location },
        { label: "attendance Count", value: detailData.attendanceCount },
        { label: "attachment Count", value: detailData.attachmentCount },
      ];
    }

    if (isClassScheduleClass) {
      return [
        { label: "Trang thai", value: detailData.status, type: "status" },
        { label: "Dich vu", value: detailData.serviceName },
        { label: "Loai goi", value: resolveTextDisplay(detailData.packageType, "packageType", detailData) },
        { label: "Tong buoi", value: detailData.totalSessions || detailData.sessionCount },
        { label: "price", value: detailData.price, type: "currency" },
        { label: "So dang ky", value: detailData.contractCount },
      ];
    }

    if (isClassScheduleTimetable) {
      return [
        { label: "Trang thai", value: detailData.status, type: "status" },
        { label: "Khung gio", value: detailData.scheduledDateTime, type: "datetime" },
        { label: "PT phu trach", value: detailData.trainerName },
        { label: "Booking chinh", value: detailData.customerName },
        { label: "Khu vuc", value: detailData.location },
        { label: "attendance Count", value: detailData.attendanceCount },
        { label: "present Count", value: detailData.presentCount },
        { label: "attachment Count", value: detailData.attachmentCount },
      ];
    }

    if (isClassScheduleGroupPt) {
      return [
        { label: "Trang thai", value: detailData.status, type: "status" },
        { label: "Lich PT nhom", value: detailData.scheduledDateTime, type: "datetime" },
        { label: "PT phu trach", value: detailData.trainerName },
        { label: "So booking", value: detailData.attendanceCount },
        { label: "present Count", value: detailData.presentCount },
        { label: "Tru buoi", value: detailData.consumedSessions },
        { label: "Khu vuc", value: detailData.location },
        { label: "attachment Count", value: detailData.attachmentCount },
      ];
    }

    if (isClassScheduleLineCategory) {
      return [
        { label: "Trang thai", value: detailData.status, type: "status" },
        { label: "Loai line", value: resolveTextDisplay(detailData.category, "category", detailData) },
        { label: "Chi nhanh", value: detailData.branchName },
        { label: "So lop", value: detailData.packageCount },
        { label: "Dang mo", value: detailData.activePackageCount },
        { label: "Luot dung", value: detailData.contractItemCount },
        { label: "Gia mac dinh", value: detailData.defaultPrice, type: "currency" },
      ];
    }

    if (isClassScheduleLineSchedule) {
      return [
        { label: "Trang thai", value: detailData.status, type: "status" },
        { label: "Lich line", value: detailData.scheduledDateTime, type: "datetime" },
        { label: "Line / Khu vuc", value: detailData.location },
        { label: "Huong dan", value: detailData.trainerName },
        { label: "So booking", value: detailData.attendanceCount },
        { label: "So nguoi co mat", value: detailData.presentCount },
        { label: "So tep dinh kem", value: detailData.attachmentCount },
      ];
    }

    if (isClassScheduleBookingAttachment) {
      return [
        { label: "Trang thai", value: detailData.status, type: "status" },
        { label: "Thoi diem", value: detailData.scheduledDateTime, type: "datetime" },
        { label: "Hoi vien", value: detailData.customerName },
        { label: "PT phu trach", value: detailData.trainerName },
        { label: "Khu vuc", value: detailData.location },
        { label: "So tep dinh kem", value: detailData.attachmentCount },
        { label: "Diem danh", value: detailData.attendanceCount },
      ];
    }

    if (isStaffExerciseLibrary) {
      return [
        { label: "Trang thai", value: detailData.status, type: "status" },
        { label: "Danh muc", value: detailData.categoryName },
        { label: "Nhom bai tap", value: detailData.groupName },
        { label: "Don vi", value: detailData.unit },
        { label: "So luong san sang", value: detailData.stockQuantity },
        { label: "Muc toi thieu", value: detailData.minStockQuantity },
        { label: "Canh bao dung cu", value: resolveTextDisplay(detailData.stockAlertLabel, "stockAlertLabel", detailData) },
      ];
    }

    if (isStaffStage) {
      return [
        { label: "Loai stage", value: detailData.roleType, type: "status" },
        { label: "So moc", value: detailData.permissionCount },
        { label: "Nhan su dang gan", value: detailData.userCount },
        { label: "Ngay tao", value: detailData.createdDateTime, type: "datetime" },
        { label: "Cap nhat lan cuoi", value: detailData.updatedDateTime, type: "datetime" },
      ];
    }

    if (isStaffProgram) {
      return [
        { label: "Trang thai", value: detailData.status, type: "status" },
        { label: "PT phu trach", value: detailData.fullName },
        { label: "Chi nhanh", value: detailData.branchName },
        { label: "Chuyen mon", value: detailData.specialty },
        { label: "Hoc vien dang theo", value: detailData.activeContractCount },
        { label: "Lich sap toi", value: detailData.upcomingSessionCount },
        { label: "Da hoan thanh", value: detailData.completedSessionCount },
        { label: "Buoi tiep theo", value: detailData.nextSessionDateTime, type: "datetime" },
      ];
    }

    if (isOperationsServicePriceBook) {
      return [
        { label: "Trang thai", value: detailData.status, type: "status" },
        { label: "Dich vu", value: detailData.serviceName },
        { label: "Phan loai goi", value: resolveTextDisplay(detailData.packageType, "packageType", detailData) },
        { label: "So buoi", value: detailData.sessionLabel || detailData.sessionCount },
        { label: "Gia ban", value: detailData.price, type: "currency" },
        { label: "So dang ky", value: detailData.contractCount },
      ];
    }

    if (resource.key === "operations-contract-upgrade") {
      return [
        { label: "Trang thai hop dong", value: detailData.status, type: "status" },
        { label: "Trang thai thanh toan", value: detailData.paymentStatus, type: "status" },
        { label: "Goi hien tai", value: detailData.servicePackageName },
        { label: "Hop dong tham chieu", value: detailData.oldContractCode },
        { label: "Gia tri goc", value: detailData.grossAmount, type: "currency" },
        { label: "Tong giam", value: detailData.totalDiscount, type: "currency" },
        { label: "Gia tri con lai", value: detailData.remainingValue, type: "currency" },
        { label: "Tong tien", value: detailData.totalAmount, type: "currency" },
        { label: "Con no", value: detailData.amountDue, type: "currency" },
      ];
    }

    if (resource.key === "operations-contract-freeze") {
      return [
        { label: "Trang thai hop dong", value: detailData.status, type: "status" },
        { label: "Trang thai thanh toan", value: detailData.paymentStatus, type: "status" },
        { label: "Goi tam dung", value: detailData.servicePackageName },
        { label: "Bat dau bao luu", value: detailData.startDate, type: "date" },
        { label: "Ket thuc bao luu", value: detailData.endDate, type: "date" },
        { label: "Buoi con lai", value: detailData.remainingSessions },
        { label: "Gia tri con lai", value: detailData.remainingValue, type: "currency" },
        { label: "Con no", value: detailData.amountDue, type: "currency" },
      ];
    }

    if (resource.key === "operations-service-registration") {
      return [
        { label: "Trang thai dang ky", value: detailData.status, type: "status" },
        { label: "Trang thai thanh toan", value: detailData.paymentStatus, type: "status" },
        { label: "Goi dang ky", value: detailData.servicePackageName },
        { label: "Tong gia tri", value: detailData.totalAmount, type: "currency" },
        { label: "Da thanh toan", value: detailData.amountPaid, type: "currency" },
        { label: "Con no", value: detailData.amountDue, type: "currency" },
        { label: "Tong buoi", value: detailData.totalSessions },
        { label: "Buoi con lai", value: detailData.remainingSessions },
        { label: "Sale phu trach", value: detailData.saleUserName },
        { label: "PT phu trach", value: detailData.trainerName },
      ];
    }

    if (resource.key === "operations-contract-renewal") {
      return [
        { label: "Trang thai hop dong", value: detailData.status, type: "status" },
        { label: "Trang thai thanh toan", value: detailData.paymentStatus, type: "status" },
        { label: "Goi hien tai", value: detailData.servicePackageName },
        { label: "Buoi con lai", value: detailData.remainingSessions },
        { label: "Ngay con lai", value: detailData.daysRemaining },
        { label: "Gia tri con lai", value: detailData.remainingValue, type: "currency" },
        { label: "Con no", value: detailData.amountDue, type: "currency" },
        { label: "Sale phu trach", value: detailData.saleUserName },
        { label: "PT phu trach", value: detailData.trainerName },
        { label: "Ngay het han", value: detailData.endDate, type: "date" },
      ];
    }

    if (resource.key === "operations-contract-transfer") {
      return [
        { label: "Trang thai hop dong", value: detailData.status, type: "status" },
        { label: "Trang thai thanh toan", value: detailData.paymentStatus, type: "status" },
        { label: "Chu hop dong", value: detailData.customerName },
        { label: "Hop dong goc", value: detailData.oldContractCode },
        { label: "Goi dang chuyen", value: detailData.servicePackageName },
        { label: "Buoi con lai", value: detailData.remainingSessions },
        { label: "Gia tri con lai", value: detailData.remainingValue, type: "currency" },
        { label: "Con no", value: detailData.amountDue, type: "currency" },
      ];
    }

    if (resource.key === "operations-branch-transfer") {
      return [
        { label: "Trang thai hop dong", value: detailData.status, type: "status" },
        { label: "Trang thai thanh toan", value: detailData.paymentStatus, type: "status" },
        { label: "Chi nhanh hien tai", value: detailData.branchName },
        { label: "Hoi vien", value: detailData.customerName },
        { label: "Goi dang tap", value: detailData.servicePackageName },
        { label: "Sale phu trach", value: detailData.saleUserName },
        { label: "PT phu trach", value: detailData.trainerName },
        { label: "Buoi con lai", value: detailData.remainingSessions },
        { label: "Ngay het han", value: detailData.endDate, type: "date" },
        { label: "Con no", value: detailData.amountDue, type: "currency" },
      ];
    }

    if (resource.key === "operations-contract-conversion") {
      return [
        { label: "Trang thai hop dong", value: detailData.status, type: "status" },
        { label: "Trang thai thanh toan", value: detailData.paymentStatus, type: "status" },
        { label: "Hoi vien", value: detailData.customerName },
        { label: "Goi hien tai", value: detailData.servicePackageName },
        { label: "Hop dong cu", value: detailData.oldContractCode },
        { label: "Buoi con lai", value: detailData.remainingSessions },
        { label: "Gia tri con lai", value: detailData.remainingValue, type: "currency" },
        { label: "Con no", value: detailData.amountDue, type: "currency" },
      ];
    }

    if (resource.key === "operations-contract-cancel") {
      return [
        { label: "Trang thai hop dong", value: detailData.status, type: "status" },
        { label: "Trang thai thanh toan", value: detailData.paymentStatus, type: "status" },
        { label: "Hoi vien", value: detailData.customerName },
        { label: "Goi da huy", value: detailData.servicePackageName },
        { label: "Da thu", value: detailData.amountPaid, type: "currency" },
        { label: "Con no", value: detailData.amountDue, type: "currency" },
        { label: "Gia tri chot", value: detailData.remainingValue, type: "currency" },
        { label: "Ngay dong", value: detailData.endDate, type: "date" },
      ];
    }

    if (isOperationsLoyalty) {
      return [
        { label: "Trang thai hoi vien", value: detailData.membershipStatus, type: "status" },
        { label: "Hang loyalty", value: detailData.groupName },
        { label: "Nhan vien CSKH", value: detailData.assignedUserName },
        { label: "Cong no", value: detailData.outstandingDebt, type: "currency" },
        { label: "So hop dong", value: Array.isArray(detailData.contracts) ? detailData.contracts.length : detailData.contractCount },
        { label: "So phieu thu", value: Array.isArray(detailData.receipts) ? detailData.receipts.length : 0 },
        { label: "Het han uu dai", value: detailData.endTrainingDate, type: "date" },
        { label: "Ngay dang ky loyalty", value: detailData.registrationDate, type: "date" },
      ];
    }

    if (isOperationsTowels) {
      return [
        { label: "Trang thai vat tu", value: detailData.status, type: "status" },
        { label: "Chi nhanh", value: detailData.branchName },
        { label: "Danh muc vat tu", value: detailData.categoryName },
        { label: "Nhom cap phat", value: detailData.groupName },
        { label: "So luong ton", value: detailData.stockQuantity },
        { label: "Nguong toi thieu", value: detailData.minStockQuantity },
        { label: "Muc canh bao", value: detailData.stockAlertLabel },
        { label: "Lan nhap gan nhat", value: detailData.lastPurchaseDate, type: "datetime" },
      ];
    }

    if (isPtSchedulePenaltyHistory) {
      return [
        { label: "Mo-dun", value: resolveTextDisplay(detailData.module, "module", detailData) },
        { label: "Hanh dong penalty", value: detailData.action, type: "status" },
        { label: "Doi tuong lien quan", value: resolveTextDisplay(detailData.entityType, "entityType", detailData) },
        { label: "Ma tham chieu", value: detailData.entityId },
        { label: "Nguon truy cap", value: detailData.ipAddress },
        { label: "Thoi gian ghi nhan", value: detailData.createdAt || detailData.createdDateTime, type: "datetime" },
      ];
    }

    switch (normalizedDetailKey) {
      case "customers":
        return [
          { label: "Trang thai hoi vien", value: detailData.membershipStatus, type: "status" },
          { label: "Cong no", value: detailData.outstandingDebt, type: "currency" },
          { label: "So hop dong", value: Array.isArray(detailData.contracts) ? detailData.contracts.length : detailData.contractCount },
          { label: "So phieu thu", value: Array.isArray(detailData.receipts) ? detailData.receipts.length : 0 },
          { label: "Buoi tap", value: Array.isArray(detailData.trainingSessions) ? detailData.trainingSessions.length : 0 },
          { label: "Ngay tao", value: detailData.createdAt, type: "datetime" },
        ];
      case "leads":
        return [
          { label: "Trang thai lead", value: detailData.status, type: "status" },
          { label: "Muc do tiem nang", value: detailData.potentialLevel, type: "status" },
          { label: "Nguon lead", value: (detailData.source as { name?: string } | undefined)?.name || detailData.sourceName },
          { label: "Nhan vien phu trach", value: (detailData.assignedTo as { fullName?: string } | undefined)?.fullName || detailData.assignedUserName },
          { label: "Hen tiep theo", value: detailData.nextFollowUpAt, type: "datetime" },
          { label: "Tinh trang follow-up", value: detailData.followUpState, type: "status" },
          { label: "Budget du kien", value: detailData.budgetExpected, type: "currency" },
          { label: "So lan cham soc", value: detailData.logCount || (Array.isArray(detailData.logs) ? detailData.logs.length : 0) },
        ];
      case "contracts":
        return [
          { label: "Trang thai hop dong", value: detailData.status, type: "status" },
          { label: "Trang thai thanh toan", value: detailData.paymentStatus, type: "status" },
          { label: "Goi dich vu", value: detailData.servicePackageName || detailData.packageName },
          { label: "Tong gia tri", value: detailData.totalAmount, type: "currency" },
          { label: "Da thanh toan", value: detailData.amountPaid, type: "currency" },
          { label: "Con no", value: detailData.amountDue, type: "currency" },
          { label: "Tien do buoi", value: detailData.sessionUsage || detailData.remainingSessions },
          { label: "Ty le thanh toan", value: detailData.paidPercent !== undefined ? `${String(detailData.paidPercent)}%` : undefined },
          { label: "So ngay con lai", value: detailData.daysRemaining },
          { label: "Gia tri con lai", value: detailData.remainingValue, type: "currency" },
        ];
      case "customer-sources":
        return [
          { label: "Nhom kenh", value: resolveTextDisplay(detailData.channel, "channel", detailData) },
          { label: "Mo ta", value: detailData.description },
          { label: "Ngay tao", value: detailData.createdAt || detailData.createdDateTime, type: "datetime" },
          { label: "Cap nhat lan cuoi", value: detailData.updatedAt || detailData.updatedDateTime, type: "datetime" },
        ];
      case "customer-groups":
        return [
          { label: "Mo ta", value: detailData.description },
          { label: "Ngay tao", value: detailData.createdAt || detailData.createdDateTime, type: "datetime" },
          { label: "Cap nhat lan cuoi", value: detailData.updatedAt || detailData.updatedDateTime, type: "datetime" },
        ];
      case "services":
        return [
          { label: "Trang thai", value: detailData.status, type: "status" },
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Gia mac dinh", value: detailData.defaultPrice, type: "currency" },
          { label: "So buoi mac dinh", value: detailData.defaultSessions },
          { label: "Tong goi", value: detailData.packageCount },
          { label: "Goi dang mo", value: detailData.activePackageCount },
          { label: "Luot su dung", value: detailData.contractItemCount },
        ];
      case "service-packages":
        return [
          { label: "Trang thai", value: detailData.status, type: "status" },
          { label: "Dich vu", value: detailData.serviceName },
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Loai goi", value: resolveTextDisplay(detailData.packageType, "packageType", detailData) },
          { label: "Tong buoi", value: detailData.totalSessions },
          { label: "Gia", value: detailData.price, type: "currency" },
          { label: "So hop dong", value: detailData.contractCount },
        ];
      case "trainers":
        return [
          { label: "Trang thai", value: detailData.status, type: "status" },
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Chuyen mon", value: detailData.specialty },
          { label: "Hop dong dang mo", value: detailData.activeContractCount },
          { label: "Lich sap toi", value: detailData.upcomingSessionCount },
          { label: "Da hoan thanh", value: detailData.completedSessionCount },
          { label: "Buoi tiep theo", value: detailData.nextSessionDateTime, type: "datetime" },
        ];
      case "training-sessions":
        return [
          { label: "Trang thai", value: detailData.status, type: "status" },
          { label: "Lich tap", value: detailData.scheduledDateTime, type: "datetime" },
          { label: "Khach hang", value: detailData.customerName },
          { label: "PT", value: detailData.trainerName },
          { label: "Hop dong", value: detailData.contractCode },
          { label: "Check-in", value: detailData.checkInDateTime, type: "datetime" },
          { label: "So ban ghi diem danh", value: detailData.attendanceCount },
          { label: "So tep dinh kem", value: detailData.attachmentCount },
          { label: "Tru buoi", value: detailData.consumedSessions },
        ];
      case "products":
        return [
          { label: "Trang thai", value: detailData.status, type: "status" },
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Danh muc", value: detailData.categoryName },
          { label: "Ton kho", value: detailData.stockQuantity },
          { label: "Ton toi thieu", value: detailData.minStockQuantity },
          { label: "Canh bao ton", value: detailData.stockAlertLabel },
          { label: "Lan nhap gan nhat", value: detailData.lastPurchaseDate, type: "date" },
        ];
      case "suppliers":
        return [
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Nguoi lien he", value: detailData.contactName },
          { label: "Tong phieu nhap", value: detailData.purchaseOrderCount },
          { label: "Da hoan thanh", value: detailData.completedPurchaseOrderCount },
          { label: "Gia tri nhap", value: detailData.totalPurchaseAmount, type: "currency" },
          { label: "Lan nhap gan nhat", value: detailData.lastOrderDate, type: "date" },
        ];
      case "purchase-orders":
        return [
          { label: "Trang thai", value: detailData.status, type: "status" },
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Nha cung cap", value: detailData.supplierName },
          { label: "Nguoi lap", value: detailData.createdUserName },
          { label: "So dong", value: detailData.itemCount },
          { label: "Tong SL", value: detailData.totalQuantity },
          { label: "Tong tien", value: detailData.totalAmount, type: "currency" },
        ];
      case "branches":
        return [
          { label: "Khung gio hoat dong", value: detailData.operatingHours },
          { label: "Yeu cau coc", value: detailData.requiresDepositLabel || (detailData.requiresDeposit ? "Bat" : "Tat"), type: "text" },
          { label: "Nhan vien", value: detailData.userCount },
          { label: "Hoi vien", value: detailData.customerCount },
          { label: "PT", value: detailData.trainerCount },
          { label: "May cham cong", value: detailData.attendanceMachineCount },
        ];
      case "users":
        return [
          { label: "Trang thai", value: detailData.status, type: "status" },
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "So vai tro", value: detailData.roleCount },
          { label: "So quyen", value: detailData.permissionCount },
          { label: "Dang nhap cuoi", value: detailData.lastLoginDateTime, type: "datetime" },
          { label: "Ngay tao", value: detailData.createdDateTime, type: "datetime" },
        ];
      case "roles":
        return [
          { label: "Loai vai tro", value: detailData.roleType, type: "status" },
          { label: "So quyen", value: detailData.permissionCount },
          { label: "So nguoi dung", value: detailData.userCount },
          { label: "Ngay tao", value: detailData.createdDateTime, type: "datetime" },
        ];
      case "staff-shifts":
        return [
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Khung gio", value: detailData.shiftWindow },
          { label: "Ca qua dem", value: detailData.overnightLabel },
          { label: "So lan duoc gan", value: detailData.assignmentCount },
          { label: "Ngay tao", value: detailData.createdDateTime, type: "datetime" },
        ];
      case "staff-shift-assignments":
        return [
          { label: "Nhan vien", value: detailData.staffName },
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Kieu phan ca", value: detailData.rotationLabel },
          { label: "Chu ky xoay", value: detailData.rotationCycleLabel || detailData.rotationCycleDays },
          { label: "Ca hien tai", value: detailData.currentShiftName || detailData.currentShiftCode },
          { label: "Trang thai", value: detailData.currentShiftStatus, type: "status" },
          { label: "Hieu luc", value: detailData.effectiveRange },
        ];
      case "attendance-machines":
        return [
          { label: "Trang thai", value: detailData.connectionStatus, type: "status" },
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Trang thai dong bo", value: Boolean(detailData.syncEnabled).toString() },
          { label: "Lan dong bo cuoi", value: detailData.lastSyncedDateTime, type: "datetime" },
          { label: "So su kien", value: detailData.eventCount },
          { label: "Mat khau thiet bi", value: Boolean(detailData.hasPassword).toString() },
        ];
      case "member-presence":
        return [
          { label: "Hoi vien", value: detailData.fullName || detailData.customerInfo },
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Trang thai", value: detailData.presenceStatus, type: "status" },
          { label: "Bat dau hien dien", value: detailData.currentSessionStartedAt, type: "datetime" },
          { label: "Moc qua ngay", value: detailData.nextAutoCloseAt, type: "datetime" },
          { label: "So phien", value: detailData.sessionCount },
        ];
      case "lockers":
        return [
          { label: "Trang thai", value: detailData.status, type: "status" },
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Khach dang thue", value: detailData.currentCustomerName },
          { label: "Don gia", value: detailData.price, type: "currency" },
          { label: "Luot thue mo", value: detailData.activeRentalCount },
          { label: "Tong luot thue", value: detailData.rentalCount },
        ];
      case "deposits":
        return [
          { label: "Trang thai", value: detailData.status, type: "status" },
          { label: "Loai coc", value: resolveTextDisplay(detailData.itemType, "itemType", detailData) },
          { label: "Khach nop coc", value: detailData.customerName },
          { label: "Ma thue tu", value: detailData.lockerRentalCode },
          { label: "So tien", value: detailData.amount, type: "currency" },
          { label: "Ngay nhan", value: detailData.receivedAt, type: "datetime" },
          { label: "Ngay tra", value: detailData.returnedAt, type: "datetime" },
        ];
      case "audit-logs":
        return [
          { label: "Mo-dun", value: resolveTextDisplay(detailData.module, "module", detailData) },
          { label: "Hanh dong", value: detailData.action, type: "status" },
          { label: "Doi tuong", value: resolveTextDisplay(detailData.entityType, "entityType", detailData) },
          { label: "Ma tham chieu", value: detailData.entityId },
          { label: "IP", value: detailData.ipAddress },
          { label: "Thoi gian", value: detailData.createdAt || detailData.createdDateTime, type: "datetime" },
        ];
      case "receipts":
        return [
          { label: "Trang thai", value: detailData.status, type: "status" },
          { label: "So tien", value: detailData.amount, type: "currency" },
          { label: detailKey === "shop-sales" ? "Ngay ban" : "Ngay thu", value: detailData.receiptDate, type: "datetime" },
          { label: detailKey === "shop-sales" ? "Khach mua" : "Khach hang", value: detailData.customerName },
          { label: "Hop dong", value: detailData.contractCode },
          { label: "Phuong thuc", value: resolveTextDisplay(detailData.paymentMethodName, "paymentMethodName", detailData) },
          { label: detailKey === "shop-sales" ? "Thu ngan" : "Nguoi thu", value: detailData.collectorName },
          ...(detailKey === "shop-sales"
            ? [
                { label: "Mat hang", value: detailData.itemCount },
                { label: "Tong so luong", value: detailData.totalQuantity },
              ]
            : []),
        ];
      case "expenses":
        return [
          { label: "Trang thai", value: detailData.status, type: "status" },
          { label: "So tien", value: detailData.amount, type: "currency" },
          { label: detailKey === "shop-returns" ? "Ngay tra" : "Ngay chi", value: detailData.expenseDate, type: "datetime" },
          { label: detailKey === "shop-returns" ? "Khach nhan hoan" : "Doi tuong nhan", value: detailData.payeeName },
          { label: detailKey === "shop-returns" ? "Loai tra" : "Loai chi", value: detailData.expenseLabel || detailData.expenseType },
          { label: "Phuong thuc", value: resolveTextDisplay(detailData.paymentMethodName, "paymentMethodName", detailData) },
          { label: "Nguoi phe duyet", value: detailData.approverName },
          ...(detailKey === "shop-returns"
            ? [
                { label: "Mat hang", value: detailData.itemCount },
                { label: "Tong so luong", value: detailData.totalQuantity },
              ]
            : []),
        ];
      case "staff-attendance-events":
        return [
          { label: "Nhan vien", value: detailData.staffName },
          { label: "Chi nhanh", value: detailData.branchName },
          { label: "Loai su kien", value: detailData.eventType, type: "status" },
          { label: "Nguon du lieu", value: detailData.source, type: "status" },
          { label: "Xac thuc", value: detailData.verificationMethod, type: "status" },
          { label: "Thoi diem", value: detailData.eventAt, type: "datetime" },
          { label: "May cham cong", value: detailData.machineName },
        ];
      default:
        return [];
    }
  })();

  const sections: DetailSection[] = (() => {
    if (!selected) return [];

    const nextSections: DetailSection[] = [];

    if (isClassScheduleBooking) {
      nextSections.push({
        key: "booking-info",
        label: "Thong tin booking",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Hoi vien", String(detailData.customerName || "-"), String(detailData.customerPhone || "-"))}
            {renderInfoCard("PT phu trach", String(detailData.trainerName || "-"), String(detailData.trainerCode || "-"))}
            {renderInfoCard("contract Code", String(detailData.contractCode || "-"), String(detailData.contractPackageName || translateText("Khong lien ket hop dong")))}
            {renderInfoCard("Khu vuc", String(detailData.location || "-"), String(detailData.code || "-"))}
            {renderInfoCard(
              "Lich dat",
              detailData.scheduledDateTime ? formatDateTime(String(detailData.scheduledDateTime)) : "-",
              resolveTextDisplay(detailData.status, "status", detailData),
            )}
            {renderInfoCard("attachment Count", String(detailData.attachmentCount || 0), `${String(detailData.attendanceCount || 0)} ${translateText("ban ghi diem danh")}`)}
          </div>
        ),
      });

      nextSections.push({
        key: "attendance",
        label: "Diem danh",
        count: Array.isArray(detailData.attendance) ? detailData.attendance.length : Number(detailData.attendanceCount || 0),
        content: renderMiniTable(
          ["Hoi vien", "Check-in", "Trang thai", "Tru buoi", "Ghi chu"],
          ((detailData.attendance as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.customerName || "-"),
            formatDateTime(String(item.checkInDateTime || item.checkInAt || "")),
            <StatusBadge key={`${String(item.id)}-booking-attendance-status`} value={String(item.status || "")} />,
            String(item.consumedSessions || 0),
            String(item.note || "-"),
          ]),
          "Chua co diem danh",
          "Booking nay chua co ban ghi diem danh nao.",
        ),
      });
    }

    if (isClassScheduleClass) {
      nextSections.push({
        key: "class-config",
        label: "Cau hinh lop",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Dich vu", String(detailData.serviceName || "-"), String(detailData.serviceCode || "-"))}
            {renderInfoCard("Loai goi", resolveTextDisplay(detailData.packageType, "packageType", detailData), resolveTextDisplay(detailData.serviceCategory, "category", detailData))}
            {renderInfoCard("Tong buoi", String(detailData.totalSessions || detailData.sessionCount || 0), String(detailData.sessionLabel || "-"))}
            {renderInfoCard("price", formatCurrency(Number(detailData.price || 0)), resolveTextDisplay(detailData.remainingValueRule, "remainingValueRule", detailData))}
            {renderInfoCard("bonus Sessions", String(detailData.bonusSessions || 0), String(detailData.bonusDays || 0))}
            {renderInfoCard("remaining Value Rule", resolveTextDisplay(detailData.remainingValueRule, "remainingValueRule", detailData), String(detailData.description || "-"))}
          </div>
        ),
      });

      nextSections.push({
        key: "registrations",
        label: "Dang ky",
        count: Array.isArray(detailData.contracts) ? detailData.contracts.length : Number(detailData.contractCount || 0),
        content: renderMiniTable(
          ["Ma HD", "Hoi vien", "Het han", "Con no", "Trang thai"],
          ((detailData.contracts as Array<Record<string, unknown>> | undefined) || []).map((contract) => [
            String(contract.code || "-"),
            String(contract.customerName || "-"),
            formatDate(String(contract.endDate || "")),
            formatCurrency(Number(contract.amountDue || 0)),
            <StatusBadge key={`${String(contract.id)}-class-contract-status`} value={String(contract.status || "")} />,
          ]),
          "Chua co dang ky",
          "Lop nay chua co dang ky nao.",
        ),
      });
    }

    if (isClassScheduleTimetable) {
      nextSections.push({
        key: "class-operations",
        label: "Van hanh lop",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("PT phu trach", String(detailData.trainerName || "-"), String(detailData.trainerCode || "-"))}
            {renderInfoCard("Booking chinh", String(detailData.customerName || "-"), String(detailData.contractCode || "-"))}
            {renderInfoCard("Khu vuc", String(detailData.location || "-"), String(detailData.code || "-"))}
            {renderInfoCard(
              "Khung gio",
              detailData.scheduledDateTime ? formatDateTime(String(detailData.scheduledDateTime)) : "-",
              `${String(detailData.durationMinutes || 0)} ${translateText("phut")}`,
            )}
            {renderInfoCard("attendance Count", String(detailData.attendanceCount || 0), String(detailData.outcome || "-"))}
            {renderInfoCard("present Count", String(detailData.presentCount || 0), String(detailData.note || "-"))}
            {renderInfoCard("attachment Count", String(detailData.attachmentCount || 0), String(detailData.outcome || detailData.note || "-"))}
          </div>
        ),
      });

      nextSections.push({
        key: "attendance",
        label: "Diem danh",
        count: Array.isArray(detailData.attendance) ? detailData.attendance.length : Number(detailData.attendanceCount || 0),
        content: renderMiniTable(
          ["Hoi vien", "Check-in", "Trang thai", "Tru buoi", "Ghi chu"],
          ((detailData.attendance as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.customerName || "-"),
            formatDateTime(String(item.checkInDateTime || item.checkInAt || "")),
            <StatusBadge key={`${String(item.id)}-timetable-attendance-status`} value={String(item.status || "")} />,
            String(item.consumedSessions || 0),
            String(item.note || "-"),
          ]),
          "Chua co diem danh",
          "Khung lop nay chua co ban ghi diem danh nao.",
        ),
      });
    }

    if (isClassScheduleGroupPt) {
      nextSections.push({
        key: "group-pt-info",
        label: "Thong tin PT nhom",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("PT phu trach", String(detailData.trainerName || "-"), String(detailData.trainerCode || "-"))}
            {renderInfoCard("Booking chinh", String(detailData.customerName || "-"), String(detailData.contractCode || "-"))}
            {renderInfoCard("Khu vuc", String(detailData.location || "-"), String(detailData.code || "-"))}
            {renderInfoCard(
              "Lich PT nhom",
              detailData.scheduledDateTime ? formatDateTime(String(detailData.scheduledDateTime)) : "-",
              String(detailData.contractPackageName || translateText("Khong lien ket hop dong")),
            )}
            {renderInfoCard("So booking", String(detailData.attendanceCount || 0), String(detailData.note || "-"))}
            {renderInfoCard("present Count", String(detailData.presentCount || 0), String(detailData.outcome || "-"))}
            {renderInfoCard("Tru buoi", String(detailData.consumedSessions || 0), resolveTextDisplay(detailData.status, "status", detailData))}
            {renderInfoCard("attachment Count", String(detailData.attachmentCount || 0), String(detailData.note || "-"))}
          </div>
        ),
      });

      nextSections.push({
        key: "attendance",
        label: "Diem danh",
        count: Array.isArray(detailData.attendance) ? detailData.attendance.length : Number(detailData.attendanceCount || 0),
        content: renderMiniTable(
          ["Hoi vien", "Check-in", "Trang thai", "Tru buoi", "Ghi chu"],
          ((detailData.attendance as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.customerName || "-"),
            formatDateTime(String(item.checkInDateTime || item.checkInAt || "")),
            <StatusBadge key={`${String(item.id)}-group-pt-attendance-status`} value={String(item.status || "")} />,
            String(item.consumedSessions || 0),
            String(item.note || "-"),
          ]),
          "Chua co diem danh",
          "Lich PT nhom nay chua co ban ghi tham gia nao.",
        ),
      });
    }

    if (isOperationsServicePriceBook) {
      nextSections.push({
        key: "price-book-info",
        label: "Thong tin bang gia",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Dich vu", String(detailData.serviceName || "-"), String(detailData.serviceCode || "-"))}
            {renderInfoCard("Phan loai goi", resolveTextDisplay(detailData.packageType, "packageType", detailData), resolveTextDisplay(detailData.serviceCategory, "category", detailData))}
            {renderInfoCard("Cau hinh buoi", String(detailData.sessionLabel || detailData.sessionCount || "-"), `${String(detailData.durationDays || 0)} ${translateText("ngay")}`)}
            {renderInfoCard("Gia ban", formatCurrency(Number(detailData.price || 0)), resolveTextDisplay(detailData.remainingValueRule, "remainingValueRule", detailData))}
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.name || "-"))}
            {renderInfoCard("Mo ta", String(detailData.description || "-"), `${translateText("So dang ky")}: ${String(detailData.contractCount || 0)}`)}
          </div>
        ),
      });

      nextSections.push({
        key: "price-book-contracts",
        label: "Dang ky su dung",
        count: Array.isArray(detailData.contracts) ? detailData.contracts.length : Number(detailData.contractCount || 0),
        content: renderMiniTable(
          ["Ma HD", "Hoi vien", "Het han", "Con no", "Trang thai"],
          ((detailData.contracts as Array<Record<string, unknown>> | undefined) || []).map((contract) => [
            String(contract.code || "-"),
            String(contract.customerName || "-"),
            formatDate(String(contract.endDate || "")),
            formatCurrency(Number(contract.amountDue || 0)),
            <StatusBadge key={`${String(contract.id)}-service-price-book-contract-status`} value={String(contract.status || "")} />,
          ]),
          "Chua co dang ky",
          "Bang gia nay chua duoc ap dung cho hop dong nao.",
        ),
      });
    }

    if (resource.key === "operations-contract-upgrade") {
      nextSections.push({
        key: "upgrade-profile",
        label: contractCloneLabels?.overview || "Ho so nang cap",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Hoi vien", String(detailData.customerName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Goi hien tai", String(detailData.servicePackageName || "-"), String(detailData.serviceName || "-"))}
            {renderInfoCard("Hop dong tham chieu", String(detailData.oldContractCode || "-"), String(detailData.branchName || "-"))}
            {renderInfoCard("Gia tri goc", formatCurrency(Number(detailData.grossAmount || 0)), `${translateText("Tong giam")}: ${formatCurrency(Number(detailData.totalDiscount || 0))}`)}
            {renderInfoCard("Gia tri con lai", formatCurrency(Number(detailData.remainingValue || 0)), `${translateText("Tong tien")}: ${formatCurrency(Number(detailData.totalAmount || 0))}`)}
            {renderInfoCard("Thanh toan", resolveTextDisplay(detailData.paymentStatus, "paymentStatus", detailData), `${translateText("Con no")}: ${formatCurrency(Number(detailData.amountDue || 0))}`)}
          </div>
        ),
      });
    }

    if (resource.key === "operations-contract-freeze") {
      nextSections.push({
        key: "freeze-profile",
        label: contractCloneLabels?.overview || "Thong tin bao luu",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Hoi vien", String(detailData.customerName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Goi tam dung", String(detailData.servicePackageName || "-"), String(detailData.branchName || "-"))}
            {renderInfoCard("Bat dau bao luu", detailData.startDate ? formatDate(String(detailData.startDate)) : "-", `${translateText("Ket thuc bao luu")}: ${detailData.endDate ? formatDate(String(detailData.endDate)) : "-"}`)}
            {renderInfoCard("Buoi con lai", String(detailData.remainingSessions || 0), `${translateText("Gia tri con lai")}: ${formatCurrency(Number(detailData.remainingValue || 0))}`)}
            {renderInfoCard("Thanh toan", resolveTextDisplay(detailData.paymentStatus, "paymentStatus", detailData), `${translateText("Con no")}: ${formatCurrency(Number(detailData.amountDue || 0))}`)}
            {renderInfoCard("Trang thai", resolveTextDisplay(detailData.status, "status", detailData), String(detailData.note || "-"))}
          </div>
        ),
      });
    }

    if (resource.key === "operations-service-registration") {
      nextSections.push({
        key: "registration-profile",
        label: contractCloneLabels?.overview || "Ho so dang ky",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Hoi vien", String(detailData.customerName || "-"), String(detailData.customerPhone || "-"))}
            {renderInfoCard("Goi dang ky", String(detailData.servicePackageName || "-"), String(detailData.serviceName || "-"))}
            {renderInfoCard("Sale phu trach", String(detailData.saleUserName || "-"), String(detailData.branchName || "-"))}
            {renderInfoCard("PT phu trach", String(detailData.trainerName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Thoi han goi", formatDateRangeLabel(detailData.startDate, detailData.endDate), `${translateText("Tong buoi")}: ${String(detailData.totalSessions || 0)} | ${translateText("Buoi con lai")}: ${String(detailData.remainingSessions || 0)}`)}
            {renderInfoCard("Thanh toan", formatCurrency(Number(detailData.amountPaid || 0)), `${translateText("Con no")}: ${formatCurrency(Number(detailData.amountDue || 0))}`)}
          </div>
        ),
      });
    }

    if (resource.key === "operations-contract-renewal") {
      nextSections.push({
        key: "renewal-profile",
        label: contractCloneLabels?.overview || "Ho so gia han",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Hoi vien", String(detailData.customerName || "-"), String(detailData.customerPhone || "-"))}
            {renderInfoCard("Goi hien tai", String(detailData.servicePackageName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Sale phu trach", String(detailData.saleUserName || "-"), String(detailData.branchName || "-"))}
            {renderInfoCard("PT phu trach", String(detailData.trainerName || "-"), String(detailData.status || "-"))}
            {renderInfoCard("Ky han hop dong", formatDateRangeLabel(detailData.startDate, detailData.endDate), `${translateText("Ngay con lai")}: ${String(detailData.daysRemaining || 0)}`)}
            {renderInfoCard("Gia tri con lai", formatCurrency(Number(detailData.remainingValue || 0)), `${translateText("Con no")}: ${formatCurrency(Number(detailData.amountDue || 0))}`)}
          </div>
        ),
      });
    }

    if (resource.key === "operations-contract-transfer") {
      nextSections.push({
        key: "transfer-profile",
        label: contractCloneLabels?.overview || "Ho so chuyen nhuong",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Chu hop dong", String(detailData.customerName || "-"), String(detailData.customerPhone || "-"))}
            {renderInfoCard("Hop dong goc", String(detailData.oldContractCode || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Goi dang chuyen", String(detailData.servicePackageName || "-"), String(detailData.serviceName || "-"))}
            {renderInfoCard("Buoi con lai", String(detailData.remainingSessions || 0), `${translateText("Gia tri con lai")}: ${formatCurrency(Number(detailData.remainingValue || 0))}`)}
            {renderInfoCard("Thanh toan", resolveTextDisplay(detailData.paymentStatus, "paymentStatus", detailData), `${translateText("Con no")}: ${formatCurrency(Number(detailData.amountDue || 0))}`)}
            {renderInfoCard("Trang thai", resolveTextDisplay(detailData.status, "status", detailData), String(detailData.note || "-"))}
          </div>
        ),
      });
    }

    if (resource.key === "operations-branch-transfer") {
      nextSections.push({
        key: "branch-transfer-profile",
        label: contractCloneLabels?.overview || "Thong tin dieu chuyen",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Hoi vien", String(detailData.customerName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Chi nhanh hien tai", String(detailData.branchName || "-"), String(detailData.servicePackageName || "-"))}
            {renderInfoCard("Sale phu trach", String(detailData.saleUserName || "-"), String(detailData.trainerName || "-"))}
            {renderInfoCard("PT phu trach", String(detailData.trainerName || "-"), resolveTextDisplay(detailData.status, "status", detailData))}
            {renderInfoCard("Ky han hop dong", formatDateRangeLabel(detailData.startDate, detailData.endDate), `${translateText("Buoi con lai")}: ${String(detailData.remainingSessions || 0)}`)}
            {renderInfoCard("Thanh toan", resolveTextDisplay(detailData.paymentStatus, "paymentStatus", detailData), `${translateText("Con no")}: ${formatCurrency(Number(detailData.amountDue || 0))}`)}
          </div>
        ),
      });
    }

    if (resource.key === "operations-contract-conversion") {
      nextSections.push({
        key: "conversion-profile",
        label: contractCloneLabels?.overview || "Ho so chuyen doi",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Hoi vien", String(detailData.customerName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Goi hien tai", String(detailData.servicePackageName || "-"), String(detailData.serviceName || "-"))}
            {renderInfoCard("Hop dong cu", String(detailData.oldContractCode || "-"), String(detailData.branchName || "-"))}
            {renderInfoCard("Buoi con lai", String(detailData.remainingSessions || 0), `${translateText("Gia tri con lai")}: ${formatCurrency(Number(detailData.remainingValue || 0))}`)}
            {renderInfoCard("Thanh toan", resolveTextDisplay(detailData.paymentStatus, "paymentStatus", detailData), `${translateText("Con no")}: ${formatCurrency(Number(detailData.amountDue || 0))}`)}
            {renderInfoCard("Trang thai", resolveTextDisplay(detailData.status, "status", detailData), String(detailData.note || "-"))}
          </div>
        ),
      });
    }

    if (resource.key === "operations-contract-cancel") {
      nextSections.push({
        key: "cancel-profile",
        label: contractCloneLabels?.overview || "Ho so huy",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Hoi vien", String(detailData.customerName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Goi da huy", String(detailData.servicePackageName || "-"), String(detailData.branchName || "-"))}
            {renderInfoCard("Da thu", formatCurrency(Number(detailData.amountPaid || 0)), `${translateText("Con no")}: ${formatCurrency(Number(detailData.amountDue || 0))}`)}
            {renderInfoCard("Gia tri chot", formatCurrency(Number(detailData.remainingValue || 0)), `${translateText("Ngay dong")}: ${detailData.endDate ? formatDate(String(detailData.endDate)) : "-"}`)}
            {renderInfoCard("Thanh toan", resolveTextDisplay(detailData.paymentStatus, "paymentStatus", detailData), resolveTextDisplay(detailData.status, "status", detailData))}
            {renderInfoCard("Ghi chu", String(detailData.note || "-"))}
          </div>
        ),
      });
    }

    if (normalizedDetailKey === "customers") {
      const customerAvatarUrl = String(detailData.avatarUrl || detailData.photoUrl || detailData.imageUrl || "").trim();

      if (customerAvatarUrl) {
        nextSections.push({
          key: "customer-avatar",
          label: "Anh dai dien",
          content: (
            <div className="grid gap-3 md:grid-cols-2">
              <PreviewAssetCard
                altFallback="Anh dai dien hoi vien"
                assetUrl={customerAvatarUrl}
                description={String(detailData.phone || detailData.email || detailData.branchName || "")}
                emptyMessage="Chua cap nhat anh dai dien cho hoi vien nay."
                eyebrow="Anh dai dien"
                openLabel="Mo anh"
                title={String(detailData.fullName || detailData.customerInfo || detailData.code || "-")}
              />
            </div>
          ),
        });
      }

      if (isOperationsLoyalty) {
        nextSections.push({
          key: "loyalty-profile",
          label: "Ho so loyalty",
          content: (
            <div className="grid gap-3 md:grid-cols-2">
              {renderInfoCard("Hoi vien loyalty", String(detailData.customerInfo || detailData.customerName || "-"), String(detailData.code || "-"))}
              {renderInfoCard("Hang loyalty", String(detailData.groupName || "-"), String(detailData.branchName || "-"))}
              {renderInfoCard("Nhan vien CSKH", String(detailData.assignedUserName || "-"), resolveTextDisplay(detailData.membershipStatus, "membershipStatus", detailData))}
              {renderInfoCard("Ngay dang ky loyalty", detailData.registrationDate ? formatDate(String(detailData.registrationDate)) : "-", `${translateText("Bat dau uu dai")}: ${detailData.startTrainingDate ? formatDate(String(detailData.startTrainingDate)) : "-"}`)}
              {renderInfoCard("Het han uu dai", detailData.endTrainingDate ? formatDate(String(detailData.endTrainingDate)) : "-", `${translateText("Cong no")}: ${formatCurrency(Number(detailData.outstandingDebt || 0))}`)}
              {renderInfoCard("Uu dai / ghi chu", String(detailData.otherInfo || "-"), String(detailData.note || "-"))}
            </div>
          ),
        });
      }

      const noteItems = ((timelineQuery.data?.notes as Array<Record<string, unknown>> | undefined) || []).map((item) => ({
        action: "Ghi chu hoi vien",
        note: String(item.content || ""),
        createdAt: String(item.createdAt || ""),
      }));
      const sessionItems = ((detailData.trainingSessions as Array<Record<string, unknown>> | undefined) || []).map((session) => ({
        action: `Buoi tap ${String(session.code || "")}`,
        note: `${String((session.trainer as { fullName?: string } | undefined)?.fullName || "PT")} - ${String(session.outcome || session.note || "Cap nhat buoi tap")}`,
        createdAt: String(session.scheduledAt || ""),
      }));

      nextSections.push({
        key: "timeline",
        label: isOperationsLoyalty ? "Lich su loyalty" : "Lich su",
        count: noteItems.length + sessionItems.length,
        content: <Timeline items={[...noteItems, ...sessionItems]} />,
      });

      nextSections.push({
        key: "contracts",
        label: isOperationsLoyalty ? "Hop dong lien quan" : "Hop dong",
        count: Array.isArray(detailData.contracts) ? detailData.contracts.length : 0,
        content: renderMiniTable(
          ["Ma HD", "Goi", "Trang thai", "Con no", "Het han"],
          ((detailData.contracts as Array<Record<string, unknown>> | undefined) || []).map((contract) => [
            String(contract.code || "-"),
            String(contract.packageName || (contract.servicePackage as { name?: string } | undefined)?.name || "-"),
            <StatusBadge key={`${String(contract.id)}-status`} value={String(contract.status || "")} />,
            formatCurrency(Number(contract.amountDue || 0)),
            formatDate(String(contract.endDate || "")),
          ]),
          "Chua co hop dong",
          isOperationsLoyalty ? "Hoi vien loyalty nay chua phat sinh hop dong nao." : "Hoi vien nay chua phat sinh hop dong nao.",
        ),
      });

      nextSections.push({
        key: "payments",
        label: isOperationsLoyalty ? "Giao dich thu" : "Phieu thu",
        count: Array.isArray(detailData.receipts) ? detailData.receipts.length : 0,
        content: renderMiniTable(
          ["Ma phieu", "Ngay thu", "So tien", "Noi dung"],
          ((detailData.receipts as Array<Record<string, unknown>> | undefined) || []).map((receipt) => [
            String(receipt.code || "-"),
            formatDateTime(String(receipt.receiptDate || "")),
            formatCurrency(Number(receipt.amount || 0)),
            String(receipt.content || "-"),
          ]),
          "Chua co thanh toan",
          isOperationsLoyalty ? "Hoi vien loyalty nay chua co giao dich thu nao." : "Khach hang nay chua co phieu thu nao.",
        ),
      });

      nextSections.push({
        key: "sessions",
        label: "Buoi tap",
        count: Array.isArray(detailData.trainingSessions) ? detailData.trainingSessions.length : 0,
        content: renderMiniTable(
          ["Ma buoi", "Lich tap", "PT", "Trang thai"],
          ((detailData.trainingSessions as Array<Record<string, unknown>> | undefined) || []).map((session) => [
            String(session.code || "-"),
            formatDateTime(String(session.scheduledAt || "")),
            String((session.trainer as { fullName?: string } | undefined)?.fullName || "-"),
            <StatusBadge key={`${String(session.id)}-session-status`} value={String(session.status || "")} />,
          ]),
          "Chua co buoi tap",
          isOperationsLoyalty ? "Hoi vien loyalty nay chua co lich su buoi tap." : "Khach hang nay chua co lich su buoi tap.",
        ),
      });
    }

    if (normalizedDetailKey === "leads") {
      nextSections.push({
        key: "timeline",
        label: "Lich su cham soc",
        count: Array.isArray(detailData.logs) ? detailData.logs.length : 0,
        content: (
          <Timeline
            items={((detailData.logs as Array<Record<string, unknown>> | undefined) || []).map((log) => ({
              action: String(log.performedByName ? `${String(log.activityType || log.content || "Cham soc")} | ${String(log.performedByName)}` : log.activityType || log.content || "Cham soc"),
              content: String(log.content || ""),
              result: String(log.result || ""),
              contactAt: String(log.contactAt || ""),
            }))}
          />
        ),
      });

      nextSections.push({
        key: "conversion",
        label: "Chuyen doi",
        content:
          detailData.convertedCustomer ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Khach hang da chuyen doi</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {String((detailData.convertedCustomer as { fullName?: string } | undefined)?.fullName || "-")}
              </p>
            </div>
          ) : (
            <EmptyState description="Lead nay chua duoc convert thanh hoi vien." title="Chua chuyen doi" />
          ),
      });
    }

    if (normalizedDetailKey === "contracts") {
      nextSections.push({
        key: "timeline",
        label: contractCloneLabels?.timeline || "Lich su",
        count: Array.isArray(detailData.histories) ? detailData.histories.length : 0,
        content: (
          <Timeline
            items={((detailData.histories as Array<Record<string, unknown>> | undefined) || []).map((history) => ({
              action: String(history.actedByName ? `${String(history.action || "Cap nhat hop dong")} | ${String(history.actedByName)}` : history.action || "Cap nhat hop dong"),
              note: String(history.note || ""),
              createdAt: String(history.createdAt || ""),
            }))}
          />
        ),
      });

      nextSections.push({
        key: "receipts",
        label: contractCloneLabels?.receipts || "Phieu thu",
        count: Array.isArray(detailData.receipts) ? detailData.receipts.length : 0,
        content: renderMiniTable(
          ["Ma phieu", "Ngay thu", "So tien", "Phuong thuc"],
          ((detailData.receipts as Array<Record<string, unknown>> | undefined) || []).map((receipt) => [
            String(receipt.code || "-"),
            formatDateTime(String(receipt.receiptDate || "")),
            formatCurrency(Number(receipt.amount || 0)),
            String((receipt.paymentMethod as { name?: string } | undefined)?.name || "-"),
          ]),
          "Chua co phieu thu",
          "Hop dong nay chua ghi nhan phieu thu nao.",
        ),
      });

      nextSections.push({
        key: "items",
        label: contractCloneLabels?.items || "Hang muc",
        count: Array.isArray(detailData.items) ? detailData.items.length : 0,
        content: renderMiniTable(
          ["Mo ta", "So luong", "So buoi", "Don gia", "Thanh tien"],
          ((detailData.items as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.itemLabel || item.description || "-"),
            String(item.quantity || 0),
            String(item.sessionCount || 0),
            formatCurrency(Number(item.unitPrice || 0)),
            formatCurrency(Number(item.totalAmount || 0)),
          ]),
          "Chua co hang muc",
          "Hop dong nay chua co chi tiet hang muc nao.",
        ),
      });

      nextSections.push({
        key: "sessions",
        label: contractCloneLabels?.sessions || "Buoi tap",
        count: Array.isArray(detailData.trainingSessions) ? detailData.trainingSessions.length : 0,
        content: renderMiniTable(
          ["Ma buoi", "Lich tap", "PT", "Trang thai"],
          ((detailData.trainingSessions as Array<Record<string, unknown>> | undefined) || []).map((session) => [
            String(session.code || "-"),
            formatDateTime(String(session.scheduledAt || "")),
            String((session.trainer as { fullName?: string } | undefined)?.fullName || "-"),
            <StatusBadge key={`${String(session.id)}-contract-session`} value={String(session.status || "")} />,
          ]),
          "Chua co buoi tap",
          "Hop dong nay chua co buoi tap nao duoc len lich.",
        ),
      });

      nextSections.push({
        key: "conversions",
        label: contractCloneLabels?.conversions || "Chuyen doi",
        count:
          ((detailData.conversionsFrom as Array<Record<string, unknown>> | undefined) || []).length +
          ((detailData.conversionsTo as Array<Record<string, unknown>> | undefined) || []).length,
        content: renderMiniTable(
          ["Chieu", "Loai", "Hop dong lien quan", "Gia tri", "Ghi chu"],
          [
            ...(((detailData.conversionsFrom as Array<Record<string, unknown>> | undefined) || []).map((conversion) => [
              "Di",
              String(conversion.conversionType || "-"),
              String(conversion.newContractCode || "-"),
              formatCurrency(Number(conversion.differenceAmount || 0)),
              String(conversion.note || "-"),
            ])),
            ...(((detailData.conversionsTo as Array<Record<string, unknown>> | undefined) || []).map((conversion) => [
              "Den",
              String(conversion.conversionType || "-"),
              String(conversion.oldContractCode || "-"),
              formatCurrency(Number(conversion.differenceAmount || 0)),
              String(conversion.note || "-"),
            ])),
          ],
          "Chua co chuyen doi",
          "Hop dong nay chua phat sinh giao dich chuyen doi.",
        ),
      });
    }

    if (isClassScheduleLineCategory) {
      nextSections.push({
        key: "line-catalog",
        label: "Danh muc line",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Loai line", resolveTextDisplay(detailData.category, "category", detailData), String(detailData.name || "-"))}
            {renderInfoCard("Gia mac dinh", formatCurrency(Number(detailData.defaultPrice || 0)), `${String(detailData.defaultSessions || 0)} ${translateText("buoi")}`)}
            {renderInfoCard("Thoi han", `${String(detailData.durationDays || 0)} ${translateText("ngay")}`, String(detailData.description || "-"))}
            {renderInfoCard(
              "So lop",
              String(detailData.packageCount || 0),
              `${translateText("Dang mo")}: ${String(detailData.activePackageCount || 0)} | ${translateText("Luot dung")}: ${String(detailData.contractItemCount || 0)}`,
            )}
          </div>
        ),
      });

      nextSections.push({
        key: "classes",
        label: "Danh sach lop",
        count: Array.isArray(detailData.packages) ? detailData.packages.length : Number(detailData.packageCount || 0),
        content: renderMiniTable(
          ["Ma lop", "Ten lop", "So buoi", "Hoc phi", "Dang ky", "Trang thai"],
          ((detailData.packages as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.code || "-"),
            String(item.name || "-"),
            String(item.bonusSessions ? `${String(item.sessionCount || 0)} + ${String(item.bonusSessions || 0)}` : item.sessionCount || 0),
            formatCurrency(Number(item.price || 0)),
            String(item.contractCount || 0),
            <StatusBadge key={`${String(item.id)}-line-class-status`} value={String(item.status || "")} />,
          ]),
          "Chua co lop",
          "Line nay chua co lop nao duoc mo.",
        ),
      });
    }

    if (isClassScheduleLineSchedule) {
      nextSections.push({
        key: "line-operations",
        label: "Van hanh line",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard(
              "Lich line",
              detailData.scheduledDateTime ? formatDateTime(String(detailData.scheduledDateTime)) : "-",
              resolveTextDisplay(detailData.status, "status", detailData),
            )}
            {renderInfoCard("Line / Khu vuc", String(detailData.location || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Huong dan", String(detailData.trainerName || "-"), String(detailData.trainerCode || "-"))}
            {renderInfoCard("So booking", String(detailData.attendanceCount || 0), `${translateText("Nguoi co mat")}: ${String(detailData.presentCount || 0)}`)}
            {renderInfoCard("So tep dinh kem", String(detailData.attachmentCount || 0), String(detailData.outcome || detailData.note || "-"))}
          </div>
        ),
      });

      nextSections.push({
        key: "booking-attendance",
        label: "Booking / diem danh",
        count: Array.isArray(detailData.attendance) ? detailData.attendance.length : Number(detailData.attendanceCount || 0),
        content: renderMiniTable(
          ["Hoi vien", "Check-in", "Trang thai", "Tru buoi", "Ghi chu"],
          ((detailData.attendance as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.customerName || "-"),
            formatDateTime(String(item.checkInDateTime || item.checkInAt || "")),
            <StatusBadge key={`${String(item.id)}-line-attendance-status`} value={String(item.status || "")} />,
            String(item.consumedSessions || 0),
            String(item.note || "-"),
          ]),
          "Chua co booking",
          "Lich line nay chua co booking / diem danh nao.",
        ),
      });
    }

    if (isClassScheduleBookingAttachment) {
      nextSections.push({
        key: "booking-record",
        label: "Ho so booking",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Hoi vien", String(detailData.customerName || "-"), String(detailData.customerPhone || "-"))}
            {renderInfoCard("PT phu trach", String(detailData.trainerName || "-"), String(detailData.trainerCode || "-"))}
            {renderInfoCard("Ma hop dong", String(detailData.contractCode || "-"), String(detailData.contractPackageName || translateText("Khong lien ket hop dong")))}
            {renderInfoCard("Khu vuc", String(detailData.location || "-"), String(detailData.code || "-"))}
            {renderInfoCard(
              "Thoi diem",
              detailData.scheduledDateTime ? formatDateTime(String(detailData.scheduledDateTime)) : "-",
              resolveTextDisplay(detailData.status, "status", detailData),
            )}
            {renderInfoCard("So tep dinh kem", String(detailData.attachmentCount || 0), `${String(detailData.attendanceCount || 0)} ${translateText("ban ghi diem danh")}`)}
          </div>
        ),
      });
    }

    if (normalizedDetailKey === "services" && !isClassScheduleLineCategory) {
      nextSections.push({
        key: "packages",
        label: "Goi dich vu",
        count: Array.isArray(detailData.packages) ? detailData.packages.length : Number(detailData.packageCount || 0),
        content: renderMiniTable(
          ["Ma goi", "Ten goi", "So buoi", "Gia", "Hop dong", "Trang thai"],
          ((detailData.packages as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.code || "-"),
            String(item.name || "-"),
            String(item.bonusSessions ? `${String(item.sessionCount || 0)} + ${String(item.bonusSessions || 0)}` : item.sessionCount || 0),
            formatCurrency(Number(item.price || 0)),
            String(item.contractCount || 0),
            <StatusBadge key={`${String(item.id)}-service-package-status`} value={String(item.status || "")} />,
          ]),
          "Chua co goi dich vu",
          "Dich vu nay chua co goi nao duoc tao.",
        ),
      });

      nextSections.push({
        key: "service-info",
        label: "Van hanh",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), resolveTextDisplay(detailData.category, "category", detailData))}
            {renderInfoCard("Gia mac dinh", formatCurrency(Number(detailData.defaultPrice || 0)), `${String(detailData.defaultSessions || 0)} ${translateText("buoi")}`)}
            {renderInfoCard("Thoi han", `${String(detailData.durationDays || 0)} ${translateText("ngay")}`, String(detailData.description || "-"))}
            {renderInfoCard("Su dung", `${String(detailData.contractItemCount || 0)} ${translateText("hang muc hop dong")}`, String(detailData.packageNames || translateText("Chua co goi nao"))) }
          </div>
        ),
      });
    }

    if (normalizedDetailKey === "service-packages" && !isClassScheduleClass && !isOperationsServicePriceBook) {
      nextSections.push({
        key: "service",
        label: "Dich vu cha",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Dich vu", String(detailData.serviceName || "-"), String(detailData.serviceCode || "-"))}
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), resolveTextDisplay(detailData.serviceCategory, "category", detailData))}
            {renderInfoCard("Cau hinh buoi", String(detailData.sessionLabel || "-"), `${String(detailData.durationDays || 0)} ${translateText("ngay")}`)}
            {renderInfoCard("Rule GT con lai", resolveTextDisplay(detailData.remainingValueRule, "remainingValueRule", detailData), String(detailData.description || ""))}
          </div>
        ),
      });

      nextSections.push({
        key: "contracts",
        label: "Hop dong",
        count: Array.isArray(detailData.contracts) ? detailData.contracts.length : Number(detailData.contractCount || 0),
        content: renderMiniTable(
          ["Ma HD", "Khach hang", "Het han", "Con no", "Trang thai"],
          ((detailData.contracts as Array<Record<string, unknown>> | undefined) || []).map((contract) => [
            String(contract.code || "-"),
            String(contract.customerName || "-"),
            formatDate(String(contract.endDate || "")),
            formatCurrency(Number(contract.amountDue || 0)),
            <StatusBadge key={`${String(contract.id)}-package-contract-status`} value={String(contract.status || "")} />,
          ]),
          "Chua co hop dong",
          "Goi dich vu nay chua duoc ap dung cho hop dong nao.",
        ),
      });
    }

    if (isStaffProgram) {
      nextSections.push({
        key: "program-info",
        label: "Thong tin giao an",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("PT phu trach", String(detailData.fullName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.specialty || "-"))}
            {renderInfoCard("Lien he", String(detailData.phone || "-"), String(detailData.email || "-"))}
            {renderInfoCard(
              "Buoi tiep theo",
              detailData.nextSessionDateTime ? formatDateTime(String(detailData.nextSessionDateTime)) : "-",
              `${String(detailData.upcomingSessionCount || 0)} ${translateText("lich sap toi")}`,
            )}
            {renderInfoCard("Hoc vien dang theo", String(detailData.activeContractCount || 0), `${String(detailData.completedSessionCount || 0)} ${translateText("Da hoan thanh")}`)}
          </div>
        ),
      });

      nextSections.push({
        key: "students",
        label: "Hoc vien dang theo",
        count: Array.isArray(detailData.contracts) ? detailData.contracts.length : Number(detailData.contractCount || 0),
        content: renderMiniTable(
          ["Ma HD", "Hoc vien", "Goi ap dung", "Het han", "Trang thai"],
          ((detailData.contracts as Array<Record<string, unknown>> | undefined) || []).map((contract) => [
            String(contract.code || "-"),
            String(contract.customerName || "-"),
            String(contract.packageName || "-"),
            formatDate(String(contract.endDate || "")),
            <StatusBadge key={`${String(contract.id)}-program-contract-status`} value={String(contract.status || "")} />,
          ]),
          "Chua co hoc vien",
          "Giao an nay chua duoc gan cho hoc vien nao.",
        ),
      });

      nextSections.push({
        key: "schedule",
        label: "Lich ap dung",
        count: Array.isArray(detailData.trainingSessions) ? detailData.trainingSessions.length : Number(detailData.trainingSessionCount || 0),
        content: renderMiniTable(
          ["Ma lich", "Hoc vien", "Khung gio", "Tru buoi", "Trang thai"],
          ((detailData.trainingSessions as Array<Record<string, unknown>> | undefined) || []).map((session) => [
            String(session.code || "-"),
            String(session.customerName || "-"),
            formatDateTime(String(session.scheduledDateTime || session.scheduledAt || "")),
            String(session.consumedSessions || 0),
            <StatusBadge key={`${String(session.id)}-program-session-status`} value={String(session.status || "")} />,
          ]),
          "Chua co lich ap dung",
          "Giao an nay chua co lich tap lien ket nao.",
        ),
      });
    }

    if (normalizedDetailKey === "trainers" && !isStaffProgram) {
      nextSections.push({
        key: "workload",
        label: "Lich va tai trong",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.specialty || "-"))}
            {renderInfoCard("Lien he", String(detailData.phone || "-"), String(detailData.email || "-"))}
            {renderInfoCard("Buoi tiep theo", formatDateTime(String(detailData.nextSessionDateTime || "")), `${String(detailData.upcomingSessionCount || 0)} ${translateText("lich sap toi")}`)}
            {renderInfoCard("Da hoan thanh", String(detailData.completedSessionCount || 0), `${String(detailData.activeContractCount || 0)} ${translateText("hop dong dang mo")}`)}
          </div>
        ),
      });

      nextSections.push({
        key: "contracts",
        label: "Hop dong",
        count: Array.isArray(detailData.contracts) ? detailData.contracts.length : Number(detailData.contractCount || 0),
        content: renderMiniTable(
          ["Ma HD", "Khach hang", "Goi", "Het han", "Trang thai"],
          ((detailData.contracts as Array<Record<string, unknown>> | undefined) || []).map((contract) => [
            String(contract.code || "-"),
            String(contract.customerName || "-"),
            String(contract.packageName || "-"),
            formatDate(String(contract.endDate || "")),
            <StatusBadge key={`${String(contract.id)}-trainer-contract-status`} value={String(contract.status || "")} />,
          ]),
          "Chua co hop dong",
          "PT nay chua duoc gan hop dong nao.",
        ),
      });

      nextSections.push({
        key: "sessions",
        label: "Buoi tap",
        count: Array.isArray(detailData.trainingSessions) ? detailData.trainingSessions.length : Number(detailData.trainingSessionCount || 0),
        content: renderMiniTable(
          ["Ma buoi", "Khach hang", "Lich tap", "Tru buoi", "Trang thai"],
          ((detailData.trainingSessions as Array<Record<string, unknown>> | undefined) || []).map((session) => [
            String(session.code || "-"),
            String(session.customerName || "-"),
            formatDateTime(String(session.scheduledDateTime || session.scheduledAt || "")),
            String(session.consumedSessions || 0),
            <StatusBadge key={`${String(session.id)}-trainer-session-status`} value={String(session.status || "")} />,
          ]),
          "Chua co buoi tap",
          "PT nay chua co lich tap nao.",
        ),
      });
    }

    if (normalizedDetailKey === "training-sessions" && !isClassScheduleTrainingClone) {
      nextSections.push({
        key: "participants",
        label: "Thong tin buoi tap",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Khach hang", String(detailData.customerName || "-"), String(detailData.customerPhone || "-"))}
            {renderInfoCard("PT", String(detailData.trainerName || "-"), String(detailData.trainerCode || "-"))}
            {renderInfoCard("Hop dong", String(detailData.contractCode || "-"), String(detailData.contractPackageName || translateText("Khong lien ket hop dong")))}
            {renderInfoCard("Dia diem", String(detailData.location || "-"), `${String(detailData.durationMinutes || 0)} ${translateText("phut")}`)}
            {renderInfoCard("Dinh kem", String(detailData.attachmentCount || 0), `${String(detailData.attendanceCount || 0)} ${translateText("ban ghi diem danh")}`)}
          </div>
        ),
      });

      nextSections.push({
        key: "attendance",
        label: "Diem danh",
        count: Array.isArray(detailData.attendance) ? detailData.attendance.length : Number(detailData.attendanceCount || 0),
        content: renderMiniTable(
          ["Khach hang", "Check-in", "Trang thai", "Tru buoi", "Ghi chu"],
          ((detailData.attendance as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.customerName || "-"),
            formatDateTime(String(item.checkInDateTime || item.checkInAt || "")),
            <StatusBadge key={`${String(item.id)}-attendance-status`} value={String(item.status || "")} />,
            String(item.consumedSessions || 0),
            String(item.note || "-"),
          ]),
          "Chua co diem danh",
          "Buoi tap nay chua co ban ghi diem danh nao.",
        ),
      });
    }

    if (normalizedDetailKey === "deposits") {
      nextSections.push({
        key: "deposit",
        label: "Thong tin coc",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Khach nop coc", String(detailData.customerName || "-"), String(detailData.customerCode || "-"))}
            {renderInfoCard("Loai coc", resolveTextDisplay(detailData.itemType, "itemType", detailData), String(detailData.status || "-"))}
            {renderInfoCard("Ma thue tu", String(detailData.lockerRentalCode || "-"), String(detailData.branchName || "-"))}
            {renderInfoCard("So tien", formatCurrency(Number(detailData.amount || 0)), String(detailData.note || "-"))}
            {renderInfoCard("Thoi gian nhan", detailData.receivedAt ? formatDateTime(String(detailData.receivedAt)) : "-", String(detailData.code || "-"))}
            {renderInfoCard("Thoi gian tra", detailData.returnedAt ? formatDateTime(String(detailData.returnedAt)) : "-", String(detailData.status || "-"))}
          </div>
        ),
      });
    }

    if (isStaffExerciseLibrary) {
      nextSections.push({
        key: "exercise-info",
        label: "Thong tin bai tap",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Danh muc", String(detailData.categoryName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Nhom bai tap", String(detailData.groupName || "-"), String(detailData.name || "-"))}
            {renderInfoCard("Don vi", String(detailData.unit || "-"), String(detailData.branchName || "-"))}
            {renderInfoCard("So luong san sang", String(detailData.stockQuantity || 0), `${translateText("Muc toi thieu")}: ${String(detailData.minStockQuantity || 0)}`)}
            {renderInfoCard("Canh bao dung cu", resolveTextDisplay(detailData.stockAlertLabel, "stockAlertLabel", detailData), resolveTextDisplay(detailData.status, "status", detailData))}
            {renderInfoCard("Gia tham chieu", formatCurrency(Number(detailData.salePrice || 0)), `${translateText("Gia nhap")} ${formatCurrency(Number(detailData.purchasePrice || 0))}`)}
          </div>
        ),
      });

      nextSections.push({
        key: "supply-history",
        label: "Cap phat / bo sung",
        count: Array.isArray(detailData.recentPurchaseItems) ? detailData.recentPurchaseItems.length : Number(detailData.purchaseItemCount || 0),
        content: renderMiniTable(
          ["Phieu", "NCC", "Ngay", "So luong", "Thanh tien", "Trang thai"],
          ((detailData.recentPurchaseItems as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.purchaseOrderCode || "-"),
            String(item.supplierName || "-"),
            formatDate(String(item.orderDate || "")),
            String(item.quantity || 0),
            formatCurrency(Number(item.totalPrice || 0)),
            <StatusBadge key={`${String(item.id)}-exercise-stock-status`} value={String(item.status || "")} />,
          ]),
          "Chua co lich su bo sung",
          "Bai tap / dung cu nay chua co lan bo sung nao.",
        ),
      });
    }

    if (normalizedDetailKey === "products" && !isStaffExerciseLibrary) {
      nextSections.push({
        key: "inventory",
        label: isOperationsTowels ? "Thong tin khan tap" : "Ton kho",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.categoryName || "-"))}
            {renderInfoCard(isOperationsTowels ? "So luong ton" : "Ton kho", String(detailData.stockQuantity || 0), `${String(detailData.minStockQuantity || 0)} ${translateText(isOperationsTowels ? "Nguong toi thieu" : "toi thieu")}`)}
            {renderInfoCard(isOperationsTowels ? "Muc canh bao" : "Canh bao", resolveTextDisplay(detailData.stockAlertLabel, "stockAlertLabel", detailData), String(detailData.groupName || "-"))}
            {renderInfoCard(isOperationsTowels ? "Gia nhap" : "Gia", formatCurrency(Number((isOperationsTowels ? detailData.purchasePrice : detailData.salePrice) || 0)), `${translateText("Gia nhap")} ${formatCurrency(Number(detailData.purchasePrice || 0))}`)}
          </div>
        ),
      });

      nextSections.push({
        key: "purchase-history",
        label: isOperationsTowels ? "Lich su bo sung" : "Lich su nhap",
        count: Array.isArray(detailData.recentPurchaseItems) ? detailData.recentPurchaseItems.length : Number(detailData.purchaseItemCount || 0),
        content: renderMiniTable(
          ["Phieu nhap", "NCC", "Ngay", "SL", "Thanh tien", "Trang thai"],
          ((detailData.recentPurchaseItems as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.purchaseOrderCode || "-"),
            String(item.supplierName || "-"),
            formatDate(String(item.orderDate || "")),
            String(item.quantity || 0),
            formatCurrency(Number(item.totalPrice || 0)),
            <StatusBadge key={`${String(item.id)}-product-po-status`} value={String(item.status || "")} />,
          ]),
          isOperationsTowels ? "Chua co lich su bo sung" : "Chua co lich su nhap",
          isOperationsTowels ? "Vat tu nay chua co lan bo sung nao." : "San pham nay chua co dong nhap hang nao.",
        ),
      });
    }

    if (normalizedDetailKey === "suppliers") {
      nextSections.push({
        key: "contact",
        label: "Thong tin doi tac",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Nguoi lien he", String(detailData.contactName || "-"), String(detailData.phone || "-"))}
            {renderInfoCard("Email", String(detailData.email || "-"), String(detailData.address || "-"))}
            {renderInfoCard("Gia tri nhap", formatCurrency(Number(detailData.totalPurchaseAmount || 0)), String(detailData.note || ""))}
          </div>
        ),
      });

      nextSections.push({
        key: "orders",
        label: "Phieu nhap",
        count: Array.isArray(detailData.purchaseOrders) ? detailData.purchaseOrders.length : Number(detailData.purchaseOrderCount || 0),
        content: renderMiniTable(
          ["Ma phieu", "Ngay nhap", "Trang thai", "So dong", "Tong tien"],
          ((detailData.purchaseOrders as Array<Record<string, unknown>> | undefined) || []).map((order) => [
            String(order.code || "-"),
            formatDate(String(order.orderDate || "")),
            <StatusBadge key={`${String(order.id)}-supplier-order-status`} value={String(order.status || "")} />,
            String(order.itemCount || 0),
            formatCurrency(Number(order.totalAmount || 0)),
          ]),
          "Chua co phieu nhap",
          "Nha cung cap nay chua co phieu nhap nao.",
        ),
      });
    }

    if (normalizedDetailKey === "purchase-orders") {
      nextSections.push({
        key: "supplier",
        label: "Thong tin nhap",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Nha cung cap", String(detailData.supplierName || "-"), String(detailData.supplierCode || "-"))}
            {renderInfoCard("Lien he", String(detailData.supplierContactName || "-"), String(detailData.supplierPhone || "-"))}
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.createdUserName || "-"))}
            {renderInfoCard("Thoi diem", formatDate(String(detailData.orderDate || "")), formatDate(String(detailData.expectedDate || "")))}
          </div>
        ),
      });

      nextSections.push({
        key: "items",
        label: "Dong hang",
        count: Array.isArray(detailData.items) ? detailData.items.length : Number(detailData.itemCount || 0),
        content: renderMiniTable(
          ["Ma SP", "Ten san pham", "Don vi", "SL", "Don gia", "Thanh tien"],
          ((detailData.items as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.productCode || "-"),
            String(item.productName || "-"),
            String(item.unit || "-"),
            String(item.quantity || 0),
            formatCurrency(Number(item.unitPrice || 0)),
            formatCurrency(Number(item.totalPrice || 0)),
          ]),
          "Chua co dong hang",
          "Phieu nhap nay chua co san pham nao.",
        ),
      });
    }

    if (normalizedDetailKey === "branches") {
      nextSections.push({
        key: "operations",
        label: "Van hanh",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Khung gio hoat dong", String(detailData.operatingHours || "-"), String(detailData.address || "-"))}
            {renderInfoCard("Dat lich / coc", `${String(detailData.maxBookingsPerDay || 0)} ${translateText("booking/ngay")}`, `${String(detailData.maxDepositHours || 0)} ${translateText("gio coc toi da")}`)}
            {renderInfoCard("Lien he", String(detailData.phone || "-"), String(detailData.email || "-"))}
            <PreviewAssetCard eyebrow="Logo" title={String(detailData.name || detailData.code || "-")} assetUrl={String(detailData.logoUrl || "")} description={String(detailData.note || "")} />
          </div>
        ),
      });

      nextSections.push({
        key: "users",
        label: "Nhan vien",
        count: Array.isArray(detailData.users) ? detailData.users.length : Number(detailData.userCount || 0),
        content: renderMiniTable(
          ["Ten dang nhap", "Ho ten", "Chuc danh", "Vai tro", "Trang thai"],
          ((detailData.users as Array<Record<string, unknown>> | undefined) || []).map((user) => [
            String(user.username || "-"),
            String(user.fullName || "-"),
            String(user.title || "-"),
            String(user.roleNames || "-"),
            <StatusBadge key={`${String(user.id)}-branch-user-status`} value={String(user.status || "")} />,
          ]),
          "Chua co nhan vien",
          "Chi nhanh nay chua co nhan vien nao duoc gan.",
        ),
      });

      nextSections.push({
        key: "machines",
        label: "May cham cong",
        count: Array.isArray(detailData.attendanceMachines) ? detailData.attendanceMachines.length : Number(detailData.attendanceMachineCount || 0),
        content: renderMiniTable(
          ["Ma may", "Ten may", "Host", "Dong bo", "Trang thai"],
          ((detailData.attendanceMachines as Array<Record<string, unknown>> | undefined) || []).map((machine) => [
            String(machine.code || "-"),
            String(machine.name || "-"),
            String(machine.host || "-"),
            String(machine.syncEnabled ? "Bat" : "Tat"),
            <StatusBadge key={`${String(machine.id)}-branch-machine-status`} value={String(machine.connectionStatus || "")} />,
          ]),
          "Chua co may cham cong",
          "Chi nhanh nay chua cau hinh may cham cong nao.",
        ),
      });
    }

    if (normalizedDetailKey === "lockers") {
      nextSections.push({
        key: "rental",
        label: "Thong tin thue",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Khach dang thue", String(detailData.currentCustomerName || "-"), String(detailData.currentRentalCode || "-"))}
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.label || "-"))}
            {renderInfoCard("Tong luot thue", String(detailData.rentalCount || 0), `${String(detailData.activeRentalCount || 0)} ${translateText("Luot thue mo")}`)}
            {renderInfoCard("Don gia", formatCurrency(Number(detailData.price || 0)), String(detailData.note || "-"))}
          </div>
        ),
      });
    }

    if (normalizedDetailKey === "users") {
      const userAvatarUrl = String(detailData.avatarUrl || detailData.photoUrl || detailData.imageUrl || "").trim();

      if (userAvatarUrl) {
        nextSections.push({
          key: "user-avatar",
          label: "Anh dai dien",
          content: (
            <div className="grid gap-3 md:grid-cols-2">
              <PreviewAssetCard
                altFallback="Anh dai dien nguoi dung"
                assetUrl={userAvatarUrl}
                description={String(detailData.email || detailData.phone || detailData.branchName || "")}
                emptyMessage="Chua cap nhat anh dai dien cho nguoi dung nay."
                eyebrow="Anh dai dien"
                openLabel="Mo anh"
                title={String(detailData.fullName || detailData.username || detailData.employeeCode || "-")}
              />
            </div>
          ),
        });
      }

      nextSections.push({
        key: "roles",
        label: "Vai tro",
        count: Array.isArray(detailData.roles) ? detailData.roles.length : Number(detailData.roleCount || 0),
        content: renderMiniTable(
          ["Ma", "Ten vai tro", "Mo ta"],
          ((detailData.roles as Array<Record<string, unknown>> | undefined) || []).map((role) => [
            String(role.code || "-"),
            String(role.name || "-"),
            String(role.description || "-"),
          ]),
          "Chua gan vai tro",
          "User nay chua duoc gan vai tro nao.",
        ),
      });

      nextSections.push({
        key: "permissions",
        label: "Quyen",
        count: Array.isArray(detailData.permissions) ? detailData.permissions.length : Number(detailData.permissionCount || 0),
        content: renderMiniTable(
          [translateText("Ma"), translateText("Module"), translateText("Action"), translateText("Mo ta")],
          ((detailData.permissions as Array<Record<string, unknown>> | undefined) || []).map((permission) => [
            resolveTextDisplay(permission.code || "-", "permissionCode", permission),
            resolveTextDisplay(permission.module || "-", "module", permission),
            resolveTextDisplay(permission.action || "-", "action", permission),
            translateText(String(permission.description || "-")),
          ]),
          "Chua co quyen",
          "User nay chua co quyen nao duoc tong hop tu vai tro.",
        ),
      });
    }

    if (isStaffStage) {
      nextSections.push({
        key: "stage-flow",
        label: "Quy trinh stage",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Loai stage", resolveTextDisplay(detailData.roleType, "roleType", detailData), String(detailData.code || "-"))}
            {renderInfoCard("Ten stage", String(detailData.name || "-"), String(detailData.description || "-"))}
            {renderInfoCard("So moc", String(detailData.permissionCount || 0), String(detailData.permissionNames || translateText("Chua cau hinh moc quy trinh")))}
            {renderInfoCard(
              "Nhan su dang gan",
              String(detailData.userCount || 0),
              detailData.updatedDateTime ? formatDateTime(String(detailData.updatedDateTime)) : "-",
            )}
          </div>
        ),
      });

      nextSections.push({
        key: "milestones",
        label: "Moc quy trinh",
        count: Array.isArray(detailData.permissions) ? detailData.permissions.length : Number(detailData.permissionCount || 0),
        content: renderMiniTable(
          [translateText("Ma"), translateText("Module"), translateText("Action"), translateText("Mo ta")],
          ((detailData.permissions as Array<Record<string, unknown>> | undefined) || []).map((permission) => [
            resolveTextDisplay(permission.code || "-", "permissionCode", permission),
            resolveTextDisplay(permission.module || "-", "module", permission),
            resolveTextDisplay(permission.action || "-", "action", permission),
            translateText(String(permission.description || "-")),
          ]),
          "Chua co moc quy trinh",
          "Stage nay chua duoc cau hinh moc / permission nao.",
        ),
      });

      nextSections.push({
        key: "owners",
        label: "Nhan su phu trach",
        count: Array.isArray(detailData.users) ? detailData.users.length : Number(detailData.userCount || 0),
        content: renderMiniTable(
          ["Ten dang nhap", "Ho ten", "Chi nhanh", "Trang thai"],
          ((detailData.users as Array<Record<string, unknown>> | undefined) || []).map((user) => [
            String(user.username || "-"),
            String(user.fullName || "-"),
            String(user.branchName || "-"),
            <StatusBadge key={`${String(user.id)}-stage-user-status`} value={String(user.status || "")} />,
          ]),
          "Chua co nhan su",
          "Stage nay chua duoc gan cho nhan su nao.",
        ),
      });
    }

    if (normalizedDetailKey === "roles" && !isStaffStage) {
      nextSections.push({
        key: "permissions",
        label: "Ma tran quyen",
        count: Array.isArray(detailData.permissions) ? detailData.permissions.length : Number(detailData.permissionCount || 0),
        content: renderMiniTable(
          [translateText("Ma"), translateText("Module"), translateText("Action"), translateText("Mo ta")],
          ((detailData.permissions as Array<Record<string, unknown>> | undefined) || []).map((permission) => [
            resolveTextDisplay(permission.code || "-", "permissionCode", permission),
            resolveTextDisplay(permission.module || "-", "module", permission),
            resolveTextDisplay(permission.action || "-", "action", permission),
            translateText(String(permission.description || "-")),
          ]),
          "Chua gan quyen",
          "Vai tro nay chua duoc gan quyen nao.",
        ),
      });

      nextSections.push({
        key: "users",
        label: "Nguoi dung",
        count: Array.isArray(detailData.users) ? detailData.users.length : Number(detailData.userCount || 0),
        content: renderMiniTable(
          ["Ten dang nhap", "Ho ten", "Chi nhanh", "Trang thai"],
          ((detailData.users as Array<Record<string, unknown>> | undefined) || []).map((user) => [
            String(user.username || "-"),
            String(user.fullName || "-"),
            String(user.branchName || "-"),
            <StatusBadge key={`${String(user.id)}-role-user-status`} value={String(user.status || "")} />,
          ]),
          "Chua co user",
          "Vai tro nay chua duoc gan cho user nao.",
        ),
      });
    }

    if (normalizedDetailKey === "attendance-machines") {
      nextSections.push({
        key: "config",
        label: "Cau hinh ket noi",
        content: (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.code || "-"))}
            {renderInfoCard(
              "Ket noi thiet bi",
              String(detailData.host || "-"),
              `${translateText("Cong")}: ${String(detailData.connectionPort || "-")} | ${translateText("Giao thuc")}: ${String(detailData.protocol || "-")}`,
            )}
            {renderInfoCard(
              "Dong bo du lieu",
              resolveTextDisplay(Boolean(detailData.syncEnabled).toString()),
              `${translateText("Trang thai")}: ${resolveTextDisplay(detailData.connectionStatus, "status")} | ${translateText("Mat khau thiet bi")}: ${resolveTextDisplay(Boolean(detailData.hasPassword).toString())}`,
            )}
            {renderInfoCard(
              "Comm key / poll",
              String(detailData.commKeyStatus || "-"),
              `${translateText("Chu ky poll")}: ${String(detailData.pollingIntervalSeconds || "-")}s | ${translateText("Ho tro the")}: ${resolveTextDisplay(Boolean(detailData.supportsCardEnrollment).toString())}`,
            )}
            {renderInfoCard(
              "Nhip ket noi gan nhat",
              formatDateTime(String(detailData.lastHeartbeatDateTime || detailData.lastSyncedDateTime || "")),
              String(detailData.lastErrorMessage || `${String(detailData.eventCount || 0)} ${translateText("su kien")}`),
            )}
          </div>
        ),
      });

      nextSections.push({
        key: "operations",
        label: "Dong bo & ket noi",
        content: canMaintainAttendanceMachine ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[
              {
                action: "PING_MACHINE",
                title: "Kiem tra ket noi may",
                description: "Doc nhanh thong tin may, firmware, serial, so user va log hien co.",
              },
              {
                action: "PULL_ATTENDANCE_EVENTS",
                title: "Tai du lieu cham cong ve he thong",
                description: "Lay log cham cong moi nhat tu may va lam moi danh sach su kien.",
              },
              {
                action: "PULL_MACHINE_CODES",
                title: "Tai ma cham cong ve may tinh",
                description: "Xuat danh sach ma cham cong cua nhan vien va hoi vien de doi soat hoac gan ma offline.",
              },
              {
                action: "PUSH_STAFF_CODES",
                title: "Tai nhan vien len may",
                description: "Day nhan vien co ma cham cong len may de su dung ngay tai chi nhanh.",
              },
              {
                action: "PUSH_CUSTOMER_CODES",
                title: "Tai hoi vien len may",
                description: "Day hoi vien co ma van tay hoac ma cham cong len may de check-in tai cong vao.",
              },
              {
                action: "SYNC_MACHINE_TIME",
                title: "Dong bo gio may cham cong",
                description: "Cap nhat thoi gian may theo mui gio he thong de tranh lech check-in.",
              },
            ].map((item) => (
              <button
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={attendanceMachineMaintenanceMutation.isPending}
                key={item.action}
                onClick={() => void attendanceMachineMaintenanceMutation.mutateAsync({ action: item.action })}
                type="button"
              >
                <div className="text-sm font-semibold text-slate-900">{translateText(item.title)}</div>
                <div className="mt-2 text-sm text-slate-500">{translateText(item.description)}</div>
              </button>
            ))}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">
                {translateText("Tai / xoa du lieu tren may theo moc thoi gian")}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {translateText(
                  "Khung nay chi lam viec voi log dang nam tren may cham cong. Khac voi nut 'Tai du lieu cham cong ve he thong', thao tac nay dung de tai file doi soat hoac giai phong bo nho tren may.",
                )}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <div className="text-xs font-medium text-slate-600">{translateText("Tu ngay")}</div>
                  <input
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    max={attendanceMachineLogRangeDraft.dateTo || undefined}
                    onChange={(event) =>
                      setAttendanceMachineLogRangeDraft((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                      }))
                    }
                    type="date"
                    value={attendanceMachineLogRangeDraft.dateFrom}
                  />
                </label>
                <label className="space-y-1.5">
                  <div className="text-xs font-medium text-slate-600">{translateText("Den ngay")}</div>
                  <input
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    min={attendanceMachineLogRangeDraft.dateFrom || undefined}
                    onChange={(event) =>
                      setAttendanceMachineLogRangeDraft((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                    type="date"
                    value={attendanceMachineLogRangeDraft.dateTo}
                  />
                </label>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                {translateText(
                  "He thong se gioi han theo ngay bat dau va ngay ket thuc ban chon. Xoa log chi duoc phep khi may ho tro xoa dung pham vi hoac khoang ngay da bao trum toan bo log hien co tren may.",
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    attendanceMachineMaintenanceMutation.isPending ||
                    !attendanceMachineLogRangeDraft.dateFrom ||
                    !attendanceMachineLogRangeDraft.dateTo
                  }
                  onClick={() => void submitAttendanceMachineLogRangeAction("EXPORT_MACHINE_LOG_RANGE")}
                  type="button"
                >
                  {activeAttendanceMachineMaintenanceAction === "EXPORT_MACHINE_LOG_RANGE"
                    ? translateText("Dang tai file...")
                    : translateText("Tai du lieu tu may ve may tinh")}
                </button>
                <button
                  className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    attendanceMachineMaintenanceMutation.isPending ||
                    !attendanceMachineLogRangeDraft.dateFrom ||
                    !attendanceMachineLogRangeDraft.dateTo
                  }
                  onClick={() => void submitAttendanceMachineLogRangeAction("DELETE_MACHINE_LOG_RANGE")}
                  type="button"
                >
                  {translateText("Xoa du lieu tren may")}
                </button>
              </div>
              <div className="mt-4 rounded-xl border border-amber-300/80 bg-white/80 p-3">
                <div className="text-xs font-semibold text-slate-800">{translateText("Tai / xoa toan bo log tren may")}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {translateText(
                    "Neu may khong ho tro xoa theo moc thoi gian, hay tai toan bo log ve may tinh truoc roi moi xoa toan bo log tren may de giai phong bo nho.",
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={attendanceMachineMaintenanceMutation.isPending}
                  onClick={() => void submitAttendanceMachineFullLogAction("EXPORT_ALL_MACHINE_LOGS")}
                  type="button"
                >
                    {activeAttendanceMachineMaintenanceAction === "EXPORT_ALL_MACHINE_LOGS"
                      ? translateText("Dang tai file...")
                      : translateText("Tai toan bo log tren may")}
                  </button>
                  <button
                    className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={attendanceMachineMaintenanceMutation.isPending}
                    onClick={() => void submitAttendanceMachineFullLogAction("DELETE_ALL_MACHINE_LOGS")}
                    type="button"
                  >
                    {translateText("Xoa toan bo log tren may")}
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">{translateText("Lien ket ma may va enroll khuon mat / the")}</div>
              <div className="mt-1 text-sm text-slate-500">
                {translateText("Chon doi tuong trong chi nhanh, luu lien ket ma may de pull log doi khop dung nguoi, sau do co the day the hoac khuon mat len may dang chon.")}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-1.5">
                  <div className="text-xs font-medium text-slate-600">{translateText("Loai doi tuong")}</div>
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    onChange={(event) =>
                      setAttendanceEnrollmentDraft({
                        personType: event.target.value as "STAFF" | "CUSTOMER",
                        personId: "",
                        machineUserId: "",
                        cardCode: "",
                        faceImageUrl: "",
                      })
                    }
                    value={attendanceEnrollmentDraft.personType}
                  >
                    <option value="STAFF">{translateText("Nhan vien")}</option>
                    <option value="CUSTOMER">{translateText("Hoi vien")}</option>
                  </select>
                </label>
                <label className="space-y-1.5">
                  <div className="text-xs font-medium text-slate-600">{translateText("Chon doi tuong")}</div>
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    onChange={(event) => {
                      const nextOption =
                        attendanceEnrollmentOptions.find((item) => item.id === event.target.value) || null;
                      setAttendanceEnrollmentDraft((current) => ({
                        ...current,
                        personId: event.target.value,
                        machineUserId: nextOption?.attendanceCode || current.machineUserId,
                        cardCode:
                          current.personType === "CUSTOMER"
                            ? nextOption?.cardCode || current.cardCode
                            : current.cardCode,
                      }));
                    }}
                    value={attendanceEnrollmentDraft.personId}
                  >
                    <option value="">{translateText("Chon nhan vien / hoi vien")}</option>
                    {attendanceEnrollmentOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <div className="text-xs font-medium text-slate-600">{translateText("Machine user ID / attendance code")}</div>
                  <input
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    onChange={(event) =>
                      setAttendanceEnrollmentDraft((current) => ({
                        ...current,
                        machineUserId: event.target.value,
                      }))
                    }
                    value={attendanceEnrollmentDraft.machineUserId}
                  />
                </label>
                <label className="space-y-1.5">
                  <div className="text-xs font-medium text-slate-600">{translateText("Ma the")}</div>
                  <input
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    onChange={(event) =>
                      setAttendanceEnrollmentDraft((current) => ({
                        ...current,
                        cardCode: event.target.value,
                      }))
                    }
                    placeholder={translateText("Nhap ma the neu may dung the")}
                    value={attendanceEnrollmentDraft.cardCode}
                  />
                </label>
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-medium text-slate-600">{translateText("URL anh khuon mat")}</div>
                    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingAttendanceFaceImage ? translateText("Dang tai anh...") : translateText("Tai anh len")}</span>
                      <input
                        accept="image/*"
                        className="hidden"
                        disabled={!canUploadAttachments || uploadingAttendanceFaceImage || attendanceMachineMaintenanceMutation.isPending}
                        onChange={handleAttendanceFaceUpload}
                        type="file"
                      />
                    </label>
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <input
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      onChange={(event) =>
                        setAttendanceEnrollmentDraft((current) => ({
                          ...current,
                          faceImageUrl: event.target.value,
                        }))
                      }
                      placeholder={translateText("Dan URL anh khuon mat de day len may Hikvision")}
                      value={attendanceEnrollmentDraft.faceImageUrl}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {translateText("Ban co the paste URL anh khuon mat hoac bam 'Tai anh len'. Sau khi upload xong, he thong se tu dien URL vao o nay.")}
                  </div>
                  {!canUploadAttachments ? (
                    <div className="text-[11px] text-amber-700">{translateText("Tai khoan hien tai khong co quyen tai tep dinh kem.")}</div>
                  ) : null}
                  {attendanceFaceUploadError ? <div className="text-[11px] text-rose-600">{attendanceFaceUploadError}</div> : null}
                </div>
                <PreviewAssetCard
                  altFallback="Anh khuon mat"
                  assetUrl={attendanceEnrollmentDraft.faceImageUrl}
                  description={translateText("Anh preview nay se duoc dung cho lenh day khuon mat len may dang chon.")}
                  emptyMessage="Chon hoac tai anh khuon mat de preview truoc khi day len may."
                  eyebrow="Anh khuon mat"
                  key={`attendance-face-${attendanceEnrollmentDraft.personId}-${attendanceEnrollmentDraft.faceImageUrl || "empty"}`}
                  openLabel="Mo anh khuon mat"
                  title={selectedAttendanceEnrollmentOption?.displayName || translateText("Anh khuon mat se day len may")}
                />
              </div>
              {selectedAttendanceEnrollmentOption ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-600">
                  <div className="font-medium text-slate-800">{translateText("Doi tuong dang chon")}</div>
                  <div className="mt-1">
                    {selectedAttendanceEnrollmentOption.displayName || "-"}
                    {" | "}
                    {translateText("Ma app")}: {selectedAttendanceEnrollmentOption.attendanceCode || "-"}
                    {" | "}
                    {translateText("Ma tren may")}: {attendanceEnrollmentDraft.machineUserId || "-"}
                  </div>
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    attendanceMachineMaintenanceMutation.isPending ||
                    !attendanceEnrollmentDraft.personId ||
                    !attendanceEnrollmentDraft.machineUserId
                  }
                  onClick={() =>
                    void attendanceMachineMaintenanceMutation.mutateAsync({
                      action: "LINK_MACHINE_PERSON",
                      personType: attendanceEnrollmentDraft.personType,
                      personId: attendanceEnrollmentDraft.personId,
                      displayName: selectedAttendanceEnrollmentOption?.displayName,
                      appAttendanceCode: selectedAttendanceEnrollmentOption?.attendanceCode,
                      machineCode: attendanceEnrollmentDraft.machineUserId,
                      machineUserId: attendanceEnrollmentDraft.machineUserId,
                      cardCode:
                        attendanceEnrollmentDraft.personType === "CUSTOMER"
                          ? attendanceEnrollmentDraft.cardCode || selectedAttendanceEnrollmentOption?.cardCode
                          : undefined,
                    })
                  }
                  type="button"
                >
                  {translateText("Luu lien ket ma may")}
                </button>
                <button
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    attendanceMachineMaintenanceMutation.isPending ||
                    !attendanceEnrollmentDraft.personId ||
                    !attendanceEnrollmentDraft.machineUserId ||
                    !attendanceEnrollmentDraft.cardCode
                  }
                  onClick={() =>
                    void attendanceMachineMaintenanceMutation.mutateAsync({
                      action: "ENROLL_CARD",
                      personType: attendanceEnrollmentDraft.personType,
                      personId: attendanceEnrollmentDraft.personId,
                      displayName: selectedAttendanceEnrollmentOption?.displayName,
                      appAttendanceCode: selectedAttendanceEnrollmentOption?.attendanceCode,
                      machineCode: attendanceEnrollmentDraft.machineUserId,
                      machineUserId: attendanceEnrollmentDraft.machineUserId,
                      cardCode: attendanceEnrollmentDraft.cardCode,
                    })
                  }
                  type="button"
                >
                  {translateText("Day the len may")}
                </button>
                <button
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    attendanceMachineMaintenanceMutation.isPending ||
                    !attendanceEnrollmentDraft.personId ||
                    !attendanceEnrollmentDraft.machineUserId ||
                    !attendanceEnrollmentDraft.faceImageUrl
                  }
                  onClick={() =>
                    void attendanceMachineMaintenanceMutation.mutateAsync({
                      action: "ENROLL_FACE",
                      personType: attendanceEnrollmentDraft.personType,
                      personId: attendanceEnrollmentDraft.personId,
                      displayName: selectedAttendanceEnrollmentOption?.displayName,
                      appAttendanceCode: selectedAttendanceEnrollmentOption?.attendanceCode,
                      machineCode: attendanceEnrollmentDraft.machineUserId,
                      machineUserId: attendanceEnrollmentDraft.machineUserId,
                      faceImageUrl: attendanceEnrollmentDraft.faceImageUrl,
                    })
                  }
                  type="button"
                >
                  {translateText("Day khuon mat len may")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {translateText("Tai khoan hien tai khong co quyen cap nhat trang thai may cham cong.")}
          </div>
        ),
      });

      nextSections.push({
        key: "maintenance",
        label: "Bao tri",
        content: canMaintainAttendanceMachine ? (
          <div className="grid gap-3 md:grid-cols-2">
            {[
              {
                action: "TOGGLE_SYNC",
                title: detailData.syncEnabled ? "Tat dong bo" : "Bat dong bo",
                description: detailData.syncEnabled
                  ? "Tam dung dong bo de bao tri hoac xu ly ket noi."
                  : "Kich hoat dong bo de may tiep tuc day du lieu cham cong.",
              },
              {
                action: "START_SYNC",
                title: "Danh dau dang sync",
                description: "Cap nhat trang thai de van hanh biet may dang dong bo du lieu.",
              },
              {
                action: "FINISH_SYNC",
                title: "Danh dau sync xong",
                description: "Chuyen may ve CONNECTED va cap nhat lan sync cuoi.",
              },
              {
                action: "MARK_CONNECTED",
                title: "Danh dau ket noi",
                description: "Dung khi may da online tro lai va can cap nhat nhanh tinh trang.",
              },
              {
                action: "MARK_DISCONNECTED",
                title: "Danh dau mat ket noi",
                description: "Dung khi may tam mat mang hoac ngung giao tiep.",
              },
              {
                action: "MARK_ERROR",
                title: "Danh dau loi",
                description: "Gan co trang thai ERROR de HR/IT theo doi va xu ly.",
              },
            ].map((item) => (
              <button
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={attendanceMachineMaintenanceMutation.isPending}
                key={item.action}
                onClick={() => void attendanceMachineMaintenanceMutation.mutateAsync({ action: item.action })}
                type="button"
              >
                <div className="text-sm font-semibold text-slate-900">{translateText(item.title)}</div>
                <div className="mt-2 text-sm text-slate-500">{translateText(item.description)}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {translateText("Tai khoan hien tai khong co quyen cap nhat trang thai may cham cong.")}
          </div>
        ),
      });

      nextSections.push({
        key: "operation-result",
        label: "Ket qua dong bo",
        count: Number(activeAttendanceMachineOperationResult?.totalRecords || 0),
        content: activeAttendanceMachineOperationResult ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {renderInfoCard(
                "Lan thao tac cuoi",
                formatDateTime(
                  String(
                    activeAttendanceMachineOperationResult.syncedAt ||
                      activeAttendanceMachineOperationResult.exportedAt ||
                      activeAttendanceMachineOperationResult.machineTime ||
                      "",
                  ),
                ),
                activeAttendanceMachineOperationResult.timeZone ? `${translateText("Mui gio")}: ${activeAttendanceMachineOperationResult.timeZone}` : undefined,
              )}
              {renderInfoCard(
                "Ban ghi san sang",
                String(activeAttendanceMachineOperationResult.totalRecords || 0),
                activeAttendanceMachineOperationResult.totalBranchRecords
                  ? `${translateText("Tong du lieu chi nhanh")}: ${activeAttendanceMachineOperationResult.totalBranchRecords}`
                  : undefined,
              )}
              {renderInfoCard(
                "Du lieu tu thiet bi",
                String(
                  activeAttendanceMachineOperationResult.pulledFromDeviceCount ||
                    activeAttendanceMachineOperationResult.deviceUserCount ||
                    0,
                ),
                activeAttendanceMachineOperationResult.pulledFromDeviceCount
                  ? `${translateText("Da pull log tu may")}: ${activeAttendanceMachineOperationResult.pulledFromDeviceCount}`
                  : activeAttendanceMachineOperationResult.deviceUserCount
                    ? `${translateText("User tren may")}: ${activeAttendanceMachineOperationResult.deviceUserCount}`
                    : undefined,
              )}
              {renderInfoCard(
                "Ket qua import / doi soat",
                String(
                  activeAttendanceMachineOperationResult.deletedCount ||
                    activeAttendanceMachineOperationResult.importedCount ||
                    activeAttendanceMachineOperationResult.staffCount ||
                    0,
                ),
                [
                  activeAttendanceMachineOperationResult.deletedCount !== undefined
                    ? `${translateText("Da xoa")}: ${activeAttendanceMachineOperationResult.deletedCount}`
                    : "",
                  activeAttendanceMachineOperationResult.customerCount
                    ? `${translateText("Hoi vien san sang")}: ${activeAttendanceMachineOperationResult.customerCount}`
                    : "",
                  activeAttendanceMachineOperationResult.duplicateCount
                    ? `${translateText("Trung")}: ${activeAttendanceMachineOperationResult.duplicateCount}`
                    : "",
                  activeAttendanceMachineOperationResult.unmatchedCount
                    ? `${translateText("Chua map")}: ${activeAttendanceMachineOperationResult.unmatchedCount}`
                    : "",
                  activeAttendanceMachineOperationResult.missingCodeCount
                    ? `${translateText("Thieu ma")}: ${activeAttendanceMachineOperationResult.missingCodeCount}`
                    : "",
                  activeAttendanceMachineOperationResult.fileName
                    ? `${translateText("Tep xuat")}: ${activeAttendanceMachineOperationResult.fileName}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" | ") || undefined,
              )}
              {activeAttendanceMachineOperationResult.rangeFrom ||
              activeAttendanceMachineOperationResult.rangeTo ||
              activeAttendanceMachineOperationResult.totalMachineLogCount !== undefined ||
              activeAttendanceMachineOperationResult.remainingLogCount !== undefined ||
              activeAttendanceMachineOperationResult.deleteStrategy
                ? renderInfoCard(
                    activeAttendanceMachineOperationResult.rangeFrom ||
                      activeAttendanceMachineOperationResult.rangeTo
                      ? "Khoang du lieu"
                      : "Pham vi thao tac",
                    activeAttendanceMachineOperationResult.rangeFrom ||
                      activeAttendanceMachineOperationResult.rangeTo
                      ? [
                          activeAttendanceMachineOperationResult.rangeFrom
                            ? formatDate(String(activeAttendanceMachineOperationResult.rangeFrom))
                            : translateText("Chua co"),
                          activeAttendanceMachineOperationResult.rangeTo
                            ? formatDate(String(activeAttendanceMachineOperationResult.rangeTo))
                            : translateText("Chua co"),
                        ].join(" - ")
                      : translateText("Toan bo log tren may"),
                    [
                      activeAttendanceMachineOperationResult.totalMachineLogCount !== undefined
                        ? `${translateText("Tong log tren may")}: ${activeAttendanceMachineOperationResult.totalMachineLogCount}`
                        : "",
                      activeAttendanceMachineOperationResult.remainingLogCount !== undefined
                        ? `${translateText("Con lai sau khi xoa")}: ${activeAttendanceMachineOperationResult.remainingLogCount}`
                        : "",
                      activeAttendanceMachineOperationResult.deleteStrategy
                        ? `${translateText("Cach xoa")}: ${activeAttendanceMachineOperationResult.deleteStrategy}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" | ") || undefined,
                  )
                : null}
            </div>
            {activeAttendanceMachineOperationResult.description ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <div className="font-semibold">{translateText(String(activeAttendanceMachineOperationResult.title || "Ket qua dong bo"))}</div>
                <div className="mt-1">{translateText(String(activeAttendanceMachineOperationResult.description || ""))}</div>
              </div>
            ) : null}
            {activeAttendanceMachineOperationResult.connector || activeAttendanceMachineOperationResult.connectorResult ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {renderInfoCard(
                    "Connector",
                    String(
                      activeAttendanceMachineOperationResult.connector?.displayName ||
                        activeAttendanceMachineOperationResult.connector?.key ||
                        "-",
                    ),
                    String(activeAttendanceMachineOperationResult.connector?.vendor || "-"),
                  )}
                  {renderInfoCard(
                    "Ho tro thao tac",
                    resolveTextDisplay(
                      Boolean(activeAttendanceMachineOperationResult.connectorResult?.supported).toString(),
                    ),
                    String(activeAttendanceMachineOperationResult.connectorResult?.message || "-"),
                  )}
                  {renderInfoCard(
                    "May / chi nhanh",
                    String(activeAttendanceMachineOperationResult.machineName || activeAttendanceMachineOperationResult.machineCode || "-"),
                    String(activeAttendanceMachineOperationResult.branchName || "-"),
                  )}
                  {renderInfoCard(
                    "Cursor dong bo",
                    String(detailData.lastLogCursor || detailData.lastUserSyncCursor || "-"),
                    `${translateText("Heartbeat")}: ${formatDateTime(String(detailData.lastHeartbeatDateTime || ""))}`,
                  )}
                </div>
                {activeAttendanceMachineOperationResult.connectorResult?.metadata &&
                Object.keys(activeAttendanceMachineOperationResult.connectorResult.metadata).length ? (
                  <div className="mt-4">
                    {renderMiniTable(
                      ["Thuoc tinh", "Gia tri"],
                      Object.entries(activeAttendanceMachineOperationResult.connectorResult.metadata).map(([key, value]) => [
                        translateText(key),
                        <div className="max-w-[420px] whitespace-pre-wrap break-all" key={key}>
                          {formatSnapshotValue(value)}
                        </div>,
                      ]),
                      "Khong co metadata",
                      "Connector khong tra ve metadata bo sung.",
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
            {Array.isArray(activeAttendanceMachineOperationResult.machineUsersPreview) &&
            activeAttendanceMachineOperationResult.machineUsersPreview.length ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-900">{translateText("Preview user dang co tren may")}</div>
                {renderMiniTable(
                  ["Ma tren may", "Ten", "Ma app", "Chi tiet"],
                  activeAttendanceMachineOperationResult.machineUsersPreview.map((record, index) => [
                    String(record.machineUserId || record.machineCode || record.entityCode || "-"),
                    String(record.displayName || "-"),
                    String(record.appAttendanceCode || record.attendanceCode || "-"),
                    [
                      record.metadata && typeof record.metadata === "object"
                        ? `uid: ${String((record.metadata as Record<string, unknown>).uid || "-")}`
                        : "",
                      record.metadata && typeof record.metadata === "object"
                        ? `card: ${String((record.metadata as Record<string, unknown>).cardNo || "-")}`
                        : "",
                      record.metadata && typeof record.metadata === "object"
                        ? `role: ${String((record.metadata as Record<string, unknown>).role || "-")}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" | ") || String(record.note || index + 1),
                  ]),
                  "Chua co user tren may",
                  "Hay chay thao tac tai ma cham cong ve may tinh de xem preview user tren may.",
                )}
              </div>
            ) : null}
            {Array.isArray(activeAttendanceMachineOperationResult.devicePreview) &&
            activeAttendanceMachineOperationResult.devicePreview.length ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-900">{translateText("Preview log vua pull tu may")}</div>
                {renderMiniTable(
                  ["Ma tren may", "Thoi diem", "Loai", "Xac thuc", "Chi tiet"],
                  activeAttendanceMachineOperationResult.devicePreview.map((record, index) => [
                    String(record.machineUserId || record.rawCode || "-"),
                    formatDateTime(String(record.eventAt || "")),
                    <StatusBadge
                      key={`${String(record.externalEventId || index)}-machine-device-event-type`}
                      value={String(record.eventType || "CHECK_IN")}
                    />,
                    <StatusBadge
                      key={`${String(record.externalEventId || index)}-machine-device-verify`}
                      value={String(record.verificationMethod || "MANUAL")}
                    />,
                    String(record.rawCode || "-"),
                  ]),
                  "Chua co log tu may",
                  "Hay chay thao tac tai du lieu cham cong de xem preview log tu may.",
                )}
              </div>
            ) : null}
            {Array.isArray(activeAttendanceMachineOperationResult.preview) && activeAttendanceMachineOperationResult.preview.length
              ? renderMiniTable(
                  ["Loai", "Ma", "Ten", "Ma cham cong", "Trang thai", "Ghi chu"],
                  activeAttendanceMachineOperationResult.preview.map((record, index) => [
                    attendanceMachineRecordTypeLabel(record.recordType),
                    String(record.entityCode || "-"),
                    String(record.displayName || "-"),
                    String(record.attendanceCode || record.identifier || "-"),
                    <StatusBadge
                      key={`${String(record.entityId || index)}-machine-operation-status`}
                      value={String(record.status || record.eventType || "ACTIVE")}
                    />,
                    [record.note, record.eventAt ? formatDateTime(String(record.eventAt)) : "", record.source ? resolveTextDisplay(record.source, "source") : ""]
                      .filter(Boolean)
                      .join(" | ") || "-",
                  ]),
                  "Chua co du lieu preview",
                  "Hay thuc hien mot thao tac dong bo de xem ket qua chi tiet.",
                )
              : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  {translateText("Khong co du lieu dong bo gan day cho may nay.")}
                </div>
              )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {translateText("Khong co du lieu dong bo gan day cho may nay.")}
          </div>
        ),
      });

      nextSections.push({
        key: "events",
        label: "Su kien gan day",
        count: Array.isArray(detailData.recentEvents) ? detailData.recentEvents.length : Number(detailData.eventCount || 0),
        content: renderMiniTable(
          ["Thoi diem", "Nhan vien", "Loai", "Nguon", "Ghi chu"],
          ((detailData.recentEvents as Array<Record<string, unknown>> | undefined) || []).map((event) => [
            formatDateTime(String(event.eventDateTime || event.eventAt || "")),
            String(event.staffName || event.staffCode || "-"),
            <StatusBadge key={`${String(event.id)}-machine-event-type`} value={String(event.eventType || "")} />,
            <StatusBadge key={`${String(event.id)}-machine-event-source`} value={String(event.source || "")} />,
            String(event.note || "-"),
          ]),
          "Chua co su kien",
          "May cham cong nay chua ghi nhan su kien nao.",
        ),
      });
    }

    if (normalizedDetailKey === "staff-shifts") {
      nextSections.push({
        key: "shift-overview",
        label: "Thong tin ca lam",
        content: (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.code || "-"))}
            {renderInfoCard("Khung gio", String(detailData.shiftWindow || "-"), `${translateText("Nghi giua ca")}: ${String(detailData.breakMinutes || 0)} ${translateText("phut")}`)}
            {renderInfoCard("Tre / ve som", `${String(detailData.lateToleranceMinutes || 0)} / ${String(detailData.earlyLeaveToleranceMinutes || 0)} ${translateText("phut")}`, `${translateText("OT sau")}: ${String(detailData.overtimeAfterMinutes || 0)} ${translateText("phut")}`)}
            {renderInfoCard("Phu cap", `${translateText("Com")}: ${String(detailData.mealAllowance || 0)} | ${translateText("Dem")}: ${String(detailData.nightAllowance || 0)}`, String(detailData.overnightLabel || "-"))}
          </div>
        ),
      });

      nextSections.push({
        key: "shift-assignments",
        label: "Nhan vien dang duoc gan",
        count: Array.isArray(detailData.assignments) ? detailData.assignments.length : Number(detailData.assignmentCount || 0),
        content: renderMiniTable(
          ["Ma phan ca", "Nhan vien", "Bat dau", "Ket thuc"],
          ((detailData.assignments as Array<Record<string, unknown>> | undefined) || []).map((item) => [
            String(item.code || "-"),
            String(item.staffName || item.username || "-"),
            formatDate(String(item.startDate || "")),
            item.endDate ? formatDate(String(item.endDate || "")) : translateText("Khong gioi han"),
          ]),
          "Chua co phan ca",
          "Ca lam nay chua duoc gan cho nhan vien nao.",
        ),
      });
    }

    if (normalizedDetailKey === "staff-shift-assignments") {
      nextSections.push({
        key: "shift-assignment-overview",
        label: "Trang thai hien tai",
        content: (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {renderInfoCard("Nhan vien", String(detailData.staffName || "-"), String(detailData.staffCode || detailData.attendanceCode || "-"))}
            {renderInfoCard("Kieu phan ca", String(detailData.rotationLabel || "-"), String(detailData.effectiveRange || "-"))}
            {renderInfoCard("Chu ky xoay", String(detailData.rotationCycleLabel || detailData.rotationCycleDays || "-"), String(detailData.includeAllShiftsLabel || "-"))}
            {renderInfoCard("Ca hien tai", String(detailData.currentShiftName || detailData.currentShiftCode || "-"), String(detailData.currentShiftWindow || "-"))}
            {renderInfoCard("Cong hom nay", `${String(detailData.workedHours || 0)} ${translateText("gio")}`, `${translateText("Trang thai")}: ${resolveTextDisplay(detailData.currentShiftStatus, "currentShiftStatus", detailData)}`)}
          </div>
        ),
      });

      nextSections.push({
        key: "shift-pattern",
        label: "Chu ky ca",
        count: Array.isArray(detailData.shifts) ? detailData.shifts.length : Number(detailData.shiftCount || 0),
        content: renderMiniTable(
          ["Thu tu", "Ma ca", "Ten ca", "Khung gio"],
          ((detailData.shifts as Array<Record<string, unknown>> | undefined) || []).map((item, index) => {
            const shift = (item.shift as Record<string, unknown> | undefined) || {};
            return [
              String(item.sequence ?? index + 1),
              String(shift.code || "-"),
              String(shift.name || "-"),
              String(shift.shiftWindow || "-"),
            ];
          }),
          "Chua co chu ky",
          "Phan ca nay chua co ca nao duoc gan.",
        ),
      });
    }

    if (normalizedDetailKey === "member-presence") {
      nextSections.push({
        key: "presence-status",
        label: "Trang thai hien dien",
        content: (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {renderInfoCard("Hoi vien", String(detailData.fullName || detailData.customerInfo || "-"), String(detailData.code || detailData.attendanceCode || "-"))}
            {renderInfoCard("Trang thai", resolveTextDisplay(detailData.presenceStatus, "presenceStatus", detailData), String(detailData.presenceStatusNote || "-"))}
            {renderInfoCard("Dang tap tu", formatDateTime(String(detailData.currentSessionStartedAt || "")), String(detailData.currentSessionDurationLabel || translateText("Khong co phien dang mo")))}
            {renderInfoCard("Moc qua ngay", formatDateTime(String(detailData.nextAutoCloseAt || "")), formatDateTime(String(detailData.lastCheckOutAt || detailData.lastPresenceAt || "")))}
          </div>
        ),
      });

      nextSections.push({
        key: "presence-toggle",
        label: "Xac nhan dang tap / off",
        content: canToggleMemberPresence ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="text-sm font-semibold text-slate-900">{translateText("Thao tac nhanh tai quay")}</div>
            <div className="mt-1 text-sm text-slate-600">{translateText("Bam mot lan de doi trang thai hoi vien dang tap / off. Neu phien mo qua moc sang ngay moi, he thong se tu dong dong phien cu va lan bam moi se mo phien moi.")}</div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                  String(detailData.presenceStatus || "") === "ACTIVE" ? "bg-slate-900" : "bg-emerald-600"
                }`}
                disabled={memberPresenceToggleMutation.isPending}
                onClick={() => void memberPresenceToggleMutation.mutateAsync()}
                type="button"
              >
                {translateText(String(detailData.toggleActionLabel || "Xac nhan dang tap"))}
              </button>
              <StatusBadge value={String(detailData.presenceStatus || "")} />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {translateText("Tai khoan hien tai khong co quyen cap nhat trang thai hien dien hoi vien.")}
          </div>
        ),
      });

      nextSections.push({
        key: "presence-sessions",
        label: "Lich su hien dien",
        count: Array.isArray(detailData.sessions) ? detailData.sessions.length : Number(detailData.sessionCount || 0),
        content: renderMiniTable(
          ["Check-in", "Check-out", "Trang thai", "Nguon", "Thoi luong", "May / ghi chu"],
          ((detailData.sessions as Array<Record<string, unknown>> | undefined) || []).map((session) => [
            formatDateTime(String(session.checkInAt || "")),
            session.checkOutAt ? formatDateTime(String(session.checkOutAt || "")) : "-",
            <StatusBadge key={`${String(session.id)}-presence-status`} value={String(session.status || "")} />,
            <StatusBadge key={`${String(session.id)}-presence-source`} value={String(session.source || "")} />,
            `${String(session.durationMinutes || 0)} ${translateText("phut")}`,
            [String(session.machineName || ""), String(session.note || "")]
              .filter(Boolean)
              .join(" | ") || "-",
          ]),
          "Chua co phien hien dien",
          "Hoi vien nay chua co lan xac nhan dang tap / off nao.",
        ),
      });
    }

    if (normalizedDetailKey === "receipts") {
      nextSections.push({
        key: "links",
        label: detailKey === "shop-sales" ? "Thong tin ban hang" : "Thong tin thu",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard(detailKey === "shop-sales" ? "Khach mua" : "Khach hang", String(detailData.customerName || "-"), String(detailData.customerPhone || "-"))}
            {renderInfoCard(
              "Hop dong",
              String(detailData.contractCode || "-"),
              String(detailData.contractPackageName || translateText("Khong lien ket hop dong")),
            )}
            {renderInfoCard("Phuong thuc", resolveTextDisplay(detailData.paymentMethodName, "paymentMethodName", detailData), String(detailData.collectorName || "-"))}
            {renderInfoCard(detailKey === "shop-sales" ? "Noi dung ban" : "Noi dung", String(detailData.content || "-"), String(detailData.note || ""))}
          </div>
        ),
      });
    }

    if (normalizedDetailKey === "expenses") {
      nextSections.push({
        key: "approval",
        label: detailKey === "shop-returns" ? "Thong tin tra hang" : "Thong tin chi",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard(
              detailKey === "shop-returns" ? "Khach nhan hoan" : "Doi tuong nhan",
              String(detailData.payeeName || "-"),
              resolveTextDisplay(detailData.expenseLabel || detailData.expenseType || "-", detailKey === "shop-returns" ? "expenseLabel" : "expenseType", detailData),
            )}
            {renderInfoCard("Nguoi phe duyet", String(detailData.approverName || "-"), String(detailData.createdUserName || "-"))}
            {renderInfoCard("Phuong thuc", resolveTextDisplay(detailData.paymentMethodName, "paymentMethodName", detailData), formatCurrency(Number(detailData.amount || 0)))}
            {renderInfoCard("Ghi chu", String(detailData.note || "-"), String(detailData.branchName || "-"))}
          </div>
        ),
      });
    }

    if (Array.isArray(detailData.lineItems) && detailData.lineItems.length) {
      nextSections.push({
        key: "line-items",
        label: detailKey === "shop-sales" ? "San pham ban" : detailKey === "shop-returns" ? "San pham tra" : "San pham",
        count: detailData.lineItems.length,
        content: renderMiniTable(
          ["Ma SP", "Ten san pham", "SL", "Don gia", "Thanh tien", "Ghi chu"],
          ((detailData.lineItems as Array<Record<string, unknown>>) || []).map((item) => [
            String(item.productCode || "-"),
            String(item.productName || "-"),
            String(item.quantity || 0),
            formatCurrency(Number(item.unitPrice || 0)),
            formatCurrency(Number(item.totalPrice || 0)),
            String(item.note || "-"),
          ]),
          "Chua co dong hang",
          "Chung tu nay chua co dong san pham nao.",
        ),
      });
    }

    if (normalizedDetailKey === "staff-attendance-events") {
      nextSections.push({
        key: "attendance",
        label: "Thong tin cham cong",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Nhan vien", String(detailData.staffName || "-"), String(detailData.roleNames || detailData.staffCode || "-"))}
            {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.machineName || translateText("Khong gan may cham cong")))}
            {renderInfoCard("Thoi diem", formatDateTime(String(detailData.eventAt || "")), String(detailData.eventDate || "-"))}
            {renderInfoCard("Nguon / xac thuc", String(detailData.source || "-"), String(detailData.verificationMethod || "-"))}
            {renderInfoCard("Ma cham cong", String(detailData.rawCode || "-"), String(detailData.eventType || "-"))}
            {renderInfoCard("Ghi chu", String(detailData.note || "-"), translateText("Nen ghi ro ly do dieu chinh de audit sau nay."))}
          </div>
        ),
      });
    }

    if (normalizedDetailKey === "audit-logs") {
      nextSections.push({
        key: "audit-info",
        label: isPtSchedulePenaltyHistory ? "Ho so penalty" : "Thong tin audit",
        content: (
          <div className="grid gap-3 md:grid-cols-2">
            {renderInfoCard("Mo-dun", resolveTextDisplay(detailData.module, "module", detailData), resolveTextDisplay(detailData.action, "action", detailData))}
            {renderInfoCard(isPtSchedulePenaltyHistory ? "Doi tuong lien quan" : "Doi tuong", resolveTextDisplay(detailData.entityType, "entityType", detailData), String(detailData.entityId || "-"))}
            {renderInfoCard(isPtSchedulePenaltyHistory ? "Nguon truy cap" : "IP", String(detailData.ipAddress || "-"), String(detailData.userAgent || "-"))}
            {renderInfoCard(isPtSchedulePenaltyHistory ? "Thoi gian ghi nhan" : "Thoi gian", formatDateTime(String(detailData.createdAt || detailData.createdDateTime || "")), String(detailData.branchName || "-"))}
          </div>
        ),
      });

      nextSections.push({
        key: "audit-diff",
        label: isPtSchedulePenaltyHistory ? "Bien dong du lieu" : "Du lieu thay doi",
        content: (
          <div className="grid gap-3">
            {[
              { key: "before", title: "Du lieu truoc", value: detailData.beforeData },
              { key: "after", title: "Du lieu sau", value: detailData.afterData },
              { key: "metadata", title: "Du lieu bo sung", value: detailData.metadata },
            ].map((item) => (
              <div className="rounded-[0.8rem] border border-slate-200 bg-slate-50 p-4" key={item.key}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{translateText(item.title)}</p>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-[0.7rem] border border-slate-200 bg-white p-3 text-[11px] text-slate-700">
                  {formatSnapshotValue(item.value)}
                </pre>
              </div>
            ))}
          </div>
        ),
      });
    }

    if (canViewAttachments && config?.entityType) {
      nextSections.push({
        key: "attachments",
        label: "Tai lieu",
        count: attachmentsQuery.data?.length || 0,
        content: <AttachmentList items={(attachmentsQuery.data as Array<{ id?: string; fileName?: string; fileUrl?: string }>) || []} />,
      });
    }

    if (canViewAuditLogs) {
      nextSections.push({
        key: "audit",
        label: "Nhat ky thao tac",
        count: auditQuery.data?.length || 0,
        content: <AuditLogTable rows={auditQuery.data || []} />,
      });
    }

    return nextSections;
  })();

  const fieldLabels = useMemo(
    () => ({
      ...Object.fromEntries(
        [
          ...resource.columns.map((column) => [column.key, column.label] as const),
          ...resource.fields.map((field) => [field.name, field.label] as const),
        ].reverse(),
      ),
      ...(resourceCloneFieldLabelOverrides[resource.key] || {}),
    }),
    [resource.columns, resource.fields, resource.key],
  );

  return (
    <>
      <DetailDrawer
        data={detailData}
        fields={resource.detailFields}
        fieldLabels={fieldLabels}
        onClose={onClose}
        open={open}
        sections={sections}
        summaryItems={summaryItems}
        title={resource.title}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canResetPassword ? (
              <button className="secondary-button" onClick={() => setResetPasswordOpen(true)} type="button">
                <KeyRound className="h-4 w-4" />
                {translateText("Reset mat khau")}
              </button>
            ) : null}
            {printProfile ? (
              <button className="secondary-button" onClick={() => void handlePrintRecord()} type="button">
                <Printer className="h-4 w-4" />
                {translateText("In chung tu")}
              </button>
            ) : null}
          </div>
        }
      />

      <ResetPasswordDialog
        errorMessage={resetPasswordError}
        fullName={String(detailData.fullName || "")}
        isPending={resetPasswordMutation.isPending}
        onClose={() => {
          resetPasswordMutation.reset();
          setResetPasswordOpen(false);
        }}
        onSubmit={async (password) => {
          await resetPasswordMutation.mutateAsync(password);
        }}
        open={resetPasswordOpen}
        username={String(detailData.username || "")}
      />
    </>
  );
}
