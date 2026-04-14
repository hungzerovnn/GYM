"use client";

"use client";

import { translateText } from "@/lib/i18n/display";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, description, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-3">
      <div className="portal-panel w-full max-w-md">
        <h3 className="panel-title">{translateText(title)}</h3>
        <p className="panel-description mt-2">{translateText(description)}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="secondary-button" onClick={onCancel} type="button">
            {translateText("Cancel")}
          </button>
          <button className="primary-button" onClick={onConfirm} type="button">
            {translateText("Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
