import { getLocaleBundle } from "./messages";
import { translateEnum, translateEnumCode, translateStatus, translateText } from "./display";
import { getCurrentLocale } from "./runtime";
import { ResourceDefinition, SettingDefinition, ReportDefinition, MenuGroup, PortalPageDefinition } from "@/types/portal";

const translatableKeys = new Set([
  "title",
  "subtitle",
  "label",
  "description",
  "placeholder",
  "section",
  "searchPlaceholder",
  "createLabel",
  "emptyStateTitle",
  "emptyStateDescription",
  "emptyStateExamples",
  "noticeTitle",
  "noticeDescription",
]);

const localizeOptionLabel = (option: Record<string, unknown>) => {
  const rawLabel = String(option.label || "");
  const translatedLabel = translateText(rawLabel);
  if (translatedLabel !== rawLabel) {
    return translatedLabel;
  }

  const rawValue = String(option.value || "").trim();
  if (!rawValue) {
    return translatedLabel;
  }

  if (rawValue === "true" || rawValue === "false") {
    return translateEnum("boolean", rawValue);
  }

  const localizedStatus = translateStatus(rawValue);
  const bundle = getLocaleBundle(getCurrentLocale());
  if (bundle.statuses[localizedStatus.normalized]) {
    return localizedStatus.label;
  }

  const localizedEnum = translateEnumCode(rawValue);
  if (localizedEnum) {
    return localizedEnum;
  }

  return translatedLabel;
};

const localizeValue = (value: unknown, key?: string): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => localizeValue(item, key));
  }

  if (!value || typeof value !== "object") {
    if (typeof value === "string" && key && translatableKeys.has(key)) {
      return translateText(value);
    }
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => {
      if (entryKey === "options" && Array.isArray(entryValue)) {
        return [
          entryKey,
          entryValue.map((option) =>
            option && typeof option === "object"
              ? {
                  ...(option as Record<string, unknown>),
                  label: localizeOptionLabel(option as Record<string, unknown>),
                }
              : option,
          ),
        ];
      }

      if (typeof entryValue === "string" && translatableKeys.has(entryKey)) {
        return [entryKey, translateText(entryValue)];
      }

      return [entryKey, localizeValue(entryValue, entryKey)];
    }),
  );
};

export const localizeResourceDefinition = (resource: ResourceDefinition): ResourceDefinition =>
  localizeValue(resource) as ResourceDefinition;

export const localizeReportDefinition = (report: ReportDefinition): ReportDefinition =>
  localizeValue(report) as ReportDefinition;

export const localizeSettingDefinition = (setting: SettingDefinition): SettingDefinition =>
  localizeValue(setting) as SettingDefinition;

export const localizeMenuGroups = (groups: MenuGroup[]): MenuGroup[] => localizeValue(groups) as MenuGroup[];

export const localizePortalPageDefinition = (page: PortalPageDefinition): PortalPageDefinition =>
  localizeValue(page) as PortalPageDefinition;
