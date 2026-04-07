"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatDateTime } from "@/lib/format";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";
import { localizeSettingDefinition } from "@/lib/i18n/portal";
import { useLocale } from "@/lib/i18n/provider";
import type { AppLocale } from "@/lib/i18n/runtime";
import { settingsRegistry } from "@/lib/module-config";
import { printSettingPreview } from "@/lib/print";
import { SettingDefinition } from "@/types/portal";
import { EmptyState } from "../feedback/empty-state";
import { FormDialog } from "../forms/form-dialog";
import { PageHeader } from "../layout/page-header";
import { ReportTemplateWorkspace } from "./report-template-workspace";
import { StatusBadge } from "../shared/status-badge";
import { SearchBar } from "../table/search-bar";

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
  const queryClient = useQueryClient();
  const schema = useMemo(() => buildSchema(localizedSetting), [localizedSetting]);
  const sections = useMemo(() => getFieldSections(localizedSetting), [localizedSetting]);
  const canPreview = canPrintSettingPreview(localizedSetting);

  const form = useForm<SettingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(localizedSetting, null, locale),
  });
  const watchedBranchId = localizedSetting.fields.some((field) => field.name === "branchId") ? form.watch("branchId") : "";

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

  const mutation = useMutation({
    mutationFn: async (values: SettingFormValues) => {
      const payload = Object.fromEntries(
        localizedSetting.fields.flatMap((field) => {
          const transformed = transformValue(toSettingStoredValue(localizedSetting, field.name, values[field.name], locale), field.type);
          return transformed === undefined ? [] : [[field.name, transformed]];
        }),
      );

      return api.patch(localizedSetting.endpoint, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["setting", localizedSetting.key] });
    },
  });

  const mutationError =
    mutation.error && typeof mutation.error === "object" && "response" in mutation.error
      ? String((mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message || translateText("Save failed"))
      : null;

  const handlePrintPreview = () => {
    const values = form.getValues();
    const previewSections = Object.entries(sections).map(([sectionName, fields]) => ({
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
    <div className={compact ? "card p-5" : "grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]"}>
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
        {Object.entries(sections).map(([sectionName, fields]) => (
          <section className="space-y-3" key={sectionName}>
            <div className="border-b border-slate-200 pb-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText(sectionName)}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {fields.map((field) => {
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
                const spanClass = field.span === 2 ? "md:col-span-2" : field.span === 3 ? "md:col-span-2" : "";
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
                      <textarea {...form.register(field.name)} placeholder={translateText(field.placeholder || field.description || "")} />
                    ) : field.type === "select" ? (
                      <select {...form.register(field.name)}>
                        <option value="">{translateText("Select")}</option>
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {translateText(option.label)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        {...form.register(field.name)}
                        placeholder={translateText(field.placeholder || field.description || "")}
                        step={field.type === "number" || field.type === "currency" ? "any" : undefined}
                        type={inputType}
                      />
                    )}
                    {field.description ? <small className="!text-slate-500">{translateText(field.description)}</small> : null}
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
    <div className="space-y-4">
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

      <FormDialog
        definition={localizedSetting}
        endpoint={localizedSetting.endpoint}
        initialValues={null}
        onClose={() => setCreating(false)}
        open={creating}
        queryKey="setting"
        title={createLabel}
      />

      <FormDialog
        definition={localizedSetting}
        endpoint={localizedSetting.endpoint}
        initialValues={editing}
        onClose={() => setEditing(null)}
        open={Boolean(editing)}
        queryKey="setting"
        title={translateText("Cap nhat mau")}
      />
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
    <div className="space-y-4">
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

export function SettingsWorkspace({ setting }: { setting: SettingDefinition }) {
  const { locale } = useLocale();
  const { user, isReady } = useAuth();
  const localizedSetting = useMemo(() => localizeSettingDefinition(setting), [locale, setting]);
  const canViewSettings = user?.permissions.includes("settings.view");

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

  if (localizedSetting.layout === "report-template-manager" || localizedSetting.key === "report-templates" || localizedSetting.baseKey === "report-templates") {
    return <ReportTemplateWorkspace setting={localizedSetting} />;
  }

  if (localizedSetting.layout === "template" || localizedSetting.key === "birthday-template" || localizedSetting.baseKey === "birthday-template") {
    return <BirthdayTemplateWorkspace setting={localizedSetting} />;
  }

  if (localizedSetting.layout === "communication" || localizedSetting.key === "communication" || localizedSetting.baseKey === "communication") {
    return <CommunicationWorkspace setting={localizedSetting} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader title={localizedSetting.title} subtitle={localizedSetting.subtitle} />
      <SettingEditorPanel setting={localizedSetting} />
    </div>
  );
}
