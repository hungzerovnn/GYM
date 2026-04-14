"use client";

import { translateText } from "@/lib/i18n/display";

type ChecklistItem = {
  value: string;
  label: string;
  description?: string;
  meta?: string;
  badges?: string[];
};

interface MultiChecklistFieldProps {
  label: string;
  items: ChecklistItem[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  emptyMessage?: string;
}

export function MultiChecklistField({
  label,
  items,
  value,
  onChange,
  error,
  emptyMessage = translateText("Chua co du lieu de lua chon."),
}: MultiChecklistFieldProps) {
  const selected = new Set(value);
  const allValues = items.map((item) => item.value);
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.value));

  const toggleItem = (target: string) => {
    if (selected.has(target)) {
      onChange(value.filter((item) => item !== target));
      return;
    }

    onChange([...value, target]);
  };

  return (
    <div className="field">
      <span>{label}</span>
      <div className="overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3">
          <div className="space-y-1">
            <p className="text-[12px] font-semibold text-slate-800">{translateText("Danh sach vai tro")}</p>
            <p className="text-[11px] text-slate-500">
              {translateText("Chon tat ca hoac tick tung vai tro de gan quyen cho nhan vien.")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-600">
              {`${translateText("Da chon")} ${value.length}/${items.length}`}
            </span>
            <button className="secondary-button !px-3 !py-2 text-[11px]" onClick={() => onChange(allValues)} type="button">
              {translateText("Chon tat ca")}
            </button>
            <button className="secondary-button !px-3 !py-2 text-[11px]" disabled={!value.length} onClick={() => onChange([])} type="button">
              {translateText("Bo chon")}
            </button>
          </div>
        </div>

        {items.length ? (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {items.map((item) => {
              const checked = selected.has(item.value);

              return (
                <label
                  className={`flex items-start cursor-pointer gap-3 rounded-2xl border px-4 py-3 transition ${
                    checked
                      ? "border-emerald-500 bg-emerald-50/80 shadow-[0_10px_30px_rgba(34,197,94,0.10)]"
                      : "border-slate-200 bg-slate-50/70 hover:border-emerald-300"
                  }`}
                  key={item.value}
                >
                  <input
                    checked={checked}
                    className="mt-1 h-4 w-4 shrink-0 self-start accent-emerald-600"
                    onChange={() => toggleItem(item.value)}
                    type="checkbox"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12px] font-semibold text-slate-900">{translateText(item.label)}</p>
                      {item.badges?.map((badge) => (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600" key={badge}>
                          {translateText(badge)}
                        </span>
                      ))}
                    </div>
                    {item.description ? <p className="text-[11px] text-slate-600">{translateText(item.description)}</p> : null}
                    {item.meta ? <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{translateText(item.meta)}</p> : null}
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-4 text-[11px] text-slate-500">{emptyMessage}</div>
        )}

        <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-[11px] text-slate-500">
          <input
            checked={allSelected}
            className="h-4 w-4 shrink-0 accent-emerald-600"
            onChange={() => onChange(allSelected ? [] : allValues)}
            type="checkbox"
          />
          <span>{translateText("Bat nhanh tat ca vai tro trong danh sach nay.")}</span>
        </div>
      </div>
      {error ? <small>{error}</small> : <small />}
    </div>
  );
}
