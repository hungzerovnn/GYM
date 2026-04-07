import { translateFieldLabel, translateText } from "@/lib/i18n/display";

interface ColumnSelectorProps {
  columns: Array<{ key: string; label?: string }>;
  visibleColumns: string[];
  onToggle: (column: string) => void;
}

export function ColumnSelector({ columns, visibleColumns, onToggle }: ColumnSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {columns.map((column) => {
        const active = visibleColumns.includes(column.key);
        return (
          <button
            className={`rounded-[0.48rem] border px-2 py-0.5 text-[9.5px] font-medium ${active ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}
            key={column.key}
            onClick={() => onToggle(column.key)}
            type="button"
          >
            {translateText(column.label || translateFieldLabel(column.key))}
          </button>
        );
      })}
    </div>
  );
}
