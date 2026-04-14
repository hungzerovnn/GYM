"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, CircleAlert, Clock3, Link2, Phone, RefreshCw, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { SearchBar } from "@/components/table/search-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { api } from "@/lib/api";
import { cn, formatDateTime, formatNumber } from "@/lib/format";
import { translateText } from "@/lib/i18n/display";
import { localizeReportDefinition } from "@/lib/i18n/portal";
import { useLocale } from "@/lib/i18n/provider";
import { ReportDefinition } from "@/types/portal";

type SocialInboxSummary = {
  totalConversations: number;
  unreadConversations: number;
  overdueConversations: number;
  breachedSla: number;
  activeChannels: number;
};

type SocialInboxProvider = {
  key: string;
  label: string;
  channelType: string;
  isActive: boolean;
  isLiveConnected: boolean;
  teamInboxEnabled: boolean;
  activeDeviceCount: number;
  recentConversationCount: number;
  unreadConversationCount: number;
  replyMode: string;
  canReply: boolean;
  settingKeys: string[];
  hint: string;
};

type SocialInboxAssignee = {
  id: string;
  fullName: string;
  branchId?: string | null;
};

type SocialInboxMessage = {
  id: string;
  direction: string;
  messageType: string;
  senderName: string;
  recipientName: string;
  content: string;
  attachmentUrl: string;
  attachmentType: string;
  status: string;
  sentAt: string;
};

type SocialInboxConversation = {
  id: string;
  provider: string;
  providerCode: string;
  providerLabel: string;
  providerChannelType: string;
  providerReplyMode: string;
  providerHint: string;
  activeDeviceCount: number;
  canReply: boolean;
  idLabel: string;
  title: string;
  avatarUrl: string;
  phone: string;
  branchId?: string | null;
  branchName: string;
  assignedToId: string;
  assignedToName: string;
  status: string;
  queueStatus: string;
  slaStatus: string;
  unreadCount: number;
  messageCount: number;
  latestMessagePreview: string;
  latestMessageAt: string;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
  lastSyncedAt?: string | null;
  waitingMinutes: number;
  sourceLabel: string;
  sourceType: string;
  externalAccountId: string;
  externalContactId: string;
  leadId: string;
  leadCode: string;
  leadName: string;
  leadStatus: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  customerStatus: string;
  responseMinutes: number;
};

type SocialInboxPayload = {
  summary: SocialInboxSummary;
  providers: SocialInboxProvider[];
  assignees: SocialInboxAssignee[];
  queueOptions: Array<{ value: string; label: string }>;
  selectedConversationId: string | null;
  conversations: SocialInboxConversation[];
  selectedConversation: (SocialInboxConversation & {
    metadata: Record<string, unknown>;
    latestWebhook: null | { status: string; receivedAt: string; errorMessage: string };
    actions: {
      canAssign: boolean;
      canMarkRead: boolean;
      canReply: boolean;
      replyMode: string;
      replyHint: string;
    };
    messages: SocialInboxMessage[];
  }) | null;
};

const providerSettingHrefMap: Record<string, string> = {
  zalo: "/social/zalo-oa",
  wechat: "/social/wechat",
  whatsapp: "/social/whatsapp",
  messenger: "/social/messenger",
  telegram: "/social/telegram",
  viber: "/social/viber",
  line: "/social/line",
  kakaotalk: "/social/kakaotalk",
  signal: "/social/signal",
  discord: "/social/discord",
};

const toApiErrorMessage = (error: unknown, fallback: string) => {
  const maybeMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof maybeMessage === "string" && maybeMessage.trim() ? maybeMessage : fallback;
};

const isRetriableMessageStatus = (value: string) =>
  ["FAILED", "OUTBOX_ONLY", "QUEUED", "QUEUED_API", "QUEUED_BRIDGE"].includes(String(value || "").toUpperCase());

const summaryCards = (summary: SocialInboxSummary) => [
  { label: "Hoi thoai dang mo", value: formatNumber(summary.totalConversations) },
  { label: "Chua doc", value: formatNumber(summary.unreadConversations) },
  { label: "Qua han / vuot SLA", value: `${formatNumber(summary.overdueConversations)} / ${formatNumber(summary.breachedSla)}` },
  { label: "Kenh co du lieu", value: formatNumber(summary.activeChannels) },
];

