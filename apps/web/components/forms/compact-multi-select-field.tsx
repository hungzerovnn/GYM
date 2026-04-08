"use client";

import { useMemo, useState } from "react";
import { translateText } from "@/lib/i18n/display";

type CompactMultiSelectItem = {
  value: string;
  label: string;
  description?: string;
  meta?: string;
};

interface CompactMultiSelectFieldProps {
  label: string;
  items: CompactMultiSelectItem[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  helperText?: string;
  selectAllLabel?: string;
  clearLabel?: string;
}

export function CompactMultiSelectField({
  label,
  items,
  value,
  onChange,
  error,
  emptyMessage = translateText("Chưa có dữ liệu để lựa chọn."),
  searchPlaceholder = translateText("Nhập từ khóa cần tìm"),
  helperText,
  selectAllLabel = translateText("Chọn tất cả"),
  clearLabel = translateText("Bỏ chọn"),
}: CompactMultiSelectFieldProps) {
  const [search, setSearch] = useState("");
  const selected = new Set(value);
  const allValues = items.map((item) => item.value);
  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return items;
    }

    return items.filter((item) => {
      const haystacks = [item.label, item.description, item.meta]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystacks.includes(keyword);
    });
  }, [items, search]);

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
      <div className="overflow-hidden rounded-[1rem] border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="text-[11px] text-slate-500">
            {helperText || translateText("Chọn nhanh danh sách bên dưới hoặc bấm Chọn tất cả.")}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-600">
              {`${translateText("Đã chọn")} ${value.length}/${items.length}`}
            </span>
            <button className="secondary-button !px-3 !py-1.5 text-[11px]" onClick={() => onChange(allValues)} type="button">
              {selectAllLabel}
            </button>
            <button className="secondary-button !px-3 !py-1.5 text-[11px]" disabled={!value.length} onClick={() => onChange([])} type="button">
              {clearLabel}
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-3 py-2">
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            type="text"
            value={search}
          />
        </div>

        {filteredItems.length ? (
          <div className="max-h-56 overflow-y-auto">
            {filteredItems.map((item) => {
              const checked = selected.has(item.value);

              return (
                <label
                  className={`flex cursor-pointer gap-3 border-b border-slate-100 px-3 py-2.5 transition last:border-b-0 ${
                    checked ? "bg-emerald-50/80" : "bg-white hover:bg-slate-50"
                  }`}
                  key={item.value}
                >
                  <input
                    checked={checked}
                    className="mt-0.5 h-4 w-4 accent-emerald-600"
                    onChange={() => toggleItem(item.value)}
                    type="checkbox"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-slate-800">{translateText(item.label)}</div>
                    {item.description ? <div className="text-[11px] text-slate-500">{translateText(item.description)}</div> : null}
                    {item.meta ? <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{translateText(item.meta)}</div> : null}
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="px-3 py-4 text-[11px] text-slate-500">{emptyMessage}</div>
        )}
      </div>
      {error ? <small>{error}</small> : <small />}
    </div>
  );
}
