"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { getLicensePlanDuration, getLicensePlanLabel, licensePlanCodes, localizeLicenseMessage } from "@/lib/license";
import { cn } from "@/lib/format";
import { translateText } from "@/lib/i18n/display";
import { useLocale } from "@/lib/i18n/provider";
import type { LicensePlanCode, LicenseStatusSummary } from "@/types/license";

interface LicenseRequestCodePanelProps {
  initialPlanCode: LicensePlanCode;
  initialRequestCode: string;
  variant?: "full" | "compact";
}

export function LicenseRequestCodePanel({
  initialPlanCode,
  initialRequestCode,
  variant = "full",
}: LicenseRequestCodePanelProps) {
  const { locale } = useLocale();
  const [planCode, setPlanCode] = useState<LicensePlanCode>(initialPlanCode);
  const [requestCode, setRequestCode] = useState(initialRequestCode);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlanCode(initialPlanCode);
    setRequestCode(initialRequestCode);
  }, [initialPlanCode, initialRequestCode]);

  useEffect(() => {
    let active = true;

    const loadRequestCode = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<LicenseStatusSummary>("/license", {
          params: { planCode },
        });

        if (active) {
          setRequestCode(response.data.requestCode);
        }
      } catch (requestError) {
        if (!active) {
          return;
        }

        const responseData = (requestError as { response?: { data?: { error?: { message?: string } | { message?: string } } } })?.response?.data;
        const responseMessage =
          (responseData as { error?: { message?: string }; message?: string } | undefined)?.error?.message ||
          (responseData as { error?: { message?: string }; message?: string } | undefined)?.message;

        setError(
          typeof responseMessage === "string" && responseMessage.trim()
            ? localizeLicenseMessage(responseMessage, locale)
            : translateText("Khong tao duoc request code."),
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadRequestCode();

    return () => {
      active = false;
    };
  }, [planCode, reloadKey]);

  const refreshRequestCode = async () => {
    setReloadKey((current) => current + 1);
  };

  const copyRequestCode = async () => {
    if (!requestCode) {
      return;
    }

    await navigator.clipboard.writeText(requestCode);
    toast.success(translateText("Da copy request code."));
  };

  if (variant === "compact") {
    return (
      <div className="flex min-w-0 w-full max-w-[332px] flex-col gap-2 justify-self-end">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="min-w-0 flex-1 rounded-[0.85rem] border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-900 outline-none"
            onChange={(event) => setPlanCode(event.target.value as LicensePlanCode)}
            value={planCode}
          >
            {licensePlanCodes.map((item) => (
              <option key={item} value={item}>
                {getLicensePlanLabel(item, locale)}
              </option>
            ))}
          </select>

          <button className="primary-button shrink-0 !rounded-[0.9rem] !px-4 !py-2" onClick={() => void copyRequestCode()} type="button">
            <Copy className="h-3.5 w-3.5" />
            {translateText("Copy request code")}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 flex-1 text-[11px] text-slate-500">{getLicensePlanDuration(planCode, locale)}</div>
          <Link className="secondary-button shrink-0 !rounded-[0.9rem] !px-4 !py-2" href="/license">
            {translateText("License center")}
          </Link>
        </div>

        {error ? <div className="rounded-[0.8rem] bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{error}</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <label className="field">
          <span>{translateText("Che do dang ky")}</span>
          <select onChange={(event) => setPlanCode(event.target.value as LicensePlanCode)} value={planCode}>
            {licensePlanCodes.map((item) => (
              <option key={item} value={item}>
                {getLicensePlanLabel(item, locale)}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button className="secondary-button w-full !rounded-[0.8rem] !px-4 !py-3 md:w-auto" disabled={isLoading} onClick={() => void refreshRequestCode()} type="button">
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            {translateText("Lam moi")}
          </button>
        </div>
      </div>

      <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">{translateText("Request code")}</div>
        <textarea
          className="mt-3 min-h-[148px] w-full resize-y rounded-[0.9rem] border border-slate-200 bg-white px-4 py-3 text-[12px] leading-6 text-slate-700 outline-none"
          readOnly
          value={requestCode}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">{getLicensePlanDuration(planCode, locale)}</div>
          <div className="flex flex-wrap gap-2">
            <button className="primary-button !rounded-[0.9rem] !px-4 !py-2" onClick={() => void copyRequestCode()} type="button">
              <Copy className="h-3.5 w-3.5" />
              {translateText("Copy request code")}
            </button>
            <Link className="secondary-button !rounded-[0.9rem] !px-4 !py-2" href="/license">
              {translateText("Open license center")}
            </Link>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-[0.8rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
    </div>
  );
}
