"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import {
  REPORT_DESIGNER_FONT_OPTIONS,
  ReportDesignerElement,
  ReportDesignerFieldSource,
  ReportDesignerLayout,
} from "@/lib/report-designer";
import { translateText } from "@/lib/i18n/display";

const inputClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] outline-none transition focus:border-emerald-400";
const textareaClass = "min-h-[84px] w-full rounded-md border border-slate-200 px-3 py-2 text-[12px] outline-none transition focus:border-emerald-400";
const DEFAULT_SELECTION_SYNC_DELAY_MS = 220;

export type ReportTemplateDesignerInspectorAlignDirection =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

export interface ReportTemplateDesignerInspectorHandle {
  syncSelection: (nextId: string | null, options?: { immediate?: boolean }) => void;
}

interface ReportTemplateDesignerInspectorProps {
  getDesigner: () => ReportDesignerLayout;
  fieldSources: ReportDesignerFieldSource[];
  inspectorShouldSyncImmediately?: boolean;
  selectionSyncDelayMs?: number;
  onPatchElement: (elementId: string, patch: Partial<ReportDesignerElement>) => void;
  onAlignSelected: (direction: ReportTemplateDesignerInspectorAlignDirection) => void;
}

export const ReportTemplateDesignerInspector = forwardRef<
  ReportTemplateDesignerInspectorHandle,
  ReportTemplateDesignerInspectorProps
