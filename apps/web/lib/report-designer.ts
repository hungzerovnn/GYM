import { formatDate, formatDateTime } from "@/lib/format";
import { resolveTextDisplay, translateFieldLabel, translateText } from "@/lib/i18n/display";

type DesignerValueType = "text" | "currency" | "date" | "datetime" | "status";

export interface ReportDesignerBranding {
  companyName?: string;
  legalName?: string;
  address?: string;
  hotline?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  branchName?: string;
}

export interface ReportDesignerKeyValue {
  label: string;
  value: unknown;
  type?: DesignerValueType;
}

export interface ReportDesignerFontOption {
  key: string;
  label: string;
  css: string;
}

export interface ReportDesignerFieldSource {
  key: string;
  label: string;
  preview: string;
  isImage?: boolean;
  group: "branding" | "report" | "filter" | "summary" | "signature" | "system";
}

export interface ReportDesignerElement {
  id: string;
  type: "field" | "text" | "line" | "table";
  label: string;
  source: string;
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  fontWeight: "400" | "500" | "600" | "700";
  align: "left" | "center" | "right";
  fontFamily: string;
}

export interface ReportDesignerLayout {
  version: number;
  page: {
    paperSize: string;
    orientation: "PORTRAIT" | "LANDSCAPE";
    width: number;
    height: number;
    grid: number;
    margin: number;
  };
  elements: ReportDesignerElement[];
}

export interface ReportDesignerRenderOptions {
  reportKey?: string;
  templateKey?: string;
  templateFallbackKeys?: string[];
  title: string;
  subtitle: string;
  summary: ReportDesignerKeyValue[];
  filters: ReportDesignerKeyValue[];
  rows: Array<Record<string, unknown>>;
  columns: string[];
  template?: Record<string, unknown> | null;
  generatedBy?: string;
  branding?: ReportDesignerBranding | null;
  autoPrint?: boolean;
  showPreviewToolbar?: boolean;
}

export interface ReportDesignerPreviewBundle {
  markup: string;
  styles: string;
  layout: ReportDesignerLayout;
  effectiveTemplate: Record<string, unknown>;
  fieldSources: ReportDesignerFieldSource[];
}

const PAPER_DIMENSIONS: Record<string, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  A5: { width: 559, height: 794 },
  Letter: { width: 816, height: 1056 },
};

export const REPORT_DESIGNER_FONT_OPTIONS: ReportDesignerFontOption[] = [
  { key: "poppins", label: "Poppins", css: '"Poppins", "Segoe UI", Arial, sans-serif' },
  { key: "noto-sans", label: "Noto Sans", css: '"Noto Sans", "Segoe UI", Arial, sans-serif' },
  { key: "segoe-ui", label: "Segoe UI", css: '"Segoe UI", Arial, sans-serif' },
  { key: "arial", label: "Arial", css: "Arial, sans-serif" },
  { key: "times-new-roman", label: "Times New Roman", css: '"Times New Roman", serif' },
  { key: "georgia", label: "Georgia", css: "Georgia, serif" },
  { key: "monospace", label: "Consolas", css: 'Consolas, "Courier New", monospace' },
];

const FONT_MAP = Object.fromEntries(REPORT_DESIGNER_FONT_OPTIONS.map((font) => [font.key, font])) as Record<string, ReportDesignerFontOption>;

