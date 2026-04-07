import { translateText } from "@/lib/i18n/display";

interface TimelineProps {
  items?: Array<{ content?: string; result?: string; contactAt?: string; action?: string; note?: string; createdAt?: string }>;
}

export function Timeline({ items = [] }: TimelineProps) {
  if (!items.length) {
    return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">{translateText("No timeline entries")}</div>;
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div className="relative rounded-2xl border border-slate-200 bg-white p-4" key={index}>
          <p className="text-sm font-semibold text-slate-900">{item.action || item.content || translateText("Timeline item")}</p>
          <p className="mt-1 text-sm text-slate-500">{item.result || item.note}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">{item.contactAt || item.createdAt}</p>
        </div>
      ))}
    </div>
  );
}
