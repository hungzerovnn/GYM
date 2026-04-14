import { StatusBadge } from "./status-badge";
import { formatDateTime } from "@/lib/format";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";

export function AuditLogTable({ rows = [] as Array<Record<string, unknown>> }) {
  if (!rows.length) {
    return <div className="portal-empty">{translateText("No audit logs")}</div>;
  }

  return (
    <div className="portal-table">
      <table>
        <thead className="text-left">
          <tr>
            <th>{translateText("Module")}</th>
            <th>{translateText("Action")}</th>
            <th>{translateText("Entity")}</th>
            <th>{translateText("Time")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t border-slate-100" key={index}>
              <td>{resolveTextDisplay(row.module, "module", row)}</td>
              <td>
                <StatusBadge value={String(row.action || "-")} />
              </td>
              <td>{resolveTextDisplay(row.entityType, "entityType", row)}</td>
              <td>{formatDateTime(String(row.createdAt || ""))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
