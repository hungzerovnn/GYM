"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, Plus, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatDateTime } from "@/lib/format";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";
import { localizeSettingDefinition } from "@/lib/i18n/portal";
import { useLocale } from "@/lib/i18n/provider";
import type { AppLocale } from "@/lib/i18n/runtime";
import { socialCategoryLabels, socialInboxPath, socialLinkCenterPath, socialModuleCatalog, socialPerformancePath } from "@/lib/social-module-config";
import { settingsRegistry } from "@/lib/settings-registry";
import { printSettingPreview } from "@/lib/print";
import { SettingDefinition } from "@/types/portal";
import { EmptyState } from "../feedback/empty-state";
import { PageHeader } from "../layout/page-header";
import { StatusBadge } from "../shared/status-badge";
import { SocialLinkCenterWorkspace } from "./social-link-center-workspace";
import { SearchBar } from "../table/search-bar";

const LazyFormDialog = dynamic(() => import("../forms/form-dialog").then((mod) => mod.FormDialog), {
  loading: () => null,
});

const LazyReportTemplateWorkspace = dynamic(() => import("./report-template-workspace").then((mod) => mod.ReportTemplateWorkspace), {
  loading: () => null,
});

type SettingFormValues = Record<string, string | undefined>;
type SettingSummaryCardType = "text" | "status" | "date" | "datetime" | "raw";
type SettingSummaryCard = {
  label: string;
  value: unknown;
  type: SettingSummaryCardType;
  fieldKey?: string;
};

const getSettingBaseKey = (setting: SettingDefinition) => setting.baseKey || setting.key;

const settingTextValueAliases: Record<string, Record<string, Array<{ code: string; label: string }>>> = {
  tags: {
    leadHotTag: [{ code: "HOT", label: "Lead nong" }],
    debtTag: [{ code: "DEBT", label: "Cong no" }],
    vipTag: [{ code: "VIP", label: "Hoi vien VIP" }],
    overdueFollowUpTag: [{ code: "OVERDUE", label: "Cham soc qua han" }],
  },
};

const getSettingFieldAliases = (setting: SettingDefinition, fieldName: string) => {
  const settingAliases = settingTextValueAliases[getSettingBaseKey(setting)];
  if (!settingAliases) return [];
  return settingAliases[fieldName] || [];
};

const buildSchema = (setting: SettingDefinition) =>
  z.object(
    Object.fromEntries(
      setting.fields.map((field) => [
        field.name,
        field.required ? z.string().min(1, `${translateText(field.label)} ${translateText("la bat buoc")}`) : z.string().optional().or(z.literal("")),
      ]),
    ),
  );

const normalizeValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return String(value);
  return String(value);
};

const toSettingFormValue = (setting: SettingDefinition, fieldName: string, value: unknown, locale: AppLocale) => {
  const normalized = normalizeValue(value);
  if (!normalized) return "";

  const alias = getSettingFieldAliases(setting, fieldName).find((item) => item.code === normalized);
  if (!alias) return normalized;

  return translateText(alias.label, locale);
};

const toSettingStoredValue = (setting: SettingDefinition, fieldName: string, value: string | undefined, locale: AppLocale) => {
  const normalized = value?.trim() || "";
  if (!normalized) return undefined;

  const alias = getSettingFieldAliases(setting, fieldName).find((item) => {
    const translatedLabel = translateText(item.label, locale);
    return normalized === item.code || normalized === item.label || normalized === translatedLabel;
  });

  return alias ? alias.code : normalized;
};

const buildDefaults = (setting: SettingDefinition, data: Record<string, unknown> | null | undefined, locale: AppLocale): SettingFormValues =>
  Object.fromEntries(
    setting.fields.map((field) => [
      field.name,
      toSettingFormValue(setting, field.name, data?.[field.name], locale),
    ]),
  );

const transformValue = (value: string | undefined, type: string) => {
  const normalized = value?.trim() || "";
  if (!normalized) return undefined;
  if (type === "number" || type === "currency") return Number(normalized);
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return normalized;
};

const getFieldSections = (setting: SettingDefinition) =>
  setting.fields.reduce<Record<string, SettingDefinition["fields"]>>((groups, field) => {
    const section = field.section || translateText("Cau hinh");
    groups[section] = [...(groups[section] || []), field];
    return groups;
  }, {});

const getVisibleFieldSections = (setting: SettingDefinition, showAdvanced: boolean) =>
  setting.fields.reduce<Record<string, SettingDefinition["fields"]>>((groups, field) => {
    if (field.hidden) return groups;
    if (field.advanced && !showAdvanced) return groups;
    const section = field.section || translateText("Cau hinh");
    groups[section] = [...(groups[section] || []), field];
    return groups;
  }, {});

