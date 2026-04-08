"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ListResponse } from "@/lib/api";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";
import { localizeResourceDefinition } from "@/lib/i18n/portal";
import { useLocale } from "@/lib/i18n/provider";
import { printResourceList, printResourceRecord } from "@/lib/print";
import { buildResourcePrintEntries, getResourceDetailConfig, resolveResourcePrintProfile, toReadableLabel } from "@/lib/resource-meta";
import { ResourceDefinition } from "@/types/portal";
import { FilterSidebar } from "../filters/filter-sidebar";
import { EmptyState } from "../feedback/empty-state";
import { FormDialog } from "../forms/form-dialog";
import { PageHeader } from "../layout/page-header";
import { ResourceDetailDrawer } from "./resource-detail-drawer";
import { SmartDataTable } from "../table/smart-data-table";
import { SearchBar } from "../table/search-bar";
import { ConfirmDialog } from "../shared/confirm-dialog";
import { PermissionGate } from "../shared/permission-gate";

const resolveResourceFilterSubtitle = (filters: ResourceDefinition["filters"]) => {
  const hasBranch = filters.some((filter) => filter.name === "branchId");
  const hasDateRange = filters.some((filter) => filter.name === "dateFrom" || filter.name === "dateTo");
  const hasStatus = filters.some((filter) => ["status", "paymentStatus", "eventType", "source"].includes(filter.name));

  if (hasBranch && hasStatus && hasDateRange) {
    return translateText("Chi nhanh, trang thai va khoang thoi gian");
  }

  if (hasBranch && hasDateRange) {
    return translateText("Chi nhanh va khoang thoi gian");
  }

  if (hasStatus && hasDateRange) {
    return translateText("Trang thai va khoang thoi gian");
  }

  if (hasStatus) {
    return translateText("Trang thai va nhom du lieu");
  }

  return translateText("Loc nhanh theo truong nghiep vu");
};

