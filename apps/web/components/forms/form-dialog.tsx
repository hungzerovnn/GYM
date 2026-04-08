"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";
import { ResourceDefinition, ResourceField, SettingDefinition } from "@/types/portal";
import { cn } from "@/lib/format";
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

type ResolvedFieldOption = {
  label: string;
  value: string;
  raw?: Record<string, unknown>;
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

export function FormDialog({ open, title, definition, endpoint, initialValues, queryKey, onClose }: FormDialogProps) {
  const queryClient = useQueryClient();
  const fields = useMemo(() => getVisibleFields(definition, initialValues), [definition, initialValues]);
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const autoAssignmentCodeRef = useRef("");
  const autoAssignmentNameRef = useRef("");
  const previousAssignmentBranchRef = useRef("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const isEditing = Boolean(initialValues?.id);
  const isCustomerForm = "permissionPrefix" in definition && (definition.baseKey || definition.key) === "customers";
  const isAccessControlForm =
    "permissionPrefix" in definition && ["users", "roles"].includes(definition.baseKey || definition.key);
  const isShopLineForm =
    "permissionPrefix" in definition && ["shop-sales", "shop-returns"].includes(definition.baseKey || definition.key);
  const isPurchaseOrderForm =
    "permissionPrefix" in definition && (definition.baseKey || definition.key) === "purchase-orders";
  const isStaffShiftAssignmentForm =
    "permissionPrefix" in definition && (definition.baseKey || definition.key) === "staff-shift-assignments";
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
  const watchedShiftIds = form.watch("shiftIds");
  const selectedShiftIds = Array.isArray(watchedShiftIds) ? watchedShiftIds.map((item) => String(item)) : [];
  const isUnlimitedRotationSelected = String(form.watch("isUnlimitedRotation") || "") === "true";

  useEffect(() => {
    form.reset(buildDefaultValues(fields, initialValues));
    autoAssignmentCodeRef.current = "";
    autoAssignmentNameRef.current = "";
    previousAssignmentBranchRef.current = String(initialValues?.branchId || "");
    if (!initialValues?.id && isStaffShiftAssignmentForm) {
      form.setValue("isUnlimitedRotation", "true", { shouldDirty: false, shouldValidate: false });
      form.setValue("rotationCycleDays", "1", { shouldDirty: false, shouldValidate: false });
    }
  }, [fields, form, initialValues, isStaffShiftAssignmentForm]);

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
        isPurchaseOrderForm && field.name === "supplierId" ? selectedBranchId : "",
        isStaffShiftAssignmentForm && ["userIds", "userId", "shiftIds"].includes(field.name) ? selectedBranchId : "",
      ],
      enabled:
        open &&
        Boolean(field.optionsEndpoint) &&
        field.type !== "line-items" &&
        field.type !== "purchase-order-items",
      queryFn: async () => {
        if (!field.optionsEndpoint) return [];
        const response = await api.get(field.optionsEndpoint, {
          params: {
            pageSize: 100,
            ...(isPurchaseOrderForm && field.name === "supplierId" && selectedBranchId ? { branchId: selectedBranchId } : {}),
            ...(isStaffShiftAssignmentForm &&
            selectedBranchId &&
            ["userIds", "userId", "shiftIds"].includes(field.name)
              ? { branchId: selectedBranchId }
              : {}),
          },
        });
        return response.data.data || response.data || [];
      },
    })),
  });

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

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = Object.fromEntries(
        fields.flatMap((field) => {
          const transformed = transformValue(field, values[field.name]);
          if (transformed === undefined) {
            return [];
          }
          return [[field.name, transformed]];
        }),
      );

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

  if (!open) return null;

  const mutationError =
    mutation.error && typeof mutation.error === "object" && "response" in mutation.error
      ? String((mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message || translateText("Save failed"))
      : null;
  const dialogWidthClass = isCustomerForm ? "max-w-7xl" : isAccessControlForm || isShopLineForm || isPurchaseOrderForm ? "max-w-6xl" : "max-w-5xl";
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
            await mutation.mutateAsync(values);
          })}
        >
          <div
            className={cn(
              "grid flex-1 content-start gap-x-3 gap-y-1.5 overflow-y-auto px-4 py-3",
              gridClass,
            )}
          >
            {fields.map((field, index) => {
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
                      multiple={field.multiple}
                      className={field.multiple ? "min-h-40" : undefined}
                    >
                      {!field.multiple ? <option value="">{translateText("Select")}</option> : null}
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {translateText(option.label)}
                        </option>
                      ))}
                    </select>
                    {error ? <small>{error}</small> : null}
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
                      placeholder={translateText(field.placeholder || "")}
                      step={field.type === "number" || field.type === "currency" ? "any" : undefined}
                      type={inputType}
                    />
                    {error ? <small>{error}</small> : null}
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

            <div className="flex justify-end gap-3">
              <button className="secondary-button" onClick={onClose} type="button">
                {translateText("Cancel")}
              </button>
              <button className="primary-button" disabled={mutation.isPending} type="submit">
                {mutation.isPending ? translateText("Dang luu...") : submitActionLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
