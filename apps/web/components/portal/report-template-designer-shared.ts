import {
  cloneReportDesignerLayout,
  createDefaultReportDesignerLayout,
  normalizeReportDesignerLayout,
  ReportDesignerKeyValue,
  ReportDesignerLayout,
} from "@/lib/report-designer";
import { buildResourceDesignerDataset, buildResourcePreviewRecord } from "@/lib/resource-meta";
import { PortalPageDefinition, ReportDefinition, ResourceDefinition } from "@/types/portal";

type BoolValue = "true" | "false";
type BoolOverride = "inherit" | "true" | "false";

export type TemplateCategory =
  | "all"
  | "shared"
  | "overview"
  | "members"
  | "operations"
  | "ptSchedule"
  | "classSchedule"
  | "staff"
  | "cashbook"
  | "proShop"
  | "reports";

type TemplateRowKind = "global" | "report" | "resource";

export interface TemplatePageCatalogItem {
  path: string;
  page: PortalPageDefinition;
}

export interface TemplateRow {
  key: string;
  templateKey: string;
  fallbackTemplateKeys: string[];
  title: string;
  description: string;
  typeLabel: string;
  fileLabel: string;
  category: Exclude<TemplateCategory, "all">;
  isGlobal: boolean;
  kind: TemplateRowKind;
  page?: PortalPageDefinition;
  pagePath?: string;
  report?: ReportDefinition;
  resource?: ResourceDefinition;
}

export interface TemplatePreviewData {
  reportKey?: string;
  templateKey?: string;
  templateFallbackKeys: string[];
  title: string;
  subtitle: string;
  summary: ReportDesignerKeyValue[];
  filters: ReportDesignerKeyValue[];
  rows: Array<Record<string, unknown>>;
  columns: string[];
}

export interface GlobalForm {
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
  signatureLeftTitle: string;
  signatureLeftName: string;
  signatureCenterTitle: string;
  signatureCenterName: string;
  signatureRightTitle: string;
  signatureRightName: string;
  note: string;
  defaultDesigner: ReportDesignerLayout | null;
}

export interface ScopedForm {
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
  designer: ReportDesignerLayout | null;
}

export const REPORT_TEMPLATE_GLOBAL_ROW_KEY = "__global__";
export const REPORT_TEMPLATE_GLOBAL_ROUTE_KEY = "default";

const templateCategoryLabels: Record<Exclude<TemplateCategory, "all">, string> = {
  shared: "Mau chung",
  overview: "Tong quan",
  members: "Hoi vien",
  operations: "Nghiep vu",
  ptSchedule: "Lich PT",
  classSchedule: "Lich lop",
  staff: "Nhan vien",
  cashbook: "So quy",
  proShop: "Pro Shop",
  reports: "Bao cao",
};

export const defaultGlobal: GlobalForm = {
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
  showSignature: "true",
  signatureLeftTitle: "Nguoi lap bieu",
  signatureLeftName: "",
  signatureCenterTitle: "Ke toan truong",
  signatureCenterName: "",
  signatureRightTitle: "Quan ly phe duyet",
  signatureRightName: "",
  note: "",
  defaultDesigner: null,
};

