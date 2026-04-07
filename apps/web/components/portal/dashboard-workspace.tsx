"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/lib/auth-context";
import { api, ListResponse } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import { translateText } from "@/lib/i18n/display";
import { KPIStatCard } from "../dashboard/kpi-stat-card";
import { EmptyState } from "../feedback/empty-state";
import { FilterSidebar } from "../filters/filter-sidebar";
import { PageHeader } from "../layout/page-header";
import { AuditLogTable } from "../shared/audit-log-table";

const chartColors = ["#16a34a", "#22c55e", "#4ade80", "#15803d", "#65a30d", "#0f766e"];

const formatTooltipLabel = (value: unknown) => translateText(String(value || ""));
const formatCurrencyTooltip = (value: unknown, name: unknown) => [formatCurrency(Number(value || 0)), translateText(String(name || ""))] as const;
const formatCountTooltip = (value: unknown, name: unknown) => [formatNumber(Number(value || 0)), translateText(String(name || ""))] as const;

interface DashboardPayload {
  stats: {
    activeMembers: number;
    activeContracts: number;
    revenueToday: number;
    revenueMonth: number;
    newLeads: number;
    convertedLeads: number;
    expiringContracts: number;
    lowRemainingSessions: number;
    outstandingDebt: number;
  };
  topSales: Array<{ name: string; contracts: number; revenue: number }>;
  revenueByBranch: Array<{ branch: string; revenue: number }>;
  revenueByService: Array<{ name: string; revenue: number }>;
  newMembersTrend: Array<{ label: string; count: number }>;
  leadBySource: Array<{ source: string; total: number }>;
  recentActivities: Array<Record<string, unknown>>;
  actionItems: Array<{ label: string; value: number }>;
}

