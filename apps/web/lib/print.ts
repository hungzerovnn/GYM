import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { translateText } from "@/lib/i18n/display";
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
}

interface PrintResourceRecordOptions {
  title: string;
  subtitle: string;
  entries: PrintKeyValue[];
  record?: Record<string, unknown>;
  filters?: PrintKeyValue[];
  template?: Record<string, unknown> | null;
  profile?: DocumentProfile | null;
}

interface PrintSettingPreviewOptions {
  title: string;
  subtitle: string;
  sections: PrintSection[];
  note?: string;
}

interface PrintReportOptions {
  reportKey?: string;
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

  return `
    <section>
      <p class="section-title">${escapeHtml(title)}</p>
      ${buildKeyValueGrid(visibleItems)}
    </section>
  `;
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

const getSignatureCaptions = (profile?: DocumentProfile) => {
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
          ? `
            <p class="section-title">Thong tin bo loc</p>
            ${buildKeyValueGrid(visibleFilters)}
          `
          : ""
      }
      <p class="section-title">Chi tiet chung tu</p>
      ${buildKeyValueGrid(getVisibleItems(entries))}
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
        ? `
          <p class="section-title">Thong tin bo loc</p>
          ${buildKeyValueGrid(visibleFilters)}
        `
        : ""
    }
    <p class="section-title">Chi tiet chung tu</p>
    ${buildKeyValueGrid(getVisibleItems(entries))}
  `;
};

const buildShell = ({
  title,
  subtitle,
  eyebrow,
  body,
  paperSize,
  orientation,
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
          margin: 12mm;
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
          padding: 20px;
        }

        .preview-toolbar {
          position: sticky;
          top: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: -20px -20px 20px;
          padding: 14px 20px;
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
          padding: 7px 8px;
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
          padding: 7px 8px;
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
          margin: 8px 0 4px;
          font-size: 22px;
          line-height: 1.25;
        }

        .subtitle {
          margin: 0 0 16px;
          color: #475569;
        }

        .note-box {
          margin-bottom: 16px;
          padding: 12px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: #f8fafc;
          color: #334155;
          white-space: pre-wrap;
        }

        .section-title {
          margin: 20px 0 10px;
          color: #0f766e;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .kv-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .hero-card {
          padding: 14px 16px;
          border: 1px solid #bbf7d0;
          border-radius: 16px;
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
          margin: 10px 0 0;
          color: #064e3b;
          font-size: 18px;
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
          padding: 12px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
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
          margin: 8px 0 0;
          color: #0f172a;
          font-size: 13px;
          font-weight: 600;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .table-wrap {
          overflow: hidden;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead {
          background: #f8fafc;
        }

        th, td {
          padding: 10px 12px;
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
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          margin-top: 28px;
        }

        .signature-card {
          min-height: 110px;
          padding-top: 10px;
          border-top: 1px solid #94a3b8;
          text-align: center;
        }

        .signature-card p {
          margin: 0;
        }

        .signature-card .caption {
          color: #475569;
          font-size: 11px;
        }

        .signature-card .hint {
          margin-top: 48px;
          color: #94a3b8;
          font-size: 11px;
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
            : `
              ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ""}
              <h1>${escapeHtml(title)}</h1>
              <p class="subtitle">${escapeHtml(subtitle)}</p>
              ${headerNote ? `<div class="note-box">${toParagraphs(headerNote)}</div>` : ""}
            `
        }
        ${body}
        ${footerNote ? `<div class="note-box">${toParagraphs(footerNote)}</div>` : ""}
        ${
          showSignature
            ? `
              <section>
                <p class="section-title">${escapeHtml(translateText("Xac nhan"))}</p>
                <div class="signature-grid">
                  <div class="signature-card">
                    <p class="caption">${escapeHtml(signatureCaptions?.[0] || translateText("Nguoi lap"))}</p>
                    <p class="hint">${escapeHtml(translateText("(Ky, ghi ro ho ten)"))}</p>
                  </div>
                  <div class="signature-card">
                    <p class="caption">${escapeHtml(signatureCaptions?.[1] || translateText("Ke toan / Phe duyet"))}</p>
                    <p class="hint">${escapeHtml(translateText("(Ky, ghi ro ho ten)"))}</p>
                  </div>
                  <div class="signature-card">
                    <p class="caption">${escapeHtml(signatureCaptions?.[2] || translateText("Khach hang / Doi tac"))}</p>
                    <p class="hint">${escapeHtml(translateText("(Ky, ghi ro ho ten)"))}</p>
                  </div>
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

