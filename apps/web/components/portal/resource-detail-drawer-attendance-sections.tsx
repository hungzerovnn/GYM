"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, EyeOff, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, ListResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";
import { StatusBadge } from "../shared/status-badge";
import {
  PreviewAssetCard,
  formatSnapshotValue,
  renderInfoCard,
  renderMiniTable,
  resolveAssetUrl,
  toApiErrorMessage,
} from "./resource-detail-drawer-shared";

type AttendanceMachineOperationRecord = Record<string, unknown>;

type AttendanceMachineBridgeSecretRecord = {
  machineId?: string;
  machineCode?: string;
  machineName?: string;
  branchId?: string;
  branchName?: string;
  vendor?: string;
  protocol?: string;
  host?: string;
  connectionPort?: string;
  machineType?: string;
  timeZone?: string;
  pollingIntervalSeconds?: number;
  hasSecret?: boolean;
  secretValue?: string;
  secretMasked?: string;
  secretSource?: string;
  supportsWebhook?: boolean;
  updatedDateTime?: string;
};

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

type AttendanceMachineCapabilityRecord = {
  key?: string;
  label?: string;
  supported?: boolean;
  notes?: string;
  [key: string]: unknown;
};

type AttendanceMachineConnectorSummary = {
  key: string;
  displayName: string;
  vendor: string;
};

type AttendanceMachineActionSupport = {
  disabled: boolean;
  tone?: "default" | "warning";
  note?: string;
  title?: string;
  description?: string;
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
  blockedCount?: number;
  memberImportedCount?: number;
  memberDuplicateCount?: number;
  memberUnmatchedCount?: number;
  pulledFromDeviceCount?: number;
  deviceUserCount?: number;
  matchedPulledUsers?: number;
  newMappedUsers?: number;
  ambiguousPulledUsers?: number;
  unmatchedPulledUsers?: number;
  deletedCount?: number;
  totalMachineLogCount?: number;
  remainingLogCount?: number;
  selectionMode?: boolean;
  selectedRequestedCount?: number;
  selectedResolvedCount?: number;
  unresolvedSelectedCount?: number;
  totalAvailableCount?: number;
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

type AttendanceMachineMaintenancePayload = {
  action: string;
  personIds?: string[];
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

type AttendanceMachinePushSelectionPersonType = "STAFF" | "CUSTOMER";

type AttendanceMachinePushSelectionDialogState = {
  open: boolean;
  personType: AttendanceMachinePushSelectionPersonType;
  search: string;
  page: number;
  selectedIds: string[];
};

type AttendanceMachinePushCandidateRecord = {
  id: string;
  displayName: string;
  entityCode: string;
  attendanceCode: string;
  identifier: string;
  status: string;
  ready: boolean;
};

const resolveAttendanceMachineDateRangeDraft = (
  draft: AttendanceMachineLogRangeDraft,
) => {
  const dateFrom = draft.dateFrom.trim();
  const dateTo = draft.dateTo.trim();

  if (!dateFrom || !dateTo) {
    toast.error(translateText("Can chon day du tu ngay va den ngay cho khoang du lieu may cham cong."));
    return null;
  }

  if (new Date(`${dateFrom}T00:00:00`).getTime() > new Date(`${dateTo}T00:00:00`).getTime()) {
    toast.error(translateText("Tu ngay khong duoc lon hon den ngay."));
    return null;
  }

  return {
    dateFrom,
    dateTo,
  };
};

const resolveAttendanceMachinePushCandidate = (
  personType: AttendanceMachinePushSelectionPersonType,
  item: Record<string, unknown>,
): AttendanceMachinePushCandidateRecord => {
  if (personType === "STAFF") {
    const attendanceCode = String(item.attendanceCode || item.employeeCode || item.username || "").trim();
    return {
      id: String(item.id || ""),
      displayName: String(item.fullName || item.username || item.employeeCode || "-"),
      entityCode: String(item.employeeCode || item.username || "").trim(),
      attendanceCode,
      identifier: String(item.username || "").trim(),
      status: String(item.status || "").trim(),
      ready: Boolean(attendanceCode),
    };
  }

  const attendanceCode = String(item.fingerprintCode || "").trim();
  return {
    id: String(item.id || ""),
    displayName: String(item.fullName || item.code || "-"),
    entityCode: String(item.code || "").trim(),
    attendanceCode,
    identifier: String(item.phone || "").trim(),
    status: String(item.membershipStatus || "").trim(),
    ready: Boolean(attendanceCode),
  };
};

const getAttendanceMachineOperationResultQueryKey = (selectedId: string) => ["attendance-machine-operation-result", selectedId];
const getAttendanceMachineBridgeSecretQueryKey = (selectedId: string) => ["attendance-machine-bridge-secret", selectedId];

const attendanceMachineRecordTypeLabel = (value: unknown) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "STAFF") return translateText("Nhan vien");
  if (normalized === "CUSTOMER") return translateText("Hoi vien");
  return translateText("Su kien");
};

const attendanceMachineBridgeSecretSourceLabel = (value: unknown) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "WEBHOOK_SECRET") return translateText("Webhook secret bridge");
  if (normalized === "API_KEY") return translateText("API key bridge");
  return translateText("Chua cau hinh");
};

const resolveAttendanceMachineConnectorSummary = (
  detailData: Record<string, unknown>,
): AttendanceMachineConnectorSummary => {
  const connectorRecord =
    detailData.connector && typeof detailData.connector === "object"
      ? (detailData.connector as Record<string, unknown>)
      : null;
  const connectorKey = String(connectorRecord?.key || "").trim();
  const connectorDisplayName = String(connectorRecord?.displayName || "").trim();
  const connectorVendor = String(connectorRecord?.vendor || "").trim();

  if (connectorKey) {
    return {
      key: connectorKey,
      displayName: connectorDisplayName || connectorKey,
      vendor: connectorVendor || String(detailData.vendor || "GENERIC"),
    };
  }

  const vendor = String(detailData.vendor || "").trim().toUpperCase();
  const protocol = String(detailData.protocol || "").trim().toUpperCase();

  if (vendor === "HIKVISION" || protocol === "HIKVISION_ISAPI") {
    return {
      key: "hikvision-isapi",
      displayName: "Hikvision ISAPI",
      vendor: "HIKVISION",
    };
  }

  if (vendor === "ZKTECO" || vendor === "RONALD_JACK" || protocol === "ZK_PULL_TCP") {
    return {
      key: "zk-pull-tcp",
      displayName: "ZKTeco / Ronald Jack Pull TCP",
      vendor: vendor || "ZKTECO",
    };
  }

  return {
    key: "generic-export",
    displayName: "Generic export / offline bridge",
    vendor: vendor || "GENERIC",
  };
};

const resolveAttendanceMachineCapabilities = (
  detailData: Record<string, unknown>,
): AttendanceMachineCapabilityRecord[] =>
  Array.isArray(detailData.capabilities)
    ? detailData.capabilities.filter(
        (item): item is AttendanceMachineCapabilityRecord =>
          Boolean(item) && typeof item === "object",
      )
    : [];

const hasAttendanceMachineCapability = (
  capabilities: AttendanceMachineCapabilityRecord[],
  capabilityKeys: string[],
) => {
  if (!capabilityKeys.length) return false;
  const keySet = new Set(capabilityKeys.map((item) => item.trim()).filter(Boolean));
  return capabilities.some((item) => keySet.has(String(item.key || "").trim()) && Boolean(item.supported));
};

