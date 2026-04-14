"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, MonitorSmartphone, Puzzle, RefreshCw, ShieldOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { translateText } from "@/lib/i18n/display";
import { useLocale } from "@/lib/i18n/provider";
import { localizeSettingDefinition } from "@/lib/i18n/portal";
import { getSocialRequestedChannelLabel, socialInboxPath, socialLinkChannelOptions } from "@/lib/social-module-config";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { SettingDefinition } from "@/types/portal";

type SocialLinkOverview = {
  tenantKey: string;
  summary?: Record<string, number>;
  sessions?: Array<Record<string, unknown>>;
  devices?: Array<Record<string, unknown>>;
};

type MethodKey = (typeof methodConfigs)[number]["key"];

type ChannelGuide = {
  loginTitle: string;
  loginDescription: string;
  oauthHint: string;
  launchLinks: Array<{ label: string; url: string }>;
};

const methodConfigs = [
  {
    key: "DESKTOP_BRIDGE",
    title: "PC bridge",
    subtitle: "Dung cho may tinh Windows / local service. Thich hop khi muon gan may dang login san vao CRM mot cach ben vung.",
    icon: MonitorSmartphone,
    eyebrow: "Desktop",
  },
  {
    key: "MOBILE_DEEP_LINK",
    title: "QR / deeplink mobile",
    subtitle: "Tao link de mo tren dien thoai. Nguoi dung co the bam link hoac quet ma tu thiet bi dang login san.",
    icon: Smartphone,
    eyebrow: "Mobile",
  },
  {
    key: "BROWSER_EXTENSION",
    title: "Browser extension",
    subtitle: "Dung cho Chrome / Edge tren trinh duyet dang mo kenh social / chat. Hien luong sync danh sach chat that dang uu tien Messenger Web; cac kenh khac chu yeu la claim thiet bi / mo dung tab dang login san.",
    icon: Puzzle,
    eyebrow: "Extension",
  },
] as const;