export function SocialInboxWorkspace({ report }: { report: ReportDefinition }) {
  const { locale } = useLocale();
  const localizedReport = useMemo(() => localizeReportDefinition(report), [locale, report]);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [queueStatus, setQueueStatus] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState<string>("");
  const [replyDraft, setReplyDraft] = useState("");
  const deferredSearch = useDeferredValue(search);

  const overviewQuery = useQuery({
    queryKey: ["social-inbox-workspace", deferredSearch, provider, assignedToId, queueStatus, selectedConversationId],
    queryFn: async () => {
      const response = await api.get<SocialInboxPayload>("/social/inbox/overview", {
        params: {
          search: deferredSearch || undefined,
          provider: provider || undefined,
          assignedToId: assignedToId || undefined,
          queueStatus: queueStatus || undefined,
          conversationId: selectedConversationId || undefined,
        },
      });
      return response.data;
    },
  });

  useEffect(() => {
    const rows = overviewQuery.data?.conversations || [];
    if (!rows.length) {
      if (selectedConversationId) {
        setSelectedConversationId("");
      }
      return;
    }

    const preferred = String(overviewQuery.data?.selectedConversationId || "");
    const hasCurrent = rows.some((row) => row.id === selectedConversationId);
    if (!selectedConversationId || !hasCurrent) {
      setSelectedConversationId(preferred || rows[0].id);
    }
  }, [overviewQuery.data?.selectedConversationId, overviewQuery.data?.conversations, selectedConversationId]);

  const assignMutation = useMutation({
    mutationFn: async (nextAssignedToId: string) => {
      if (!selectedConversationId) {
        throw new Error("Chua chon hoi thoai");
      }

      return api.patch(`/social/inbox/conversations/${selectedConversationId}/assign`, nextAssignedToId ? { assignedToId: nextAssignedToId } : { clearAssignment: true });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["social-inbox-workspace"] });
      toast.success(translateText("Da cap nhat nguoi phu trach."));
    },
    onError: (error) => toast.error(toApiErrorMessage(error, translateText("Khong cap nhat duoc nguoi phu trach."))),
  });

  const readMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversationId) {
        throw new Error("Chua chon hoi thoai");
      }

      return api.post(`/social/inbox/conversations/${selectedConversationId}/read`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["social-inbox-workspace"] });
      toast.success(translateText("Da danh dau da doc."));
    },
    onError: (error) => toast.error(toApiErrorMessage(error, translateText("Khong danh dau da doc duoc."))),
  });

  const dispatchPendingMutation = useMutation({
    mutationFn: async () => api.post("/social/outbox/dispatch-pending"),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["social-inbox-workspace"] });
      const processed = Number(response.data?.processed || 0);
      const sent = Number(response.data?.sent || 0);
      const failed = Number(response.data?.failed || 0);
      const outboxOnly = Number(response.data?.outboxOnly || 0);
      toast.success(
        translateText(`Da dong bo outbox: ${formatNumber(sent)} sent, ${formatNumber(failed)} failed, ${formatNumber(outboxOnly)} outbox-only / ${formatNumber(processed)} ban ghi.`),
      );
    },
    onError: (error) => toast.error(toApiErrorMessage(error, translateText("Khong dong bo outbox duoc."))),
  });

  const retryMutation = useMutation({
    mutationFn: async (messageId: string) => api.post(`/social/outbox/messages/${messageId}/retry`),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["social-inbox-workspace"] });
      const status = String(response.data?.status || "");
      const warning = String(response.data?.warning || response.data?.errorMessage || "");

      if (status === "SENT") {
        toast.success(translateText("Da gui lai ra kenh that."));
        return;
      }

      if (warning) {
        toast.warning(warning);
        return;
      }

      toast.success(translateText("Da cap nhat lai trang thai outbox."));
    },
    onError: (error) => toast.error(toApiErrorMessage(error, translateText("Khong retry outbox duoc."))),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConversationId) {
        throw new Error("Chua chon hoi thoai");
      }

      return api.post(`/social/inbox/conversations/${selectedConversationId}/send`, {
        content: replyDraft,
      });
    },
    onSuccess: async (response) => {
      const warning = String(response.data?.warning || "");
      const status = String(response.data?.message?.status || "");
      setReplyDraft("");
      await queryClient.invalidateQueries({ queryKey: ["social-inbox-workspace"] });
      if (status === "SENT") {
        toast.success(translateText("Da gui phan hoi ra kenh that."));
        return;
      }

      if (warning) {
        toast.warning(warning);
        return;
      }

      if (status === "OUTBOX_ONLY") {
        toast.warning(translateText("Da luu vao outbox noi bo. Kenh nay chua dispatch duoc ngay."));
        return;
      }

      if (status === "FAILED") {
        toast.warning(translateText("Da luu outbox, nhung gui ra kenh that chua thanh cong."));
        return;
      }

      toast.success(translateText("Da ghi nhan phan hoi trong inbox noi bo."));
    },
    onError: (error) => toast.error(toApiErrorMessage(error, translateText("Khong gui duoc phan hoi."))),
  });

  const payload = overviewQuery.data;
  const selectedConversation = payload?.selectedConversation || null;
  const selectedProviderRuntime = payload?.providers.find((item) => item.key === provider) || null;
  if (overviewQuery.isLoading) {
    return <div className="card h-64 animate-pulse bg-slate-100" />;
  }

  if (overviewQuery.isError || !payload) {
    return (
      <EmptyState
        title="Khong tai duoc inbox noi bo"
        description="API social inbox dang gap loi hoac chua san sang."
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={localizedReport.title}
        subtitle={localizedReport.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[280px]">
              <SearchBar value={search} onChange={setSearch} placeholder="Tim theo ten khach, so dien thoai, ma hoi thoai..." />
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
              onClick={() => void overviewQuery.refetch()}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              {translateText("Tai lai")}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={dispatchPendingMutation.isPending}
              onClick={() => dispatchPendingMutation.mutate()}
              type="button"
            >
              <Send className="h-4 w-4" />
              {dispatchPendingMutation.isPending ? translateText("Dang dong bo outbox...") : translateText("Dong bo outbox")}
            </button>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards(payload.summary).map((item) => (
          <div key={item.label} className="card rounded-[1rem] border border-slate-200 bg-white/90 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{translateText(item.label)}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_320px]">
        <aside className="card overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white/95">
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(255,255,255,0.95))] p-4">
            <p className="text-sm font-semibold text-slate-900">{translateText("Hang doi hoi thoai")}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{translateText("Chon kenh, nguoi phu trach va muc uu tien de xu ly ngay trong chuong trinh.")}</p>
          </div>

          <div className="grid gap-2 border-b border-slate-200 p-4">
            <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" onChange={(event) => setProvider(event.target.value)} value={provider}>
              <option value="">{translateText("Tat ca kenh chat")}</option>
              {payload.providers.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" onChange={(event) => setAssignedToId(event.target.value)} value={assignedToId}>
              <option value="">{translateText("Tat ca nguoi phu trach")}</option>
              {payload.assignees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fullName}
                </option>
              ))}
            </select>
            <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" onChange={(event) => setQueueStatus(event.target.value)} value={queueStatus}>
              <option value="">{translateText("Tat ca muc uu tien")}</option>
              {payload.queueOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {translateText(item.label)}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-[72vh] space-y-2 overflow-y-auto p-3">
            {payload.conversations.length ? (
              payload.conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={cn(
                    "w-full rounded-[1rem] border px-3 py-3 text-left transition",
                    selectedConversationId === conversation.id
                      ? "border-emerald-300 bg-emerald-50/80 shadow-[0_10px_26px_rgba(16,185,129,0.14)]"
                      : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{conversation.title}</p>
                        {conversation.unreadCount ? (
                          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-700">{conversation.providerLabel}</p>
                    </div>
                    <p className="shrink-0 text-[11px] text-slate-400">{formatDateTime(conversation.latestMessageAt)}</p>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
                    {conversation.latestMessagePreview || translateText("Chua co noi dung xem truoc.")}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge value={conversation.queueStatus} />
                    <StatusBadge value={conversation.slaStatus} />
                    {conversation.assignedToName ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        <UserRound className="h-3 w-3" />
                        {conversation.assignedToName}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                title="Chua co hoi thoai"
                description={
                  selectedProviderRuntime?.replyMode === "DEMO_ONLY"
                    ? "Kenh nay hien moi co cau hinh demo / test. CRM dang an thread mau va chi mo danh sach chat sau khi lien ket tai khoan that."
                    : "Bo loc hien tai chua co hoi thoai social / chat phu hop."
                }
              />
            )}
          </div>
        </aside>

        <section className="card flex min-h-[72vh] flex-col overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white/95">
          {selectedConversation ? (
            <>
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.03),rgba(16,185,129,0.08))] px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{selectedConversation.providerLabel}</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{selectedConversation.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge value={selectedConversation.status} />
                      <StatusBadge value={selectedConversation.queueStatus} />
                      <StatusBadge value={selectedConversation.providerReplyMode} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!selectedConversation.actions.canMarkRead || readMutation.isPending}
                      onClick={() => readMutation.mutate()}
                      type="button"
                    >
                      <CheckCheck className="h-4 w-4" />
                      {translateText("Danh dau da doc")}
                    </button>
                  </div>
                </div>

                {selectedConversation.providerReplyMode === "DEMO_ONLY" ? (
                  <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900">
                    <p className="font-semibold">{translateText("Kenh nay dang o che do demo / test")}</p>
                    <p className="mt-1">
                      {translateText("Cau hinh hien tai chua phai tai khoan that cua ban. CRM se khong coi day la kenh da lien ket va se an cac thread mau cho den khi co token / thiet bi / session that.")}
                    </p>
                  </div>
                ) : selectedConversation.activeDeviceCount === 0 ? (
                  <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    <p className="font-semibold">{translateText("Kenh nay chua co lien ket that")}</p>
                    <p className="mt-1">
                      {translateText("Chua co thiet bi / phien active de dong bo danh sach chat live tu tai khoan that. Danh sach dang thay hien la hoi thoai da luu trong CRM, khong phai sidebar Messenger / Zalo thoi gian thuc cua ban.")}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(240,253,244,0.55))] px-4 py-5">
                {selectedConversation.messages.map((message) => {
                  const isOutbound = message.direction === "OUTBOUND";
                  return (
                    <div key={message.id} className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[78%] rounded-[1.1rem] border px-4 py-3 shadow-sm",
                          isOutbound
                            ? "border-emerald-200 bg-emerald-50 text-slate-800"
                            : "border-slate-200 bg-white text-slate-800",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-slate-700">
                            {message.senderName || (isOutbound ? translateText("Noi bo") : translateText("Khach"))}
                          </p>
                          <p className="text-[11px] text-slate-400">{formatDateTime(message.sentAt)}</p>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content || translateText("Tin nhan khong co text, xem thong tin dinh kem neu can.")}</p>
                        {message.attachmentUrl ? (
                          <a className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-emerald-700 hover:underline" href={message.attachmentUrl} rel="noreferrer" target="_blank">
                            <Link2 className="h-3.5 w-3.5" />
                            {message.attachmentType || translateText("Mo tep dinh kem")}
                          </a>
                        ) : null}
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-[11px] text-slate-400">{message.messageType}</span>
                          <div className="flex items-center gap-2">
                            {message.status ? <StatusBadge value={message.status} /> : null}
                            {isOutbound && isRetriableMessageStatus(message.status) ? (
                              <button
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={retryMutation.isPending}
                                onClick={() => retryMutation.mutate(message.id)}
                                type="button"
                              >
                                <RefreshCw className={cn("h-3.5 w-3.5", retryMutation.isPending ? "animate-spin" : "")} />
                                {translateText("Thu gui lai")}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-200 bg-white px-4 py-4">
                <p className="mb-2 text-xs leading-5 text-slate-500">{selectedConversation.actions.replyHint}</p>
                <textarea
                  className="min-h-[110px] w-full rounded-[1rem] border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400"
                  disabled={!selectedConversation.actions.canReply || sendMutation.isPending}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  placeholder={translateText("Nhap noi dung phan hoi ngay trong chuong trinh...")}
                  value={replyDraft}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-400">
                    {translateText("Nguoi dung van thao tac trong app. He thong se thu dispatch that ngay tren kenh uu tien, neu chua du dieu kien thi se giu lai outbox de retry.")}
                  </p>
                  <button
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={!selectedConversation.actions.canReply || !replyDraft.trim() || sendMutation.isPending}
                    onClick={() => sendMutation.mutate()}
                    type="button"
                  >
                    <Send className="h-4 w-4" />
                    {sendMutation.isPending ? translateText("Dang gui / dispatch...") : translateText("Gui phan hoi")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState title="Chon mot hoi thoai" description="Hoi thoai duoc chon se hien thread chat, thong tin lien he va khu vuc phan hoi ngay tai day." />
          )}
        </section>

        <aside className="space-y-4">
          {selectedConversation ? (
            <>
              <div className="card rounded-[1.2rem] border border-slate-200 bg-white/95 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{translateText("Thong tin hoi thoai")}</p>
                    <p className="mt-1 text-xs text-slate-500">{translateText("Nhin nhanh thong tin khach, kenh va doi tuong dang gan voi thread nay.")}</p>
                  </div>
                  <StatusBadge value={selectedConversation.slaStatus} />
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{translateText("Khach / lien he")}</span>
                    <span className="text-right font-medium text-slate-900">{selectedConversation.title}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{translateText("So dien thoai")}</span>
                    <span className="inline-flex items-center gap-1 text-right font-medium text-slate-900">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      {selectedConversation.phone || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{translateText("Ma hoi thoai")}</span>
                    <span className="text-right font-medium text-slate-900">{selectedConversation.idLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{translateText("Chi nhanh")}</span>
                    <span className="text-right font-medium text-slate-900">{selectedConversation.branchName || translateText("Toan he thong")}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{translateText("Cho phan hoi")}</span>
                    <span className="inline-flex items-center gap-1 text-right font-medium text-slate-900">
                      <Clock3 className="h-3.5 w-3.5 text-amber-600" />
                      {formatNumber(selectedConversation.waitingMinutes)} {translateText("phut")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="card rounded-[1.2rem] border border-slate-200 bg-white/95 p-4">
                <p className="text-sm font-semibold text-slate-900">{translateText("Nguoi phu trach va san sang kenh")}</p>
                <div className="mt-4 grid gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{translateText("Nguoi phu trach")}</label>
                    <select
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                      disabled={assignMutation.isPending}
                      onChange={(event) => assignMutation.mutate(event.target.value)}
                      value={selectedConversation.assignedToId}
                    >
                      <option value="">{translateText("Chua giao nguoi xu ly")}</option>
                      {payload.assignees.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{selectedConversation.providerLabel}</p>
                      <StatusBadge value={selectedConversation.providerReplyMode} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{selectedConversation.providerHint}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {translateText("Thiet bi active")}: {formatNumber(selectedConversation.activeDeviceCount)}
                      </span>
                      <Link className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline" href={providerSettingHrefMap[selectedConversation.provider] || "/social/hub"} scroll={false}>
                        <Link2 className="h-3.5 w-3.5" />
                        {translateText("Mo cau hinh kenh")}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card rounded-[1.2rem] border border-slate-200 bg-white/95 p-4">
                <p className="text-sm font-semibold text-slate-900">{translateText("Lien ket CRM va canh bao")}</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{translateText("Lead")}</span>
                    <span className="text-right font-medium text-slate-900">
                      {selectedConversation.leadName ? `${selectedConversation.leadCode || ""} ${selectedConversation.leadName}`.trim() : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{translateText("Hoi vien")}</span>
                    <span className="text-right font-medium text-slate-900">
                      {selectedConversation.customerName ? `${selectedConversation.customerCode || ""} ${selectedConversation.customerName}`.trim() : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{translateText("Phan hoi dau")}</span>
                    <span className="text-right font-medium text-slate-900">
                      {selectedConversation.responseMinutes ? `${formatNumber(selectedConversation.responseMinutes)} ${translateText("phut")}` : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">{translateText("Lan dong bo gan nhat")}</span>
                    <span className="text-right font-medium text-slate-900">
                      {selectedConversation.lastSyncedAt ? formatDateTime(selectedConversation.lastSyncedAt) : "-"}
                    </span>
                  </div>
                </div>

                {selectedConversation.latestWebhook?.errorMessage ? (
                  <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-3 py-3 text-xs leading-5 text-rose-800">
                    <div className="flex items-start gap-2">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">{translateText("Webhook / dong bo gan nhat co canh bao")}</p>
                        <p>{selectedConversation.latestWebhook.errorMessage}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState title="Thong tin hoi thoai" description="Khu vuc nay se hien thong tin khach, nguoi phu trach va tinh trang ket noi cua kenh da chon." />
          )}

          <div className="card rounded-[1.2rem] border border-slate-200 bg-white/95 p-4">
            <p className="text-sm font-semibold text-slate-900">{translateText("Tinh trang cac kenh uu tien")}</p>
            <div className="mt-4 space-y-2">
              {payload.providers.map((item) => (
                <div key={item.key} className="rounded-[1rem] border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{item.hint}</p>
                    </div>
                    <StatusBadge value={item.replyMode} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{translateText("Hoi thoai")}: {formatNumber(item.recentConversationCount)}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{translateText("Chua doc")}: {formatNumber(item.unreadConversationCount)}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{translateText("Thiet bi active")}: {formatNumber(item.activeDeviceCount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
}
