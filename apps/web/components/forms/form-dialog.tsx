"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, X } from "lucide-react";
import { api } from "@/lib/api";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";
import { ResourceDefinition, ResourceField, SettingDefinition } from "@/types/portal";
import { cn } from "@/lib/format";
import { ContractConversionDialog } from "../portal/contract-conversion-dialog";
import { CompactMultiSelectField } from "./compact-multi-select-field";
import { MultiChecklistField } from "./multi-checklist-field";
import { PermissionMatrixField } from "./permission-matrix-field";
import { PurchaseOrderItemsField } from "./purchase-order-items-field";
import { ShopLineItemsField } from "./shop-line-items-field";

type FormDefinition = ResourceDefinition | SettingDefinition;
type FormValues = Record<string, string | string[] | undefined>;

interface FormDialogProps {
  open: boolean;
  title: string;
  definition: FormDefinition;
  endpoint: string;
  initialValues?: Record<string, unknown> | null;
  queryKey: string;
  onClose: () => void;
}

const getVisibleFields = (definition: FormDefinition, initialValues?: Record<string, unknown> | null) =>
  definition.fields.filter((field) => {
    if (initialValues?.id && field.createOnly) return false;
    if (!initialValues?.id && field.editOnly) return false;
    return true;
  });

const toDateInput = (value: unknown) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const toDateTimeInput = (value: unknown) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const normalizeInitialValue = (field: ResourceField, initialValues?: Record<string, unknown> | null) => {
  if (field.name === "payerKind") {
    return initialValues?.guestName ? "GUEST" : "MEMBER";
  }

  if (!initialValues) {
    return field.multiple ? [] : "";
  }

  if (field.type === "purchase-order-items") {
    return "";
  }

  if (field.multiple) {
    const direct = initialValues[field.name];
    if (Array.isArray(direct)) {
      return direct.map((item) => String(item));
    }

    if (field.name.endsWith("Ids")) {
      const relationKey = `${field.name.slice(0, -3)}s`;
      const relationItems = initialValues[relationKey];
      const singularKey = field.name.slice(0, -3);
      const relationIdKey = `${singularKey}Id`;

      if (Array.isArray(relationItems)) {
        return relationItems
          .map((item) => {
            if (!item || typeof item !== "object") {
              return "";
            }

            const record = item as Record<string, unknown>;
            const nested = record[singularKey] as Record<string, unknown> | undefined;
            return String(record[relationIdKey] || nested?.[field.optionValueKey || "id"] || record[field.optionValueKey || "id"] || "");
          })
          .filter(Boolean);
      }
    }

    return [];
  }

  const raw = initialValues[field.name];
  if (raw === null || raw === undefined) return "";
  if (field.type === "date") return toDateInput(raw);
  if (field.type === "datetime") return toDateTimeInput(raw);
  if (typeof raw === "boolean") return String(raw);
  return String(raw);
};

const buildDefaultValues = (fields: ResourceField[], initialValues?: Record<string, unknown> | null): FormValues =>
  Object.fromEntries(fields.map((field) => [field.name, normalizeInitialValue(field, initialValues)]));

const buildSchema = (fields: ResourceField[]) =>
  z.object(
    Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.multiple
          ? field.required
            ? z.array(z.string()).min(1, `${field.label} ${translateText("la bat buoc")}`)
            : z.array(z.string()).optional()
          : field.required
            ? z.string().min(1, `${field.label} ${translateText("la bat buoc")}`)
            : z.string().optional().or(z.literal("")),
      ]),
    ),
  );

const transformValue = (field: ResourceField, value: string | string[] | undefined) => {
  if (field.multiple) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return undefined;
  if (field.type === "purchase-order-items") {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (field.type === "number") return Number(raw);
  if (field.type === "datetime") return new Date(raw).toISOString();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
};

const getFieldSpanClass = (span?: 1 | 2 | 3) => {
  if (span === 3) return "md:col-span-2 xl:col-span-3";
  if (span === 2) return "md:col-span-2";
  return "";
};

const extractApiErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "response" in error) {
    const responseData = (error as { response?: { data?: { message?: string | string[]; error?: string } | string } }).response?.data;
    if (typeof responseData === "string" && responseData.trim()) {
      return responseData;
    }
    const message = typeof responseData === "object" && responseData ? responseData.message : undefined;
    if (Array.isArray(message)) {
      return message.filter(Boolean).join(", ") || fallback;
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    const errorLabel = typeof responseData === "object" && responseData ? responseData.error : undefined;
    if (errorLabel && typeof errorLabel === "object") {
      const nestedMessage = "message" in errorLabel ? (errorLabel as { message?: string | string[] }).message : undefined;
      if (Array.isArray(nestedMessage)) {
        return nestedMessage.filter(Boolean).join(", ") || fallback;
      }
      if (typeof nestedMessage === "string" && nestedMessage.trim()) {
        return nestedMessage;
      }
      const nestedError = "error" in errorLabel ? (errorLabel as { error?: string }).error : undefined;
      if (typeof nestedError === "string" && nestedError.trim() && nestedError.trim().toLowerCase() !== "bad request") {
        return nestedError;
      }
    }
    if (typeof errorLabel === "string" && errorLabel.trim() && errorLabel.trim().toLowerCase() !== "bad request") {
      return errorLabel;
    }
  }

  if (error instanceof Error && error.message.trim() && !error.message.includes("status code")) {
    return error.message;
  }

  return fallback;
};

const maskSensitiveText = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";
  return "*".repeat(Math.max(12, Math.min(normalized.length, 48)));
};

type ResolvedFieldOption = {
  label: string;
  value: string;
  raw?: Record<string, unknown>;
};

type BranchScopedSelectState = {
  kind: "missing-branch" | "missing-usage-type" | "empty-options";
  placeholder: string;
  helpText: string;
};

const branchScopedOptionFieldNamesByResource: Record<string, string[]> = {
  contracts: ["customerId", "servicePackageId", "trainerId"],
  "service-packages": ["serviceId"],
  "purchase-orders": ["supplierId"],
  "locker-rentals": ["lockerId", "customerId"],
  deposits: ["customerId", "lockerRentalId"],
  products: ["groupName"],
  receipts: ["customerId", "contractId"],
  "shop-sales": ["customerId"],
  "towel-issues": ["productId", "customerId", "contractId"],
  "training-sessions": ["contractId", "customerId", "trainerId"],
};

