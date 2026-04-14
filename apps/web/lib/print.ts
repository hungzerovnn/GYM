import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { translateText } from "@/lib/i18n/display";
import { resolvePrintAssetUrl } from "@/lib/print-scope";
import { buildReportDesignerPrintHtml, ReportDesignerBranding } from "@/lib/report-designer";
import { ResourceColumn } from "@/types/portal";

type PrintValueType = "text" | "currency" | "date" | "datetime" | "status";
type DocumentProfile = "receipt" | "expense" | "sale" | "return";

interface PrintKeyValue {
  label: string;
  value: unknown;
  type?: PrintValueType;
}

interface PrintSection {
  title: string;
  items: PrintKeyValue[];
}

interface PrintResourceListOptions {
  title: string;
  subtitle: string;
  columns: ResourceColumn[];
  rows: Array<Record<string, unknown>>;
  filters?: PrintKeyValue[];
  template?: Record<string, unknown> | null;
  profile: DocumentProfile;
  branding?: ReportDesignerBranding | null;
}

interface PrintResourceRecordOptions {
  title: string;
  subtitle: string;
  entries: PrintKeyValue[];
  record?: Record<string, unknown>;
  filters?: PrintKeyValue[];
  template?: Record<string, unknown> | null;
  profile?: DocumentProfile | null;
  branding?: ReportDesignerBranding | null;
  targetWindow?: Window | null;
}

interface PrintSettingPreviewOptions {
  title: string;
  subtitle: string;
  sections: PrintSection[];
  note?: string;
}

interface PrintReportOptions {
  reportKey?: string;
  templateKey?: string;
  templateFallbackKeys?: string[];
  autoPrint?: boolean;
  showPreviewToolbar?: boolean;
  title: string;
  subtitle: string;
  summary: PrintKeyValue[];
  filters: PrintKeyValue[];
  rows: Array<Record<string, unknown>>;
  columns: string[];
  template?: Record<string, unknown> | null;
  generatedBy?: string;
  branding?: ReportDesignerBranding | null;
}

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toParagraphs = (value: unknown) => escapeHtml(value).replaceAll("\n", "<br />");

const toLabel = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();

const reportColumnLabelOverrides: Record<string, string> = {
  actualRevenue: "Doanh thu thực đạt",
  activeContracts: "Hợp đồng đang hoạt động",
  activeMembers: "Hội viên đang hoạt động",
  amountDue: "Số tiền còn nợ",
  attendanceCode: "Mã chấm công",
  attendanceDate: "Ngày chấm công",
  attendanceStatus: "Trạng thái chấm công",
  attendanceRate: "Tỷ lệ điểm danh",
  bookedMembers: "Hội viên đã đặt",
  bookedSessions: "Số lịch đặt",
  branch: "Chi nhánh",
  cancelledSessions: "Đã hủy",
  checkedInSessions: "Đã check-in",
  collectedAmount: "Đã thu",
  collectedRevenue: "Doanh thu thu về",
  completedMembers: "Hội viên đã học",
  completedSessions: "Đã hoàn thành",
  completionRate: "Tỷ lệ hoàn thành",
  consumedSessions: "Số buổi đã dùng",
  contractCode: "Mã hợp đồng",
  customerName: "Khách hàng",
  eventCount: "Số sự kiện",
  firstCheckInAt: "Check-in đầu tiên",
  lastCheckOutAt: "Check-out cuối",
  lateMinutes: "Phút đi muộn",
  lastCheckInAt: "Check-in gần nhất",
  lastScheduledAt: "Lịch gần nhất",
  machineNames: "Máy chấm công",
  memberName: "Hội viên",
  membershipStatus: "Trạng thái hội viên",
  missedSessions: "Vắng mặt",
  netProfit: "Lợi nhuận ròng",
  outstandingDebt: "Công nợ",
  overtimeMinutes: "Phút tăng ca",
  packageName: "Gói tập",
  performanceIndex: "Chỉ số hiệu suất",
  ptRevenue: "Doanh thu PT",
  remainingSessions: "Số buổi còn lại",
  remainingValue: "Giá trị còn lại",
  role: "Vai trò",
  scheduledSessions: "Buổi đã lên lịch",
  shiftWindow: "Ca làm",
  staffCode: "Mã nhân viên",
  staffName: "Nhân viên",
  totalExpense: "Tổng chi phí",
  totalRevenue: "Tổng doanh thu",
  trainerName: "PT phụ trách",
  usedSessions: "Số buổi đã dùng",
  verificationMethods: "Hình thức xác thực",
  workedHours: "Giờ làm",
  contractCount: "So hop dong",
  contractSaleType: "Loai hop dong",
  currentContractValue: "Gia tri HD hien tai",
  customerCount: "So hoi vien",
  expiryStage: "Tinh trang het han",
  previousCollectedAmount: "Da thu truoc ky",
  previousContractCount: "HD truoc ky",
  previousRevenue: "Doanh thu truoc ky",
  renewContracts: "HD gia han",
  bonusAmount: "Tien thuong",
  bonusRatePercent: "Ty le thuong",
  otherSourceRevenue: "DT nguon khac",
  paidSourceRevenue: "DT nguon ads / meta",
  qualifiedRevenue: "Doanh thu quy doi",
  selfSourceRevenue: "DT nguon tu khai thac",
  serviceGroup: "Nhom dich vu",
  targetRevenue: "Target doanh thu",
  targetStatus: "Trang thai KPI",
  tierBasisRevenue: "Doanh thu xep bac",
  tierLabel: "Bac thuong",
};

