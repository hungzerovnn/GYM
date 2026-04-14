"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { translateText } from "@/lib/i18n/display";
import { EmptyState } from "../feedback/empty-state";

export const renderMiniTable = (
  headers: string[],
  rows: Array<Array<React.ReactNode>>,
  emptyTitle: string,
  emptyDescription: string,
) => {
  if (!rows.length) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />;
  }

  return (
    <div className="overflow-auto rounded-[0.8rem] border border-slate-200">
      <table className="min-w-full text-[11px]">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            {headers.map((header) => (
              <th className="px-3 py-2 font-semibold" key={header}>
                {translateText(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t border-slate-100 align-top" key={index}>
              {row.map((cell, cellIndex) => (
                <td className="px-3 py-2" key={cellIndex}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const renderInfoCard = (
  eyebrow: string,
  title: string,
  description?: React.ReactNode,
) => (
  <div className="rounded-[0.8rem] border border-slate-200 bg-slate-50 p-4">
    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{translateText(eyebrow)}</p>
    <p className="mt-1.5 text-[14px] font-semibold text-slate-900">{title || "-"}</p>
    {description ? <div className="mt-1.5 text-[12px] text-slate-500">{description}</div> : null}
  </div>
);

export const formatSnapshotValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const toApiErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "response" in error) {
    const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
};

export const resolveAssetUrl = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const apiBase = String(api.defaults.baseURL || "").replace(/\/api\/?$/, "");
  if (!apiBase) return normalized;
  return `${apiBase}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
};

export function PreviewAssetCard({
  eyebrow,
  title,
  assetUrl,
  description,
  openLabel,
  emptyMessage,
  altFallback,
}: {
  eyebrow: string;
  title: string;
  assetUrl?: string;
  description?: React.ReactNode;
  openLabel?: string;
  emptyMessage?: string;
  altFallback?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const normalizedUrl = String(assetUrl || "").trim();
  const canPreview = Boolean(normalizedUrl) && !hasError;

  return (
    <div className="rounded-[0.8rem] border border-slate-200 bg-slate-50 p-4 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">{translateText(eyebrow)}</p>
          <p className="mt-1.5 text-[14px] font-semibold text-slate-900">{title || "-"}</p>
        </div>
        {normalizedUrl ? (
          <a
            className="secondary-button !h-auto !rounded-[0.58rem] !px-3 !py-1.5 text-[11px]"
            href={normalizedUrl}
            rel="noreferrer"
            target="_blank"
          >
            {translateText(openLabel || "Mo tep anh")}
          </a>
        ) : null}
      </div>
      {description ? <div className="mt-1.5 text-[12px] text-slate-500">{description}</div> : null}
      <div className="mt-3 overflow-hidden rounded-[0.75rem] border border-slate-200 bg-white">
        {canPreview ? (
          <img
            alt={title || translateText(altFallback || "Anh preview")}
            className="h-40 w-full object-contain bg-white p-3"
            onError={() => setHasError(true)}
            src={normalizedUrl}
          />
        ) : (
          <div className="flex h-40 items-center justify-center bg-slate-100 px-4 text-center text-[12px] text-slate-500">
            {translateText(normalizedUrl ? "Khong tai duoc hinh preview." : emptyMessage || "Chua cau hinh hinh anh.")}
          </div>
        )}
      </div>
      {normalizedUrl ? <div className="mt-2.5 break-all text-[11px] text-slate-500">{normalizedUrl}</div> : null}
    </div>
  );
}
