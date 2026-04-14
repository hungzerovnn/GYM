"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { api } from "@/lib/api";
import { translateText } from "@/lib/i18n/display";
import { createPrintWindow, printReportDocument, printResourceRecord } from "@/lib/print";
import { fetchScopedPrintContext, resolveRecordBranchId } from "@/lib/print-scope";
import type { ReportDesignerBranding } from "@/lib/report-designer";
import { buildResourcePrintEntries, getResourceDetailConfig, resolveResourcePrintProfile } from "@/lib/resource-meta";
import { DetailDrawer, DetailSummaryItem } from "../shared/detail-drawer";
import { ResourceDetailDrawer } from "./resource-detail-drawer";
import {
  branchSummaryActionFields,
  kpiActionFields,
  ReportRowActionResources,
  ReportRowActionType,
  resolveReportRowActionResource,
  salesSummaryActionFields,
  staffReviewActionFields,
} from "./report-row-action-config";

type ReportBranding = ReportDesignerBranding;

interface ReportRowActionRuntimeContext {
  generatedBy?: string;
  printFilters: Array<{ label: string; value: string }>;
  reportBranding: ReportBranding | null;
  reportSubtitle?: string;
  reportTemplate?: Record<string, unknown>;
  reportTemplateFallbackKeys: string[];
  reportTemplateKey: string;
  reportTitle: string;
  reportType: string;
  resourcePrintTemplate?: Record<string, unknown>;
  resources: ReportRowActionResources;
}

interface ReportRowDetailLayerProps extends ReportRowActionRuntimeContext {
  actionType: ReportRowActionType;
  onClose: () => void;
  row: Record<string, unknown>;
  toLabel: (reportType: string, value: string) => string;
}

type ReportRowSummaryItem = {
  label: string;
  type?: DetailSummaryItem["type"];
  value: unknown;
};

const buildSummaryItems = (actionType: ReportRowActionType, row: Record<string, unknown>): ReportRowSummaryItem[] => {
  switch (actionType) {
    case "branch-summary":
      return [
        { label: "Tong doanh thu", value: Number(row.collectedRevenue || 0), type: "currency" },
        { label: "Tong chi phi", value: Number(row.totalExpense || 0), type: "currency" },
        { label: "Loi nhuan thuan", value: Number(row.netProfit || 0), type: "currency" },
        { label: "Cong no", value: Number(row.outstandingDebt || 0), type: "currency" },
      ];
    case "kpi":
      return [
        { label: "Doanh thu hop dong", value: Number(row.revenue || 0), type: "currency" },
        { label: "Doanh thu thuc thu", value: Number(row.actualRevenue || 0), type: "currency" },
        { label: "Hop dong moi", value: Number(row.newContracts || 0), type: "text" },
        { label: "Muc dat KPI", value: `${Number(row.kpiPercent || 0)}%`, type: "text" },
      ];
    case "sales-summary":
      return [
        { label: "Tong doanh thu", value: Number(row.totalRevenue || 0), type: "currency" },
        { label: "Tong hop dong", value: Number(row.totalContracts || 0), type: "text" },
        { label: "Da thu", value: Number(row.collectedAmount || 0), type: "currency" },
        { label: "Cong no", value: Number(row.outstandingDebt || 0), type: "currency" },
      ];
    case "staff-review":
      return [
        { label: "Doanh thu", value: Number(row.totalRevenue || 0), type: "currency" },
        { label: "Da thu", value: Number(row.collectedAmount || 0), type: "currency" },
        { label: "Lead chuyen doi", value: Number(row.convertedLeads || 0), type: "text" },
        { label: "Diem danh gia", value: Number(row.performanceIndex || 0), type: "text" },
      ];
    default:
      return [];
  }
};

const resolveDetailFields = (actionType: ReportRowActionType) => {
  switch (actionType) {
    case "branch-summary":
      return branchSummaryActionFields;
    case "kpi":
      return kpiActionFields;
    case "sales-summary":
      return salesSummaryActionFields;
    case "staff-review":
      return staffReviewActionFields;
    default:
      return [];
  }
};

const resolveDrawerTitle = (actionType: ReportRowActionType, reportTitle: string, row: Record<string, unknown>) => {
  switch (actionType) {
    case "branch-summary":
      return `${reportTitle} - ${String(row.branch || "").trim()}`.trim();
    case "kpi":
      return `${reportTitle} - ${String(row.name || row.code || "").trim()}`.trim();
    case "sales-summary":
    case "staff-review":
      return `${reportTitle} - ${String(row.staffName || row.code || "").trim()}`.trim();
    default:
      return reportTitle;
  }
};

const resolveResourceTitleValue = (actionType: ReportRowActionType, record: Record<string, unknown>, row: Record<string, unknown>) => {
  switch (actionType) {
    case "birthday":
      return String(record.code || row.code || record.id || row.id || "").trim();
    case "class-attendance":
      return String(record.code || row.sessionCode || record.id || row.id || "").trim();
    case "payment":
      return String(record.code || row.code || record.id || row.id || "").trim();
    case "deposit":
      return String(record.code || row.code || record.id || row.id || "").trim();
    case "contract":
      return String(record.code || row.contractCode || record.id || row.id || "").trim();
    case "card-revenue":
      return String(record.code || row.receiptCode || record.id || row.id || "").trim();
    case "lead-status":
      return String(record.code || row.code || record.id || row.id || "").trim();
    default:
      return "";
  }
};