>(function ReportTemplateDesignerInspector(
  {
    getDesigner,
    fieldSources,
    inspectorShouldSyncImmediately = false,
    selectionSyncDelayMs = DEFAULT_SELECTION_SYNC_DELAY_MS,
    onPatchElement,
    onAlignSelected,
  },
  ref,
) {
  const getDesignerRef = useRef(getDesigner);
  const selectedElementIdRef = useRef<string | null>(getDesigner().elements[0]?.id || null);
  const selectionSyncTimeoutRef = useRef<number | null>(null);

  const emptyStateRef = useRef<HTMLParagraphElement | null>(null);
  const fieldsPanelRef = useRef<HTMLDivElement | null>(null);
  const alignButtonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const typeInputRef = useRef<HTMLInputElement | null>(null);
  const sourceSelectRef = useRef<HTMLSelectElement | null>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const xInputRef = useRef<HTMLInputElement | null>(null);
  const yInputRef = useRef<HTMLInputElement | null>(null);
  const wInputRef = useRef<HTMLInputElement | null>(null);
  const hInputRef = useRef<HTMLInputElement | null>(null);
  const fontSizeInputRef = useRef<HTMLInputElement | null>(null);
  const fontWeightSelectRef = useRef<HTMLSelectElement | null>(null);
  const fontFamilySelectRef = useRef<HTMLSelectElement | null>(null);
  const alignSelectRef = useRef<HTMLSelectElement | null>(null);

  const sourceRowRef = useRef<HTMLLabelElement | null>(null);
  const contentRowRef = useRef<HTMLLabelElement | null>(null);
  const fontSizeRowRef = useRef<HTMLLabelElement | null>(null);
  const fontFamilyRowRef = useRef<HTMLLabelElement | null>(null);
  const fontWeightRowRef = useRef<HTMLLabelElement | null>(null);
  const alignRowRef = useRef<HTMLLabelElement | null>(null);
  const typographyPanelRef = useRef<HTMLDivElement | null>(null);

  const getSelectedElement = () => {
    const selectedElementId = selectedElementIdRef.current;
    if (!selectedElementId) return null;
    return getDesignerRef.current().elements.find((element) => element.id === selectedElementId) || null;
  };

  const ensureValidSelection = () => {
    const selectedElementId = selectedElementIdRef.current;
    if (!selectedElementId) return null;
    const designer = getDesignerRef.current();
    if (designer.elements.some((element) => element.id === selectedElementId)) {
      return selectedElementId;
    }
    const fallbackId = designer.elements[0]?.id || null;
    selectedElementIdRef.current = fallbackId;
    return fallbackId;
  };

  const setFormDisabled = (disabled: boolean) => {
    [
      labelInputRef.current,
      typeInputRef.current,
      sourceSelectRef.current,
      contentTextareaRef.current,
      xInputRef.current,
      yInputRef.current,
      wInputRef.current,
      hInputRef.current,
      fontSizeInputRef.current,
      fontWeightSelectRef.current,
      fontFamilySelectRef.current,
      alignSelectRef.current,
    ].forEach((input) => {
      if (input) {
        input.disabled = disabled;
      }
    });

    alignButtonsRef.current.forEach((button) => {
      if (button) {
        button.disabled = disabled;
      }
    });
  };

  const refreshInspector = () => {
    ensureValidSelection();
    const selectedElement = getSelectedElement();
    const hasSelection = !!selectedElement;

    if (emptyStateRef.current) {
      emptyStateRef.current.hidden = hasSelection;
    }
    if (fieldsPanelRef.current) {
      fieldsPanelRef.current.hidden = !hasSelection;
    }

    if (!selectedElement) {
      setFormDisabled(true);
      return;
    }

    setFormDisabled(false);

    if (labelInputRef.current) labelInputRef.current.value = selectedElement.label;
    if (typeInputRef.current) typeInputRef.current.value = selectedElement.type;
    if (sourceSelectRef.current) sourceSelectRef.current.value = selectedElement.source;
    if (contentTextareaRef.current) contentTextareaRef.current.value = selectedElement.content;
    if (xInputRef.current) xInputRef.current.value = String(selectedElement.x);
    if (yInputRef.current) yInputRef.current.value = String(selectedElement.y);
    if (wInputRef.current) wInputRef.current.value = String(selectedElement.w);
    if (hInputRef.current) hInputRef.current.value = String(selectedElement.h);
    if (fontSizeInputRef.current) fontSizeInputRef.current.value = String(selectedElement.fontSize);
    if (fontWeightSelectRef.current) fontWeightSelectRef.current.value = selectedElement.fontWeight;
    if (fontFamilySelectRef.current) fontFamilySelectRef.current.value = selectedElement.fontFamily;
    if (alignSelectRef.current) alignSelectRef.current.value = selectedElement.align;

    const showSource = selectedElement.type === "field";
    const showContent = selectedElement.type === "text";
    const showTypography = selectedElement.type !== "line" && selectedElement.source !== "companyLogo";

    if (sourceRowRef.current) sourceRowRef.current.hidden = !showSource;
    if (contentRowRef.current) contentRowRef.current.hidden = !showContent;
    if (fontSizeRowRef.current) fontSizeRowRef.current.hidden = !showTypography;
    if (fontFamilyRowRef.current) fontFamilyRowRef.current.hidden = !showTypography;
    if (fontWeightRowRef.current) fontWeightRowRef.current.hidden = !showTypography;
    if (alignRowRef.current) alignRowRef.current.hidden = !showTypography;
    if (typographyPanelRef.current) typographyPanelRef.current.hidden = !showTypography;

    if (sourceSelectRef.current) {
      sourceSelectRef.current.disabled = !showSource;
    }
    if (contentTextareaRef.current) {
      contentTextareaRef.current.disabled = !showContent;
    }
    if (fontSizeInputRef.current) {
      fontSizeInputRef.current.disabled = !showTypography;
    }
    if (fontWeightSelectRef.current) {
      fontWeightSelectRef.current.disabled = !showTypography;
    }
    if (fontFamilySelectRef.current) {
      fontFamilySelectRef.current.disabled = !showTypography;
    }
    if (alignSelectRef.current) {
      alignSelectRef.current.disabled = !showTypography;
    }
  };

  const syncSelection = (nextId: string | null, options?: { immediate?: boolean }) => {
    if (selectionSyncTimeoutRef.current !== null) {
      window.clearTimeout(selectionSyncTimeoutRef.current);
      selectionSyncTimeoutRef.current = null;
    }

    const apply = () => {
      selectedElementIdRef.current = nextId;
      refreshInspector();
    };

    if (options?.immediate || inspectorShouldSyncImmediately || !selectionSyncDelayMs) {
      apply();
      return;
    }

    selectionSyncTimeoutRef.current = window.setTimeout(() => {
      apply();
      selectionSyncTimeoutRef.current = null;
    }, selectionSyncDelayMs);
  };

  useImperativeHandle(
    ref,
    () => ({
      syncSelection,
    }),
    [inspectorShouldSyncImmediately, selectionSyncDelayMs],
  );

  useEffect(() => {
    getDesignerRef.current = getDesigner;
    refreshInspector();
  }, [fieldSources, getDesigner]);

  useEffect(
    () => () => {
      if (selectionSyncTimeoutRef.current !== null) {
        window.clearTimeout(selectionSyncTimeoutRef.current);
      }
    },
    [],
  );

  const patchSelectedElement = (patch: Partial<ReportDesignerElement>) => {
    const selectedElementId = selectedElementIdRef.current;
    if (!selectedElementId) return;
    onPatchElement(selectedElementId, patch);
  };

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-[14px] font-semibold text-slate-900">{translateText("Thuoc tinh doi tuong")}</h3>

      <p className="mt-4 text-[12px] text-slate-500" ref={emptyStateRef}>
        {translateText("Chon mot doi tuong tren canvas de sua thuoc tinh.")}
      </p>

      <div className="mt-4 space-y-3" hidden ref={fieldsPanelRef}>
        <label className="space-y-1.5">
          <span className="text-[12px] font-medium text-slate-900">{translateText("Nhan doi tuong")}</span>
          <input className={inputClass} onChange={(event) => patchSelectedElement({ label: event.target.value })} ref={labelInputRef} />
        </label>

        <label className="space-y-1.5">
          <span className="text-[12px] font-medium text-slate-900">{translateText("Loai")}</span>
          <input className={`${inputClass} bg-slate-50`} readOnly ref={typeInputRef} />
        </label>

        <label className="space-y-1.5" hidden ref={sourceRowRef}>
          <span className="text-[12px] font-medium text-slate-900">{translateText("Nguon du lieu")}</span>
          <select
            className={inputClass}
            onChange={(event) =>
              patchSelectedElement({
                source: event.target.value,
                label: fieldSources.find((item) => item.key === event.target.value)?.label || labelInputRef.current?.value || "",
              })}
            ref={sourceSelectRef}
          >
            {fieldSources.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5" hidden ref={contentRowRef}>
          <span className="text-[12px] font-medium text-slate-900">{translateText("Noi dung")}</span>
          <textarea className={textareaClass} onChange={(event) => patchSelectedElement({ content: event.target.value })} ref={contentTextareaRef} />
        </label>

        <div className="grid grid-cols-2 gap-3">
          {([
            ["x", xInputRef],
            ["y", yInputRef],
            ["w", wInputRef],
            ["h", hInputRef],
          ] as const).map(([field, fieldRef]) => (
            <label className="space-y-1.5" key={field}>
              <span className="text-[12px] font-medium uppercase text-slate-900">{field}</span>
              <input
                className={inputClass}
                onChange={(event) => patchSelectedElement({ [field]: Number(event.target.value) || 0 } as Partial<ReportDesignerElement>)}
                ref={fieldRef}
                type="number"
              />
            </label>
          ))}
        </div>

        <div hidden ref={typographyPanelRef}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5" hidden ref={fontSizeRowRef}>
                <span className="text-[12px] font-medium text-slate-900">{translateText("Co chu")}</span>
                <input className={inputClass} onChange={(event) => patchSelectedElement({ fontSize: Number(event.target.value) || 12 })} ref={fontSizeInputRef} type="number" />
              </label>

              <label className="space-y-1.5" hidden ref={fontWeightRowRef}>
                <span className="text-[12px] font-medium text-slate-900">{translateText("Do dam")}</span>
                <select className={inputClass} onChange={(event) => patchSelectedElement({ fontWeight: event.target.value as ReportDesignerElement["fontWeight"] })} ref={fontWeightSelectRef}>
                  {["400", "500", "600", "700"].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-1.5" hidden ref={fontFamilyRowRef}>
              <span className="text-[12px] font-medium text-slate-900">{translateText("Font chu")}</span>
              <select className={inputClass} onChange={(event) => patchSelectedElement({ fontFamily: event.target.value })} ref={fontFamilySelectRef}>
                {REPORT_DESIGNER_FONT_OPTIONS.map((font) => (
                  <option key={font.key} value={font.key}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5" hidden ref={alignRowRef}>
              <span className="text-[12px] font-medium text-slate-900">{translateText("Can le")}</span>
              <select className={inputClass} onChange={(event) => patchSelectedElement({ align: event.target.value as ReportDesignerElement["align"] })} ref={alignSelectRef}>
                <option value="left">{translateText("Trai")}</option>
                <option value="center">{translateText("Giua")}</option>
                <option value="right">{translateText("Phai")}</option>
              </select>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {[
                ["left", "Trai"],
                ["center-x", "Giua ngang"],
                ["right", "Phai"],
                ["top", "Tren"],
                ["center-y", "Giua doc"],
                ["bottom", "Duoi"],
              ].map(([value, label], index) => (
                <button
                  className="rounded-2xl bg-slate-100 px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  key={value}
                  onClick={() => onAlignSelected(value as ReportTemplateDesignerInspectorAlignDirection)}
                  ref={(node) => {
                    alignButtonsRef.current[index] = node;
                  }}
                  type="button"
                >
                  {translateText(label)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