const toReportLabel = (value: string) => reportColumnLabelOverrides[value] || toLabel(value);

const asBoolean = (value: unknown) => value === true || value === "true";

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const inferType = (label: string, value: unknown): PrintValueType => {
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

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return "datetime";
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "date";
  }

  if (
    normalizedLabel.includes("date") ||
    normalizedLabel.endsWith("at") ||
    normalizedLabel.includes("ngay") ||
    normalizedLabel.includes("gio") ||
    normalizedLabel.includes("time")
  ) {
    return typeof value === "string" && value.includes("T") ? "datetime" : "date";
  }

  if (normalizedLabel.includes("status") || normalizedLabel.includes("trang thai")) {
    return "status";
  }

  return "text";
};

const formatPrintValue = (label: string, value: unknown, type?: PrintValueType) => {
  if (value === null || value === undefined || value === "") return "-";

  const effectiveType = type || inferType(label, value);

  if (effectiveType === "currency") {
    return formatCurrency(Number(value || 0));
  }

  if (effectiveType === "datetime") {
    return formatDateTime(String(value));
  }

  if (effectiveType === "date") {
    return formatDate(String(value));
  }

  if (effectiveType === "status") {
    return toLabel(String(value)).toUpperCase();
  }

  if (typeof value === "boolean") {
    return value ? "Co" : "Khong";
  }

  return String(value);
};

const buildKeyValueGrid = (items: PrintKeyValue[]) => {
  if (!items.length) return "";

  return `
    <div class="kv-grid">
      ${items
        .map(
          (item) => `
            <article class="kv-card">
              <p class="kv-label">${escapeHtml(item.label)}</p>
              <p class="kv-value">${toParagraphs(formatPrintValue(item.label, item.value, item.type))}</p>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
};

const getVisibleItems = (items: PrintKeyValue[]) =>
  items.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");

const chunkItems = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const buildPrintSection = (title: string, items: PrintKeyValue[]) => {
  const visibleItems = getVisibleItems(items);
  if (!visibleItems.length) return "";

  return buildReportMetaTable(title, visibleItems, 2);
};

const buildHeroGrid = (items: Array<PrintKeyValue & { emphasize?: boolean }>) => {
  const visibleItems = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
  if (!visibleItems.length) return "";

  return `
    <section>
      <div class="hero-grid">
        ${visibleItems
          .map(
            (item) => `
              <article class="hero-card${item.emphasize ? " hero-card-emphasize" : ""}">
                <p class="hero-label">${escapeHtml(item.label)}</p>
                <p class="hero-value">${toParagraphs(formatPrintValue(item.label, item.value, item.type))}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
};

const buildNotePanel = (title: string, value: unknown) => {
  if (value === null || value === undefined || value === "") return "";

  return `
    <section>
      <p class="section-title">${escapeHtml(title)}</p>
      <div class="note-box">${toParagraphs(String(value))}</div>
    </section>
  `;
};

const buildLineItemsSection = (title: string, value: unknown) => {
  if (!Array.isArray(value) || !value.length) return "";

  const rows = value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  if (!rows.length) return "";

  return `
    <section>
      <p class="section-title">${escapeHtml(title)}</p>
      ${buildTable(
        [
          { key: "productCode", label: "Ma SP" },
          { key: "productName", label: "Ten san pham" },
          { key: "quantity", label: "So luong" },
          { key: "unitPrice", label: "Don gia", type: "currency" },
          { key: "totalPrice", label: "Thanh tien", type: "currency" },
          { key: "note", label: "Ghi chu" },
        ],
        rows,
      )}
    </section>
  `;
};