const openPrintLoadingWindow = () => {
  const targetWindow = createPrintWindow();
  if (!targetWindow) return null;

  targetWindow.document.open();
  targetWindow.document.write(
    `<html><head><title>${translateText("Dang tao chung tu")}</title></head><body style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a;">${translateText("Dang tai du lieu de in chung tu...")}</body></html>`,
  );
  targetWindow.document.close();
  return targetWindow;
};

export async function printReportRowAction({
  actionType,
  generatedBy,
  printFilters,
  reportBranding,
  reportSubtitle,
  reportTemplate,
  reportTemplateFallbackKeys,
  reportTemplateKey,
  reportTitle,
  reportType,
  resourcePrintTemplate,
  resources,
  row,
}: ReportRowActionRuntimeContext & { actionType: ReportRowActionType; row: Record<string, unknown> }) {
  const resource = resolveReportRowActionResource(actionType, row, resources);

  if (resource) {
    const detailConfig = getResourceDetailConfig(resource);
    if (!detailConfig) return;

    const targetWindow = openPrintLoadingWindow();
    if (!targetWindow) return;

    let record = row;

    if (row.id) {
      try {
        const response = await api.get<Record<string, unknown>>(detailConfig.detailEndpoint(String(row.id)));
        record = response.data;
      } catch {
        record = row;
      }
    }

    const scopedBranchId = resolveRecordBranchId(record, row);
    const scopedPrintContext = scopedBranchId
      ? await fetchScopedPrintContext(scopedBranchId, {
          includeBranding: true,
          includePrintTemplate: true,
        })
      : null;

    printResourceRecord({
      title: `${resource.title} ${resolveResourceTitleValue(actionType, record, row)}`.trim(),
      subtitle: resource.subtitle,
      entries: buildResourcePrintEntries(resource, record),
      record,
      filters: printFilters,
      template: scopedPrintContext?.printTemplate || resourcePrintTemplate,
      profile: resolveResourcePrintProfile(resource) || undefined,
      branding: scopedPrintContext?.branding || reportBranding,
      targetWindow,
    });
    return;
  }

  const summary = buildSummaryItems(actionType, row);
  const columns = resolveDetailFields(actionType);
  if (!columns.length) return;

  const scopedBranchId = resolveRecordBranchId(row);
  const scopedPrintContext = scopedBranchId
    ? await fetchScopedPrintContext(scopedBranchId, {
        includeBranding: true,
        includeReportTemplate: true,
      })
    : null;

  printReportDocument({
    reportKey: reportType,
    title: resolveDrawerTitle(actionType, reportTitle, row),
    subtitle: reportSubtitle || "",
    summary,
    filters: printFilters,
    rows: [row],
    columns,
    template: scopedPrintContext?.reportTemplate || reportTemplate,
    templateKey: reportTemplateKey,
    templateFallbackKeys: reportTemplateFallbackKeys,
    generatedBy,
    branding: scopedPrintContext?.branding || reportBranding,
  });
}

export function ReportRowDetailLayer({
  actionType,
  generatedBy,
  onClose,
  printFilters,
  reportBranding,
  reportSubtitle,
  reportTemplate,
  reportTemplateFallbackKeys,
  reportTemplateKey,
  reportTitle,
  reportType,
  resourcePrintTemplate,
  resources,
  row,
  toLabel,
}: ReportRowDetailLayerProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const resource = resolveReportRowActionResource(actionType, row, resources);
  const fields = useMemo(() => resolveDetailFields(actionType), [actionType]);
  const fieldLabels = useMemo(
    () => Object.fromEntries(fields.map((field) => [field, toLabel(reportType, field)])),
    [fields, reportType, toLabel],
  );
  const summaryItems = useMemo(() => buildSummaryItems(actionType, row), [actionType, row]);
  const drawerTitle = useMemo(() => resolveDrawerTitle(actionType, reportTitle, row), [actionType, reportTitle, row]);

  const handlePrint = async () => {
    if (isPrinting) return;

    setIsPrinting(true);
    try {
      await printReportRowAction({
        actionType,
        generatedBy,
        printFilters,
        reportBranding,
        reportSubtitle,
        reportTemplate,
        reportTemplateFallbackKeys,
        reportTemplateKey,
        reportTitle,
        reportType,
        resourcePrintTemplate,
        resources,
        row,
      });
    } finally {
      setIsPrinting(false);
    }
  };

  if (resource) {
    return (
      <ResourceDetailDrawer
        designerBranding={reportBranding}
        onClose={onClose}
        open
        printFilters={printFilters}
        printTemplate={resourcePrintTemplate}
        resource={resource}
        selected={row}
      />
    );
  }

  if (!fields.length) return null;

  return (
    <DetailDrawer
      actions={
        <button className="secondary-button" disabled={isPrinting} onClick={() => void handlePrint()} type="button">
          <Printer className="h-4 w-4" />
          {translateText("In chung tu")}
        </button>
      }
      data={row}
      fieldLabels={fieldLabels}
      fields={fields}
      onClose={onClose}
      open
      summaryItems={summaryItems}
      title={drawerTitle}
    />
  );
}