const DEFAULT_FILTER_SUMMARY = translateText("Du lieu duoc trich xuat theo bo loc hien tai cua bao cao.");
const DEFAULT_FOOTER_NOTE = translateText("Luu y: So lieu tren bao cao duoc trich xuat tai thoi diem in va can duoc doi chieu lai voi he thong neu can.");

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toParagraphs = (value: unknown) => escapeHtml(value).replaceAll("\n", "<br />");

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const asInt = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toBool = (value: unknown, fallback: boolean) => (value === undefined || value === null ? fallback : value === true || value === "true");

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const inferValueType = (label: string, value: unknown): DesignerValueType => {
  const normalizedLabel = label.toLowerCase();
  if (
    normalizedLabel.includes("amount") ||
    normalizedLabel.includes("price") ||
    normalizedLabel.includes("revenue") ||
    normalizedLabel.includes("debt") ||
    normalizedLabel.includes("profit") ||
    normalizedLabel.includes("value") ||
    normalizedLabel.includes("tong tien") ||
    normalizedLabel.includes("so tien")
  ) {
    return "currency";
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return "datetime";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
  if (normalizedLabel.includes("date") || normalizedLabel.endsWith("at") || normalizedLabel.includes("ngay") || normalizedLabel.includes("gio")) {
    return typeof value === "string" && value.includes("T") ? "datetime" : "date";
  }
  if (normalizedLabel.includes("status") || normalizedLabel.includes("trang thai")) return "status";
  return "text";
};

const formatValue = (label: string, value: unknown, type?: DesignerValueType) => {
  if (value === null || value === undefined || value === "") return "";
  const effectiveType = type || inferValueType(label, value);
  if (effectiveType === "currency") {
    const numeric = Number(value || 0);
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(numeric);
  }
  if (effectiveType === "datetime") return formatDateTime(String(value));
  if (effectiveType === "date") return formatDate(String(value));
  if (effectiveType === "status") return resolveTextDisplay(value, "status");
  if (typeof value === "boolean") return translateText(value ? "Co" : "Khong");
  return resolveTextDisplay(value, label);
};

const normalizePaperSize = (value: unknown) => {
  const normalized = String(value || "A4").trim();
  return PAPER_DIMENSIONS[normalized] ? normalized : "A4";
};

const normalizeOrientation = (value: unknown): "PORTRAIT" | "LANDSCAPE" => (String(value || "").toUpperCase() === "LANDSCAPE" ? "LANDSCAPE" : "PORTRAIT");

export const getReportDesignerPageDimensions = (paperSize: unknown, orientation: unknown) => {
  const normalizedPaperSize = normalizePaperSize(paperSize);
  const normalizedOrientation = normalizeOrientation(orientation);
  const base = PAPER_DIMENSIONS[normalizedPaperSize];
  return normalizedOrientation === "LANDSCAPE"
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
};

const resolveFontCss = (fontFamily: string) => FONT_MAP[fontFamily]?.css || FONT_MAP["noto-sans"].css;

const createElement = (element: Partial<ReportDesignerElement> & Pick<ReportDesignerElement, "id" | "type">): ReportDesignerElement => ({
  id: element.id,
  type: element.type,
  label: element.label || "",
  source: element.source || "",
  content: element.content || "",
  x: element.x ?? 0,
  y: element.y ?? 0,
  w: element.w ?? 120,
  h: element.h ?? 32,
  fontSize: element.fontSize ?? 12,
  fontWeight: element.fontWeight ?? "500",
  align: element.align ?? "left",
  fontFamily: element.fontFamily || "noto-sans",
});

export const createDefaultReportDesignerLayout = (
  paperSize: unknown = "A4",
  orientation: unknown = "PORTRAIT",
): ReportDesignerLayout => {
  const normalizedPaperSize = normalizePaperSize(paperSize);
  const normalizedOrientation = normalizeOrientation(orientation);
  const { width, height } = getReportDesignerPageDimensions(normalizedPaperSize, normalizedOrientation);
  const compact = height < 900;
  const margin = compact ? 34 : 44;
  const logoWidth = compact ? 136 : 182;
  const logoHeight = compact ? 54 : 72;
  const dividerTopY = compact ? 100 : 138;
  const titleY = compact ? 122 : 168;
  const subtitleY = compact ? 166 : 224;
  const filterY = compact ? 206 : 286;
  const headerNoteY = compact ? 242 : 344;
  const headerNoteHeight = compact ? 38 : 52;
  const footerNoteHeight = compact ? 44 : 58;
  const signatureBlockHeight = compact ? 120 : 168;
  const signatureDividerY = height - signatureBlockHeight - (compact ? 34 : 58);
  const footerNoteY = signatureDividerY - footerNoteHeight - (compact ? 12 : 20);
  const tableY = headerNoteY + headerNoteHeight + (compact ? 16 : 22);
  const tableHeight = clamp(footerNoteY - tableY - (compact ? 12 : 18), compact ? 220 : 280, height - tableY - 220);
  const signatureDateY = signatureDividerY + (compact ? 18 : 26);
  const signatureRowY = signatureDateY + (compact ? 34 : 44);
  const signatureHintY = signatureRowY + (compact ? 28 : 34);
  const signatureNameY = signatureHintY + (compact ? 56 : 72);
  const signatureWidth = Math.floor((width - margin * 2 - (compact ? 32 : 44)) / 3);
  const signatureGap = compact ? 16 : 22;

  return {
    version: 1,
    page: {
      paperSize: normalizedPaperSize,
      orientation: normalizedOrientation,
      width,
      height,
      grid: 8,
      margin,
    },
    elements: [
      createElement({ id: "company_logo", type: "field", label: translateText("Logo cong ty"), source: "companyLogo", x: margin, y: compact ? 30 : 34, w: logoWidth, h: logoHeight }),
      createElement({
        id: "company_name",
        type: "field",
        label: translateText("Cong ty"),
        source: "companyName",
        x: margin + logoWidth + 22,
        y: compact ? 30 : 36,
        w: width - margin * 2 - logoWidth - 160,
        h: compact ? 30 : 36,
        fontSize: compact ? 22 : 28,
        fontWeight: "700",
        fontFamily: "poppins",
      }),
      createElement({
        id: "company_meta",
        type: "field",
        label: translateText("Dong phu"),
        source: "companyMeta",
        x: margin + logoWidth + 22,
        y: compact ? 62 : 78,
        w: width - margin * 2 - logoWidth - 160,
        h: compact ? 34 : 46,
        fontSize: compact ? 11 : 13,
      }),
      createElement({
        id: "page_label",
        type: "field",
        label: translateText("So trang"),
        source: "pageLabel",
        x: width - margin - 132,
        y: compact ? 38 : 46,
        w: 132,
        h: 26,
        fontSize: compact ? 13 : 15,
        fontWeight: "600",
        align: "right",
      }),
      createElement({ id: "top_divider", type: "line", label: translateText("Duong ke dau trang"), x: margin, y: dividerTopY, w: width - margin * 2, h: 2 }),
      createElement({
        id: "report_title",
        type: "field",
        label: translateText("Tieu de"),
        source: "reportTitle",
        x: margin + 32,
        y: titleY,
        w: width - (margin + 32) * 2,
        h: compact ? 34 : 42,
        fontSize: compact ? 24 : 30,
        fontWeight: "700",
        align: "center",
        fontFamily: "poppins",
      }),
      createElement({
        id: "report_subtitle",
        type: "field",
        label: translateText("Mo ta"),
        source: "reportSubtitle",
        x: margin + 44,
        y: subtitleY,
        w: width - (margin + 44) * 2,
        h: compact ? 34 : 46,
        fontSize: compact ? 12 : 14,
        align: "center",
      }),
      createElement({
        id: "filter_summary",
        type: "field",
        label: translateText("Tieu de khi in"),
        source: "filterSummary",
        x: margin + 36,
        y: filterY,
        w: width - (margin + 36) * 2,
        h: compact ? 28 : 34,
        fontSize: compact ? 11 : 13,
        align: "center",
      }),
      createElement({
        id: "header_note",
        type: "field",
        label: translateText("Ghi chu dau bang"),
        source: "headerNote",
        x: margin + 12,
        y: headerNoteY,
        w: width - (margin + 12) * 2,
        h: headerNoteHeight,
        fontSize: compact ? 11 : 12,
        align: "center",
      }),
      createElement({ id: "data_table", type: "table", label: translateText("Bang du lieu"), source: "table", x: margin, y: tableY, w: width - margin * 2, h: tableHeight }),
      createElement({
        id: "footer_note",
        type: "field",
        label: translateText("Ghi chu cuoi bang"),
        source: "footerNote",
        x: margin + 12,
        y: footerNoteY,
        w: width - (margin + 12) * 2,
        h: footerNoteHeight,
        fontSize: compact ? 11 : 12,
      }),
      createElement({ id: "signature_divider", type: "line", label: translateText("Duong ke chu ky"), x: margin, y: signatureDividerY, w: width - margin * 2, h: 2 }),
      createElement({
        id: "signature_date",
        type: "field",
        label: translateText("Ngay ky"),
        source: "signatureDate",
        x: width - margin - 320,
        y: signatureDateY,
        w: 320,
        h: 26,
        fontSize: compact ? 12 : 14,
        align: "right",
      }),
      createElement({ id: "signature_left_title", type: "field", label: translateText("Chu ky trai"), source: "signatureLeftTitle", x: margin, y: signatureRowY, w: signatureWidth, h: 26, align: "center", fontSize: compact ? 14 : 16, fontWeight: "600", fontFamily: "times-new-roman" }),
      createElement({ id: "signature_center_title", type: "field", label: translateText("Chu ky giua"), source: "signatureCenterTitle", x: margin + signatureWidth + signatureGap, y: signatureRowY, w: signatureWidth, h: 26, align: "center", fontSize: compact ? 14 : 16, fontWeight: "600", fontFamily: "times-new-roman" }),
      createElement({ id: "signature_right_title", type: "field", label: translateText("Chu ky phai"), source: "signatureRightTitle", x: margin + (signatureWidth + signatureGap) * 2, y: signatureRowY, w: signatureWidth, h: 26, align: "center", fontSize: compact ? 14 : 16, fontWeight: "600", fontFamily: "times-new-roman" }),
      createElement({ id: "signature_left_hint", type: "field", label: translateText("Goi y ky trai"), source: "signatureLeftHint", x: margin, y: signatureHintY, w: signatureWidth, h: 24, align: "center", fontSize: compact ? 11 : 12, fontFamily: "times-new-roman" }),
      createElement({ id: "signature_center_hint", type: "field", label: translateText("Goi y ky giua"), source: "signatureCenterHint", x: margin + signatureWidth + signatureGap, y: signatureHintY, w: signatureWidth, h: 24, align: "center", fontSize: compact ? 11 : 12, fontFamily: "times-new-roman" }),
      createElement({ id: "signature_right_hint", type: "field", label: translateText("Goi y ky phai"), source: "signatureRightHint", x: margin + (signatureWidth + signatureGap) * 2, y: signatureHintY, w: signatureWidth, h: 24, align: "center", fontSize: compact ? 11 : 12, fontFamily: "times-new-roman" }),
      createElement({ id: "signature_left_name", type: "field", label: translateText("Ten ky trai"), source: "signatureLeftName", x: margin, y: signatureNameY, w: signatureWidth, h: 26, align: "center", fontSize: compact ? 14 : 16, fontWeight: "600", fontFamily: "times-new-roman" }),
      createElement({ id: "signature_center_name", type: "field", label: translateText("Ten ky giua"), source: "signatureCenterName", x: margin + signatureWidth + signatureGap, y: signatureNameY, w: signatureWidth, h: 26, align: "center", fontSize: compact ? 14 : 16, fontWeight: "600", fontFamily: "times-new-roman" }),
      createElement({ id: "signature_right_name", type: "field", label: translateText("Ten ky phai"), source: "signatureRightName", x: margin + (signatureWidth + signatureGap) * 2, y: signatureNameY, w: signatureWidth, h: 26, align: "center", fontSize: compact ? 14 : 16, fontWeight: "600", fontFamily: "times-new-roman" }),
    ],
  };
};

export const cloneReportDesignerLayout = (layout: ReportDesignerLayout) => deepClone(layout);

export const normalizeReportDesignerLayout = (
  raw: unknown,
  options?: { paperSize?: unknown; orientation?: unknown },
): ReportDesignerLayout => {
  const fallback = createDefaultReportDesignerLayout(options?.paperSize, options?.orientation);
  const source = asRecord(raw);
  const page = asRecord(source.page);
  const normalizedPaperSize = normalizePaperSize(page.paperSize || options?.paperSize || fallback.page.paperSize);
  const normalizedOrientation = normalizeOrientation(page.orientation || options?.orientation || fallback.page.orientation);
  const dimensions = getReportDesignerPageDimensions(normalizedPaperSize, normalizedOrientation);
  const normalizedPage = {
    paperSize: normalizedPaperSize,
    orientation: normalizedOrientation,
    width: dimensions.width,
    height: dimensions.height,
    grid: clamp(asInt(page.grid, fallback.page.grid), 4, 32),
    margin: clamp(asInt(page.margin, fallback.page.margin), 12, 80),
  } as ReportDesignerLayout["page"];

  const normalizeElement = (element: unknown, index: number): ReportDesignerElement => {
    const sourceElement = asRecord(element);
    const type = sourceElement.type === "line" || sourceElement.type === "table" || sourceElement.type === "field" ? sourceElement.type : "text";
    const isImageField = type === "field" && String(sourceElement.source || "").trim() === "companyLogo";
    const minWidth = type === "line" ? 80 : type === "table" ? 220 : isImageField ? 92 : 70;
    const minHeight = type === "line" ? 2 : type === "table" ? 160 : isImageField ? 58 : 22;
    const maxWidth = Math.max(minWidth, normalizedPage.width - normalizedPage.margin);
    const maxHeight = Math.max(minHeight, normalizedPage.height - normalizedPage.margin);
    return {
      id: String(sourceElement.id || `${type}_${index + 1}`),
      type,
      label: String(sourceElement.label || translateText("Doi tuong")),
      source: String(sourceElement.source || ""),
      content: String(sourceElement.content || ""),
      x: clamp(asInt(sourceElement.x, fallback.elements[index]?.x ?? normalizedPage.margin), 0, normalizedPage.width - minWidth),
      y: clamp(asInt(sourceElement.y, fallback.elements[index]?.y ?? normalizedPage.margin), 0, normalizedPage.height - minHeight),
      w: clamp(asInt(sourceElement.w, fallback.elements[index]?.w ?? 180), minWidth, maxWidth),
      h: clamp(asInt(sourceElement.h, fallback.elements[index]?.h ?? 32), minHeight, maxHeight),
      fontSize: clamp(asInt(sourceElement.fontSize, fallback.elements[index]?.fontSize ?? 12), 9, 42),
      fontWeight: sourceElement.fontWeight === "400" || sourceElement.fontWeight === "600" || sourceElement.fontWeight === "700" ? sourceElement.fontWeight : "500",
      align: sourceElement.align === "center" || sourceElement.align === "right" ? sourceElement.align : "left",
      fontFamily: FONT_MAP[String(sourceElement.fontFamily || "")] ? String(sourceElement.fontFamily) : fallback.elements[index]?.fontFamily || "noto-sans",
    };
  };

  return {
    version: 1,
    page: normalizedPage,
    elements: Array.isArray(source.elements) && source.elements.length ? source.elements.map(normalizeElement) : fallback.elements.map((element, index) => normalizeElement(element, index)),
  };
};

const resolveScopedTemplate = (
  template: Record<string, unknown> | null | undefined,
  templateKey?: string,
  templateFallbackKeys: string[] = [],
  reportKey?: string,
) => {
  const baseTemplate = asRecord(template);
  const scopedTemplateSource = asRecord(baseTemplate.reportTemplates);
  const candidateKeys = Array.from(new Set([templateKey, ...templateFallbackKeys, reportKey].map((value) => String(value || "").trim()).filter(Boolean)));
  const scopedTemplate =
    candidateKeys
      .map((key) => asRecord(scopedTemplateSource[key]))
      .find((item) => Object.keys(item).length > 0) || {};
  const effectiveTemplate = {
    ...baseTemplate,
    defaultTitle: scopedTemplate.title || baseTemplate.defaultTitle,
    defaultSubtitle: scopedTemplate.subtitle || baseTemplate.defaultSubtitle,
    reportHeader: scopedTemplate.header || baseTemplate.reportHeader,
    reportFooter: scopedTemplate.footer || baseTemplate.reportFooter,
    paperSize: scopedTemplate.paperSize || baseTemplate.paperSize,
    defaultOrientation: scopedTemplate.orientation || baseTemplate.defaultOrientation,
    showGeneratedBy: scopedTemplate.showGeneratedBy ?? baseTemplate.showGeneratedBy,
    showPrintedAt: scopedTemplate.showPrintedAt ?? baseTemplate.showPrintedAt,
    showFilters: scopedTemplate.showFilters ?? baseTemplate.showFilters,
    showSignature: scopedTemplate.showSignature ?? baseTemplate.showSignature,
    note: baseTemplate.note,
    defaultDesigner: baseTemplate.defaultDesigner,
  };

  const rawDesigner = scopedTemplate.designer || baseTemplate.defaultDesigner;
  const designerLayout = normalizeReportDesignerLayout(rawDesigner, {
    paperSize: effectiveTemplate.paperSize || "A4",
    orientation: effectiveTemplate.defaultOrientation || "PORTRAIT",
  });

  return { effectiveTemplate, designerLayout };
};

const buildDynamicSourceEntries = (prefix: "summary" | "filter", items: ReportDesignerKeyValue[], group: ReportDesignerFieldSource["group"]) =>
  items
    .filter((item) => item.value !== null && item.value !== undefined && item.value !== "")
    .map((item) => ({
      key: `${prefix}.${slugify(item.label)}`,
      label: item.label,
      preview: formatValue(item.label, item.value, item.type),
      group,
    }));

const estimateRowHeight = (row: Record<string, unknown>, columns: string[], tableWidth: number, fontSize: number) => {
  const columnCount = Math.max(columns.length, 1);
  const columnWidth = Math.max(60, Math.floor(tableWidth / columnCount));
  return Math.max(
    32,
    ...columns.map((column) => {
      const safeText = formatValue(column, row[column]).replace(/\s+/g, " ").trim();
      const charsPerLine = Math.max(8, Math.floor((columnWidth - 18) / Math.max(fontSize * 0.58, 7)));
      const lineCount = Math.max(1, Math.ceil((safeText.length || 1) / charsPerLine));
      return lineCount * (fontSize + 7) + 8;
    }),
  );
};

const chunkRowsByHeight = (rows: Array<Record<string, unknown>>, columns: string[], tableWidth: number, tableHeight: number) => {
  const headerHeight = 38;
  const availableHeight = Math.max(160, tableHeight - headerHeight);
  const chunks: Array<Array<Record<string, unknown>>> = [];
  let currentChunk: Array<Record<string, unknown>> = [];
  let currentHeight = 0;

  rows.forEach((row) => {
    const rowHeight = estimateRowHeight(row, columns, tableWidth, 11);
    if (currentChunk.length > 0 && currentHeight + rowHeight > availableHeight) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentHeight = 0;
    }
    currentChunk.push(row);
    currentHeight += rowHeight;
  });

  if (!chunks.length && !currentChunk.length) return [[]];
  if (currentChunk.length) chunks.push(currentChunk);
  return chunks;
};

