"use client";

interface UploadBoxProps {
  onChange: (file: File | null) => void;
}

export function UploadBox({ onChange }: UploadBoxProps) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
      <span>Upload attachment</span>
      <input className="hidden" onChange={(event) => onChange(event.target.files?.[0] || null)} type="file" />
      <span className="secondary-button">Choose file</span>
    </label>
  );
}