const resolveAttendanceMachineActionSupport = ({
  action,
  attendanceMachineCustomersWithCodeCount,
  attendanceMachineUsersWithCodeCount,
  capabilities,
  connector,
  detailData,
}: {
  action: string;
  attendanceMachineCustomersWithCodeCount: number;
  attendanceMachineUsersWithCodeCount: number;
  capabilities: AttendanceMachineCapabilityRecord[];
  connector: AttendanceMachineConnectorSummary;
  detailData: Record<string, unknown>;
}): AttendanceMachineActionSupport => {
  const isGenericConnector = connector.key === "generic-export";
  const supportsWebhook = Boolean(detailData.supportsWebhook);
  const capabilitiesLoaded = capabilities.length > 0;
  const supportsCardEnrollment = capabilitiesLoaded
    ? hasAttendanceMachineCapability(capabilities, ["zk_pull_tcp_card_setup", "hikvision_card_setup"])
    : Boolean(detailData.supportsCardEnrollment);
  const supportsFaceEnrollment = capabilitiesLoaded
    ? hasAttendanceMachineCapability(capabilities, ["zk_pull_tcp_face_setup", "hikvision_face_setup"])
    : Boolean(detailData.supportsFaceImage);
  const supportsTimeSync = hasAttendanceMachineCapability(capabilities, ["zk_pull_tcp_time_sync", "hikvision_time_sync"]);

  switch (action) {
    case "PING_MACHINE":
      return isGenericConnector
        ? {
            disabled: true,
            tone: "warning",
            note: translateText(
              "May nay dang o che do Generic export / offline bridge, chua co SDK de goi truc tiep vao thiet bi that.",
            ),
          }
        : { disabled: false };
    case "PULL_ATTENDANCE_EVENTS":
      if (isGenericConnector && supportsWebhook) {
        return {
          disabled: false,
          tone: "warning",
          title: translateText("Lam moi su kien da nap ve he thong"),
          description: translateText(
            "May nay nhan log qua bridge/webhook. Nut nay lam moi danh sach su kien tren he thong, khong keo truc tiep tu may.",
          ),
          note: translateText("Neu can lay truc tiep tu thiet bi, hay doi Vendor / Protocol sang connector that nhu ZK Pull TCP hoac Hikvision ISAPI."),
        };
      }

      return isGenericConnector
        ? {
            disabled: true,
            tone: "warning",
            note: translateText(
              "May nay chua co connector truc tiep hoac bridge/webhook, nen khong the keo log truc tiep tu thiet bi.",
            ),
          }
        : { disabled: false };
    case "PULL_MACHINE_CODES":
      return {
        disabled: false,
        note: translateText(
          "Day chinh la nut tai xuong. May cham cong chi co 1 danh sach user chung, khong tach rieng nhan vien / hoi vien. He thong se doc danh sach nay tu may va doi chieu vao app. Neu can, ban co the tai file doi soat sau khi thao tac xong.",
        ),
      };
    case "PUSH_STAFF_CODES":
      if (isGenericConnector) {
        return {
          disabled: true,
          tone: "warning",
          note: translateText(
            "Generic export chi scaffold du lieu doi soat. Muon day nhan vien len may that, can dung connector vendor truc tiep.",
          ),
        };
      }
      return {
        disabled: false,
        note: translateText("Bam vao de mo danh sach nhan vien va chon nguoi can day len may."),
      };
    case "PUSH_CUSTOMER_CODES":
      if (isGenericConnector) {
        return {
          disabled: true,
          tone: "warning",
          note: translateText(
            "Generic export chi scaffold du lieu doi soat. Muon day hoi vien len may that, can dung connector vendor truc tiep.",
          ),
        };
      }
      return {
        disabled: false,
        note: translateText("Bam vao de mo danh sach hoi vien va chon nguoi can day len may."),
      };
    case "SYNC_MACHINE_TIME":
      return supportsTimeSync
        ? { disabled: false }
        : {
            disabled: true,
            tone: "warning",
            note: translateText(
              "Connector hien tai chua mo thao tac dong bo gio cho dong may nay, nen he thong khoa nut de tranh goi lenh sai vao thiet bi.",
            ),
          };
    case "ENROLL_CARD":
      if (isGenericConnector) {
        return {
          disabled: true,
          tone: "warning",
          note: translateText("Generic export / offline bridge khong ho tro day the truc tiep tu app."),
        };
      }
      return supportsCardEnrollment
        ? { disabled: false }
        : {
            disabled: true,
            tone: "warning",
            note: translateText("May / connector hien tai chua ho tro enroll the truc tiep tu app."),
          };
    case "ENROLL_FACE":
      if (isGenericConnector) {
        return {
          disabled: true,
          tone: "warning",
          note: translateText("Generic export / offline bridge khong ho tro day khuon mat truc tiep tu app."),
        };
      }
      return supportsFaceEnrollment
        ? { disabled: false }
        : {
            disabled: true,
            tone: "warning",
            note: translateText("May / connector hien tai chua ho tro day khuon mat truc tiep tu app."),
          };
    default:
      return { disabled: false };
  }
};

const copyTextValue = async (value: string) => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
};

const resolveAttendanceBridgeApiBaseUrl = () => {
  const configuredBaseUrl = String(api.defaults.baseURL || "").trim();
  if (!configuredBaseUrl) {
    return typeof window !== "undefined" ? `${window.location.origin}/api` : "";
  }

  if (/^https?:\/\//iu.test(configuredBaseUrl)) {
    return configuredBaseUrl;
  }

  if (typeof window !== "undefined") {
    return new URL(configuredBaseUrl, window.location.origin).toString();
  }

  return configuredBaseUrl;
};

const buildAttendanceMachineBridgeConfigSnippet = ({
  apiBaseUrl,
  branchName,
  connectionPort,
  host,
  machineCode,
  machineName,
  machineSecret,
  machineType,
  protocol,
  tenantCode,
  timeZone,
  vendor,
}: {
  apiBaseUrl: string;
  branchName: string;
  connectionPort: string;
  host: string;
  machineCode: string;
  machineName: string;
  machineSecret: string;
  machineType: string;
  protocol: string;
  tenantCode: string;
  timeZone: string;
  vendor: string;
}) => {
  const normalizedMachineCode = machineCode.trim() || "MAY-CHAM-CONG-01";
  const normalizedMachineName = machineName.trim() || normalizedMachineCode;
  const normalizedBranchName = branchName.trim() || normalizedMachineName;
  const parsedPort = Number.parseInt(connectionPort.trim(), 10);
  const nextPort = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4370;

  return JSON.stringify(
    {
      agent: {
        code: `AGENT-${normalizedMachineCode}`,
        siteName: normalizedBranchName,
        pollIntervalSeconds: 60,
        overlapMinutes: 5,
        initialLookbackHours: 72,
        logLevel: "info",
        stateFile: "./data/bridge-state.json",
      },
      machine: {
        code: normalizedMachineCode,
        name: normalizedMachineName,
        vendor: vendor.trim() || "GENERIC",
        protocol: protocol.trim() || "GENERIC_EXPORT",
        machineType: machineType.trim() || "FINGERPRINT",
        host: host.trim() || "192.168.1.201",
        port: nextPort,
        commKey: "",
        username: "",
        password: "",
        https: false,
        timeZone: timeZone.trim() || "Asia/Bangkok",
        timeoutMs: 15000,
      },
      sink: {
        mode: "api",
        api: {
          baseUrl: apiBaseUrl,
          tenantKey: tenantCode.trim() || "MASTER",
          machineSecret: machineSecret.trim() || "DOI_SECRET_RIENG_CHO_MAY_NAY",
          timeoutMs: 20000,
        },
      },
    },
    null,
    2,
  );
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

const useAttendanceMachineOperationResult = (selectedId: string) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: getAttendanceMachineOperationResultQueryKey(selectedId),
    queryFn: async () => (queryClient.getQueryData<AttendanceMachineOperationResult | null>(getAttendanceMachineOperationResultQueryKey(selectedId)) ?? null),
    enabled: Boolean(selectedId),
    initialData: () => queryClient.getQueryData<AttendanceMachineOperationResult | null>(getAttendanceMachineOperationResultQueryKey(selectedId)) ?? null,
    staleTime: Infinity,
  });
};