const buildCompanyMeta = (branding?: ReportDesignerBranding | null) =>
  [
    branding?.legalName,
    branding?.branchName ? `${translateText("Chi nhanh")}: ${branding.branchName}` : "",
    branding?.address,
    branding?.hotline ? `Hotline: ${branding.hotline}` : "",
    branding?.website,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" | ");

const buildSignatureDate = (companyName: string, branchName?: string) =>
  `${branchName || companyName || translateText("He thong")}, ${translateText("ngay")} ${formatDate(new Date().toISOString().slice(0, 10))}`;

const isSignatureSource = (source: string) => source.startsWith("signature");

const createSourceMap = ({
  effectiveTemplate,
  title,
  subtitle,
  summary,
  filters,
  generatedBy,
  branding,
}: {
  effectiveTemplate: Record<string, unknown>;
  title: string;
  subtitle: string;
  summary: ReportDesignerKeyValue[];
  filters: ReportDesignerKeyValue[];
  generatedBy?: string;
  branding?: ReportDesignerBranding | null;
}) => {
  const showGeneratedBy = toBool(effectiveTemplate.showGeneratedBy, true);
  const showPrintedAt = toBool(effectiveTemplate.showPrintedAt, true);
  const showFilters = toBool(effectiveTemplate.showFilters, true);
  const showSignature = toBool(effectiveTemplate.showSignature, true);
  const companyName = String(branding?.companyName || effectiveTemplate.companyName || "FitFlow Enterprise");
  const summaryLine = summary
    .filter((item) => item.value !== null && item.value !== undefined && item.value !== "")
    .slice(0, 4)
    .map((item) => `${item.label}: ${formatValue(item.label, item.value, item.type)}`)
    .join(" | ");
  const filterSummary = showFilters
    ? filters
        .filter((item) => item.value !== null && item.value !== undefined && item.value !== "")
        .map((item) => `${item.label}: ${formatValue(item.label, item.value, item.type)}`)
        .join(" | ") || DEFAULT_FILTER_SUMMARY
    : "";
  const printedAt = showPrintedAt ? formatDateTime(new Date().toISOString()) : "";
  const headerNote = String(effectiveTemplate.reportHeader || "").trim() || summaryLine;
  const footerNote = String(effectiveTemplate.reportFooter || effectiveTemplate.note || "").trim() || DEFAULT_FOOTER_NOTE;

  const baseEntries: ReportDesignerFieldSource[] = [
    { key: "companyLogo", label: translateText("Logo cong ty"), preview: String(branding?.logoUrl || ""), isImage: true, group: "branding" },
    { key: "companyName", label: translateText("Cong ty"), preview: companyName, group: "branding" },
    { key: "companyMeta", label: translateText("Dong phu"), preview: buildCompanyMeta(branding), group: "branding" },
    { key: "reportTitle", label: translateText("Tieu de"), preview: title, group: "report" },
    { key: "reportSubtitle", label: translateText("Mo ta"), preview: subtitle, group: "report" },
    { key: "filterSummary", label: translateText("Dong bo loc"), preview: filterSummary, group: "filter" },
    { key: "summaryLine", label: translateText("Tong quan"), preview: summaryLine, group: "summary" },
    { key: "headerNote", label: translateText("Ghi chu dau bang"), preview: headerNote, group: "report" },
    { key: "footerNote", label: translateText("Ghi chu cuoi bang"), preview: footerNote, group: "report" },
    { key: "generatedBy", label: translateText("Nguoi xuat"), preview: showGeneratedBy ? String(generatedBy || "") : "", group: "system" },
    { key: "printedAt", label: translateText("Thoi gian in"), preview: printedAt, group: "system" },
    { key: "pageLabel", label: translateText("So trang"), preview: "Trang 1 / 1", group: "system" },
    { key: "pageNumber", label: translateText("Trang hien tai"), preview: "1", group: "system" },
    { key: "pageCount", label: translateText("Tong so trang"), preview: "1", group: "system" },
    {
      key: "signatureDate",
      label: translateText("Ngay ky"),
      preview: showSignature ? buildSignatureDate(companyName, String(branding?.branchName || "")) : "",
      group: "signature",
    },
    { key: "signatureLeftTitle", label: translateText("Tieu de ky trai"), preview: showSignature ? String(effectiveTemplate.signatureLeftTitle || translateText("Nguoi lap bieu")) : "", group: "signature" },
    { key: "signatureCenterTitle", label: translateText("Tieu de ky giua"), preview: showSignature ? String(effectiveTemplate.signatureCenterTitle || translateText("Ke toan truong")) : "", group: "signature" },
    { key: "signatureRightTitle", label: translateText("Tieu de ky phai"), preview: showSignature ? String(effectiveTemplate.signatureRightTitle || translateText("Quan ly phe duyet")) : "", group: "signature" },
    { key: "signatureLeftHint", label: translateText("Goi y ky trai"), preview: showSignature ? translateText("(Ky, ghi ro ho ten)") : "", group: "signature" },
    { key: "signatureCenterHint", label: translateText("Goi y ky giua"), preview: showSignature ? translateText("(Ky, ghi ro ho ten)") : "", group: "signature" },
    { key: "signatureRightHint", label: translateText("Goi y ky phai"), preview: showSignature ? translateText("(Ky, ghi ro ho ten)") : "", group: "signature" },
    { key: "signatureLeftName", label: translateText("Ten ky trai"), preview: showSignature ? String(effectiveTemplate.signatureLeftName || "") : "", group: "signature" },
    { key: "signatureCenterName", label: translateText("Ten ky giua"), preview: showSignature ? String(effectiveTemplate.signatureCenterName || "") : "", group: "signature" },
    { key: "signatureRightName", label: translateText("Ten ky phai"), preview: showSignature ? String(effectiveTemplate.signatureRightName || "") : "", group: "signature" },
  ];

  return [...baseEntries, ...buildDynamicSourceEntries("filter", filters, "filter"), ...buildDynamicSourceEntries("summary", summary, "summary")];
};

