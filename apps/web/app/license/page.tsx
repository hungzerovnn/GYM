"use client";

import Link from "next/link";
import { LicenseActivationForm } from "@/components/license/license-activation-form";
import { LicenseRequestCodePanel } from "@/components/license/license-request-code-panel";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/format";
import { getLicensePlanDuration, getLicensePlanLabel, licensePlanCodes, localizeLicenseMessage } from "@/lib/license";
import { translateText } from "@/lib/i18n/display";
import { useLocale } from "@/lib/i18n/provider";
import { useLicense } from "@/lib/license-context";

function maskMachineGuid(value: string | null) {
  if (!value) {
    return translateText("Khong doc duoc");
  }

  if (value.length <= 8) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export default function LicensePage() {
  const { locale } = useLocale();
  const { user, isAuthenticated } = useAuth();
  const { licenseStatus, isLoading } = useLicense();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">{translateText("Dang tai trang license...")}</div>;
  }

  if (!licenseStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card max-w-xl p-8 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-600">{translateText("License")}</div>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">{translateText("Khong tai duoc trang license")}</h1>
          <p className="mt-3 text-sm text-slate-500">{translateText("Hay kiem tra API GYM dang chay tren cong 6273 roi tai lai trang.")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="card space-y-6 rounded-[2rem] p-6 sm:p-8">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText("License center")}</div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">{translateText("Dang ky ban quyen GYM")}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
              {translateText("Trang nay dung de tao request code, nhan unlock code va theo doi tinh trang ban quyen cua phan mem GYM.")}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{translateText("Trang thai hien tai")}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{getLicensePlanLabel(licenseStatus.planCode, locale)}</div>
              <div className="mt-2 text-sm text-slate-600">{localizeLicenseMessage(licenseStatus.detailMessage, locale)}</div>
              {licenseStatus.warningMessage ? (
                <div className="mt-3 rounded-[1rem] bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {localizeLicenseMessage(licenseStatus.warningMessage, locale)}
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{translateText("Hieu luc")}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {licenseStatus.expiresAt ? formatDateTime(licenseStatus.expiresAt, locale) : translateText("Vinh vien")}
              </div>
              <div className="mt-2 text-sm text-slate-500">
                {licenseStatus.daysRemaining !== null
                  ? `${translateText("Con lai")}: ${licenseStatus.daysRemaining} ${translateText("ngay")}`
                  : translateText("Khong gioi han thoi gian")}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{translateText("Ngay kich hoat")}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(licenseStatus.issuedAt, locale)}</div>
            </div>

            <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{translateText("Ngay het han")}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {licenseStatus.expiresAt ? formatDateTime(licenseStatus.expiresAt, locale) : translateText("Khong co ngay het han")}
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{translateText("Loai key")}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{getLicensePlanLabel(licenseStatus.planCode, locale)}</div>
            </div>
          </div>

          <div className="space-y-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
            <div>
              <div className="text-lg font-semibold text-slate-900">{translateText("Cac goi ban quyen")}</div>
              <div className="mt-2 text-sm text-slate-500">{translateText("GYM dung chung 4 che do license giong QLKS de viec gia han va keygen de quan ly hon.")}</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {licensePlanCodes.map((planCode) => {
                const isActive = planCode === licenseStatus.planCode;

                return (
                  <div
                    className={`rounded-[1.1rem] border p-4 ${isActive ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}
                    key={planCode}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900">{getLicensePlanLabel(planCode, locale)}</div>
                      {isActive ? (
                        <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                          {translateText("Dang dung")}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{getLicensePlanDuration(planCode, locale)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
            <div className="text-lg font-semibold text-slate-900">{translateText("Tao request code")}</div>
            <div className="mt-2 text-sm text-slate-500">{translateText("Chon goi, copy request code, dua cho may tao key roi nhan lai unlock code.")}</div>
            <div className="mt-4">
              <LicenseRequestCodePanel
                initialPlanCode={licenseStatus.requestPlanCode}
                initialRequestCode={licenseStatus.requestCode}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-900">{translateText("Thong tin may")}</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>
                  {translateText("Hostname")}: <span className="font-medium text-slate-900">{licenseStatus.machine.hostname}</span>
                </div>
                <div>
                  {translateText("MAC chinh")}: <span className="font-medium text-slate-900">{licenseStatus.machine.primaryMac || translateText("Khong doc duoc")}</span>
                </div>
                <div>
                  {translateText("Machine GUID")}: <span className="font-medium text-slate-900">{maskMachineGuid(licenseStatus.machine.machineGuid)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-900">{translateText("Fingerprint")}</div>
              <div className="mt-3 break-all rounded-[1rem] bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800">
                {licenseStatus.machine.machineFingerprint}
              </div>
            </div>
          </div>
        </section>

        <section className="card space-y-6 rounded-[2rem] p-6 sm:p-8">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{translateText("Nhap key kich hoat")}</div>
            <h2 className="mt-3 text-3xl font-semibold text-slate-900">{translateText("Mo khoa ban quyen")}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {translateText("Dung mat khau license de mo o nhap key, sau do dan unlock code bat dau bang GYM-KEY.")}
            </p>
          </div>

          <LicenseActivationForm />

          <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            {translateText("De tao unlock code ngoai may khach, mo file license-tool.bat trong thu muc GYM va dan request code vao do.")}
          </div>

          <div className="flex flex-wrap gap-3">
            {isAuthenticated && user ? (
              <Link className="primary-button" href={licenseStatus.usable ? "/dashboard" : "/license"}>
                {licenseStatus.usable ? translateText("Mo he thong") : translateText("Dang bi khoa")}
              </Link>
            ) : (
              <Link className="primary-button" href="/login">
                {translateText("Quay lai dang nhap")}
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