export const defaultScoped: ScopedForm = {
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
  designer: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const bool = (value: unknown, fallback: boolean): BoolValue => (value === undefined || value === null ? (fallback ? "true" : "false") : value === true || value === "true" ? "true" : "false");
const boolOverride = (value: unknown): BoolOverride => (value === undefined || value === null ? "inherit" : value === true || value === "true" ? "true" : "false");

const trimmed = (value: string) => value.trim();

const resolveTemplateScopedForm = (keys: string[], scopedForms: Record<string, ScopedForm>) => {
  for (const key of keys) {
    if (!key) continue;
    const form = scopedForms[key];
    if (form && countOverrides(form)) {
      return form;
    }
  }
  return defaultScoped;
};

const resolveFileLabel = (templateKey: string, fallbackTemplateKeys: string[], scopedForms: Record<string, ScopedForm>) => {
  if (countOverrides(scopedForms[templateKey] || defaultScoped)) {
    return "Tuy chinh rieng";
  }

  if (fallbackTemplateKeys.some((key) => countOverrides(scopedForms[key] || defaultScoped))) {
    return "Ke thua mau cu";
  }

  return "Ke thua mac dinh";
};

export const getTemplateCategoryLabel = (category: Exclude<TemplateCategory, "all">) => templateCategoryLabels[category];

export const getTemplateCategoryForPath = (path: string): Exclude<TemplateCategory, "all" | "shared"> | null => {
  if (path.startsWith("overview/")) return "overview";
  if (path.startsWith("members/")) return "members";
  if (path.startsWith("operations/")) return "operations";
  if (path.startsWith("pt-schedule/")) return "ptSchedule";
  if (path.startsWith("class-schedule/")) return "classSchedule";
  if (path.startsWith("staff/")) return "staff";
  if (path.startsWith("cashbook/")) return "cashbook";
  if (path.startsWith("pro-shop/")) return "proShop";
  if (path.startsWith("reports/")) return "reports";
  return null;
};

export const isTemplatePageSupported = (path: string, page: PortalPageDefinition) =>
  Boolean(getTemplateCategoryForPath(path)) && (page.kind === "report" || page.kind === "resource");

export const buildGlobal = (src?: Record<string, unknown> | null): GlobalForm => ({
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
  signatureLeftTitle: text(src?.signatureLeftTitle) || defaultGlobal.signatureLeftTitle,
  signatureLeftName: text(src?.signatureLeftName),
  signatureCenterTitle: text(src?.signatureCenterTitle) || defaultGlobal.signatureCenterTitle,
  signatureCenterName: text(src?.signatureCenterName),
  signatureRightTitle: text(src?.signatureRightTitle) || defaultGlobal.signatureRightTitle,
  signatureRightName: text(src?.signatureRightName),
  note: text(src?.note),
  defaultDesigner: src?.defaultDesigner ? normalizeReportDesignerLayout(src.defaultDesigner, { paperSize: src?.paperSize, orientation: src?.defaultOrientation }) : null,
});

export const buildScoped = (src?: unknown): ScopedForm => {
  const record = isRecord(src) ? src : {};
  return {
    title: text(record.title),
    subtitle: text(record.subtitle),
    header: text(record.header),
    footer: text(record.footer),
    paperSize: text(record.paperSize),
    orientation: text(record.orientation) === "LANDSCAPE" ? "LANDSCAPE" : text(record.orientation) === "PORTRAIT" ? "PORTRAIT" : "",
    showGeneratedBy: boolOverride(record.showGeneratedBy),
    showPrintedAt: boolOverride(record.showPrintedAt),
    showFilters: boolOverride(record.showFilters),
    showSignature: boolOverride(record.showSignature),
    designer: record.designer ? normalizeReportDesignerLayout(record.designer, { paperSize: record.paperSize, orientation: record.orientation }) : null,
  };
};

export const buildScopedMap = (src?: Record<string, unknown> | null) => {
  const raw = isRecord(src?.reportTemplates) ? src.reportTemplates : {};
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, buildScoped(value)])) as Record<string, ScopedForm>;
};

export const normalizeGlobal = (form: GlobalForm) => ({
  defaultTitle: trimmed(form.defaultTitle) || defaultGlobal.defaultTitle,
  defaultSubtitle: trimmed(form.defaultSubtitle),
  currencyScale: trimmed(form.currencyScale) || defaultGlobal.currencyScale,
  paperSize: trimmed(form.paperSize) || defaultGlobal.paperSize,
  defaultOrientation: form.defaultOrientation || defaultGlobal.defaultOrientation,
  reportHeader: trimmed(form.reportHeader),
  reportFooter: trimmed(form.reportFooter),
  showGeneratedBy: form.showGeneratedBy === "true",
  showPrintedAt: form.showPrintedAt === "true",
  showFilters: form.showFilters === "true",
  showBranchSummary: form.showBranchSummary === "true",
  showSignature: form.showSignature === "true",
  signatureLeftTitle: trimmed(form.signatureLeftTitle) || defaultGlobal.signatureLeftTitle,
  signatureLeftName: trimmed(form.signatureLeftName),
  signatureCenterTitle: trimmed(form.signatureCenterTitle) || defaultGlobal.signatureCenterTitle,
  signatureCenterName: trimmed(form.signatureCenterName),
  signatureRightTitle: trimmed(form.signatureRightTitle) || defaultGlobal.signatureRightTitle,
  signatureRightName: trimmed(form.signatureRightName),
  defaultDesigner: form.defaultDesigner ? cloneReportDesignerLayout(form.defaultDesigner) : null,
  note: trimmed(form.note),
});