const channelGuides: Record<string, ChannelGuide> = {
  multi: {
    loginTitle: "Dang nhap o kenh that, khong dang nhap trong CRM",
    loginDescription:
      "Phan nay khong co o user/pass de dang nhap truc tiep trong CRM. Ban can dang nhap tai khoan that o Zalo, WeChat, WhatsApp, Messenger, Telegram, Viber, LINE, KakaoTalk, Signal hoac Discord truoc, roi quay lai day de lien ket thiet bi.",
    oauthHint:
      "Neu kenh mo popup xac nhan quyen, do la buoc dung. Cu tiep tuc dang nhap / cap quyen tren popup do roi quay lai link center.",
    launchLinks: [
      { label: "Mo Zalo", url: "https://oa.zalo.me/manage/dashboard" },
      { label: "Mo Messenger", url: "https://www.messenger.com/" },
      { label: "Mo WhatsApp Web", url: "https://web.whatsapp.com/" },
      { label: "Mo Telegram Web", url: "https://web.telegram.org/" },
    ],
  },
  zalo: {
    loginTitle: "Dang nhap o Zalo thuong hoac Zalo OA",
    loginDescription:
      "Hay mo Zalo thuong hoac Zalo OA tren dung may / dien thoai dang su dung va dang nhap tai khoan that truoc khi lien ket.",
    oauthHint:
      "Neu ban dung Zalo thuong thi dang nhap o chat.zalo.me. Neu ban dung OA thi dang nhap o trang quan tri OA, roi quay lai day tao session va claim thiet bi.",
    launchLinks: [
      { label: "Mo Zalo thuong", url: "https://chat.zalo.me/" },
      { label: "Mo Zalo OA", url: "https://oa.zalo.me/manage/dashboard" },
    ],
  },
  wechat: {
    loginTitle: "Dang nhap o WeChat / Official Account",
    loginDescription:
      "Hay mo WeChat Web hoac cong quan tri Official Account tren dung may can lien ket, sau do dang nhap tai khoan that.",
    oauthHint:
      "Neu kenh nay yeu cau quet QR, hay quet bang thiet bi da dang nhap san roi quay lai de claim session.",
    launchLinks: [
      { label: "Mo WeChat Web", url: "https://web.wechat.com/" },
      { label: "Mo WeChat Official Account", url: "https://mp.weixin.qq.com/" },
    ],
  },
  whatsapp: {
    loginTitle: "Dang nhap o WhatsApp / WhatsApp Web",
    loginDescription:
      "Neu dung may tinh thi mo WhatsApp Web va quet QR bang dien thoai da dang nhap san. Neu dung mobile thi mo link claim tren chinh dien thoai do.",
    oauthHint:
      "WhatsApp Web khong dang nhap trong CRM. Ban dang nhap o web.whatsapp.com, sau do moi lien ket bridge hoac extension.",
    launchLinks: [
      { label: "Mo WhatsApp Web", url: "https://web.whatsapp.com/" },
      { label: "Mo WhatsApp", url: "https://www.whatsapp.com/" },
    ],
  },
  messenger: {
    loginTitle: "Dang nhap bang tai khoan Messenger",
    loginDescription:
      "Hay dang nhap Messenger tren dung trinh duyet / thiet bi ma ban muon lien ket. Nut Mo Messenger chi de mo tab Messenger that; chi khi extension claim duoc thiet bi va sync sidebar thi CRM moi gan vao tai khoan Messenger dang mo cua ban.",
    oauthHint:
      "Neu hien popup xac nhan Meta, do la buoc binh thuong de tiep tuc dang nhap va cap quyen.",
    launchLinks: [
      { label: "Mo Messenger", url: "https://www.messenger.com/" },
      { label: "Mo Meta Business", url: "https://business.facebook.com/" },
    ],
  },
  telegram: {
    loginTitle: "Dang nhap o Telegram / Telegram Web",
    loginDescription:
      "Mo Telegram Web hoac app Telegram tren dung may / dien thoai dang su dung, dang nhap tai khoan that roi quay lai de lien ket.",
    oauthHint:
      "Neu Telegram yeu cau nhap ma xac minh, hay hoan thanh buoc do tren kenh that truoc khi bam tao session.",
    launchLinks: [
      { label: "Mo Telegram Web", url: "https://web.telegram.org/" },
      { label: "Mo Telegram", url: "https://telegram.org/" },
    ],
  },
  viber: {
    loginTitle: "Dang nhap o Viber",
    loginDescription:
      "Mo Viber tren dung thiet bi dang su dung. Neu site van hanh bang desktop, hay mo cong cu / app Viber dang duoc team su dung truoc khi lien ket.",
    oauthHint:
      "Viber co the khong co luong web giong cac kenh khac, vi vay uu tien lien ket tren dung thiet bi dang login san.",
    launchLinks: [
      { label: "Mo Viber", url: "https://www.viber.com/" },
    ],
  },
  line: {
    loginTitle: "Dang nhap o LINE / LINE Official Account",
    loginDescription:
      "Mo LINE OA Manager hoac app LINE tren dung may / dien thoai dang su dung va dang nhap tai khoan that truoc khi lien ket.",
    oauthHint:
      "Voi LINE OA, dang nhap xong tren trang manager hoac app roi quay lai day tao session va claim thiet bi.",
    launchLinks: [
      { label: "Mo LINE OA Manager", url: "https://manager.line.biz/" },
      { label: "Mo LINE", url: "https://line.me/" },
    ],
  },
  kakaotalk: {
    loginTitle: "Dang nhap o KakaoTalk / Kakao Business",
    loginDescription:
      "Mo KakaoTalk Business hoac cong quan tri dang duoc team su dung, dang nhap tai khoan that truoc khi lien ket.",
    oauthHint:
      "Neu site dang van hanh KakaoTalk tren mot may co dinh, hay tao session ngay tren may do de luu dung boi canh dang nhap.",
    launchLinks: [
      { label: "Mo KakaoTalk Business", url: "https://center-pf.kakao.com/" },
      { label: "Mo Kakao Business", url: "https://business.kakao.com/" },
    ],
  },
  signal: {
    loginTitle: "Dang nhap o Signal",
    loginDescription:
      "Signal thuong duoc van hanh qua app desktop / mobile. Hay mo dung app dang login san tren thiet bi can lien ket.",
    oauthHint:
      "Voi Signal, uu tien dang nhap va xac minh xong trong app truoc, sau do moi quay lai tao session lien ket.",
    launchLinks: [
      { label: "Mo Signal", url: "https://signal.org/download/" },
    ],
  },
  discord: {
    loginTitle: "Dang nhap o Discord",
    loginDescription:
      "Mo Discord app hoac Discord web tren dung may / trinh duyet dang van hanh kenh, dang nhap tai khoan that roi quay lai link center.",
    oauthHint:
      "Neu team su dung Discord server / channel cho CSKH, hay dang nhap dung workspace truoc khi claim session.",
    launchLinks: [
      { label: "Mo Discord", url: "https://discord.com/app" },
      { label: "Mo Discord Web", url: "https://discord.com/channels/@me" },
    ],
  },
};

