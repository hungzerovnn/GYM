"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Menu, Plus, Printer, RefreshCw, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, ListResponse } from "@/lib/api";
import { translateText } from "@/lib/i18n/display";
import { localizePortalPageDefinition, localizeReportDefinition, localizeResourceDefinition } from "@/lib/i18n/portal";
import { useLocale } from "@/lib/i18n/provider";
import { portalPageRegistry } from "@/lib/portal-pages";
import { reportRegistry } from "@/lib/report-registry";
import { resourceRegistry } from "@/lib/resource-registry";
import { printReportDocument } from "@/lib/print";
import { toReportBranding } from "@/lib/print-scope";
import { SettingDefinition } from "@/types/portal";
import { EmptyState } from "../feedback/empty-state";
import {
  buildTemplatePreviewData,
  buildGlobal,
  buildReportTemplateDesignerHref,
  buildScopedMap,
  buildTemplateRows,
  defaultGlobal,
  getTemplateCategoryForPath,
  GlobalForm,
  isTemplatePageSupported,
  REPORT_TEMPLATE_GLOBAL_ROW_KEY,
  ScopedForm,
  TemplateCategory,
  TemplatePageCatalogItem,
  toPayload,
} from "./report-template-designer-shared";

const categoryOptions: Array<{ label: string; value: TemplateCategory }> = [
  { label: "Tat ca", value: "all" },
  { label: "Mau chung", value: "shared" },
  { label: "Tong quan", value: "overview" },
  { label: "Hoi vien", value: "members" },
  { label: "Nghiep vu", value: "operations" },
  { label: "Lich PT", value: "ptSchedule" },
  { label: "Lich lop", value: "classSchedule" },
  { label: "Nhan vien", value: "staff" },
  { label: "So quy", value: "cashbook" },
  { label: "Pro Shop", value: "proShop" },
  { label: "Bao cao", value: "reports" },
];

const pageSizes = [15, 30, 50];