export const normalizeScoped = (form: ScopedForm) => {
  const payload: Record<string, unknown> = {};
  if (trimmed(form.title)) payload.title = trimmed(form.title);
  if (trimmed(form.subtitle)) payload.subtitle = trimmed(form.subtitle);
  if (trimmed(form.header)) payload.header = trimmed(form.header);
  if (trimmed(form.footer)) payload.footer = trimmed(form.footer);
  if (trimmed(form.paperSize)) payload.paperSize = trimmed(form.paperSize);
  if (form.orientation) payload.orientation = form.orientation;
  if (form.showGeneratedBy !== "inherit") payload.showGeneratedBy = form.showGeneratedBy === "true";
  if (form.showPrintedAt !== "inherit") payload.showPrintedAt = form.showPrintedAt === "true";
  if (form.showFilters !== "inherit") payload.showFilters = form.showFilters === "true";
  if (form.showSignature !== "inherit") payload.showSignature = form.showSignature === "true";
  if (form.designer) payload.designer = cloneReportDesignerLayout(form.designer);
  return payload;
};

export const toPayload = (globalForm: GlobalForm, scopedForms: Record<string, ScopedForm>) => ({
  ...normalizeGlobal(globalForm),
  reportTemplates: Object.fromEntries(
    Object.entries(scopedForms).flatMap(([key, value]) => {
      const normalized = normalizeScoped(value);
      return Object.keys(normalized).length ? [[key, normalized]] : [];
    }),
  ),
});

export const countOverrides = (form: ScopedForm) => Object.keys(normalizeScoped(form)).length;

export const buildTemplateRows = ({
  pageCatalog,
  reportCatalogByKey,
  resourceCatalogByKey,
  scopedForms,
}: {
  pageCatalog: TemplatePageCatalogItem[];
  reportCatalogByKey: Record<string, ReportDefinition>;
  resourceCatalogByKey: Record<string, ResourceDefinition>;
  scopedForms: Record<string, ScopedForm>;
}): TemplateRow[] => [
  {
    key: REPORT_TEMPLATE_GLOBAL_ROW_KEY,
    templateKey: REPORT_TEMPLATE_GLOBAL_ROW_KEY,
    fallbackTemplateKeys: [],
    title: "Mau mac dinh toan he thong",
    description: "Designer mac dinh ap dung cho cac man hinh da duoc cau hinh theo report designer khi chua co tuy chinh rieng.",
    typeLabel: getTemplateCategoryLabel("shared"),
    fileLabel: "Mac dinh he thong",
    category: "shared",
    isGlobal: true,
    kind: "global",
  },
  ...pageCatalog.flatMap<TemplateRow>(({ path, page }) => {
    const category = getTemplateCategoryForPath(path);
    if (!category) {
      return [];
    }

    if (page.kind === "report") {
      const report = page.reportKey ? reportCatalogByKey[page.reportKey] : undefined;
      if (!report) {
        return [];
      }

      return [
        {
          key: page.key,
          templateKey: page.key,
          fallbackTemplateKeys: [report.key],
          title: page.title || report.title,
          description: page.subtitle || report.subtitle,
          typeLabel: getTemplateCategoryLabel(category),
          fileLabel: resolveFileLabel(page.key, [report.key], scopedForms),
          category,
          isGlobal: false,
          kind: "report" as const,
          page,
          pagePath: path,
          report,
        },
      ];
    }

    if (page.kind === "resource") {
      const resource = page.resourceKey ? resourceCatalogByKey[page.resourceKey] : undefined;
      if (!resource) {
        return [];
      }

      return [
        {
          key: page.key,
          templateKey: page.key,
          fallbackTemplateKeys: [],
          title: page.title || resource.title,
          description: page.subtitle || resource.subtitle,
          typeLabel: getTemplateCategoryLabel(category),
          fileLabel: resolveFileLabel(page.key, [], scopedForms),
          category,
          isGlobal: false,
          kind: "resource" as const,
          page,
          pagePath: path,
          resource,
        },
      ];
    }

    return [];
  }),
];

