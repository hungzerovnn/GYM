"use client";

import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/format";
import { getLicensePlanLabel, getLicenseSummary } from "@/lib/license";
import { translateText } from "@/lib/i18n/display";
import { useLocale } from "@/lib/i18n/provider";
import type { LicenseStatusSummary } from "@/types/license";
import { LicenseRequestCodePanel } from "./license-request-code-panel";

export function LicenseTopbarActions({ licenseStatus }: { licenseStatus: LicenseStatusSummary }) {
  const { locale } = useLocale();

  return (
    <div className="flex w-full max-w-[720px] flex-col gap-3 rounded-[1rem] border border-slate-200 bg-white/90 px-4 py-3 xl:grid xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-center">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>{translateText("License")}</span>
        </div>
        <div
          className={cn(
            "mt-1 text-[12px] leading-6",
            licenseStatus.state === "warning"
              ? "text-amber-700"
              : licenseStatus.state === "expired" || licenseStatus.state === "invalid"
                ? "text-rose-700"
                : "text-slate-600",
          )}
        >
          <span className="font-semibold text-slate-900">{getLicensePlanLabel(licenseStatus.planCode, locale)}</span>
          <span className="mx-2 text-slate-300">/</span>
          <span>{getLicenseSummary(licenseStatus, locale)}</span>
        </div>
      </div>

      <LicenseRequestCodePanel
        initialPlanCode={licenseStatus.requestPlanCode}
        initialRequestCode={licenseStatus.requestCode}
        variant="compact"
      />
    </div>
  );
}