const socialConnectorFieldLabels: Record<string, string> = {
  accountId: "Ma OA / ma kenh",
  pageId: "Ma page / ma kenh (ky thuat)",
  phoneNumberId: "Phone number ID (ky thuat)",
  businessAccountId: "Business / WABA ID (ky thuat)",
  accessToken: "Mat khau / ma ket noi",
  appSecret: "App secret (ky thuat)",
  webhookVerifyToken: "Ma xac minh webhook",
  webhookSecret: "Ma bao mat webhook",
};

const formatSocialMissingField = (field: string) => socialConnectorFieldLabels[field] || field;

const renderSummaryValue = (card: SettingSummaryCard) => {
  const { value, type, fieldKey } = card;
  if (value === null || value === undefined || value === "") return "-";
  if (type === "raw") return String(value);
  if (type === "status" || typeof value === "boolean") return <StatusBadge value={value ? "ACTIVE" : "INACTIVE"} />;
  if (type === "datetime" || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value))) return formatDateTime(String(value));
  if (type === "date" || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))) return formatDate(String(value));
  if (typeof value === "boolean") return <StatusBadge value={value ? "ACTIVE" : "INACTIVE"} />;
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  return resolveTextDisplay(value, fieldKey);
};

const deriveSummaryCards = (setting: SettingDefinition, data?: Record<string, unknown> | null): SettingSummaryCard[] => {
  const source = data || {};
  const cards = [
    { label: "Dia chi API", value: setting.endpoint, type: "raw" as const },
    {
      label: "Chi nhanh",
      value: source.branchName || (source.branchId ? source.branchId : "Toan he thong"),
      type: "text" as const,
      fieldKey: "branchName",
    },
    {
      label: "Trang thai",
      value:
        source.isActive !== undefined
          ? Boolean(source.isActive)
          : source.enabled !== undefined
            ? Boolean(source.enabled)
            : source.otpEnabled !== undefined
            ? Boolean(source.otpEnabled)
              : "",
      type: "status" as const,
    },
    { label: "Cap nhat lan cuoi", value: source.updatedAt || "", type: "datetime" as const },
  ].filter((item) => item.value !== "");

  return cards.slice(0, 4);
};

const canPrintSettingPreview = (setting: SettingDefinition) => {
  const key = setting.baseKey || setting.key;
  return key === "print-templates" || key === "report-templates";
};