const openPrintWindow = (html: string) => {
  const printWindow = window.open("", "_blank", "width=1100,height=820");
  if (!printWindow) {
    window.alert(translateText("Trinh duyet dang chan cua so xem truoc / in. Hay cho phep popup cho he thong nay."));
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
}: PrintResourceListOptions) => {
  const documentTemplate = getDocumentTemplate(profile, template);
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
      body: `
        <p class="section-title">Tong quan</p>
        ${buildKeyValueGrid(summary)}
        <p class="section-title">Danh sach chung tu</p>
        ${buildTable(columns, rows)}
      `,
      paperSize: template?.paperSize,
      headerNote: documentTemplate.header,
      footerNote: documentTemplate.footer,
      showSignature: asBoolean(template?.showSignature),
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
}: PrintResourceRecordOptions) => {
  const documentTemplate = getDocumentTemplate(profile, template);

  openPrintWindow(
    buildShell({
      title,
      subtitle,
      eyebrow: "Document Print",
      body: buildResourceRecordBody({
        profile,
        record,
        entries,
        filters,
      }),
      paperSize: template?.paperSize,
      headerNote: documentTemplate.header,
      footerNote: documentTemplate.footer,
      showSignature: asBoolean(template?.showSignature),
      signatureCaptions: getSignatureCaptions(profile || undefined),
    }),
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
}: PrintReportOptions) => {
  const baseTemplate = asRecord(template);
  const scopedTemplate = reportKey ? asRecord(asRecord(baseTemplate.reportTemplates)[reportKey]) : {};
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
  };
  const reportHeader = String(effectiveTemplate.reportHeader || "");
  const reportFooter = String(effectiveTemplate.reportFooter || effectiveTemplate.note || "");
  const showGeneratedBy = asBoolean(effectiveTemplate.showGeneratedBy);
  const showPrintedAt = asBoolean(effectiveTemplate.showPrintedAt ?? true);
  const showFilters = asBoolean(effectiveTemplate.showFilters ?? true);
  const overview = [...summary];
  const reportTitle = String(scopedTemplate.title || title || effectiveTemplate.defaultTitle || "");
  const reportSubtitle = String(scopedTemplate.subtitle || subtitle || effectiveTemplate.defaultSubtitle || "");

  if (showPrintedAt) {
    overview.unshift({ label: "In luc", value: new Date().toISOString(), type: "datetime" });
  }

  if (showGeneratedBy && generatedBy) {
    overview.unshift({ label: "Nguoi xuat", value: generatedBy });
  }

  return buildShell({
    title: reportTitle,
    subtitle: reportSubtitle,
    eyebrow: "",
    autoPrint,
    showPreviewToolbar,
    body: `
      <section class="report-sheet">
        <div class="report-heading">
          <h1 class="report-title">${escapeHtml(reportTitle)}</h1>
          ${reportSubtitle ? `<p class="report-subtitle">${escapeHtml(reportSubtitle)}</p>` : ""}
        </div>
        ${reportHeader ? `<div class="report-banner">${toParagraphs(reportHeader)}</div>` : ""}
        ${buildReportMetaTable(translateText("Thong tin bao cao"), overview, 2)}
        ${showFilters && filters.length ? buildReportMetaTable(translateText("Dieu kien loc"), filters, 2) : ""}
        <section class="report-section">
          <p class="report-section-title">${escapeHtml(translateText("Bang du lieu bao cao"))}</p>
          ${buildReportDataTable(
            columns.map((column) => ({ key: column, label: toReportLabel(column) })),
            rows,
          )}
        </section>
        ${reportFooter ? `<div class="report-footer-note">${toParagraphs(reportFooter)}</div>` : ""}
      </section>
    `,
    paperSize: effectiveTemplate.paperSize,
    orientation: String(effectiveTemplate.defaultOrientation || "").toUpperCase() === "LANDSCAPE" ? "landscape" : "portrait",
    showSignature: asBoolean(effectiveTemplate.showSignature),
    hideHeader: true,
  });
};

export const printReportDocument = (options: PrintReportOptions) => {
  openPrintWindow(buildReportPrintHtml(options));
};
