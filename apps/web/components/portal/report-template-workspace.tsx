"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, Plus, Printer, RefreshCw, Save, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { api, ListResponse } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { translateEnum, translateFieldLabel, translateText } from "@/lib/i18n/display";
import { localizeReportDefinition } from "@/lib/i18n/portal";
import { useLocale } from "@/lib/i18n/provider";
import { reportRegistry } from "@/lib/module-config";
import { printReportDocument } from "@/lib/print";
import { ReportDefinition, SettingDefinition } from "@/types/portal";
import { EmptyState } from "../feedback/empty-state";

type BoolValue = "true" | "false";
type BoolOverride = "inherit" | "true" | "false";
type TemplateCategory = "all" | "shared" | "attendance" | "finance" | "operations";

interface TemplateRow {
  key: string;
  title: string;
  description: string;
  typeLabel: string;
  fileLabel: string;
  category: TemplateCategory;
  isGlobal: boolean;
  report?: ReportDefinition;
}

interface GlobalForm {
  defaultTitle: string;
  defaultSubtitle: string;
  currencyScale: string;
  paperSize: string;
  defaultOrientation: string;
  reportHeader: string;
  reportFooter: string;
  showGeneratedBy: BoolValue;
  showPrintedAt: BoolValue;
  showFilters: BoolValue;
  showBranchSummary: BoolValue;
  showSignature: BoolValue;
  note: string;
}

interface ScopedForm {
  title: string;
  subtitle: string;
  header: string;
  footer: string;
  paperSize: string;
  orientation: "" | "PORTRAIT" | "LANDSCAPE";
  showGeneratedBy: BoolOverride;
  showPrintedAt: BoolOverride;
  showFilters: BoolOverride;
  showSignature: BoolOverride;
}

const defaultGlobal: GlobalForm = {
  defaultTitle: "Bao cao FitFlow",
  defaultSubtitle: "",
  currencyScale: "full",
  paperSize: "A4",
  defaultOrientation: "PORTRAIT",
  reportHeader: "",
  reportFooter: "",
  showGeneratedBy: "true",
  showPrintedAt: "true",
  showFilters: "true",
  showBranchSummary: "true",
  showSignature: "false",
  note: "",
};

const defaultScoped: ScopedForm = {
  title: "",
  subtitle: "",
  header: "",
  footer: "",
  paperSize: "",
  orientation: "",
  showGeneratedBy: "inherit",
  showPrintedAt: "inherit",
  showFilters: "inherit",
  showSignature: "inherit",
};

const paperSizes = ["", "A4", "A5", "Letter"];
const pageSizes = [15, 30, 50];
const categoryOptions: Array<{ label: string; value: TemplateCategory }> = [
  { label: "Tat ca", value: "all" },
  { label: "Mau chung", value: "shared" },
  { label: "Cham cong", value: "attendance" },
  { label: "Tai chinh", value: "finance" },
  { label: "Nghiep vu", value: "operations" },
];
const boolOptions = [
  { label: "Co", value: "true" },
  { label: "Khong", value: "false" },
] as const;
const boolOverrideOptions = [
  { label: "Mac dinh", value: "inherit" },
  { label: "Co", value: "true" },
  { label: "Khong", value: "false" },
] as const;
const orientationOptions = [
  { label: "Mac dinh", value: "" },
  { label: "Doc", value: "PORTRAIT" },
  { label: "Ngang", value: "LANDSCAPE" },
] as const;

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const bool = (v: unknown, fallback: boolean): BoolValue => (v === undefined || v === null ? (fallback ? "true" : "false") : v === true || v === "true" ? "true" : "false");
const boolOverride = (v: unknown): BoolOverride => (v === undefined || v === null ? "inherit" : v === true || v === "true" ? "true" : "false");

const buildGlobal = (src?: Record<string, unknown> | null): GlobalForm => ({
  defaultTitle: text(src?.defaultTitle) || defaultGlobal.defaultTitle,
  defaultSubtitle: text(src?.defaultSubtitle),
  currencyScale: text(src?.currencyScale) || defaultGlobal.currencyScale,
  paperSize: text(src?.paperSize) || defaultGlobal.paperSize,
  defaultOrientation: text(src?.defaultOrientation) || defaultGlobal.defaultOrientation,
  reportHeader: text(src?.reportHeader),
  reportFooter: text(src?.reportFooter),
  showGeneratedBy: bool(src?.showGeneratedBy, true),
  showPrintedAt: bool(src?.showPrintedAt, true),
  showFilters: bool(src?.showFilters, true),
  showBranchSummary: bool(src?.showBranchSummary, true),
  showSignature: bool(src?.showSignature, false),
  note: text(src?.note),
});