const getBranchScopedSelectState = ({
  resourceKey,
  fieldName,
  hasSelectedBranch,
  hasSelectedUsageType,
  optionCount,
  optionsLoaded,
}: {
  resourceKey: string;
  fieldName: string;
  hasSelectedBranch: boolean;
  hasSelectedUsageType: boolean;
  optionCount: number;
  optionsLoaded: boolean;
}): BranchScopedSelectState | null => {
  const branchScopedFieldNames = branchScopedOptionFieldNamesByResource[resourceKey] || [];
  if (!branchScopedFieldNames.includes(fieldName)) {
    return null;
  }

  if (!hasSelectedBranch) {
    return {
      kind: "missing-branch",
      placeholder: "Chon chi nhanh truoc",
      helpText: "Hay chon Chi nhanh truoc de loc danh sach phu hop.",
    };
  }

  if (resourceKey === "products" && fieldName === "groupName" && !hasSelectedUsageType) {
    return {
      kind: "missing-usage-type",
      placeholder: "Chon loai vat tu truoc",
      helpText: "Hay chon Chi nhanh va Loai vat tu truoc de loc Nhom hang phu hop.",
    };
  }

  if (!optionsLoaded || optionCount > 0) {
    return null;
  }

  switch (`${resourceKey}:${fieldName}`) {
    case "contracts:customerId":
    case "locker-rentals:customerId":
    case "deposits:customerId":
    case "receipts:customerId":
    case "shop-sales:customerId":
    case "towel-issues:customerId":
    case "training-sessions:customerId":
      return {
        kind: "empty-options",
        placeholder: "Chua co hoi vien cho chi nhanh nay",
        helpText: "Chi nhanh nay chua co Hoi vien / Khach hang nao. Hay tao truoc tai Hoi vien > Khach hang / Hoi vien.",
      };
    case "contracts:servicePackageId":
      return {
        kind: "empty-options",
        placeholder: "Chua co goi dich vu cho chi nhanh nay",
        helpText: "Chi nhanh nay chua co Goi dich vu nao. Hay tao truoc tai Nghiep vu > Bang gia dich vu, sau do quay lai dang ky hop dong.",
      };
    case "contracts:trainerId":
    case "training-sessions:trainerId":
      return {
        kind: "empty-options",
        placeholder: "Chua co PT cho chi nhanh nay",
        helpText: "Chi nhanh nay chua co Huan luyen vien nao. Hay tao truoc tai Nhan vien > Huan luyen vien.",
      };
    case "service-packages:serviceId":
      return {
        kind: "empty-options",
        placeholder: "Chua co dich vu cho chi nhanh nay",
        helpText: "Chi nhanh nay chua co Dich vu nao. Hay tao truoc tai Nghiep vu > Bang gia dich vu, sau do quay lai them Goi dich vu.",
      };
    case "purchase-orders:supplierId":
      return {
        kind: "empty-options",
        placeholder: "Chua co nha cung cap cho chi nhanh nay",
        helpText: "Chi nhanh nay chua co Nha cung cap nao. Hay tao truoc tai Pro Shop > Khach hang / NCC.",
      };
    case "locker-rentals:lockerId":
      return {
        kind: "empty-options",
        placeholder: "Chua co tu do cho chi nhanh nay",
        helpText: "Chi nhanh nay chua co Tu do nao. Hay tao truoc tai Pro Shop > Tu do.",
      };
    case "deposits:lockerRentalId":
      return {
        kind: "empty-options",
        placeholder: "Chua co phieu thue tu do cho chi nhanh nay",
        helpText: "Chi nhanh nay chua co Phieu thue tu do nao. Hay lap truoc tai Pro Shop > Thue Tu do.",
      };
    case "products:groupName":
      return {
        kind: "empty-options",
        placeholder: "Chua co nhom hang phu hop cho chi nhanh nay",
        helpText: "Chi nhanh nay chua co Nhom hang nao phu hop voi Loai vat tu da chon. Hay tao truoc tai Pro Shop > Nhom hang / cap phat.",
      };
    case "receipts:contractId":
    case "towel-issues:contractId":
    case "training-sessions:contractId":
      return {
        kind: "empty-options",
        placeholder: "Chua co hop dong cho chi nhanh nay",
        helpText: "Chi nhanh nay chua co Hop dong nao de lua chon. Hay tao truoc tai Nghiep vu > Dang ky dich vu.",
      };
    case "towel-issues:productId":
      return {
        kind: "empty-options",
        placeholder: "Chua co khan / vat tu cho chi nhanh nay",
        helpText: "Chi nhanh nay chua co Khan / vat tu dich vu nao. Hay tao truoc tai Pro Shop > Khan tap / vat tu va gan dung Loai vat tu.",
      };
    default:
      return {
        kind: "empty-options",
        placeholder: "Khong co du lieu phu hop cho chi nhanh nay",
        helpText: "Chi nhanh nay chua co du lieu phu hop de lua chon. Hay tao truoc du lieu nguon cho chi nhanh nay.",
      };
  }
};

const buildResolvedOptions = (
  field: ResourceField | undefined,
  rawOptions: Array<Record<string, unknown>>,
): ResolvedFieldOption[] => {
  if (!field) {
    return [];
  }

  if (field.options?.length) {
    return field.options.map((option) => ({
      label: option.label,
      value: option.value,
    }));
  }

  return rawOptions.map((item) => ({
    label: resolveTextDisplay(item[field.optionLabelKey || "name"] || item.name || item.code || item.title, field.name, item),
    value: String(item[field.optionValueKey || "id"] || item.id || item.code || ""),
    raw: item,
  }));
};

const buildShiftAssignmentSuggestion = (
  selectedShifts: Array<{ code: string; name: string }>,
  totalShiftCount: number,
) => {
  if (!selectedShifts.length) {
    return { code: "", name: "" };
  }

  if (selectedShifts.length === 1) {
    return {
      code: selectedShifts[0].code,
      name: selectedShifts[0].name,
    };
  }

  if (totalShiftCount > 0 && selectedShifts.length === totalShiftCount) {
    return {
      code: "ALL-CA",
      name: translateText("Tất cả ca"),
    };
  }

  return {
    code: `XOAY-${selectedShifts[0].code}`,
    name: translateText("Lịch xoay"),
  };
};

const shouldHideTenantDatabaseField = (
  fieldName: string,
  providerType: string,
  connectionMode: string,
) => {
  if (
    connectionMode === "CONNECTION_STRING" &&
    ["databaseHost", "databasePort", "databaseName", "databaseUser", "databasePassword"].includes(fieldName)
  ) {
    return true;
  }

  if (connectionMode === "PARAMETERS" && fieldName === "connectionUrl") {
    return true;
  }

  if (providerType !== "NEON" && fieldName === "directConnectionUrl") {
    return true;
  }

  return false;
};

const receiptInventorySourceTokens = new Set(["PRODUCT_SALE", "TOWEL_RENTAL", "TOWEL_SALE"]);

const isReceiptInventorySource = (value: string) => receiptInventorySourceTokens.has(value.trim().toUpperCase());

