import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { api, ListResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ResourceFilter } from "@/types/portal";
import { translateText } from "@/lib/i18n/display";
import { getViewPermissionForEndpoint } from "@/lib/portal-pages";
import { DateRangeFilter } from "./date-range-filter";

interface FilterSidebarProps {
  filters: ResourceFilter[];
  query: Record<string, string>;
  onChange: (name: string, value: string) => void;
  title?: string;
  subtitle?: string;
}

export function FilterSidebar({ filters, query, onChange, title, subtitle }: FilterSidebarProps) {
  const { user, isReady } = useAuth();
  const hasDateRange = filters.some((filter) => filter.name === "dateFrom") || filters.some((filter) => filter.name === "dateTo");
  const filterConfigs = useMemo(
    () =>
      filters.map((filter) => {
        const permission = getViewPermissionForEndpoint(filter.optionsEndpoint);
        const canLoadOptions = !permission || user?.permissions.includes(permission);
        const fallbackOptions =
          filter.type === "select" && filter.optionsEndpoint === "/branches" && user?.branchId
            ? [{ label: String(user.branchName || translateText("Chi nhanh hien tai")), value: String(user.branchId) }]
            : [];

        return {
          filter,
          canLoadOptions,
          fallbackOptions,
        };
      }),
    [filters, user],
  );

  const optionQueries = useQueries({
    queries: filterConfigs.map(({ filter, canLoadOptions }) => ({
      queryKey: ["filter-options", filter.name, filter.optionsEndpoint, canLoadOptions ? "allowed" : "blocked", user?.branchId || ""],
      enabled: isReady && filter.type === "select" && Boolean(filter.optionsEndpoint) && canLoadOptions,
      queryFn: async () => {
        if (!filter.optionsEndpoint) return [];
        const response = await api.get<ListResponse<Record<string, unknown>> | Array<Record<string, unknown>>>(filter.optionsEndpoint, {
          params: { pageSize: 100 },
        });
        const payload = Array.isArray(response.data) ? response.data : response.data.data;
        return payload.map((item) => ({
          label: String(item[filter.optionLabelKey || "name"] || item.label || item.name || item.id || ""),
          value: String(item[filter.optionValueKey || "id"] || item.value || item.id || ""),
        }));
      },
    })),
  });

  const optionMap = useMemo(
    () =>
      new Map(
        filterConfigs.map(({ filter, canLoadOptions, fallbackOptions }, index) => [
          filter.name,
          filter.options?.length
            ? filter.options
            : ((optionQueries[index]?.data as Array<{ label: string; value: string }> | undefined) || []).length
              ? ((optionQueries[index]?.data as Array<{ label: string; value: string }> | undefined) || [])
              : canLoadOptions
                ? []
                : fallbackOptions,
        ]),
      ),
    [filterConfigs, optionQueries],
  );

  return (
    <aside className="portal-panel portal-panel-compact min-w-0 w-full space-y-3 overflow-hidden">
      <div>
        <p className="panel-eyebrow">{title || translateText("Filters")}</p>
        <h3 className="panel-title mt-1">{subtitle || translateText("Quick refine")}</h3>
      </div>

      {filters
        .filter((filter) => !["dateFrom", "dateTo"].includes(filter.name))
        .map((filter) => (
          <label className="field" key={filter.name}>
            <span>{translateText(filter.label)}</span>
            <select value={query[filter.name] || ""} onChange={(event) => onChange(filter.name, event.target.value)}>
              <option value="">{translateText("All")}</option>
              {(optionMap.get(filter.name) || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {translateText(option.label)}
                </option>
              ))}
            </select>
          </label>
        ))}

      {hasDateRange ? (
        <DateRangeFilter
          from={query.dateFrom || ""}
          onChange={(next) => {
            onChange("dateFrom", next.from);
            onChange("dateTo", next.to);
          }}
          to={query.dateTo || ""}
        />
      ) : null}
    </aside>
  );
}
