"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Minus,
  Printer,
  RotateCcw,
  Save,
  Type,
  X,
} from "lucide-react";
import {
  buildReportDesignerPreviewBundle,
  cloneReportDesignerLayout,
  createDefaultReportDesignerLayout,
  normalizeReportDesignerLayout,
  ReportDesignerBranding,
  ReportDesignerKeyValue,
  ReportDesignerLayout,
} from "@/lib/report-designer";
import { translateText } from "@/lib/i18n/display";
import { ReportDefinition } from "@/types/portal";
import {
  GlobalForm,
  ScopedForm,
  TemplateRow,
} from "./report-template-designer-shared";
import {
  ReportTemplateDesignerInspector,
  ReportTemplateDesignerInspectorAlignDirection,
  ReportTemplateDesignerInspectorHandle,
} from "./report-template-designer-inspector";

interface ReportTemplateDesignerModalProps {
  row: TemplateRow;
  branchLabel: string;
  saving: boolean;
  globalForm: GlobalForm;
  scopedForm: ScopedForm;
  designer: ReportDesignerLayout;
  previewTemplate: Record<string, unknown>;
  previewReport: ReportDefinition | null;
  previewRows: Array<Record<string, unknown>>;
  previewSummary: ReportDesignerKeyValue[];
  previewFilters: ReportDesignerKeyValue[];
  generatedBy?: string;
  branding?: ReportDesignerBranding | null;
  onChangeGlobal: (patch: Partial<GlobalForm>) => void;
  onChangeScoped: (patch: Partial<ScopedForm>) => void;
  onResetScoped: () => void;
  onPrintPreview: (layout: ReportDesignerLayout) => void;
  onClose: () => void;
  onSave: (layout: ReportDesignerLayout) => void;
  presentation?: "modal" | "page";
}

const paperSizes = ["A4", "A5", "Letter"];
const boolOptions = [
  { label: "Co", value: "true" },
  { label: "Khong", value: "false" },
] as const;
const boolOverrideOptions = [
  { label: "Mac dinh", value: "inherit" },
  { label: "Co", value: "true" },
  { label: "Khong", value: "false" },
] as const;
const orientationOptions = [
  { label: "Doc", value: "PORTRAIT" },
  { label: "Ngang", value: "LANDSCAPE" },
] as const;

const inputClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-[12px] outline-none transition focus:border-emerald-400";
const textareaClass = "min-h-[84px] w-full rounded-md border border-slate-200 px-3 py-2 text-[12px] outline-none transition focus:border-emerald-400";
const canvasElementBaseClass = "absolute overflow-hidden rounded-[14px] border text-left transition-[box-shadow,border-color,background-color]";
const canvasElementIdleClasses = ["border-sky-200", "bg-sky-50/60", "hover:border-sky-300"] as const;
const canvasElementSelectedClasses = ["border-emerald-500", "bg-emerald-50/80", "shadow-[0_0_0_2px_rgba(16,185,129,0.15)]"] as const;

const groupLabels = {
  branding: "Nhan dien",
  report: "Bao cao",
  filter: "Bo loc",
  summary: "Tong hop",
  signature: "Chu ky",
  system: "He thong",
} satisfies Record<string, string>;

const createId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

const cloneLayout = (layout: ReportDesignerLayout) => cloneReportDesignerLayout(layout);
const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const toEnabled = (value: unknown, fallback: boolean) => (value === undefined || value === null ? fallback : value === true || value === "true");
const DRAG_START_THRESHOLD_PX = 4;
const applyPreviewDesigner = (
  template: Record<string, unknown>,
  reportKey: string | undefined,
  isGlobal: boolean,
  layout: ReportDesignerLayout,
) => {
  const nextTemplate = { ...asRecord(template) };
  if (isGlobal) {
    nextTemplate.defaultDesigner = cloneLayout(layout);
    return nextTemplate;
  }

  if (!reportKey) {
    return nextTemplate;
  }

  const reportTemplates = { ...asRecord(nextTemplate.reportTemplates) };
  const scopedTemplate = { ...asRecord(reportTemplates[reportKey]), designer: cloneLayout(layout) };
  reportTemplates[reportKey] = scopedTemplate;
  nextTemplate.reportTemplates = reportTemplates;
  return nextTemplate;
};
const patchDesignerElement = (
  layout: ReportDesignerLayout,
  elementId: string,
  patch: Partial<ReportDesignerLayout["elements"][number]>,
): ReportDesignerLayout => ({
  ...layout,
  elements: layout.elements.map((element) => (element.id === elementId ? { ...element, ...patch } : element)),
});

