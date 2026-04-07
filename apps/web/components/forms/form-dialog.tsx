"use client";

import { useEffect, useMemo } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";
import { ResourceDefinition, ResourceField, SettingDefinition } from "@/types/portal";
import { cn } from "@/lib/format";
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

export function FormDialog({ open, title, definition, endpoint, initialValues, queryKey, onClose }: FormDialogProps) {
  const queryClient = useQueryClient();
  const fields = useMemo(() => getVisibleFields(definition, initialValues), [definition, initialValues]);
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const isEditing = Boolean(initialValues?.id);
  const isCustomerForm = "permissionPrefix" in definition && (definition.baseKey || definition.key) === "customers";
  const isAccessControlForm =
    "permissionPrefix" in definition && ["users", "roles"].includes(definition.baseKey || definition.key);
  const isShopLineForm =
    "permissionPrefix" in definition && ["shop-sales", "shop-returns"].includes(definition.baseKey || definition.key);
  const isPurchaseOrderForm =
    "permissionPrefix" in definition && (definition.baseKey || definition.key) === "purchase-orders";
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

  useEffect(() => {
    form.reset(buildDefaultValues(fields, initialValues));
  }, [fields, form, initialValues]);

  const optionsQueries = useQueries({
    queries: fields.map((field) => ({
      queryKey: ["options", field.name, field.optionsEndpoint, isPurchaseOrderForm && field.name === "supplierId" ? selectedBranchId : ""],
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
          },
        });
        return response.data.data || response.data || [];
      },
    })),
  });

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
              const options =
                field.options ||
                (rawOptions.length
                  ? rawOptions.map((item) => ({
                      label: resolveTextDisplay(item[field.optionLabelKey || "name"] || item.name || item.code || item.title, field.name, item),
                      value: String(item[field.optionValueKey || "id"] || item.id || item.code),
                    }))
                  : []);

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
                field.type === "permission-matrix"
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
