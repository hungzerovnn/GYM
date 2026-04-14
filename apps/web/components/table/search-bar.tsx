import { translateText } from "@/lib/i18n/display";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <input
      className="portal-search"
      onChange={(event) => onChange(event.target.value)}
      placeholder={translateText(placeholder || "Search...")}
      value={value}
    />
  );
}
