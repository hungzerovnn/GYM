"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import { z } from "zod";
import { translateText } from "@/lib/i18n/display";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, translateText("Mat khau phai co it nhat 8 ky tu.")),
    confirmPassword: z.string().min(1, translateText("Xac nhan mat khau la bat buoc")),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: translateText("Mat khau xac nhan khong khop."),
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  isPending?: boolean;
  errorMessage?: string | null;
  username?: string;
  fullName?: string;
}

export function ResetPasswordDialog({
  open,
  onClose,
  onSubmit,
  isPending = false,
  errorMessage,
  username,
  fullName,
}: ResetPasswordDialogProps) {
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        password: "",
        confirmPassword: "",
      });
    }
  }, [form, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/35 p-3">
      <div className="card w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">{translateText("User Action")}</p>
            <h3 className="mt-1 text-[15px] font-bold text-slate-900">{translateText("Reset mat khau")}</h3>
          </div>
          <button className="secondary-button !rounded-[0.6rem] !p-2" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="space-y-3 px-4 py-4"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(values.password);
          })}
        >
          <div className="rounded-[0.75rem] border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
            <div className="font-medium text-slate-900">{fullName || username || "-"}</div>
            <div className="mt-1 text-[12px] text-slate-500">{username ? `@${username}` : translateText("Tai khoan he thong")}</div>
          </div>

          <label className="field">
            <span>{translateText("Mat khau moi")}</span>
            <input {...form.register("password")} placeholder={translateText("Nhap mat khau moi")} type="password" />
            {form.formState.errors.password ? <small>{form.formState.errors.password.message}</small> : null}
          </label>

          <label className="field">
            <span>{translateText("Xac nhan mat khau")}</span>
            <input {...form.register("confirmPassword")} placeholder={translateText("Nhap lai mat khau moi")} type="password" />
            {form.formState.errors.confirmPassword ? <small>{form.formState.errors.confirmPassword.message}</small> : null}
          </label>

          {errorMessage ? (
            <div className="rounded-[0.75rem] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] text-rose-700">{errorMessage}</div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button className="secondary-button" onClick={onClose} type="button">
              {translateText("Cancel")}
            </button>
            <button className="primary-button" disabled={isPending} type="submit">
              {isPending ? translateText("Dang cap nhat...") : translateText("Cap nhat mat khau")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