export const resolveScopedFormForRow = (row: TemplateRow, scopedForms: Record<string, ScopedForm>) =>
  row.isGlobal ? defaultScoped : resolveTemplateScopedForm([row.templateKey, ...row.fallbackTemplateKeys], scopedForms);

export const resolveInheritedScopedFormForRow = (row: TemplateRow, scopedForms: Record<string, ScopedForm>) =>
  row.isGlobal ? defaultScoped : resolveTemplateScopedForm(row.fallbackTemplateKeys, scopedForms);

export const buildTemplatePreviewData = (row: TemplateRow | null, branchLabel: string): TemplatePreviewData => {
  const baseFilters: ReportDesignerKeyValue[] = [{ label: "Chi nhanh", value: branchLabel }];

  if (!row || row.isGlobal) {
    const rows = previewRowsForDefault();
    return {
      reportKey: undefined,
      templateKey: undefined,
      templateFallbackKeys: [],
      title: row?.title || "Mau mac dinh toan he thong",
      subtitle: row?.description || "Preview designer mac dinh toan he thong.",
      summary: previewSummaryForDefault(),
      filters: [...baseFilters, { label: "Ky bao cao", value: "01/04/2026 - 30/04/2026" }],
      rows,
      columns: Object.keys(rows[0] || {}),
    };
  }

  if (row.kind === "report" && row.report) {
    const rows = previewRowsFor(row.report);
    return {
      reportKey: row.report.key,
      templateKey: row.templateKey,
      templateFallbackKeys: row.fallbackTemplateKeys,
      title: row.title,
      subtitle: row.description,
      summary: previewSummaryFor(row.report),
      filters: [...baseFilters, { label: "Ky bao cao", value: "01/04/2026 - 30/04/2026" }],
      rows,
      columns: Object.keys(rows[0] || {}),
    };
  }

  if (row.kind === "resource" && row.resource) {
    const sampleRecord = buildResourcePreviewRecord(row.resource);
    const dataset = buildResourceDesignerDataset(row.resource, sampleRecord);
    return {
      reportKey: undefined,
      templateKey: row.templateKey,
      templateFallbackKeys: row.fallbackTemplateKeys,
      title: row.title,
      subtitle: row.description,
      summary: dataset.summary,
      filters: [...baseFilters, { label: "Man hinh", value: row.title }],
      rows: dataset.rows,
      columns: dataset.columns,
    };
  }

  const rows = previewRowsForDefault();
  return {
    reportKey: undefined,
    templateKey: row.templateKey,
    templateFallbackKeys: row.fallbackTemplateKeys,
    title: row.title,
    subtitle: row.description,
    summary: previewSummaryForDefault(),
    filters: baseFilters,
    rows,
    columns: Object.keys(rows[0] || {}),
  };
};

export const resolveDesignerLayoutForRow = (row: TemplateRow, globalForm: GlobalForm, scopedForm: ScopedForm) =>
  cloneReportDesignerLayout(
    row.isGlobal
      ? globalForm.defaultDesigner || createDefaultReportDesignerLayout(globalForm.paperSize, globalForm.defaultOrientation)
      : scopedForm.designer ||
          globalForm.defaultDesigner ||
          createDefaultReportDesignerLayout(scopedForm.paperSize || globalForm.paperSize, scopedForm.orientation || globalForm.defaultOrientation),
  );

export const pruneScopedOverride = (
  form: ScopedForm,
  inheritedForm: ScopedForm,
  designerLayout: ReportDesignerLayout | null,
  inheritedDesignerLayout: ReportDesignerLayout,
): ScopedForm => ({
  title: trimmed(form.title) === trimmed(inheritedForm.title) ? "" : form.title,
  subtitle: trimmed(form.subtitle) === trimmed(inheritedForm.subtitle) ? "" : form.subtitle,
  header: trimmed(form.header) === trimmed(inheritedForm.header) ? "" : form.header,
  footer: trimmed(form.footer) === trimmed(inheritedForm.footer) ? "" : form.footer,
  paperSize: trimmed(form.paperSize) === trimmed(inheritedForm.paperSize) ? "" : form.paperSize,
  orientation: form.orientation === inheritedForm.orientation ? "" : form.orientation,
  showGeneratedBy: form.showGeneratedBy === inheritedForm.showGeneratedBy ? "inherit" : form.showGeneratedBy,
  showPrintedAt: form.showPrintedAt === inheritedForm.showPrintedAt ? "inherit" : form.showPrintedAt,
  showFilters: form.showFilters === inheritedForm.showFilters ? "inherit" : form.showFilters,
  showSignature: form.showSignature === inheritedForm.showSignature ? "inherit" : form.showSignature,
  designer: designerLayout && !areDesignerLayoutsEqual(designerLayout, inheritedDesignerLayout) ? cloneReportDesignerLayout(designerLayout) : null,
});