export function ResourceWorkspace({ resource }: { resource: ResourceDefinition }) {
  const { locale } = useLocale();
  const { user, isReady } = useAuth();
  const localizedResource = useMemo(() => localizeResourceDefinition(resource), [locale, resource]);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);
  const printProfile = resolveResourcePrintProfile(localizedResource);
  const detailConfig = getResourceDetailConfig(resource);
  const canPrintRows = Boolean(printProfile || detailConfig);
  const createLabel = localizedResource.createLabel || translateText("Create");
  const filterSubtitle = useMemo(() => resolveResourceFilterSubtitle(localizedResource.filters), [localizedResource.filters]);
  const appliedFilters = useMemo(
    () => ({ ...(localizedResource.defaultFilters || {}), ...filters }),
    [filters, localizedResource.defaultFilters],
  );
  const canViewResource = !localizedResource.permissionPrefix || user?.permissions.includes(`${localizedResource.permissionPrefix}.view`);
  const canViewSettings = user?.permissions.includes("settings.view");
  const visibleFilterNames = useMemo(() => new Set(localizedResource.filters.map((filter) => filter.name)), [localizedResource.filters]);
  const canCreateResource =
    localizedResource.allowCreate !== false &&
    localizedResource.fields.length > 0 &&
    (!localizedResource.permissionPrefix ||
      user?.permissions.includes(`${localizedResource.permissionPrefix}.create`));
  const canEditResource =
    localizedResource.allowEdit !== false &&
    localizedResource.fields.length > 0 &&
    (!localizedResource.permissionPrefix ||
      user?.permissions.includes(`${localizedResource.permissionPrefix}.update`));
  const canDeleteResource =
    localizedResource.allowDelete !== false &&
    (!localizedResource.permissionPrefix ||
      user?.permissions.includes(`${localizedResource.permissionPrefix}.delete`));

  const queryKey = useMemo(() => [localizedResource.key, search, appliedFilters], [appliedFilters, localizedResource.key, search]);
  const listQuery = useQuery({
    queryKey,
    enabled: isReady && canViewResource,
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>(localizedResource.endpoint, {
        params: {
          search,
          ...appliedFilters,
          pageSize: 100,
        },
      });
      return response.data;
    },
  });
  const printTemplateQuery = useQuery({
    queryKey: ["setting", "print-templates"],
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>>("/settings/print-templates");
      return response.data;
    },
    enabled: isReady && canViewResource && canViewSettings && Boolean(printProfile),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`${localizedResource.endpoint}/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [localizedResource.key] });
      setDeleting(null);
    },
  });

  const rows = listQuery.data?.data || [];
  const printFilters = useMemo(
    () =>
      [
        search ? { label: translateText("Tim kiem"), value: search } : null,
        ...Object.entries(appliedFilters)
          .filter(([key, value]) => value && visibleFilterNames.has(key))
          .map(([key, value]) => ({
            label: translateText(toReadableLabel(key)),
            value,
          })),
      ].filter(Boolean) as Array<{ label: string; value: unknown }>,
    [appliedFilters, search, visibleFilterNames],
  );

  if (isReady && !canViewResource) {
    return (
      <EmptyState
        description={translateText("Vai tro hien tai chua duoc cap quyen cho module nay. Hay mo Vai tro va bat quyen xem chi tiet tuong ung truoc khi thao tac.")}
        title={translateText("Khong co quyen xem module")}
      />
    );
  }

  const handlePrintList = () => {
    if (!printProfile || !rows.length) return;

    printResourceList({
      title: localizedResource.title,
      subtitle: localizedResource.subtitle,
      columns: localizedResource.columns,
      rows,
      filters: printFilters,
      template: printTemplateQuery.data,
      profile: printProfile,
    });
  };

  const handlePrintRow = async (row: Record<string, unknown>) => {
    if (!canPrintRows) return;

    let record = row;

    if (detailConfig && row.id) {
      try {
        const response = await api.get<Record<string, unknown>>(detailConfig.detailEndpoint(String(row.id)));
        record = response.data;
      } catch {
        record = row;
      }
    }

    printResourceRecord({
      title: `${localizedResource.title} ${String(record.code || row.code || record.id || row.id || "").trim()}`.trim(),
      subtitle: localizedResource.subtitle,
      entries: buildResourcePrintEntries(localizedResource, record),
      record,
      filters: printFilters,
      template: printTemplateQuery.data,
      profile: printProfile || undefined,
    });
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title={localizedResource.title}
        subtitle={localizedResource.subtitle}
        actions={
          <div className="flex min-w-[min(100%,460px)] flex-1 flex-wrap items-center justify-end gap-2">
            <div className="min-w-[220px] max-w-[360px] flex-1">
              <SearchBar onChange={setSearch} placeholder={localizedResource.searchPlaceholder} value={search} />
            </div>
            <div className="rounded-[0.62rem] border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-500">
              {`${listQuery.data?.pagination.total || 0} ${translateText("records")}`}
            </div>
            {printProfile ? (
              <button className="secondary-button" disabled={!rows.length} onClick={handlePrintList} type="button">
                <Printer className="h-4 w-4" />
                {translateText("In danh sach")}
              </button>
            ) : null}
            {canCreateResource ? (
              <PermissionGate permission={`${localizedResource.permissionPrefix}.create`}>
                <button className="primary-button" onClick={() => setCreating(true)} type="button">
                  <Plus className="h-4 w-4" />
                  {createLabel}
                </button>
              </PermissionGate>
            ) : null}
          </div>
        }
      />

      <div className="grid items-start gap-2.5 xl:grid-cols-[184px_minmax(0,1fr)]">
        <FilterSidebar
          filters={localizedResource.filters}
          onChange={(name, value) => setFilters((current) => ({ ...current, [name]: value }))}
          query={appliedFilters}
          subtitle={filterSubtitle}
        />

        <div className="space-y-3">
          {listQuery.isLoading ? (
            <div className="grid gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="card h-16 animate-pulse bg-slate-100" key={index} />
              ))}
            </div>
          ) : listQuery.isError ? (
            <EmptyState description={translateText("Khong tai duoc du lieu module nay. Hay kiem tra API va quyen truy cap.")} title={translateText("Module gap loi")} />
          ) : rows.length ? (
            <SmartDataTable
              columns={localizedResource.columns}
              onDelete={canDeleteResource ? (row) => setDeleting(row) : undefined}
              onEdit={canEditResource ? (row) => setEditing(row) : undefined}
              onPrint={canPrintRows ? handlePrintRow : undefined}
              onView={(row) => setSelected(row)}
              rows={rows}
            />
          ) : (
            <EmptyState
              description={localizedResource.emptyStateDescription || translateText("Try adjusting filters or create a new record.")}
              title={localizedResource.emptyStateTitle || `${translateText("Khong co du lieu")} ${translateText(localizedResource.title).toLowerCase()}`}
            />
          )}
        </div>
      </div>

      {canCreateResource ? (
        <FormDialog
          definition={localizedResource}
          endpoint={localizedResource.endpoint}
          initialValues={null}
          onClose={() => setCreating(false)}
          open={creating}
          queryKey={localizedResource.key}
          title={`${createLabel} ${localizedResource.title}`}
        />
      ) : null}

      {canEditResource ? (
        <FormDialog
          definition={localizedResource}
          endpoint={localizedResource.endpoint}
          initialValues={editing}
          onClose={() => setEditing(null)}
          open={Boolean(editing)}
          queryKey={localizedResource.key}
          title={`${translateText("Edit")} ${translateText(localizedResource.title)}`}
        />
      ) : null}

      <ResourceDetailDrawer
        onClose={() => setSelected(null)}
        open={Boolean(selected)}
        printFilters={printFilters}
        printTemplate={printTemplateQuery.data}
        resource={localizedResource}
        selected={selected}
      />

      {canDeleteResource ? (
        <ConfirmDialog
          description={`${translateText("Xoa")} ${translateText(localizedResource.title).toLowerCase()} "${resolveTextDisplay(deleting?.code || deleting?.name || deleting?.fullName)}"?`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void deleteMutation.mutateAsync(String(deleting?.id))}
          open={Boolean(deleting)}
          title={translateText("Confirm deletion")}
        />
      ) : null}
    </div>
  );
}
