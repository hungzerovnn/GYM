"use client";

import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, Link2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { translateText } from "@/lib/i18n/display";
import { getSocialRequestedChannelLabel } from "@/lib/social-module-config";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";

type PublicSessionPayload = {
  title?: string;
  requestedChannelKey?: string;
  linkMethod?: string;
  pairCode?: string;
  status?: string;
  expiresAt?: string;
  connectedAt?: string;
  branchName?: string;
  createdByName?: string;
  connectedDevice?: Record<string, unknown> | null;
};

const copyText = async (value: string, successMessage: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(translateText(successMessage));
  } catch {
    toast.error(translateText("Khong copy duoc noi dung nay."));
  }
};

const detectDeviceType = () => {
  if (typeof navigator === "undefined") return "BROWSER_EXTENSION";
  const userAgent = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|mobile|ios/.test(userAgent)) {
    return "MOBILE";
  }
  return "BROWSER_EXTENSION";
};

export function SocialLinkClaimClient({
  sessionToken,
  tenantKey,
}: {
  sessionToken: string;
  tenantKey: string;
}) {
  const sessionQuery = useQuery({
    queryKey: ["social-link-public-session", tenantKey, sessionToken],
    queryFn: async () => {
      const response = await api.get(`/social/linking/public/session/${encodeURIComponent(sessionToken)}`, {
        params: { tenantKey },
      });
      return (response.data || {}) as PublicSessionPayload;
    },
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(
        "/social/linking/public/claim",
        {
          tenantKey,
          sessionToken,
          deviceType: detectDeviceType(),
          metadata: {
            claimedFrom: "public-social-link-page",
          },
        },
        {
          params: { tenantKey },
        },
      );
      return (response.data || {}) as Record<string, unknown>;
    },
    onSuccess: async () => {
      await sessionQuery.refetch();
      toast.success(translateText("Da lien ket thiet bi nay vao session."));
    },
    onError: (error) => {
      const message =
        error && typeof error === "object" && "response" in error
          ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message || translateText("Khong lien ket duoc thiet bi nay."))
          : translateText("Khong lien ket duoc thiet bi nay.");
      toast.error(message);
    },
  });

  const claimedDeviceSecret = useMemo(
    () => String(claimMutation.data?.deviceSecret || "").trim(),
    [claimMutation.data],
  );

  if (sessionQuery.isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">{translateText("Dang tai phien lien ket...")}</div>;
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-12">
        <EmptyState title="Khong tim thay phien lien ket" description="Link nay co the da het han, sai tenant hoac da bi thu hoi truoc khi thiet bi mo den." />
      </div>
    );
  }

  const session = sessionQuery.data;
  const connectedDevice = session.connectedDevice || null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_38%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[1.5rem] border border-emerald-100 bg-white/95 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                <Smartphone className="h-3.5 w-3.5" />
                {translateText("Social Device Link")}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                {String(session.title || "Lien ket thiet bi nay")}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                {translateText("Trang nay dung de lien ket thiet bi dang mo link nay vao module chat / social. Ban khong can dang nhap portal de claim session nay.")}
              </p>
            </div>
            <StatusBadge value={String(session.status || "")} />
          </div>

          <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            <span className="font-semibold">{translateText("Dang nhap o dau")}: </span>
            {translateText("Ban dang nhap o Zalo, WeChat, WhatsApp, Messenger, Telegram, Viber, LINE, KakaoTalk, Signal hoac Discord tren chinh thiet bi nay truoc. Trang nay chi la buoc xac nhan lien ket thiet bi vao CRM.")}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Kenh uu tien")}</p>
              <p className="mt-2 font-semibold text-slate-900">{getSocialRequestedChannelLabel(session.requestedChannelKey)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Pair code")}</p>
              <p className="mt-2 font-mono font-semibold text-slate-900">{String(session.pairCode || "-")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Het han")}</p>
              <p className="mt-2 font-semibold text-slate-900">{session.expiresAt ? formatDateTime(session.expiresAt) : "-"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Chi nhanh / tao boi")}</p>
              <p className="mt-2 font-semibold text-slate-900">{String(session.branchName || session.createdByName || "-")}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="primary-button"
              disabled={claimMutation.isPending || String(session.status || "").toUpperCase() === "CONNECTED"}
              onClick={() => void claimMutation.mutateAsync()}
              type="button"
            >
              <Link2 className="h-4 w-4" />
              {translateText("Lien ket thiet bi nay")}
            </button>
            <button className="secondary-button" onClick={() => void copyText(String(session.pairCode || ""), "Da copy pair code.")} type="button">
              <Copy className="h-4 w-4" />
              {translateText("Copy pair code")}
            </button>
          </div>
        </section>

        {connectedDevice ? (
          <section className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50/90 p-5 text-emerald-900">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              {translateText("Session da duoc lien ket")}
            </div>
            <p className="mt-2 text-sm leading-6">
              {String(connectedDevice.deviceName || "-")} | {String(connectedDevice.deviceCode || "-")}
            </p>
          </section>
        ) : null}

        {claimedDeviceSecret ? (
          <section className="rounded-[1.4rem] border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{translateText("Device secret")}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {translateText("Neu ban dang dung bridge local hoac extension co heartbeat rieng, hay copy secret nay vao cau hinh cua thiet bi.")}
                </p>
              </div>
              <button className="secondary-button" onClick={() => void copyText(claimedDeviceSecret, "Da copy device secret.")} type="button">
                <Copy className="h-4 w-4" />
                {translateText("Copy")}
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-[12px] leading-6 text-slate-100">{claimedDeviceSecret}</pre>
            <p className="mt-3 text-xs leading-6 text-slate-500">
              {String(claimMutation.data?.heartbeatUrl || "")}
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