const buildScoped = (src?: unknown): ScopedForm => {
  const r = isRecord(src) ? src : {};
  return {
    title: text(r.title),
    subtitle: text(r.subtitle),
    header: text(r.header),
    footer: text(r.footer),
    paperSize: text(r.paperSize),
    orientation: text(r.orientation) === "LANDSCAPE" ? "LANDSCAPE" : text(r.orientation) === "PORTRAIT" ? "PORTRAIT" : "",
    showGeneratedBy: boolOverride(r.showGeneratedBy),
    showPrintedAt: boolOverride(r.showPrintedAt),
    showFilters: boolOverride(r.showFilters),
    showSignature: boolOverride(r.showSignature),
  };
};

const buildScopedMap = (src?: Record<string, unknown> | null) => {
  const raw = isRecord(src?.reportTemplates) ? src.reportTemplates : {};
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, buildScoped(v)])) as Record<string, ScopedForm>;
};

const normalizeGlobal = (form: GlobalForm) => ({
  defaultTitle: form.defaultTitle.trim() || defaultGlobal.defaultTitle,
  defaultSubtitle: form.defaultSubtitle.trim(),
  currencyScale: form.currencyScale.trim() || defaultGlobal.currencyScale,
  paperSize: form.paperSize.trim() || defaultGlobal.paperSize,
  defaultOrientation: form.defaultOrientation || defaultGlobal.defaultOrientation,
  reportHeader: form.reportHeader.trim(),
  reportFooter: form.reportFooter.trim(),
  showGeneratedBy: form.showGeneratedBy === "true",
  showPrintedAt: form.showPrintedAt === "true",
  showFilters: form.showFilters === "true",
  showBranchSummary: form.showBranchSummary === "true",
  showSignature: form.showSignature === "true",
  note: form.note.trim(),
});

const normalizeScoped = (form: ScopedForm) => {
  const payload: Record<string, unknown> = {};
  if (form.title.trim()) payload.title = form.title.trim();
  if (form.subtitle.trim()) payload.subtitle = form.subtitle.trim();
  if (form.header.trim()) payload.header = form.header.trim();
  if (form.footer.trim()) payload.footer = form.footer.trim();
  if (form.paperSize.trim()) payload.paperSize = form.paperSize.trim();
  if (form.orientation) payload.orientation = form.orientation;
  if (form.showGeneratedBy !== "inherit") payload.showGeneratedBy = form.showGeneratedBy === "true";
  if (form.showPrintedAt !== "inherit") payload.showPrintedAt = form.showPrintedAt === "true";
  if (form.showFilters !== "inherit") payload.showFilters = form.showFilters === "true";
  if (form.showSignature !== "inherit") payload.showSignature = form.showSignature === "true";
  return payload;
};

const toPayload = (globalForm: GlobalForm, scopedForms: Record<string, ScopedForm>) => ({
  ...normalizeGlobal(globalForm),
  reportTemplates: Object.fromEntries(
    Object.entries(scopedForms).flatMap(([k, v]) => {
      const normalized = normalizeScoped(v);
      return Object.keys(normalized).length ? [[k, normalized]] : [];
    }),
  ),
});

const countOverrides = (form: ScopedForm) => Object.keys(normalizeScoped(form)).length;
const getCategory = (report: ReportDefinition): TemplateCategory => (["staff-attendance", "class-attendance", "checkin", "allocation", "pt-training"].includes(report.key) ? "attendance" : ["debt", "payment", "deposit", "contract-remain", "card-revenue", "sales-summary", "kpi"].includes(report.key) ? "finance" : "operations");
const getTypeLabel = (category: TemplateCategory) => (category === "shared" ? "Mau chung" : category === "attendance" ? "Cham cong" : category === "finance" ? "Tai chinh" : "Nghiep vu");
const previewRowsFor = (report: ReportDefinition) =>
  report.key === "staff-attendance"
    ? [
        { staffCode: "NV001", staffName: "Nguyễn Văn An", attendanceCode: "CC240401", attendanceDate: "2026-04-01", workedHours: 8, lateMinutes: 0, attendanceStatus: "PRESENT" },
        { staffCode: "NV018", staffName: "Trần Thị Bình", attendanceCode: "CC240402", attendanceDate: "2026-04-02", workedHours: 7.5, lateMinutes: 15, attendanceStatus: "LATE" },
      ]
    : report.key === "debt"
      ? [
          { customerName: "Nguyễn Anh Thư", contractCode: "HD-240118", totalAmount: 18500000, amountPaid: 12000000, outstandingDebt: 6500000, paymentStatus: "PARTIAL" },
          { customerName: "Phạm Minh Hoàng", contractCode: "HD-240126", totalAmount: 12900000, amountPaid: 7900000, outstandingDebt: 5000000, paymentStatus: "PARTIAL" },
        ]
      : [
          { memberName: "Trần Gia Linh", branchName: "Chi nhánh Trung tâm", firstCheckInAt: "2026-04-01T06:15:00.000Z", verificationMethods: "QR", membershipStatus: "ACTIVE" },
          { memberName: "Phạm Hữu Đức", branchName: "Chi nhánh Phú Nhuận", firstCheckInAt: "2026-04-01T08:45:00.000Z", verificationMethods: "FaceID", membershipStatus: "ACTIVE" },
        ];
