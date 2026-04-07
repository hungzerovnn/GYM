import { StatusBadge } from "./status-badge";
import { formatDateTime } from "@/lib/format";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";

export function AuditLogTable({ rows = [] as Array<Record<string, unknown>> }) {
  if (!rows.length) {
    return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">{translateText("No audit logs")}</div>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-3">{translateText("Module")}</th>
            <th className="px-4 py-3">{translateText("Action")}</th>
            <th className="px-4 py-3">{translateText("Entity")}</th>
            <th className="px-4 py-3">{translateText("Time")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t border-slate-100" key={index}>
              <td className="px-4 py-3">{resolveTextDisplay(row.module, "module", row)}</td>
              <td className="px-4 py-3">
                <StatusBadge value={String(row.action || "-")} />
              </td>
              <td className="px-4 py-3">{resolveTextDisplay(row.entityType, "entityType", row)}</td>
              <td className="px-4 py-3">{formatDateTime(String(row.createdAt || ""))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
