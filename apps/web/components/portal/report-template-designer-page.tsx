"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  cloneReportDesignerLayout,
  createDefaultReportDesignerLayout,
  ReportDesignerLayout,
} from "@/lib/report-designer";
import { SettingDefinition } from "@/types/portal";
import { EmptyState } from "../feedback/empty-state";
import { ReportTemplateDesignerModal } from "./report-template-designer-modal";
import {
  buildTemplatePreviewData,
  buildGlobal,
  buildReportTemplateListHref,
  buildScopedMap,
  buildTemplateRows,
  countOverrides,
  defaultGlobal,
  defaultScoped,
  fromDesignerRouteKey,
  GlobalForm,
  getTemplateCategoryForPath,
  isTemplatePageSupported,
  pruneScopedOverride,
  resolveDesignerLayoutForRow,
  resolveInheritedScopedFormForRow,
  resolveScopedFormForRow,
  ScopedForm,
  TemplatePageCatalogItem,
  toPayload,
} from "./report-template-designer-shared";

interface ReportTemplateDesignerPageProps {
  setting: SettingDefinition;
  templateKey: string;
  initialBranchId?: string;
}

export function ReportTemplateDesignerPage({
  setting,
  templateKey,
  initialBranchId = "",
}: ReportTemplateDesignerPageProps) {
  const { locale } = useLocale();
  const { user, isReady } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopeBranchId = searchParams.get("branchId") || initialBranchId;
  const rowKey = useMemo(() => fromDesignerRouteKey(templateKey), [templateKey]);
  const [globalForm, setGlobalForm] = useState<GlobalForm>(defaultGlobal);
  const [scopedForms, setScopedForms] = useState<Record<string, ScopedForm>>({});
  const [draftGlobal, setDraftGlobal] = useState<GlobalForm>(defaultGlobal);
  const [draftScoped, setDraftScoped] = useState<ScopedForm>(defaultScoped);
  const [draftDesigner, setDraftDesigner] = useState(() => createDefaultReportDesignerLayout());
  const canViewSettings = user?.permissions.includes("settings.view");

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

  const branchesQuery = useQuery({
    queryKey: ["setting-report-template-branches"],
    queryFn: async () => (await api.get<ListResponse<Record<string, unknown>>>("/branches", { params: { pageSize: 100 } })).data.data,
    enabled: isReady && canViewSettings,
  });

  const settingQuery = useQuery({
    queryKey: ["setting", "report-templates", scopeBranchId || ""],
    queryFn: async () => (await api.get<Record<string, unknown>>(setting.endpoint, { params: scopeBranchId ? { branchId: scopeBranchId } : undefined })).data,
    enabled: isReady && canViewSettings,
  });

  const companyQuery = useQuery({
    queryKey: ["setting", "company", scopeBranchId || ""],
    queryFn: async () => (await api.get<Record<string, unknown>>("/settings/company", { params: scopeBranchId ? { branchId: scopeBranchId } : undefined })).data,
    enabled: isReady && canViewSettings,
  });

  useEffect(() => {
    if (!settingQuery.data) return;
    setGlobalForm(buildGlobal(settingQuery.data));
    setScopedForms(buildScopedMap(settingQuery.data));
  }, [settingQuery.data]);

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
  const row = rows.find((item) => item.key === rowKey) || null;

  useEffect(() => {
    if (!row) return;
    const nextScoped = row.isGlobal ? defaultScoped : resolveScopedFormForRow(row, scopedForms);
    setDraftGlobal(globalForm);
    setDraftScoped(nextScoped);
    setDraftDesigner(resolveDesignerLayoutForRow(row, globalForm, nextScoped));
  }, [globalForm, row, scopedForms]);

  const branchLabel =
    (branchesQuery.data || []).find((branch) => String(branch.id) === scopeBranchId)?.name?.toString() ||
    (scopeBranchId ? scopeBranchId : translateText("Toan he thong"));

  const previewData = useMemo(() => buildTemplatePreviewData(row, branchLabel), [branchLabel, row]);
  const branding = useMemo(() => toReportBranding(companyQuery.data), [companyQuery.data]);

  const mutation = useMutation({
    mutationFn: async (payload: { nextGlobal: GlobalForm; nextScoped: Record<string, ScopedForm> }) =>
      api.patch(setting.endpoint, { ...(scopeBranchId ? { branchId: scopeBranchId } : {}), ...toPayload(payload.nextGlobal, payload.nextScoped) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["setting", "report-templates"] });
      toast.success(translateText("Da luu cau hinh designer bao cao."));
    },
    onError: () => toast.error(translateText("Khong luu duoc designer bao cao.")),
  });

  const buildTemplatePayloadForDesigner = (layout: ReportDesignerLayout) => {
    const nextGlobal = row?.isGlobal ? { ...draftGlobal, defaultDesigner: cloneReportDesignerLayout(layout) } : globalForm;
    const nextScoped = { ...scopedForms };

    if (row && !row.isGlobal) {
      nextScoped[row.templateKey] = { ...draftScoped, designer: cloneReportDesignerLayout(layout) };
    }

    return toPayload(nextGlobal, nextScoped);
  };

  const previewTemplate = useMemo(
    () => buildTemplatePayloadForDesigner(draftDesigner),
    [draftDesigner, draftGlobal, draftScoped, globalForm, row, scopedForms],
  );

  const printPreview = (layout: ReportDesignerLayout) => {
    const nextDesigner = cloneReportDesignerLayout(layout);
    const nextTemplate = buildTemplatePayloadForDesigner(nextDesigner);
    setDraftDesigner(nextDesigner);
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
      template: nextTemplate,
      generatedBy: user?.fullName || user?.username,
      branding,
      showPreviewToolbar: true,
      autoPrint: false,
    });
  };

  const save = async (layout: ReportDesignerLayout) => {
    if (!row) return;
    const nextDesigner = cloneReportDesignerLayout(layout);
    setDraftDesigner(nextDesigner);

    if (row.isGlobal) {
      const nextGlobal = { ...draftGlobal, defaultDesigner: cloneReportDesignerLayout(nextDesigner) };
      await mutation.mutateAsync({ nextGlobal, nextScoped: scopedForms });
      setGlobalForm(nextGlobal);
      return;
    }

    const inheritedScoped = resolveInheritedScopedFormForRow(row, scopedForms);
    const inheritedDesigner = resolveDesignerLayoutForRow(row, globalForm, inheritedScoped);
    const nextOverride = pruneScopedOverride(
      draftScoped,
      inheritedScoped,
      cloneReportDesignerLayout(nextDesigner),
      inheritedDesigner,
    );
    const nextScoped = {
      ...scopedForms,
    };
    if (countOverrides(nextOverride)) {
      nextScoped[row.templateKey] = nextOverride;
    } else {
      delete nextScoped[row.templateKey];
    }
    await mutation.mutateAsync({ nextGlobal: globalForm, nextScoped });
    setScopedForms(nextScoped);
  };

  if (!isReady) {
    return <div className="h-64 animate-pulse rounded-[24px] border border-slate-200 bg-slate-100" />;
  }

  if (!canViewSettings) {
    return (
      <EmptyState
        description={translateText("Vai tro hien tai chua duoc cap quyen cho khu thiet lap nay. Hay mo Vai tro va bat quyen settings truoc khi truy cap.")}
        title={translateText("Khong co quyen xem thiet lap")}
      />
    );
  }

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

  if (!row) {
    return (
      <EmptyState
        description={translateText("Khong tim thay mau bao cao can mo trong route designer nay.")}
        title={translateText("Khong co mau bao cao")}
      />
    );
  }

  return (
    <ReportTemplateDesignerModal
      branchLabel={branchLabel}
      branding={branding}
      designer={draftDesigner}
      generatedBy={user?.fullName || user?.username}
      globalForm={draftGlobal}
      onChangeGlobal={(patch) => setDraftGlobal((current) => ({ ...current, ...patch }))}
      onChangeScoped={(patch) => setDraftScoped((current) => ({ ...current, ...patch }))}
      onClose={() => router.push(buildReportTemplateListHref(scopeBranchId))}
      onPrintPreview={printPreview}
      onResetScoped={() => {
        const nextScoped = resolveInheritedScopedFormForRow(row, scopedForms);
        setDraftScoped(nextScoped);
        setDraftDesigner(resolveDesignerLayoutForRow(row, globalForm, nextScoped));
      }}
      onSave={(layout) => void save(layout)}
      presentation="page"
      previewFilters={previewData.filters}
      previewReport={row.report || null}
      previewRows={previewData.rows}
      previewSummary={previewData.summary}
      previewTemplate={previewTemplate}
      row={row}
      saving={mutation.isPending}
      scopedForm={draftScoped}
    />
  );
}
