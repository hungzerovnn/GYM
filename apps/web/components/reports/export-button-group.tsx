import { translateText } from "@/lib/i18n/display";

interface ExportButtonGroupProps {
  onExport: (format: "csv" | "xlsx" | "pdf") => void;
  onPrint?: () => void;
}

export function ExportButtonGroup({ onExport, onPrint }: ExportButtonGroupProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className="secondary-button" onClick={() => onExport("csv")} type="button">
        {translateText("Export CSV")}
      </button>
      <button className="secondary-button" onClick={() => onExport("xlsx")} type="button">
        {translateText("Export Excel")}
      </button>
      <button className="secondary-button" onClick={() => onExport("pdf")} type="button">
        {translateText("Export PDF")}
      </button>
      {onPrint ? (
        <button className="secondary-button" onClick={onPrint} type="button">
          {translateText("Print")}
        </button>
      ) : null}
    </div>
  );
}
