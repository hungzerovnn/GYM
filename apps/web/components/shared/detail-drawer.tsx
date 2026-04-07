"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { resolveTextDisplay, translateFieldLabel, translateText } from "@/lib/i18n/display";
import { StatusBadge } from "./status-badge";

export interface DetailSummaryItem {
  label: string;
  value?: unknown;
  type?: "text" | "status" | "currency" | "date" | "datetime";
}

export interface DetailSection {
  key: string;
  label: string;
  count?: number;
  content: React.ReactNode;
}

interface DetailDrawerProps {
  title: string;
  open: boolean;
  data?: Record<string, unknown> | null;
  fields: string[];
  fieldLabels?: Record<string, string>;
  onClose: () => void;
  summaryItems?: DetailSummaryItem[];
  sections?: DetailSection[];
  actions?: React.ReactNode;
}

const renderValue = (field: string, value: unknown, type?: DetailSummaryItem["type"]) => {
  if (value === null || value === undefined || value === "") return "-";

  const normalizedType =
    type ||
    (field.toLowerCase().includes("status")
      || field.toLowerCase().includes("state")
      || field.toLowerCase().includes("level")
      ? "status"
      : field.toLowerCase().includes("amount") || field.toLowerCase().includes("price") || field.toLowerCase().includes("debt")
        ? "currency"
        : field.toLowerCase().includes("date")
          ? "date"
          : "text");

  if (normalizedType === "status") return <StatusBadge value={String(value)} />;
  if (normalizedType === "currency") return formatCurrency(value as number);
  if (normalizedType === "datetime") return formatDateTime(String(value));
  if (normalizedType === "date") return String(value).includes("T") ? formatDateTime(String(value)) : formatDate(String(value));
  return resolveTextDisplay(value, field);
};

function DetailDrawerContent({
  title,
  data,
  fields,
  fieldLabels = {},
  onClose,
  summaryItems = [],
  sections = [],
  actions,
}: Omit<DetailDrawerProps, "open" | "data"> & { data: Record<string, unknown> }) {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35">
      <div className="flex h-full w-full max-w-[760px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">{translateText("Ho so chi tiet")}</p>
            <h3 className="mt-1 text-[17px] font-semibold text-slate-900">{translateText(title)}</h3>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button className="secondary-button !rounded-[0.6rem] !p-2" onClick={onClose} type="button">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-4 py-4">
          {summaryItems.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {summaryItems.map((item) => (
                <div className="rounded-[0.8rem] border border-slate-200 bg-slate-50 p-3" key={item.label}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{translateText(item.label)}</p>
                  <div className="mt-1.5 text-[12px] font-medium text-slate-900">{renderValue(item.label, item.value, item.type)}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
            <button
              className={`rounded-[0.58rem] px-3 py-1.5 text-[12px] font-medium transition ${activeTab === "overview" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              onClick={() => setActiveTab("overview")}
              type="button"
            >
              {translateText("Tong quan")}
            </button>
            {sections.map((section) => (
              <button
                className={`rounded-[0.58rem] px-3 py-1.5 text-[12px] font-medium transition ${activeTab === section.key ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                key={section.key}
                onClick={() => setActiveTab(section.key)}
                type="button"
              >
                {translateText(section.label)}
                {section.count !== undefined ? ` (${section.count})` : ""}
              </button>
            ))}
          </div>

          {activeTab === "overview" ? (
            <div className="mt-4 grid gap-3">
              {fields.map((field) => (
                <div className="rounded-[0.8rem] border border-slate-100 bg-slate-50 p-3" key={field}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{fieldLabels[field] || translateFieldLabel(field)}</p>
                  <div className="mt-1.5 text-[12px] text-slate-800">{renderValue(field, data[field])}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">{sections.find((section) => section.key === activeTab)?.content}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DetailDrawer({ title, open, data, fields, fieldLabels = {}, onClose, summaryItems = [], sections = [], actions }: DetailDrawerProps) {
  if (!open || !data) return null;

  const drawerKey = `${title}:${String(data.id || data.code || "detail")}`;

  return (
    <DetailDrawerContent
      actions={actions}
      data={data}
      fields={fields}
      fieldLabels={fieldLabels}
      key={drawerKey}
      onClose={onClose}
      sections={sections}
      summaryItems={summaryItems}
      title={title}
    />
  );
}
