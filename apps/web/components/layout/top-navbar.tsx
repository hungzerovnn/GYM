"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isUpdatingLocalRuntime, setIsUpdatingLocalRuntime] = useState(false);
  const [brandLogoError, setBrandLogoError] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [quickSearchTarget, setQuickSearchTarget] = useState("customers");
  const panelRef = useRef<HTMLDivElement>(null);
  const quickSearchInputRef = useRef<HTMLInputElement>(null);
  const localUpdateIntervalRef = useRef<number | null>(null);
  const localUpdateStartTimeoutRef = useRef<number | null>(null);

  const brandingQuery = useQuery({
    queryKey: ["top-navbar-branding"],
    queryFn: async () => {
      const response = await api.get<{
        appName?: string;
        brandLabel?: string;
        brandDescription?: string;
        logoUrl?: string;
      }>("/auth/login-branding");
      return response.data;
    },
    staleTime: 5 * 60_000,
  });

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

  useEffect(() => {
    return () => {
      if (localUpdateIntervalRef.current !== null) {
        window.clearInterval(localUpdateIntervalRef.current);
      }
      if (localUpdateStartTimeoutRef.current !== null) {
        window.clearTimeout(localUpdateStartTimeoutRef.current);
      }
    };
  }, []);

  const notifications = notificationsQuery.data?.data || [];
  const unread = notificationsQuery.data?.unread || 0;
  const hasLicenseStatus = Boolean(licenseStatus);
  const canTriggerLocalUpdate = Boolean(user?.roleCodes.some((roleCode) => ["system_owner", "super_admin"].includes(roleCode)));
  const searchTargets = [
    {
      key: "customers",
      label: translateText("Hoi vien"),
      path: "/members/customers",
      permission: "customers.view",
      placeholder: translateText("Tim theo ten, SDT, ma hoi vien, email, ghi chu..."),
    },
    {
      key: "leads",
      label: translateText("Lead"),
      path: "/members/leads",
      permission: "leads.view",
      placeholder: translateText("Tim theo ten lead, SDT, email, sale phu trach..."),
    },
    {
      key: "contracts",
      label: translateText("Hop dong"),
      path: "/operations/contracts",
      permission: "contracts.view",
      placeholder: translateText("Tim theo ma HD, ten khach, ten goi, sale, PT..."),
    },
    {
      key: "receipts",
      label: translateText("Phieu thu"),
      path: "/cashbook/receipts",
      permission: "receipts.view",
      placeholder: translateText("Tim theo ma phieu, khach hang, hop dong, nguon thu..."),
    },
    {
      key: "expenses",
      label: translateText("Phieu chi"),
      path: "/cashbook/expenses",
      permission: "expenses.view",
      placeholder: translateText("Tim theo ma phieu chi, noi dung chi, nha cung cap..."),
    },
    {
      key: "service-packages",
      label: translateText("Goi dich vu"),
      path: "/operations/service-price-book",
      permission: "service-packages.view",
      placeholder: translateText("Tim theo ma goi, ten goi, nhom dich vu, loai goi..."),
    },
    {
      key: "products",
      label: translateText("San pham"),
      path: "/pro-shop/products",
      permission: "products.view",
      placeholder: translateText("Tim theo ma san pham, ten hang, nhom, thuong hieu..."),
    },
    {
      key: "sources",
      label: translateText("Nguon khach"),
      path: "/members/customer-sources",
      permission: "customer-sources.view",
      placeholder: translateText("Tim theo ten nguon, ma nguon, mo ta, kenh marketing..."),
    },
  ];
  const availableSearchTargets = searchTargets.filter((target) => !target.permission || user?.permissions.includes(target.permission));
  const matchedSearchTarget = availableSearchTargets.find((target) => pathname.startsWith(target.path)) || null;
  const matchedSearchTargetKey = matchedSearchTarget?.key || "";
  const availableSearchTargetKeys = availableSearchTargets.map((target) => target.key).join("|");
  const selectedSearchTarget = availableSearchTargets.find((target) => target.key === quickSearchTarget) || availableSearchTargets[0] || null;
  const currentSearchQuery = searchParams.get("q") || "";
  const resolveAssetUrl = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return "";
    if (/^https?:\/\//i.test(normalized)) return normalized;

    const apiBase = String(api.defaults.baseURL || "").replace(/\/api\/?$/, "");
    if (!apiBase) return normalized;
    return `${apiBase}${normalized.startsWith("/") ? normalized : `/${normalized}`}`;
  };
  const branding = useMemo(
    () => ({
      appName: String(brandingQuery.data?.appName || "FitFlow Enterprise").trim() || "FitFlow Enterprise",
      brandLabel: String(brandingQuery.data?.brandLabel || "FITNESS ERP").trim() || "FITNESS ERP",
      logoUrl: resolveAssetUrl(String(brandingQuery.data?.logoUrl || "")),
    }),
    [brandingQuery.data],
  );
  const hasBrandImage = Boolean(branding.logoUrl && !brandLogoError);

  useEffect(() => {
    setBrandLogoError(false);
  }, [branding.logoUrl]);

  useEffect(() => {
    if (matchedSearchTargetKey) {
      setQuickSearchTarget(matchedSearchTargetKey);
      return;
    }

    setQuickSearchTarget((current) =>
      availableSearchTargets.some((target) => target.key === current) ? current : (availableSearchTargets[0]?.key || current),
    );
  }, [availableSearchTargetKeys, matchedSearchTargetKey, pathname]);

  useEffect(() => {
    if (matchedSearchTargetKey) {
      setQuickSearch(currentSearchQuery);
      return;
    }

    setQuickSearch("");
  }, [currentSearchQuery, matchedSearchTargetKey, pathname]);

  const clearLocalUpdatePolling = () => {
    if (localUpdateIntervalRef.current !== null) {
      window.clearInterval(localUpdateIntervalRef.current);
      localUpdateIntervalRef.current = null;
    }

    if (localUpdateStartTimeoutRef.current !== null) {
      window.clearTimeout(localUpdateStartTimeoutRef.current);
      localUpdateStartTimeoutRef.current = null;
    }
  };

  const isLocalRuntimeReady = async () => {
    const webReady = await fetch(window.location.origin, {
      method: "HEAD",
      cache: "no-store",
    })
      .then((response) => response.ok)
      .catch(() => false);

    const apiBaseUrl = String(api.defaults.baseURL || "").replace(/\/+$/, "");
    const apiReady = apiBaseUrl
      ? await fetch(`${apiBaseUrl}/health`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        })
          .then((response) => response.ok)
          .catch(() => false)
      : false;

    return webReady && apiReady;
  };

  const beginLocalUpdatePolling = () => {
    clearLocalUpdatePolling();
    localUpdateStartTimeoutRef.current = window.setTimeout(() => {
      localUpdateIntervalRef.current = window.setInterval(async () => {
        const ready = await isLocalRuntimeReady();
        if (!ready) {
          return;
        }

        clearLocalUpdatePolling();
        window.location.reload();
      }, 5000);
    }, 8000);
  };

  const handleLocalUpdate = async () => {
    if (isUpdatingLocalRuntime) {
      return;
    }

    const confirmed = window.confirm(
      translateText("Lenh nay se rebuild va khoi dong lai local runtime tren may nay. Giao dien co the mat ket noi tam thoi trong luc cap nhat. Tiep tuc?"),
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsUpdatingLocalRuntime(true);
      await api.post("/system/local-update");
      toast.success(translateText("Da len lich update local. He thong se tu reload sau khi Web/API san sang."));
      beginLocalUpdatePolling();
    } catch (error) {
      setIsUpdatingLocalRuntime(false);
      clearLocalUpdatePolling();
      const message =
        error && typeof error === "object" && "response" in error
          ? String((error as { response?: { data?: { message?: string } } }).response?.data?.message || translateText("Khong bat dau duoc local update."))
          : translateText("Khong bat dau duoc local update.");
      toast.error(message);
    }
  };

  const handleQuickSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedSearchTarget) {
      return;
    }

    const normalized = quickSearch.trim();
    if (!normalized) {
      router.push(selectedSearchTarget.path);
      return;
    }

    const nextSearchParams = new URLSearchParams();
    nextSearchParams.set("q", normalized);
    router.push(`${selectedSearchTarget.path}?${nextSearchParams.toString()}`);
  };

  const handleQuickSearchClear = () => {
    setQuickSearch("");

    if (matchedSearchTargetKey && selectedSearchTarget) {
      router.push(selectedSearchTarget.path);
      return;
    }

    window.requestAnimationFrame(() => {
      quickSearchInputRef.current?.focus();
    });
  };

  return (
    <div
      className={cn(
        "grid items-start gap-3 rounded-[0.82rem] border border-slate-200 bg-white/95 px-3 py-2 shadow-[0_4px_14px_rgba(15,23,42,0.04)] backdrop-blur-sm",
        hasLicenseStatus
          ? "xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(300px,400px)_minmax(420px,1.15fr)_minmax(360px,0.95fr)]"
          : "xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]",
      )}
    >
      <div className="min-w-0 rounded-[0.72rem] border border-slate-200 bg-slate-50/75 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {hasBrandImage ? (
            <img
              alt={branding.appName}
              className="block max-h-[3.8rem] w-auto max-w-[11rem] shrink-0 object-contain object-left"
              onError={() => setBrandLogoError(true)}
              src={branding.logoUrl}
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">{branding.brandLabel}</p>
            <p className="mt-1 truncate text-[15px] font-semibold text-slate-900">{branding.appName}</p>
          </div>
        </div>

        <form className="mt-3 flex w-full min-w-0 items-center gap-2" onSubmit={handleQuickSearchSubmit}>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[0.65rem] border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-[12px] text-slate-700 outline-none placeholder:text-slate-400"
              disabled={!selectedSearchTarget}
              onChange={(event) => setQuickSearch(event.target.value)}
              placeholder={selectedSearchTarget?.placeholder || translateText("Tim theo ten, ma, SDT, email...")}
              ref={quickSearchInputRef}
              spellCheck={false}
              type="text"
              value={quickSearch}
            />
            {quickSearch ? (
              <button
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                onClick={handleQuickSearchClear}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
          <select
            className="h-[34px] w-[140px] shrink-0 rounded-[0.65rem] border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 outline-none"
            disabled={!selectedSearchTarget}
            onChange={(event) => setQuickSearchTarget(event.target.value)}
            value={selectedSearchTarget?.key || ""}
          >
            {availableSearchTargets.map((target) => (
              <option key={target.key} value={target.key}>
                {target.label}
              </option>
            ))}
          </select>
          <button
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[0.65rem] border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedSearchTarget}
            type="submit"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </form>
        <p className="mt-2 text-[10px] text-slate-500">
          {selectedSearchTarget
            ? `${translateText("Dang tim trong muc")}: ${selectedSearchTarget.label}`
            : translateText("Chon pham vi tim kiem nhanh")}
        </p>
      </div>

      {licenseStatus ? (
        <div className="min-w-0">
          <LicenseTopbarActions licenseStatus={licenseStatus} />
        </div>
      ) : null}

      <div className={cn("min-w-0", hasLicenseStatus ? "xl:col-span-2 2xl:col-span-1" : "xl:justify-self-end")}>
        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end 2xl:grid 2xl:w-full 2xl:grid-cols-[auto_auto_minmax(0,1fr)_auto] 2xl:items-center">
          {canTriggerLocalUpdate ? (
            <button className="secondary-button shrink-0" disabled={isUpdatingLocalRuntime} onClick={() => void handleLocalUpdate()} type="button">
              <RefreshCw className={cn("h-4 w-4", isUpdatingLocalRuntime ? "animate-spin" : "")} />
              {isUpdatingLocalRuntime ? translateText("Dang update...") : translateText("Update")}
            </button>
          ) : null}
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
          <div className="min-w-0 rounded-[0.65rem] border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-slate-700 2xl:max-w-[560px]">
            <div className="truncate font-bold leading-4 text-slate-900">{user?.fullName}</div>
            <div className="truncate text-[10px] text-slate-500">{translateRoleList(user?.roleCodes || [], user?.roleNames)}</div>
          </div>
          <button className="secondary-button shrink-0" onClick={() => void logout()} type="button">
            {translateText("Logout")}
          </button>
        </div>
      </div>
    </div>
  );
}