export function FormDialog({ open, title, definition, endpoint, initialValues, queryKey, onClose }: FormDialogProps) {
  const queryClient = useQueryClient();
  const fields = useMemo(() => getVisibleFields(definition, initialValues), [definition, initialValues]);
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const resourceKey = "permissionPrefix" in definition ? definition.baseKey || definition.key : "";
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const autoAssignmentCodeRef = useRef("");
  const autoAssignmentNameRef = useRef("");
  const previousAssignmentBranchRef = useRef("");
  const previousContractPackageRef = useRef(String(initialValues?.servicePackageId || ""));
  const previousTenantConnectionSignatureRef = useRef("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [contractConversionOpen, setContractConversionOpen] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [tenantConnectionVisibility, setTenantConnectionVisibility] = useState<Record<string, boolean>>({
    connectionUrl: false,
    directConnectionUrl: false,
  });
  const [tenantConnectionTestResult, setTenantConnectionTestResult] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
  const isEditing = Boolean(initialValues?.id);
  const isCustomerForm = "permissionPrefix" in definition && (definition.baseKey || definition.key) === "customers";
  const isAccessControlForm =
    "permissionPrefix" in definition && ["users", "roles"].includes(definition.baseKey || definition.key);
  const isReceiptForm = "permissionPrefix" in definition && (definition.baseKey || definition.key) === "receipts";
  const isShopLineForm =
    "permissionPrefix" in definition && ["shop-sales", "shop-returns"].includes(definition.baseKey || definition.key);
  const isProductForm =
    "permissionPrefix" in definition && (definition.baseKey || definition.key) === "products";
  const isTowelIssueForm =
    "permissionPrefix" in definition && (definition.baseKey || definition.key) === "towel-issues";
  const isContractForm = "permissionPrefix" in definition && (definition.baseKey || definition.key) === "contracts";
  const isServicePackageForm =
    "permissionPrefix" in definition && (definition.baseKey || definition.key) === "service-packages";
  const isPurchaseOrderForm =
    "permissionPrefix" in definition && (definition.baseKey || definition.key) === "purchase-orders";
  const isStaffShiftAssignmentForm =
    "permissionPrefix" in definition && (definition.baseKey || definition.key) === "staff-shift-assignments";
  const isTenantDatabaseForm =
    "permissionPrefix" in definition && (definition.baseKey || definition.key) === "tenant-databases";
  const isSystemTenantDatabase = Boolean(isTenantDatabaseForm && initialValues?.isSystem);
  const createActionLabel =
    "createLabel" in definition && typeof definition.createLabel === "string" && definition.createLabel.trim()
      ? definition.createLabel
      : translateText("Create");
  const submitActionLabel = isEditing ? translateText("Cap nhat") : createActionLabel;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaultValues(fields, initialValues),
  });
  const selectedBranchId = String(form.watch("branchId") || "");
  const selectedLogoUrl = String(form.watch("logoUrl") || "");
  const selectedAvatarUrl = String(form.watch("avatarUrl") || "");
  const selectedProductUsageType = String(form.watch("usageType") || "");
  const selectedProductGroupName = String(form.watch("groupName") || "");
  const selectedReceiptPayerKind = String(form.watch("payerKind") || "");
  const selectedReceiptCustomerId = String(form.watch("customerId") || "");
  const selectedReceiptContractId = String(form.watch("contractId") || "");
  const selectedReceiptSourceType = String(form.watch("sourceType") || "");
  const selectedContractPackageId = String(form.watch("servicePackageId") || "");
  const selectedContractTotalSessions = String(form.watch("totalSessions") || "");
  const selectedContractBonusSessions = String(form.watch("bonusSessions") || "");
  const selectedContractUsedSessions = String(form.watch("usedSessions") || "");
  const selectedContractRemainingSessions = String(form.watch("remainingSessions") || "");
  const isGuestReceipt = isReceiptForm && selectedReceiptPayerKind === "GUEST";
  const showReceiptLineItems = isReceiptForm && isReceiptInventorySource(selectedReceiptSourceType);
  const branchScopedOptionFieldNames = useMemo(
    () => new Set(branchScopedOptionFieldNamesByResource[resourceKey] || []),
    [resourceKey],
  );
  const selectedLineItemUsageType =
    isReceiptForm && showReceiptLineItems
      ? ["TOWEL_RENTAL", "TOWEL_SALE"].includes(selectedReceiptSourceType.trim().toUpperCase())
        ? "TOWEL_SERVICE"
        : "RETAIL"
      : isShopLineForm
        ? "RETAIL"
        : "";
  const initialContractPackageId = String(initialValues?.servicePackageId || "");
  const contractHasOperationalHistory =
    Number(initialValues?.usedSessions || 0) > 0 ||
    Number(initialValues?.amountPaid || 0) > 0 ||
    Number(initialValues?.receiptCount || 0) > 0 ||
    String(initialValues?.oldContractCode || "").trim().length > 0;
  const mustUseContractConversion =
    isContractForm &&
    isEditing &&
    Boolean(initialContractPackageId) &&
    Boolean(selectedContractPackageId) &&
    initialContractPackageId !== selectedContractPackageId &&
    contractHasOperationalHistory;
  const watchedShiftIds = form.watch("shiftIds");
  const selectedShiftIds = Array.isArray(watchedShiftIds) ? watchedShiftIds.map((item) => String(item)) : [];
  const isUnlimitedRotationSelected = String(form.watch("isUnlimitedRotation") || "") === "true";
  const selectedTenantProviderType = String(form.watch("providerType") || "POSTGRESQL").toUpperCase();
  const selectedTenantConnectionMode = String(form.watch("connectionMode") || "CONNECTION_STRING").toUpperCase();
  const tenantConnectionSignature = [
    String(form.watch("providerType") || ""),
    String(form.watch("connectionMode") || ""),
    String(form.watch("connectionUrl") || ""),
    String(form.watch("directConnectionUrl") || ""),
    String(form.watch("databaseHost") || ""),
    String(form.watch("databasePort") || ""),
    String(form.watch("databaseName") || ""),
    String(form.watch("databaseUser") || ""),
    String(form.watch("databasePassword") || ""),
  ].join("|");

  useEffect(() => {
    form.reset(buildDefaultValues(fields, initialValues));
    autoAssignmentCodeRef.current = "";
    autoAssignmentNameRef.current = "";
    previousAssignmentBranchRef.current = String(initialValues?.branchId || "");
    previousContractPackageRef.current = String(initialValues?.servicePackageId || "");
    previousTenantConnectionSignatureRef.current = tenantConnectionSignature;
    setTenantConnectionVisibility({
      connectionUrl: false,
      directConnectionUrl: false,
    });
    setTenantConnectionTestResult(null);
    setContractConversionOpen(false);
    if (!initialValues?.id && isTenantDatabaseForm) {
      form.setValue("providerType", "POSTGRESQL", { shouldDirty: false, shouldValidate: false });
      form.setValue("connectionMode", "CONNECTION_STRING", { shouldDirty: false, shouldValidate: false });
      form.setValue("isActive", "true", { shouldDirty: false, shouldValidate: false });
      form.setValue("databasePort", "5432", { shouldDirty: false, shouldValidate: false });
    }
    if (isReceiptForm) {
      form.setValue("payerKind", initialValues?.guestName ? "GUEST" : "MEMBER", {
        shouldDirty: false,
        shouldValidate: false,
      });
      if (!initialValues?.id && !initialValues?.sourceType) {
        form.setValue("sourceType", "contract", {
          shouldDirty: false,
          shouldValidate: false,
        });
      }
    }
    if (!initialValues?.id && isStaffShiftAssignmentForm) {
      form.setValue("isUnlimitedRotation", "true", { shouldDirty: false, shouldValidate: false });
      form.setValue("rotationCycleDays", "1", { shouldDirty: false, shouldValidate: false });
    }
    if (!initialValues?.id && isTowelIssueForm) {
      form.setValue("quantity", "1", { shouldDirty: false, shouldValidate: false });
      form.setValue("status", "ISSUED", { shouldDirty: false, shouldValidate: false });
      form.setValue("issueDate", toDateTimeInput(new Date()), { shouldDirty: false, shouldValidate: false });
    }
  }, [fields, form, initialValues, isReceiptForm, isStaffShiftAssignmentForm, isTenantDatabaseForm, isTowelIssueForm]);

  const resolveAssetUrl = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return "";
    if (/^https?:\/\//i.test(normalized)) return normalized;

    const apiBase = String(api.defaults.baseURL || "").replace(/\/api\/?$/, "");
    if (!apiBase) return normalized;
    return `${apiBase}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      setLogoUploadError(null);

      const formData = new FormData();
      formData.append("file", file);

      const baseKey = definition.baseKey || definition.key;
      const entityType = `${baseKey}_logo`;
      const entityId = String(initialValues?.id || `draft-${baseKey}`);
      const params = new URLSearchParams({ entityType, entityId });

      if (selectedBranchId) {
        params.set("branchId", selectedBranchId);
      }

      const response = await api.post(`/attachments/upload?${params.toString()}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const nextUrl = resolveAssetUrl(String(response.data?.fileUrl || ""));
      form.setValue("logoUrl", nextUrl, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      const message =
        error && typeof error === "object" && "response" in error
          ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message || translateText("Upload logo failed"))
          : translateText("Upload logo failed");
      setLogoUploadError(message);
    } finally {
      setUploadingLogo(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);
      setAvatarUploadError(null);

      const formData = new FormData();
      formData.append("file", file);

      const baseKey = definition.baseKey || definition.key;
      const entityType = `${baseKey}_avatar`;
      const entityId = String(initialValues?.id || `draft-${baseKey}`);
      const params = new URLSearchParams({ entityType, entityId });

      if (selectedBranchId) {
        params.set("branchId", selectedBranchId);
      }

      const response = await api.post(`/attachments/upload?${params.toString()}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const nextUrl = resolveAssetUrl(String(response.data?.fileUrl || ""));
      form.setValue("avatarUrl", nextUrl, { shouldDirty: true, shouldValidate: true });
    } catch (error) {
      const message =
        error && typeof error === "object" && "response" in error
          ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message || translateText("Upload avatar failed"))
          : translateText("Upload avatar failed");
      setAvatarUploadError(message);
    } finally {
      setUploadingAvatar(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const optionsQueries = useQueries({
    queries: fields.map((field) => ({
      queryKey: [
        "options",
        field.name,
        field.optionsEndpoint,
        branchScopedOptionFieldNames.has(field.name) ? selectedBranchId : "",
        isStaffShiftAssignmentForm && ["userIds", "userId", "shiftIds"].includes(field.name) ? selectedBranchId : "",
        isProductForm && field.name === "groupName" ? selectedBranchId : "",
        isProductForm && field.name === "groupName" ? selectedProductUsageType : "",
        (isReceiptForm || isShopLineForm) && field.name === "customerId" ? selectedBranchId : "",
        isTowelIssueForm && ["productId", "customerId", "contractId"].includes(field.name) ? selectedBranchId : "",
        isReceiptForm && field.name === "contractId" ? selectedBranchId : "",
        isReceiptForm && field.name === "contractId" ? selectedReceiptCustomerId : "",
      ],
      enabled:
        open &&
        Boolean(field.optionsEndpoint) &&
        field.type !== "line-items" &&
        field.type !== "purchase-order-items" &&
        (!branchScopedOptionFieldNames.has(field.name) || Boolean(selectedBranchId)) &&
        (!(isProductForm && field.name === "groupName") || Boolean(selectedProductUsageType)),
      queryFn: async () => {
        if (!field.optionsEndpoint) return [];
        const response = await api.get(field.optionsEndpoint, {
          params: {
            pageSize: 100,
            ...(branchScopedOptionFieldNames.has(field.name) && selectedBranchId ? { branchId: selectedBranchId } : {}),
            ...(isStaffShiftAssignmentForm &&
            selectedBranchId &&
            ["userIds", "userId", "shiftIds"].includes(field.name)
              ? { branchId: selectedBranchId }
              : {}),
            ...(isProductForm && field.name === "groupName" && selectedBranchId ? { branchId: selectedBranchId } : {}),
            ...(isProductForm && field.name === "groupName" && selectedProductUsageType ? { usageType: selectedProductUsageType } : {}),
            ...((isReceiptForm || isShopLineForm) && field.name === "customerId" && selectedBranchId ? { branchId: selectedBranchId } : {}),
            ...(isTowelIssueForm && selectedBranchId && ["productId", "customerId", "contractId"].includes(field.name) ? { branchId: selectedBranchId } : {}),
            ...(isReceiptForm && field.name === "contractId" && selectedBranchId ? { branchId: selectedBranchId } : {}),
            ...(isReceiptForm && field.name === "contractId" && selectedReceiptCustomerId ? { customerId: selectedReceiptCustomerId } : {}),
          },
        });
        return response.data.data || response.data || [];
      },
    })),
  });

  const contractPackageFieldIndex = isContractForm ? fields.findIndex((field) => field.name === "servicePackageId") : -1;
  const contractPackageField = contractPackageFieldIndex >= 0 ? fields[contractPackageFieldIndex] : undefined;
  const contractPackageRawOptions =
    contractPackageFieldIndex >= 0 && Array.isArray(optionsQueries[contractPackageFieldIndex]?.data)
      ? (optionsQueries[contractPackageFieldIndex]?.data as Array<Record<string, unknown>>)
      : [];
  const contractPackageOptions = useMemo(
    () => buildResolvedOptions(contractPackageField, contractPackageRawOptions),
    [contractPackageField, contractPackageRawOptions],
  );
  const selectedContractPackageOption = useMemo(
    () => contractPackageOptions.find((option) => option.value === selectedContractPackageId),
    [contractPackageOptions, selectedContractPackageId],
  );

  const receiptContractFieldIndex = isReceiptForm ? fields.findIndex((field) => field.name === "contractId") : -1;
  const receiptContractField = receiptContractFieldIndex >= 0 ? fields[receiptContractFieldIndex] : undefined;
  const receiptContractRawOptions =
    receiptContractFieldIndex >= 0 && Array.isArray(optionsQueries[receiptContractFieldIndex]?.data)
      ? (optionsQueries[receiptContractFieldIndex]?.data as Array<Record<string, unknown>>)
      : [];
  const receiptContractOptions = useMemo(
    () => buildResolvedOptions(receiptContractField, receiptContractRawOptions),
    [receiptContractField, receiptContractRawOptions],
  );
  const selectedReceiptContractOption = useMemo(
    () => receiptContractOptions.find((option) => option.value === selectedReceiptContractId),
    [receiptContractOptions, selectedReceiptContractId],
  );

  const shiftIdsFieldIndex = fields.findIndex((field) => field.name === "shiftIds");
  const shiftIdsField = shiftIdsFieldIndex >= 0 ? fields[shiftIdsFieldIndex] : undefined;
  const shiftRawOptions =
    shiftIdsFieldIndex >= 0 && Array.isArray(optionsQueries[shiftIdsFieldIndex]?.data)
      ? (optionsQueries[shiftIdsFieldIndex]?.data as Array<Record<string, unknown>>)
      : [];
  const shiftSelectionOptions = useMemo(
    () =>
      buildResolvedOptions(shiftIdsField, shiftRawOptions).map((option) => ({
        ...option,
        code: String(option.raw?.code || option.label || ""),
        name: String(option.raw?.name || option.label || ""),
        startTime: String(option.raw?.startTime || ""),
        endTime: String(option.raw?.endTime || ""),
        isOvernight: Boolean(option.raw?.isOvernight),
      })),
    [shiftIdsField, shiftRawOptions],
  );
  const selectedShiftSuggestions = useMemo(
    () =>
      selectedShiftIds
        .map((value) => shiftSelectionOptions.find((option) => option.value === value))
        .filter((item): item is (typeof shiftSelectionOptions)[number] => Boolean(item)),
    [selectedShiftIds, shiftSelectionOptions],
  );
  const shiftAssignmentSuggestion = useMemo(
    () => buildShiftAssignmentSuggestion(selectedShiftSuggestions, shiftSelectionOptions.length),
    [selectedShiftSuggestions, shiftSelectionOptions.length],
  );
  const productGroupFieldIndex = isProductForm ? fields.findIndex((field) => field.name === "groupName") : -1;
  const productGroupField = productGroupFieldIndex >= 0 ? fields[productGroupFieldIndex] : undefined;
  const productGroupRawOptions =
    productGroupFieldIndex >= 0 && Array.isArray(optionsQueries[productGroupFieldIndex]?.data)
      ? (optionsQueries[productGroupFieldIndex]?.data as Array<Record<string, unknown>>)
      : [];
  const productGroupOptions = useMemo(
    () => buildResolvedOptions(productGroupField, productGroupRawOptions),
    [productGroupField, productGroupRawOptions],
  );
  const serviceFieldIndex = isServicePackageForm ? fields.findIndex((field) => field.name === "serviceId") : -1;
  const serviceField = serviceFieldIndex >= 0 ? fields[serviceFieldIndex] : undefined;
  const serviceRawOptions =
    serviceFieldIndex >= 0 && Array.isArray(optionsQueries[serviceFieldIndex]?.data)
      ? (optionsQueries[serviceFieldIndex]?.data as Array<Record<string, unknown>>)
      : [];
  const serviceOptions = useMemo(
    () => buildResolvedOptions(serviceField, serviceRawOptions),
    [serviceField, serviceRawOptions],
  );

  useEffect(() => {
    if (branchScopedOptionFieldNames.size === 0) {
      return;
    }

    if (!selectedBranchId) {
      branchScopedOptionFieldNames.forEach((fieldName) => {
        const currentValue = form.getValues(fieldName);
        if (!currentValue || (Array.isArray(currentValue) && currentValue.length === 0)) {
          return;
        }

        form.setValue(fieldName, Array.isArray(currentValue) ? [] : "", {
          shouldDirty: true,
          shouldValidate: true,
        });
      });
      return;
    }

    fields.forEach((field, index) => {
      if (!branchScopedOptionFieldNames.has(field.name) || field.multiple) {
        return;
      }

      if (isProductForm && field.name === "groupName" && !selectedProductUsageType) {
        const currentValue = String(form.getValues(field.name) || "");
        if (currentValue) {
          form.setValue(field.name, "", {
            shouldDirty: true,
            shouldValidate: true,
          });
        }
        return;
      }

      if (!optionsQueries[index]?.isSuccess) {
        return;
      }

      const currentValue = String(form.getValues(field.name) || "");
      if (!currentValue) {
        return;
      }

      const rawOptions = Array.isArray(optionsQueries[index]?.data)
        ? (optionsQueries[index]?.data as Array<Record<string, unknown>>)
        : [];
      const resolvedOptions = buildResolvedOptions(field, rawOptions);
      if (!resolvedOptions.some((option) => option.value === currentValue)) {
        form.setValue(field.name, "", {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    });
  }, [
    branchScopedOptionFieldNames,
    fields,
    form,
    isProductForm,
    optionsQueries,
    selectedBranchId,
    selectedProductUsageType,
  ]);

  useEffect(() => {
    if (!isStaffShiftAssignmentForm) {
      return;
    }

    const previousBranchId = previousAssignmentBranchRef.current;
    if (previousBranchId && selectedBranchId && previousBranchId !== selectedBranchId) {
      form.setValue("userIds", [], { shouldDirty: true, shouldValidate: true });
      form.setValue("userId", "", { shouldDirty: true, shouldValidate: true });
      form.setValue("shiftIds", [], { shouldDirty: true, shouldValidate: true });
      form.setValue("code", "", { shouldDirty: true, shouldValidate: false });
      form.setValue("name", "", { shouldDirty: true, shouldValidate: false });
      autoAssignmentCodeRef.current = "";
      autoAssignmentNameRef.current = "";
    }

    previousAssignmentBranchRef.current = selectedBranchId;
  }, [form, isStaffShiftAssignmentForm, selectedBranchId]);

  useEffect(() => {
    if (!isStaffShiftAssignmentForm) {
      return;
    }

    const currentCode = String(form.getValues("code") || "");
    const currentName = String(form.getValues("name") || "");
    const nextCode = shiftAssignmentSuggestion.code;
    const nextName = shiftAssignmentSuggestion.name;

    if (!nextCode && currentCode === autoAssignmentCodeRef.current) {
      form.setValue("code", "", { shouldDirty: true, shouldValidate: false });
    } else if (nextCode && (!currentCode || currentCode === autoAssignmentCodeRef.current)) {
      form.setValue("code", nextCode, { shouldDirty: true, shouldValidate: false });
    }

    if (!nextName && currentName === autoAssignmentNameRef.current) {
      form.setValue("name", "", { shouldDirty: true, shouldValidate: false });
    } else if (nextName && (!currentName || currentName === autoAssignmentNameRef.current)) {
      form.setValue("name", nextName, { shouldDirty: true, shouldValidate: false });
    }

    autoAssignmentCodeRef.current = nextCode;
    autoAssignmentNameRef.current = nextName;
  }, [form, isStaffShiftAssignmentForm, shiftAssignmentSuggestion.code, shiftAssignmentSuggestion.name]);

  useEffect(() => {
    if (!isStaffShiftAssignmentForm || !isUnlimitedRotationSelected) {
      return;
    }

    if (String(form.getValues("rotationCycleDays") || "") !== "1") {
      form.setValue("rotationCycleDays", "1", {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [form, isStaffShiftAssignmentForm, isUnlimitedRotationSelected]);

  useEffect(() => {
    if (!isProductForm || !selectedProductGroupName || productGroupFieldIndex < 0 || !optionsQueries[productGroupFieldIndex]?.isSuccess) {
      return;
    }

    if (!productGroupOptions.some((option) => option.value === selectedProductGroupName)) {
      form.setValue("groupName", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, isProductForm, optionsQueries, productGroupFieldIndex, productGroupOptions, selectedProductGroupName]);

  useEffect(() => {
    if (!isServicePackageForm || serviceFieldIndex < 0 || !optionsQueries[serviceFieldIndex]?.isSuccess) {
      return;
    }

    const selectedServiceId = String(form.getValues("serviceId") || "");
    if (!selectedServiceId) {
      return;
    }

    if (!serviceOptions.some((option) => option.value === selectedServiceId)) {
      form.setValue("serviceId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, isServicePackageForm, optionsQueries, serviceFieldIndex, serviceOptions]);

  useEffect(() => {
    if (!isTenantDatabaseForm) {
      return;
    }

    if (!previousTenantConnectionSignatureRef.current) {
      previousTenantConnectionSignatureRef.current = tenantConnectionSignature;
      return;
    }

    if (previousTenantConnectionSignatureRef.current !== tenantConnectionSignature) {
      setTenantConnectionTestResult(null);
    }

    previousTenantConnectionSignatureRef.current = tenantConnectionSignature;
  }, [isTenantDatabaseForm, tenantConnectionSignature]);

  useEffect(() => {
    if (!isReceiptForm || selectedReceiptSourceType.trim().toUpperCase() !== "TOWEL_RENTAL") {
      return;
    }

    if (selectedReceiptPayerKind === "GUEST") {
      form.setValue("payerKind", "MEMBER", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, isReceiptForm, selectedReceiptPayerKind, selectedReceiptSourceType]);

  useEffect(() => {
    if (!isReceiptForm || selectedReceiptPayerKind !== "GUEST") {
      return;
    }

    if (selectedReceiptCustomerId) {
      form.setValue("customerId", "", { shouldDirty: true, shouldValidate: false });
    }

    if (selectedReceiptContractId) {
      form.setValue("contractId", "", { shouldDirty: true, shouldValidate: false });
    }
  }, [form, isReceiptForm, selectedReceiptContractId, selectedReceiptCustomerId, selectedReceiptPayerKind]);

  useEffect(() => {
    if (!isReceiptForm || !selectedReceiptContractId) {
      return;
    }

    const contractCustomerId = String(selectedReceiptContractOption?.raw?.customerId || "");
    if (contractCustomerId && contractCustomerId !== selectedReceiptCustomerId) {
      form.setValue("customerId", contractCustomerId, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, isReceiptForm, selectedReceiptContractId, selectedReceiptContractOption, selectedReceiptCustomerId]);

  useEffect(() => {
    if (!isReceiptForm || !selectedReceiptContractId || !optionsQueries[receiptContractFieldIndex]?.isSuccess) {
      return;
    }

    if (!receiptContractOptions.some((option) => option.value === selectedReceiptContractId)) {
      form.setValue("contractId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, isReceiptForm, optionsQueries, receiptContractFieldIndex, receiptContractOptions, selectedReceiptContractId]);

  useEffect(() => {
    if (!isContractForm || !optionsQueries[contractPackageFieldIndex]?.isSuccess) {
      return;
    }

    if (!selectedContractPackageId) {
      previousContractPackageRef.current = "";
      return;
    }

    if (!selectedContractPackageOption) {
      return;
    }

    const previousPackageId = previousContractPackageRef.current;
    if (previousPackageId === selectedContractPackageId) {
      return;
    }

    const raw = selectedContractPackageOption.raw || {};
    const nextPackageName = String(raw.name || selectedContractPackageOption.label || "").trim();
    const nextContractType = String(raw.packageType || "").trim();
    const nextTotalSessions = Number(raw.sessionCount || 0);
    const nextBonusSessions = Number(raw.bonusSessions || 0);
    const nextGrossAmount = String(raw.price ?? "").trim();
    const usedSessions = Number(form.getValues("usedSessions") || 0);
    const plannedSessions = Math.max(nextTotalSessions + nextBonusSessions, 0);
    const nextRemainingSessions = Math.max(plannedSessions - Math.max(usedSessions, 0), 0);

    if (nextPackageName) {
      form.setValue("packageName", nextPackageName, { shouldDirty: true, shouldValidate: true });
    }
    if (nextContractType) {
      form.setValue("contractType", nextContractType, { shouldDirty: true, shouldValidate: true });
    }
    form.setValue("totalSessions", String(nextTotalSessions), { shouldDirty: true, shouldValidate: true });
    form.setValue("bonusSessions", String(nextBonusSessions), { shouldDirty: true, shouldValidate: true });
    form.setValue("remainingSessions", String(nextRemainingSessions), { shouldDirty: true, shouldValidate: true });

    if (nextGrossAmount) {
      form.setValue("unitPrice", nextGrossAmount, { shouldDirty: true, shouldValidate: true });
      form.setValue("grossAmount", nextGrossAmount, { shouldDirty: true, shouldValidate: true });
    }

    previousContractPackageRef.current = selectedContractPackageId;
  }, [
    contractPackageFieldIndex,
    form,
    isContractForm,
    optionsQueries,
    selectedContractPackageId,
    selectedContractPackageOption,
  ]);

  useEffect(() => {
    if (!isContractForm || !selectedContractPackageId || !optionsQueries[contractPackageFieldIndex]?.isSuccess) {
      return;
    }

    if (!contractPackageOptions.some((option) => option.value === selectedContractPackageId)) {
      form.setValue("servicePackageId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [contractPackageFieldIndex, contractPackageOptions, form, isContractForm, optionsQueries, selectedContractPackageId]);

  useEffect(() => {
    if (!isContractForm) {
      return;
    }

    const totalSessions = Number(selectedContractTotalSessions || 0);
    const bonusSessions = Number(selectedContractBonusSessions || 0);
    const usedSessions = Number(selectedContractUsedSessions || 0);
    const nextRemainingSessions = Math.max(
      (Number.isFinite(totalSessions) ? totalSessions : 0) +
        (Number.isFinite(bonusSessions) ? bonusSessions : 0) -
        (Number.isFinite(usedSessions) ? usedSessions : 0),
      0,
    );
    const nextRemainingText = String(nextRemainingSessions);

    if (selectedContractRemainingSessions !== nextRemainingText) {
      form.setValue("remainingSessions", nextRemainingText, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [
    form,
    isContractForm,
    selectedContractBonusSessions,
    selectedContractRemainingSessions,
    selectedContractTotalSessions,
    selectedContractUsedSessions,
  ]);

  const buildPayload = (values: FormValues) => {
    const payload = Object.fromEntries(
      fields.flatMap((field) => {
        if (field.virtual) {
          return [];
        }
        const transformed = transformValue(field, values[field.name]);
        if (transformed === undefined) {
          return [];
        }
        return [[field.name, transformed]];
      }),
    ) as Record<string, unknown>;

    if (isStaffShiftAssignmentForm) {
      const normalizedShiftIds = Array.isArray(payload.shiftIds) ? payload.shiftIds.filter(Boolean) : [];
      const includeAllShifts =
        normalizedShiftIds.length > 0 &&
        shiftSelectionOptions.length > 0 &&
        normalizedShiftIds.length === shiftSelectionOptions.length;
      const unlimitedRotation =
        payload.isUnlimitedRotation === true || String(values.isUnlimitedRotation || "") === "true";
      const parsedRotationCycleDays = Number(payload.rotationCycleDays || values.rotationCycleDays || 1);
      const normalizedRotationCycleDays =
        Number.isFinite(parsedRotationCycleDays) && parsedRotationCycleDays > 0 ? parsedRotationCycleDays : 1;

      payload.includeAllShifts = includeAllShifts;
      if (!payload.code && shiftAssignmentSuggestion.code) {
        payload.code = shiftAssignmentSuggestion.code;
      }
      if (!payload.name && shiftAssignmentSuggestion.name) {
        payload.name = shiftAssignmentSuggestion.name;
      }
      payload.isUnlimitedRotation = unlimitedRotation;
      payload.rotationCycleDays = unlimitedRotation ? 1 : normalizedRotationCycleDays;
      if (payload.isUnlimitedRotation === undefined && !initialValues?.id) {
        payload.isUnlimitedRotation = true;
      }
    }

    if (isReceiptForm) {
      const payerKind = String(values.payerKind || "MEMBER").trim().toUpperCase();
      const sourceType = String(values.sourceType || "").trim();
      const inventorySource = isReceiptInventorySource(sourceType);

      payload.sourceType = sourceType || null;
      payload.amount = String(values.amount || "").trim() || null;
      payload.content = inventorySource ? null : String(values.content || "").trim() || null;
      payload.lineItemsText = inventorySource ? String(values.lineItemsText || "") : "";

      if (payerKind === "GUEST") {
        payload.customerId = null;
        payload.contractId = null;
        payload.guestName = String(values.guestName || "").trim() || null;
        payload.guestPhone = String(values.guestPhone || "").trim() || null;
      } else {
        payload.customerId = String(values.customerId || "").trim() || null;
        payload.contractId = String(values.contractId || "").trim() || null;
        payload.guestName = null;
        payload.guestPhone = null;
      }
    }

    return payload;
  };

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = buildPayload(values);

      if (initialValues?.id) {
        return api.patch(`${endpoint}/${initialValues.id}`, payload);
      }

      return api.post(endpoint, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      onClose();
    },
  });
  const testTenantConnectionMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = buildPayload(values);
      const testEndpoint = initialValues?.id ? `${endpoint}/${initialValues.id}/test-connection` : `${endpoint}/test-connection`;
      const response = await api.post<Record<string, unknown>>(testEndpoint, payload);
      return response.data;
    },
    onMutate: () => {
      setTenantConnectionTestResult(null);
    },
    onSuccess: (data) => {
      const checks = Array.isArray(data.checks) ? data.checks : [];
      const summary = checks
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const record = item as { label?: unknown; durationMs?: unknown };
          const label = translateText(String(record.label || "").trim());
          const durationMs = typeof record.durationMs === "number" ? `${record.durationMs}ms` : "";
          return [label, durationMs].filter(Boolean).join(" ");
        })
        .filter(Boolean)
        .join(" | ");
      const message = translateText(String(data.message || "Da kiem tra ket noi thanh cong cho chuoi ket noi."));
      setTenantConnectionTestResult({
        status: "success",
        message: summary ? `${message} ${summary}` : message,
      });
    },
    onError: (error) => {
      setTenantConnectionTestResult({
        status: "error",
        message: translateText(extractApiErrorMessage(error, "Kiem tra ket noi that bai")),
      });
    },
  });

  if (!open) return null;

  const mutationError = mutation.error ? extractApiErrorMessage(mutation.error, translateText("Save failed")) : null;
  const contractConversionWarning = mustUseContractConversion
    ? translateText(
        "Hop dong nay da phat sinh su dung / thanh toan. Neu doi sang goi khac, hay dung Chuyen doi hop dong de giu lich su, hop dong cu va quy doi chenh lech cho sach.",
      )
    : null;
  const defaultContractConversionType =
    definition.key === "operations-contract-renewal"
      ? "renewal"
      : definition.key === "operations-contract-upgrade"
        ? "upgrade"
        : "conversion";
  const contractConversionActionLabel =
    definition.key === "operations-contract-renewal"
      ? translateText("Lap gia han")
      : definition.key === "operations-contract-upgrade"
        ? translateText("Lap nang cap")
        : translateText("Chuyen doi hop dong");
  const dialogWidthClass =
    isCustomerForm
      ? "max-w-7xl"
      : isAccessControlForm || isReceiptForm || isShopLineForm || isPurchaseOrderForm || isTenantDatabaseForm
        ? "max-w-6xl"
        : "max-w-5xl";
  const gridClass = isCustomerForm ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-3">
      <div className={cn("card flex max-h-[94vh] w-full flex-col overflow-hidden", dialogWidthClass)}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
              {translateText(isEditing ? "Cap nhat du lieu" : "Them moi du lieu")}
            </p>
            <h3 className="mt-1 text-[15px] font-bold text-slate-900">{title}</h3>
          </div>
          <button className="secondary-button !rounded-[0.6rem] !p-2" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={form.handleSubmit(async (values) => {
            setTenantConnectionTestResult(null);
            await mutation.mutateAsync(values);
          })}
        >
          <div
            className={cn(
              "grid flex-1 content-start gap-x-3 gap-y-1.5 overflow-y-auto px-4 py-3",
              gridClass,
            )}
          >
            {isTenantDatabaseForm ? (
              <div className="rounded-[0.9rem] border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-[12px] text-slate-600 md:col-span-2">
                <div className="font-semibold text-slate-900">{translateText("Nguon nay se xuat hien trong dropdown chon CSDL o man dang nhap sau khi luu va kich hoat.")}</div>
                <div className="mt-1 text-slate-500">
                  {translateText("He thong se thu ket noi PostgreSQL / Neon.tech ngay luc luu de tranh khai bao sai host, user hoac connection string.")}
                </div>
              </div>
            ) : null}
            {isReceiptForm ? (
              <div className="rounded-[0.9rem] border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-[12px] text-slate-600 md:col-span-2">
                <div className="font-semibold text-slate-900">{translateText("Chon hoi vien / hop dong hoac bat khach le. Neu chon hop dong, he thong se khoa nguoi nop theo hop dong do.")}</div>
                <div className="mt-1 text-slate-500">
                  {translateText("Nguon thu ban san pham, khan tap / vat tu cho thue se hien them dong hang, tu dong tinh tien va tru ton khi phieu o trang thai hoan tat.")}
                </div>
              </div>
            ) : null}
            {isSystemTenantDatabase ? (
              <div className="rounded-[0.9rem] border border-amber-200 bg-amber-50/80 px-4 py-3 text-[12px] text-amber-800 md:col-span-2">
                <div className="font-semibold">{translateText("Nguon he thong mac dinh dang duoc khoa ket noi.")}</div>
                <div className="mt-1">
                  {translateText("Ban chi co the xem hoac kiem tra ket noi. He thong khong cho cap nhat host, database, user, mat khau hay trang thai kich hoat cua nguon nay.")}
                </div>
              </div>
            ) : null}
            {fields.map((field, index) => {
              if (
                isTenantDatabaseForm &&
                shouldHideTenantDatabaseField(field.name, selectedTenantProviderType, selectedTenantConnectionMode)
              ) {
                return null;
              }

              if (
                isReceiptForm &&
                ((isGuestReceipt && ["customerId", "contractId"].includes(field.name)) ||
                  (!isGuestReceipt && ["guestName", "guestPhone"].includes(field.name)) ||
                  (!showReceiptLineItems && field.name === "lineItemsText") ||
                  (showReceiptLineItems && field.name === "content"))
              ) {
                return null;
              }

              const optionsQuery = optionsQueries[index];
              const rawOptions = Array.isArray(optionsQuery.data) ? (optionsQuery.data as Array<Record<string, unknown>>) : [];
              const options = buildResolvedOptions(field, rawOptions);

              const inputType =
                field.type === "date"
                  ? "date"
                  : field.type === "datetime"
                    ? "datetime-local"
                    : field.type === "password"
                      ? "password"
                    : field.type === "number" || field.type === "currency"
                      ? "number"
                      : field.type === "email"
                        ? "email"
                        : field.type === "phone"
                          ? "tel"
                          : "text";

              const error = form.formState.errors[field.name]?.message?.toString();
              const isTenantConnectionField =
                isTenantDatabaseForm && ["connectionUrl", "directConnectionUrl"].includes(field.name);
              const isLockedTenantField =
                isSystemTenantDatabase &&
                [
                  "providerType",
                  "connectionMode",
                  "connectionUrl",
                  "directConnectionUrl",
                  "databaseHost",
                  "databasePort",
                  "databaseName",
                  "databaseUser",
                  "databasePassword",
                  "isActive",
                ].includes(field.name);
              const isContractDerivedField = isContractForm && ["packageName", "contractType"].includes(field.name);
              const branchScopedSelectState = getBranchScopedSelectState({
                resourceKey,
                fieldName: field.name,
                hasSelectedBranch: Boolean(selectedBranchId),
                hasSelectedUsageType: Boolean(selectedProductUsageType),
                optionCount: options.length,
                optionsLoaded: optionsQuery.isSuccess,
              });
              const shouldDisableBranchScopedSelect =
                branchScopedSelectState?.kind === "missing-branch" ||
                branchScopedSelectState?.kind === "missing-usage-type" ||
                (branchScopedSelectState?.kind === "empty-options" && Boolean(field.required));
              const fieldContent =
                field.type === "line-items" ? (
                  <>
                    <input type="hidden" {...form.register(field.name)} />
                    <ShopLineItemsField
                      branchId={String(form.watch("branchId") || "")}
                      error={error}
                      initialItems={initialValues?.lineItems}
                      initialValue={String(normalizeInitialValue(field, initialValues) || "")}
                      label={field.label}
                      mode={(definition.baseKey || definition.key) === "shop-returns" ? "return" : "sale"}
                      onChange={(value) => {
                        form.setValue(field.name, value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      productUsageFilter={selectedLineItemUsageType || undefined}
                      resetKey={String(initialValues?.id || "create")}
                    />
                  </>
                ) : field.type === "purchase-order-items" ? (
                  <>
                    <input type="hidden" {...form.register(field.name)} />
                    <PurchaseOrderItemsField
                      branchId={String(form.watch("branchId") || "")}
                      error={error}
                      initialItems={initialValues?.items}
                      label={field.label}
                      onChange={(value) => {
                        form.setValue(field.name, value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      resetKey={String(initialValues?.id || "create")}
                    />
                  </>
                ) : field.type === "checklist" ? (
                  <Controller
                    control={form.control}
                    name={field.name}
                    render={({ field: controlledField }) => (
                      <MultiChecklistField
                        emptyMessage={translateText("Chua co vai tro nao de lua chon.")}
                        error={error}
                        items={rawOptions.map((item) => ({
                          value: String(item[field.optionValueKey || "id"] || item.id || item.code || ""),
                          label: resolveTextDisplay(item[field.optionLabelKey || "name"] || item.name || item.code || item.title || "", field.name, item),
                          description:
                            (typeof item.description === "string" && item.description.trim() ? translateText(item.description.trim()) : undefined) ||
                            (typeof item.code === "string" ? resolveTextDisplay(item.code, field.name, item) : undefined),
                          meta: typeof item.roleType === "string" ? resolveTextDisplay(item.roleType, "roleType", item) : undefined,
                          badges: [
                            typeof item.permissionCount === "number" ? `${item.permissionCount} ${translateText("quyen")}` : "",
                            typeof item.userCount === "number" ? `${item.userCount} ${translateText("user")}` : "",
                          ].filter(Boolean),
                        }))}
                        label={field.label}
                        onChange={(nextValue) => controlledField.onChange(nextValue)}
                        value={Array.isArray(controlledField.value) ? controlledField.value.map((item) => String(item)) : []}
                      />
                    )}
                  />
                ) : field.type === "permission-matrix" ? (
                  <Controller
                    control={form.control}
                    name={field.name}
                    render={({ field: controlledField }) => (
                      <PermissionMatrixField
                        currentRoleId={typeof initialValues?.id === "string" ? initialValues.id : undefined}
                        error={error}
                        label={field.label}
                        onChange={(nextValue) => controlledField.onChange(nextValue)}
                        permissions={rawOptions.map((item) => ({
                          id: String(item[field.optionValueKey || "id"] || item.id || item.code || ""),
                          code: String(item.code || ""),
                          module: typeof item.module === "string" ? item.module : "",
                          action: typeof item.action === "string" ? item.action : "",
                          description: typeof item.description === "string" ? item.description : "",
                        }))}
                        value={Array.isArray(controlledField.value) ? controlledField.value.map((item) => String(item)) : []}
                      />
                    )}
                  />
                ) : field.type === "textarea" && isTenantConnectionField ? (
                  <Controller
                    control={form.control}
                    name={field.name}
                    render={({ field: controlledField }) => {
                      const rawValue = typeof controlledField.value === "string" ? controlledField.value : "";
                      const visible = Boolean(tenantConnectionVisibility[field.name]);
                      const displayValue = visible ? rawValue : maskSensitiveText(rawValue);

                      return (
                        <>
                          <div className="relative">
                            <textarea
                              className={cn("pr-14", !visible && rawValue ? "cursor-default text-slate-500" : "")}
                              name={controlledField.name}
                              onBlur={controlledField.onBlur}
                              onChange={(event) => {
                                if (!visible || isLockedTenantField) {
                                  return;
                                }
                                controlledField.onChange(event.target.value);
                                setTenantConnectionTestResult(null);
                              }}
                              placeholder={translateText(field.placeholder || "")}
                              readOnly={!visible || isLockedTenantField}
                              ref={controlledField.ref}
                              value={displayValue}
                            />
                            <button
                              aria-label={visible ? translateText("An chuoi ket noi") : translateText("Hien chuoi ket noi")}
                              className="secondary-button absolute right-2 top-2 !rounded-[0.65rem] !p-2"
                              onClick={() => {
                                setTenantConnectionVisibility((current) => ({
                                  ...current,
                                  [field.name]: !current[field.name],
                                }));
                              }}
                              type="button"
                            >
                              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {!visible && rawValue ? (
                            <small className="!text-slate-500">
                              {translateText("Bam vao bieu tuong con mat de hien thi va chinh sua chuoi ket noi.")}
                            </small>
                          ) : null}
                          {error ? <small>{error}</small> : null}
                        </>
                      );
                    }}
                  />
                ) : field.type === "textarea" ? (
                  <>
                    <textarea {...form.register(field.name)} placeholder={field.placeholder} />
                    {error ? <small>{error}</small> : null}
                  </>
                ) : isStaffShiftAssignmentForm && field.name === "userIds" && field.multiple ? (
                  <Controller
                    control={form.control}
                    name={field.name}
                    render={({ field: controlledField }) => (
                      <CompactMultiSelectField
                        error={error}
                        helperText={translateText("Chọn nhanh một hoặc nhiều nhân viên, hoặc bấm Chọn tất cả để phân đồng loạt.")}
                        items={options.map((option) => ({
                          value: option.value,
                          label: option.label,
                          description: String(option.raw?.title || option.raw?.attendanceCode || option.raw?.employeeCode || ""),
                          meta: String(option.raw?.branchName || ""),
                        }))}
                        label={field.label}
                        onChange={(nextValue) => controlledField.onChange(nextValue)}
                        searchPlaceholder={translateText("Tìm nhân viên cần phân ca")}
                        selectAllLabel={translateText("Chọn tất cả nhân viên")}
                        value={Array.isArray(controlledField.value) ? controlledField.value.map((item) => String(item)) : []}
                      />
                    )}
                  />
                ) : isStaffShiftAssignmentForm && field.name === "shiftIds" && field.multiple ? (
                  <Controller
                    control={form.control}
                    name={field.name}
                    render={({ field: controlledField }) => (
                      <CompactMultiSelectField
                        error={error}
                        helperText={translateText("Chọn nhanh một ca, nhiều ca hoặc bấm Chọn tất cả để tạo lịch xoay.")}
                        items={options.map((option) => ({
                          value: option.value,
                          label: `${String(option.raw?.code || option.label || "")} - ${String(option.raw?.name || option.label || "")}`,
                          description: [
                            String(option.raw?.startTime || ""),
                            String(option.raw?.endTime || ""),
                          ]
                            .filter(Boolean)
                            .join(" - ")
                            .concat(option.raw?.isOvernight ? " (+1)" : ""),
                          meta: option.raw?.isOvernight ? translateText("Ca qua đêm") : translateText("Trong ngày"),
                        }))}
                        label={field.label}
                        onChange={(nextValue) => controlledField.onChange(nextValue)}
                        searchPlaceholder={translateText("Tìm mã ca, tên ca, giờ ca")}
                        selectAllLabel={translateText("Chọn tất cả ca")}
                        value={Array.isArray(controlledField.value) ? controlledField.value.map((item) => String(item)) : []}
                      />
                    )}
                  />
                ) : isStaffShiftAssignmentForm && field.name === "rotationCycleDays" ? (
                  <>
                    <input
                      {...form.register(field.name)}
                      className={cn(isUnlimitedRotationSelected ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "")}
                      disabled={isUnlimitedRotationSelected}
                      placeholder={translateText(field.placeholder || "")}
                      step="1"
                      type="number"
                    />
                    {isUnlimitedRotationSelected ? (
                      <small className="!text-slate-500">
                        {translateText("Đã bật ca xoay không thời hạn nên chu kỳ xoay được khóa.")}
                      </small>
                    ) : error ? (
                      <small>{error}</small>
                    ) : null}
                  </>
                ) : field.type === "select" ? (
                  <>
                    <select
                      {...form.register(field.name)}
                      disabled={
                        isLockedTenantField ||
                        shouldDisableBranchScopedSelect ||
                        (isReceiptForm && field.name === "customerId" && Boolean(selectedReceiptContractId))
                      }
                      multiple={field.multiple}
                      className={field.multiple ? "min-h-40" : undefined}
                    >
                      {!field.multiple ? (
                        <option value="">
                          {translateText(branchScopedSelectState?.placeholder || "Select")}
                        </option>
                      ) : null}
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {translateText(option.label)}
                        </option>
                      ))}
                    </select>
                    {branchScopedSelectState ? (
                      <small className="!text-amber-600">
                        {translateText(branchScopedSelectState.helpText)}
                      </small>
                    ) : error ? (
                      <small>{error}</small>
                    ) : null}
                  </>
                ) : field.name === "logoUrl" ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2 md:flex-row">
                        <input
                          {...form.register(field.name)}
                          placeholder={translateText(field.placeholder || "")}
                          type="text"
                        />
                        <input
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                          ref={logoInputRef}
                          type="file"
                        />
                        <button
                          className="secondary-button shrink-0"
                          disabled={uploadingLogo}
                          onClick={() => logoInputRef.current?.click()}
                          type="button"
                        >
                          {uploadingLogo ? translateText("Dang tai logo...") : translateText("Tai logo len")}
                        </button>
                        {selectedLogoUrl ? (
                          <a
                            className="secondary-button shrink-0"
                            href={resolveAssetUrl(selectedLogoUrl)}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {translateText("Xem logo")}
                          </a>
                        ) : null}
                      </div>
                      <small className="!text-slate-500">
                        {translateText("Ban co the paste URL logo hoac bam 'Tai logo len'. Sau khi upload xong, he thong se tu dien URL vao o nay.")}
                      </small>
                    </div>
                    {logoUploadError ? <small>{logoUploadError}</small> : null}
                    {error ? <small>{error}</small> : null}
                  </>
                ) : field.name === "avatarUrl" ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2 md:flex-row">
                        <input
                          {...form.register(field.name)}
                          placeholder={translateText(field.placeholder || "")}
                          type="text"
                        />
                        <input
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                          ref={avatarInputRef}
                          type="file"
                        />
                        <button
                          className="secondary-button shrink-0"
                          disabled={uploadingAvatar}
                          onClick={() => avatarInputRef.current?.click()}
                          type="button"
                        >
                          {uploadingAvatar ? translateText("Dang tai anh...") : translateText("Tai anh len")}
                        </button>
                        {selectedAvatarUrl ? (
                          <a
                            className="secondary-button shrink-0"
                            href={resolveAssetUrl(selectedAvatarUrl)}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {translateText("Xem anh")}
                          </a>
                        ) : null}
                      </div>
                      <small className="!text-slate-500">
                        {translateText("Ban co the paste URL anh dai dien hoac bam 'Tai anh len'. Sau khi upload xong, he thong se tu dien URL vao o nay.")}
                      </small>
                    </div>
                    {avatarUploadError ? <small>{avatarUploadError}</small> : null}
                    {error ? <small>{error}</small> : null}
                  </>
                ) : (
                  <>
                    <input
                      {...form.register(field.name)}
                      disabled={isLockedTenantField}
                      readOnly={isContractDerivedField || (isContractForm && field.name === "remainingSessions")}
                      className={cn(
                        isContractDerivedField || (isContractForm && field.name === "remainingSessions")
                          ? "cursor-not-allowed bg-slate-50 text-slate-600"
                          : "",
                      )}
                      placeholder={translateText(field.placeholder || "")}
                      step={field.type === "number" || field.type === "currency" ? "any" : undefined}
                      type={inputType}
                    />
                    {isContractForm && field.name === "packageName" ? (
                      <small className="!text-slate-500">
                        {translateText("Tu dong lay theo Goi dich vu da chon. Neu muon doi ten goi, hay doi o o Goi dich vu.")}
                      </small>
                    ) : isContractForm && field.name === "contractType" ? (
                      <small className="!text-slate-500">
                        {translateText("Tu dong lay theo Goi dich vu da chon.")}
                      </small>
                    ) : isContractForm && field.name === "remainingSessions" ? (
                      <small className="!text-slate-500">
                        {translateText("Tu dong tinh = Tong buoi + Buoi bonus - Da dung.")}
                      </small>
                    ) : error ? (
                      <small>{error}</small>
                    ) : null}
                  </>
                );

              if (
                field.type === "line-items" ||
                field.type === "purchase-order-items" ||
                field.type === "checklist" ||
                field.type === "permission-matrix" ||
                (isStaffShiftAssignmentForm && field.name === "userIds" && field.multiple) ||
                (isStaffShiftAssignmentForm && field.name === "shiftIds" && field.multiple)
              ) {
                return (
                  <div className={cn(getFieldSpanClass(field.span))} key={field.name}>
                    {fieldContent}
                  </div>
                );
              }

              return (
                <label className={cn("field", getFieldSpanClass(field.span))} key={field.name}>
                  <span>{translateText(field.label)}</span>
                  {fieldContent}
                </label>
              );
            })}
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-2.5">
            {mutationError ? (
              <div className="mb-2.5 rounded-[0.75rem] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] text-rose-700">
                {mutationError}
              </div>
            ) : null}

            {isTenantDatabaseForm && tenantConnectionTestResult ? (
              <div
                className={cn(
                  "mb-2.5 rounded-[0.75rem] border px-3 py-2.5 text-[11px]",
                  tenantConnectionTestResult.status === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700",
                )}
              >
                {tenantConnectionTestResult.message}
              </div>
            ) : null}

            {contractConversionWarning ? (
              <div className="mb-2.5 rounded-[0.75rem] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
                <div className="font-semibold text-amber-900">{translateText("Khong doi goi truc tiep tren hop dong da phat sinh")}</div>
                <div className="mt-1">{contractConversionWarning}</div>
                <div className="mt-2">
                  <button className="secondary-button border-amber-300 bg-white text-amber-900 hover:bg-amber-100" onClick={() => setContractConversionOpen(true)} type="button">
                    {contractConversionActionLabel}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {isTenantDatabaseForm ? (
                  <button
                    className="secondary-button"
                    disabled={mutation.isPending || testTenantConnectionMutation.isPending}
                    onClick={() => void testTenantConnectionMutation.mutateAsync(form.getValues())}
                    type="button"
                  >
                    {testTenantConnectionMutation.isPending ? translateText("Dang kiem tra...") : translateText("Kiem tra ket noi")}
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <button className="secondary-button" onClick={onClose} type="button">
                  {translateText("Cancel")}
                </button>
                <button className="primary-button" disabled={mutation.isPending || testTenantConnectionMutation.isPending || mustUseContractConversion} type="submit">
                  {mutation.isPending ? translateText("Dang luu...") : submitActionLabel}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {isContractForm && initialValues?.id ? (
        <ContractConversionDialog
          contract={initialValues}
          defaultConversionType={defaultContractConversionType}
          onClose={() => setContractConversionOpen(false)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: [queryKey] });
            onClose();
          }}
          open={contractConversionOpen}
        />
      ) : null}
    </div>
  );
}
