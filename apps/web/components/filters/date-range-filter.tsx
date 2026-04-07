import { translateText } from "@/lib/i18n/display";

interface DateRangeFilterProps {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
}

export function DateRangeFilter({ from, to, onChange }: DateRangeFilterProps) {
  return (
    <div className="grid gap-2">
      <label className="field">
        <span>{translateText("From")}</span>
        <input onChange={(event) => onChange({ from: event.target.value, to })} type="date" value={from} />
      </label>
      <label className="field">
        <span>{translateText("To")}</span>
        <input onChange={(event) => onChange({ from, to: event.target.value })} type="date" value={to} />
      </label>
    </div>
  );
}
