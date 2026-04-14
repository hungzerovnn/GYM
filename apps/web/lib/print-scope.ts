"use client";

import { api } from "@/lib/api";
import type { ReportDesignerBranding } from "@/lib/report-designer";

const normalizeText = (value: unknown) => String(value || "").trim();

export const resolvePrintAssetUrl = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const apiBase = String(api.defaults.baseURL || "").replace(/\/api\/?$/, "");
  if (!apiBase) return normalized;
  return `${apiBase}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
};

export const toReportBranding = (payload?: Record<string, unknown> | null): ReportDesignerBranding | null =>
  payload
    ? {
        companyName: normalizeText(payload.companyName),
        legalName: normalizeText(payload.legalName),
        address: normalizeText(payload.address),
        hotline: normalizeText(payload.hotline),
        email: normalizeText(payload.email),
        website: normalizeText(payload.website),
        logoUrl: resolvePrintAssetUrl(normalizeText(payload.logoUrl)),
        branchName: normalizeText(payload.branchName),
      }
    : null;

export const resolveRecordBranchId = (...records: Array<Record<string, unknown> | null | undefined>) => {
  for (const record of records) {
    const direct = normalizeText(record?.branchId);
    if (direct) return direct;

    const nestedBranch = record?.branch;
    if (nestedBranch && typeof nestedBranch === "object" && !Array.isArray(nestedBranch)) {
      const nestedId = normalizeText((nestedBranch as Record<string, unknown>).id);
      if (nestedId) return nestedId;
    }
  }

  return "";
};

export const fetchScopedPrintContext = async (
  branchId: string,
  options?: {
    includePrintTemplate?: boolean;
    includeReportTemplate?: boolean;
    includeBranding?: boolean;
  },
) => {
  const normalizedBranchId = normalizeText(branchId);
  if (!normalizedBranchId) {
    return {
      branding: null as ReportDesignerBranding | null,
      printTemplate: null as Record<string, unknown> | null,
      reportTemplate: null as Record<string, unknown> | null,
    };
  }

  const {
    includePrintTemplate = false,
    includeReportTemplate = false,
    includeBranding = true,
  } = options || {};

  const params = { branchId: normalizedBranchId };
  const [companyResponse, printTemplateResponse, reportTemplateResponse] = await Promise.all([
    includeBranding ? api.get<Record<string, unknown>>("/settings/company", { params }) : Promise.resolve(null),
    includePrintTemplate ? api.get<Record<string, unknown>>("/settings/print-templates", { params }) : Promise.resolve(null),
    includeReportTemplate ? api.get<Record<string, unknown>>("/settings/report-templates", { params }) : Promise.resolve(null),
  ]);

  return {
    branding: toReportBranding(companyResponse?.data || null),
    printTemplate: printTemplateResponse?.data || null,
    reportTemplate: reportTemplateResponse?.data || null,
  };
};
