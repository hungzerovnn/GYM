"use client";

import { useMemo, useState, type WheelEventHandler } from "react";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Eye, Pencil, Printer, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";
import { ResourceColumn } from "@/types/portal";
import { StatusBadge } from "../shared/status-badge";
import { ColumnSelector } from "./column-selector";

interface SmartDataTableProps {
  columns: ResourceColumn[];
  rows: Record<string, unknown>[];
  onView: (row: Record<string, unknown>) => void;
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
  onPrint?: (row: Record<string, unknown>) => void;
}

type ColumnMeta = Pick<ResourceColumn, "minWidth" | "align">;

const getCellTitle = (
  columns: ResourceColumn[],
  columnKey: string,
  rawValue: unknown,
  row: Record<string, unknown>,
) => {
  const column = columns.find((item) => item.key === columnKey);
  if (!column) {
    return String(rawValue ?? "");
  }

  if (column.type === "currency") {
    return formatCurrency(rawValue as number);
  }

  if (column.type === "date") {
    return formatDate(String(rawValue || ""));
  }

  return resolveTextDisplay(rawValue, column.key, row);
};

export function SmartDataTable({ columns, rows, onView, onEdit, onDelete, onPrint }: SmartDataTableProps) {
  const [visibleColumns, setVisibleColumns] = useState(columns.map((column) => column.key));
  const columnHelper = createColumnHelper<Record<string, unknown>>();

  const tableColumns = useMemo(
    () => {
      const dataColumns = columns
        .filter((column) => visibleColumns.includes(column.key))
        .map((column) =>
          columnHelper.accessor(column.key, {
            header: translateText(column.label),
            meta: { minWidth: column.minWidth, align: column.align } satisfies ColumnMeta,
            cell: (info) => {
              const value = info.getValue();

              if (column.type === "status") {
                return <StatusBadge value={String(value || "")} />;
              }

              if (column.type === "currency") {
                return formatCurrency(value as number);
              }

              if (column.type === "date") {
                return formatDate(String(value || ""));
              }

              return resolveTextDisplay(value, column.key, info.row.original);
            },
          }),
        );

      return [
        ...dataColumns,
        columnHelper.display({
          id: "actions",
          header: translateText("Actions"),
          meta: { minWidth: onPrint ? 132 : 96, align: "center" } satisfies ColumnMeta,
          cell: ({ row }) => (
            <div className="sticky right-0 flex gap-1 bg-white/95 px-1 py-0.5">
              <button className="secondary-button !rounded-[0.45rem] !p-1" onClick={() => onView(row.original)} type="button">
                <Eye className="h-3 w-3" />
              </button>
              <button className="secondary-button !rounded-[0.45rem] !p-1" onClick={() => onEdit(row.original)} type="button">
                <Pencil className="h-3 w-3" />
              </button>
              <button className="secondary-button !rounded-[0.45rem] !p-1" onClick={() => onDelete(row.original)} type="button">
                <Trash2 className="h-3 w-3" />
              </button>
              {onPrint ? (
                <button className="secondary-button !rounded-[0.45rem] !p-1" onClick={() => onPrint(row.original)} type="button">
                  <Printer className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ),
        }),
      ];
    },
    [columnHelper, columns, onDelete, onEdit, onPrint, onView, visibleColumns],
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalMinWidth = useMemo(
    () =>
      columns
        .filter((column) => visibleColumns.includes(column.key))
        .reduce((sum, column) => sum + (column.minWidth || 120), onPrint ? 148 : 112),
    [columns, onPrint, visibleColumns],
  );

  const handleWheel: WheelEventHandler<HTMLDivElement> = (event) => {
    const element = event.currentTarget;
    if (element.scrollWidth <= element.clientWidth) return;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    element.scrollLeft += event.deltaY;
    event.preventDefault();
  };

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 px-2.5 py-1.5">
        <ColumnSelector
          columns={columns.map((column) => ({ key: column.key, label: column.label }))}
          onToggle={(column) => setVisibleColumns((current) => (current.includes(column) ? current.filter((item) => item !== column) : [...current, column]))}
          visibleColumns={visibleColumns}
        />
      </div>

      <div className="overflow-x-auto overflow-y-hidden" onWheel={handleWheel}>
        <table className="w-max min-w-full text-[10px] leading-[1.35]">
          <thead className="sticky top-0 bg-slate-100 text-left text-[10px] text-slate-500">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColumnMeta | undefined;

                  return (
                    <th
                      className={`px-2.5 py-1.5 font-semibold ${meta?.align === "center" ? "text-center" : meta?.align === "right" ? "text-right" : "text-left"}`}
                      key={header.id}
                      style={{ minWidth: `${meta?.minWidth || 120}px`, width: meta?.minWidth ? `${meta.minWidth}px` : undefined }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr className="border-t border-slate-100 hover:bg-emerald-50/40" key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                  const rawValue = cell.getValue();
                  const title = rawValue === null || rawValue === undefined ? undefined : getCellTitle(columns, cell.column.id, rawValue, row.original);

                  return (
                    <td
                      className={`px-2.5 py-1.5 align-top text-[10px] whitespace-nowrap ${meta?.align === "center" ? "text-center" : meta?.align === "right" ? "text-right" : "text-left"}`}
                      key={cell.id}
                      style={{ minWidth: `${meta?.minWidth || 120}px`, width: meta?.minWidth ? `${meta.minWidth}px` : undefined }}
                      title={title}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 bg-slate-50/70 px-2.5 py-1 text-[9px] text-slate-500">
        {translateText("Re chuot vao bang va lan chuot len/xuong de cuon ngang.")}
      </div>
    </div>
  );
}
