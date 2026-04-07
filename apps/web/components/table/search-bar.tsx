import { translateText } from "@/lib/i18n/display";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <input
      className="h-8 w-full rounded-[0.62rem] border border-slate-200 bg-white px-3 text-[11px] outline-none ring-0 transition focus:border-emerald-400"
      onChange={(event) => onChange(event.target.value)}
      placeholder={translateText(placeholder || "Search...")}
      value={value}
    />
  );
}