const resolveSourcePreview = (sourceMap: Map<string, ReportDesignerFieldSource>, key: string) => sourceMap.get(key)?.preview || "";

const resolvePageElements = (layout: ReportDesignerLayout, rows: Array<Record<string, unknown>>, columns: string[]) => {
  const tableElement = layout.elements.find((element) => element.type === "table");
  if (!tableElement) return [{ rows, pageNumber: 1, pageCount: 1 }];
  return chunkRowsByHeight(rows, columns, tableElement.w, tableElement.h).map((chunk, index, chunks) => ({
    rows: chunk,
    pageNumber: index + 1,
    pageCount: chunks.length,
  }));
};

const shouldRenderElementOnPage = (element: ReportDesignerElement, tableElement: ReportDesignerElement | undefined, pageNumber: number, pageCount: number) => {
  if (!tableElement || pageCount === 1 || element.type === "table") return true;
  const tableTop = tableElement.y;
  const tableBottom = tableElement.y + tableElement.h;
  if (element.y + element.h <= tableTop) return true;
  if (element.y >= tableBottom) return pageNumber === pageCount;
  return pageNumber === 1;
};

const buildTableMarkup = (columns: string[], rows: Array<Record<string, unknown>>) => {
  if (!rows.length) {
    return `<div class="report-designer-table-empty">${escapeHtml(translateText("Khong co du lieu de hien thi"))}</div>`;
  }

  return `
    <div class="report-designer-table-wrap">
      <table class="report-designer-table">
        <thead>
          <tr>
            ${columns.map((column) => `<th>${escapeHtml(translateFieldLabel(column))}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${columns.map((column) => `<td>${toParagraphs(formatValue(column, row[column]))}</td>`).join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
};

const buildElementMarkup = (
  element: ReportDesignerElement,
  sourceMap: Map<string, ReportDesignerFieldSource>,
  pageNumber: number,
  pageCount: number,
  tableRows: Array<Record<string, unknown>>,
  columns: string[],
  effectiveTemplate: Record<string, unknown>,
) => {
  const style = [
    `left:${element.x}px`,
    `top:${element.y}px`,
    `width:${element.w}px`,
    `height:${element.h}px`,
    `font-size:${element.fontSize}px`,
    `font-weight:${element.fontWeight}`,
    `text-align:${element.align}`,
    `justify-content:${element.align === "center" ? "center" : element.align === "right" ? "flex-end" : "flex-start"}`,
    `font-family:${resolveFontCss(element.fontFamily)}`,
  ].join(";");

  if (element.type === "line") {
    return `<div class="report-designer-element report-designer-element-line" style="${style}"><span class="report-designer-line" style="height:${Math.max(1, element.h)}px"></span></div>`;
  }

  if (element.type === "table") {
    return `<div class="report-designer-element report-designer-element-table" style="${style}">${buildTableMarkup(columns, tableRows)}</div>`;
  }

  const localSourceMap = new Map(sourceMap);
  localSourceMap.set("pageLabel", { key: "pageLabel", label: translateText("So trang"), preview: `${translateText("Trang")} ${pageNumber} / ${pageCount}`, group: "system" });
  localSourceMap.set("pageNumber", { key: "pageNumber", label: translateText("Trang hien tai"), preview: String(pageNumber), group: "system" });
  localSourceMap.set("pageCount", { key: "pageCount", label: translateText("Tong so trang"), preview: String(pageCount), group: "system" });

  if (!toBool(effectiveTemplate.showSignature, false) && isSignatureSource(element.source)) return "";

  const content = element.type === "text" ? element.content : resolveSourcePreview(localSourceMap, element.source);
  if (!content && element.source !== "companyLogo") return "";

  if (element.source === "companyLogo") {
    if (!content) return "";
    return `<div class="report-designer-element report-designer-element-image report-designer-element-image-logo" style="${style}"><img alt="${escapeHtml(element.label || translateText("Logo"))}" class="report-designer-image" src="${escapeHtml(content)}" /></div>`;
  }

  return `<div class="report-designer-element report-designer-element-text" style="${style}"><div class="report-designer-text">${toParagraphs(content)}</div></div>`;
};

const reportDesignerStyles = `
  :root { color-scheme: light; }
  @page { margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f5f7fb; color: #0f172a; font-family: "Segoe UI", Arial, sans-serif; }
  .report-designer-toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-bottom: 1px solid #d9e2ef; background: rgba(248, 250, 252, 0.96); backdrop-filter: blur(10px); }
  .report-designer-toolbar p { margin: 0; color: #0f766e; font-size: 12px; font-weight: 600; }
  .report-designer-toolbar .actions { display: flex; align-items: center; gap: 10px; }
  .report-designer-toolbar button { border: 1px solid #0f766e; border-radius: 999px; background: #ffffff; color: #0f766e; padding: 10px 14px; font-size: 12px; font-weight: 700; cursor: pointer; }
  .report-designer-toolbar button.primary { background: #0f766e; color: #ffffff; }
  .report-designer-preview-stack { display: grid; gap: 28px; justify-items: center; padding: 20px 0; }
  .report-designer-page { position: relative; overflow: hidden; border: 1px solid #d5dfec; border-radius: 24px; background: #ffffff; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12); page-break-after: always; }
  .report-designer-element { position: absolute; min-width: 0; }
  .report-designer-element-text .report-designer-text { display: flex; align-items: center; justify-content: inherit; width: 100%; height: 100%; line-height: 1.35; color: #0f172a; white-space: pre-wrap; word-break: break-word; }
  .report-designer-element-image { display: flex; align-items: center; justify-content: center; }
  .report-designer-element-image-logo { justify-content: flex-start; }
  .report-designer-image { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
  .report-designer-element-image-logo .report-designer-image { object-position: left center; }
  .report-designer-element-line { display: flex; align-items: center; }
  .report-designer-line { display: block; width: 100%; background: #0f172a; }
  .report-designer-element-table { overflow: hidden; border: 1px solid #d5dfec; border-radius: 16px; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); }
  .report-designer-table-wrap { width: 100%; height: 100%; overflow: hidden; }
  .report-designer-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .report-designer-table thead { background: #eff6ff; }
  .report-designer-table th, .report-designer-table td { padding: 9px 10px; border: 1px solid #d5dfec; font-size: 11px; line-height: 1.45; text-align: left; vertical-align: top; color: #0f172a; word-break: break-word; }
  .report-designer-table th { color: #334155; font-weight: 700; background: #eff6ff; }
  .report-designer-table-empty { display: flex; align-items: center; justify-content: center; height: 100%; padding: 18px; color: #64748b; font-size: 12px; text-align: center; }
  @media print {
    body { background: #ffffff; }
    .report-designer-toolbar { display: none !important; }
    .report-designer-preview-stack { display: block; padding: 0; }
    .report-designer-page { margin: 0 auto 18px; break-after: page; box-shadow: none; border: none; border-radius: 0; }
  }
`;

export const buildReportDesignerPreviewBundle = (options: ReportDesignerRenderOptions): ReportDesignerPreviewBundle => {
  const { effectiveTemplate, designerLayout } = resolveScopedTemplate(options.template, options.templateKey, options.templateFallbackKeys, options.reportKey);
  const reportTitle = String(effectiveTemplate.defaultTitle || options.title || translateText("Bao cao"));
  const reportSubtitle = String(effectiveTemplate.defaultSubtitle || options.subtitle || "");
  const columns = options.columns.length ? options.columns : Object.keys(options.rows[0] || {});
  const fieldSources = createSourceMap({
    effectiveTemplate,
    title: reportTitle,
    subtitle: reportSubtitle,
    summary: options.summary,
    filters: options.filters,
    generatedBy: options.generatedBy,
    branding: options.branding,
  });
  const sourceMap = new Map(fieldSources.map((item) => [item.key, item]));
  const pages = resolvePageElements(designerLayout, options.rows, columns);
  const tableElement = designerLayout.elements.find((element) => element.type === "table");
  const markup = `
    <div class="report-designer-preview-stack">
      ${pages
        .map(
          (page) => `
            <article class="report-designer-page" style="width:${designerLayout.page.width}px;height:${designerLayout.page.height}px;">
              ${designerLayout.elements
                .map((element) =>
                  shouldRenderElementOnPage(element, tableElement, page.pageNumber, page.pageCount)
                    ? buildElementMarkup(element, sourceMap, page.pageNumber, page.pageCount, page.rows, columns, effectiveTemplate)
                    : "",
                )
                .join("")}
            </article>
          `,
        )
        .join("")}
    </div>
  `;

  return {
    markup,
    styles: reportDesignerStyles,
    layout: designerLayout,
    effectiveTemplate,
    fieldSources,
  };
};

export const buildReportDesignerPrintHtml = (options: ReportDesignerRenderOptions) => {
  const bundle = buildReportDesignerPreviewBundle(options);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(options.title)}</title>
        <style>${bundle.styles}</style>
      </head>
      <body>
        ${
          options.showPreviewToolbar
            ? `
              <div class="report-designer-toolbar">
                <p>${escapeHtml(translateText("Xem truoc mau in. Neu thay on, bam In de mo hop thoai may in."))}</p>
                <div class="actions">
                  <button type="button" onclick="window.close()">${escapeHtml(translateText("Dong"))}</button>
                  <button class="primary" type="button" onclick="window.print()">${escapeHtml(translateText("In"))}</button>
                </div>
              </div>
            `
            : ""
        }
        ${bundle.markup}
        <script>
          ${
            options.autoPrint === false
              ? ""
              : `
                window.addEventListener("load", function () {
                  window.setTimeout(function () {
                    window.focus();
                    window.print();
                  }, 120);
                });
                window.addEventListener("afterprint", function () {
                  window.close();
                });
              `
          }
        </script>
      </body>
    </html>
  `;
};