const resolveChannelGuide = (value: unknown) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "zalo-oa" || normalized === "zalo-personal") {
    return channelGuides.zalo;
  }
  if (normalized === "facebook-messenger") {
    return channelGuides.messenger;
  }

  return channelGuides[normalized] || channelGuides.multi;
};

const methodRunbooks: Record<MethodKey, { title: string; steps: string[] }> = {
  DESKTOP_BRIDGE: {
    title: "Cach chay PC bridge",
    steps: [
      "Dang nhap tai khoan that tren dung may tinh can lien ket.",
      "Tao phien lien ket, roi copy lenh 'Lenh bridge local' o ben duoi.",
      "Mo PowerShell / CMD tren may do, dan lenh va Enter. Khi thay 'Lien ket desktop thanh cong' la xong.",
    ],
  },
  MOBILE_DEEP_LINK: {
    title: "Cach chay mobile / QR",
    steps: [
      "Dang nhap kenh that tren dien thoai can lien ket.",
      "Tao phien lien ket, roi mo 'Universal link' tren chinh dien thoai do.",
      "Bam 'Lien ket thiet bi nay'. Trang thai session se chuyen sang CONNECTED.",
    ],
  },
  BROWSER_EXTENSION: {
    title: "Cach chay browser extension",
    steps: [
      "Mo CRM va kenh that tren cung Chrome / Edge, roi cai dung goi extension theo kenh dang dung.",
      "Bat Developer mode va Load unpacked mot lan. Sau khi cai xong, extension se tu nhan CRM dang mo va tu thu sync.",
      "Neu muon khach chi bam Cai, can phat hanh extension len Chrome Web Store / Edge Add-ons. Chi dung session token hoac pair code khi auto mode khong bat duoc.",
    ],
  },
};

type DownloadArtifact = {
  label: string;
  href: string;
  description: string;
};

const extensionPresetDownloads: Record<string, DownloadArtifact> = {
  messenger: {
    label: "Tai Extension Messenger",
    href: "/downloads/social-bridge/FitFlow-Messenger-Extension.zip",
    description: "Ban preset cho Messenger / Facebook Messages. Cai mot lan, sau do extension se tu thu lien ket va sync.",
  },
  whatsapp: {
    label: "Tai Extension WhatsApp",
    href: "/downloads/social-bridge/FitFlow-WhatsApp-Extension.zip",
    description: "Ban preset cho WhatsApp Web. Giam thao tac nhap tay provider khi lien ket.",
  },
  zalo: {
    label: "Tai Extension Zalo",
    href: "/downloads/social-bridge/FitFlow-Zalo-Extension.zip",
    description: "Ban preset cho Zalo. Phu hop khi team chi van hanh Zalo la chinh.",
  },
  generic: {
    label: "Tai Extension da kenh",
    href: "/downloads/social-bridge/FitFlow-Browser-Extension.zip",
    description: "Ban tong hop cho nhieu kenh. Dung khi mot may can lien ket nhieu tab social khac nhau.",
  },
};

const resolveDownloadArtifacts = (requestedChannelKey: string): DownloadArtifact[] => {
  const normalized = String(requestedChannelKey || "").trim().toLowerCase();
  const windowsArtifact = {
    label: "Tai Social Bridge cho Windows",
    href: "/downloads/social-bridge/FitFlow-SocialBridge-Windows.zip",
    description: "Bo day du co shortcut Cai Browser Extension, phu hop cho nguoi dung chi can bam va chay.",
  } satisfies DownloadArtifact;

  if (normalized === "messenger" || normalized === "facebook-messenger") {
    return [windowsArtifact, extensionPresetDownloads.messenger];
  }

  if (normalized === "whatsapp") {
    return [windowsArtifact, extensionPresetDownloads.whatsapp];
  }

  if (normalized === "zalo" || normalized === "zalo-oa" || normalized === "zalo-personal") {
    return [windowsArtifact, extensionPresetDownloads.zalo];
  }

  if (normalized !== "multi" && normalized) {
    return [windowsArtifact, extensionPresetDownloads.generic];
  }

  return [
    windowsArtifact,
    extensionPresetDownloads.messenger,
    extensionPresetDownloads.whatsapp,
    extensionPresetDownloads.zalo,
  ];
};