export function ReportTemplateWorkspace({ setting }: { setting: SettingDefinition }) {
  const { locale } = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const branchIdFromUrl = searchParams.get("branchId") || "";
  const [search, setSearch] = useState("");
  const [scopeBranchId, setScopeBranchId] = useState(branchIdFromUrl);
  const [pageSize, setPageSize] = useState(pageSizes[0]);
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory>("all");
  const [selectedRowKey, setSelectedRowKey] = useState(REPORT_TEMPLATE_GLOBAL_ROW_KEY);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [globalForm, setGlobalForm] = useState<GlobalForm>(defaultGlobal);
  const [scopedForms, setScopedForms] = useState<Record<string, ScopedForm>>({});

  const reportCatalogByKey = useMemo(
    () =>
      Object.fromEntries(
        Object.values(reportRegistry).map((item) => {
          const localized = localizeReportDefinition(item);
          return [localized.key, localized] as const;
        }),
      ),
    [locale],
  );
  const resourceCatalogByKey = useMemo(
    () =>
      Object.fromEntries(
        Object.values(resourceRegistry).map((item) => {
          const localized = localizeResourceDefinition(item);
          return [localized.key, localized] as const;
        }),
      ),
    [locale],
  );
  const pageCatalog = useMemo<TemplatePageCatalogItem[]>(
    () =>
      Object.entries(portalPageRegistry)
        .filter(([path, page]) => isTemplatePageSupported(path, page) && Boolean(getTemplateCategoryForPath(path)))
        .map(([path, page]) => ({
          path,
          page: localizePortalPageDefinition(page),
        })),
    [locale],
  );

  useEffect(() => {
    if (branchIdFromUrl === scopeBranchId) return;
    setScopeBranchId(branchIdFromUrl);
  }, [branchIdFromUrl, scopeBranchId]);

  const branchesQuery = useQuery({
    queryKey: ["setting-report-template-branches"],
    queryFn: async () => (await api.get<ListResponse<Record<string, unknown>>>("/branches", { params: { pageSize: 100 } })).data.data,
  });

  const settingQuery = useQuery({
    queryKey: ["setting", "report-templates", scopeBranchId || ""],
    queryFn: async () => (await api.get<Record<string, unknown>>(setting.endpoint, { params: scopeBranchId ? { branchId: scopeBranchId } : undefined })).data,
  });

  const companyQuery = useQuery({
    queryKey: ["setting", "company", scopeBranchId || ""],
    queryFn: async () => (await api.get<Record<string, unknown>>("/settings/company", { params: scopeBranchId ? { branchId: scopeBranchId } : undefined })).data,
  });

  useEffect(() => {
    if (!settingQuery.data) return;
    setGlobalForm(buildGlobal(settingQuery.data));
    setScopedForms(buildScopedMap(settingQuery.data));
  }, [settingQuery.data]);

  const branchLabel =
    (branchesQuery.data || []).find((branch) => String(branch.id) === scopeBranchId)?.name?.toString() ||
    (scopeBranchId ? scopeBranchId : translateText("Toan he thong"));

  const rows = useMemo(
    () =>
      buildTemplateRows({
        pageCatalog,
        reportCatalogByKey,
        resourceCatalogByKey,
        scopedForms,
      }),
    [pageCatalog, reportCatalogByKey, resourceCatalogByKey, scopedForms],
  );
  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (categoryFilter === "all" || row.category === categoryFilter) &&
          (!search.trim() || `${row.title} ${row.description} ${row.typeLabel}`.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [categoryFilter, rows, search],
  );

  const selectedRow = rows.find((row) => row.key === selectedRowKey) || rows[0] || null;
  const previewData = useMemo(() => buildTemplatePreviewData(selectedRow, branchLabel), [branchLabel, selectedRow]);
  const branding = useMemo(() => toReportBranding(companyQuery.data), [companyQuery.data]);
  const previewTemplate = useMemo(() => toPayload(globalForm, scopedForms), [globalForm, scopedForms]);

  const updateBranchScope = (value: string) => {
    setScopeBranchId(value);
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (value) {
      nextSearchParams.set("branchId", value);
    } else {
      nextSearchParams.delete("branchId");
    }
    const nextHref = nextSearchParams.toString() ? `${pathname}?${nextSearchParams.toString()}` : pathname;
    router.replace(nextHref, { scroll: false });
  };

  const openDesigner = () => {
    if (!selectedRow) return;
    router.push(buildReportTemplateDesignerHref(selectedRow.key, scopeBranchId));
  };

  const reload = async () => {
    await Promise.all([settingQuery.refetch(), companyQuery.refetch()]);
    toast.success(translateText("Da tai lai du lieu designer bao cao."));
    setIsMenuOpen(false);
  };

  const printPreview = () => {
    printReportDocument({
      reportKey: previewData.reportKey,
      templateKey: previewData.templateKey,
      templateFallbackKeys: previewData.templateFallbackKeys,
      title: previewData.title,
      subtitle: previewData.subtitle,
      summary: previewData.summary,
      filters: previewData.filters,
      rows: previewData.rows,
      columns: previewData.columns,
      template: previewTemplate,
      generatedBy: user?.fullName || user?.username,
      branding,
      showPreviewToolbar: true,
      autoPrint: false,
    });
    setIsMenuOpen(false);
  };

  if (settingQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-[24px] border border-slate-200 bg-slate-100" />;
  }

  if (settingQuery.isError) {
    return (
      <EmptyState
        description={translateText("Khong tai duoc cau hinh designer bao cao tu API.")}
        title={translateText("Cau hinh xuat bao cao gap loi")}
      />
    );
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-[#f8fafc] p-4 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-11 w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 text-[12px] outline-none transition focus:border-emerald-400"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={translateText("Theo ma, ten bao cao...")}
            value={search}
          />
        </div>
        <select className="h-11 rounded-full border border-slate-200 bg-white px-4 text-[12px] outline-none" onChange={(event) => updateBranchScope(event.target.value)} value={scopeBranchId}>
          <option value="">{translateText("Toan he thong")}</option>
          {(branchesQuery.data || []).map((branch) => (
            <option key={String(branch.id)} value={String(branch.id)}>
              {String(branch.name || branch.code || branch.id)}
            </option>
          ))}
        </select>
        <button className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-600 px-5 text-[12px] font-semibold text-white hover:bg-emerald-700" onClick={openDesigner} type="button">
          <Plus className="h-4 w-4" />
          {translateText("Mo designer")}
        </button>
        <div className="relative">
          <button className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" onClick={() => setIsMenuOpen((current) => !current)} type="button">
            <Menu className="h-4 w-4" />
          </button>
          {isMenuOpen ? (
            <div className="absolute right-0 top-12 z-20 min-w-[180px] rounded-2xl border border-slate-200 bg-white p-1 shadow-lg">
              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50" onClick={() => void reload()} type="button">
                <RefreshCw className="h-4 w-4" />
                {translateText("Tai lai")}
              </button>
              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50" onClick={printPreview} type="button">
                <Printer className="h-4 w-4" />
                {translateText("In xem truoc")}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {categoryOptions.map((option) => (
          <button className={`rounded-full px-4 py-2 text-[12px] font-semibold ${categoryFilter === option.value ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`} key={option.value} onClick={() => setCategoryFilter(option.value)} type="button">
            {translateText(option.label)}
          </button>
        ))}
        <select className="ml-auto h-10 rounded-full border border-slate-200 bg-white px-4 text-[12px] outline-none" onChange={(event) => setPageSize(Number(event.target.value))} value={pageSize}>
          {pageSizes.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
        <div className="overflow-auto">
          <table className="min-w-full text-[12px]">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">{translateText("Ten mau")}</th>
                <th className="px-4 py-3 font-semibold">{translateText("Loai mau")}</th>
                <th className="px-4 py-3 font-semibold">{translateText("Nguon cau hinh")}</th>
                <th className="px-4 py-3 font-semibold">{translateText("Mo ta")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, pageSize).map((row) => {
                const isSelected = selectedRowKey === row.key;

                return (
                  <tr
                    className={`cursor-pointer border-t border-slate-100 transition-colors hover:bg-emerald-50/60 ${isSelected ? "bg-emerald-100/90 shadow-[inset_4px_0_0_0_#059669]" : ""}`}
                    key={row.key}
                    onClick={() => setSelectedRowKey(row.key)}
                  >
                    <td className={`px-4 py-3 font-medium ${isSelected ? "border-l-4 border-emerald-600 text-emerald-950" : "text-slate-900"}`}>{row.title}</td>
                    <td className={`px-4 py-3 ${isSelected ? "font-medium text-emerald-900" : "text-slate-600"}`}>{translateText(row.typeLabel)}</td>
                    <td className={`px-4 py-3 ${isSelected ? "font-medium text-emerald-900" : "text-slate-600"}`}>{translateText(row.fileLabel)}</td>
                    <td className={`px-4 py-3 ${isSelected ? "text-slate-700" : "text-slate-500"}`}>{row.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRow ? (
        <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4 text-[12px] text-slate-600">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-900">{selectedRow.title}</div>
              <div className="mt-1">{selectedRow.description}</div>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
              {`${translateText("Nhom")}: ${translateText(selectedRow.typeLabel)}`}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
