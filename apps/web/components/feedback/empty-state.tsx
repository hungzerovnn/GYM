"use client";

import { translateText } from "@/lib/i18n/display";

interface EmptyStateProps {
  title: string;
  description: string;
  examples?: string[];
}

export function EmptyState({ title, description, examples = [] }: EmptyStateProps) {
  return (
    <div className="portal-panel flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
      <div className="portal-chip-accent">
        {translateText("Empty State")}
      </div>
      <h2 className="panel-title">{translateText(title)}</h2>
      <p className="panel-description max-w-xl">{translateText(description)}</p>
      {examples.length ? (
        <div className="w-full max-w-2xl rounded-[1rem] border border-emerald-100 bg-emerald-50/70 p-4 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
            {translateText("Vi du nhap nhanh")}
          </p>
          <div className="mt-2 space-y-1.5 text-sm text-slate-700">
            {examples.map((example) => (
              <p key={example} className="rounded-[0.7rem] bg-white/80 px-3 py-2 font-mono text-[12px] leading-5 text-slate-700">
                {translateText(example)}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