export function ReportTemplateDesignerModal({
  row,
  branchLabel,
  saving,
  globalForm,
  scopedForm,
  designer,
  previewTemplate,
  previewReport,
  previewRows,
  previewSummary,
  previewFilters,
  generatedBy,
  branding,
  onChangeGlobal,
  onChangeScoped,
  onResetScoped,
  onPrintPreview,
  onClose,
  onSave,
  presentation = "modal",
}: ReportTemplateDesignerModalProps) {
  const [previewDesigner, setPreviewDesigner] = useState<ReportDesignerLayout>(() => cloneLayout(designer));
  const [previewTemplateState, setPreviewTemplateState] = useState<Record<string, unknown>>(() => previewTemplate);
  const [isPreviewDirty, setIsPreviewDirty] = useState(false);
  const [editorMode, setEditorMode] = useState<"design" | "preview">("design");
  const designerRef = useRef<ReportDesignerLayout>(cloneLayout(designer));
  const previewTemplateRef = useRef<Record<string, unknown>>(previewTemplate);
  const canvasSelectedIdRef = useRef<string | null>(designer.elements[0]?.id || null);
  const elementNodeRef = useRef<Record<string, HTMLDivElement | null>>({});
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const designSectionRef = useRef<HTMLElement | null>(null);
  const previewSectionRef = useRef<HTMLElement | null>(null);
  const paperSizeSelectRef = useRef<HTMLSelectElement | null>(null);
  const orientationSelectRef = useRef<HTMLSelectElement | null>(null);
  const gridInputRef = useRef<HTMLInputElement | null>(null);
  const marginInputRef = useRef<HTMLInputElement | null>(null);
  const inspectorRef = useRef<ReportTemplateDesignerInspectorHandle | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragPatchRef = useRef<{ id: string; patch: Partial<ReportDesignerLayout["elements"][number]> } | null>(null);
  const previewDirtyRef = useRef(false);
  const skipInitialPreviewTemplateDirtyRef = useRef(true);
  const dragMovedRef = useRef(false);
  const inspectorShouldSyncImmediately = presentation === "page";
  const dragRef = useRef<{
    mode: "move" | "resize";
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    element: ReportDesignerLayout["elements"][number];
  } | null>(null);

  useEffect(() => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragPatchRef.current = null;
    dragRef.current = null;
    dragMovedRef.current = false;
    const nextDesigner = cloneLayout(designer);
    designerRef.current = nextDesigner;
    setPreviewDesigner(nextDesigner);
    setPreviewTemplateState(previewTemplate);
    canvasSelectedIdRef.current = nextDesigner.elements[0]?.id || null;
    previewTemplateRef.current = previewTemplate;
    previewDirtyRef.current = false;
    setIsPreviewDirty(false);
    setEditorMode("design");
    renderCanvasStage(nextDesigner);
    inspectorRef.current?.syncSelection(nextDesigner.elements[0]?.id || null, { immediate: true });
  }, [designer]);

  useEffect(() => {
    previewTemplateRef.current = previewTemplate;
  }, [previewTemplate]);

  const applyCanvasSelectionClasses = (node: HTMLDivElement | null, selected: boolean) => {
    if (!node) return;
    if (selected) {
      node.classList.remove(...canvasElementIdleClasses);
      node.classList.add(...canvasElementSelectedClasses);
      return;
    }
    node.classList.remove(...canvasElementSelectedClasses);
    node.classList.add(...canvasElementIdleClasses);
  };

  const syncCanvasSelection = (nextId: string | null) => {
    const previousId = canvasSelectedIdRef.current;
    if (previousId && previousId !== nextId) {
      applyCanvasSelectionClasses(elementNodeRef.current[previousId], false);
    }
    if (nextId) {
      applyCanvasSelectionClasses(elementNodeRef.current[nextId], true);
    }
    canvasSelectedIdRef.current = nextId;
  };

  const syncInspectorSelection = (nextId: string | null, options?: { immediate?: boolean }) => {
    inspectorRef.current?.syncSelection(nextId, options);
  };

  const syncPreviewNow = (layout = designerRef.current, template = previewTemplateRef.current) => {
    setPreviewDesigner(cloneLayout(layout));
    setPreviewTemplateState(template);
    previewDirtyRef.current = false;
    setIsPreviewDirty(false);
  };

  useEffect(() => {
    if (skipInitialPreviewTemplateDirtyRef.current) {
      skipInitialPreviewTemplateDirtyRef.current = false;
      return;
    }
    previewDirtyRef.current = true;
    setIsPreviewDirty(true);
    setEditorMode("design");
  }, [previewTemplate]);

  const previewTemplateWithDesigner = useMemo(
    () => applyPreviewDesigner(previewTemplateState, row.templateKey, row.isGlobal, previewDesigner),
    [previewDesigner, previewTemplateState, row.isGlobal, row.templateKey],
  );

  const previewBundle = useMemo(
    () =>
      buildReportDesignerPreviewBundle({
        reportKey: previewReport?.key,
        templateKey: row.isGlobal ? undefined : row.templateKey,
        templateFallbackKeys: row.fallbackTemplateKeys,
        title: row.title,
        subtitle: row.description,
        summary: previewSummary,
        filters: previewFilters,
        rows: previewRows,
        columns: Object.keys(previewRows[0] || {}),
        template: previewTemplateWithDesigner,
        generatedBy,
        branding,
        autoPrint: false,
      }),
    [branding, generatedBy, previewFilters, previewReport, previewRows, previewSummary, previewTemplateWithDesigner, row.description, row.fallbackTemplateKeys, row.isGlobal, row.templateKey, row.title],
  );

  const fieldSources = previewBundle.fieldSources;
  const effectiveTemplate = useMemo(() => asRecord(previewBundle.effectiveTemplate), [previewBundle.effectiveTemplate]);
  const showSignature = toEnabled(effectiveTemplate.showSignature, false);
  const showFilters = toEnabled(effectiveTemplate.showFilters, true);
  const showGeneratedBy = toEnabled(effectiveTemplate.showGeneratedBy, true);
  const showPrintedAt = toEnabled(effectiveTemplate.showPrintedAt, true);
  const groupedSources = useMemo(
    () =>
      Object.entries(
        fieldSources.reduce<Record<string, typeof fieldSources>>((groups, item) => {
          groups[item.group] = [...(groups[item.group] || []), item];
          return groups;
        }, {}),
      ),
    [fieldSources],
  );
  const getCanvasSelectedElement = () => {
    const selectedId = canvasSelectedIdRef.current;
    if (!selectedId) return null;
    return designerRef.current.elements.find((element) => element.id === selectedId) || null;
  };
  const syncPageInputs = (layout: ReportDesignerLayout) => {
    if (paperSizeSelectRef.current) {
      paperSizeSelectRef.current.value = layout.page.paperSize;
    }
    if (orientationSelectRef.current) {
      orientationSelectRef.current.value = layout.page.orientation;
    }
    if (gridInputRef.current) {
      gridInputRef.current.value = String(layout.page.grid);
    }
    if (marginInputRef.current) {
      marginInputRef.current.value = String(layout.page.margin);
    }
  };
  const markPreviewDirty = () => {
    if (!previewDirtyRef.current) {
      previewDirtyRef.current = true;
      setIsPreviewDirty(true);
    }
    setEditorMode("design");
  };
  const renderCanvasStage = (layout = designerRef.current) => {
    const canvas = canvasStageRef.current;
    if (!canvas) return;

    syncPageInputs(layout);
    const visibleElements = layout.elements.filter((element) => isElementVisibleInPreview(element.source));
    const visibleElementIds = new Set(visibleElements.map((element) => element.id));
    const nextSelectedId = canvasSelectedIdRef.current && visibleElementIds.has(canvasSelectedIdRef.current) ? canvasSelectedIdRef.current : visibleElements[0]?.id || null;

    canvas.innerHTML = "";
    canvas.style.width = `${layout.page.width}px`;
    canvas.style.height = `${layout.page.height}px`;
    canvas.style.backgroundImage = "linear-gradient(to right, rgba(148,163,184,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.14) 1px, transparent 1px)";
    canvas.style.backgroundSize = `${layout.page.grid}px ${layout.page.grid}px`;
    elementNodeRef.current = {};

    visibleElements.forEach((element) => {
      const node = document.createElement("div");
      node.className = `${canvasElementBaseClass} cursor-pointer ${element.id === nextSelectedId ? canvasElementSelectedClasses.join(" ") : canvasElementIdleClasses.join(" ")}`;
      node.dataset.designerElementId = element.id;
      node.setAttribute("role", "button");
      node.tabIndex = 0;
      node.style.left = `${element.x}px`;
      node.style.top = `${element.y}px`;
      node.style.width = `${element.w}px`;
      node.style.height = `${element.h}px`;

      const label = document.createElement("div");
      label.className = "pointer-events-none flex h-full w-full items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500";
      label.textContent = element.label;

      const resizeHandle = document.createElement("span");
      resizeHandle.className = "absolute bottom-1.5 right-1.5 h-4 w-4 rounded bg-emerald-600";
      resizeHandle.dataset.designerResizeHandle = "1";

      node.appendChild(label);
      node.appendChild(resizeHandle);
      canvas.appendChild(node);
      elementNodeRef.current[element.id] = node;
    });

    canvasSelectedIdRef.current = null;
    syncCanvasSelection(nextSelectedId);
    syncInspectorSelection(nextSelectedId, { immediate: true });
  };

  const isElementVisibleInPreview = (source: string) => {
    if (!source) return true;
    if (source.startsWith("signature")) return showSignature;
    if (source === "generatedBy") return showGeneratedBy;
    if (source === "printedAt") return showPrintedAt;
    if (source === "filterSummary" || source.startsWith("filter.")) return showFilters;
    return true;
  };

  const optionStateLabel = (field: "showGeneratedBy" | "showPrintedAt" | "showFilters" | "showSignature") => {
    const applied =
      field === "showGeneratedBy"
        ? showGeneratedBy
        : field === "showPrintedAt"
          ? showPrintedAt
          : field === "showFilters"
            ? showFilters
            : showSignature;

    if (row.isGlobal) {
      return `${translateText("Dang ap dung")}: ${translateText(applied ? "Co" : "Khong")}`;
    }

    const rawValue = scopedForm[field];
    if (rawValue === "inherit") {
      return `${translateText("Dang ke thua mac dinh")}: ${translateText(applied ? "Co" : "Khong")}`;
    }

    return `${translateText("Dang ap dung rieng")}: ${translateText(applied ? "Co" : "Khong")}`;
  };

  const updateDesignerModel = (
    next: ReportDesignerLayout | ((current: ReportDesignerLayout) => ReportDesignerLayout),
  ) => {
    const updated = cloneLayout(typeof next === "function" ? next(designerRef.current) : next);
    designerRef.current = updated;
    return updated;
  };

  const setDesigner = (
    next: ReportDesignerLayout | ((current: ReportDesignerLayout) => ReportDesignerLayout),
  ) => {
    const updated = updateDesignerModel(next);
    renderCanvasStage(updated);
    markPreviewDirty();
    return updated;
  };

  const patchElement = (
    elementId: string,
    patch: Partial<ReportDesignerLayout["elements"][number]>,
  ) => setDesigner((current) => patchDesignerElement(current, elementId, patch));

  const applyPatchToNode = (elementId: string, patch: Partial<ReportDesignerLayout["elements"][number]>) => {
    const node = elementNodeRef.current[elementId];
    if (!node) return;
    if (typeof patch.x === "number") node.style.left = `${patch.x}px`;
    if (typeof patch.y === "number") node.style.top = `${patch.y}px`;
    if (typeof patch.w === "number") node.style.width = `${patch.w}px`;
    if (typeof patch.h === "number") node.style.height = `${patch.h}px`;
  };

  const commitPendingDragPatch = () => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }

    const pending = pendingDragPatchRef.current;
    if (!pending) return false;

    pendingDragPatchRef.current = null;
    applyPatchToNode(pending.id, pending.patch);
    updateDesignerModel((current) => patchDesignerElement(current, pending.id, pending.patch));
    markPreviewDirty();
    syncInspectorSelection(pending.id, { immediate: true });
    return true;
  };

  const scheduleDragPatch = (elementId: string, patch: Partial<ReportDesignerLayout["elements"][number]>) => {
    pendingDragPatchRef.current = { id: elementId, patch };
    if (dragFrameRef.current !== null) {
      return;
    }

    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      const pending = pendingDragPatchRef.current;
      if (!pending) return;
      applyPatchToNode(pending.id, pending.patch);
    });
  };

  const addElement = (type: "text" | "field" | "line" | "table", source = "", content = "") => {
    const currentDesigner = designerRef.current;
    if (type === "table") {
      const existing = currentDesigner.elements.find((element) => element.type === "table");
      if (existing) {
        syncCanvasSelection(existing.id);
        syncInspectorSelection(existing.id, { immediate: inspectorShouldSyncImmediately });
        return;
      }
    }
    const nextElement = {
      id: createId(type),
      type,
      label: type === "field" ? fieldSources.find((item) => item.key === source)?.label || translateText("Truong du lieu") : type === "line" ? translateText("Duong ke") : type === "table" ? translateText("Bang du lieu") : translateText("Text"),
      source,
      content,
      x: 48,
      y: 48 + currentDesigner.elements.length * 14,
      w: type === "line" ? 240 : type === "table" ? currentDesigner.page.width - currentDesigner.page.margin * 2 : source === "companyLogo" ? 120 : 220,
      h: type === "line" ? 2 : type === "table" ? Math.max(260, Math.floor(currentDesigner.page.height * 0.34)) : source === "companyLogo" ? 78 : 40,
      fontSize: 12,
      fontWeight: "500" as const,
      align: "left" as const,
      fontFamily: source === "companyLogo" ? "noto-sans" : "noto-sans",
    };

    setDesigner((current) => ({ ...current, elements: [...current.elements, nextElement] }));
    syncCanvasSelection(nextElement.id);
    syncInspectorSelection(nextElement.id, { immediate: inspectorShouldSyncImmediately });
  };

  const duplicateSelected = () => {
    const activeCanvasElement = getCanvasSelectedElement();
    if (!activeCanvasElement) return;
    const duplicate = { ...activeCanvasElement, id: createId(activeCanvasElement.type), x: activeCanvasElement.x + 16, y: activeCanvasElement.y + 16 };
    setDesigner((current) => ({ ...current, elements: [...current.elements, duplicate] }));
    syncCanvasSelection(duplicate.id);
    syncInspectorSelection(duplicate.id, { immediate: inspectorShouldSyncImmediately });
  };

  const removeElementById = (elementId: string) => {
    const remainingElements = designerRef.current.elements.filter((element) => element.id !== elementId);
    setDesigner((current) => ({ ...current, elements: current.elements.filter((element) => element.id !== elementId) }));
    const nextId = remainingElements[0]?.id || null;
    syncCanvasSelection(nextId);
    syncInspectorSelection(nextId, { immediate: inspectorShouldSyncImmediately });
  };

  const removeSelected = () => {
    const activeCanvasElement = getCanvasSelectedElement();
    if (!activeCanvasElement) return;
    removeElementById(activeCanvasElement.id);
  };

  const addPreset = (ids: string[]) => {
    const currentDesigner = designerRef.current;
    const presetLayout = createDefaultReportDesignerLayout(currentDesigner.page.paperSize, currentDesigner.page.orientation);
    const missing = presetLayout.elements.filter((element) => ids.includes(element.id) && !currentDesigner.elements.some((current) => current.id === element.id));
    if (!missing.length) return;
    setDesigner((current) => ({ ...current, elements: [...current.elements, ...missing] }));
  };

  const updatePage = (patch: Partial<ReportDesignerLayout["page"]>) => {
    const currentDesigner = designerRef.current;
    const nextPaperSize = patch.paperSize || currentDesigner.page.paperSize;
    const nextOrientation = patch.orientation || currentDesigner.page.orientation;
    setDesigner(normalizeReportDesignerLayout({ ...currentDesigner, page: { ...currentDesigner.page, ...patch } }, { paperSize: nextPaperSize, orientation: nextOrientation }));
  };

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const active = dragRef.current;
      if (!active) return;
      if (event.pointerId !== active.pointerId) return;
      const grid = designerRef.current.page.grid || 8;
      const rawDeltaX = event.clientX - active.startX;
      const rawDeltaY = event.clientY - active.startY;
      if (!dragMovedRef.current && Math.max(Math.abs(rawDeltaX), Math.abs(rawDeltaY)) < DRAG_START_THRESHOLD_PX) {
        return;
      }
      if (!dragMovedRef.current) {
        dragMovedRef.current = true;
        const activeNode = elementNodeRef.current[active.id];
        if (activeNode) {
          activeNode.style.willChange = active.mode === "resize" ? "width, height" : "left, top";
        }
      }
      const dx = Math.round(rawDeltaX / grid) * grid;
      const dy = Math.round(rawDeltaY / grid) * grid;
      const nextElement =
        active.mode === "move"
          ? {
              x: Math.max(0, active.element.x + dx),
              y: Math.max(0, active.element.y + dy),
            }
          : {
              w: Math.max(active.element.type === "line" ? 80 : 60, active.element.w + dx),
              h: Math.max(active.element.type === "line" ? 2 : 20, active.element.h + dy),
            };
      scheduleDragPatch(active.id, nextElement);
    };

    const handlePointerUp = (event: PointerEvent) => {
      const active = dragRef.current;
      if (!active) return;
      if (event.pointerId !== active.pointerId) return;
      if (dragMovedRef.current) {
        commitPendingDragPatch();
      }
      const activeNode = elementNodeRef.current[active.id];
      if (activeNode) {
        activeNode.style.willChange = "";
      }
      if (dragMovedRef.current) {
        syncCanvasSelection(active.id);
        syncInspectorSelection(active.id, { immediate: inspectorShouldSyncImmediately });
      }
      dragRef.current = null;
      dragMovedRef.current = false;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      pendingDragPatchRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [inspectorShouldSyncImmediately]);

  const alignSelected = (direction: ReportTemplateDesignerInspectorAlignDirection) => {
    const activeCanvasElement = getCanvasSelectedElement();
    if (!activeCanvasElement) return;
    const currentPage = designerRef.current.page;
    const pageWidth = currentPage.width;
    const pageHeight = currentPage.height;
    if (direction === "left") patchElement(activeCanvasElement.id, { x: currentPage.margin });
    if (direction === "center-x") patchElement(activeCanvasElement.id, { x: Math.round((pageWidth - activeCanvasElement.w) / 2) });
    if (direction === "right") patchElement(activeCanvasElement.id, { x: Math.max(0, pageWidth - currentPage.margin - activeCanvasElement.w) });
    if (direction === "top") patchElement(activeCanvasElement.id, { y: currentPage.margin });
    if (direction === "center-y") patchElement(activeCanvasElement.id, { y: Math.round((pageHeight - activeCanvasElement.h) / 2) });
    if (direction === "bottom") patchElement(activeCanvasElement.id, { y: Math.max(0, pageHeight - currentPage.margin - activeCanvasElement.h) });
  };

  const boolSelectOptions = row.isGlobal ? boolOptions : boolOverrideOptions;
  const signatureEditor = row.isGlobal;
  const resetDesignerToDefault = () => {
    const currentPage = designerRef.current.page;
    const nextDesigner = createDefaultReportDesignerLayout(currentPage.paperSize, currentPage.orientation);
    setDesigner(nextDesigner);
    syncCanvasSelection(nextDesigner.elements[0]?.id || null);
    syncInspectorSelection(nextDesigner.elements[0]?.id || null, { immediate: inspectorShouldSyncImmediately });
  };

  const handleClose = () => {
    onClose();
  };

  const handlePrintPreview = () => {
    const currentDesigner = cloneLayout(designerRef.current);
    syncPreviewNow(currentDesigner);
    setEditorMode("preview");
    onPrintPreview(currentDesigner);
  };

  const handleSave = () => {
    onSave(cloneLayout(designerRef.current));
  };

  const handleShowDesign = () => {
    setEditorMode("design");
    designSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleReviewPreview = () => {
    syncPreviewNow(cloneLayout(designerRef.current));
    setEditorMode("preview");
    previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    renderCanvasStage();
  }, [showFilters, showGeneratedBy, showPrintedAt, showSignature]);

  useEffect(() => {
    const canvas = canvasStageRef.current;
    if (!canvas) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const elementNode = target?.closest<HTMLElement>("[data-designer-element-id]");

      if (!elementNode || !canvas.contains(elementNode)) {
        syncCanvasSelection(null);
        syncInspectorSelection(null, { immediate: inspectorShouldSyncImmediately });
        return;
      }

      const elementId = elementNode.dataset.designerElementId || "";
      const element = designerRef.current.elements.find((item) => item.id === elementId);
      if (!element) return;

      const resizeHandle = target?.closest<HTMLElement>("[data-designer-resize-handle='1']");

      syncCanvasSelection(elementId);
      syncInspectorSelection(elementId, { immediate: inspectorShouldSyncImmediately });

      dragMovedRef.current = false;
      dragRef.current = {
        mode: resizeHandle ? "resize" : "move",
        id: elementId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        element: { ...element },
      };
      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== "Delete" && event.key !== "Backspace") || !canvasSelectedIdRef.current) {
        return;
      }
      event.preventDefault();
      removeElementById(canvasSelectedIdRef.current);
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("keydown", handleKeyDown);
    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("keydown", handleKeyDown);
    };
  }, [inspectorShouldSyncImmediately]);

  const shell = (
    <div className={presentation === "modal" ? "mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1680px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[#f6f8fb] shadow-[0_28px_100px_rgba(15,23,42,0.35)]" : "flex min-h-[calc(100vh-8rem)] w-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-[#f6f8fb] shadow-[0_20px_50px_rgba(15,23,42,0.08)]"}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">{translateText("Thiet ke bao cao")}</p>
            <h2 className="mt-1 text-[20px] font-semibold text-slate-900">{row.title}</h2>
            <p className="mt-1 text-[12px] text-slate-500">{branchLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="mr-1 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              <button
                className={`inline-flex h-9 items-center rounded-full px-3 text-[12px] font-semibold transition ${editorMode === "design" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                onClick={handleShowDesign}
                type="button"
              >
                {translateText("Xem thiet ke")}
              </button>
              <button
                className={`inline-flex h-9 items-center rounded-full px-3 text-[12px] font-semibold transition ${editorMode === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                onClick={handleReviewPreview}
                type="button"
              >
                {translateText("Review bao cao")}
              </button>
            </div>
            {!row.isGlobal ? (
              <button className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50" onClick={onResetScoped} type="button">
                <RotateCcw className="h-4 w-4" />
                {translateText("Tra ve mac dinh")}
              </button>
            ) : null}
            <button className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50" onClick={handlePrintPreview} type="button">
              <Printer className="h-4 w-4" />
              {translateText("In xem truoc")}
            </button>
            <button className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-600 px-4 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300" disabled={saving} onClick={handleSave} type="button">
              <Save className="h-4 w-4" />
              {saving ? translateText("Dang luu...") : translateText("Luu")}
            </button>
            {presentation === "modal" ? (
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" onClick={handleClose} type="button">
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50" onClick={handleClose} type="button">
                <ArrowLeft className="h-4 w-4" />
                {translateText("Quay lai")}
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
            <div className="space-y-5">
              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-[14px] font-semibold text-slate-900">{translateText("Truong du lieu")}</h3>
                <p className="mt-1 text-[12px] text-slate-500">{translateText("Bam vao truong du lieu de chen vao canvas, sau do keo tha de sap xep lai.")}</p>
                <div className="mt-4 space-y-4">
                  {groupedSources.map(([groupKey, items]) => (
                    <div key={groupKey}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{translateText(groupLabels[groupKey as keyof typeof groupLabels] || groupKey)}</p>
                      <div className="mt-2 space-y-2">
                        {items.map((item) => (
                          <button className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left hover:border-emerald-200 hover:bg-emerald-50/60" key={item.key} onClick={() => addElement("field", item.key)} type="button">
                            <div className="text-[12px] font-semibold text-slate-900">{item.label}</div>
                            <div className="mt-1 line-clamp-2 text-[11px] text-slate-500">{item.preview || translateText("Chua co du lieu")}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-[14px] font-semibold text-slate-900">{translateText("Thong tin mau")}</h3>
                <div className="mt-4 grid gap-3">
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-slate-900">{translateText("Ten mau")}</span>
                    <input className={inputClass} onChange={(event) => (row.isGlobal ? onChangeGlobal({ defaultTitle: event.target.value }) : onChangeScoped({ title: event.target.value }))} value={row.isGlobal ? globalForm.defaultTitle : scopedForm.title} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-slate-900">{translateText("Mo ta")}</span>
                    <input className={inputClass} onChange={(event) => (row.isGlobal ? onChangeGlobal({ defaultSubtitle: event.target.value }) : onChangeScoped({ subtitle: event.target.value }))} value={row.isGlobal ? globalForm.defaultSubtitle : scopedForm.subtitle} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-slate-900">{translateText("Header bao cao")}</span>
                    <textarea className={textareaClass} onChange={(event) => (row.isGlobal ? onChangeGlobal({ reportHeader: event.target.value }) : onChangeScoped({ header: event.target.value }))} value={row.isGlobal ? globalForm.reportHeader : scopedForm.header} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-slate-900">{translateText("Footer bao cao")}</span>
                    <textarea className={textareaClass} onChange={(event) => (row.isGlobal ? onChangeGlobal({ reportFooter: event.target.value }) : onChangeScoped({ footer: event.target.value }))} value={row.isGlobal ? globalForm.reportFooter : scopedForm.footer} />
                  </label>
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section
                className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                ref={designSectionRef}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-600 px-4 text-[12px] font-semibold text-white hover:bg-slate-700" onClick={() => addElement("text", "", translateText("Text moi"))} type="button">
                    <Type className="h-4 w-4" />
                    {translateText("Them text")}
                  </button>
                  <button className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-600 px-4 text-[12px] font-semibold text-white hover:bg-slate-700" onClick={() => addElement("line")} type="button">
                    <Minus className="h-4 w-4" />
                    {translateText("Them duong ke")}
                  </button>
                  <button className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-600 px-4 text-[12px] font-semibold text-white hover:bg-slate-700" onClick={() => addElement("table", "table")} type="button">
                    {translateText("Them bang du lieu")}
                  </button>
                  <button className="inline-flex h-10 items-center rounded-full bg-slate-600 px-4 text-[12px] font-semibold text-white hover:bg-slate-700" onClick={() => addPreset(["company_logo", "company_name", "company_meta", "page_label", "top_divider", "report_title", "report_subtitle", "filter_summary", "header_note"])} type="button">
                    {translateText("Khoi dau trang")}
                  </button>
                  <button className="inline-flex h-10 items-center rounded-full bg-slate-600 px-4 text-[12px] font-semibold text-white hover:bg-slate-700" onClick={() => addPreset(["signature_divider", "signature_date", "signature_left_title", "signature_center_title", "signature_right_title", "signature_left_hint", "signature_center_hint", "signature_right_hint", "signature_left_name", "signature_center_name", "signature_right_name"])} type="button">
                    {translateText("Khoi chu ky")}
                  </button>
                  <button className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-600 px-4 text-[12px] font-semibold text-white hover:bg-slate-700" onClick={duplicateSelected} type="button">
                    <Copy className="h-4 w-4" />
                    {translateText("Nhan doi")}
                  </button>
                  <button className="inline-flex h-10 items-center gap-2 rounded-full bg-rose-600 px-4 text-[12px] font-semibold text-white hover:bg-rose-700" onClick={removeSelected} type="button">
                    <X className="h-4 w-4" />
                    {translateText("Xoa")}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-slate-900">{translateText("Kho giay")}</span>
                    <select className={inputClass} defaultValue={designer.page.paperSize} onChange={(event) => { const value = event.target.value; row.isGlobal ? onChangeGlobal({ paperSize: value }) : onChangeScoped({ paperSize: value }); updatePage({ paperSize: value }); }} ref={paperSizeSelectRef}>
                      {paperSizes.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-slate-900">{translateText("Huong giay")}</span>
                    <select className={inputClass} defaultValue={designer.page.orientation} onChange={(event) => { const value = event.target.value as "PORTRAIT" | "LANDSCAPE"; row.isGlobal ? onChangeGlobal({ defaultOrientation: value }) : onChangeScoped({ orientation: value }); updatePage({ orientation: value }); }} ref={orientationSelectRef}>
                      {orientationOptions.map((option) => <option key={option.value} value={option.value}>{translateText(option.label)}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-slate-900">{translateText("Luoi can")}</span>
                    <input className={inputClass} defaultValue={designer.page.grid} min={4} onChange={(event) => updatePage({ grid: Number(event.target.value) || 8 })} ref={gridInputRef} type="number" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[12px] font-medium text-slate-900">{translateText("Le can")}</span>
                    <input className={inputClass} defaultValue={designer.page.margin} min={12} onChange={(event) => updatePage({ margin: Number(event.target.value) || 32 })} ref={marginInputRef} type="number" />
                  </label>
                </div>
                <div className="mt-4 overflow-auto rounded-[24px] border border-slate-200 bg-[radial-gradient(circle_at_top,#eff6ff_0,#ffffff_55%)] p-4">
                  <div
                    className="mx-auto relative rounded-[22px] border border-slate-300 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
                    ref={canvasStageRef}
                    style={{ width: designer.page.width, height: designer.page.height, backgroundImage: `linear-gradient(to right, rgba(148,163,184,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.14) 1px, transparent 1px)`, backgroundSize: `${designer.page.grid}px ${designer.page.grid}px` }}
                    tabIndex={0}
                  />
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm" ref={previewSectionRef}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[14px] font-semibold text-slate-900">{translateText("Mau dang hien thi")}</h3>
                    <p className="mt-1 text-[12px] text-slate-500">
                      {editorMode === "design"
                        ? translateText("Dang o che do thiet ke. Preview chi duoc tai khi bam Review bao cao.")
                        : isPreviewDirty
                        ? translateText("Preview dang dung o ban chup truoc. Bam Review bao cao de cap nhat theo thiet ke moi nhat.")
                        : translateText("Preview nay dung chung renderer voi ban in that.")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {editorMode === "design" ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">{translateText("Dang thiet ke")}</span>
                    ) : isPreviewDirty ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">{translateText("Chua review")}</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">{translateText("Da dong bo")}</span>
                    )}
                    <button className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-800 px-4 text-[12px] font-semibold text-white hover:bg-slate-900" onClick={handleReviewPreview} type="button">
                      <Printer className="h-4 w-4" />
                      {translateText("Review bao cao")}
                    </button>
                    <button className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50" onClick={resetDesignerToDefault} type="button">
                      <RotateCcw className="h-4 w-4" />
                      {translateText("Khoi phuc mac dinh")}
                    </button>
                  </div>
                </div>
                {editorMode === "preview" ? (
                  <div className="mt-4 overflow-auto rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div dangerouslySetInnerHTML={{ __html: `<style>${previewBundle.styles}</style>${previewBundle.markup}` }} />
                  </div>
                ) : (
                  <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
                    <p className="text-[13px] font-semibold text-slate-700">{translateText("Preview dang tam an de uu tien hieu nang khi thiet ke.")}</p>
                    <p className="mt-2 text-[12px] text-slate-500">{translateText("Bam Review bao cao khi can xem ban in moi nhat.")}</p>
                    <button className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-slate-800 px-4 text-[12px] font-semibold text-white hover:bg-slate-900" onClick={handleReviewPreview} type="button">
                      <Printer className="h-4 w-4" />
                      {translateText("Review bao cao")}
                    </button>
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-5">
              <ReportTemplateDesignerInspector
                fieldSources={fieldSources}
                getDesigner={() => designerRef.current}
                inspectorShouldSyncImmediately={inspectorShouldSyncImmediately}
                onAlignSelected={alignSelected}
                onPatchElement={patchElement}
                ref={inspectorRef}
              />

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-[14px] font-semibold text-slate-900">{translateText("Tuy chon xuat")}</h3>
                <p className="mt-1 text-[12px] text-slate-500">{translateText("Block nao bi tat se duoc an han tren canvas va trong mau hien thi.")}</p>
                <div className="mt-4 grid gap-3">
                  {[
                    ["showGeneratedBy", "Hien nguoi xuat"],
                    ["showPrintedAt", "Hien thoi gian xuat"],
                    ["showFilters", "In bo loc"],
                    ["showSignature", "In chu ky"],
                  ].map(([field, label]) => (
                    <label className="space-y-1.5" key={field}>
                      <span className="text-[12px] font-medium text-slate-900">{translateText(label)}</span>
                      <select className={inputClass} onChange={(event) => (row.isGlobal ? onChangeGlobal({ [field]: event.target.value } as Partial<GlobalForm>) : onChangeScoped({ [field]: event.target.value } as Partial<ScopedForm>))} value={String(row.isGlobal ? globalForm[field as keyof GlobalForm] : scopedForm[field as keyof ScopedForm])}>
                        {boolSelectOptions.map((option) => <option key={option.value} value={option.value}>{translateText(option.label)}</option>)}
                      </select>
                      <p className="text-[11px] text-slate-500">{optionStateLabel(field as "showGeneratedBy" | "showPrintedAt" | "showFilters" | "showSignature")}</p>
                    </label>
                  ))}
                </div>
              </section>

              {signatureEditor ? (
                <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-[14px] font-semibold text-slate-900">{translateText("Thong tin chu ky")}</h3>
                  <div className="mt-4 space-y-3">
                    {[
                      ["signatureLeftTitle", "signatureLeftName", "Ky ben trai"],
                      ["signatureCenterTitle", "signatureCenterName", "Ky o giua"],
                      ["signatureRightTitle", "signatureRightName", "Ky ben phai"],
                    ].map(([titleField, nameField, label]) => (
                      <div className="space-y-2" key={titleField}>
                        <p className="text-[12px] font-semibold text-slate-900">{translateText(label)}</p>
                        <input className={inputClass} onChange={(event) => onChangeGlobal({ [titleField]: event.target.value } as Partial<GlobalForm>)} placeholder={translateText("Chuc danh")} value={globalForm[titleField as keyof GlobalForm] as string} />
                        <input className={inputClass} onChange={(event) => onChangeGlobal({ [nameField]: event.target.value } as Partial<GlobalForm>)} placeholder={translateText("Ho ten")} value={globalForm[nameField as keyof GlobalForm] as string} />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>
  );

  if (presentation === "page") {
    return shell;
  }

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-4">{shell}</div>;
}
