"use client";

import { translateText } from "@/lib/i18n/display";

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="card flex min-h-[220px] flex-col items-center justify-center gap-2.5 px-5 py-10 text-center">
      <div className="rounded-[0.65rem] bg-emerald-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
        {translateText("Empty State")}
      </div>
      <h2 className="text-[18px] font-semibold text-slate-900">{translateText(title)}</h2>
      <p className="max-w-xl text-[12px] text-slate-500">{translateText(description)}</p>
    </div>
  );
}
