"use client";

import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { api, ListResponse } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/format";
import { resolveTextDisplay, translateText } from "@/lib/i18n/display";

const contractConversionSchema = z.object({
  newContractId: z.string().min(1, translateText("Hop dong moi la bat buoc")),
  conversionType: z.string().min(1, translateText("Loai chuyen doi la bat buoc")),
  differenceAmount: z.string().optional(),
  convertedSessions: z.string().optional(),
  remainingValueRule: z.string().optional(),
  note: z.string().optional(),
});

type ContractConversionValues = z.infer<typeof contractConversionSchema>;

interface ContractConversionDialogProps {
  open: boolean;
  contract: Record<string, unknown> | null;
  onClose: () => void;
  onSuccess?: () => Promise<void> | void;
  defaultConversionType?: string;
}

const conversionTypeOptions = [
  { label: "Nang cap goi", value: "upgrade" },
  { label: "Gia han / tiep noi", value: "renewal" },
  { label: "Chuyen doi khac", value: "conversion" },
];

const remainingValueRuleOptions = [
  { label: "Theo so buoi con lai", value: "pro_rata_by_sessions" },
  { label: "Theo so ngay con lai", value: "pro_rata_by_days" },
  { label: "Giu nguyen gia tri", value: "carry_over" },
  { label: "Nhap tay / khac", value: "manual" },
];

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export function ContractConversionDialog({
  open,
  contract,
  onClose,
  onSuccess,
  defaultConversionType = "conversion",
}: ContractConversionDialogProps) {
  const queryClient = useQueryClient();
  const contractId = String(contract?.id || "");
  const branchId = String(contract?.branchId || "");
  const customerId = String(contract?.customerId || "");
  const currentRemainingSessions = Math.max(Number(contract?.remainingSessions || 0), 0);
  const currentRemainingValue = Number(contract?.remainingValue || 0);

  const form = useForm<ContractConversionValues>({
    resolver: zodResolver(contractConversionSchema),
    defaultValues: {
      newContractId: "",
      conversionType: defaultConversionType,
      differenceAmount: "",
      convertedSessions: "0",
      remainingValueRule: "",
      note: "",
    },
  });

  const selectedNewContractId = String(form.watch("newContractId") || "");

  const candidateContractsQuery = useQuery({
    queryKey: ["contract-conversion-targets", branchId, customerId, contractId],
    enabled: open && Boolean(branchId && customerId && contractId),
    queryFn: async () => {
      const response = await api.get<ListResponse<Record<string, unknown>>>("/contracts", {
        params: {
          branchId,
          customerId,
          pageSize: 100,
        },
      });
      return (response.data.data || []).filter((item) => {
        const itemId = String(item.id || "");
        const status = String(item.status || "").toUpperCase();
        return itemId && itemId !== contractId && !["CANCELLED", "CLOSED"].includes(status);
      });
    },
  });

  const candidateContracts = candidateContractsQuery.data || [];
  const selectedNewContract = useMemo(
    () => candidateContracts.find((item) => String(item.id || "") === selectedNewContractId) || null,
    [candidateContracts, selectedNewContractId],
  );
  const suggestedDifferenceAmount = useMemo(() => {
    if (!selectedNewContract) return 0;
    return Number(selectedNewContract.totalAmount || 0) - currentRemainingValue;
  }, [currentRemainingValue, selectedNewContract]);

  useEffect(() => {
    if (!open) return;

    form.reset({
      newContractId: "",
      conversionType: defaultConversionType,
      differenceAmount: "",
      convertedSessions: String(currentRemainingSessions),
      remainingValueRule: String(contract?.remainingValueRule || ""),
      note: "",
    });
  }, [contract?.remainingValueRule, currentRemainingSessions, defaultConversionType, form, open]);

  useEffect(() => {
    if (!open || !candidateContracts.length) return;

    if (!selectedNewContractId) {
      form.setValue("newContractId", String(candidateContracts[0].id || ""), {
        shouldDirty: false,
        shouldValidate: true,
      });
    }
  }, [candidateContracts, form, open, selectedNewContractId]);

  useEffect(() => {
    if (!open || !selectedNewContract) return;

    const selectedServicePackage = asRecord(selectedNewContract.servicePackage);
    const nextRule = String(selectedNewContract.remainingValueRule || selectedServicePackage.remainingValueRule || "").trim();
    if (nextRule && !String(form.getValues("remainingValueRule") || "").trim()) {
      form.setValue("remainingValueRule", nextRule, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }

    const currentDifferenceAmount = String(form.getValues("differenceAmount") || "").trim();
    if (!currentDifferenceAmount) {
      form.setValue("differenceAmount", String(suggestedDifferenceAmount), {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [form, open, selectedNewContract, suggestedDifferenceAmount]);

  const mutation = useMutation({
    mutationFn: async (values: ContractConversionValues) => {
      const payload: Record<string, unknown> = {
        newContractId: values.newContractId,
        conversionType: values.conversionType,
        differenceAmount: String(values.differenceAmount || "").trim() || undefined,
        convertedSessions: String(values.convertedSessions || "").trim()
          ? Number(values.convertedSessions)
          : undefined,
        remainingValueRule: String(values.remainingValueRule || "").trim() || undefined,
        note: String(values.note || "").trim() || undefined,
      };
      return api.post(`/contracts/${contractId}/convert`, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["resource-detail"] }),
      ]);
      await onSuccess?.();
      toast.success(translateText("Da ghi nhan chuyen doi hop dong."));
      onClose();
    },
  });

  if (!open || !contract) return null;

  const mutationError =
    mutation.error && typeof mutation.error === "object" && "response" in mutation.error
      ? String((mutation.error as { response?: { data?: { message?: string } } }).response?.data?.message || translateText("Khong tao duoc chuyen doi hop dong."))
      : mutation.error instanceof Error && mutation.error.message
        ? mutation.error.message
        : null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 p-3">
      <div className="card w-full max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-700">{translateText("Dieu chinh hop dong")}</p>
            <h3 className="mt-1 text-[15px] font-bold text-slate-900">{translateText("Chuyen doi hop dong")}</h3>
          </div>
          <button className="secondary-button !rounded-[0.6rem] !p-2" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="space-y-3 px-4 py-4"
          onSubmit={form.handleSubmit(async (values) => {
            await mutation.mutateAsync(values);
          })}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[0.75rem] border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{translateText("Hop dong goc")}</div>
              <div className="mt-1 font-semibold text-slate-900">{String(contract.code || "-")}</div>
              <div className="mt-1">{String(contract.servicePackageName || contract.packageName || "-")}</div>
              <div className="mt-1">{`${translateText("Buoi con lai")}: ${currentRemainingSessions}`}</div>
              <div className="mt-1">{`${translateText("Gia tri con lai")}: ${formatCurrency(currentRemainingValue)}`}</div>
            </div>
            <div className="rounded-[0.75rem] border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{translateText("Hop dong moi")}</div>
              <div className="mt-1 font-semibold text-slate-900">{String(selectedNewContract?.code || "-")}</div>
              <div className="mt-1">{String(selectedNewContract?.servicePackageName || selectedNewContract?.packageName || "-")}</div>
              <div className="mt-1">{`${translateText("Trang thai")}: ${resolveTextDisplay(selectedNewContract?.status || "-", "status", selectedNewContract || {})}`}</div>
              <div className="mt-1">{`${translateText("Goi y chenh lech")}: ${formatCurrency(suggestedDifferenceAmount)}`}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="field">
              <span>{translateText("Hop dong moi")}</span>
              <select {...form.register("newContractId")}>
                <option value="">{translateText("Select")}</option>
                {candidateContracts.map((item) => (
                  <option key={String(item.id || "")} value={String(item.id || "")}>
                    {[String(item.code || ""), String(item.servicePackageName || item.packageName || ""), resolveTextDisplay(item.status, "status", item)]
                      .filter(Boolean)
                      .join(" | ")}
                  </option>
                ))}
              </select>
              {candidateContractsQuery.isLoading ? <small>{translateText("Dang tai hop dong de nhan...")}</small> : null}
              {!candidateContractsQuery.isLoading && !candidateContracts.length ? (
                <small>{translateText("Chua co hop dong moi cung hoi vien de lien ket. Hay tao hop dong moi truoc, sau do quay lai chuyen doi.")}</small>
              ) : form.formState.errors.newContractId ? (
                <small>{form.formState.errors.newContractId.message}</small>
              ) : null}
            </label>

            <label className="field">
              <span>{translateText("Loai chuyen doi")}</span>
              <select {...form.register("conversionType")}>
                {conversionTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {translateText(option.label)}
                  </option>
                ))}
              </select>
              {form.formState.errors.conversionType ? <small>{form.formState.errors.conversionType.message}</small> : null}
            </label>

            <label className="field">
              <span>{translateText("So buoi quy doi")}</span>
              <input {...form.register("convertedSessions")} min="0" step="1" type="number" />
              <small>{translateText("Mac dinh lay so buoi con lai cua hop dong goc.")}</small>
            </label>

            <label className="field">
              <span>{translateText("Chenh lech can thu / tra")}</span>
              <input {...form.register("differenceAmount")} step="any" type="number" />
              <small>{translateText("So duong = can thu them, so am = can hoan / tru lai.")}</small>
            </label>

            <label className="field">
              <span>{translateText("Rule gia tri con lai")}</span>
              <select {...form.register("remainingValueRule")}>
                <option value="">{translateText("Select")}</option>
                {remainingValueRuleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {translateText(option.label)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{translateText("Ghi chu")}</span>
              <input {...form.register("note")} placeholder={translateText("Ghi chu dieu chinh / quy doi")} type="text" />
            </label>
          </div>

          {mutationError ? (
            <div className="rounded-[0.75rem] border border-rose-200 bg-rose-50 px-3 py-2.5 text-[11px] text-rose-700">{mutationError}</div>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
            <button className="secondary-button" onClick={onClose} type="button">
              {translateText("Cancel")}
            </button>
            <button
              className={cn("primary-button", !candidateContracts.length ? "cursor-not-allowed opacity-60" : "")}
              disabled={mutation.isPending || !candidateContracts.length}
              type="submit"
            >
              {mutation.isPending ? translateText("Dang ghi nhan...") : translateText("Xac nhan chuyen doi")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
