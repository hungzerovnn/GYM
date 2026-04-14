"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeCheck,
  BadgePercent,
  BadgePlus,
  Ban,
  BarChart3,
  Blocks,
  BookOpenCheck,
  BriefcaseBusiness,
  Building,
  Building2,
  Calendar,
  CalendarCheck2,
  CalendarClock,
  CalendarCog,
  CalendarDays,
  CalendarRange,
  Cake,
  ChartColumn,
  ChartNoAxesCombined,
  ChevronDown,
  Circle,
  CircleDollarSign,
  Coins,
  ContactRound,
  CreditCard,
  Dumbbell,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Gauge,
  Gift,
  GitBranchPlus,
  Hash,
  Headset,
  History,
  Home,
  Landmark,
  LayoutDashboard,
  Layers3,
  LineChart,
  List,
  ListChecks,
  ListFilter,
  ListTree,
  LucideIcon,
  MapPinned,
  Megaphone,
  Monitor,
  OctagonAlert,
  Package2,
  PackageSearch,
  Paperclip,
  PauseCircle,
  PieChart,
  Printer,
  Receipt,
  ReceiptText,
  RefreshCw,
  Repeat2,
  RotateCcw,
  ScanLine,
  Scale,
  ScrollText,
  Send,
  Settings,
  ShoppingBasket,
  ShoppingCart,
  Shuffle,
  Star,
  Tag,
  Tags,
  TicketPercent,
  Truck,
  UserRoundPlus,
  UserRoundSearch,
  Users,
  UsersRound,
  Wallet,
  WalletCards,
  WalletMinimal,
  Waypoints,
  Workflow,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { translateText } from "@/lib/i18n/display";
import { localizeMenuGroups } from "@/lib/i18n/portal";
import { useLocale } from "@/lib/i18n/provider";
import { getMenuGroupByPath, getViewPermissionForPath, menuGroups } from "@/lib/navigation-config";
import { cn } from "@/lib/format";

const iconMap: Record<string, LucideIcon> = {
  home: Home,
  users: Users,
  "briefcase-business": BriefcaseBusiness,
  "calendar-days": CalendarDays,
  "calendar-range": CalendarRange,
  "badge-plus": BadgePlus,
  wallet: Wallet,
  "shopping-basket": ShoppingBasket,
  "bar-chart-3": BarChart3,
  settings: Settings,
  "layout-dashboard": LayoutDashboard,
  gauge: Gauge,
  "chart-column": ChartColumn,
  cake: Cake,
  "calendar-clock": CalendarClock,
  "user-round-search": UserRoundSearch,
  "user-round-plus": UserRoundPlus,
  "badge-check": BadgeCheck,
  "wallet-cards": WalletCards,
  "layers-3": Layers3,
  waypoints: Waypoints,
  "file-text": FileText,
  "file-signature": FileSignature,
  list: List,
  "refresh-cw": RefreshCw,
  "arrow-up-right": ChartNoAxesCombined,
  "pause-circle": PauseCircle,
  "repeat-2": Repeat2,
  "git-branch-plus": GitBranchPlus,
  ban: Ban,
  shuffle: Shuffle,
  "grid-2x2": Blocks,
  "package-2": Package2,
  gift: Gift,
  history: History,
  "calendar-check-2": CalendarCheck2,
  monitor: Monitor,
  calendar: Calendar,
  "users-round": UsersRound,
  "list-tree": ListTree,
  "calendar-cog": CalendarCog,
  blocks: Blocks,
  headset: Headset,
  paperclip: Paperclip,
  dumbbell: Dumbbell,
  workflow: Workflow,
  "scroll-text": ScrollText,
  "book-open-check": BookOpenCheck,
  "line-chart": LineChart,
  coins: Coins,
  "banknote-arrow-down": WalletMinimal,
  "package-search": PackageSearch,
  "contact-round": ContactRound,
  tag: Tag,
  "shopping-cart": ShoppingCart,
  "rotate-ccw": RotateCcw,
  truck: Truck,
  "scan-line": ScanLine,
  fingerprint: Fingerprint,
  activity: Activity,
  "pie-chart": PieChart,
  "building-2": Building2,
  "list-checks": ListChecks,
  "receipt-text": ReceiptText,
  "shield-dollar-sign": CircleDollarSign,
  "credit-card": CreditCard,
  star: Star,
  building: Building,
  receipt: Receipt,
  landmark: Landmark,
  printer: Printer,
  "file-spreadsheet": FileSpreadsheet,
  "map-pinned": MapPinned,
  send: Send,
  hash: Hash,
  "ticket-percent": TicketPercent,
  "badge-percent": BadgePercent,
  tags: Tags,
  "list-filter": ListFilter,
  megaphone: Megaphone,
  scale: Scale,
  "octagon-alert": OctagonAlert,
};

function PortalIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = (name && iconMap[name]) || Circle;
  return <Icon className={className} strokeWidth={2} />;
}

export function SidebarMenu() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { locale } = useLocale();
  const isSystemOwner = Boolean(user?.roleCodes.includes("system_owner"));
  const localizedGroups = useMemo(() => localizeMenuGroups(menuGroups), [locale]);
  const visibleGroups = useMemo(
    () =>
      localizedGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (item.ownerOnly && !isSystemOwner) {
              return false;
            }
            const permission = getViewPermissionForPath(item.href);
            return !permission || user?.permissions.includes(permission);
          }),
        }))
        .filter((group) => group.items.length > 0),
    [isSystemOwner, localizedGroups, user?.permissions],
  );
  const activeGroup = useMemo(() => {
    const visibleMatch = visibleGroups.find((group) => group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)));
    if (visibleMatch) {
      return visibleMatch;
    }

    const rawFallbackGroup = getMenuGroupByPath(pathname);
    return (
      localizedGroups.find((group) => group.href === rawFallbackGroup?.href) ||
      localizedGroups.find((group) => group.title === translateText(rawFallbackGroup?.title || "", locale)) ||
      visibleGroups[0] ||
      localizedGroups[0]
    );
  }, [locale, localizedGroups, pathname, visibleGroups]);

  return (
    <section>
      <div className="rounded-[0.82rem] border border-slate-200 bg-white/95 shadow-[0_6px_18px_rgba(15,23,42,0.04)] backdrop-blur-sm">
        <div className="border-t-[3px] border-emerald-500 px-2 py-1.5">
          <div className="flex flex-wrap items-start gap-1.5">
            {visibleGroups.map((group, index) => {
              const isActive = group.href ? group.href === activeGroup.href : group.items.some((item) => pathname.startsWith(item.href));
              const alignRight = index >= visibleGroups.length - 2;

              return (
                <div className="group relative" key={group.title}>
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-[0.58rem] border px-2.5 py-1 text-[11px] font-medium transition",
                      isActive
                        ? "border-emerald-200 bg-emerald-50 text-slate-900"
                        : "border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    <PortalIcon className="h-3.5 w-3.5 shrink-0" name={group.icon} />
                    <span>{group.title}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 text-slate-400 transition group-hover:rotate-180 group-hover:text-emerald-700" />
                  </div>

                  <div
                    className={cn(
                      "pointer-events-none invisible absolute top-full z-50 translate-y-1 pt-1.5 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100",
                      alignRight ? "right-0" : "left-0",
                    )}
                  >
                    <div className="max-h-[68vh] w-[236px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[0.82rem] border border-slate-200 bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,0.14)]">
                      {group.items.map((item) => {
                        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                        return (
                          <Link
                            className={cn(
                              "flex items-center gap-2 rounded-[0.55rem] px-2.5 py-1.5 text-[11px] transition",
                              active ? "bg-emerald-50 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50",
                            )}
                            href={item.href}
                            key={item.href}
                            scroll={false}
                          >
                            <PortalIcon className="h-3.5 w-3.5 shrink-0 text-slate-600" name={item.icon} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