const resolveAttendanceMachineOperationToast = ({
  action,
  detailData,
  operationResult,
}: {
  action: string;
  detailData: Record<string, unknown>;
  operationResult: AttendanceMachineOperationResult | null;
}) => {
  const connector = resolveAttendanceMachineConnectorSummary(detailData);
  const connectorResult = operationResult?.connectorResult || null;
  const connectorMetadata =
    connectorResult?.metadata && typeof connectorResult.metadata === "object"
      ? connectorResult.metadata
      : {};
  const baseSuccessMessageMap: Record<string, string> = {
    TOGGLE_SYNC: detailData.syncEnabled ? "Da tat dong bo cho may cham cong." : "Da bat dong bo cho may cham cong.",
    PING_MACHINE: "Da kiem tra ket noi may cham cong.",
    PULL_ATTENDANCE_EVENTS: "Da nap log cham cong tu may vao he thong.",
    PULL_MACHINE_CODES: "Da tai danh sach user dang co tren may xuong.",
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
  const fallbackMessage = translateText(baseSuccessMessageMap[action] || "Da danh dau may dang gap loi.");

  if (connectorResult?.supported === false) {
    return {
      tone: "error" as const,
      message: translateText(String(connectorResult.message || fallbackMessage)),
    };
  }

  switch (action) {
    case "PULL_ATTENDANCE_EVENTS": {
      if (connector.key === "generic-export") {
        return {
          tone: Boolean(detailData.supportsWebhook) ? ("success" as const) : ("error" as const),
          message: Boolean(detailData.supportsWebhook)
            ? translateText(
                "May nay nhan log qua bridge / webhook. He thong da lam moi danh sach su kien, khong keo truc tiep tu thiet bi.",
              )
            : translateText(
                "May nay dang o che do Generic export / offline bridge, chua the keo log truc tiep tu thiet bi.",
              ),
        };
      }

      const pulledFromDeviceCount = Number(operationResult?.pulledFromDeviceCount || 0);
      const importedCount = Number(operationResult?.importedCount || 0);
      const duplicateCount = Number(operationResult?.duplicateCount || 0);
      const unmatchedCount = Number(operationResult?.unmatchedCount || 0);
      const memberImportedCount = Number(operationResult?.memberImportedCount || 0);
      const memberDuplicateCount = Number(operationResult?.memberDuplicateCount || 0);
      const memberUnmatchedCount = Number(operationResult?.memberUnmatchedCount || 0);
      const blockedCount = Number(operationResult?.blockedCount || 0);
      const rangeLabel =
        operationResult?.rangeFrom && operationResult?.rangeTo
          ? ` (${operationResult.rangeFrom} -> ${operationResult.rangeTo})`
          : "";

      if (
        !pulledFromDeviceCount &&
        !importedCount &&
        !duplicateCount &&
        !unmatchedCount &&
        !memberImportedCount &&
        !memberDuplicateCount &&
        !memberUnmatchedCount &&
        !blockedCount
      ) {
        return {
          tone: "success" as const,
          message: translateText(`Khong co log nao trong pham vi da chon de nap ve he thong${rangeLabel}.`),
        };
      }

      return {
        tone: "success" as const,
        message: translateText(
          `Da lay ${pulledFromDeviceCount} log tu may${rangeLabel}. Nhan vien: moi ${importedCount}, trung ${duplicateCount}, chua map ${unmatchedCount}. Hoi vien: moi ${memberImportedCount}, trung ${memberDuplicateCount}, chua map ${memberUnmatchedCount}, chan ${blockedCount}.`,
        ),
      };
    }
    case "PULL_MACHINE_CODES": {
      const totalRecords = Number(operationResult?.totalRecords || 0);
      const deviceUserCount = Number(operationResult?.deviceUserCount || 0);
      const matchedPulledUsers = Number(operationResult?.matchedPulledUsers || 0);
      const newMappedUsers = Number(operationResult?.newMappedUsers || 0);
      const ambiguousPulledUsers = Number(operationResult?.ambiguousPulledUsers || 0);
      const unmatchedPulledUsers = Number(operationResult?.unmatchedPulledUsers || 0);
      if (!totalRecords) {
        return {
          tone: "success" as const,
          message: translateText(
            deviceUserCount > 0
              ? `Da tai xuong ${deviceUserCount} user dang co tren may. Hien chua co nhan vien / hoi vien trong chi nhanh co ma hop le de doi chieu tu dong.`
              : "May hien khong co user nao de doi chieu vao he thong.",
          ),
        };
      }

      return {
        tone: "success" as const,
        message: translateText(
          deviceUserCount > 0
            ? `Da tai xuong ${deviceUserCount} user dang co tren may va doi chieu vao he thong. Match ${matchedPulledUsers}, map moi ${newMappedUsers}, mo ho ${ambiguousPulledUsers}, chua doi chieu ${unmatchedPulledUsers}.`
            : `Da cap nhat doi soat user / ma cham cong vao he thong.`,
        ),
      };
    }
    case "PUSH_STAFF_CODES":
    case "PUSH_CUSTOMER_CODES": {
      const subjectLabel = action === "PUSH_STAFF_CODES" ? translateText("nhan vien") : translateText("hoi vien");
      const totalRecords = Number(operationResult?.totalRecords || 0);
      const selectionMode = Boolean(operationResult?.selectionMode);
      const selectedRequestedCount = Number(operationResult?.selectedRequestedCount || 0);
      const unresolvedSelectedCount = Number(operationResult?.unresolvedSelectedCount || 0);
      const missingCodeCount = Number(operationResult?.missingCodeCount || 0);
      const pushedUsers = Number((connectorMetadata as Record<string, unknown>).pushedUsers || 0);
      const failedUsers = Number((connectorMetadata as Record<string, unknown>).failedUsers || 0);
      const warningCount = Number((connectorMetadata as Record<string, unknown>).warningCount || 0);
      const subjectScopeLabel = selectionMode
        ? translateText(`${subjectLabel} da chon`)
        : subjectLabel;

      if (!totalRecords) {
        return {
          tone: "error" as const,
          message: translateText(
            selectionMode
              ? `Danh sach ${subjectLabel} da chon chua co ai san sang day len may. Da chon ${selectedRequestedCount}, thieu ma ${missingCodeCount}, khong tim thay ${unresolvedSelectedCount}.`
              : `Chi nhanh nay chua co ${subjectLabel} nao co ma cham cong de day len may.`,
          ),
        };
      }

      if (failedUsers > 0 && pushedUsers === 0) {
        return {
          tone: "error" as const,
          message: translateText(String(connectorResult?.message || `Khong day duoc ${subjectLabel} len may cham cong.`)),
        };
      }

      if (warningCount > 0 || failedUsers > 0) {
        return {
          tone: "success" as const,
          message: translateText(
            `Da xu ly ${subjectScopeLabel} len may: thanh cong ${pushedUsers}/${totalRecords}, loi ${failedUsers}, can luu y ${warningCount}, thieu ma ${missingCodeCount}${selectionMode ? `, khong tim thay ${unresolvedSelectedCount}` : ""}.`,
          ),
        };
      }

      return {
        tone: "success" as const,
        message: translateText(`Da day ${pushedUsers || totalRecords} ${subjectScopeLabel} len may cham cong.`),
      };
    }
    case "EXPORT_MACHINE_LOG_RANGE":
    case "EXPORT_ALL_MACHINE_LOGS": {
      const totalRecords = Number(operationResult?.totalRecords || 0);
      return {
        tone: "success" as const,
        message: translateText(
          totalRecords > 0
            ? `Da tai ${totalRecords} dong log tu may ve may tinh.`
            : "Khong co log nao trong pham vi da chon. He thong da tao file CSV rong de doi soat.",
        ),
      };
    }
    default:
      return { tone: "success" as const, message: fallbackMessage };
  }
};

const useAttendanceMachineMaintenanceMutation = ({
  detailData,
  onRefresh,
  selectedId,
}: {
  detailData: Record<string, unknown>;
  onRefresh: () => Promise<void>;
  selectedId: string;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AttendanceMachineMaintenancePayload) =>
      api.post<Record<string, unknown>>(`/attendance-machines/${selectedId}/maintenance`, payload),
    onSuccess: async (response, payload) => {
      const action = payload.action;
      const operationResult = (response.data.operationResult || null) as AttendanceMachineOperationResult | null;
      queryClient.setQueryData(getAttendanceMachineOperationResultQueryKey(selectedId), operationResult);

      if (action === "EXPORT_MACHINE_LOG_RANGE" || action === "EXPORT_ALL_MACHINE_LOGS") {
        downloadAttendanceMachineLogRangeExport(
          operationResult?.records || [],
          String(operationResult?.fileName || `attendance-machine-${String(detailData.code || selectedId || "export")}-device-logs.csv`),
        );
      }

      const feedback = resolveAttendanceMachineOperationToast({
        action,
        detailData,
        operationResult,
      });

      if (feedback.tone === "error") {
        toast.error(feedback.message);
      } else {
        toast.success(feedback.message);
      }

      await onRefresh();
    },
    onError: (error) => {
      toast.error(toApiErrorMessage(error, translateText("Khong cap nhat duoc may cham cong.")));
    },
  });
};

export function AttendanceMachineConfigSection({ detailData }: { detailData: Record<string, unknown> }) {
  return (
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
  );
}