const preferredQuickLaunchOrder = [
  "Mo Zalo thuong",
  "Mo Zalo OA",
  "Mo WeChat Web",
  "Mo WhatsApp Web",
  "Mo Messenger",
  "Mo Telegram Web",
  "Mo Viber",
  "Mo LINE",
  "Mo Kakao Business",
  "Mo Discord",
];

const primaryQuickLaunchLabels = new Set([
  "Mo Zalo thuong",
  "Mo Zalo OA",
  "Mo Messenger",
  "Mo WhatsApp Web",
]);

const extractQuickLaunchHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return String(url || "").replace(/^https?:\/\//i, "");
  }
};

const quickLaunchTone = (label: string) => {
  const normalized = String(label || "").toLowerCase();
  if (normalized.includes("zalo oa")) {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  if (normalized.includes("zalo")) {
    return "border-sky-200 bg-sky-50 text-sky-950";
  }
  if (normalized.includes("messenger")) {
    return "border-indigo-200 bg-indigo-50 text-indigo-950";
  }
  if (normalized.includes("whatsapp")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-950";
  }
  if (normalized.includes("wechat")) {
    return "border-teal-200 bg-teal-50 text-teal-950";
  }
  if (normalized.includes("telegram")) {
    return "border-cyan-200 bg-cyan-50 text-cyan-950";
  }
  return "border-slate-200 bg-slate-50 text-slate-950";
};

const formatMethodLabel = (value: unknown) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "DESKTOP_BRIDGE") return "PC bridge";
  if (normalized === "MOBILE_DEEP_LINK") return "QR / deeplink mobile";
  if (normalized === "BROWSER_EXTENSION") return "Browser extension";
  return normalized || "-";
};

const formatDeviceTypeLabel = (value: unknown) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "DESKTOP") return "Desktop";
  if (normalized === "MOBILE") return "Mobile";
  if (normalized === "BROWSER_EXTENSION") return "Browser extension";
  return normalized || "-";
};

const copyText = async (value: string, successMessage: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(translateText(successMessage));
  } catch {
    toast.error(translateText("Khong copy duoc noi dung nay."));
  }
};

