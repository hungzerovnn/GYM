"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { translateText } from "@/lib/i18n/display";

type ProductOption = {
  id: string;
  code: string;
  name: string;
  unit?: string | null;
  salePrice?: string | number | null;
  stockQuantity?: number | null;
};

type LineItemDraft = {
  key: string;
  productId: string;
  productCode: string;
  quantity: string;
  unitPrice: string;
  note: string;
};

interface ShopLineItemsFieldProps {
  branchId: string;
  error?: string;
  initialItems?: unknown;
  initialValue?: string;
  label: string;
  mode: "sale" | "return";
  onChange: (value: string) => void;
  resetKey: string;
}

const createRow = (partial?: Partial<LineItemDraft>): LineItemDraft => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  productId: "",
  productCode: "",
  quantity: "1",
  unitPrice: "",
  note: "",
  ...partial,
});

const asString = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const parseInitialRows = (initialItems?: unknown, initialValue?: string) => {
  if (Array.isArray(initialItems) && initialItems.length) {
    const rows = initialItems
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const record = item as Record<string, unknown>;
        return createRow({
          productId: asString(record.productId),
          productCode: asString(record.productCode),
          quantity: asString(record.quantity || "1"),
          unitPrice: asString(record.unitPrice),
          note: asString(record.note),
        });
      })
      .filter((item): item is LineItemDraft => Boolean(item));

    if (rows.length) {
      return rows;
    }
  }

  if (initialValue?.trim()) {
    const rows = initialValue
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [productCode = "", quantity = "1", unitPrice = "", note = ""] = line.split("|").map((part) => part.trim());
        return createRow({
          productCode,
          quantity: quantity || "1",
          unitPrice,
          note,
        });
      });

    if (rows.length) {
      return rows;
    }
  }

  return [createRow()];
};

const formatMoneyInput = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return String(value);
  }
  return amount.toString();
};

const getLineItemsResetSeed = (initialItems?: unknown, initialValue?: string) => {
  const itemsSeed = Array.isArray(initialItems) ? JSON.stringify(initialItems) : String(initialItems ?? "");
  return `${itemsSeed}:${initialValue || ""}`;
};

const resolveShopLineRow = (row: LineItemDraft, productsById: Map<string, ProductOption>, productsByCode: Map<string, ProductOption>) => {
  const matchedProduct =
    productsById.get(row.productId) || (row.productCode ? productsByCode.get(row.productCode.trim().toLowerCase()) : undefined);

  return {
    ...row,
    resolvedProduct: matchedProduct,
    resolvedProductCode: matchedProduct?.code || row.productCode.trim(),
    resolvedProductId: matchedProduct?.id || row.productId,
    resolvedUnitPrice: row.unitPrice || formatMoneyInput(matchedProduct?.salePrice),
  };
};