export function AttendanceMachineBridgeSecretSection({
  canMaintainAttendanceMachine,
  detailData,
  onRefresh,
  selectedId,
}: {
  canMaintainAttendanceMachine: boolean;
  detailData: Record<string, unknown>;
  onRefresh: () => Promise<void>;
  selectedId: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    setShowSecret(false);
  }, [selectedId]);

  const bridgeSecretQuery = useQuery({
    queryKey: getAttendanceMachineBridgeSecretQueryKey(selectedId),
    queryFn: async () => {
      const response = await api.get<AttendanceMachineBridgeSecretRecord>(`/attendance-machines/${selectedId}/bridge-secret`);
      return response.data;
    },
    enabled: canMaintainAttendanceMachine && Boolean(selectedId),
  });

  const bridgeSecretMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<AttendanceMachineBridgeSecretRecord>(`/attendance-machines/${selectedId}/bridge-secret/generate`, {});
      return response.data;
    },
    onSuccess: async (response) => {
      queryClient.setQueryData(getAttendanceMachineBridgeSecretQueryKey(selectedId), response);
      setShowSecret(true);
      toast.success(translateText("Da tao machine secret moi cho may cham cong."));
      await onRefresh();
    },
    onError: (error) => {
      toast.error(toApiErrorMessage(error, translateText("Khong tao duoc machine secret cho may cham cong.")));
    },
  });

  if (!canMaintainAttendanceMachine) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        {translateText("Tai khoan hien tai khong co quyen xem va tao machine secret cho may cham cong.")}
      </div>
    );
  }

  if (bridgeSecretQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        {translateText("Dang tai thong tin machine secret...")}
      </div>
    );
  }

  if (bridgeSecretQuery.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {toApiErrorMessage(bridgeSecretQuery.error, translateText("Khong tai duoc machine secret cho may cham cong."))}
      </div>
    );
  }

  const bridgeSecret = bridgeSecretQuery.data;
  const machineSecretValue = String(bridgeSecret?.secretValue || "");
  const machineSecretMasked = String(bridgeSecret?.secretMasked || translateText("Chua cau hinh"));
  const machineCode = String(bridgeSecret?.machineCode || detailData.code || "");
  const machineName = String(bridgeSecret?.machineName || detailData.name || "");
  const branchName = String(bridgeSecret?.branchName || detailData.branchName || "");
  const host = String(bridgeSecret?.host || detailData.host || "");
  const connectionPort = String(bridgeSecret?.connectionPort || detailData.connectionPort || "");
  const vendor = String(bridgeSecret?.vendor || detailData.vendor || "GENERIC");
  const protocol = String(bridgeSecret?.protocol || detailData.protocol || "GENERIC_EXPORT");
  const machineType = String(bridgeSecret?.machineType || detailData.machineType || "FINGERPRINT");
  const timeZone = String(bridgeSecret?.timeZone || detailData.timeZone || "Asia/Bangkok");
  const tenantCode = String(user?.tenantCode || "").trim() || "MASTER";
  const apiBaseUrl = resolveAttendanceBridgeApiBaseUrl();
  const bridgeConfigSnippet = buildAttendanceMachineBridgeConfigSnippet({
    apiBaseUrl,
    branchName,
    connectionPort,
    host,
    machineCode,
    machineName,
    machineSecret: machineSecretValue,
    machineType,
    protocol,
    tenantCode,
    timeZone,
    vendor,
  });

  const handleCopyMachineSecret = async () => {
    if (!machineSecretValue) {
      toast.error(translateText("May nay chua co machine secret. Hay bam Tao secret truoc."));
      return;
    }

    try {
      await copyTextValue(machineSecretValue);
      toast.success(translateText("Da copy machine secret."));
    } catch {
      toast.error(translateText("Khong copy duoc machine secret."));
    }
  };

  const handleCopyBridgeConfig = async () => {
    try {
      await copyTextValue(bridgeConfigSnippet);
      toast.success(translateText("Da copy JSON cau hinh ChamCong bridge."));
    } catch {
      toast.error(translateText("Khong copy duoc JSON cau hinh ChamCong bridge."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{translateText("Machine secret & bridge GUI")}</div>
            <div className="mt-1 text-sm text-slate-500">
              {translateText("Dung panel nay de tao secret rieng cho tung may, sau do copy thang secret hoac JSON mau qua PC mini / may tinh tai chi nhanh.")}
            </div>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            {translateText(bridgeSecret?.hasSecret ? "Da san sang" : "Can tao secret")}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {renderInfoCard("Ma may", machineCode || "-", machineName || "-")}
          {renderInfoCard("Tenant key", tenantCode, branchName || "-")}
          {renderInfoCard("API Da Nang", apiBaseUrl || "-", translateText("Bridge se day heartbeat va log len day qua HTTPS."))}
          {renderInfoCard(
            "Nguon secret",
            attendanceMachineBridgeSecretSourceLabel(bridgeSecret?.secretSource),
            `${translateText("Trang thai")}: ${bridgeSecret?.hasSecret ? translateText("Da cau hinh") : translateText("Chua cau hinh")}`,
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{translateText("Machine secret hien tai")}</div>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-[12px] leading-6 text-slate-700">
          {showSecret ? machineSecretValue || translateText("Chua cau hinh") : machineSecretMasked}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="secondary-button !rounded-[0.9rem] !px-4 !py-2"
            disabled={!bridgeSecret?.hasSecret}
            onClick={() => setShowSecret((current) => !current)}
            type="button"
          >
            {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {translateText(showSecret ? "An secret" : "Hien secret")}
          </button>
          <button
            className="secondary-button !rounded-[0.9rem] !px-4 !py-2"
            disabled={!bridgeSecret?.hasSecret}
            onClick={() => void handleCopyMachineSecret()}
            type="button"
          >
            <Copy className="h-3.5 w-3.5" />
            {translateText("Copy secret")}
          </button>
          <button
            className="primary-button !rounded-[0.9rem] !px-4 !py-2"
            disabled={bridgeSecretMutation.isPending}
            onClick={() => void bridgeSecretMutation.mutateAsync()}
            type="button"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${bridgeSecretMutation.isPending ? "animate-spin" : ""}`} />
            {translateText(bridgeSecret?.hasSecret ? "Tao lai secret" : "Tao secret")}
          </button>
        </div>
        <div className="mt-3 text-[11px] text-slate-500">
          {translateText("Nut Tao secret se ghi vao truong Webhook secret bridge cua may. Bridge local chi can gui header x-machine-secret voi gia tri nay.")}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{translateText("JSON mau cho tools/ChamCong")}</div>
            <div className="mt-1 text-sm text-slate-500">
              {translateText("Copy block nay qua file config cua service tai chi nhanh. Thuong chi can sua lai IP LAN / port cua may neu can.")}
            </div>
          </div>
          <button className="secondary-button !rounded-[0.9rem] !px-4 !py-2" onClick={() => void handleCopyBridgeConfig()} type="button">
            <Copy className="h-3.5 w-3.5" />
            {translateText("Copy JSON")}
          </button>
        </div>
        <textarea
          className="mt-4 min-h-[280px] w-full rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[12px] leading-6 text-slate-700 outline-none"
          readOnly
          value={bridgeConfigSnippet}
        />
        <div className="mt-3 text-[11px] text-slate-500">
          {translateText("Gia tri machine.host va machine.port dang lay tu cau hinh may hien tai trong he thong. Neu may tai chi nhanh dung IP LAN khac, chi can sua 2 truong do truoc khi chay service.")}
        </div>
      </div>
    </div>
  );
}

export function AttendanceMachineOperationsSection({
  canMaintainAttendanceMachine,
  canUploadAttachments,
  detailData,
  onRefresh,
  open,
  selectedId,
}: {
  canMaintainAttendanceMachine: boolean;
  canUploadAttachments: boolean;
  detailData: Record<string, unknown>;
  onRefresh: () => Promise<void>;
  open: boolean;
  selectedId: string;
}) {
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
  const [attendancePushSelectionDialog, setAttendancePushSelectionDialog] =
    useState<AttendanceMachinePushSelectionDialogState>({
      open: false,
      personType: "STAFF",
      search: "",
      page: 1,
      selectedIds: [],
    });

  const attendanceMachineBranchId = String(detailData.branchId || "");
  const maintenanceMutation = useAttendanceMachineMaintenanceMutation({
    detailData,
    onRefresh,
    selectedId,
  });

  const attendanceMachineUsersQuery = useQuery({
    queryKey: ["attendance-machine-users", selectedId, attendanceMachineBranchId],
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/users", {
        params: { branchId: attendanceMachineBranchId, page: 1, pageSize: 100, sortBy: "fullName", sortOrder: "asc" },
      });
      return response.data.data;
    },
    enabled: open && canMaintainAttendanceMachine && Boolean(attendanceMachineBranchId),
  });

  const attendanceMachineCustomersQuery = useQuery({
    queryKey: ["attendance-machine-customers", selectedId, attendanceMachineBranchId],
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/customers", {
        params: { branchId: attendanceMachineBranchId, page: 1, pageSize: 100, sortBy: "fullName", sortOrder: "asc" },
      });
      return response.data.data;
    },
    enabled: open && canMaintainAttendanceMachine && Boolean(attendanceMachineBranchId),
  });

  const attendanceMachinePushSelectionQuery = useQuery({
    queryKey: [
      "attendance-machine-push-selection",
      selectedId,
      attendanceMachineBranchId,
      attendancePushSelectionDialog.personType,
      attendancePushSelectionDialog.search,
      attendancePushSelectionDialog.page,
    ],
    queryFn: async () => {
      const endpoint =
        attendancePushSelectionDialog.personType === "STAFF" ? "/users" : "/customers";
      const response = await api.get<ListResponse<Record<string, unknown>>>(endpoint, {
        params: {
          branchId: attendanceMachineBranchId,
          page: attendancePushSelectionDialog.page,
          pageSize: 20,
          search: attendancePushSelectionDialog.search || undefined,
          sortBy: "fullName",
          sortOrder: "asc",
        },
      });
      return response.data;
    },
    enabled:
      open &&
      canMaintainAttendanceMachine &&
      attendancePushSelectionDialog.open &&
      Boolean(attendanceMachineBranchId),
  });

  const attendanceMachineUsers = attendanceMachineUsersQuery.data || [];
  const attendanceMachineCustomers = attendanceMachineCustomersQuery.data || [];
  const attendanceMachinePushSelectionCandidates =
    attendanceMachinePushSelectionQuery.data?.data.map((item) =>
      resolveAttendanceMachinePushCandidate(
        attendancePushSelectionDialog.personType,
        item,
      ),
    ) || [];
  const attendanceMachinePushSelectablePageIds = attendanceMachinePushSelectionCandidates
    .filter((item) => item.ready)
    .map((item) => item.id);
  const attendanceMachinePushAllPageSelected =
    attendanceMachinePushSelectablePageIds.length > 0 &&
    attendanceMachinePushSelectablePageIds.every((item) =>
      attendancePushSelectionDialog.selectedIds.includes(item),
    );
  const attendanceMachineUsersWithCodeCount = attendanceMachineUsers.filter((item) =>
    Boolean(String(item.attendanceCode || item.employeeCode || item.username || "").trim()),
  ).length;
  const attendanceMachineCustomersWithCodeCount = attendanceMachineCustomers.filter((item) =>
    Boolean(String(item.fingerprintCode || item.code || "").trim()),
  ).length;
  const attendanceMachineConnector = resolveAttendanceMachineConnectorSummary(detailData);
  const attendanceMachineCapabilities = resolveAttendanceMachineCapabilities(detailData);
  const attendanceMachineFoundationChecklist = Array.isArray(detailData.foundationChecklist)
    ? detailData.foundationChecklist.filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object",
      )
    : [];
  const attendanceOperationCards = [
    {
      action: "PING_MACHINE",
      title: "Kiem tra ket noi may",
      description: "Doc nhanh thong tin may, firmware, serial, so user va log hien co.",
    },
    {
      action: "PULL_ATTENDANCE_EVENTS",
      title: "Nap log cham cong vao he thong",
      description: "Lay log cham cong tu may va import vao du lieu he thong.",
    },
    {
      action: "PULL_MACHINE_CODES",
      title: "Tai user dang co tren may xuong",
      description: "May chi co 1 danh sach user chung. He thong se doc danh sach nay tu may va doi chieu vao he thong. File doi soat la tuy chon sau khi tai xong.",
    },
    {
      action: "PUSH_STAFF_CODES",
      title: "Tai nhan vien len may",
      description: "Mo danh sach nhan vien, chon nguoi can day len may cham cong.",
    },
    {
      action: "PUSH_CUSTOMER_CODES",
      title: "Tai hoi vien len may",
      description: "Mo danh sach hoi vien, chon nguoi can day len may cham cong.",
    },
    {
      action: "SYNC_MACHINE_TIME",
      title: "Dong bo gio may cham cong",
      description: "Cap nhat thoi gian may theo mui gio he thong de tranh lech check-in.",
    },
  ].map((item) => ({
    ...item,
    support: resolveAttendanceMachineActionSupport({
      action: item.action,
      attendanceMachineCustomersWithCodeCount,
      attendanceMachineUsersWithCodeCount,
      capabilities: attendanceMachineCapabilities,
      connector: attendanceMachineConnector,
      detailData,
    }),
  }));
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

  const activeAttendanceMachineMaintenanceAction =
    maintenanceMutation.isPending
      ? maintenanceMutation.variables?.action || null
      : null;
  const attendanceCardEnrollmentSupport = resolveAttendanceMachineActionSupport({
    action: "ENROLL_CARD",
    attendanceMachineCustomersWithCodeCount,
    attendanceMachineUsersWithCodeCount,
    capabilities: attendanceMachineCapabilities,
    connector: attendanceMachineConnector,
    detailData,
  });
  const attendanceFaceEnrollmentSupport = resolveAttendanceMachineActionSupport({
    action: "ENROLL_FACE",
    attendanceMachineCustomersWithCodeCount,
    attendanceMachineUsersWithCodeCount,
    capabilities: attendanceMachineCapabilities,
    connector: attendanceMachineConnector,
    detailData,
  });

  useEffect(() => {
    setAttendancePushSelectionDialog({
      open: false,
      personType: "STAFF",
      search: "",
      page: 1,
      selectedIds: [],
    });
  }, [selectedId, attendanceMachineBranchId]);

  const openAttendancePushSelectionDialog = (
    personType: AttendanceMachinePushSelectionPersonType,
  ) => {
    setAttendancePushSelectionDialog({
      open: true,
      personType,
      search: "",
      page: 1,
      selectedIds: [],
    });
  };

  const closeAttendancePushSelectionDialog = () => {
    setAttendancePushSelectionDialog((current) => ({
      ...current,
      open: false,
    }));
  };

  const toggleAttendancePushSelectionId = (personId: string) => {
    setAttendancePushSelectionDialog((current) => ({
      ...current,
      selectedIds: current.selectedIds.includes(personId)
        ? current.selectedIds.filter((item) => item !== personId)
        : [...current.selectedIds, personId],
    }));
  };

  const toggleAttendancePushSelectionCurrentPage = () => {
    setAttendancePushSelectionDialog((current) => {
      if (!attendanceMachinePushSelectablePageIds.length) {
        return current;
      }

      if (attendanceMachinePushAllPageSelected) {
        return {
          ...current,
          selectedIds: current.selectedIds.filter(
            (item) => !attendanceMachinePushSelectablePageIds.includes(item),
          ),
        };
      }

      return {
        ...current,
        selectedIds: Array.from(
          new Set([...current.selectedIds, ...attendanceMachinePushSelectablePageIds]),
        ),
      };
    });
  };

  const submitAttendancePushSelectionAction = async () => {
    if (!attendancePushSelectionDialog.selectedIds.length) {
      toast.error(
        translateText(
          attendancePushSelectionDialog.personType === "STAFF"
            ? "Hay chon it nhat 1 nhan vien truoc khi day len may."
            : "Hay chon it nhat 1 hoi vien truoc khi day len may.",
        ),
      );
      return;
    }

    await maintenanceMutation.mutateAsync({
      action:
        attendancePushSelectionDialog.personType === "STAFF"
          ? "PUSH_STAFF_CODES"
          : "PUSH_CUSTOMER_CODES",
      personIds: attendancePushSelectionDialog.selectedIds,
    });

    closeAttendancePushSelectionDialog();
  };

  const handleAttendanceOperationCardClick = async (action: string) => {
    if (action === "PUSH_STAFF_CODES") {
      openAttendancePushSelectionDialog("STAFF");
      return;
    }

    if (action === "PUSH_CUSTOMER_CODES") {
      openAttendancePushSelectionDialog("CUSTOMER");
      return;
    }

    await maintenanceMutation.mutateAsync({ action });
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
    const dateRange = resolveAttendanceMachineDateRangeDraft(attendanceMachineLogRangeDraft);
    if (!dateRange) {
      return;
    }

    await maintenanceMutation.mutateAsync({
      action,
      ...dateRange,
    });
  };

  const submitAttendanceMachineImportLogRangeAction = async () => {
    const dateRange = resolveAttendanceMachineDateRangeDraft(attendanceMachineLogRangeDraft);
    if (!dateRange) {
      return;
    }

    await maintenanceMutation.mutateAsync({
      action: "PULL_ATTENDANCE_EVENTS",
      ...dateRange,
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

    await maintenanceMutation.mutateAsync({
      action,
    });
  };

  const attendancePullLogRangeSupport = resolveAttendanceMachineActionSupport({
    action: "PULL_ATTENDANCE_EVENTS",
    attendanceMachineCustomersWithCodeCount,
    attendanceMachineUsersWithCodeCount,
    capabilities: attendanceMachineCapabilities,
    connector: attendanceMachineConnector,
    detailData,
  });

  const resolveRangeActionDisabled = () =>
    maintenanceMutation.isPending ||
    !attendanceMachineLogRangeDraft.dateFrom ||
    !attendanceMachineLogRangeDraft.dateTo;
  const isZkPullConnector = attendanceMachineConnector.key === "zk-pull-tcp";
  const attendancePushSelectionPageCount = Math.max(
    Number(attendanceMachinePushSelectionQuery.data?.pagination?.pageCount || 1),
    1,
  );
  const attendancePushSelectionTotal = Number(
    attendanceMachinePushSelectionQuery.data?.pagination?.total || 0,
  );
  const attendancePushSelectionSubjectLabel =
    attendancePushSelectionDialog.personType === "STAFF"
      ? translateText("nhan vien")
      : translateText("hoi vien");

  if (!canMaintainAttendanceMachine) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        {translateText("Tai khoan hien tai khong co quyen cap nhat trang thai may cham cong.")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border p-4 ${
          attendanceMachineConnector.key === "generic-export"
            ? "border-amber-200 bg-amber-50/70"
            : "border-emerald-200 bg-emerald-50/60"
        }`}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {renderInfoCard(
            "Connector dang dung",
            attendanceMachineConnector.displayName,
            `${translateText("Vendor")}: ${attendanceMachineConnector.vendor} | ${translateText("Giao thuc")}: ${String(detailData.protocol || "-")}`,
          )}
          {renderInfoCard(
            "Host / cong",
            String(detailData.host || "-"),
            `${translateText("Cong")}: ${String(detailData.connectionPort || "-")} | ${translateText("Trang thai")}: ${resolveTextDisplay(detailData.connectionStatus, "status")}`,
          )}
          {renderInfoCard(
            "Nhan vien co ma",
            String(attendanceMachineUsersWithCodeCount),
            `${translateText("Hoi vien co ma")}: ${attendanceMachineCustomersWithCodeCount}`,
          )}
          {renderInfoCard(
            "Checklist nen tang",
            String(attendanceMachineFoundationChecklist.filter((item) => Boolean(item.ready)).length),
            `${translateText("Tong muc")}: ${attendanceMachineFoundationChecklist.length || 0}`,
          )}
        </div>
        <div className="mt-3 text-sm text-slate-700">
          {attendanceMachineConnector.key === "generic-export"
            ? translateText(
                "May nay dang o che do Generic export / offline bridge. Cac nut keo truc tiep tu thiet bi, day user len may va dong bo gio se khong chay nhu connector that. Muon thao tac truc tiep, hay doi Vendor / Protocol sang ZK Pull TCP hoac Hikvision ISAPI.",
              )
            : translateText(
                "May nay da co connector vendor truc tiep. He thong se khoa san nhung nut nao connector hien tai khong ho tro, de tranh bam xong nhung thiet bi khong thuc thi.",
              )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {attendanceOperationCards.map((item) => (
          <button
            className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
              item.support.disabled
                ? "border-amber-200 bg-amber-50/60"
                : item.support.tone === "warning"
                  ? "border-amber-200 bg-amber-50/50 hover:border-amber-300 hover:bg-amber-50"
                  : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50"
            }`}
            disabled={maintenanceMutation.isPending || item.support.disabled}
            key={item.action}
            onClick={() => void handleAttendanceOperationCardClick(item.action)}
            type="button"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">
                {translateText(item.support.title || item.title)}
              </div>
              {item.support.disabled ? (
                <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                  {translateText("Bi khoa")}
                </span>
              ) : item.support.tone === "warning" ? (
                <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                  {translateText("Can luu y")}
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-sm text-slate-500">{translateText(item.support.description || item.description)}</div>
            {item.support.note ? <div className="mt-3 text-[11px] text-slate-600">{item.support.note}</div> : null}
          </button>
        ))}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 md:col-span-2">
          <div className="text-sm font-semibold text-slate-900">{translateText("Tai du lieu theo moc thoi gian")}</div>
          <div className="mt-1 text-sm text-slate-600">
            {translateText(
              "Nap ve he thong la import log vao du lieu app. Tai ve may tinh la chi xuat file doi soat CSV/JSON, khong ghi vao he thong. Xoa log van chi tac dong tren bo nho cua may cham cong.",
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
              "Nap ve he thong se import log trong khoang ngay da chon. Neu den ngay la hom nay, he thong lay toi thoi diem hien tai. Tai ve may tinh se tao file CSV doi soat trong cung khoang ngay. Xoa log chi duoc phep khi may ho tro xoa dung pham vi hoac khoang ngay da bao trum toan bo log hien co tren may.",
            )}
          </div>
          {isZkPullConnector ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-[11px] text-amber-800">
              {translateText(
                "Voi ZK Pull TCP, ket qua van duoc loc dung theo khoang ngay da chon. Tuy nhien may khong ho tro query log theo ngay truc tiep, nen app phai doc toan bo log dang con tren may roi moi loc theo khoang ngay. Vi vay thao tac co the lau, nhat la khi may con nhieu log.",
              )}
            </div>
          ) : null}
          {!attendancePullLogRangeSupport.disabled && attendanceMachineConnector.key !== "generic-export" ? null : (
            <div className="mt-3 rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-[11px] text-amber-800">
              {translateText(
                attendanceMachineConnector.key === "generic-export"
                  ? "Nap log theo moc thoi gian chi ap dung cho connector truc tiep. Generic export / bridge offline khong the keo truc tiep log theo khoang ngay tu thiet bi."
                  : attendancePullLogRangeSupport.note || "",
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                resolveRangeActionDisabled() ||
                attendanceMachineConnector.key === "generic-export" ||
                attendancePullLogRangeSupport.disabled
              }
              onClick={() => void submitAttendanceMachineImportLogRangeAction()}
              type="button"
            >
              {activeAttendanceMachineMaintenanceAction === "PULL_ATTENDANCE_EVENTS"
                ? translateText("Dang nap vao he thong...")
                : translateText("Nap log cham cong vao he thong")}
            </button>
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={resolveRangeActionDisabled()}
              onClick={() => void submitAttendanceMachineLogRangeAction("EXPORT_MACHINE_LOG_RANGE")}
              type="button"
            >
              {activeAttendanceMachineMaintenanceAction === "EXPORT_MACHINE_LOG_RANGE"
                ? translateText("Dang tai file...")
                : translateText("Tai file log tu may ve may tinh")}
            </button>
            <button
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={resolveRangeActionDisabled()}
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
                disabled={maintenanceMutation.isPending}
                onClick={() => void submitAttendanceMachineFullLogAction("EXPORT_ALL_MACHINE_LOGS")}
                type="button"
              >
                {activeAttendanceMachineMaintenanceAction === "EXPORT_ALL_MACHINE_LOGS"
                  ? translateText("Dang tai file...")
                  : translateText("Tai toan bo log tren may")}
              </button>
              <button
                className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={maintenanceMutation.isPending}
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
                    disabled={!canUploadAttachments || uploadingAttendanceFaceImage || maintenanceMutation.isPending}
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
              title={selectedAttendanceEnrollmentOption?.displayName || translateText("Chua chon doi tuong")}
            />
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-600">
            {translateText("Ma tren may")}: {attendanceEnrollmentDraft.machineUserId || "-"}
            {selectedAttendanceEnrollmentOption ? ` | ${translateText("Doi tuong")}: ${selectedAttendanceEnrollmentOption.label}` : ""}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={maintenanceMutation.isPending || !attendanceEnrollmentDraft.personId || !attendanceEnrollmentDraft.machineUserId}
              onClick={() =>
                void maintenanceMutation.mutateAsync({
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
              className={`rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                attendanceCardEnrollmentSupport.disabled
                  ? "border border-slate-200 bg-slate-100 text-slate-400"
                  : "border border-slate-300 bg-white text-slate-700"
              }`}
              disabled={
                maintenanceMutation.isPending ||
                !attendanceEnrollmentDraft.personId ||
                !attendanceEnrollmentDraft.machineUserId ||
                !attendanceEnrollmentDraft.cardCode ||
                attendanceCardEnrollmentSupport.disabled
              }
              onClick={() =>
                void maintenanceMutation.mutateAsync({
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
              {translateText(
                attendanceCardEnrollmentSupport.disabled
                  ? "May nay chua ho tro day the"
                  : "Day the len may",
              )}
            </button>
            <button
              className={`rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                attendanceFaceEnrollmentSupport.disabled
                  ? "border border-slate-200 bg-slate-100 text-slate-400"
                  : "bg-emerald-600 text-white"
              }`}
              disabled={
                maintenanceMutation.isPending ||
                !attendanceEnrollmentDraft.personId ||
                !attendanceEnrollmentDraft.machineUserId ||
                !attendanceEnrollmentDraft.faceImageUrl ||
                attendanceFaceEnrollmentSupport.disabled
              }
              onClick={() =>
                void maintenanceMutation.mutateAsync({
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
              {translateText(
                attendanceFaceEnrollmentSupport.disabled
                  ? "May nay chua ho tro day khuon mat"
                  : "Day khuon mat len may",
              )}
            </button>
          </div>
          {attendanceCardEnrollmentSupport.note || attendanceFaceEnrollmentSupport.note ? (
            <div className="mt-3 text-[11px] text-slate-600">
              {[attendanceCardEnrollmentSupport.note, attendanceFaceEnrollmentSupport.note]
                .filter(Boolean)
                .join(" | ")}
            </div>
          ) : null}
        </div>
      </div>

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
            disabled={maintenanceMutation.isPending}
            key={item.action}
            onClick={() => void maintenanceMutation.mutateAsync({ action: item.action })}
            type="button"
          >
            <div className="text-sm font-semibold text-slate-900">{translateText(item.title)}</div>
            <div className="mt-2 text-sm text-slate-500">{translateText(item.description)}</div>
          </button>
        ))}
      </div>

      {attendancePushSelectionDialog.open ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 p-3">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_28px_100px_rgba(15,23,42,0.22)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  {translateText(
                    attendancePushSelectionDialog.personType === "STAFF"
                      ? "Chon nhan vien de day len may"
                      : "Chon hoi vien de day len may",
                  )}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {translateText(
                    attendancePushSelectionDialog.personType === "STAFF"
                      ? "Chon tung nhan vien can day len may. He thong chi day nhung dong co ma cham cong hop le."
                      : "Chon tung hoi vien can day len may. He thong chi day nhung dong co ma cham cong hop le.",
                  )}
                </div>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                onClick={closeAttendancePushSelectionDialog}
                type="button"
              >
                {translateText("Dong")}
              </button>
            </div>

            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-end">
              <label className="flex-1 space-y-1.5">
                <div className="text-xs font-medium text-slate-600">{translateText("Tim kiem")}</div>
                <input
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  onChange={(event) =>
                    setAttendancePushSelectionDialog((current) => ({
                      ...current,
                      search: event.target.value,
                      page: 1,
                    }))
                  }
                  placeholder={translateText(
                    attendancePushSelectionDialog.personType === "STAFF"
                      ? "Nhap ten nhan vien, username hoac ma NV"
                      : "Nhap ten hoi vien, SDT hoac ma hoi vien",
                  )}
                  value={attendancePushSelectionDialog.search}
                />
              </label>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {translateText(
                  `Da chon ${attendancePushSelectionDialog.selectedIds.length} ${attendancePushSelectionSubjectLabel}.`,
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="text-sm text-slate-600">
                {translateText(
                  `Tim thay ${attendancePushSelectionTotal} ${attendancePushSelectionSubjectLabel}. Chi dong co ma cham cong moi duoc tick chon.`,
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!attendanceMachinePushSelectablePageIds.length}
                  onClick={toggleAttendancePushSelectionCurrentPage}
                  type="button"
                >
                  {translateText(
                    attendanceMachinePushAllPageSelected
                      ? "Bo chon trang nay"
                      : "Chon het trang nay",
                  )}
                </button>
                <button
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!attendancePushSelectionDialog.selectedIds.length}
                  onClick={() =>
                    setAttendancePushSelectionDialog((current) => ({
                      ...current,
                      selectedIds: [],
                    }))
                  }
                  type="button"
                >
                  {translateText("Xoa danh sach da chon")}
                </button>
              </div>
            </div>

            <div className="min-h-[280px] flex-1 overflow-y-auto px-5 pb-4">
              {attendanceMachinePushSelectionQuery.isLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  {translateText("Dang tai danh sach de chon...")}
                </div>
              ) : attendanceMachinePushSelectionQuery.isError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                  {toApiErrorMessage(
                    attendanceMachinePushSelectionQuery.error,
                    translateText("Khong tai duoc danh sach de day len may."),
                  )}
                </div>
              ) : !attendanceMachinePushSelectionCandidates.length ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  {translateText("Khong co du lieu nao khop dieu kien tim kiem hien tai.")}
                </div>
              ) : (
                <div className="space-y-2">
                  {attendanceMachinePushSelectionCandidates.map((candidate) => {
                    const checked = attendancePushSelectionDialog.selectedIds.includes(candidate.id);
                    const statusLabel = candidate.status || translateText("Chua xac dinh");
                    return (
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                          candidate.ready
                            ? checked
                              ? "border-emerald-300 bg-emerald-50"
                              : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50"
                            : "cursor-not-allowed border-amber-200 bg-amber-50/70"
                        }`}
                        key={candidate.id}
                      >
                        <input
                          checked={checked}
                          className="mt-1 h-4 w-4 accent-emerald-600"
                          disabled={!candidate.ready}
                          onChange={() => toggleAttendancePushSelectionId(candidate.id)}
                          type="checkbox"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-900">{candidate.displayName}</div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                candidate.ready
                                  ? "border border-emerald-200 bg-white text-emerald-700"
                                  : "border border-amber-200 bg-white text-amber-700"
                              }`}
                            >
                              {translateText(candidate.ready ? "Co ma" : "Thieu ma")}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {translateText("Ma cham cong")}: {candidate.attendanceCode || "-"}
                            {candidate.entityCode ? ` | ${translateText("Ma doi tuong")}: ${candidate.entityCode}` : ""}
                            {candidate.identifier ? ` | ${translateText("Lien he")}: ${candidate.identifier}` : ""}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500">
                            {translateText("Trang thai")}: {resolveTextDisplay(statusLabel, "status")}
                            {!candidate.ready
                              ? ` | ${translateText("Dong nay chua co ma cham cong hop le nen he thong khong day len may.")}`
                              : ""}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <button
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={attendancePushSelectionDialog.page <= 1}
                  onClick={() =>
                    setAttendancePushSelectionDialog((current) => ({
                      ...current,
                      page: Math.max(current.page - 1, 1),
                    }))
                  }
                  type="button"
                >
                  {translateText("Trang truoc")}
                </button>
                <div>
                  {translateText(`Trang ${attendancePushSelectionDialog.page}/${attendancePushSelectionPageCount}`)}
                </div>
                <button
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={attendancePushSelectionDialog.page >= attendancePushSelectionPageCount}
                  onClick={() =>
                    setAttendancePushSelectionDialog((current) => ({
                      ...current,
                      page: Math.min(current.page + 1, attendancePushSelectionPageCount),
                    }))
                  }
                  type="button"
                >
                  {translateText("Trang sau")}
                </button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                  onClick={closeAttendancePushSelectionDialog}
                  type="button"
                >
                  {translateText("Huy")}
                </button>
                <button
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    maintenanceMutation.isPending ||
                    attendanceMachinePushSelectionQuery.isLoading ||
                    !attendancePushSelectionDialog.selectedIds.length
                  }
                  onClick={() => void submitAttendancePushSelectionAction()}
                  type="button"
                >
                  {maintenanceMutation.isPending
                    ? translateText("Dang day len may...")
                    : translateText(
                        attendancePushSelectionDialog.personType === "STAFF"
                          ? "Day nhan vien da chon len may"
                          : "Day hoi vien da chon len may",
                      )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AttendanceMachineOperationResultSection({
  detailData,
  selectedId,
}: {
  detailData: Record<string, unknown>;
  selectedId: string;
}) {
  const operationResultQuery = useAttendanceMachineOperationResult(selectedId);
  const operationResult = operationResultQuery.data;

  if (!operationResult) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        {translateText("Khong co du lieu dong bo gan day cho may nay.")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {renderInfoCard(
          "Lan thao tac cuoi",
          formatDateTime(String(operationResult.syncedAt || operationResult.exportedAt || operationResult.machineTime || "")),
          operationResult.timeZone ? `${translateText("Mui gio")}: ${operationResult.timeZone}` : undefined,
        )}
        {renderInfoCard(
          "Ban ghi san sang",
          String(operationResult.totalRecords || 0),
          operationResult.totalBranchRecords ? `${translateText("Tong du lieu chi nhanh")}: ${operationResult.totalBranchRecords}` : undefined,
        )}
        {renderInfoCard(
          "Du lieu tu thiet bi",
          String(operationResult.pulledFromDeviceCount || operationResult.deviceUserCount || 0),
          operationResult.pulledFromDeviceCount
            ? `${translateText("Da pull log tu may")}: ${operationResult.pulledFromDeviceCount}`
            : operationResult.deviceUserCount
              ? `${translateText("User tren may")}: ${operationResult.deviceUserCount}`
              : undefined,
        )}
        {renderInfoCard(
          "Ket qua import / doi soat",
          String(operationResult.deletedCount || operationResult.importedCount || operationResult.staffCount || 0),
          [
            operationResult.selectionMode ? `${translateText("Da chon")}: ${operationResult.selectedRequestedCount || 0}` : "",
            operationResult.deletedCount !== undefined ? `${translateText("Da xoa")}: ${operationResult.deletedCount}` : "",
            operationResult.staffCount ? `${translateText("Nhan vien doi chieu")}: ${operationResult.staffCount}` : "",
            operationResult.customerCount ? `${translateText("Hoi vien san sang")}: ${operationResult.customerCount}` : "",
            operationResult.matchedPulledUsers ? `${translateText("Match voi may")}: ${operationResult.matchedPulledUsers}` : "",
            operationResult.newMappedUsers ? `${translateText("Map moi")}: ${operationResult.newMappedUsers}` : "",
            operationResult.ambiguousPulledUsers ? `${translateText("Mo ho")}: ${operationResult.ambiguousPulledUsers}` : "",
            operationResult.unmatchedPulledUsers ? `${translateText("Chua doi chieu")}: ${operationResult.unmatchedPulledUsers}` : "",
            operationResult.duplicateCount ? `${translateText("Trung")}: ${operationResult.duplicateCount}` : "",
            operationResult.unmatchedCount ? `${translateText("Chua map")}: ${operationResult.unmatchedCount}` : "",
            operationResult.unresolvedSelectedCount ? `${translateText("Khong tim thay")}: ${operationResult.unresolvedSelectedCount}` : "",
            operationResult.blockedCount ? `${translateText("Bị chặn hội viên")}: ${operationResult.blockedCount}` : "",
            operationResult.missingCodeCount ? `${translateText("Thieu ma")}: ${operationResult.missingCodeCount}` : "",
            operationResult.fileName ? `${translateText("Tep xuat")}: ${operationResult.fileName}` : "",
          ]
            .filter(Boolean)
            .join(" | ") || undefined,
        )}
        {operationResult.rangeFrom ||
        operationResult.rangeTo ||
        operationResult.totalMachineLogCount !== undefined ||
        operationResult.remainingLogCount !== undefined ||
        operationResult.deleteStrategy
          ? renderInfoCard(
              operationResult.rangeFrom || operationResult.rangeTo ? "Khoang du lieu" : "Pham vi thao tac",
              operationResult.rangeFrom || operationResult.rangeTo
                ? [
                    operationResult.rangeFrom ? formatDate(String(operationResult.rangeFrom)) : translateText("Chua co"),
                    operationResult.rangeTo ? formatDate(String(operationResult.rangeTo)) : translateText("Chua co"),
                  ].join(" - ")
                : translateText("Toan bo log tren may"),
              [
                operationResult.totalMachineLogCount !== undefined
                  ? `${translateText("Tong log tren may")}: ${operationResult.totalMachineLogCount}`
                  : "",
                operationResult.remainingLogCount !== undefined
                  ? `${translateText("Con lai sau khi xoa")}: ${operationResult.remainingLogCount}`
                  : "",
                operationResult.deleteStrategy ? `${translateText("Cach xoa")}: ${operationResult.deleteStrategy}` : "",
              ]
                .filter(Boolean)
                .join(" | ") || undefined,
            )
          : null}
      </div>
      {operationResult.description ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="font-semibold">{translateText(String(operationResult.title || "Ket qua dong bo"))}</div>
          <div className="mt-1">{translateText(String(operationResult.description || ""))}</div>
          {operationResult.action === "PULL_MACHINE_CODES" && Array.isArray(operationResult.records) && operationResult.records.length ? (
            <div className="mt-3">
              <button
                className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-700"
                onClick={() =>
                  downloadAttendanceMachineExport(
                    operationResult.records || [],
                    String(
                      operationResult.fileName ||
                        `attendance-machine-${String(detailData.code || selectedId || "export")}.csv`,
                    ),
                  )
                }
                type="button"
              >
                {translateText("Tai file doi soat ve may tinh")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {operationResult.connector || operationResult.connectorResult ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {renderInfoCard(
              "Connector",
              String(operationResult.connector?.displayName || operationResult.connector?.key || "-"),
              String(operationResult.connector?.vendor || "-"),
            )}
            {renderInfoCard(
              "Ho tro thao tac",
              resolveTextDisplay(Boolean(operationResult.connectorResult?.supported).toString()),
              String(operationResult.connectorResult?.message || "-"),
            )}
            {renderInfoCard(
              "May / chi nhanh",
              String(operationResult.machineName || operationResult.machineCode || "-"),
              String(operationResult.branchName || "-"),
            )}
            {renderInfoCard(
              "Cursor dong bo",
              String(detailData.lastLogCursor || detailData.lastUserSyncCursor || "-"),
              `${translateText("Heartbeat")}: ${formatDateTime(String(detailData.lastHeartbeatDateTime || ""))}`,
            )}
          </div>
          {operationResult.connectorResult?.metadata && Object.keys(operationResult.connectorResult.metadata).length ? (
            <div className="mt-4">
              {renderMiniTable(
                ["Thuoc tinh", "Gia tri"],
                Object.entries(operationResult.connectorResult.metadata).map(([key, value]) => [
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
      {Array.isArray(operationResult.machineUsersPreview) && operationResult.machineUsersPreview.length ? (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-900">{translateText("Preview user dang co tren may")}</div>
          {renderMiniTable(
            ["Ma tren may", "Ten", "Ma app", "Chi tiet"],
            operationResult.machineUsersPreview.map((record, index) => [
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
      {Array.isArray(operationResult.devicePreview) && operationResult.devicePreview.length ? (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-900">{translateText("Preview log vua pull tu may")}</div>
          {renderMiniTable(
            ["Ma tren may", "Thoi diem", "Loai", "Xac thuc", "Chi tiet"],
            operationResult.devicePreview.map((record, index) => [
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
      {Array.isArray(operationResult.preview) && operationResult.preview.length
        ? renderMiniTable(
            ["Loai", "Ma", "Ten", "Ma cham cong", "Trang thai", "Ghi chu"],
            operationResult.preview.map((record, index) => [
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
  );
}

export function AttendanceMachineEventsSection({ detailData }: { detailData: Record<string, unknown> }) {
  return renderMiniTable(
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
  );
}

export function MemberPresenceStatusSection({ detailData }: { detailData: Record<string, unknown> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {renderInfoCard("Hoi vien", String(detailData.fullName || detailData.customerInfo || "-"), String(detailData.code || detailData.attendanceCode || "-"))}
      {renderInfoCard("Trang thai", resolveTextDisplay(detailData.presenceStatus, "presenceStatus", detailData), String(detailData.presenceStatusNote || "-"))}
      {renderInfoCard("Dang tap tu", formatDateTime(String(detailData.currentSessionStartedAt || "")), String(detailData.currentSessionDurationLabel || translateText("Khong co phien dang mo")))}
      {renderInfoCard("Moc qua ngay", formatDateTime(String(detailData.nextAutoCloseAt || "")), formatDateTime(String(detailData.lastCheckOutAt || detailData.lastPresenceAt || "")))}
    </div>
  );
}

export function MemberPresenceToggleSection({
  canToggleMemberPresence,
  detailData,
  onRefresh,
  selectedId,
}: {
  canToggleMemberPresence: boolean;
  detailData: Record<string, unknown>;
  onRefresh: () => Promise<void>;
  selectedId: string;
}) {
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
      await onRefresh();
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

  if (!canToggleMemberPresence) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        {translateText("Tai khoan hien tai khong co quyen cap nhat trang thai hien dien hoi vien.")}
      </div>
    );
  }

  const membershipStatus = String(detailData.membershipStatus || "");
  const membershipAlertStatus = String(detailData.membershipAlertStatus || "");
  const membershipDaysRemaining = Number(detailData.membershipDaysRemaining || 0);
  const isCurrentlyActive = String(detailData.presenceStatus || "") === "ACTIVE";
  const isBlockedMembershipStatus = ["EXPIRED", "INACTIVE", "SUSPENDED", "PROSPECT"].includes(membershipStatus);
  const shouldBlockCheckIn = !isCurrentlyActive && isBlockedMembershipStatus;
  const membershipWarningMessage =
    membershipStatus === "EXPIRED"
      ? translateText(
          membershipDaysRemaining < 0
            ? `Hội viên đã hết hạn ${Math.abs(membershipDaysRemaining)} ngày. Cần gia hạn trước khi cho vào tập.`
            : "Hội viên đã hết hạn. Cần gia hạn trước khi cho vào tập.",
        )
      : membershipStatus === "PROSPECT"
        ? translateText("Hội viên chưa có gói tập hiệu lực. Cần tạo / kích hoạt gói tập trước khi check-in.")
        : membershipStatus === "INACTIVE"
          ? translateText("Hội viên đang ở trạng thái ngưng hoạt động. Cần kiểm tra và kích hoạt lại trước khi check-in.")
          : membershipStatus === "SUSPENDED"
            ? translateText("Hội viên đang bị tạm ngưng. Cần mở khóa / xử lý trước khi check-in.")
            : membershipAlertStatus === "DUE_SOON"
              ? translateText(
                  membershipDaysRemaining === 0
                    ? "Hội viên hết hạn hôm nay. Nên nhắc gia hạn trước khi vào tập."
                    : `Hội viên sắp hết hạn sau ${membershipDaysRemaining} ngày. Nên nhắc gia hạn.`,
                )
              : "";

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="text-sm font-semibold text-slate-900">{translateText("Thao tac nhanh tai quay")}</div>
      <div className="mt-1 text-sm text-slate-600">{translateText("Bam mot lan de doi trang thai hoi vien dang tap / off. Neu phien mo qua moc sang ngay moi, he thong se tu dong dong phien cu va lan bam moi se mo phien moi.")}</div>
      {membershipWarningMessage ? (
        <div
          className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
            shouldBlockCheckIn
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {membershipWarningMessage}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
            String(detailData.presenceStatus || "") === "ACTIVE" ? "bg-slate-900" : "bg-emerald-600"
          }`}
          disabled={memberPresenceToggleMutation.isPending || shouldBlockCheckIn}
          onClick={() => void memberPresenceToggleMutation.mutateAsync()}
          type="button"
        >
          {translateText(String(detailData.toggleActionLabel || "Xac nhan dang tap"))}
        </button>
        <StatusBadge value={String(detailData.presenceStatus || "")} />
        <StatusBadge value={membershipStatus} />
      </div>
    </div>
  );
}

export function MemberPresenceSessionsSection({ detailData }: { detailData: Record<string, unknown> }) {
  return renderMiniTable(
    ["Check-in", "Check-out", "Trang thai", "Nguon", "Thoi luong", "May / ghi chu"],
    ((detailData.sessions as Array<Record<string, unknown>> | undefined) || []).map((session) => [
      formatDateTime(String(session.checkInAt || "")),
      session.checkOutAt ? formatDateTime(String(session.checkOutAt || "")) : "-",
      <StatusBadge key={`${String(session.id)}-presence-status`} value={String(session.status || "")} />,
      <StatusBadge key={`${String(session.id)}-presence-source`} value={String(session.source || "")} />,
      `${String(session.durationMinutes || 0)} ${translateText("phut")}`,
      [String(session.machineName || ""), String(session.note || "")].filter(Boolean).join(" | ") || "-",
    ]),
    "Chua co phien hien dien",
    "Hoi vien nay chua co lan xac nhan dang tap / off nao.",
  );
}

export function StaffAttendanceInfoSection({ detailData }: { detailData: Record<string, unknown> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {renderInfoCard("Nhan vien", String(detailData.staffName || "-"), String(detailData.roleNames || detailData.staffCode || "-"))}
      {renderInfoCard("Chi nhanh", String(detailData.branchName || "-"), String(detailData.machineName || translateText("Khong gan may cham cong")))}
      {renderInfoCard("Thoi diem", formatDateTime(String(detailData.eventAt || "")), String(detailData.eventDate || "-"))}
      {renderInfoCard("Nguon / xac thuc", String(detailData.source || "-"), String(detailData.verificationMethod || "-"))}
      {renderInfoCard("Ma cham cong", String(detailData.rawCode || "-"), String(detailData.eventType || "-"))}
      {renderInfoCard("Ghi chu", String(detailData.note || "-"), translateText("Nen ghi ro ly do dieu chinh de audit sau nay."))}
    </div>
  );
}
