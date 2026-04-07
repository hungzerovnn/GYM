import { translateText } from "@/lib/i18n/display";

interface AttachmentListProps {
  items?: Array<{ id?: string; fileName?: string; fileUrl?: string }>;
}

export function AttachmentList({ items = [] }: AttachmentListProps) {
  if (!items.length) {
    return <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">{translateText("No attachments")}</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <a className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-emerald-700 hover:bg-emerald-50" href={item.fileUrl} key={item.id || index} target="_blank">
          {item.fileName || item.fileUrl}
        </a>
      ))}
    </div>
  );
}
