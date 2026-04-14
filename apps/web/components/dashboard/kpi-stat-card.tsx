import { formatCurrency, formatNumber } from "@/lib/format";
import { translateText } from "@/lib/i18n/display";

interface KPIStatCardProps {
  label: string;
  value: number;
  type?: "currency" | "number";
}

export function KPIStatCard({ label, value, type = "number" }: KPIStatCardProps) {
  return (
    <div className="portal-panel portal-panel-compact">
      <p className="stat-label">{translateText(label)}</p>
      <h3 className="stat-value mt-1.5">{type === "currency" ? formatCurrency(value) : formatNumber(value)}</h3>
    </div>
  );
}
