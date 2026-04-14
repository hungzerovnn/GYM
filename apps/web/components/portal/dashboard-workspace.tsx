"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
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
  birthdayTodayMembers: Array<{
    id: string;
    code: string;
    fullName: string;
    phone: string;
    branchName: string;
    birthDate: string;
    membershipStatus: string;
  }>;
  expiredMemberCheckInAlerts: {
    totalAttempts: number;
    records: Array<{
      customerId: string;
      fullName: string;
      code: string;
      phone: string;
      branchName: string;
      attemptCount: number;
      lastAttemptAt: string;
      overdueDays: number;
      membershipEndDate: string;
      source: string;
      machineName: string;
      attendanceCode: string;
      note: string;
    }>;
  };
}

export function DashboardWorkspace({
  title = "Tong quan he thong",
  subtitle = "Tong hop hoi vien, hop dong, lead, doanh thu, cong no va canh bao van hanh theo chi nhanh.",
}: {
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
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
  const expiredMemberCheckInAlerts = summary?.expiredMemberCheckInAlerts || {
    totalAttempts: 0,
    records: [],
  };
  const birthdayTodayMembers = summary?.birthdayTodayMembers || [];
  const openBirthdayReport = () => {
    router.push("/members/birthday");
  };

  return (
    <div className="dashboard-workspace space-y-5">
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
              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
                <div>
                  <div className="card border border-rose-200 bg-rose-50/40 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700">{translateText("Cảnh báo chấm công")}</p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-900">{translateText("Hội viên quá hạn vẫn chấm công")}</h3>
                        <p className="mt-2 text-sm text-slate-600">
                          {translateText("Danh sách hội viên đã hết hạn nhưng vẫn có lần cố gắng check-in vào tập trong khoảng thời gian lọc hiện tại.")}
                        </p>
                      </div>
                      <div className="rounded-full border border-rose-200 bg-white px-3 py-1 text-sm font-semibold text-rose-700">
                        {formatNumber(expiredMemberCheckInAlerts.totalAttempts)} {translateText("lượt cảnh báo")}
                      </div>
                    </div>

                    {expiredMemberCheckInAlerts.records.length ? (
                      <div className="mt-5 overflow-hidden rounded-2xl border border-rose-100 bg-white">
                        <div className="divide-y divide-rose-100">
                          {expiredMemberCheckInAlerts.records.map((item) => (
                            <div className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.2fr)_220px_220px]" key={item.customerId}>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-900">{item.fullName}</div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {[item.code, item.phone, item.branchName].filter(Boolean).join(" • ") || "-"}
                                </div>
                                {item.attendanceCode ? (
                                  <div className="mt-2 inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                                    {`${translateText("Mã chấm công")}: ${item.attendanceCode}`}
                                  </div>
                                ) : null}
                              </div>

                              <div className="text-sm text-slate-600">
                                <div className="font-semibold text-rose-700">
                                  {item.overdueDays > 0
                                    ? `${translateText("Quá hạn")}: ${formatNumber(item.overdueDays)} ${translateText("ngày")}`
                                    : translateText("Đã hết hạn")}
                                </div>
                                <div className="mt-1">
                                  {`${translateText("Hết hạn")}: ${formatDate(item.membershipEndDate || "")}`}
                                </div>
                                <div className="mt-1">
                                  {`${translateText("Số lần cố gắng")}: ${formatNumber(item.attemptCount)}`}
                                </div>
                              </div>

                              <div className="text-sm text-slate-600">
                                <div className="font-medium text-slate-900">
                                  {formatDateTime(item.lastAttemptAt || "")}
                                </div>
                                <div className="mt-1">
                                  {item.source === "MACHINE"
                                    ? `${translateText("Nguồn")}: ${translateText("Máy chấm công")}${item.machineName ? ` • ${item.machineName}` : ""}`
                                    : `${translateText("Nguồn")}: ${translateText("Tại quầy")}`}
                                </div>
                                {item.note ? <div className="mt-1 text-xs text-slate-500">{item.note}</div> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-6 text-sm text-slate-600">
                        {translateText("Chưa ghi nhận hội viên quá hạn cố gắng vào tập trong khoảng thời gian này.")}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  className="card block self-start p-5 text-left transition hover:border-emerald-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  onClick={openBirthdayReport}
                  type="button"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{translateText("Sinh nhat hoi vien")}</p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-900">
                        {`${translateText("Sinh nhat hoi vien")} ${translateText("Hom nay").toLowerCase()}`}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">{formatDate(new Date())}</p>
                    </div>
                    <div className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                      {formatNumber(birthdayTodayMembers.length)} {translateText("records")}
                    </div>
                  </div>
                  <div className="mt-3 inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold text-emerald-700">
                    {translateText("Mo danh sach day du")}
                  </div>

                  {birthdayTodayMembers.length ? (
                    <div className="mt-5 space-y-3">
                      {birthdayTodayMembers.map((item) => (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3" key={item.id}>
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                            <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-900">{item.fullName}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {[item.code, item.phone].filter(Boolean).join(" • ") || "-"}
                            </div>
                          </div>
                            <div className="grid gap-1 text-xs text-slate-600 md:text-right">
                              <div className="font-medium text-slate-700">{`${translateText("Ngay sinh")}: ${formatDate(item.birthDate || "")}`}</div>
                              <div>{`${translateText("Chi nhanh")}: ${item.branchName || "-"}`}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-6 text-sm text-slate-600">
                      {`${translateText("Khong co du lieu")} ${translateText("Sinh nhat hoi vien").toLowerCase()} ${translateText("Hom nay").toLowerCase()}.`}
                    </div>
                  )}
                </button>
              </div>

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
