import { formatCurrency, formatNumber } from "@/lib/format";
import { translateText } from "@/lib/i18n/display";

interface KPIStatCardProps {
  label: string;
  value: number;
  type?: "currency" | "number";
}

export function KPIStatCard({ label, value, type = "number" }: KPIStatCardProps) {
  return (
    <div className="card p-3">
      <p className="text-[11px] text-slate-500">{translateText(label)}</p>
      <h3 className="mt-1.5 text-[14px] font-bold text-slate-900">{type === "currency" ? formatCurrency(value) : formatNumber(value)}</h3>
    </div>
  );
}