export function DashboardWorkspace({
  title = "Tong quan he thong",
  subtitle = "Tong hop hoi vien, hop dong, lead, doanh thu, cong no va canh bao van hanh theo chi nhanh.",
}: {
  title?: string;
  subtitle?: string;
}) {
  const { user, isReady } = useAuth();
  const canViewBranches = user?.permissions.includes("branches.view");
  const [filters, setFilters] = useState<Record<string, string>>({
    branchId: "",
    dateFrom: "",
    dateTo: "",
  });
  const effectiveFilters = !isReady || canViewBranches || !user?.branchId || filters.branchId ? filters : { ...filters, branchId: user.branchId || "" };

  const branchesQuery = useQuery({
    queryKey: ["dashboard-branches"],
    enabled: isReady && canViewBranches,
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/branches", { params: { pageSize: 100 } });
      return response.data.data;
    },
  });

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", effectiveFilters],
    queryFn: async () => {
      const response = await api.get<DashboardPayload>("/dashboard/summary", { params: effectiveFilters });
      return response.data;
    },
  });

  const sidebarFilters = useMemo(
    () => [
      {
        name: "branchId",
        label: "Chi nhanh",
        type: "select" as const,
        options: canViewBranches
          ? (branchesQuery.data || []).map((branch) => ({
              label: String(branch.name || branch.code || translateText("Chi nhanh")),
              value: String(branch.id),
            }))
          : user?.branchId
            ? [{ label: String(user.branchName || translateText("Chi nhanh hien tai")), value: String(user.branchId) }]
            : [],
      },
      { name: "dateFrom", label: "Tu ngay", type: "date" as const },
      { name: "dateTo", label: "Den ngay", type: "date" as const },
    ],
    [branchesQuery.data, canViewBranches, user],
  );

  const summary = summaryQuery.data;

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle={subtitle}
      />

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <FilterSidebar
          filters={sidebarFilters}
          onChange={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
          query={effectiveFilters}
          subtitle={translateText("Chi nhanh va khoang thoi gian")}
          title={translateText("Dieu kien tong quan")}
        />

        <div className="space-y-5">
          {!summary ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div className="card h-32 animate-pulse bg-slate-100" key={index} />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <KPIStatCard label="Hoi vien dang hoat dong" value={summary.stats.activeMembers} />
              <KPIStatCard label="Hop dong hieu luc" value={summary.stats.activeContracts} />
              <KPIStatCard label="Doanh thu hom nay" type="currency" value={summary.stats.revenueToday} />
              <KPIStatCard label="Doanh thu thang" type="currency" value={summary.stats.revenueMonth} />
              <KPIStatCard label="Lead moi" value={summary.stats.newLeads} />
              <KPIStatCard label="Lead da chuyen doi" value={summary.stats.convertedLeads} />
              <KPIStatCard label="Hop dong sap het han" value={summary.stats.expiringContracts} />
              <KPIStatCard label="Cong no can thu" type="currency" value={summary.stats.outstandingDebt} />
            </div>
          )}

          {summaryQuery.isError ? (
            <EmptyState
              description={translateText("Khong tai duoc du lieu dashboard. Hay kiem tra API, seed data va phien dang nhap.")}
              title={translateText("Dashboard gap loi")}
            />
          ) : null}

          {summary ? (
            <>
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText("Doanh thu")}</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">{translateText("Doanh thu theo chi nhanh")}</h3>
                    </div>
                    <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{translateText("Du lieu truc tiep tu database")}</div>
                  </div>
                  <div className="mt-6 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={summary.revenueByBranch}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="branch" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1_000_000)}M`} />
                        <Tooltip formatter={formatCurrencyTooltip} />
                        <Bar dataKey="revenue" fill="#16a34a" radius={[12, 12, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText("Hoi vien moi")}</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">{translateText("Hoi vien moi 7 ngay gan nhat")}</h3>
                  </div>
                  <div className="mt-6 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={summary.newMembersTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} />
                        <Tooltip formatter={formatCountTooltip} />
                        <Line dataKey="count" stroke="#15803d" strokeWidth={3} type="monotone" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="card p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText("Nguon lead")}</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">{translateText("Lead theo nguon")}</h3>
                  </div>
                  {summary.leadBySource.length ? (
                    <div className="mt-6 h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={summary.leadBySource} dataKey="total" innerRadius={70} nameKey="source" outerRadius={110}>
                            {summary.leadBySource.map((_, index) => (
                              <Cell fill={chartColors[index % chartColors.length]} key={index} />
                            ))}
                          </Pie>
                          <Tooltip formatter={formatCountTooltip} labelFormatter={formatTooltipLabel} />
                          <Legend formatter={formatTooltipLabel} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <EmptyState description={translateText("Chua co lead trong khoang thoi gian nay.")} title={translateText("Khong co du lieu lead")} />
                    </div>
                  )}
                </div>

                <div className="card p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText("Can xu ly")}</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">{translateText("Nhac viec can xu ly")}</h3>
                  </div>
                  <div className="mt-6 space-y-3">
                    {summary.actionItems.map((item) => (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={item.label}>
                        <p className="text-sm text-slate-500">{translateText(item.label)}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">
                          {item.label.toLowerCase().includes("debt") ? formatCurrency(item.value) : formatNumber(item.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText("Ban hang")}</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">{translateText("Top nhan vien ban hang")}</h3>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{`${summary.topSales.length} ${translateText("records")}`}</div>
                  </div>
                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          <th className="px-4 py-3">{translateText("Nhan vien")}</th>
                          <th className="px-4 py-3">{translateText("Hop dong")}</th>
                          <th className="px-4 py-3">{translateText("Doanh thu")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.topSales.map((item) => (
                          <tr className="border-t border-slate-100" key={item.name}>
                            <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                            <td className="px-4 py-3">{item.contracts}</td>
                            <td className="px-4 py-3">{formatCurrency(item.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText("Co cau")}</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900">{translateText("Doanh thu theo goi dich vu")}</h3>
                  </div>
                  {summary.revenueByService.length ? (
                    <div className="mt-6 h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={summary.revenueByService} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 1_000_000)}M`} />
                          <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={formatCurrencyTooltip} />
                          <Bar dataKey="revenue" fill="#22c55e" radius={[0, 12, 12, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="mt-6">
                      <EmptyState description={translateText("Chua co phat sinh doanh thu dich vu.")} title={translateText("Khong co du lieu doanh thu")} />
                    </div>
                  )}
                </div>
              </div>

              <div className="card p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText("Nhat ky he thong")}</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">{translateText("Hoat dong gan day")}</h3>
                </div>
                <div className="mt-5">
                  <AuditLogTable rows={summary.recentActivities} />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