const previewSummaryFor = (report: ReportDefinition) =>
  report.key === "staff-attendance"
    ? [{ label: "Tong gio lam", value: 168 }, { label: "So lan di muon", value: 3 }, { label: "So nhan vien", value: 24 }]
    : report.key === "debt"
      ? [{ label: "Tong cong no", value: 48500000 }, { label: "Da thanh toan", value: 31500000 }, { label: "Con phai thu", value: 17000000 }]
      : report.summaryKeys.slice(0, 3).map((item, index) => ({ label: item.label, value: (index + 2) * 1250000 }));
const isCurrency = (key: string) => ["amount", "debt", "revenue", "profit", "value", "total"].some((token) => key.toLowerCase().includes(token));
const formatPreview = (key: string, value: unknown) => (value === null || value === undefined || value === "" ? "-" : typeof value === "number" && isCurrency(key) ? formatCurrency(value) : typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) ? formatDateTime(value) : typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : String(value));

export function ReportTemplateWorkspace({ setting }: { setting: SettingDefinition }) {
  const { locale } = useLocale();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [scopeBranchId, setScopeBranchId] = useState("");
  const [pageSize, setPageSize] = useState(pageSizes[0]);
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory>("all");
  const [selectedRowKey, setSelectedRowKey] = useState("__global__");
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [globalForm, setGlobalForm] = useState<GlobalForm>(defaultGlobal);
  const [scopedForms, setScopedForms] = useState<Record<string, ScopedForm>>({});
  const [draftGlobal, setDraftGlobal] = useState<GlobalForm>(defaultGlobal);
  const [draftScoped, setDraftScoped] = useState<ScopedForm>(defaultScoped);

  const inputClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] outline-none transition focus:border-emerald-400";
  const textareaClass = "min-h-[84px] w-full rounded-md border border-slate-200 px-3 py-2 text-[12px] outline-none transition focus:border-emerald-400";
  const sharedTemplateLabel = translateText("Mau chung");
  const customTemplateLabel = translateText("Tuy chinh rieng");
  const inheritedTemplateLabel = translateText("Ke thua mac dinh");
  const systemTemplateLabel = translateText("Mac dinh he thong");
  const reportCatalog = useMemo(
    () =>
      Object.values(reportRegistry)
        .map((item) => localizeReportDefinition(item))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [locale],
  );

  const branchesQuery = useQuery({
    queryKey: ["setting-report-template-branches"],
    queryFn: async () => (await api.get<ListResponse<Record<string, unknown>>>("/branches", { params: { pageSize: 100 } })).data.data,
  });

  const settingQuery = useQuery({
    queryKey: ["setting", "report-templates", scopeBranchId || ""],
    queryFn: async () => (await api.get<Record<string, unknown>>(setting.endpoint, { params: scopeBranchId ? { branchId: scopeBranchId } : undefined })).data,
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!settingQuery.data) return;
    const nextGlobal = buildGlobal(settingQuery.data);
    setGlobalForm(nextGlobal);
    setScopedForms(buildScopedMap(settingQuery.data));
    setDraftGlobal(nextGlobal);
    setDraftScoped(defaultScoped);
  }, [settingQuery.data]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const branchLabel = (branchesQuery.data || []).find((branch) => String(branch.id) === scopeBranchId)?.name?.toString() || (scopeBranchId ? scopeBranchId : translateText("Toan he thong"));
  const rows = useMemo<TemplateRow[]>(
    () => [
      {
        key: "__global__",
        title: translateText("Mau mac dinh toan he thong"),
        description: translateText("Tieu de, kho giay, header va footer dung chung cho toan bo bao cao."),
        typeLabel: sharedTemplateLabel,
        fileLabel: systemTemplateLabel,
        category: "shared",
        isGlobal: true,
      },
      ...reportCatalog.map((report) => ({
        key: report.key,
        title: report.title,
        description: report.subtitle,
        typeLabel: translateText(getTypeLabel(getCategory(report))),
        fileLabel: countOverrides(scopedForms[report.key] || defaultScoped) ? customTemplateLabel : inheritedTemplateLabel,
        category: getCategory(report),
        isGlobal: false,
        report,
      })),
    ],
    [customTemplateLabel, inheritedTemplateLabel, reportCatalog, scopedForms, sharedTemplateLabel, systemTemplateLabel],
  );
  const filteredRows = useMemo(() => rows.filter((row) => (categoryFilter === "all" || row.category === categoryFilter) && (!search.trim() || `${row.title} ${row.description} ${row.typeLabel}`.toLowerCase().includes(search.trim().toLowerCase()))), [categoryFilter, rows, search]);

  const currentPage = 1;

  const mutation = useMutation({
    mutationFn: async (payload: { nextGlobal: GlobalForm; nextScoped: Record<string, ScopedForm> }) => api.patch(setting.endpoint, { ...(scopeBranchId ? { branchId: scopeBranchId } : {}), ...toPayload(payload.nextGlobal, payload.nextScoped) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["setting", "report-templates"] });
      toast.success(translateText("Da luu cau hinh xuat bao cao."));
    },
    onError: () => toast.error(translateText("Khong luu duoc cau hinh xuat bao cao.")),
  });

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, pageCount);
  const paginatedRows = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const resolvedSelectedRowKey = filteredRows.some((row) => row.key === selectedRowKey) ? selectedRowKey : filteredRows[0]?.key || "";
  const selectedRow = rows.find((row) => row.key === resolvedSelectedRowKey) || rows[0] || null;
  const editingRow = rows.find((row) => row.key === editingRowKey) || null;
  const previewReport = (editingRow || selectedRow)?.isGlobal ? reportCatalog.find((item) => item.key === "staff-attendance") || reportCatalog[0] || null : (editingRow || selectedRow)?.report || null;
  const previewRows = previewReport ? previewRowsFor(previewReport) : [];
  const previewMeta = previewReport ? previewSummaryFor(previewReport) : [];
  const previewFilters = [{ label: translateText("Chi nhanh"), value: branchLabel }, { label: translateText("Ky bao cao"), value: "01/04/2026 - 30/04/2026" }];
  const previewGlobal = editingRow?.isGlobal ? draftGlobal : globalForm;
  const previewScoped = editingRow && !editingRow.isGlobal ? draftScoped : (editingRow || selectedRow) && !(editingRow || selectedRow)?.isGlobal ? scopedForms[(editingRow || selectedRow)!.key] || defaultScoped : defaultScoped;
  const effective = useMemo(() => {
    const globalPayload = normalizeGlobal(previewGlobal);
    const scopedPayload = normalizeScoped(previewScoped);
    return { title: String(scopedPayload.title ?? globalPayload.defaultTitle ?? previewReport?.title ?? ""), subtitle: String(scopedPayload.subtitle ?? globalPayload.defaultSubtitle ?? previewReport?.subtitle ?? ""), header: String(scopedPayload.header ?? globalPayload.reportHeader ?? ""), footer: String(scopedPayload.footer ?? globalPayload.reportFooter ?? ""), paperSize: String(scopedPayload.paperSize ?? globalPayload.paperSize ?? "A4"), orientation: String(scopedPayload.orientation ?? globalPayload.defaultOrientation ?? "PORTRAIT"), showFilters: Boolean(scopedPayload.showFilters ?? globalPayload.showFilters), showSignature: Boolean(scopedPayload.showSignature ?? globalPayload.showSignature) };
  }, [previewGlobal, previewReport, previewScoped]);

  const openEditor = (rowKey: string) => {
    const row = rows.find((item) => item.key === rowKey);
    if (!row) return;
    setSelectedRowKey(row.key);
    setEditingRowKey(row.key);
    setDraftGlobal(globalForm);
    setDraftScoped(row.isGlobal ? defaultScoped : scopedForms[row.key] || defaultScoped);
    setIsModalOpen(true);
    setIsMenuOpen(false);
  };

  const closeEditor = () => {
    setIsModalOpen(false);
    setEditingRowKey(null);
    setDraftGlobal(globalForm);
    setDraftScoped(defaultScoped);
  };

  const save = async () => {
    if (!editingRow) return;
    if (editingRow.isGlobal) {
      await mutation.mutateAsync({ nextGlobal: draftGlobal, nextScoped: scopedForms });
      setGlobalForm(draftGlobal);
    } else {
      const nextScoped = { ...scopedForms };
      if (countOverrides(draftScoped)) nextScoped[editingRow.key] = draftScoped;
      else delete nextScoped[editingRow.key];
      await mutation.mutateAsync({ nextGlobal: globalForm, nextScoped });
      setScopedForms(nextScoped);
    }
    setIsModalOpen(false);
    setEditingRowKey(null);
  };

  const reload = async () => {
    const result = await settingQuery.refetch();
    if (!result.data) return void toast.error(translateText("Khong tai lai duoc cau hinh xuat bao cao tu API."));
    const nextGlobal = buildGlobal(result.data);
    setGlobalForm(nextGlobal);
    setScopedForms(buildScopedMap(result.data));
    setDraftGlobal(nextGlobal);
    setDraftScoped(defaultScoped);
    setIsMenuOpen(false);
    toast.success(translateText("Da tai lai du lieu cau hinh xuat bao cao."));
  };

  const printPreview = () => {
    if (!previewReport) return void toast.error(translateText("Chua co bao cao de in xem truoc."));
    const template = editingRow ? toPayload(editingRow.isGlobal ? draftGlobal : globalForm, editingRow.isGlobal ? {} : { [previewReport.key]: draftScoped }) : toPayload(globalForm, selectedRow && !selectedRow.isGlobal ? { [previewReport.key]: scopedForms[selectedRow.key] || defaultScoped } : {});
    printReportDocument({ reportKey: previewReport.key, title: effective.title || previewReport.title, subtitle: effective.subtitle || previewReport.subtitle, summary: previewMeta, filters: previewFilters, rows: previewRows, columns: Object.keys(previewRows[0] || {}), template, generatedBy: translateText("He thong xem truoc") });
    setIsMenuOpen(false);
  };

  if (settingQuery.isLoading) return <div className="h-64 animate-pulse rounded-md border-[5px] border-emerald-500 bg-slate-100" />;
  if (settingQuery.isError) {
    return <EmptyState title={translateText("Cau hinh xuat bao cao gap loi")} description={translateText("Khong tai duoc cau hinh xuat bao cao tu API.")} />;
  }

  return (
    <>
      <div className="rounded-md border-[5px] border-emerald-500 bg-[#f5f5f5] p-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        <div className="grid gap-3 xl:grid-cols-[168px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="flex items-start justify-between px-2 pt-1">
              <h1 className="max-w-[140px] text-[16px] font-semibold leading-6 text-slate-900">{translateText("Mau xuat bao cao")}</h1>
              <button className="rounded-sm p-1 text-emerald-700" type="button">
                <Menu className="h-4 w-4" />
              </button>
            </div>

            <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-slate-900">{translateText("Loai mau")}</p>
                <Menu className="h-4 w-4 text-slate-400" />
              </div>
              <div className="space-y-2 text-[12px] text-slate-700">
                {categoryOptions.map((option) => (
                  <label className="flex items-center gap-2" key={option.value}>
                    <input checked={categoryFilter === option.value} name="template-category" onChange={() => setCategoryFilter(option.value)} type="radio" />
                    <span>{translateText(option.label)}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[12px] font-semibold text-slate-900">{translateText("Pham vi ap dung")}</p>
                <Menu className="h-4 w-4 text-slate-400" />
              </div>
              <select className={inputClass} onChange={(event) => setScopeBranchId(event.target.value)} value={scopeBranchId}>
                <option value="">{translateText("Toan he thong")}</option>
                {(branchesQuery.data || []).map((branch) => (
                  <option key={String(branch.id)} value={String(branch.id)}>
                    {String(branch.name || branch.code || branch.id)}
                  </option>
                ))}
              </select>
            </section>

            <div className="px-2 pt-1">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="font-semibold text-slate-700">{translateText("So ban ghi")}:</span>
                <select className="h-8 rounded-md border border-transparent bg-transparent pr-5 text-right text-[12px] outline-none" onChange={(event) => setPageSize(Number(event.target.value))} value={pageSize}>
                  {pageSizes.map((option) => (
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
                <input className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-emerald-400" onChange={(event) => setSearch(event.target.value)} placeholder={translateText("Theo ma, ten bao cao...")} value={search} />
              </div>

              <div className="ml-auto flex items-center gap-2">
                <div className="rounded-md bg-white px-3 py-2 text-[12px] text-slate-600">
                  {formatNumber(reportCatalog.length)} {translateText("Bao cao")} / {formatNumber(Object.values(scopedForms).filter((form) => countOverrides(form) > 0).length)} {customTemplateLabel}
                </div>
                <button className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-[12px] font-semibold text-white transition hover:bg-emerald-700" onClick={() => openEditor(resolvedSelectedRowKey === "__global__" ? rows[1]?.key || "__global__" : resolvedSelectedRowKey)} type="button">
                  <Plus className="h-4 w-4" />
                  {translateText("Them tuy chinh")}
                </button>
                <div className="relative">
                  <button className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-600 text-white transition hover:bg-emerald-700" onClick={() => setIsMenuOpen((current) => !current)} type="button">
                    <Menu className="h-4 w-4" />
                  </button>
                  {isMenuOpen ? (
                    <div className="absolute right-0 top-12 z-20 min-w-[180px] rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                      <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50" onClick={() => void reload()} type="button">
                        <RefreshCw className="h-4 w-4" />
                        {translateText("Tai lai")}
                      </button>
                      <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50" onClick={printPreview} type="button">
                        <Printer className="h-4 w-4" />
                        {translateText("In xem truoc")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <div className="overflow-auto">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-sky-50 text-left text-slate-600">
                    <tr>
                      <th className="w-12 px-3 py-2.5 text-center font-semibold">
                        <input type="checkbox" />
                      </th>
                      <th className="px-3 py-2.5 font-semibold">{translateText("Ten mau")}</th>
                      <th className="px-3 py-2.5 font-semibold">{translateText("Loai mau")}</th>
                      <th className="px-3 py-2.5 font-semibold">{translateText("Nguon cau hinh")}</th>
                      <th className="px-3 py-2.5 font-semibold">{translateText("Mo ta")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? (
                      paginatedRows.map((row) => (
                        <tr className={`cursor-pointer border-t border-slate-100 transition hover:bg-emerald-50/35 ${resolvedSelectedRowKey === row.key ? "bg-emerald-50/40" : ""}`} key={row.key} onClick={() => openEditor(row.key)}>
                          <td className="px-3 py-2.5 text-center">
                            <input checked={resolvedSelectedRowKey === row.key} onChange={() => setSelectedRowKey(row.key)} type="checkbox" />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800">{row.title}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-700">{row.typeLabel}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${row.fileLabel === customTemplateLabel ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{row.fileLabel}</span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{row.description}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-3 py-8 text-center text-[12px] text-slate-500" colSpan={5}>
                          {translateText("Khong co ban ghi phu hop")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                <div>{`${filteredRows.length ? (safePage - 1) * pageSize + 1 : 0} - ${filteredRows.length ? Math.min(filteredRows.length, safePage * pageSize) : 0} / ${filteredRows.length}`}</div>
                <div>{scopeBranchId ? branchLabel : translateText("Toan he thong")}</div>
              </div>
            </div>

            <div className="text-[12px] text-slate-500">
              {settingQuery.isFetching ? translateText("Dang dong bo lai cau hinh xuat bao cao tu API...") : translateText("Cau hinh mau xuat bao cao duoc luu theo tung bao cao va co the xem truoc truoc khi in.")}
            </div>
          </section>
        </div>
      </div>
      {isModalOpen && editingRow ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/45 p-4 pt-10">
          <div className="w-full max-w-[1140px] overflow-hidden rounded-md border border-emerald-700 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-center justify-between bg-emerald-600 px-4 py-3 text-white">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-50/80">{translateText("Cau hinh xuat bao cao")}</p>
                <h2 className="mt-1 text-[15px] font-semibold">{editingRow.isGlobal ? translateText("Mau mac dinh toan he thong") : editingRow.title}</h2>
              </div>
              <button className="rounded-sm p-1 text-white/90 transition hover:bg-white/10" onClick={closeEditor} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4 bg-[#f8f8f8] p-4">
                <section className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="mb-4">
                    <p className="text-[12px] font-semibold text-slate-900">{translateText("Thong tin cau hinh")}</p>
                    <p className="mt-1 text-[12px] text-slate-500">{translateText("Dieu chinh tieu de, header/footer, kho giay va cach hien thi khi xuat bao cao.")}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-[12px] text-slate-700">
                      <span className="font-medium text-slate-900">{translateText("Ten mau")}</span>
                      <input className={inputClass} onChange={(event) => editingRow.isGlobal ? setDraftGlobal((current) => ({ ...current, defaultTitle: event.target.value })) : setDraftScoped((current) => ({ ...current, title: event.target.value }))} placeholder={editingRow.title} value={editingRow.isGlobal ? draftGlobal.defaultTitle : draftScoped.title} />
                    </label>
                    <label className="space-y-1.5 text-[12px] text-slate-700">
                      <span className="font-medium text-slate-900">{translateText("Loai mau")}</span>
                      <input className={`${inputClass} bg-slate-50 text-slate-600`} readOnly value={editingRow.typeLabel} />
                    </label>
                    <label className="space-y-1.5 text-[12px] text-slate-700">
                      <span className="font-medium text-slate-900">{translateText("Ma bao cao")}</span>
                      <input className={`${inputClass} bg-slate-50 text-slate-600`} readOnly value={editingRow.report?.key || translateText("system-default")} />
                    </label>
                    <label className="space-y-1.5 text-[12px] text-slate-700">
                      <span className="font-medium text-slate-900">{translateText("Mo ta")}</span>
                      <input className={inputClass} onChange={(event) => editingRow.isGlobal ? setDraftGlobal((current) => ({ ...current, defaultSubtitle: event.target.value })) : setDraftScoped((current) => ({ ...current, subtitle: event.target.value }))} placeholder={editingRow.description} value={editingRow.isGlobal ? draftGlobal.defaultSubtitle : draftScoped.subtitle} />
                    </label>
                    <div className="space-y-1.5 md:col-span-2">
                      <span className="text-[12px] font-medium text-slate-900">{translateText("Co che luu mau")}</span>
                      <div className="flex min-h-[108px] items-center gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-[12px] text-slate-600">
                        <div className="rounded-md bg-white p-3 text-emerald-700 shadow-sm">
                          <Upload className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{editingRow.fileLabel}</p>
                          <p>{translateText("He thong luu cau hinh theo metadata de giu dung cac cot dac thu nhu Ma cham cong.")}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="mb-4">
                    <p className="text-[12px] font-semibold text-slate-900">{editingRow.isGlobal ? translateText("Cau hinh mac dinh") : translateText("Cau hinh rieng cho bao cao")}</p>
                    <p className="mt-1 text-[12px] text-slate-500">{editingRow.isGlobal ? translateText("Ap dung cho toan bo bao cao khi chua co tuy chinh rieng.") : translateText("De trong truong nao thi se ke thua tu cau hinh mac dinh.")}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-[12px] text-slate-700">
                      <span className="font-medium text-slate-900">{translateText("Kho giay")}</span>
                      <select className={inputClass} onChange={(event) => editingRow.isGlobal ? setDraftGlobal((current) => ({ ...current, paperSize: event.target.value })) : setDraftScoped((current) => ({ ...current, paperSize: event.target.value }))} value={editingRow.isGlobal ? draftGlobal.paperSize : draftScoped.paperSize}>
                        {paperSizes.map((option) => (
                          <option key={option || "default"} value={option}>
                            {option || translateText("Mac dinh")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-[12px] text-slate-700">
                      <span className="font-medium text-slate-900">{editingRow.isGlobal ? translateText("Chieu in mac dinh") : translateText("Chieu in rieng")}</span>
                      <select className={inputClass} onChange={(event) => editingRow.isGlobal ? setDraftGlobal((current) => ({ ...current, defaultOrientation: event.target.value })) : setDraftScoped((current) => ({ ...current, orientation: event.target.value as ScopedForm["orientation"] }))} value={editingRow.isGlobal ? draftGlobal.defaultOrientation : draftScoped.orientation}>
                        {orientationOptions.map((option) => (
                          <option key={option.value || "default"} value={option.value}>
                            {translateText(option.label)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {[
                      ["showGeneratedBy", "Hien nguoi xuat"],
                      ["showPrintedAt", "Hien thoi gian xuat"],
                      ["showFilters", "In bo loc"],
                      ["showSignature", "In chu ky"],
                    ].map(([field, label]) => (
                      <label className="space-y-1.5 text-[12px] text-slate-700" key={field}>
                        <span className="font-medium text-slate-900">{translateText(label)}</span>
                        <select className={inputClass} onChange={(event) => editingRow.isGlobal ? setDraftGlobal((current) => ({ ...current, [field]: event.target.value as BoolValue })) : setDraftScoped((current) => ({ ...current, [field]: event.target.value as BoolOverride }))} value={editingRow.isGlobal ? draftGlobal[field as keyof GlobalForm] : draftScoped[field as keyof ScopedForm]}>
                          {(editingRow.isGlobal ? boolOptions : boolOverrideOptions).map((option) => (
                            <option key={option.value} value={option.value}>
                              {translateText(option.label)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    {editingRow.isGlobal ? (
                      <label className="space-y-1.5 text-[12px] text-slate-700">
                        <span className="font-medium text-slate-900">{translateText("Tong hop chi nhanh")}</span>
                        <select className={inputClass} onChange={(event) => setDraftGlobal((current) => ({ ...current, showBranchSummary: event.target.value as BoolValue }))} value={draftGlobal.showBranchSummary}>
                          {boolOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {translateText(option.label)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="space-y-1.5 text-[12px] text-slate-700">
                        <span className="font-medium text-slate-900">{translateText("Scale tien te")}</span>
                        <input className={`${inputClass} bg-slate-50 text-slate-600`} readOnly value={draftGlobal.currencyScale} />
                      </label>
                    )}
                    <label className="space-y-1.5 text-[12px] text-slate-700 md:col-span-2">
                      <span className="font-medium text-slate-900">{editingRow.isGlobal ? translateText("Header bao cao") : translateText("Header rieng")}</span>
                      <textarea className={textareaClass} onChange={(event) => editingRow.isGlobal ? setDraftGlobal((current) => ({ ...current, reportHeader: event.target.value })) : setDraftScoped((current) => ({ ...current, header: event.target.value }))} value={editingRow.isGlobal ? draftGlobal.reportHeader : draftScoped.header} />
                    </label>
                    <label className="space-y-1.5 text-[12px] text-slate-700 md:col-span-2">
                      <span className="font-medium text-slate-900">{editingRow.isGlobal ? translateText("Footer bao cao") : translateText("Footer rieng")}</span>
                      <textarea className={textareaClass} onChange={(event) => editingRow.isGlobal ? setDraftGlobal((current) => ({ ...current, reportFooter: event.target.value })) : setDraftScoped((current) => ({ ...current, footer: event.target.value }))} value={editingRow.isGlobal ? draftGlobal.reportFooter : draftScoped.footer} />
                    </label>
                    {editingRow.isGlobal ? (
                      <label className="space-y-1.5 text-[12px] text-slate-700 md:col-span-2">
                        <span className="font-medium text-slate-900">{translateText("Ghi chu chung")}</span>
                        <textarea className={textareaClass} onChange={(event) => setDraftGlobal((current) => ({ ...current, note: event.target.value }))} value={draftGlobal.note} />
                      </label>
                    ) : null}
                  </div>
                </section>
              </div>

              <aside className="border-l border-slate-200 bg-white p-4">
                <div className="space-y-4">
                  <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[12px] font-semibold text-slate-900">{translateText("Trang thai cau hinh")}</p>
                    <div className="mt-3 space-y-3 text-[12px] text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>{translateText("Pham vi")}</span>
                        <span className="font-medium text-slate-900">{scopeBranchId ? branchLabel : translateText("Toan he thong")}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{translateText("Kieu ap dung")}</span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${editingRow.isGlobal || countOverrides(draftScoped) ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {editingRow.isGlobal ? systemTemplateLabel : countOverrides(draftScoped) ? customTemplateLabel : inheritedTemplateLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{translateText("Chieu in")}</span>
                        <span className="font-medium text-slate-900">{translateEnum("orientation", effective.orientation)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>{translateText("Kho giay")}</span>
                        <span className="font-medium text-slate-900">{effective.paperSize || "A4"}</span>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[12px] font-semibold text-slate-900">{translateText("Xem truoc ban in")}</p>
                        <p className="mt-1 text-[12px] text-slate-500">{translateText("Ban xem truoc van giu cac cot dac thu nhu Ma cham cong.")}</p>
                      </div>
                      <button className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-700 transition hover:bg-emerald-100" onClick={printPreview} type="button">
                        <Printer className="h-4 w-4" />
                        {translateText("In thu")}
                      </button>
                    </div>

                    <div className="mt-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 border-b border-dashed border-slate-200 pb-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{translateText("Mau xuat bao cao")}</p>
                          <h3 className="mt-2 text-[16px] font-semibold text-slate-900">{effective.title || previewReport?.title || translateText("Bao cao")}</h3>
                          <p className="mt-1 text-[12px] text-slate-500">{effective.subtitle || previewReport?.subtitle || translateText("Bo cuc xem truoc")}</p>
                        </div>
                        <div className="text-right text-[11px] text-slate-500">
                          <p>{effective.paperSize || "A4"}</p>
                          <p>{translateEnum("orientation", effective.orientation)}</p>
                        </div>
                      </div>

                      {effective.showFilters ? (
                        <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{translateText("Dieu kien loc")}</p>
                          <div className="mt-2 space-y-1.5 text-[12px] text-slate-700">
                            {previewFilters.map((item) => (
                              <div className="flex items-center justify-between gap-3" key={item.label}>
                                <span>{item.label}</span>
                                <span className="font-medium text-slate-900">{formatPreview(item.label, item.value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
                        <div className="overflow-auto">
                          <table className="min-w-full text-[11px]">
                            <thead className="bg-slate-50 text-left text-slate-500">
                              <tr>
                                {Object.keys(previewRows[0] || {}).map((column) => (
                                  <th className="px-3 py-2 font-semibold" key={column}>
                                    {translateFieldLabel(column)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewRows.map((row, index) => (
                                <tr className="border-t border-slate-100" key={`${index}-${JSON.stringify(row)}`}>
                                  {Object.entries(row).map(([key, value]) => (
                                    <td className="px-3 py-2 text-slate-700" key={key}>
                                      {formatPreview(key, value)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {effective.footer ? <div className="mt-3 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">{effective.footer}</div> : null}
                      {effective.showSignature ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          {["Nguoi lap", "Phe duyet", "Nguoi nhan"].map((caption) => (
                            <div className="rounded-md border border-dashed border-slate-300 px-3 py-5 text-center text-[11px] text-slate-500" key={caption}>
                              <p className="font-semibold uppercase tracking-[0.14em]">{translateText(caption)}</p>
                              <p className="mt-8">{translateText("(Ky, ghi ro ho ten)")}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{translateText("Bien du lieu")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[...previewFilters.map((item) => item.label), ...previewMeta.map((item) => item.label), ...Object.keys(previewRows[0] || {})].map((token) => (
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600" key={token}>
                            {`{${token}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              </aside>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              {!editingRow.isGlobal ? (
                <button className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-100" onClick={() => setDraftScoped(defaultScoped)} type="button">
                  {translateText("Tra ve mac dinh")}
                </button>
              ) : null}
              <button className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeEditor} type="button">
                {translateText("Dong")}
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-[12px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300" disabled={mutation.isPending} onClick={() => void save()} type="button">
                <Save className="h-4 w-4" />
                {mutation.isPending ? translateText("Dang luu...") : translateText("Luu")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