export const areDesignerLayoutsEqual = (left: ReportDesignerLayout, right: ReportDesignerLayout) => JSON.stringify(left) === JSON.stringify(right);

export const toDesignerRouteKey = (rowKey: string) => (rowKey === REPORT_TEMPLATE_GLOBAL_ROW_KEY ? REPORT_TEMPLATE_GLOBAL_ROUTE_KEY : rowKey);

export const fromDesignerRouteKey = (routeKey: string) => {
  const normalized = routeKey.trim();
  if (!normalized) {
    return REPORT_TEMPLATE_GLOBAL_ROW_KEY;
  }
  return normalized === REPORT_TEMPLATE_GLOBAL_ROUTE_KEY ? REPORT_TEMPLATE_GLOBAL_ROW_KEY : normalized;
};

export const buildReportTemplateListHref = (branchId?: string) =>
  branchId ? `/settings/report-templates?branchId=${encodeURIComponent(branchId)}` : "/settings/report-templates";

export const buildReportTemplateDesignerHref = (rowKey: string, branchId?: string) => {
  const basePath = `/settings/report-templates/designer/${encodeURIComponent(toDesignerRouteKey(rowKey))}`;
  return branchId ? `${basePath}?branchId=${encodeURIComponent(branchId)}` : basePath;
};

const previewRowsForDefault = () => [
  { memberName: "Tran Gia Linh", branchName: "Chi nhanh Trung tam", firstCheckInAt: "2026-04-01T06:15:00.000Z", verificationMethods: "QR", membershipStatus: "ACTIVE" },
  { memberName: "Pham Huu Duc", branchName: "Chi nhanh Phu Nhuan", firstCheckInAt: "2026-04-01T08:45:00.000Z", verificationMethods: "FaceID", membershipStatus: "ACTIVE" },
];

const previewSummaryForDefault = () => [
  { label: "Tong luot", value: 24 },
  { label: "Da xu ly", value: 18 },
  { label: "Can theo doi", value: 6 },
];

export const previewRowsFor = (report: ReportDefinition) =>
  report.key === "staff-attendance"
    ? [
        { staffCode: "NV001", staffName: "Nguyen Van An", attendanceCode: "CC240401", attendanceDate: "2026-04-01", workedHours: 8, lateMinutes: 0, attendanceStatus: "PRESENT" },
        { staffCode: "NV018", staffName: "Tran Thi Binh", attendanceCode: "CC240402", attendanceDate: "2026-04-02", workedHours: 7.5, lateMinutes: 15, attendanceStatus: "LATE" },
      ]
    : report.key === "debt"
      ? [
          { customerName: "Nguyen Anh Thu", contractCode: "HD-240118", totalAmount: 18500000, amountPaid: 12000000, outstandingDebt: 6500000, paymentStatus: "PARTIAL" },
          { customerName: "Pham Minh Hoang", contractCode: "HD-240126", totalAmount: 12900000, amountPaid: 7900000, outstandingDebt: 5000000, paymentStatus: "PARTIAL" },
        ]
      : previewRowsForDefault();

export const previewSummaryFor = (report: ReportDefinition) =>
  report.key === "staff-attendance"
    ? [{ label: "Tong gio lam", value: 168 }, { label: "So lan di muon", value: 3 }, { label: "So nhan vien", value: 24 }]
    : report.key === "debt"
      ? [{ label: "Tong cong no", value: 48500000 }, { label: "Da thanh toan", value: 31500000 }, { label: "Con phai thu", value: 17000000 }]
      : report.summaryKeys.slice(0, 3).map((item, index) => ({ label: item.label, value: (index + 2) * 1250000 }));