const buildTable = (
  columns: Array<{ key: string; label: string; type?: "text" | "date" | "currency" | "status" }>,
  rows: Array<Record<string, unknown>>,
) => {
  if (!rows.length) {
    return `<div class="empty-state">${escapeHtml(translateText("Khong co du lieu de in voi bo loc hien tai."))}</div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${columns
                    .map((column) => `<td>${toParagraphs(formatPrintValue(column.key, row[column.key], column.type as PrintValueType | undefined))}</td>`)
                    .join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
};

const buildReportMetaTable = (title: string, items: PrintKeyValue[], columnsPerRow = 2) => {
  const visibleItems = getVisibleItems(items);
  if (!visibleItems.length) return "";

  const rows = chunkItems(visibleItems, columnsPerRow);
  const expectedCellPairs = columnsPerRow;

  return `
    <section class="report-section">
      <p class="report-section-title">${escapeHtml(title)}</p>
      <table class="report-meta-table">
        <tbody>
          ${rows
            .map((row) => {
              const cells = row
                .map(
                  (item) => `
                    <th>${escapeHtml(item.label)}</th>
                    <td>${toParagraphs(formatPrintValue(item.label, item.value, item.type))}</td>
                  `,
                )
                .join("");
              const fillers = Array.from({ length: Math.max(0, expectedCellPairs - row.length) })
                .map(() => "<th></th><td></td>")
                .join("");

              return `<tr>${cells}${fillers}</tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </section>
  `;
};

const buildReportDataTable = (
  columns: Array<{ key: string; label: string; type?: "text" | "date" | "currency" | "status" }>,
  rows: Array<Record<string, unknown>>,
) => {
  if (!rows.length) {
    return `<div class="empty-state">${escapeHtml(translateText("Khong co du lieu de in voi bo loc hien tai."))}</div>`;
  }

  return `
    <div class="report-data-wrap">
      <table class="report-data-table">
        <thead>
          <tr>
            <th class="index-col">STT</th>
            ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row, index) => `
                <tr>
                  <td class="index-col">${index + 1}</td>
                  ${columns
                    .map((column) => `<td>${toParagraphs(formatPrintValue(column.key, row[column.key], column.type as PrintValueType | undefined))}</td>`)
                    .join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
};

const getDocumentTemplate = (profile: DocumentProfile | null | undefined, template?: Record<string, unknown> | null) => {
  const source = template || {};

  if (!profile) {
    return {
      header: String(source.receiptHeader || source.contractHeader || ""),
      footer: String(source.receiptFooter || source.note || ""),
    };
  }

  switch (profile) {
    case "sale":
      return {
        header: String(source.salesHeader || source.receiptHeader || source.contractHeader || ""),
        footer: String(source.salesFooter || source.receiptFooter || source.note || ""),
      };
    case "return":
      return {
        header: String(source.returnHeader || source.expenseHeader || ""),
        footer: String(source.returnFooter || source.expenseFooter || source.note || ""),
      };
    case "expense":
      return {
        header: String(source.expenseHeader || ""),
        footer: String(source.expenseFooter || source.note || ""),
      };
    case "receipt":
    default:
      return {
        header: String(source.receiptHeader || source.contractHeader || ""),
        footer: String(source.receiptFooter || source.note || ""),
      };
  }
};

const getRecordValue = (record: Record<string, unknown> | undefined, keys: string[]) => {
  if (!record) return undefined;

  for (const key of keys) {
    const value = record[key];
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return undefined;
};

const normalizeOrientation = (value: unknown): "portrait" | "landscape" =>
  String(value || "").toUpperCase() === "LANDSCAPE" ? "landscape" : "portrait";

const resolveTemplateBranding = (
  branding?: ReportDesignerBranding | null,
  template?: Record<string, unknown> | null,
) => {
  if (!branding) return branding;

  const hideLogo =
    template?.showLogo === false || template?.showLogo === "false";
  if (!hideLogo) {
    return branding;
  }

  return {
    ...branding,
    logoUrl: "",
  };
};

const resolveDocumentBranchName = (record?: Record<string, unknown>, branding?: ReportDesignerBranding | null) =>
  String(getRecordValue(record, ["branchName"]) || branding?.branchName || "").trim();

const resolveDocumentSubject = (record?: Record<string, unknown>) => {
  const memberName = getRecordValue(record, ["customerName", "memberName", "fullName", "currentCustomerName"]);
  if (memberName) {
    return { label: translateText("Hoi vien"), value: memberName };
  }

  const payeeName = getRecordValue(record, ["payeeName"]);
  if (payeeName) {
    return { label: translateText("Doi tuong"), value: payeeName };
  }

  return null;
};

const buildHeaderMetaItems = ({
  record,
  branding,
  extraItems = [],
}: {
  record?: Record<string, unknown>;
  branding?: ReportDesignerBranding | null;
  extraItems?: PrintKeyValue[];
}) => {
  const subject = resolveDocumentSubject(record);
  const branchName = resolveDocumentBranchName(record, branding);

  return getVisibleItems([
    branchName ? { label: translateText("Chi nhanh"), value: branchName } : null,
    subject ? { label: subject.label, value: subject.value } : null,
    { label: translateText("In luc"), value: new Date().toISOString(), type: "datetime" },
    ...extraItems,
  ].filter(Boolean) as PrintKeyValue[]);
};

const buildPrintHeader = ({
  eyebrow,
  title,
  subtitle,
  headerNote,
  branding,
  headerMetaItems,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  headerNote?: string;
  branding?: ReportDesignerBranding | null;
  headerMetaItems?: PrintKeyValue[];
}) => {
  const visibleMetaItems = getVisibleItems(headerMetaItems || []);
  const normalizedLogoUrl = resolvePrintAssetUrl(String(branding?.logoUrl || ""));
  const companyLines = [
    branding?.legalName,
    branding?.branchName ? `${translateText("Chi nhanh")}: ${branding.branchName}` : "",
    branding?.address,
    branding?.hotline ? `Hotline: ${branding.hotline}` : "",
    branding?.email,
    branding?.website,
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return `
    <header class="print-header">
      <div class="brand-panel${normalizedLogoUrl ? " brand-panel-has-logo" : ""}">
        ${
          normalizedLogoUrl
            ? `<div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(normalizedLogoUrl)}" alt="${escapeHtml(branding?.companyName || "Logo")}" /></div>`
            : ""
        }
        <div class="brand-copy">
          <p class="brand-name">${escapeHtml(branding?.companyName || branding?.legalName || translateText("He thong"))}</p>
          ${companyLines.length ? `<p class="brand-meta">${escapeHtml(companyLines.join(" | "))}</p>` : ""}
        </div>
      </div>
      <div class="title-panel">
        ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
        <h1>${escapeHtml(title)}</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
      </div>
      <div class="header-meta-panel">
        ${
          visibleMetaItems.length
            ? visibleMetaItems
                .map(
                  (item) => `
                    <div class="header-meta-row">
                      <span>${escapeHtml(item.label)}</span>
                      <strong>${toParagraphs(formatPrintValue(item.label, item.value, item.type))}</strong>
                    </div>
                  `,
                )
                .join("")
            : `<div class="header-meta-row header-meta-row-empty"><span>${escapeHtml(translateText("In luc"))}</span><strong>${escapeHtml(formatDateTime(new Date().toISOString()))}</strong></div>`
        }
      </div>
    </header>
    ${headerNote ? `<div class="note-box note-box-compact">${toParagraphs(headerNote)}</div>` : ""}
  `;
};

const getSignatureCaptions = (profile?: DocumentProfile, record?: Record<string, unknown>) => {
  const subject = resolveDocumentSubject(record);
  if (subject?.label === translateText("Hoi vien")) {
    return [translateText("Hoi vien xac nhan"), translateText("Dai dien chi nhanh xac nhan")];
  }

  switch (profile) {
    case "receipt":
      return ["Nguoi lap phieu", "Thu ngan", "Nguoi nop tien"];
    case "expense":
      return ["Nguoi lap phieu", "Nguoi duyet chi", "Nguoi nhan tien"];
    case "sale":
      return ["Thu ngan", "Quan ly ca", "Khach mua"];
    case "return":
      return ["Thu ngan", "Quan ly ca", "Khach nhan hoan"];
    default:
      return ["Nguoi lap", "Ke toan / Phe duyet", "Khach hang / Doi tac"];
  }
};

const buildResourceRecordBody = ({
  profile,
  record,
  entries,
  filters,
}: {
  profile?: DocumentProfile | null;
  record?: Record<string, unknown>;
  entries: PrintKeyValue[];
  filters: PrintKeyValue[];
}) => {
  const visibleFilters = getVisibleItems(filters);

  if (!record) {
    return `
      ${
        visibleFilters.length
          ? buildReportMetaTable("Thong tin bo loc", visibleFilters, 3)
          : ""
      }
      ${buildReportMetaTable("Chi tiet chung tu", getVisibleItems(entries), 3)}
    `;
  }

  if (profile === "receipt") {
    return `
      ${buildHeroGrid([
        { label: "Ma phieu thu", value: getRecordValue(record, ["code"]) },
        { label: "Ngay thu", value: getRecordValue(record, ["receiptDate"]), type: "datetime" },
        { label: "Trang thai", value: getRecordValue(record, ["status"]), type: "status" },
        { label: "So tien thu", value: getRecordValue(record, ["amount"]), type: "currency", emphasize: true },
      ])}
      ${visibleFilters.length ? buildPrintSection("Thong tin bo loc", visibleFilters) : ""}
      ${buildPrintSection("Thong tin nguoi nop", [
        { label: "Khach hang", value: getRecordValue(record, ["customerName"]) },
        { label: "So dien thoai", value: getRecordValue(record, ["customerPhone"]) },
        { label: "Hop dong", value: getRecordValue(record, ["contractCode"]) },
        { label: "Goi dich vu", value: getRecordValue(record, ["contractPackageName"]) },
      ])}
      ${buildPrintSection("Thong tin thu tien", [
        { label: "Chi nhanh", value: getRecordValue(record, ["branchName"]) },
        { label: "Phuong thuc thanh toan", value: getRecordValue(record, ["paymentMethodName"]) },
        { label: "Nguoi thu", value: getRecordValue(record, ["collectorName"]) },
        { label: "Nguon thu", value: getRecordValue(record, ["sourceLabel", "sourceType"]) },
        { label: "Noi dung", value: getRecordValue(record, ["content"]) },
      ])}
      ${buildLineItemsSection("Dong san pham", getRecordValue(record, ["lineItems"]))}
      ${buildNotePanel("Ghi chu", getRecordValue(record, ["note"]))}
    `;
  }

  if (profile === "expense") {
    return `
      ${buildHeroGrid([
        { label: "Ma phieu chi", value: getRecordValue(record, ["code"]) },
        { label: "Ngay chi", value: getRecordValue(record, ["expenseDate"]), type: "datetime" },
        { label: "Trang thai", value: getRecordValue(record, ["status"]), type: "status" },
        { label: "So tien chi", value: getRecordValue(record, ["amount"]), type: "currency", emphasize: true },
      ])}
      ${visibleFilters.length ? buildPrintSection("Thong tin bo loc", visibleFilters) : ""}
      ${buildPrintSection("Thong tin doi tuong nhan", [
        { label: "Doi tuong nhan", value: getRecordValue(record, ["payeeName"]) },
        { label: "Loai chi", value: getRecordValue(record, ["expenseLabel", "expenseType"]) },
        { label: "Chi nhanh", value: getRecordValue(record, ["branchName"]) },
      ])}
      ${buildPrintSection("Thong tin phe duyet", [
        { label: "Phuong thuc thanh toan", value: getRecordValue(record, ["paymentMethodName"]) },
        { label: "Nguoi lap phieu", value: getRecordValue(record, ["createdUserName"]) },
        { label: "Nguoi phe duyet", value: getRecordValue(record, ["approverName"]) },
      ])}
      ${buildLineItemsSection("Dong san pham", getRecordValue(record, ["lineItems"]))}
      ${buildNotePanel("Ghi chu", getRecordValue(record, ["note"]))}
    `;
  }

  if (profile === "sale") {
    return `
      ${buildHeroGrid([
        { label: "Ma giao dich", value: getRecordValue(record, ["code"]) },
        { label: "Ngay ban", value: getRecordValue(record, ["receiptDate"]), type: "datetime" },
        { label: "Trang thai", value: getRecordValue(record, ["status"]), type: "status" },
        { label: "Tong thanh toan", value: getRecordValue(record, ["amount"]), type: "currency", emphasize: true },
      ])}
      ${visibleFilters.length ? buildPrintSection("Thong tin bo loc", visibleFilters) : ""}
      ${buildPrintSection("Thong tin khach mua", [
        { label: "Khach mua", value: getRecordValue(record, ["customerName"]) },
        { label: "So dien thoai", value: getRecordValue(record, ["customerPhone"]) },
        { label: "Ma hop dong lien ket", value: getRecordValue(record, ["contractCode"]) },
        { label: "Goi / dich vu lien ket", value: getRecordValue(record, ["contractPackageName"]) },
      ])}
      ${buildPrintSection("Thong tin ban hang", [
        { label: "Chi nhanh", value: getRecordValue(record, ["branchName"]) },
        { label: "Thu ngan", value: getRecordValue(record, ["collectorName"]) },
        { label: "Phuong thuc thanh toan", value: getRecordValue(record, ["paymentMethodName"]) },
        { label: "Kenh ban / nguon thu", value: getRecordValue(record, ["sourceLabel", "sourceType"]) },
        { label: "Noi dung giao dich", value: getRecordValue(record, ["content"]) },
      ])}
      ${buildLineItemsSection("Dong san pham ban", getRecordValue(record, ["lineItems"]))}
      ${buildNotePanel("Ghi chu ban hang", getRecordValue(record, ["note"]))}
    `;
  }

  if (profile === "return") {
    return `
      ${buildHeroGrid([
        { label: "Ma phieu tra", value: getRecordValue(record, ["code"]) },
        { label: "Ngay hoan / tra", value: getRecordValue(record, ["expenseDate"]), type: "datetime" },
        { label: "Trang thai", value: getRecordValue(record, ["status"]), type: "status" },
        { label: "So tien hoan", value: getRecordValue(record, ["amount"]), type: "currency", emphasize: true },
      ])}
      ${visibleFilters.length ? buildPrintSection("Thong tin bo loc", visibleFilters) : ""}
      ${buildPrintSection("Thong tin doi tuong", [
        { label: "Doi tuong nhan hoan", value: getRecordValue(record, ["payeeName"]) },
        { label: "Loai tra / hoan", value: getRecordValue(record, ["expenseLabel", "expenseType"]) },
        { label: "Chi nhanh", value: getRecordValue(record, ["branchName"]) },
      ])}
      ${buildPrintSection("Thong tin xu ly", [
        { label: "Phuong thuc hoan", value: getRecordValue(record, ["paymentMethodName"]) },
        { label: "Thu ngan lap phieu", value: getRecordValue(record, ["createdUserName"]) },
        { label: "Nguoi duyet hoan", value: getRecordValue(record, ["approverName"]) },
      ])}
      ${buildLineItemsSection("Dong san pham tra", getRecordValue(record, ["lineItems"]))}
      ${buildNotePanel("Ly do / ghi chu", getRecordValue(record, ["note"]))}
    `;
  }

  return `
    ${
      visibleFilters.length
        ? buildReportMetaTable("Thong tin bo loc", visibleFilters, 3)
        : ""
    }
    ${buildReportMetaTable("Chi tiet chung tu", getVisibleItems(entries), 3)}
  `;
};

const buildShell = ({
  title,
  subtitle,
  eyebrow,
  body,
  paperSize,
  orientation,
  branding,
  headerMetaItems,
  headerNote,
  footerNote,
  showSignature,
  signatureCaptions,
  hideHeader = false,
  autoPrint = true,
  showPreviewToolbar = false,
}: {
  title: string;
  subtitle: string;
  eyebrow: string;
  body: string;
  paperSize?: unknown;
  orientation?: "portrait" | "landscape";
  branding?: ReportDesignerBranding | null;
  headerMetaItems?: PrintKeyValue[];
  headerNote?: string;
  footerNote?: string;
  showSignature?: boolean;
  signatureCaptions?: string[];
  hideHeader?: boolean;
  autoPrint?: boolean;
  showPreviewToolbar?: boolean;
}) => `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        @page {
          size: ${escapeHtml(String(paperSize || "A4"))} ${escapeHtml(orientation || "portrait")};
          margin: 8mm;
        }

        * {
          box-sizing: border-box;
        }

        html, body {
          margin: 0;
          padding: 0;
          color: #0f172a;
          font-family: "Segoe UI", Arial, sans-serif;
          font-size: 12px;
          line-height: 1.55;
          background: #ffffff;
        }

        body {
          padding: 12px;
        }

        .preview-toolbar {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: -12px -12px 14px;
          padding: 12px;
          border-bottom: 1px solid #d1fae5;
          background: rgba(236, 253, 245, 0.96);
          backdrop-filter: blur(10px);
        }

        .preview-toolbar p {
          margin: 0;
          color: #065f46;
          font-size: 12px;
          font-weight: 600;
        }

        .preview-toolbar .actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .preview-toolbar button {
          padding: 10px 14px;
          border: 1px solid #10b981;
          border-radius: 999px;
          background: #ffffff;
          color: #047857;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .preview-toolbar button.primary {
          background: #047857;
          color: #ffffff;
        }

        .page {
          width: 100%;
        }

        .print-header {
          display: grid;
          grid-template-columns: minmax(240px, 1.35fr) minmax(0, 1.15fr) minmax(200px, 0.9fr);
          gap: 10px;
          align-items: start;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1.5px solid #0f172a;
        }

        .brand-panel {
          display: flex;
          gap: 12px;
          align-items: center;
          min-width: 0;
        }

        .brand-panel-has-logo {
          align-items: flex-start;
        }

        .brand-logo-wrap {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          width: 152px;
          min-width: 152px;
          height: 68px;
          overflow: visible;
        }

        .brand-logo {
          display: block;
          width: auto;
          height: auto;
          max-width: 100%;
          max-height: 64px;
          object-fit: contain;
          object-position: left center;
        }

        .brand-copy {
          min-width: 0;
        }

        .brand-name {
          margin: 0;
          color: #0f172a;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.3;
          text-transform: uppercase;
        }

        .brand-meta {
          margin: 6px 0 0;
          color: #475569;
          font-size: 10.5px;
          line-height: 1.45;
          word-break: break-word;
        }

        .title-panel {
          text-align: center;
        }

        .header-meta-panel {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .header-meta-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 7px 8px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #f8fafc;
          text-align: right;
        }

        .header-meta-row span {
          color: #64748b;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .header-meta-row strong {
          color: #0f172a;
          font-size: 11.5px;
          line-height: 1.35;
          word-break: break-word;
        }

        .report-sheet {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .report-heading {
          padding-bottom: 8px;
          border-bottom: 2px solid #0f172a;
          text-align: center;
        }

        .report-title {
          margin: 0;
          color: #0f172a;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .report-subtitle {
          margin: 6px 0 0;
          color: #334155;
          font-size: 12px;
          line-height: 1.5;
        }

        .report-banner,
        .report-footer-note {
          padding: 10px 12px;
          border: 1px solid #94a3b8;
          background: #f8fafc;
          color: #334155;
          font-size: 11px;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .report-section {
          page-break-inside: avoid;
        }

        .report-section-title {
          margin: 0 0 8px;
          color: #0f172a;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .report-meta-table,
        .report-data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .report-meta-table {
          border: 1px solid #0f172a;
        }

        .report-meta-table th,
        .report-meta-table td {
          padding: 6px 7px;
          border: 1px solid #94a3b8;
          font-size: 11px;
          line-height: 1.45;
          text-align: left;
          vertical-align: top;
        }

        .report-meta-table th {
          width: 14%;
          background: #f8fafc;
          color: #334155;
          font-weight: 700;
        }

        .report-meta-table td {
          color: #0f172a;
        }

        .report-data-wrap {
          overflow: hidden;
          border: 1px solid #0f172a;
        }

        .report-data-table thead {
          background: #e2e8f0;
        }

        .report-data-table th,
        .report-data-table td {
          padding: 6px 7px;
          border: 1px solid #94a3b8;
          color: #0f172a;
          font-size: 11px;
          line-height: 1.45;
          text-align: left;
          vertical-align: top;
        }

        .report-data-table th {
          font-weight: 700;
        }

        .report-data-table .index-col {
          width: 44px;
          text-align: center;
          font-weight: 700;
        }

        .eyebrow {
          margin: 0;
          color: #047857;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.26em;
          text-transform: uppercase;
        }

        h1 {
          margin: 6px 0 4px;
          font-size: 20px;
          line-height: 1.22;
        }

        .subtitle {
          margin: 0;
          color: #475569;
          font-size: 11px;
          line-height: 1.45;
        }

        .note-box {
          margin-bottom: 10px;
          padding: 9px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: #f8fafc;
          color: #334155;
          font-size: 10.5px;
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .note-box-compact {
          margin-top: 0;
        }

        .section-title {
          margin: 12px 0 8px;
          color: #0f766e;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .kv-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .hero-card {
          padding: 10px 11px;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          background: linear-gradient(180deg, #f0fdf4 0%, #ecfdf5 100%);
          break-inside: avoid;
        }

        .hero-card-emphasize {
          background: linear-gradient(180deg, #047857 0%, #065f46 100%);
          border-color: #065f46;
        }

        .hero-label {
          margin: 0;
          color: #047857;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .hero-value {
          margin: 6px 0 0;
          color: #064e3b;
          font-size: 14px;
          font-weight: 700;
          line-height: 1.3;
          word-break: break-word;
        }

        .hero-card-emphasize .hero-label {
          color: rgba(255, 255, 255, 0.78);
        }

        .hero-card-emphasize .hero-value {
          color: #ffffff;
        }

        .kv-card {
          padding: 8px 9px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #f8fafc;
          break-inside: avoid;
        }

        .kv-label {
          margin: 0;
          color: #64748b;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .kv-value {
          margin: 5px 0 0;
          color: #0f172a;
          font-size: 11.5px;
          font-weight: 600;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .table-wrap {
          overflow: hidden;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead {
          background: #f8fafc;
        }

        th, td {
          padding: 7px 8px;
          border-bottom: 1px solid #e2e8f0;
          text-align: left;
          vertical-align: top;
        }

        th {
          color: #475569;
          font-size: 11px;
          font-weight: 700;
        }

        td {
          color: #0f172a;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        .signature-grid {
          display: grid;
          grid-template-columns: repeat(var(--signature-columns, 2), minmax(0, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .signature-card {
          min-height: 78px;
          padding-top: 8px;
          border-top: 1px solid #94a3b8;
          text-align: center;
        }

        .signature-card p {
          margin: 0;
        }

        .signature-card .caption {
          color: #475569;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .signature-card .hint {
          margin-top: 30px;
          color: #94a3b8;
          font-size: 10px;
        }

        .empty-state {
          padding: 18px;
          border: 1px dashed #cbd5e1;
          border-radius: 14px;
          color: #475569;
          text-align: center;
          background: #f8fafc;
        }

        @media (max-width: 900px) {
          .print-header {
            grid-template-columns: 1fr;
          }

          .header-meta-panel {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .hero-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      </style>
    </head>
    <body>
      ${
        showPreviewToolbar
          ? `
            <div class="preview-toolbar">
              <p>${escapeHtml(translateText("Xem truoc mau in. Neu thay on, bam In de mo hop thoai may in."))}</p>
              <div class="actions">
                <button type="button" onclick="window.close()">${escapeHtml(translateText("Dong"))}</button>
                <button class="primary" type="button" onclick="window.print()">${escapeHtml(translateText("In"))}</button>
              </div>
            </div>
          `
          : ""
      }
      <main class="page">
        ${
          hideHeader
            ? ""
            : buildPrintHeader({
                eyebrow,
                title,
                subtitle,
                headerNote,
                branding,
                headerMetaItems,
              })
        }
        ${body}
        ${footerNote ? `<div class="note-box note-box-compact">${toParagraphs(footerNote)}</div>` : ""}
        ${
          showSignature
            ? `
              <section>
                <p class="section-title">${escapeHtml(translateText("Xac nhan"))}</p>
                <div class="signature-grid" style="--signature-columns:${Math.max(1, Math.min(3, signatureCaptions?.length || 2))}">
                  ${(signatureCaptions?.length ? signatureCaptions : [translateText("Nguoi lap"), translateText("Ke toan / Phe duyet")])
                    .map(
                      (caption) => `
                        <div class="signature-card">
                          <p class="caption">${escapeHtml(caption)}</p>
                          <p class="hint">${escapeHtml(translateText("(Ky, ghi ro ho ten)"))}</p>
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              </section>
            `
            : ""
        }
      </main>
      <script>
        ${autoPrint ? `window.addEventListener("load", function () {
          window.setTimeout(function () {
            window.focus();
            window.print();
          }, 120);
        });
        window.addEventListener("afterprint", function () {
          window.close();
        });` : ""}
      </script>
    </body>
  </html>
`;

export const createPrintWindow = () => {
  const printWindow = window.open("", "_blank", "width=1100,height=820");
  if (!printWindow) {
    window.alert(translateText("Trinh duyet dang chan cua so xem truoc / in. Hay cho phep popup cho he thong nay."));
    return null;
  }
  return printWindow;
};

const openPrintWindow = (html: string, targetWindow?: Window | null) => {
  const printWindow = targetWindow && !targetWindow.closed ? targetWindow : createPrintWindow();
  if (!printWindow) {
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

export const printResourceList = ({
  title,
  subtitle,
  columns,
  rows,
  filters = [],
  template,
  profile,
  branding,
}: PrintResourceListOptions) => {
  const documentTemplate = getDocumentTemplate(profile, template);
  const effectiveBranding = resolveTemplateBranding(branding, template);
  const summary = [
    { label: "Tong chung tu", value: rows.length },
    { label: "In luc", value: new Date().toISOString(), type: "datetime" as const },
    ...filters.filter((item) => item.value !== null && item.value !== undefined && item.value !== ""),
  ];

  openPrintWindow(
    buildShell({
      title,
      subtitle,
      eyebrow: "Resource Print",
      branding: effectiveBranding,
      headerMetaItems: buildHeaderMetaItems({
        branding: effectiveBranding,
        extraItems: [{ label: translateText("Tong chung tu"), value: rows.length }],
      }),
      body: `
        <p class="section-title">Tong quan</p>
        ${buildKeyValueGrid(summary)}
        <p class="section-title">Danh sach chung tu</p>
        ${buildTable(columns, rows)}
      `,
      paperSize: template?.paperSize,
      orientation: normalizeOrientation(template?.paperOrientation),
      headerNote: documentTemplate.header,
      footerNote: documentTemplate.footer,
      showSignature: template?.showSignature === false || template?.showSignature === "false" ? false : true,
    }),
  );
};

export const printResourceRecord = ({
  title,
  subtitle,
  entries,
  record,
  filters = [],
  template,
  profile,
  branding,
  targetWindow,
}: PrintResourceRecordOptions) => {
  const documentTemplate = getDocumentTemplate(profile, template);
  const effectiveBranding = resolveTemplateBranding(branding, template);

  openPrintWindow(
    buildShell({
      title,
      subtitle,
      eyebrow: "Document Print",
      branding: effectiveBranding,
      headerMetaItems: buildHeaderMetaItems({ record, branding: effectiveBranding }),
      body: buildResourceRecordBody({
        profile,
        record,
        entries,
        filters,
      }),
      paperSize: template?.paperSize,
      orientation: normalizeOrientation(template?.paperOrientation),
      headerNote: documentTemplate.header,
      footerNote: documentTemplate.footer,
      showSignature: template?.showSignature === false || template?.showSignature === "false" ? false : true,
      signatureCaptions: getSignatureCaptions(profile || undefined, record),
    }),
    targetWindow,
  );
};

export const printSettingPreview = ({ title, subtitle, sections, note }: PrintSettingPreviewOptions) => {
  openPrintWindow(
    buildShell({
      title,
      subtitle,
      eyebrow: translateText("Xem truoc mau in"),
      autoPrint: false,
      showPreviewToolbar: true,
      body: sections
        .map(
          (section) => `
            <section>
              <p class="section-title">${escapeHtml(section.title)}</p>
              ${buildKeyValueGrid(section.items)}
            </section>
          `,
        )
        .join(""),
      paperSize: "A4",
      headerNote: note,
    }),
  );
};

export const buildReportPrintHtml = ({
  reportKey,
  templateKey,
  templateFallbackKeys,
  autoPrint = true,
  showPreviewToolbar = false,
  title,
  subtitle,
  summary,
  filters,
  rows,
  columns,
  template,
  generatedBy,
  branding,
}: PrintReportOptions) => {
  return buildReportDesignerPrintHtml({
    reportKey,
    templateKey,
    templateFallbackKeys,
    autoPrint,
    showPreviewToolbar,
    title,
    subtitle,
    summary,
    filters,
    rows,
    columns,
    template,
    generatedBy,
    branding,
  });
};

export const printReportDocument = (options: PrintReportOptions) => {
  openPrintWindow(buildReportPrintHtml(options));
};
