import { translateText } from "@/lib/i18n/display";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="page-eyebrow">{translateText("Enterprise Module")}</p>
        <h1 className="page-title">{translateText(title)}</h1>
        <p className="page-subtitle max-w-4xl">{translateText(subtitle)}</p>
      </div>
      {actions}
    </div>
  );
}
