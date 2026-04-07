"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Search } from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { translateRoleList, translateText } from "@/lib/i18n/display";
import { useLicense } from "@/lib/license-context";
import { LanguageSwitcher } from "./language-switcher";
import { LicenseTopbarActions } from "../license/license-topbar-actions";

export function TopNavbar() {
  const { user, logout } = useAuth();
  const { licenseStatus } = useLicense();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const notificationsQuery = useQuery({
    queryKey: ["top-navbar-notifications"],
    queryFn: async () => {
      const response = await api.get<{
        data: Array<{
          id: string;
          title: string;
          content: string;
          type: string;
          isRead: boolean;
          actionUrl?: string;
          createdAt: string;
        }>;
        unread: number;
      }>("/dashboard/notifications", {
        params: { pageSize: 6 },
      });
      return response.data;
    },
    refetchInterval: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/dashboard/notifications/${id}/read`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["top-navbar-notifications"] });
    },
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const notifications = notificationsQuery.data?.data || [];
  const unread = notificationsQuery.data?.unread || 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[0.82rem] border border-slate-200 bg-white/95 px-3 py-1.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-[0.65rem] border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">
        <Search className="h-3 w-3 shrink-0" />
        <span className="truncate">{translateText("Search members, leads, contracts, receipts...")}</span>
      </div>

      {licenseStatus ? (
        <div className="hidden min-w-[320px] flex-[1.4] xl:block">
          <LicenseTopbarActions licenseStatus={licenseStatus} />
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <div className="relative" ref={panelRef}>
          <button className="secondary-button relative !rounded-[0.65rem] !px-2.5 !py-1.5" onClick={() => setOpen((current) => !current)} type="button">
            <Bell className="h-3.5 w-3.5" />
            {unread ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {unread}
              </span>
            ) : null}
          </button>

          {open ? (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[350px] rounded-[0.9rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">{translateText("Thong bao van hanh")}</p>
                  <h3 className="mt-1 text-[15px] font-semibold text-slate-900">{`${unread} ${translateText("muc chua doc")}`}</h3>
                </div>
                <Link className="text-[11px] font-medium text-emerald-700" href="/reports/follow-up" scroll={false}>
                  {translateText("Xem lich cham soc")}
                </Link>
              </div>

              <div className="mt-3 space-y-2">
                {notifications.length ? (
                  notifications.map((item) => (
                    <Link
                      className={cn(
                        "block rounded-[0.75rem] border px-3 py-2.5 transition",
                        item.isRead ? "border-slate-200 bg-slate-50 text-slate-600" : "border-emerald-200 bg-emerald-50/70 text-slate-700",
                      )}
                      href={item.actionUrl || "/dashboard"}
                      key={item.id}
                      onClick={() => {
                        setOpen(false);
                        if (!item.isRead) {
                          void markReadMutation.mutateAsync(item.id);
                        }
                      }}
                      scroll={false}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-slate-900">{item.title}</p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-600">{item.content}</p>
                        </div>
                        {!item.isRead ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" /> : null}
                      </div>
                      <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-slate-400">{formatDateTime(item.createdAt)}</p>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-[0.75rem] border border-slate-200 bg-slate-50 px-3 py-5 text-[11px] text-slate-500">{translateText("Chua co thong bao nao can xu ly.")}</div>
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="rounded-[0.65rem] border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-slate-700">
          <div className="font-bold leading-4 text-slate-900">{user?.fullName}</div>
          <div className="text-[10px] text-slate-500">{translateRoleList(user?.roleCodes || [], user?.roleNames)}</div>
        </div>
        <button className="secondary-button" onClick={() => void logout()} type="button">
          {translateText("Logout")}
        </button>
      </div>
    </div>
  );
}