function ShopLineItemsFieldInner({
  branchId,
  error,
  initialItems,
  initialValue,
  label,
  mode,
  onChange,
}: ShopLineItemsFieldProps) {
  const [rows, setRows] = useState<LineItemDraft[]>(() => parseInitialRows(initialItems, initialValue));
  const emitChange = useEffectEvent((value: string) => {
    onChange(value);
  });

  const productsQuery = useQuery({
    queryKey: ["shop-line-products", branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const response = await api.get("/products", {
        params: {
          branchId,
          pageSize: 100,
          status: "ACTIVE",
          sortBy: "name",
          sortOrder: "asc",
        },
      });
      return (response.data.data || response.data || []) as ProductOption[];
    },
  });

  const products = useMemo(() => (Array.isArray(productsQuery.data) ? productsQuery.data : []), [productsQuery.data]);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const productsByCode = useMemo(
    () => new Map(products.map((product) => [product.code.trim().toLowerCase(), product])),
    [products],
  );
  const resolvedRows = useMemo(
    () => rows.map((row) => resolveShopLineRow(row, productsById, productsByCode)),
    [productsByCode, productsById, rows],
  );

  const serializedValue = useMemo(
    () =>
      resolvedRows
        .map((row) => {
          const productCode = row.resolvedProductCode;
          const quantity = Number(row.quantity);
          const unitPrice = row.resolvedUnitPrice.trim();

          if (!productCode || !Number.isFinite(quantity) || quantity <= 0 || !unitPrice) {
            return null;
          }

          return [productCode, quantity, unitPrice, row.note.trim()].filter(Boolean).join(" | ");
        })
        .filter(Boolean)
        .join("\n"),
    [resolvedRows],
  );

  useEffect(() => {
    emitChange(serializedValue);
  }, [serializedValue]);

  const summary = useMemo(
    () =>
      resolvedRows.reduce(
        (accumulator, row) => {
          const quantity = Number(row.quantity);
          const unitPrice = Number(row.resolvedUnitPrice);

          if (!row.resolvedProductId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
            return accumulator;
          }

          return {
            itemCount: accumulator.itemCount + 1,
            totalQuantity: accumulator.totalQuantity + quantity,
            totalAmount: accumulator.totalAmount + quantity * unitPrice,
          };
        },
        { itemCount: 0, totalQuantity: 0, totalAmount: 0 },
      ),
    [resolvedRows],
  );

  const updateRow = (key: string, patch: Partial<LineItemDraft>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeRow = (key: string) => {
    setRows((current) => {
      if (current.length === 1) {
        return [createRow()];
      }
      return current.filter((row) => row.key !== key);
    });
  };

  return (
    <div className="field">
      <span>{translateText(label)}</span>
      <div className="overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3">
          <div className="space-y-1">
            <p className="text-[12px] font-semibold text-slate-800">{translateText("Chon san pham theo dong")}</p>
            <p className="text-[11px] text-slate-500">
              {translateText("Chon san pham, so luong, don gia. He thong se tu dong sinh `lineItemsText` de gui len API.")}
            </p>
          </div>
          <button className="secondary-button !px-3 !py-2 text-[11px]" disabled={!branchId} onClick={() => setRows((current) => [...current, createRow()])} type="button">
            <Plus className="h-3.5 w-3.5" />
            {translateText("Them dong")}
          </button>
        </div>

        {!branchId ? (
          <div className="px-4 py-4 text-[11px] text-amber-700">{translateText("Chon chi nhanh truoc de tai danh sach san pham.")}</div>
        ) : productsQuery.isLoading ? (
          <div className="px-4 py-4 text-[11px] text-slate-500">{translateText("Dang tai danh sach san pham...")}</div>
        ) : productsQuery.isError ? (
          <div className="px-4 py-4 text-[11px] text-rose-600">{translateText("Khong tai duoc danh sach san pham cho chi nhanh nay.")}</div>
        ) : (
          <div className="space-y-3 p-4">
            {resolvedRows.map((row, index) => {
              const selectedProduct = row.resolvedProduct;
              const quantity = Number(row.quantity);
              const unitPrice = Number(row.resolvedUnitPrice);
              const lineTotal = Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0;
              const stockQuantity = Number(selectedProduct?.stockQuantity || 0);
              const hasStockWarning = mode === "sale" && selectedProduct && Number.isFinite(quantity) && quantity > stockQuantity;

              return (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/65 p-3" key={row.key}>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_110px_150px_150px_auto]">
                    <label className="field">
                      <span>{`${translateText("San pham")} #${index + 1}`}</span>
                      <select
                        onChange={(event) => {
                          const product = productsById.get(event.target.value);
                          updateRow(row.key, {
                            productId: event.target.value,
                            productCode: product?.code || "",
                            unitPrice: product ? formatMoneyInput(product.salePrice) : "",
                          });
                        }}
                        value={row.resolvedProductId}
                      >
                        <option value="">{translateText("Chon san pham")}</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {`${product.code} | ${product.name}`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>{translateText("So luong")}</span>
                      <input
                        min="1"
                        onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                        step="1"
                        type="number"
                        value={row.quantity}
                      />
                    </label>

                    <label className="field">
                      <span>{translateText("Don gia")}</span>
                      <input
                        min="0"
                        onChange={(event) => updateRow(row.key, { unitPrice: event.target.value })}
                        step="any"
                        type="number"
                        value={row.unitPrice || row.resolvedUnitPrice}
                      />
                    </label>

                    <label className="field">
                      <span>{translateText("Thanh tien")}</span>
                      <input readOnly type="text" value={lineTotal ? formatNumber(lineTotal) : ""} />
                    </label>

                    <div className="flex items-end">
                      <button
                        className="secondary-button !rounded-full !px-3 !py-2 text-rose-600"
                        onClick={() => removeRow(row.key)}
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <label className="field mt-3">
                    <span>{translateText("Ghi chu dong hang")}</span>
                    <input onChange={(event) => updateRow(row.key, { note: event.target.value })} placeholder={translateText("Vi du: combo ban quay, doi mau, khuyen mai...")} type="text" value={row.note} />
                  </label>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-white px-2.5 py-1 text-slate-600">
                      {translateText("Ma SP")}: {selectedProduct?.code || row.resolvedProductCode || "--"}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-slate-600">{translateText("Don vi")}: {selectedProduct?.unit || "--"}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-slate-600">{translateText("Ton kho")}: {selectedProduct ? formatNumber(stockQuantity) : "--"}</span>
                    {hasStockWarning ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">{translateText("So luong vuot ton kho hien tai")}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-[11px] text-slate-600">
          <span className="rounded-full bg-white px-2.5 py-1">{translateText("Dong hop le")}: {summary.itemCount}</span>
          <span className="rounded-full bg-white px-2.5 py-1">{translateText("Tong SL")}: {formatNumber(summary.totalQuantity)}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
            {translateText("Tam tinh")}: {formatNumber(summary.totalAmount)}
          </span>
          <span className="text-slate-500">{translateText("Neu de trong truong tong tien, backend se tu dong lay so tam tinh nay.")}</span>
        </div>
      </div>
      {error ? <small>{error}</small> : <small />}
    </div>
  );
}

export function ShopLineItemsField(props: ShopLineItemsFieldProps) {
  return (
    <ShopLineItemsFieldInner key={`${props.branchId}:${props.resetKey}:${getLineItemsResetSeed(props.initialItems, props.initialValue)}`} {...props} />
  );
}