function SettingEditorPanel({
  setting,
  compact = false,
}: {
  setting: SettingDefinition;
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const localizedSetting = useMemo(() => localizeSettingDefinition(setting), [locale, setting]);
  const settingBaseKey = getSettingBaseKey(localizedSetting);
  const queryClient = useQueryClient();
  const schema = useMemo(() => buildSchema(localizedSetting), [localizedSetting]);
  const canPreview = canPrintSettingPreview(localizedSetting);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const hasAdvancedFields = localizedSetting.fields.some((field) => field.advanced);
  const sections = useMemo(
    () => getVisibleFieldSections(localizedSetting, showAdvanced),
    [localizedSetting, showAdvanced],
  );

  const form = useForm<SettingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(localizedSetting, null, locale),
  });
  const watchedBranchId = localizedSetting.fields.some((field) => field.name === "branchId") ? form.watch("branchId") : "";
  const watchedPrinterMode = settingBaseKey === "print-templates" ? String(form.watch("printerMode") || "BROWSER_DIALOG") : "";
  const watchedPrinterName =
    settingBaseKey === "print-templates" ? String(form.watch("defaultPrinterName") || "").trim() : "";
  const usesStoredPrinterMode = settingBaseKey === "print-templates" && watchedPrinterMode !== "BROWSER_DIALOG";

  const query = useQuery({
    queryKey: ["setting", localizedSetting.key, watchedBranchId || ""],
    queryFn: async () => {
      const response = await api.get(localizedSetting.endpoint, {
        params: watchedBranchId ? { branchId: watchedBranchId } : undefined,
      });
      return (response.data || {}) as Record<string, unknown>;
    },
    enabled: localizedSetting.layout !== "communication",
  });

  useEffect(() => {
    form.reset(buildDefaults(localizedSetting, query.data, locale));
  }, [form, locale, localizedSetting, query.data]);

  const optionsQueries = useQueries({
    queries: localizedSetting.fields.map((field) => ({
      queryKey: ["setting-options", localizedSetting.key, field.name, field.optionsEndpoint],
      enabled: Boolean(field.optionsEndpoint),
      queryFn: async () => {
        if (!field.optionsEndpoint) return [];
        const response = await api.get(field.optionsEndpoint, { params: { pageSize: 100 } });
        return response.data.data || response.data || [];
      },
    })),
  });

  const printerPaperSizesQuery = useQuery({
    queryKey: ["setting-printer-paper-sizes", watchedPrinterName],
    enabled: settingBaseKey === "print-templates" && watchedPrinterMode !== "NETWORK_IP" && Boolean(watchedPrinterName),
    queryFn: async () => {
      const response = await api.get(`/settings/system-printers/${encodeURIComponent(watchedPrinterName)}/paper-sizes`);
      return Array.isArray(response.data) ? response.data : [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: SettingFormValues) => {
      const payload = Object.fromEntries(
        localizedSetting.fields.flatMap((field) => {
          const storedValue = toSettingStoredValue(localizedSetting, field.name, values[field.name], locale);
          if (settingBaseKey === "program-branding") {
            return [[field.name, typeof storedValue === "string" ? storedValue : ""]];
          }

          const transformed = transformValue(storedValue, field.type);
          return transformed === undefined ? [] : [[field.name, transformed]];
        }),
      );

      return api.patch(localizedSetting.endpoint, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["setting", localizedSetting.key] });
      if ((localizedSetting.key || "").startsWith("social-")) {
        await queryClient.invalidateQueries({ queryKey: ["social-connectors-status"] });
      }
    },
  });

  const mutationError =
    mutation.error && typeof mutation.error === "object" && "response" in mutation.error
      ? String((mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message || translateText("Save failed"))
      : null;

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

      const branchId = String(form.getValues("branchId") || "").trim();
      const params = new URLSearchParams({
        entityType: "system_setting_logo",
        entityId: branchId || "company",
      });

      if (branchId) {
        params.set("branchId", branchId);
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

  const handlePrintPreview = () => {
    const values = form.getValues();
    const previewSections = Object.entries(getFieldSections(localizedSetting)).map(([sectionName, fields]) => ({
      title: sectionName,
      items: fields.map((field) => ({
        label: field.label,
        value: values[field.name] || "",
      })),
    }));

    printSettingPreview({
      title: localizedSetting.title,
      subtitle: localizedSetting.subtitle,
      sections: previewSections,
      note: typeof values.note === "string" && values.note.trim() ? values.note : undefined,
    });
  };

  if (query.isLoading) {
    return <div className="card h-56 animate-pulse bg-slate-100" />;
  }

  if (query.isError) {
    return <EmptyState description={translateText("Khong tai duoc cau hinh nay tu API.")} title={translateText("Cau hinh gap loi")} />;
  }

  return (
    <div className={compact ? "settings-workspace card p-5" : "settings-workspace grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"}>
      {!compact ? (
        <aside className="card space-y-3 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText("Setting scope")}</p>
            <h3 className="mt-1 text-[13px] font-bold text-slate-900">{localizedSetting.title}</h3>
          </div>
          {deriveSummaryCards(setting, query.data).map((card) => (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={card.label}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{translateText(card.label)}</p>
              <div className="mt-2 text-sm font-semibold text-slate-900">{renderSummaryValue(card)}</div>
            </div>
          ))}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-600">
            {translateText("Cau hinh duoc luu truc tiep vao he thong, co ghi lich su thao tac khi cap nhat va co the ap dung theo tung chi nhanh.")}
          </div>
        </aside>
      ) : null}

      <form
        className={compact ? "space-y-5" : "card space-y-5 p-5"}
        onSubmit={form.handleSubmit(async (values) => {
          await mutation.mutateAsync(values);
        })}
      >
        {settingBaseKey.startsWith("social-") ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-900">
            <div className="font-semibold">{translateText("Che do cau hinh gon cho van hanh")}</div>
            <div className="mt-1 text-emerald-800">
              {translateText("He thong se tu sinh webhook URL, ma xac minh va cac thong so ky thuat noi bo. Nguoi dung van hanh chi can cap nhat user, so dien thoai, ma OA hoac mat khau / ma ket noi o cac truong co ban ben duoi.")}
            </div>
            <div className="mt-1 text-emerald-700">
              {translateText("Neu kenh can them App Secret hoac ma page chinh chu de ket noi production, ky thuat vien co the mo muc Nang cao de bo sung sau.")}
            </div>
          </div>
        ) : null}

        {hasAdvancedFields ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] text-slate-600">
            <div>
              <div className="font-semibold text-slate-900">{translateText("Cau hinh nang cao")}</div>
              <div className="mt-1">
                {translateText("Chi can mo khi ky thuat vien can doi token, webhook, API secret hoac cac ma ket noi dac thu.")}
              </div>
            </div>
            <button
              className="secondary-button shrink-0"
              onClick={() => setShowAdvanced((current) => !current)}
              type="button"
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAdvanced ? translateText("An nang cao") : translateText("Hien nang cao")}
            </button>
          </div>
        ) : null}

        {Object.entries(sections).map(([sectionName, fields]) => (
          <section className="space-y-3" key={sectionName}>
            <div className="border-b border-slate-200 pb-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText(sectionName)}</p>
            </div>

            {usesStoredPrinterMode && sectionName === "Thong so in" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
                <div className="font-semibold">
                  {translateText("Che do may in nay hien chi luu cau hinh, chua the tu dong doi Destination trong hop thoai in cua trinh duyet.")}
                </div>
                <div className="mt-1 text-amber-800">
                  {translateText(
                    watchedPrinterMode === "SYSTEM_NAME"
                      ? `May in dang chon: ${watchedPrinterName || "Chua chon may in"}. Khi bam In, Chrome / Edge van co the hien Save as PDF hoac may in cuoi cung da chon.`
                      : "Che do may in IP / Network hien dang duoc luu de danh dau cau hinh, nhung web app chua gui lenh in truc tiep den dia chi may in nay.",
                  )}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              {fields.filter((field) => {
                if (settingBaseKey !== "print-templates") {
                  return true;
                }

                if (field.name === "defaultPrinterName") {
                  return watchedPrinterMode !== "NETWORK_IP";
                }

                if (["printerIpAddress", "printerPort", "printerProtocol"].includes(field.name)) {
                  return watchedPrinterMode === "NETWORK_IP";
                }

                if (["printerQueueName", "printerDriverHint"].includes(field.name)) {
                  return false;
                }

                return true;
              }).map((field) => {
                const optionsQuery = optionsQueries[localizedSetting.fields.findIndex((item) => item.name === field.name)];
                const options =
                  field.options ||
                  (Array.isArray(optionsQuery.data)
                    ? optionsQuery.data.map((item: Record<string, unknown>) => ({
                        label: resolveTextDisplay(item[field.optionLabelKey || "name"] || item.name || item.code || item.title, field.name, item),
                        value: String(item[field.optionValueKey || "id"] || item.id || item.code),
                      }))
                    : []);

                const error = form.formState.errors[field.name]?.message?.toString();
                const spanClass =
                  settingBaseKey === "print-templates" && ["printerMode", "defaultPrinterName", "paperSize", "printerIpAddress"].includes(field.name)
                    ? "md:col-span-2"
                    : field.span === 2
                      ? "md:col-span-2"
                      : field.span === 3
                        ? "md:col-span-2"
                        : "";
                const inputType =
                  field.type === "number" || field.type === "currency"
                    ? "number"
                    : field.type === "email"
                      ? "email"
                      : field.type === "phone"
                        ? "tel"
                        : field.type === "date"
                          ? "date"
                          : field.type === "password"
                            ? "password"
                            : "text";

                return (
                  <label className={`field ${spanClass}`} key={field.name}>
                    <span>{translateText(field.label)}</span>
                    {field.type === "textarea" ? (
                      <textarea {...form.register(field.name)} disabled={field.readOnly} placeholder={translateText(field.placeholder || field.description || "")} />
                    ) : field.type === "select" ? (
                      <select {...form.register(field.name)} disabled={field.readOnly}>
                        <option value="">{translateText("Select")}</option>
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {translateText(option.label)}
                          </option>
                        ))}
                      </select>
                    ) : settingBaseKey === "print-templates" && field.name === "defaultPrinterName" ? (
                      options.length ? (
                        <select {...form.register(field.name)} disabled={field.readOnly}>
                          <option value="">{translateText("Chon may in he thong")}</option>
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {translateText(option.label)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          {...form.register(field.name)}
                          disabled={field.readOnly}
                          placeholder={translateText("Khong doc duoc danh sach may in he thong tren may nay. Co the nhap tay neu can.")}
                          type="text"
                        />
                      )
                    ) : settingBaseKey === "print-templates" && field.name === "paperSize" ? (
                      Array.isArray(printerPaperSizesQuery.data) && printerPaperSizesQuery.data.length ? (
                        <select {...form.register(field.name)} disabled={field.readOnly}>
                          {printerPaperSizesQuery.data.map((option: Record<string, unknown>) => {
                            const value = String(option.name || option.displayName || "");
                            const label = String(option.displayName || option.name || value);
                            return (
                              <option key={value} value={value}>
                                {translateText(label)}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          {...form.register(field.name)}
                          disabled={field.readOnly}
                          placeholder={translateText(field.placeholder || field.description || "")}
                          type="text"
                        />
                      )
                    ) : field.name === "logoUrl" ? (
                      <div className="space-y-2">
                        <div className="flex flex-col gap-2 md:flex-row">
                          <input
                            {...form.register(field.name)}
                            disabled={field.readOnly}
                            placeholder={translateText(field.placeholder || field.description || "")}
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
                          {form.watch("logoUrl") ? (
                            <a
                              className="secondary-button shrink-0"
                              href={resolveAssetUrl(String(form.watch("logoUrl") || ""))}
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
                    ) : (
                      <input
                        {...form.register(field.name)}
                        disabled={field.readOnly}
                        placeholder={translateText(field.placeholder || field.description || "")}
                        step={field.type === "number" || field.type === "currency" ? "any" : undefined}
                        type={inputType}
                      />
                    )}
                    {field.description ? <small className="!text-slate-500">{translateText(field.description)}</small> : null}
                    {field.autoManaged ? <small className="!text-emerald-700">{translateText("He thong tu quan ly truong nay.")}</small> : null}
                    {field.name === "logoUrl" && logoUploadError ? <small>{logoUploadError}</small> : null}
                    {error ? <small>{error}</small> : null}
                  </label>
                );
              })}
            </div>
          </section>
        ))}

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="text-[12px] text-slate-500">{query.isFetching ? translateText("Dang dong bo cau hinh...") : translateText("San sang luu thay doi")}</div>
          <div className="flex items-center gap-2">
            {canPreview ? (
              <button className="secondary-button" onClick={handlePrintPreview} type="button">
                <Printer className="h-4 w-4" />
                {translateText("In xem truoc")}
              </button>
            ) : null}
            <button className="primary-button" disabled={mutation.isPending} type="submit">
              {mutation.isPending ? translateText("Dang luu...") : translateText("Luu cau hinh")}
            </button>
          </div>
        </div>

        {mutationError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700">{mutationError}</div>
        ) : null}
      </form>
    </div>
  );
}

function BirthdayTemplateWorkspace({ setting }: { setting: SettingDefinition }) {
  const { locale } = useLocale();
  const localizedSetting = useMemo(() => localizeSettingDefinition(setting), [locale, setting]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const createLabel = localizedSetting.createLabel || translateText("Them mau");

  const query = useQuery({
    queryKey: ["setting", localizedSetting.key, search],
    queryFn: async () => {
      const response = await api.get(localizedSetting.endpoint, { params: { pageSize: 100, search } });
      return response.data;
    },
  });

  const rows = query.data?.data || [];

  return (
    <div className="settings-workspace space-y-4">
      <PageHeader
        title={localizedSetting.title}
        subtitle={localizedSetting.subtitle}
        actions={
          <button className="primary-button" onClick={() => setCreating(true)} type="button">
            <Plus className="h-4 w-4" />
            {createLabel}
          </button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="card space-y-3 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText("Template stats")}</p>
            <h3 className="mt-1 text-[13px] font-bold text-slate-900">{`${rows.length} ${translateText("mau dang co")}`}</h3>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-600">
            {translateText("Quan ly ten mau, kenh gui, pham vi chi nhanh, doi tuong ap dung va so ngay nhac cho thu vien template hien tai.")}
          </div>
          {localizedSetting.noticeTitle || localizedSetting.noticeDescription ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[12px] text-amber-900">
              {localizedSetting.noticeTitle ? <p className="font-semibold uppercase tracking-[0.18em]">{localizedSetting.noticeTitle}</p> : null}
              {localizedSetting.noticeDescription ? <p className={localizedSetting.noticeTitle ? "mt-2" : ""}>{localizedSetting.noticeDescription}</p> : null}
            </div>
          ) : null}
        </aside>

        <div className="space-y-4">
          <div className="card p-4">
            <SearchBar onChange={setSearch} placeholder={localizedSetting.searchPlaceholder} value={search} />
          </div>

          {rows.length ? (
            <div className="card overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-full text-[12px]">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">{translateText("Ten mau")}</th>
                      <th className="px-4 py-2.5">{translateText("Tieu de")}</th>
                      <th className="px-4 py-2.5">{translateText("Doi tuong")}</th>
                      <th className="px-4 py-2.5">{translateText("Kenh")}</th>
                      <th className="px-4 py-2.5">{translateText("Chi nhanh")}</th>
                      <th className="px-4 py-2.5">{translateText("Trang thai")}</th>
                      <th className="px-4 py-2.5">{translateText("Ngay nhac")}</th>
                      <th className="px-4 py-2.5">{translateText("Thao tac")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row: Record<string, unknown>) => (
                      <tr className="border-t border-slate-100 hover:bg-emerald-50/40" key={String(row.id)}>
                        <td className="px-4 py-2.5 font-medium text-slate-900">{String(row.name || "-")}</td>
                        <td className="px-4 py-2.5">{String(row.title || "-")}</td>
                        <td className="px-4 py-2.5">{resolveTextDisplay(row.targetType, "targetType", row)}</td>
                        <td className="px-4 py-2.5">{resolveTextDisplay(row.channel, "channel", row)}</td>
                        <td className="px-4 py-2.5">{resolveTextDisplay(row.branchName || "Toan he thong", "branchName", row)}</td>
                        <td className="px-4 py-2.5"><StatusBadge value={Boolean(row.isActive) ? "ACTIVE" : "INACTIVE"} /></td>
                        <td className="px-4 py-2.5">{String(row.remindDays || 0)}</td>
                        <td className="px-4 py-2.5">
                          <button className="secondary-button" onClick={() => setEditing(row)} type="button">
                            {translateText("Chinh sua")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              description={localizedSetting.emptyStateDescription || translateText("Chua co template nao phu hop voi bo loc hien tai.")}
              title={localizedSetting.emptyStateTitle || translateText("Khong co template")}
            />
          )}
        </div>
      </div>

      {creating ? (
        <LazyFormDialog
          definition={localizedSetting}
          endpoint={localizedSetting.endpoint}
          initialValues={null}
          onClose={() => setCreating(false)}
          open
          queryKey="setting"
          title={createLabel}
        />
      ) : null}

      {editing ? (
        <LazyFormDialog
          definition={localizedSetting}
          endpoint={localizedSetting.endpoint}
          initialValues={editing}
          onClose={() => setEditing(null)}
          open
          queryKey="setting"
          title={translateText("Cap nhat mau")}
        />
      ) : null}
    </div>
  );
}

function CommunicationWorkspace({ setting }: { setting: SettingDefinition }) {
  const { locale } = useLocale();
  const localizedSetting = useMemo(() => localizeSettingDefinition(setting), [locale, setting]);
  const channelSettings = [settingsRegistry.sms, settingsRegistry.email, settingsRegistry.zalo];
  const channelQueries = useQueries({
    queries: channelSettings.map((item) => ({
      queryKey: ["setting", item.key],
      queryFn: async () => {
        const response = await api.get(item.endpoint);
        return (response.data || {}) as Record<string, unknown>;
      },
    })),
  });

  const activeChannels = channelQueries.filter((query) => Boolean(query.data?.isActive)).length;
  const otpEnabled = Boolean(channelQueries[2]?.data?.otpEnabled);
  const branchScoped = channelQueries.filter((query) => Boolean(query.data?.branchId)).length;
  const latestUpdated = channelQueries
    .map((query) => String(query.data?.updatedAt || ""))
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <div className="settings-workspace space-y-4">
      <PageHeader title={localizedSetting.title} subtitle={localizedSetting.subtitle} />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Kenh dang bat")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{activeChannels}/3</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("OTP Zalo")}</p>
          <div className="mt-2"><StatusBadge value={otpEnabled ? "ACTIVE" : "INACTIVE"} /></div>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Cau hinh theo CN")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{branchScoped}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Cap nhat gan nhat")}</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{latestUpdated ? formatDateTime(latestUpdated) : "-"}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {channelSettings.map((channelSetting) => (
          <div key={channelSetting.key}>
            <SettingEditorPanel compact setting={channelSetting} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialWorkspace({ setting }: { setting: SettingDefinition }) {
  const { locale } = useLocale();
  const localizedSetting = useMemo(() => localizeSettingDefinition(setting), [locale, setting]);
  const connectorStatusQuery = useQuery({
    queryKey: ["social-connectors-status"],
    queryFn: async () => {
      const response = await api.get("/social/connectors/status");
      return (response.data || { providers: [] }) as {
        providers?: Array<Record<string, unknown>>;
      };
    },
  });
  const platformSettings = socialModuleCatalog.map((item) => settingsRegistry[item.settingKey]).filter(Boolean);
  const platformQueries = useQueries({
    queries: platformSettings.map((item) => ({
      queryKey: ["setting", item.key],
      queryFn: async () => {
        const response = await api.get(item.endpoint);
        return (response.data || {}) as Record<string, unknown>;
      },
    })),
  });
  const connectorStatusMap = new Map(
    (connectorStatusQuery.data?.providers || []).map((item) => [String(item.settingKey || ""), item] as const),
  );

  const modules = socialModuleCatalog.map((item, index) => {
    const data = platformQueries[index]?.data || {};
    const connectorStatus = connectorStatusMap.get(item.settingKey) || {};
    const accountLabel =
      String(data.accountLabel || data.pageName || data.username || data.accountId || data.pageId || "")
        .trim();
    return {
      ...item,
      isActive: Boolean(data.isActive),
      branchId: String(data.branchId || "").trim(),
      accountLabel,
      updatedAt: String(data.updatedAt || "").trim(),
      isReady: Boolean(connectorStatus.isReady),
      syncedConversations: Number(connectorStatus.syncedConversations || 0),
      syncedMessages: Number(connectorStatus.syncedMessages || 0),
      unreadConversations: Number(connectorStatus.unreadConversations || 0),
      failedWebhookEvents: Number(connectorStatus.failedWebhookEvents || 0),
      lastWebhookAt: String(connectorStatus.lastWebhookAt || "").trim(),
      webhookUrl: String(connectorStatus.webhookUrl || "").trim(),
      missingFields: Array.isArray(connectorStatus.missingFields)
        ? connectorStatus.missingFields.map((field) => formatSocialMissingField(String(field)))
        : [],
    };
  });

  const activeModules = modules.filter((item) => item.isActive).length;
  const readyModules = modules.filter((item) => item.isReady).length;
  const syncedConversations = modules.reduce((total, item) => total + item.syncedConversations, 0);
  const failedWebhookEvents = modules.reduce((total, item) => total + item.failedWebhookEvents, 0);
  const latestUpdated = modules
    .flatMap((item) => [item.updatedAt, item.lastWebhookAt])
    .filter(Boolean)
    .sort()
    .at(-1);
  const visibleSocialCategories = (["social-network", "messaging"] as const).filter((category) =>
    modules.some((item) => item.category === category),
  );
  const operationalLinks = [
    {
      href: socialLinkCenterPath,
      title: "Lien ket thiet bi",
      description: "Tao phien lien ket tu PC bridge, QR / deeplink mobile va browser extension de tan dung tai khoan dang login san.",
      eyebrow: "Link center",
    },
    {
      href: socialInboxPath,
      title: "Trung tam hoi thoai",
      description: "Hang doi lead / chat, SLA, nguoi phu trach va noi dung tuong tac gan nhat.",
      eyebrow: "Van hanh",
    },
    {
      href: socialPerformancePath,
      title: "Hieu suat kenh",
      description: "So luong hoi thoai, toc do phan hoi, lead chuyen doi va doanh thu ho tro theo tung kenh.",
      eyebrow: "Bao cao nhanh",
    },
    {
      href: "/reports/follow-up",
      title: "Follow-up / lich hen",
      description: "Cong viec qua han, lich hen sap toi va nhac viec xu ly lead.",
      eyebrow: "CSKH",
    },
    {
      href: "/members/leads",
      title: "Ho so lead",
      description: "Mo danh sach lead de cap nhat thong tin, trang thai va lich su cham soc chi tiet.",
      eyebrow: "CRM",
    },
  ];

  return (
    <div className="settings-workspace space-y-4">
      <PageHeader title={localizedSetting.title} subtitle={localizedSetting.subtitle} />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Module dang bat")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {activeModules}/{modules.length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Connector san sang")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {readyModules}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {translateText("Kenh dang bat")}: {activeModules}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Hoi thoai da sync")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {syncedConversations}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {translateText("Webhook loi")}: {failedWebhookEvents}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Webhook / cap nhat gan nhat")}</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{latestUpdated ? formatDateTime(latestUpdated) : "-"}</p>
          <p className="mt-1 text-xs text-slate-500">{translateText("Theo doi ca webhook that va cau hinh kenh trong cung mot hub.")}</p>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{translateText("Loi tat van hanh")}</h2>
          <p className="text-xs text-slate-500">{translateText("Di nhanh tu cau hinh kenh sang man hinh xu ly hoi thoai va bao cao lien quan.")}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {operationalLinks.map((item) => (
            <Link
              className="card block rounded-[1rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(255,255,255,0.95))] p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
              href={item.href}
              key={item.href}
              scroll={false}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{translateText(item.eyebrow)}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{translateText(item.title)}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{translateText(item.description)}</p>
              <div className="mt-4 text-xs font-medium text-emerald-700">{translateText("Mo man hinh")} {"->"}</div>
            </Link>
          ))}
        </div>
      </section>

      <div className="space-y-5">
        {visibleSocialCategories.map((category) => {
          const categoryModules = modules.filter((item) => item.category === category);
          return (
            <section className="space-y-3" key={category}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{socialCategoryLabels[category]}</h2>
                  <p className="text-xs text-slate-500">
                    {translateText("Tong so module")}: {categoryModules.length}
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  {translateText("Dang bat")}: {categoryModules.filter((item) => item.isActive).length}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {categoryModules.map((item) => (
                  <Link
                    className="card block rounded-[1rem] border border-slate-200 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
                    href={`/social/${item.slug}`}
                    key={item.settingKey}
                    scroll={false}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{item.subtitle}</p>
                      </div>
                      <StatusBadge value={item.isActive ? "ACTIVE" : "INACTIVE"} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.capabilities.map((capability) => (
                        <span
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                          key={capability}
                        >
                          {capability}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span>{translateText("Kenh / profile")}</span>
                        <span className="max-w-[58%] truncate text-right font-medium text-slate-900">
                          {item.accountLabel || "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{translateText("Pham vi")}</span>
                        <span className="font-medium text-slate-900">
                          {item.branchId ? translateText("Theo chi nhanh") : translateText("Toan he thong")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{translateText("Tinh trang connector")}</span>
                        <span className="font-medium text-slate-900">
                          {item.isReady ? translateText("San sang") : translateText("Chua day du")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{translateText("Hoi thoai / tin nhan")}</span>
                        <span className="font-medium text-slate-900">
                          {item.syncedConversations}/{item.syncedMessages}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{translateText("Chua doc / webhook loi")}</span>
                        <span className="font-medium text-slate-900">
                          {item.unreadConversations}/{item.failedWebhookEvents}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>{translateText("Webhook / cap nhat")}</span>
                        <span className="font-medium text-slate-900">
                          {item.lastWebhookAt ? formatDateTime(item.lastWebhookAt) : item.updatedAt ? formatDateTime(item.updatedAt) : "-"}
                        </span>
                      </div>
                    </div>

                    {item.missingFields.length ? (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                        {translateText("Thieu truong")}: {item.missingFields.slice(0, 3).join(", ")}
                      </div>
                    ) : null}

                    {item.webhookUrl ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
                        <span className="font-semibold text-slate-900">{translateText("Webhook")}: </span>
                        <span className="break-all">{item.webhookUrl}</span>
                      </div>
                    ) : null}

                    <div className="mt-4 text-xs font-medium text-emerald-700">{translateText("Mo cau hinh")} {"->"}</div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsWorkspace({ setting }: { setting: SettingDefinition }) {
  const { locale } = useLocale();
  const { user, isReady } = useAuth();
  const localizedSetting = useMemo(() => localizeSettingDefinition(setting), [locale, setting]);
  const canViewSettings = user?.permissions.includes("settings.view");
  const isSystemOwner = Boolean(user?.roleCodes.includes("system_owner"));

  if (!isReady) {
    return <div className="card h-56 animate-pulse bg-slate-100" />;
  }

  if (!canViewSettings) {
    return (
      <EmptyState
        description={translateText("Vai tro hien tai chua duoc cap quyen cho khu thiet lap nay. Hay mo Vai tro va bat quyen settings truoc khi truy cap.")}
        title={translateText("Khong co quyen xem thiet lap")}
      />
    );
  }

  if (localizedSetting.ownerOnly && !isSystemOwner) {
    return (
      <EmptyState
        description={translateText("Chi chu he thong moi duoc cap nhat module nhan dien chuong trinh nay.")}
        title={translateText("Khong co quyen truy cap module")}
      />
    );
  }

  if (localizedSetting.layout === "report-template-manager" || localizedSetting.key === "report-templates" || localizedSetting.baseKey === "report-templates") {
    return <LazyReportTemplateWorkspace setting={localizedSetting} />;
  }

  if (localizedSetting.layout === "template" || localizedSetting.key === "birthday-template" || localizedSetting.baseKey === "birthday-template") {
    return <BirthdayTemplateWorkspace setting={localizedSetting} />;
  }

  if (localizedSetting.layout === "communication" || localizedSetting.key === "communication" || localizedSetting.baseKey === "communication") {
    return <CommunicationWorkspace setting={localizedSetting} />;
  }

  if (localizedSetting.layout === "social-hub" || localizedSetting.key === "social-hub" || localizedSetting.baseKey === "social-hub") {
    return <SocialWorkspace setting={localizedSetting} />;
  }

  if (localizedSetting.layout === "social-link-center" || localizedSetting.key === "social-link-center" || localizedSetting.baseKey === "social-link-center") {
    return <SocialLinkCenterWorkspace setting={localizedSetting} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title={localizedSetting.title} subtitle={localizedSetting.subtitle} />
      <SettingEditorPanel setting={localizedSetting} />
    </div>
  );
}