export function SocialLinkCenterWorkspace({ setting }: { setting: SettingDefinition }) {
  const { locale } = useLocale();
  const localizedSetting = useMemo(() => localizeSettingDefinition(setting), [locale, setting]);
  const queryClient = useQueryClient();
  const [requestedChannelKey, setRequestedChannelKey] = useState("multi");
  const [title, setTitle] = useState("");
  const [latestSession, setLatestSession] = useState<Record<string, unknown> | null>(null);

  const overviewQuery = useQuery({
    queryKey: ["social-linking-overview"],
    queryFn: async () => {
      const response = await api.get("/social/linking/overview");
      return (response.data || {}) as SocialLinkOverview;
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async (linkMethod: string) => {
      const response = await api.post("/social/linking/sessions", {
        linkMethod,
        requestedChannelKey,
        title: title.trim() || undefined,
      });
      return (response.data || {}) as Record<string, unknown>;
    },
    onSuccess: async (payload) => {
      setLatestSession(payload);
      await queryClient.invalidateQueries({ queryKey: ["social-linking-overview"] });
      toast.success(translateText("Da tao phien lien ket moi."));
    },
    onError: (error) => {
      const message =
        error && typeof error === "object" && "response" in error
          ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message || translateText("Khong tao duoc phien lien ket."))
          : translateText("Khong tao duoc phien lien ket.");
      toast.error(message);
    },
  });

  const revokeDeviceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/social/linking/devices/${id}/revoke`, {});
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["social-linking-overview"] });
      toast.success(translateText("Da thu hoi thiet bi lien ket."));
    },
    onError: (error) => {
      const message =
        error && typeof error === "object" && "response" in error
          ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message || translateText("Khong thu hoi duoc thiet bi."))
          : translateText("Khong thu hoi duoc thiet bi.");
      toast.error(message);
    },
  });

  const summary = overviewQuery.data?.summary || {};
  const devices = overviewQuery.data?.devices || [];
  const selectedGuide = resolveChannelGuide(requestedChannelKey);
  const quickLaunchLinks = useMemo(() => {
    const rawLinks =
      requestedChannelKey !== "multi"
        ? selectedGuide.launchLinks
        : socialLinkChannelOptions
            .filter((option) => option.value !== "multi")
            .flatMap((option) => {
              const guide = resolveChannelGuide(option.value);
              return guide.launchLinks.map((link) => ({
                label: link.label,
                url: link.url,
              }));
            });

    const dedupedLinks = rawLinks.filter(
      (item, index, list) =>
        list.findIndex(
          (candidate) =>
            candidate.label === item.label && candidate.url === item.url,
        ) === index,
    );
    const preferredLinks = dedupedLinks.filter((item) =>
      preferredQuickLaunchOrder.includes(item.label),
    );

    if (!preferredLinks.length) {
      return dedupedLinks;
    }

    return preferredQuickLaunchOrder
      .map((label) =>
        preferredLinks.find((item) => item.label === label) || null,
      )
      .filter(Boolean) as Array<{ label: string; url: string }>;
  }, [requestedChannelKey, selectedGuide]);
  const primaryQuickLaunchLinks = useMemo(() => {
    if (quickLaunchLinks.length <= 4) {
      return quickLaunchLinks;
    }

    const prioritized = quickLaunchLinks.filter((link) =>
      primaryQuickLaunchLabels.has(link.label),
    );
    return prioritized.length ? prioritized : quickLaunchLinks.slice(0, 4);
  }, [quickLaunchLinks]);
  const secondaryQuickLaunchLinks = useMemo(() => {
    const primaryUrls = new Set(primaryQuickLaunchLinks.map((link) => link.url));
    return quickLaunchLinks.filter((link) => !primaryUrls.has(link.url));
  }, [primaryQuickLaunchLinks, quickLaunchLinks]);

  if (overviewQuery.isLoading) {
    return <div className="card h-56 animate-pulse bg-slate-100" />;
  }

  if (overviewQuery.isError) {
    return <EmptyState title="Khong tai duoc trung tam lien ket" description="API link center dang gap loi hoac chua san sang." />;
  }

  const latestBridgeConfig = latestSession?.bridgeConfig ? JSON.stringify(latestSession.bridgeConfig, null, 2) : "";
  const latestExtensionBootstrap = latestSession?.extensionBootstrap ? JSON.stringify(latestSession.extensionBootstrap, null, 2) : "";
  const latestMobilePayload = latestSession?.mobilePayload ? JSON.stringify(latestSession.mobilePayload, null, 2) : "";
  const latestSessionToken = String(latestSession?.sessionToken || "").trim();
  const activeRunbook = methodRunbooks[String(latestSession?.linkMethod || "DESKTOP_BRIDGE") as MethodKey] || methodRunbooks.DESKTOP_BRIDGE;

  return (
    <div className="settings-workspace space-y-4">
      <PageHeader
        title={localizedSetting.title}
        subtitle={localizedSetting.subtitle}
        actions={
          <button className="secondary-button" onClick={() => void overviewQuery.refetch()} type="button">
            <RefreshCw className={`h-4 w-4 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />
            {translateText("Cap nhat")}
          </button>
        }
      />

      <div className="space-y-4">
        <section className="card space-y-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{translateText("Bat dau tu dau")}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{translateText(selectedGuide.loginTitle)}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{translateText(selectedGuide.loginDescription)}</p>
          </div>

          <div className="rounded-[1rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
            <div className="font-semibold">{translateText("Day la man lien ket, khong phai man chat")}</div>
            <div className="mt-1">
              {translateText("Dang nhap / uy quyen cua kenh van xay ra tren app hoac web cua chinh kenh. Sau khi lien ket xong, thao tac chat hang ngay se nam trong Trung tam hoi thoai cua phan mem.")}
            </div>
            <div className="mt-3">
              <Link className="primary-button inline-flex" href={socialInboxPath} scroll={false}>
                <Link2 className="h-4 w-4" />
                {translateText("Mo Trung tam hoi thoai")}
              </Link>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{translateText("Buoc 1")}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{translateText("Chon kenh va mo noi dang nhap")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{translateText("Chon kenh uu tien ben duoi, roi bam mo nhanh trong danh sach lien ket neu can.")}</p>
            </div>
            <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{translateText("Buoc 2")}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{translateText("Dang nhap tai khoan that")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{translateText("Dang nhap o tab / app cua kenh. CRM khong hien user/pass cua Zalo, WeChat, WhatsApp, Messenger, Telegram, Viber, LINE, KakaoTalk, Signal hay Discord ben trong man hinh nay.")}</p>
            </div>
            <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{translateText("Buoc 3")}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{translateText("Quay lai day de lien ket")}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{translateText("Sau khi kenh da dang nhap xong, tao session PC bridge, mobile hoac extension de CRM gan voi thiet bi do.")}</p>
            </div>
          </div>

          <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            <span className="font-semibold">{translateText("Luu y")}: </span>
            {translateText(selectedGuide.oauthHint)}
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{translateText("Noi dang nhap goi y")}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{translateText("Mo kenh de dang nhap / uy quyen truoc khi lien ket")}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {translateText("Cac kenh duoc sap lai theo muc do hay dung. Nhom chinh nam tren cung de bam nhanh, nhom con lai nam ben duoi de de tim hon.")}
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_320px]">
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{translateText("Kenh chinh")}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {primaryQuickLaunchLinks.map((link) => (
                    <a
                      className={`group flex min-h-[86px] items-start justify-between rounded-[1rem] border px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${quickLaunchTone(link.label)}`}
                      href={link.url}
                      key={link.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <div>
                        <div className="text-sm font-semibold">{translateText(link.label)}</div>
                        <div className="mt-1 text-xs text-slate-500">{extractQuickLaunchHost(link.url)}</div>
                        <div className="mt-3 inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                          {translateText("Mo tab dang nhap")}
                        </div>
                      </div>
                      <div className="rounded-full bg-white/80 p-2 text-slate-600 transition group-hover:text-slate-900">
                        <Link2 className="h-4 w-4" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {secondaryQuickLaunchLinks.length ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{translateText("Kenh khac")}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {secondaryQuickLaunchLinks.map((link) => (
                      <a
                        className="group flex items-center justify-between rounded-[0.95rem] border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                        href={link.url}
                        key={link.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-900">{translateText(link.label)}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{extractQuickLaunchHost(link.url)}</div>
                        </div>
                        <Link2 className="h-4 w-4 text-slate-400 transition group-hover:text-emerald-700" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-[1rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(241,245,249,0.85),rgba(255,255,255,1))] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{translateText("Meo dung nhanh")}</p>
              <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                <div className="rounded-2xl border border-white bg-white/90 px-3 py-3">
                  <div className="font-semibold text-slate-900">{translateText("1. Mo kenh that truoc")}</div>
                  <div className="mt-1">{translateText("Bam mo dung tab Zalo, Messenger, WhatsApp... roi dang nhap tren chinh kenh do.")}</div>
                </div>
                <div className="rounded-2xl border border-white bg-white/90 px-3 py-3">
                  <div className="font-semibold text-slate-900">{translateText("2. Quay lai tao phien")}</div>
                  <div className="mt-1">{translateText("Sau khi dang nhap xong, moi tao phien PC bridge, mobile hoac extension de CRM gan voi thiet bi.")}</div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-amber-900">
                  <div className="font-semibold">{translateText("Luu y")}</div>
                  <div className="mt-1">{translateText("Neu can phan biet, Zalo thuong va Zalo OA da duoc tach rieng thanh 2 nut khac nhau.")}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Tenant")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{String(overviewQuery.data?.tenantKey || "MASTER")}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Phien cho lien ket")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{Number(summary.pendingSessions || 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Thiet bi dang hoat dong")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{Number(summary.activeDevices || 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Desktop / Mobile / Ext")}</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {Number(summary.desktopDevices || 0)} / {Number(summary.mobileDevices || 0)} / {Number(summary.extensionDevices || 0)}
          </p>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <label className="field">
            <span>{translateText("Kenh uu tien")}</span>
            <select onChange={(event) => setRequestedChannelKey(event.target.value)} value={requestedChannelKey}>
              {socialLinkChannelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {translateText(option.label)}
                </option>
              ))}
            </select>
            <small className="!text-slate-500">{translateText("Chon kenh chinh de phien lien ket goi y dung cho Zalo, WeChat, WhatsApp, Messenger, Telegram, Viber, LINE, KakaoTalk, Signal hoac Discord.")}</small>
          </label>

          <label className="field">
            <span>{translateText("Nhan phien (tuy chon)")}</span>
            <input onChange={(event) => setTitle(event.target.value)} placeholder={translateText("VD: Laptop le tan - Zalo")} type="text" value={title} />
            <small className="!text-slate-500">{translateText("De trong cung duoc. Neu co nhan thi de doi chieu phien dang tao de link thiet bi.")}</small>
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {methodConfigs.map((item) => {
            const Icon = item.icon;
            return (
              <div className="rounded-[1.1rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(255,255,255,0.98))] p-4" key={item.key}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{translateText(item.eyebrow)}</p>
                    <h2 className="mt-1 text-base font-semibold text-slate-900">{translateText(item.title)}</h2>
                  </div>
                  <div className="rounded-2xl bg-white/90 p-2 text-emerald-700 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{translateText(item.subtitle)}</p>
                <button
                  className="primary-button mt-4"
                  disabled={createSessionMutation.isPending}
                  onClick={() => void createSessionMutation.mutateAsync(item.key)}
                  type="button"
                >
                  <Link2 className="h-4 w-4" />
                  {translateText("Tao phien lien ket")}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {latestSession ? (
        <div className="card space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{translateText("Phien moi tao")}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                {String(latestSession.title || formatMethodLabel(latestSession.linkMethod))}
              </h2>
            </div>
            <StatusBadge value={String(latestSession.linkMethod || "")} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Pair code")}</p>
              <p className="mt-2 font-mono text-lg font-semibold text-slate-900">{String(latestSession.pairCode || "-")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Kenh uu tien")}</p>
              <p className="mt-2 font-semibold text-slate-900">{getSocialRequestedChannelLabel(latestSession.requestedChannelKey)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{translateText("Het han")}</p>
              <p className="mt-2 font-semibold text-slate-900">{latestSession.expiresAt ? formatDateTime(String(latestSession.expiresAt)) : "-"}</p>
            </div>
          </div>

          {latestSessionToken ? (
            <div className="rounded-[1rem] border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">{translateText("Session token")}</h3>
                <button
                  className="secondary-button"
                  onClick={() => void copyText(latestSessionToken, "Da copy session token.")}
                  type="button"
                >
                  <Copy className="h-4 w-4" />
                  {translateText("Copy")}
                </button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-[12px] leading-6 text-slate-100">{latestSessionToken}</pre>
              <p className="mt-2 text-xs leading-6 text-slate-500">{translateText("Chi dung khi can nhap tay. Neu CRM dang mo trong cung trinh duyet, browser extension se tu lay session nay.")}</p>
            </div>
          ) : null}

          <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{translateText("Tiep theo lam gi")}</p>
            <h3 className="mt-1 text-base font-semibold text-emerald-950">{translateText(activeRunbook.title)}</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {activeRunbook.steps.map((step, index) => (
                <div className="rounded-2xl border border-emerald-200 bg-white/80 px-3 py-3 text-sm leading-6 text-slate-700" key={`${String(latestSession.id || "latest")}-step-${index}`}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{translateText(`Buoc ${index + 1}`)}</span>
                  <p className="mt-2">{translateText(step)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[1rem] border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">{translateText("Universal link")}</h3>
                <div className="flex flex-wrap gap-2">
                  <a
                    className="secondary-button"
                    href={String(latestSession.universalLinkUrl || "#")}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Link2 className="h-4 w-4" />
                    {translateText("Mo link")}
                  </a>
                  <button
                    className="secondary-button"
                    onClick={() => void copyText(String(latestSession.universalLinkUrl || ""), "Da copy universal link.")}
                    type="button"
                  >
                    <Copy className="h-4 w-4" />
                    {translateText("Copy")}
                  </button>
                </div>
              </div>
              <p className="mt-3 break-all rounded-2xl bg-slate-50 px-3 py-3 text-[12px] leading-6 text-slate-700">
                {String(latestSession.universalLinkUrl || "-")}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-500">{translateText("Mo link nay tren dung dien thoai / trinh duyet da dang nhap kenh that de claim session.")}</p>
            </div>

            <div className="rounded-[1rem] border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">{translateText("App deeplink")}</h3>
                <button
                  className="secondary-button"
                  onClick={() => void copyText(String(latestSession.deepLinkUrl || ""), "Da copy app deeplink.")}
                  type="button"
                >
                  <Copy className="h-4 w-4" />
                  {translateText("Copy")}
                </button>
              </div>
              <p className="mt-3 break-all rounded-2xl bg-slate-50 px-3 py-3 text-[12px] leading-6 text-slate-700">
                {String(latestSession.deepLinkUrl || "-")}
              </p>
            </div>
          </div>

          {String(latestSession.bridgeCommand || "").trim() ? (
            <div className="rounded-[1rem] border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">{translateText("Lenh bridge local")}</h3>
                <button
                  className="secondary-button"
                  onClick={() => void copyText(String(latestSession.bridgeCommand || ""), "Da copy lenh Social Bridge.")}
                  type="button"
                >
                  <Copy className="h-4 w-4" />
                  {translateText("Copy")}
                </button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-[12px] leading-6 text-slate-100">{String(latestSession.bridgeCommand || "")}</pre>
            </div>
          ) : null}

          {latestBridgeConfig ? (
            <div className="rounded-[1rem] border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">{translateText("Bridge config JSON")}</h3>
                <button className="secondary-button" onClick={() => void copyText(latestBridgeConfig, "Da copy bridge config JSON.")} type="button">
                  <Copy className="h-4 w-4" />
                  {translateText("Copy")}
                </button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-[12px] leading-6 text-slate-100">{latestBridgeConfig}</pre>
            </div>
          ) : null}

          {latestExtensionBootstrap ? (
            <div className="rounded-[1rem] border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">{translateText("Extension bootstrap JSON")}</h3>
                <button className="secondary-button" onClick={() => void copyText(latestExtensionBootstrap, "Da copy extension bootstrap JSON.")} type="button">
                  <Copy className="h-4 w-4" />
                  {translateText("Copy")}
                </button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-[12px] leading-6 text-slate-100">{latestExtensionBootstrap}</pre>
            </div>
          ) : null}

          {latestMobilePayload ? (
            <div className="rounded-[1rem] border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">{translateText("Mobile payload JSON")}</h3>
                <button className="secondary-button" onClick={() => void copyText(latestMobilePayload, "Da copy mobile payload JSON.")} type="button">
                  <Copy className="h-4 w-4" />
                  {translateText("Copy")}
                </button>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-[12px] leading-6 text-slate-100">{latestMobilePayload}</pre>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <section className="card space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{translateText("Thiet bi da lien ket")}</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{translateText("Danh sach bridge / mobile / extension")}</h2>
            </div>
            <StatusBadge value="CONNECTED" />
          </div>

          {devices.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {devices.map((device) => (
                <div className="h-full rounded-[1rem] border border-slate-200 bg-white p-4" key={String(device.id || Math.random())}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{String(device.deviceName || "-")}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDeviceTypeLabel(device.deviceType)} | {String(device.platform || "-")} | {String(device.deviceCode || "-")}
                      </div>
                      {String(device.linkedByName || "").trim() ? (
                        <div className="mt-1 text-xs font-medium text-slate-500">
                          {String(device.linkedByName || "-")}
                        </div>
                      ) : null}
                    </div>
                    <StatusBadge value={String(device.status || "")} />
                  </div>

                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>{translateText("Kenh uu tien")}</span>
                      <span className="font-medium text-slate-900">{getSocialRequestedChannelLabel(device.requestedChannelKey)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{translateText("Dang nhap o dau")}</span>
                      <span className="max-w-[60%] truncate text-right font-medium text-slate-900">
                        {translateText(resolveChannelGuide(device.requestedChannelKey || "multi").loginTitle)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{translateText("Tai khoan / profile")}</span>
                      <span className="max-w-[60%] truncate text-right font-medium text-slate-900">{String(device.accountHint || device.providerHints || "-")}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>{translateText("Lan cuoi online")}</span>
                      <span className="font-medium text-slate-900">{device.lastSeenAt ? formatDateTime(String(device.lastSeenAt)) : "-"}</span>
                    </div>
                  </div>

                  <button
                    className="secondary-button mt-4 text-rose-700"
                    disabled={revokeDeviceMutation.isPending}
                    onClick={() => void revokeDeviceMutation.mutateAsync(String(device.id || ""))}
                    type="button"
                  >
                    <ShieldOff className="h-4 w-4" />
                    {translateText("Thu hoi")}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Chua co thiet bi nao" description="Sau khi claim session tu PC bridge, mobile hoac extension, danh sach thiet bi se hien o day." />
          )}
        </section>
      </div>
    </div>
  );
}
