"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";
import { getTenantKey, setTenantKey } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/format";
import { getLicensePlanLabel, getLicenseSummary, localizeLicenseMessage } from "@/lib/license";
import { translateText } from "@/lib/i18n/display";
import { useLocale } from "@/lib/i18n/provider";
import { useLicense } from "@/lib/license-context";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

const buildLoginSchema = () =>
  z.object({
    databaseKey: z.string().min(1, translateText("Vui long chon CSDL")),
    identifier: z.string().min(1, translateText("Username/email/phone is required")),
    password: z.string().min(1, translateText("Password is required")),
    otpCode: z.string().optional(),
    rememberMe: z.boolean(),
  });

type LoginValues = z.infer<ReturnType<typeof buildLoginSchema>>;

type OtpConfig = {
  enabled: boolean;
  configured: boolean;
  channel: string;
  ttlMinutes: number;
  resendCooldownSeconds: number;
  codeLength: number;
};

type OtpChallenge = {
  challengeId: string;
  maskedTarget: string;
  expiresAt: string;
  resendCooldownSeconds: number;
};

type LoginDatabase = {
  code: string;
  name: string;
  isSystem?: boolean;
};

type LoginBranding = {
  appName: string;
  brandLabel: string;
  brandDescription: string;
  logoUrl: string;
};

const defaultLoginBranding: LoginBranding = {
  appName: "FitFlow Enterprise",
  brandLabel: "FITNESS ERP",
  brandDescription: "Multi-branch gym operations, CRM, contract, training, finance, lockers and reports in one admin portal.",
  logoUrl: "",
};

