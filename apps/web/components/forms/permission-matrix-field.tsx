"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ListResponse } from "@/lib/api";
import {
  translatePermissionAction,
  translatePermissionCode,
  translatePermissionModule,
  translateText,
} from "@/lib/i18n/display";

type PermissionItem = {
  id: string;
  code: string;
  module?: string | null;
  action?: string | null;
  description?: string | null;
};

interface PermissionMatrixFieldProps {
  label: string;
  permissions: PermissionItem[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  currentRoleId?: string;
}

type RoleOption = {
  id: string;
  name: string;
  code: string;
  permissionCount: number;
  roleType?: string;
};

type ModuleGroup = {
  moduleKey: string;
  moduleLabel: string;
  permissions: PermissionItem[];
};

type ActionGroup = {
  actionKey: string;
  actionLabel: string;
  permissionIds: string[];
  moduleCount: number;
};

const primaryActionKeys = ["view", "create", "update", "delete"] as const;

type PrimaryActionKey = (typeof primaryActionKeys)[number];

const actionOrder: Record<string, number> = {
  view: 1,
  create: 2,
  update: 3,
  delete: 4,
  restore: 5,
  approve: 6,
  export: 7,
  report: 8,
  branch_scope: 9,
  own_scope: 10,
};

const getModuleKey = (moduleName?: string | null) => {
  const normalized = (moduleName || "").trim();
  return normalized || "other";
};

const getModuleLabel = (moduleName?: string | null) => {
  const normalized = (moduleName || "").trim();
  if (!normalized) return translateText("Khac");
  return translatePermissionModule(normalized);
};

const getActionLabel = (action?: string | null) => {
  const normalized = (action || "").trim();
  if (!normalized) return translateText("Quyen");
  return translatePermissionAction(normalized);
};

const getActionKey = (action?: string | null) => {
  const normalized = (action || "").trim();
  return normalized || "other";
};

const getPrimaryActionLabel = (action: PrimaryActionKey) => {
  switch (action) {
    case "view":
      return translateText("Xem");
    case "create":
      return translateText("Them");
    case "update":
      return translateText("Sua");
    case "delete":
      return translateText("Xoa");
    default:
      return action;
  }
};

const buildInitialSelectedModules = (permissions: PermissionItem[], value: string[], moduleGroups: ModuleGroup[]) => {
  const selectedFromValue = Array.from(
    new Set(
      permissions
        .filter((permission) => value.includes(permission.id))
        .map((permission) => getModuleKey(permission.module)),
    ),
  );

  return selectedFromValue.length ? selectedFromValue : moduleGroups.map((group) => group.moduleKey);
};

function PermissionMatrixFieldInner({
  label,
  permissions,
  value,
  onChange,
  error,
  currentRoleId,
}: PermissionMatrixFieldProps) {
  const [search, setSearch] = useState("");
  const [sourceRoleId, setSourceRoleId] = useState("");
  const deferredSearch = useDeferredValue(search);
  const selected = new Set(value);
  const moduleGroups = useMemo<ModuleGroup[]>(() => {
    const groups = new Map<string, ModuleGroup>();

    permissions.forEach((permission) => {
      const moduleKey = getModuleKey(permission.module);
      const current = groups.get(moduleKey) || {
        moduleKey,
        moduleLabel: getModuleLabel(moduleKey),
        permissions: [],
      };

      current.permissions.push(permission);
      groups.set(moduleKey, current);
    });

    return Array.from(groups.values()).sort((left, right) => left.moduleLabel.localeCompare(right.moduleLabel));
  }, [permissions]);
  const [selectedModules, setSelectedModules] = useState<string[]>(() => buildInitialSelectedModules(permissions, value, moduleGroups));
  const rolesQuery = useQuery({
    queryKey: ["permission-matrix-roles", currentRoleId || "create"],
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/roles", {
        params: { pageSize: 100, sortBy: "name", sortOrder: "asc" },
      });

      return (response.data.data || []).map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || item.code || ""),
        code: String(item.code || ""),
        permissionCount: Number(item.permissionCount || 0),
        roleType: typeof item.roleType === "string" ? item.roleType : undefined,
      })) as RoleOption[];
    },
  });
  const sourceRoleQuery = useQuery({
    queryKey: ["permission-matrix-role-detail", sourceRoleId],
    enabled: Boolean(sourceRoleId),
    queryFn: async () => {
      const response = await api.get<Record<string, unknown>>(`/roles/${sourceRoleId}`);
      return response.data;
    },
  });

  const availableRoles = useMemo(
    () => (rolesQuery.data || []).filter((role) => role.id && role.id !== currentRoleId),
    [currentRoleId, rolesQuery.data],
  );
  const permissionToModuleMap = useMemo(
    () => new Map(permissions.map((permission) => [permission.id, getModuleKey(permission.module)])),
    [permissions],
  );
  const selectedModuleSet = useMemo(() => new Set(selectedModules), [selectedModules]);
  const filteredPermissions = useMemo(() => {
    if (!selectedModules.length) {
      return [];
    }

    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return permissions.filter((permission) => {
      if (!selectedModuleSet.has(getModuleKey(permission.module))) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        permission.code,
        permission.module,
        permission.action,
        permission.description,
        getModuleLabel(permission.module),
        getActionLabel(permission.action),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [deferredSearch, permissions, selectedModuleSet, selectedModules.length]);
  const groupedPermissions = useMemo(() => {
    const groups = new Map<
      string,
      {
        moduleKey: string;
        moduleLabel: string;
        permissions: PermissionItem[];
      }
    >();

    filteredPermissions.forEach((permission) => {
      const moduleKey = getModuleKey(permission.module);
      const current = groups.get(moduleKey) || {
        moduleKey,
        moduleLabel: getModuleLabel(moduleKey),
        permissions: [],
      };

      current.permissions.push(permission);
      groups.set(moduleKey, current);
    });

    return Array.from(groups.values())
      .sort((left, right) => left.moduleLabel.localeCompare(right.moduleLabel))
      .map((group) => ({
        ...group,
        permissions: [...group.permissions].sort((left, right) => {
          const leftOrder = actionOrder[left.action || ""] || 999;
          const rightOrder = actionOrder[right.action || ""] || 999;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          return getActionLabel(left.action).localeCompare(getActionLabel(right.action));
        }),
      }));
  }, [filteredPermissions]);
  const visibleActionGroups = useMemo<ActionGroup[]>(() => {
    const groups = new Map<
      string,
      {
        actionKey: string;
        actionLabel: string;
        permissionIds: string[];
        moduleKeys: Set<string>;
      }
    >();

    filteredPermissions.forEach((permission) => {
      const actionKey = getActionKey(permission.action);
      const current = groups.get(actionKey) || {
        actionKey,
        actionLabel: getActionLabel(permission.action),
        permissionIds: [],
        moduleKeys: new Set<string>(),
      };

      current.permissionIds.push(permission.id);
      current.moduleKeys.add(getModuleKey(permission.module));
      groups.set(actionKey, current);
    });

    return Array.from(groups.values())
      .sort((left, right) => {
        const leftOrder = actionOrder[left.actionKey] || 999;
        const rightOrder = actionOrder[right.actionKey] || 999;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.actionLabel.localeCompare(right.actionLabel);
      })
      .map((group) => ({
        actionKey: group.actionKey,
        actionLabel: group.actionLabel,
        permissionIds: group.permissionIds,
        moduleCount: group.moduleKeys.size,
      }));
  }, [filteredPermissions]);
  const primaryMatrixRows = useMemo(
    () =>
      moduleGroups
        .filter((group) => selectedModuleSet.has(group.moduleKey))
        .map((group) => {
          const permissionsByAction = primaryActionKeys.reduce(
            (result, actionKey) => ({
              ...result,
              [actionKey]: group.permissions.find((permission) => getActionKey(permission.action) === actionKey),
            }),
            {} as Record<PrimaryActionKey, PermissionItem | undefined>,
          );
          const permissionIds = primaryActionKeys
            .map((actionKey) => permissionsByAction[actionKey]?.id)
            .filter((permissionId): permissionId is string => Boolean(permissionId));
          const selectedCount = permissionIds.filter((permissionId) => selected.has(permissionId)).length;
          const viewSelected = permissionsByAction.view ? selected.has(permissionsByAction.view.id) : false;
          const createSelected = permissionsByAction.create ? selected.has(permissionsByAction.create.id) : false;
          const updateSelected = permissionsByAction.update ? selected.has(permissionsByAction.update.id) : false;
          const deleteSelected = permissionsByAction.delete ? selected.has(permissionsByAction.delete.id) : false;

          let accessLabel = translateText("Tuy chon");
          if (!selectedCount) {
            accessLabel = translateText("Chua cap");
          } else if (viewSelected && !createSelected && !updateSelected && !deleteSelected) {
            accessLabel = translateText("Chi xem");
          } else if (selectedCount === permissionIds.length && permissionIds.length) {
            accessLabel = translateText("Day du");
          }

          return {
            moduleKey: group.moduleKey,
            moduleLabel: group.moduleLabel,
            permissionIds,
            permissionsByAction,
            selectedCount,
            accessLabel,
          };
        }),
    [moduleGroups, selectedModuleSet, value],
  );
  const primaryActionColumns = useMemo(
    () =>
      primaryActionKeys.map((actionKey) => ({
        actionKey,
        actionLabel: getPrimaryActionLabel(actionKey),
        permissionIds: primaryMatrixRows
          .map((row) => row.permissionsByAction[actionKey]?.id)
          .filter((permissionId): permissionId is string => Boolean(permissionId)),
      })),
    [primaryMatrixRows],
  );

  const allPermissionIds = permissions.map((permission) => permission.id);
  const visiblePermissionIds = filteredPermissions.map((permission) => permission.id);
  const selectedModulePermissionIds = permissions
    .filter((permission) => selectedModuleSet.has(getModuleKey(permission.module)))
    .map((permission) => permission.id);
  const primaryPermissionIds = primaryMatrixRows.flatMap((row) => row.permissionIds);
  const sourcePermissionIds = Array.isArray(sourceRoleQuery.data?.permissionIds)
    ? sourceRoleQuery.data.permissionIds.map((item) => String(item))
    : [];

  const getModulesForPermissionIds = (permissionIds: string[]) =>
    Array.from(
      new Set(
        permissionIds
          .map((permissionId) => permissionToModuleMap.get(permissionId))
          .filter((moduleKey): moduleKey is string => Boolean(moduleKey)),
      ),
    );

  const syncModules = (moduleKeys: string[]) => {
    setSelectedModules(Array.from(new Set(moduleKeys)));
  };

  const togglePermission = (permissionId: string) => {
    if (selected.has(permissionId)) {
      onChange(value.filter((item) => item !== permissionId));
      return;
    }

    const moduleKey = permissionToModuleMap.get(permissionId);
    if (moduleKey && !selectedModuleSet.has(moduleKey)) {
      syncModules([...selectedModules, moduleKey]);
    }

    onChange([...value, permissionId]);
  };

  const toggleGroup = (permissionIds: string[], nextChecked: boolean) => {
    if (nextChecked) {
      onChange(Array.from(new Set([...value, ...permissionIds])));
      return;
    }

    onChange(value.filter((item) => !permissionIds.includes(item)));
  };

  const replaceGroupSelection = (groupPermissionIds: string[], nextPermissionIds: string[]) => {
    onChange(Array.from(new Set([...value.filter((item) => !groupPermissionIds.includes(item)), ...nextPermissionIds])));
  };

  const mergeSourcePermissions = () => {
    if (!sourcePermissionIds.length) return;
    syncModules([...selectedModules, ...getModulesForPermissionIds(sourcePermissionIds)]);
    onChange(Array.from(new Set([...value, ...sourcePermissionIds])));
  };

  const replaceWithSourcePermissions = () => {
    if (!sourcePermissionIds.length) return;
    syncModules(getModulesForPermissionIds(sourcePermissionIds));
    onChange(sourcePermissionIds);
  };

  const toggleModule = (moduleKey: string, nextChecked: boolean) => {
    if (nextChecked) {
      syncModules([...selectedModules, moduleKey]);
      return;
    }

    syncModules(selectedModules.filter((item) => item !== moduleKey));
    const modulePermissionIds =
      moduleGroups.find((group) => group.moduleKey === moduleKey)?.permissions.map((permission) => permission.id) || [];
    if (modulePermissionIds.length) {
      onChange(value.filter((item) => !modulePermissionIds.includes(item)));
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-slate-900">{label}</p>
      <div className="overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3">
          <div className="space-y-1">
            <p className="text-[12px] font-semibold text-slate-800">Danh muc chuc nang va tinh nang</p>
            <p className="text-[11px] text-slate-500">
              {translateText("Chon tat ca, chon theo nhom chuc nang, hoac tick tung quyen rieng de quan ly phan quyen de hon.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-600">
              {`${translateText("Da chon")} ${value.length}/${permissions.length}`}
            </span>
            <button
              className="secondary-button !px-3 !py-2 text-[11px]"
              onClick={() => {
                syncModules(moduleGroups.map((group) => group.moduleKey));
                onChange(allPermissionIds);
              }}
              type="button"
            >
              {translateText("Chon tat ca")}
            </button>
            <button className="secondary-button !px-3 !py-2 text-[11px]" disabled={!value.length} onClick={() => onChange([])} type="button">
              {translateText("Bo chon")}
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-200 bg-white px-4 py-3 xl:grid-cols-[minmax(0,1fr)_300px_auto_auto]">
          <label className="field">
            <span>{translateText("Tim quyen")}</span>
            <input onChange={(event) => setSearch(event.target.value)} placeholder={translateText("Tim theo module, hanh dong, ma quyen...")} type="text" value={search} />
          </label>

          <label className="field">
            <span>{translateText("Sao chep tu vai tro")}</span>
            <select onChange={(event) => setSourceRoleId(event.target.value)} value={sourceRoleId}>
              <option value="">{translateText("Chon vai tro mau")}</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>
                  {`${role.name} | ${role.permissionCount} ${translateText("quyen")}`}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              className="secondary-button !px-3 !py-2 text-[11px]"
              disabled={!sourcePermissionIds.length || sourceRoleQuery.isFetching}
              onClick={mergeSourcePermissions}
              type="button"
            >
              {translateText("Them quyen mau")}
            </button>
          </div>

          <div className="flex items-end">
            <button
              className="secondary-button !px-3 !py-2 text-[11px]"
              disabled={!sourcePermissionIds.length || sourceRoleQuery.isFetching}
              onClick={replaceWithSourcePermissions}
              type="button"
            >
              {translateText("Ghi de theo mau")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3 text-[11px] text-slate-500">
          <span className="rounded-full bg-white px-2.5 py-1">{`${translateText("Hien")} ${filteredPermissions.length}/${permissions.length} ${translateText("quyen")}`}</span>
          <span className="rounded-full bg-white px-2.5 py-1">{`${translateText("Tinh nang")} ${selectedModules.length}/${moduleGroups.length}`}</span>
          <span className="rounded-full bg-white px-2.5 py-1">{`${translateText("Hanh dong")} ${visibleActionGroups.length}`}</span>
          {sourceRoleId ? (
            <span className="rounded-full bg-white px-2.5 py-1">
              {`${translateText("Vai tro mau")}: ${availableRoles.find((role) => role.id === sourceRoleId)?.name || sourceRoleId}`}
            </span>
          ) : null}
          {sourceRoleId && sourceRoleQuery.isFetching ? <span>{translateText("Dang tai quyen tu vai tro mau...")}</span> : null}
          {deferredSearch ? <span>{`${translateText("Da loc theo tu khoa")}: "${deferredSearch}"`}</span> : null}
        </div>

        {visibleActionGroups.length ? (
          <div className="border-b border-slate-200 bg-white px-4 py-4">
            <div className="mb-3 space-y-1">
              <p className="text-[12px] font-semibold text-slate-800">{translateText("Chon nhanh theo hanh dong")}</p>
              <p className="text-[11px] text-slate-500">{translateText("Bat nhanh nhom quyen theo tung hanh dong dang hien.")}</p>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {visibleActionGroups.map((group) => {
                const selectedCount = group.permissionIds.filter((permissionId) => selected.has(permissionId)).length;
                const allGroupSelected = group.permissionIds.length > 0 && selectedCount === group.permissionIds.length;

                return (
                  <div
                    className={`rounded-2xl border px-3 py-3 transition ${
                      allGroupSelected
                        ? "border-emerald-500 bg-emerald-50/70 shadow-[0_10px_24px_rgba(34,197,94,0.08)]"
                        : "border-slate-200 bg-slate-50/70"
                    }`}
                    key={group.actionKey}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[12px] font-semibold text-slate-900">{group.actionLabel}</p>
                        <p className="text-[11px] text-slate-500">{`${group.moduleCount} ${translateText("Tinh nang")} | ${group.permissionIds.length} ${translateText("quyen")}`}</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {selectedCount}/{group.permissionIds.length}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button className="secondary-button !px-3 !py-2 text-[11px]" onClick={() => toggleGroup(group.permissionIds, true)} type="button">
                        {translateText("Chon")}
                      </button>
                      <button
                        className="secondary-button !px-3 !py-2 text-[11px]"
                        disabled={!selectedCount}
                        onClick={() => toggleGroup(group.permissionIds, false)}
                        type="button"
                      >
                        {translateText("Bo chon")}
                      </button>
                    </div>

                    <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500">
                      <input
                        checked={allGroupSelected}
                        className="h-4 w-4 accent-emerald-600"
                        onChange={() => toggleGroup(group.permissionIds, !allGroupSelected)}
                        type="checkbox"
                      />
                      <span className="min-w-0 leading-5">{translateText("Chon tat ca quyen trong nhom hanh dong nay.")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="border-b border-slate-200 bg-white px-4 py-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[12px] font-semibold text-slate-800">{translateText("Tinh nang ap dung cho vai tro")}</p>
              <p className="text-[11px] text-slate-500">
                {translateText("Tat bot nhung module khong can dung. Khi bo mot tinh nang, toan bo quyen trong nhom do se duoc go ra khoi vai tro.")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="secondary-button !px-3 !py-2 text-[11px]"
                onClick={() => syncModules(moduleGroups.map((group) => group.moduleKey))}
                type="button"
              >
                {translateText("Chon tat ca tinh nang")}
              </button>
              <button
                className="secondary-button !px-3 !py-2 text-[11px]"
                disabled={!selectedModules.length}
                onClick={() => {
                  syncModules([]);
                  onChange(value.filter((item) => !allPermissionIds.includes(item)));
                }}
                type="button"
              >
                {translateText("Bo tat ca tinh nang")}
              </button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {moduleGroups.map((group) => {
              const checked = selectedModuleSet.has(group.moduleKey);
              const selectedInModule = group.permissions.filter((permission) => selected.has(permission.id)).length;

              return (
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition ${
                    checked
                      ? "border-emerald-500 bg-emerald-50/70 shadow-[0_10px_24px_rgba(34,197,94,0.08)]"
                      : "border-slate-200 bg-slate-50/60 hover:border-emerald-300"
                  }`}
                  key={group.moduleKey}
                >
                  <input
                    checked={checked}
                    className="mt-1 h-4 w-4 accent-emerald-600"
                    onChange={(event) => toggleModule(group.moduleKey, event.target.checked)}
                    type="checkbox"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12px] font-semibold text-slate-900">{group.moduleLabel}</p>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {`${group.permissions.length} ${translateText("quyen")}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {checked
                        ? `${translateText("Dang mo")} ${selectedInModule}/${group.permissions.length} ${translateText("quyen")} ${translateText("trong tinh nang nay")}.`
                        : translateText("Tinh nang dang tat, quyen trong nhom nay se duoc an va khong ap dung cho vai tro.")}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {primaryMatrixRows.length ? (
          <div className="border-b border-slate-200 bg-white px-4 py-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[12px] font-semibold text-slate-800">{translateText("4 quyen co ban theo tung tinh nang")}</p>
                <p className="text-[11px] text-slate-500">
                  {translateText(
                    "Bat tung cot Xem, Them, Sua, Xoa cho moi module. Neu chi bat Xem thi vai tro do se o che do chi xem tren module tuong ung.",
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="secondary-button !px-3 !py-2 text-[11px]"
                  disabled={!primaryPermissionIds.length}
                  onClick={() => toggleGroup(primaryPermissionIds, true)}
                  type="button"
                >
                  {translateText("Bat du 4 quyen")}
                </button>
                <button
                  className="secondary-button !px-3 !py-2 text-[11px]"
                  disabled={!primaryPermissionIds.some((permissionId) => selected.has(permissionId))}
                  onClick={() => toggleGroup(primaryPermissionIds, false)}
                  type="button"
                >
                  {translateText("Tat 4 quyen")}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[860px] space-y-2">
                <div className="grid grid-cols-[minmax(220px,1.6fr)_repeat(4,minmax(110px,1fr))] gap-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{translateText("Tinh nang")}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {translateText("Moi dong la mot module. Ban co the cap quyen rieng cho tung module ma khong can mo toan bo quyen chi tiet.")}
                    </p>
                  </div>
                  {primaryActionColumns.map((column) => {
                    const selectedCount = column.permissionIds.filter((permissionId) => selected.has(permissionId)).length;
                    const allSelected = column.permissionIds.length > 0 && selectedCount === column.permissionIds.length;

                    return (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3 text-center" key={column.actionKey}>
                        <p className="text-[12px] font-semibold text-slate-900">{column.actionLabel}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {selectedCount}/{column.permissionIds.length} {translateText("Tinh nang")}
                        </p>
                        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-[11px] text-slate-500">
                          <input
                            checked={allSelected}
                            className="h-4 w-4 accent-emerald-600"
                            onChange={() => toggleGroup(column.permissionIds, !allSelected)}
                            type="checkbox"
                          />
                          <span>{translateText("Tat ca")}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>

                {primaryMatrixRows.map((row) => {
                  return (
                    <div
                      className="grid grid-cols-[minmax(220px,1.6fr)_repeat(4,minmax(110px,1fr))] gap-2"
                      key={row.moduleKey}
                    >
                      <div
                        className={`rounded-2xl border px-4 py-3 transition ${
                          row.selectedCount ? "border-emerald-500 bg-emerald-50/70" : "border-slate-200 bg-slate-50/60"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-[12px] font-semibold text-slate-900">{row.moduleLabel}</p>
                            <p className="text-[11px] text-slate-500">{`${row.selectedCount}/${row.permissionIds.length} ${translateText("quyen co ban")}`}</p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                              row.selectedCount ? "bg-white text-emerald-700" : "bg-white text-slate-500"
                            }`}
                          >
                            {row.accessLabel}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button className="secondary-button !px-3 !py-2 text-[11px]" onClick={() => toggleGroup(row.permissionIds, true)} type="button">
                            {translateText("Day du")}
                          </button>
                          <button
                            className="secondary-button !px-3 !py-2 text-[11px]"
                            disabled={!row.permissionsByAction.view}
                            onClick={() => {
                              replaceGroupSelection(row.permissionIds, row.permissionsByAction.view ? [row.permissionsByAction.view.id] : []);
                            }}
                            type="button"
                          >
                            {translateText("Chi xem")}
                          </button>
                        </div>
                      </div>

                      {primaryActionKeys.map((actionKey) => {
                        const permission = row.permissionsByAction[actionKey];
                        const checked = permission ? selected.has(permission.id) : false;

                        return (
                          <label
                            className={`flex cursor-pointer items-center justify-center rounded-2xl border px-3 py-3 transition ${
                              checked
                                ? "border-emerald-500 bg-emerald-50/80 shadow-[0_10px_24px_rgba(34,197,94,0.10)]"
                                : "border-slate-200 bg-white hover:border-emerald-300"
                            } ${permission ? "" : "cursor-not-allowed opacity-50"}`}
                            key={`${row.moduleKey}-${actionKey}`}
                          >
                            <input
                              checked={checked}
                              className="h-4 w-4 accent-emerald-600"
                              disabled={!permission}
                              onChange={() => {
                                if (permission) {
                                  togglePermission(permission.id);
                                }
                              }}
                              type="checkbox"
                            />
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-3 text-[11px] text-slate-500">
              {translateText("Cac quyen nang cao nhu duyet, phuc hoi, bao cao, gioi han chi nhanh va pham vi ca nhan van duoc chinh o phan chi tiet ben duoi.")}
            </p>
          </div>
        ) : null}

        {groupedPermissions.length ? (
          <div className="max-h-[52vh] space-y-4 overflow-y-auto p-4">
            {groupedPermissions.map((group) => {
              const groupIds = group.permissions.map((permission) => permission.id);
              const selectedCount = groupIds.filter((permissionId) => selected.has(permissionId)).length;
              const allGroupSelected = group.permissions.length > 0 && selectedCount === group.permissions.length;

              return (
                <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4" key={group.moduleKey}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-[13px] font-semibold text-slate-900">{group.moduleLabel}</h4>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {selectedCount}/{group.permissions.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{`${translateText("Phan quyen cho nhom chuc nang")} ${group.moduleLabel.toLowerCase()}.`}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button className="secondary-button !px-3 !py-2 text-[11px]" onClick={() => toggleGroup(groupIds, true)} type="button">
                        {translateText("Chon nhom")}
                      </button>
                      <button
                        className="secondary-button !px-3 !py-2 text-[11px]"
                        disabled={!selectedCount}
                        onClick={() => toggleGroup(groupIds, false)}
                        type="button"
                      >
                        {translateText("Bo nhom")}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {group.permissions.map((permission) => {
                      const checked = selected.has(permission.id);
                      const actionLabel = getActionLabel(permission.action);

                      return (
                        <label
                          className={`flex cursor-pointer gap-3 rounded-2xl border px-3 py-3 transition ${
                            checked
                              ? "border-emerald-500 bg-emerald-50/80 shadow-[0_10px_24px_rgba(34,197,94,0.10)]"
                              : "border-slate-200 bg-white hover:border-emerald-300"
                          }`}
                          key={permission.id}
                        >
                          <input
                            checked={checked}
                            className="mt-1 h-4 w-4 accent-emerald-600"
                            onChange={() => togglePermission(permission.id)}
                            type="checkbox"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[12px] font-semibold text-slate-900">{actionLabel}</p>
                              {checked ? (
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                  {translateText("Da chon")}
                                </span>
                              ) : null}
                            </div>
                            <p className="break-all text-[10px] uppercase tracking-[0.16em] text-slate-400">{translatePermissionCode(permission.code, undefined, permission.module, permission.action)}</p>
                            {permission.description ? <p className="text-[11px] text-slate-600">{translateText(permission.description)}</p> : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500">
                    <input
                      checked={allGroupSelected}
                      className="h-4 w-4 accent-emerald-600"
                      onChange={() => toggleGroup(groupIds, !allGroupSelected)}
                      type="checkbox"
                    />
                    <span className="min-w-0 leading-5">{`${translateText("Bat tat ca quyen trong nhom")} ${group.moduleLabel.toLowerCase()}.`}</span>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-4 text-[11px] text-slate-500">
            {selectedModules.length
              ? translateText("Khong tim thay danh muc quyen nao.")
              : translateText("Chon it nhat mot tinh nang o tren de bat dau phan quyen cho vai tro.")}
          </div>
        )}

        {deferredSearch && visiblePermissionIds.length ? (
          <div className="flex items-start gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-[11px] text-slate-500">
            <input
              checked={visiblePermissionIds.every((permissionId) => selected.has(permissionId))}
              className="h-4 w-4 accent-emerald-600"
              onChange={() =>
                visiblePermissionIds.every((permissionId) => selected.has(permissionId))
                  ? onChange(value.filter((item) => !visiblePermissionIds.includes(item)))
                  : onChange(Array.from(new Set([...value, ...visiblePermissionIds])))
              }
              type="checkbox"
            />
            <span className="min-w-0 leading-5">{translateText("Bat nhanh tat ca quyen dang hien sau khi loc.")}</span>
          </div>
        ) : null}
        {!deferredSearch && selectedModulePermissionIds.length ? (
          <div className="flex items-start gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-[11px] text-slate-500">
            <input
              checked={selectedModulePermissionIds.every((permissionId) => selected.has(permissionId))}
              className="h-4 w-4 accent-emerald-600"
              onChange={() =>
                selectedModulePermissionIds.every((permissionId) => selected.has(permissionId))
                  ? onChange(value.filter((item) => !selectedModulePermissionIds.includes(item)))
                  : onChange(Array.from(new Set([...value, ...selectedModulePermissionIds])))
              }
              type="checkbox"
            />
            <span className="min-w-0 leading-5">{translateText("Bat nhanh tat ca quyen trong cac tinh nang dang mo.")}</span>
          </div>
        ) : null}
      </div>
      {error ? <small className="block min-h-[1rem] text-[11px] text-rose-600">{error}</small> : <small className="block min-h-[1rem]" />}
    </div>
  );
}

export function PermissionMatrixField(props: PermissionMatrixFieldProps) {
  const permissionKey = props.permissions.map((permission) => permission.id).join("|");

  return <PermissionMatrixFieldInner key={`${props.currentRoleId || "create"}::${permissionKey}`} {...props} />;
}
