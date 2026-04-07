"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { detectLicenseCodeKind, getLicensePlanLabel, localizeLicenseMessage, normalizeLicenseCode } from "@/lib/license";
import { formatDateTime } from "@/lib/format";
import { translateText } from "@/lib/i18n/display";
import { useLocale } from "@/lib/i18n/provider";
import { useLicense } from "@/lib/license-context";
import type { LicenseStatusSummary } from "@/types/license";

export function LicenseActivationForm() {
  const router = useRouter();
  const { locale } = useLocale();
  const { refresh } = useLicense();
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [unlockCode, setUnlockCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isUnlocked = Boolean(accessToken);
  const licenseCodeKind = detectLicenseCodeKind(unlockCode);
  const normalizedUnlockCode = normalizeLicenseCode(unlockCode);
  const canSubmitUnlockCode = isUnlocked && licenseCodeKind === "unlock" && normalizedUnlockCode.length > 0;

  const unlockActivationArea = async () => {
    setAccessError(null);
    setError(null);
    setSuccessMessage(null);
    setIsUnlocking(true);

    try {
      const response = await api.post<{ accessToken: string }>("/license/access", {
        password,
      });

      setAccessToken(response.data.accessToken);
      setPassword("");
    } catch (requestError) {
      const responseData = (requestError as { response?: { data?: { error?: { message?: string } | { message?: string } } } })?.response?.data;
      const responseMessage =
        (responseData as { error?: { message?: string }; message?: string } | undefined)?.error?.message ||
        (responseData as { error?: { message?: string }; message?: string } | undefined)?.message;

      setAccessError(
        typeof responseMessage === "string" && responseMessage.trim()
          ? localizeLicenseMessage(responseMessage, locale)
          : translateText("Khong mo duoc khu vuc kich hoat license."),
      );
      setAccessToken(null);
    } finally {
      setIsUnlocking(false);
    }
  };

  const lockActivationArea = () => {
    setAccessToken(null);
    setPassword("");
    setUnlockCode("");
    setError(null);
    setAccessError(null);
    setSuccessMessage(null);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSuccessMessage(null);

        startTransition(async () => {
          try {
            const response = await api.post<LicenseStatusSummary>("/license/activate", {
              unlockCode: normalizedUnlockCode,
              accessToken,
            });

            const nextStatus = response.data;
            const plan = getLicensePlanLabel(nextStatus.planCode, locale);
            const nextMessage = nextStatus.expiresAt
              ? `${plan} | ${translateText("Het han")}: ${formatDateTime(nextStatus.expiresAt, locale)}`
              : `${plan} | ${translateText("Khong gioi han")}`;

            setSuccessMessage(nextMessage);
            setAccessToken(null);
            setUnlockCode("");
            setPassword("");
            await refresh();
            toast.success(translateText("Kich hoat license thanh cong."));
            router.refresh();
          } catch (requestError) {
            const responseData = (requestError as { response?: { data?: { error?: { message?: string } | { message?: string } } } })?.response?.data;
            const responseMessage =
              (responseData as { error?: { message?: string }; message?: string } | undefined)?.error?.message ||
              (responseData as { error?: { message?: string }; message?: string } | undefined)?.message;

            setError(
              typeof responseMessage === "string" && responseMessage.trim()
                ? localizeLicenseMessage(responseMessage, locale)
                : translateText("Khong kich hoat duoc license."),
            );
          }
        });
      }}
    >
      {successMessage ? <div className="rounded-[0.9rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{successMessage}</div> : null}

      <label className="field">
        <span>{translateText("Mat khau license")}</span>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            autoComplete="current-password"
            disabled={isUnlocked || isPending}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isUnlocked ? translateText("Da mo khu vuc kich hoat") : translateText("Nhap mat khau license")}
            type="password"
            value={password}
          />
          {isUnlocked ? (
            <button className="secondary-button sm:min-w-[140px]" onClick={lockActivationArea} type="button">
              {translateText("Khoa lai")}
            </button>
          ) : (
            <button
              className="primary-button sm:min-w-[160px]"
              disabled={isUnlocking || password.trim().length === 0}
              onClick={() => void unlockActivationArea()}
              type="button"
            >
              {isUnlocking ? translateText("Dang mo khoa...") : translateText("Mo khu vuc kich hoat")}
            </button>
          )}
        </div>
      </label>

      <div className="rounded-[0.9rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        {translateText("Mat khau nay chi mo tam thoi khu vuc nhap key trong 15 phut.")}
      </div>

      {accessError ? <div className="rounded-[0.9rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{accessError}</div> : null}

      {!isUnlocked ? (
        <div className="rounded-[0.9rem] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
          {translateText("Nhap dung mat khau license de mo o nhap unlock code.")}
        </div>
      ) : null}

      {isUnlocked ? (
        <>
          <label className="field">
            <span>{translateText("Unlock code")}</span>
            <textarea
              onChange={(event) => setUnlockCode(event.target.value)}
              placeholder={translateText("Dan ma mo khoa bat dau bang GYM-KEY")}
              value={unlockCode}
            />
          </label>

          {licenseCodeKind === "request" ? (
            <div className="rounded-[0.9rem] bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {translateText("Ban dang dan request code. Hay dan unlock code bat dau bang GYM-KEY.")}
            </div>
          ) : null}

          {licenseCodeKind === "unlock" ? (
            <div className="rounded-[0.9rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {translateText("Unlock code hop le. Ban co the kich hoat ngay.")}
            </div>
          ) : null}

          {licenseCodeKind === "unknown" ? (
            <div className="rounded-[0.9rem] bg-slate-100 px-4 py-3 text-sm text-slate-700">
              {translateText("Ma vua dan khong dung dinh dang license cua GYM.")}
            </div>
          ) : null}

          {error ? <div className="rounded-[0.9rem] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <button className="primary-button" disabled={isPending || !canSubmitUnlockCode} type="submit">
            {isPending ? translateText("Dang kich hoat...") : translateText("Kich hoat key")}
          </button>
        </>
      ) : null}
    </form>
  );
}