const resolveAssetUrl = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";
  if (/^https?:\/\//i.test(normalized)) return normalized;

  const apiBase = String(api.defaults.baseURL || "").replace(/\/api\/?$/, "");
  if (!apiBase) return normalized;
  return `${apiBase}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
};

export default function LoginPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const { login, requestOtp } = useAuth();
  const { licenseStatus } = useLicense();
  const loginSchema = useMemo(() => buildLoginSchema(), [locale]);
  const [error, setError] = useState<string | null>(null);
  const [databases, setDatabases] = useState<LoginDatabase[]>([]);
  const [databaseLoading, setDatabaseLoading] = useState(true);
  const [otpInfo, setOtpInfo] = useState<OtpConfig | null>(null);
  const [otpChallenge, setOtpChallenge] = useState<OtpChallenge | null>(null);
  const [otpLoading, setOtpLoading] = useState(true);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState("/dashboard");
  const [branding, setBranding] = useState<LoginBranding>(defaultLoginBranding);
  const [logoLoadError, setLogoLoadError] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      databaseKey: "MASTER",
      identifier: "admin@fitflow.local",
      password: "Admin@123",
      otpCode: "",
      rememberMe: true,
    },
  });

  const databaseKey = form.watch("databaseKey");
  const identifier = form.watch("identifier");
  const password = form.watch("password");

  useEffect(() => {
    let isMounted = true;

    const loadDatabases = async () => {
      try {
        const response = await api.get<LoginDatabase[]>("/auth/databases");
        if (!isMounted) return;
        const availableDatabases = response.data?.length
          ? response.data
          : [{ code: "MASTER", name: translateText("Master system"), isSystem: true }];
        setDatabases(availableDatabases);
        setError(null);
        const storedTenant = getTenantKey();
        const nextTenant =
          availableDatabases.find((item) => item.code === storedTenant)?.code || availableDatabases[0]?.code || "MASTER";
        form.setValue("databaseKey", nextTenant, { shouldValidate: true });
        setTenantKey(nextTenant);
      } catch {
        if (!isMounted) return;
        const fallbackDatabases = [{ code: "MASTER", name: translateText("Master system"), isSystem: true }];
        setDatabases(fallbackDatabases);
        const storedTenant = getTenantKey();
        const nextTenant = fallbackDatabases.find((item) => item.code === storedTenant)?.code || "MASTER";
        form.setValue("databaseKey", nextTenant, { shouldValidate: true });
        setTenantKey(nextTenant);
      } finally {
        if (isMounted) {
          setDatabaseLoading(false);
        }
      }
    };

    void loadDatabases();

    const loadOtpConfig = async () => {
      try {
        const response = await api.get<OtpConfig>("/auth/otp-config");
        if (!isMounted) return;
        setOtpInfo(response.data);
        setError(null);
      } catch {
        if (!isMounted) return;
        setOtpInfo({
          enabled: false,
          configured: false,
          channel: "ZALO",
          ttlMinutes: 5,
          resendCooldownSeconds: 60,
          codeLength: 6,
        });
      } finally {
        if (isMounted) {
          setOtpLoading(false);
        }
      }
    };

    void loadOtpConfig();

    const loadBranding = async () => {
      try {
        const response = await api.get<Partial<LoginBranding>>("/auth/login-branding");
        if (!isMounted) return;
        setBranding({
          appName: String(response.data?.appName || defaultLoginBranding.appName).trim() || defaultLoginBranding.appName,
          brandLabel: String(response.data?.brandLabel || defaultLoginBranding.brandLabel).trim() || defaultLoginBranding.brandLabel,
          brandDescription:
            String(response.data?.brandDescription || defaultLoginBranding.brandDescription).trim() ||
            defaultLoginBranding.brandDescription,
          logoUrl: resolveAssetUrl(String(response.data?.logoUrl || "")),
        });
      } catch {
        if (!isMounted) return;
        setBranding(defaultLoginBranding);
      }
    };

    void loadBranding();

    return () => {
      isMounted = false;
    };
  }, [form]);

  useEffect(() => {
    setOtpChallenge(null);
    form.setValue("otpCode", "");
  }, [databaseKey, form, identifier, password]);

  useEffect(() => {
    if (error) {
      setError(null);
    }
  }, [databaseKey, identifier, password]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextPath = new URLSearchParams(window.location.search).get("next");
    if (nextPath && nextPath.startsWith("/")) {
      setRedirectTarget(nextPath);
    }
  }, []);

  useEffect(() => {
    setLogoLoadError(false);
    if (typeof document !== "undefined") {
      document.title = branding.appName;
    }
  }, [branding.appName, branding.logoUrl]);

  const otpSummary = useMemo(() => {
    if (!otpInfo?.enabled) return null;
    return `${translateText("OTP")} ${otpInfo.codeLength} ${translateText("so")}, ${translateText("hieu luc")} ${otpInfo.ttlMinutes} ${translateText("phut")}`;
  }, [otpInfo]);
  const hasBrandImage = Boolean(branding.logoUrl && !logoLoadError);

  const formatDatabaseOptionLabel = (database: LoginDatabase) => {
    const translatedName = translateText(database.name);
    return translatedName;
  };

  const handleSendOtp = async () => {
    setError(null);
    const valid = await form.trigger(["databaseKey", "identifier", "password"]);
    if (!valid) return;

    const values = form.getValues();
    try {
      setSendingOtp(true);
      setTenantKey(values.databaseKey);
      const challenge = await requestOtp(values.identifier, values.password);
      setOtpChallenge(challenge);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : translateText("Khong gui duoc OTP"));
    } finally {
      setSendingOtp(false);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);

    if (otpInfo?.enabled) {
      if (!otpChallenge?.challengeId) {
        setError(translateText("Vui long gui OTP qua Zalo truoc khi dang nhap"));
        return;
      }

      if (!values.otpCode?.trim()) {
        setError(translateText("Vui long nhap OTP Zalo"));
        return;
      }
    }

    try {
      await login(
        values.databaseKey,
        values.identifier,
        values.password,
        values.otpCode,
        values.rememberMe,
        otpChallenge?.challengeId,
      );
      router.replace(redirectTarget);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : translateText("Login failed"));
    }
  });

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-top">
            <div className="min-w-0">
              {hasBrandImage ? (
                <img
                  alt={branding.appName}
                  className="mb-3 block max-h-[5rem] w-auto max-w-full object-contain object-left"
                  onError={() => setLogoLoadError(true)}
                  src={branding.logoUrl}
                />
              ) : null}
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">{branding.brandLabel}</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">{branding.appName}</h1>
            </div>
            <div className="login-brand-actions">
              <LanguageSwitcher />
            </div>
          </div>
          <div className="login-brand-copy">
            <p className="text-sm text-slate-500">{branding.brandDescription}</p>
            {licenseStatus ? (
              <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-white/80 px-4 py-4 text-sm text-slate-600">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">{translateText("License")}</div>
                <div className="mt-2 font-semibold text-slate-900">
                  {getLicensePlanLabel(licenseStatus.planCode, locale)} / {getLicenseSummary(licenseStatus, locale)}
                </div>
                <div className="mt-2 text-slate-500">{localizeLicenseMessage(licenseStatus.detailMessage, locale)}</div>
                <Link className="mt-3 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-900" href="/license">
                  {translateText("Open license center")}
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="field">
              <span>{translateText("Username / Email / Phone")}</span>
              <input {...form.register("identifier")} placeholder="admin@fitflow.local" />
              <small>{form.formState.errors.identifier?.message}</small>
            </label>

            <label className="field">
              <span>{translateText("Password")}</span>
              <input type="password" {...form.register("password")} placeholder={translateText("Enter your password")} />
              <small>{form.formState.errors.password?.message}</small>
            </label>
          </div>

          <label className="field">
            <span>{translateText("Nguon CSDL data")}</span>
            <select
              {...form.register("databaseKey")}
              disabled={databaseLoading}
              onChange={(event) => {
                form.setValue("databaseKey", event.target.value, { shouldValidate: true });
                setTenantKey(event.target.value);
              }}
            >
              {databases.map((database) => (
                <option key={database.code} value={database.code}>
                  {formatDatabaseOptionLabel(database)}
                </option>
              ))}
            </select>
            <small>{form.formState.errors.databaseKey?.message?.toString()}</small>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {translateText("Chon nguon du lieu de dang nhap.")}
          </div>

          {otpInfo?.enabled ? (
            <label className="field">
              <span>{translateText("OTP Code")}</span>
              <input {...form.register("otpCode")} placeholder={translateText("Nhap OTP vua nhan tren Zalo")} />
              <small>{otpSummary || translateText("Nhap ma OTP de xac nhan dang nhap.")}</small>
            </label>
          ) : null}

          {otpLoading || databaseLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              {translateText("Dang tai cau hinh dang nhap...")}
            </div>
          ) : otpInfo?.enabled ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-sm text-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{`${translateText("Dang nhap OTP qua")} ${otpInfo.channel}`}</p>
                  <p className="mt-1">
                    {`${translateText("Nhan vien se dang nhap bang mat khau + OTP. Neu chua nhan duoc ma, ban co the gui lai sau")} ${otpInfo.resendCooldownSeconds} ${translateText("giay")}.`}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  disabled={sendingOtp || !otpInfo.configured || form.formState.isSubmitting}
                  onClick={handleSendOtp}
                  type="button"
                >
                  {sendingOtp ? translateText("Dang gui OTP...") : translateText("Gui OTP qua Zalo")}
                </button>
              </div>

              {!otpInfo.configured ? (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                  {translateText("He thong da bat OTP nhung chua cau hinh du token Zalo hoac OTP Template ID.")}
                </p>
              ) : null}

              {otpChallenge ? (
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-white px-3 py-3">
                  <p className="font-medium text-slate-900">{translateText("OTP da duoc gui")}</p>
                  <p className="mt-1">
                    {translateText("Dich den")}: <span className="font-medium">{otpChallenge.maskedTarget}</span>
                  </p>
                  <p>{translateText("Het han luc")}: {formatDateTime(otpChallenge.expiresAt)}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <label className="inline-flex items-center gap-2 text-slate-600">
              <input className="h-4 w-4 rounded border-slate-300" type="checkbox" {...form.register("rememberMe")} />
              {translateText("Remember me")}
            </label>
            <button className="text-emerald-700 transition hover:text-emerald-900" type="button">
              {translateText("Forgot password")}
            </button>
          </div>

          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}

          <button
            className="primary-button w-full"
            disabled={form.formState.isSubmitting || otpLoading || databaseLoading}
            type="submit"
          >
            {form.formState.isSubmitting ? translateText("Signing in...") : otpInfo?.enabled ? translateText("Xac nhan va dang nhap") : translateText("Sign In")}
          </button>
        </form>
      </div>
    </div>
  );
}
