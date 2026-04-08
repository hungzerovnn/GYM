import { getLocaleBundle } from "./messages";
import { AppLocale, getCurrentLocale, normalizeUtf8Text } from "./runtime";

const statusLikeKeys = new Set([
  "status",
  "membershipStatus",
  "paymentStatus",
  "attendanceStatus",
  "connectionStatus",
  "followUpState",
  "presenceStatus",
  "currentShiftStatus",
  "urgency",
  "priority",
  "eventType",
  "verificationMethod",
  "source",
  "roleType",
  "defaultOrientation",
  "orientation",
  "channel",
  "roundingMode",
  "taxRoundingMode",
]);

const masterDataDomainByField: Record<string, string> = {
  action: "auditAction",
  module: "auditModule",
  entityType: "auditEntity",
  itemType: "depositItemType",
  channel: "channel",
  defaultOrientation: "orientation",
  orientation: "orientation",
  currencyScale: "currencyScale",
  roleType: "roleType",
  eventType: "attendanceEventType",
  verificationMethod: "attendanceMethod",
  source: "attendanceSource",
  roundingMode: "roundingMode",
  taxRoundingMode: "roundingMode",
};

const titleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");

const normalizeFieldLabelSource = (value: string) =>
  titleCase(value)
    .replace(/\bUrl\b/g, "URL")
    .replace(/\bApi\b/g, "API")
    .replace(/\bId\b/g, "ID")
    .replace(/\bOtp\b/g, "OTP")
    .replace(/\bPt\b/g, "PT");

const sourceTextToLabel = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ")
    .trim();

const permissionPattern = /^[a-z0-9-]+\.[a-z0-9_]+$/i;
const codeListPattern = /^[a-z0-9-]+\.[a-z0-9_]+(?:\s*,\s*[a-z0-9-]+\.[a-z0-9_]+)*$/i;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildPhrasePattern = (source: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegex(source)})(?=$|[^\\p{L}\\p{N}])`, "giu");

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const uncapitalize = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

const finalizeTranslation = (value: string) => normalizeUtf8Text(value);

const normalizeStatusKey = (value: string) => value.trim().toUpperCase().replaceAll(" ", "_").replaceAll("-", "_");

const stripVietnameseDiacritics = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .normalize("NFC");

const normalizeLookupText = (value: unknown) =>
  stripVietnameseDiacritics(normalizeUtf8Text(value))
    .replace(/\s+/g, " ")
    .trim();

const canonicalizeLookupKey = (value: string) => normalizeLookupText(value).toLowerCase();

type LocaleBundle = ReturnType<typeof getLocaleBundle>;

const exactTextLookupCache = new WeakMap<LocaleBundle, Map<string, string>>();

const getCanonicalExactTextMap = (bundle: LocaleBundle) => {
  const cached = exactTextLookupCache.get(bundle);
  if (cached) {
    return cached;
  }

  const next = new Map<string, string>();
  for (const [key, value] of Object.entries(bundle.exactText)) {
    const canonicalKey = canonicalizeLookupKey(key);
    if (canonicalKey && !next.has(canonicalKey)) {
      next.set(canonicalKey, value);
    }
  }

  exactTextLookupCache.set(bundle, next);
  return next;
};

const applyPhraseTranslations = (value: string, locale: AppLocale) => {
  const bundle = getLocaleBundle(locale);
  const placeholders = new Map<string, string>();

  const placeholderized = [...bundle.phraseEntries]
    .sort((left, right) => right.source.length - left.source.length)
    .reduce((result, entry, index) => {
      const placeholder = `__FITFLOW_I18N_${locale}_${index}__`;
      placeholders.set(placeholder, entry[locale]);

      const variants = Array.from(
        new Set([entry.source, normalizeUtf8Text(entry.vi), normalizeLookupText(entry.source), normalizeLookupText(entry.vi)]),
      ).filter(Boolean);

      return variants.reduce(
        (current, variant) => current.replace(buildPhrasePattern(variant), (match, prefix) => `${prefix}${placeholder}`),
        result,
      );
    }, value);

  return finalizeTranslation(
    [...placeholders.entries()].reduce((result, [placeholder, translated]) => result.replaceAll(placeholder, translated), placeholderized),
  );
};

const translatePatternText = (source: string, locale: AppLocale): string | null => {
  const resolveSegment = (segment: string) => {
    const trimmed = segment.trim();
    if (!trimmed) return "";

    if (trimmed.includes(",")) {
      return trimmed
        .split(",")
        .map((part) => translateText(part.trim(), locale).trim())
        .filter(Boolean)
        .join(", ");
    }

    return translateText(trimmed, locale).trim();
  };

  const prefixedPatterns: Array<{
    pattern: RegExp;
    en: (segment: string) => string;
    ko: (segment: string) => string;
  }> = [
    {
      pattern: /^Tim (.+)$/iu,
      en: (segment) => `Search ${uncapitalize(resolveSegment(segment))}`,
      ko: (segment) => `${resolveSegment(segment)} 검색`,
    },
    {
      pattern: /^Nhap (.+)$/iu,
      en: (segment) => `Enter ${uncapitalize(resolveSegment(segment))}`,
      ko: (segment) => `${resolveSegment(segment)} 입력`,
    },
    {
      pattern: /^Ma (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} code`,
      ko: (segment) => `${resolveSegment(segment)} 코드`,
    },
    {
      pattern: /^Ten (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} name`,
      ko: (segment) => `${resolveSegment(segment)}명`,
    },
    {
      pattern: /^Quan ly (.+)$/iu,
      en: (segment) => `Manage ${uncapitalize(resolveSegment(segment))}`,
      ko: (segment) => `${resolveSegment(segment)} 관리`,
    },
    {
      pattern: /^Danh sach (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} list`,
      ko: (segment) => `${resolveSegment(segment)} 목록`,
    },
    {
      pattern: /^Bao cao (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} report`,
      ko: (segment) => `${resolveSegment(segment)} 보고서`,
    },
    {
      pattern: /^Thiet lap (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} settings`,
      ko: (segment) => `${resolveSegment(segment)} 설정`,
    },
    {
      pattern: /^Cau hinh (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} configuration`,
      ko: (segment) => `${resolveSegment(segment)} 설정`,
    },
    {
      pattern: /^Tong hop (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} summary`,
      ko: (segment) => `${resolveSegment(segment)} 요약`,
    },
    {
      pattern: /^Lich su (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} history`,
      ko: (segment) => `${resolveSegment(segment)} 이력`,
    },
    {
      pattern: /^Dinh dang (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} format`,
      ko: (segment) => `${resolveSegment(segment)} 형식`,
    },
    {
      pattern: /^Gioi han (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} limit`,
      ko: (segment) => `${resolveSegment(segment)} 제한`,
    },
  ];

  for (const entry of prefixedPatterns) {
    const match = source.match(entry.pattern);
    if (!match) continue;

    const [, segment] = match;
    if (!segment.trim()) continue;

    if (locale === "en") {
      return finalizeTranslation(entry.en(segment));
    }

    if (locale === "ko") {
      return finalizeTranslation(entry.ko(segment));
    }

    return finalizeTranslation(source);
  }

  return null;
};

const translateExtendedPatternText = (source: string, locale: AppLocale): string | null => {
  const resolveSegment = (segment: string) => translateText(segment.trim(), locale).trim();

  const prefixedPatterns: Array<{
    pattern: RegExp;
    en: (segment: string) => string;
    ko: (segment: string) => string;
  }> = [
    {
      pattern: /^Danh muc (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} catalog`,
      ko: (segment) => `${resolveSegment(segment)} ì¹´íƒˆë¡œê·¸`,
    },
    {
      pattern: /^Tong (.+)$/iu,
      en: (segment) => `Total ${uncapitalize(resolveSegment(segment))}`,
      ko: (segment) => `${resolveSegment(segment)} ì´ê³„`,
    },
    {
      pattern: /^Theo doi (.+)$/iu,
      en: (segment) => `Track ${uncapitalize(resolveSegment(segment))}`,
      ko: (segment) => `${resolveSegment(segment)} ì¶”ì `,
    },
    {
      pattern: /^Thong tin (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} information`,
      ko: (segment) => `${resolveSegment(segment)} ì •ë³´`,
    },
    {
      pattern: /^Mau (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} template`,
      ko: (segment) => `${resolveSegment(segment)} í…œí”Œë¦¿`,
    },
    {
      pattern: /^Gia tri (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} value`,
      ko: (segment) => `${resolveSegment(segment)} ê°€ì¹˜`,
    },
    {
      pattern: /^Dieu chinh (.+)$/iu,
      en: (segment) => `${capitalize(resolveSegment(segment))} adjustment`,
      ko: (segment) => `${resolveSegment(segment)} ì¡°ì •`,
    },
  ];

  for (const entry of prefixedPatterns) {
    const match = source.match(entry.pattern);
    if (!match) continue;

    const [, segment] = match;
    if (!segment.trim()) continue;

    if (locale === "en") {
      return finalizeTranslation(entry.en(segment));
    }

    if (locale === "ko") {
      return finalizeTranslation(entry.ko(segment));
    }

    return finalizeTranslation(source);
  }

  return null;
};

export const translateText = (input: unknown, locale: AppLocale = getCurrentLocale()) => {
  const source = normalizeUtf8Text(input);
  if (!source) return "";

  const bundle = getLocaleBundle(locale);
  const lookupSource = normalizeLookupText(source);
  const exact = bundle.exactText[source] || bundle.exactText[lookupSource] || getCanonicalExactTextMap(bundle).get(canonicalizeLookupKey(source));
  if (exact) {
    return finalizeTranslation(exact);
  }

  const normalizedStatus = normalizeStatusKey(lookupSource || source);
  if (bundle.statuses[normalizedStatus]) {
    return finalizeTranslation(bundle.statuses[normalizedStatus]);
  }

  const patternTranslated = translatePatternText(lookupSource || source, locale);
  if (patternTranslated) {
    return patternTranslated;
  }

  const extendedPatternTranslated = translateExtendedPatternText(lookupSource || source, locale);
  if (extendedPatternTranslated) {
    return extendedPatternTranslated;
  }

  const phraseTranslated = applyPhraseTranslations(source, locale);
  if (phraseTranslated !== source) {
    return finalizeTranslation(phraseTranslated);
  }

  if (lookupSource && lookupSource !== source) {
    const normalizedPhraseTranslated = applyPhraseTranslations(lookupSource, locale);
    if (normalizedPhraseTranslated !== lookupSource) {
      return finalizeTranslation(normalizedPhraseTranslated);
    }
  }

  return finalizeTranslation(source);
};

export const translateStatus = (value?: unknown, locale: AppLocale = getCurrentLocale()) => {
  const normalized = normalizeStatusKey(normalizeLookupText(value)) || "UNKNOWN";
  const bundle = getLocaleBundle(locale);
  return {
    normalized,
    label: bundle.statuses[normalized] || translateText(sourceTextToLabel(normalized), locale),
  };
};

export const translateEnum = (domain: string, value?: unknown, locale: AppLocale = getCurrentLocale()) => {
  const normalized = normalizeUtf8Text(value).trim();
  if (!normalized) return "";
  const bundle = getLocaleBundle(locale);
  return bundle.enums[domain]?.[normalized] || bundle.statuses[normalized] || translateText(sourceTextToLabel(normalized), locale);
};

export const translatePermissionModule = (moduleName?: string | null, locale: AppLocale = getCurrentLocale()) => {
  const normalized = normalizeUtf8Text(moduleName).trim();
  if (!normalized) {
    return translateText("Khac", locale);
  }

  const bundle = getLocaleBundle(locale);
  return bundle.permissions.modules[normalized] || titleCase(translateText(sourceTextToLabel(normalized), locale));
};

export const translatePermissionAction = (action?: string | null, locale: AppLocale = getCurrentLocale()) => {
  const normalized = normalizeUtf8Text(action).trim();
  if (!normalized) {
    return translateText("Quyen", locale);
  }

  const bundle = getLocaleBundle(locale);
  return bundle.permissions.actions[normalized] || titleCase(translateText(sourceTextToLabel(normalized), locale));
};

export const translatePermissionCode = (
  permissionCode?: string | null,
  locale: AppLocale = getCurrentLocale(),
  moduleName?: string | null,
  action?: string | null,
) => {
  const normalized = normalizeUtf8Text(permissionCode).trim();
  if (!normalized) return "";

  const bundle = getLocaleBundle(locale);
  const exact = bundle.permissions.exactCodes[normalized];
  if (exact) {
    return exact;
  }

  const [modulePart, actionPart] = normalized.split(".");
  const resolvedModule = moduleName || modulePart;
  const resolvedAction = action || actionPart;
  return `${translatePermissionModule(resolvedModule, locale)} - ${translatePermissionAction(resolvedAction, locale)}`;
};

export const translateRoleCode = (roleCode?: string | null, locale: AppLocale = getCurrentLocale()) => {
  const normalized = normalizeUtf8Text(roleCode).trim();
  if (!normalized) return "";

  const bundle = getLocaleBundle(locale);
  return bundle.permissions.roles[normalized] || titleCase(translateText(sourceTextToLabel(normalized), locale));
};

export const translateRoleList = (roleCodes: Array<string | null | undefined>, roleNames?: string[], locale: AppLocale = getCurrentLocale()) => {
  const bundle = getLocaleBundle(locale);
  const translatedRoles = roleCodes
    .map((roleCode, index) => {
      const normalizedCode = normalizeUtf8Text(roleCode).trim();
      if (normalizedCode && bundle.permissions.roles[normalizedCode]) {
        return bundle.permissions.roles[normalizedCode];
      }

      const fallbackName = normalizeUtf8Text(roleNames?.[index]).trim();
      if (fallbackName) {
        return fallbackName;
      }

      return translateRoleCode(roleCode, locale);
    })
    .filter(Boolean);

  if (translatedRoles.length) {
    return translatedRoles.join(", ");
  }

  return (roleNames || []).map((roleName) => normalizeUtf8Text(roleName)).filter(Boolean).join(", ");
};

export const translateFieldLabel = (fieldKey: string, locale: AppLocale = getCurrentLocale()) => {
  const rawLabel = sourceTextToLabel(fieldKey);
  const normalizedLabel = normalizeFieldLabelSource(rawLabel);
  const normalizedTranslation = translateText(normalizedLabel, locale);

  if (normalizedTranslation !== normalizedLabel) {
    return titleCase(normalizedTranslation);
  }

  const rawTranslation = translateText(rawLabel, locale);
  return titleCase(rawTranslation === rawLabel ? normalizedLabel : rawTranslation);
};

export const resolveMasterDataText = (
  fieldKey: string,
  value: unknown,
  row?: Record<string, unknown>,
  locale: AppLocale = getCurrentLocale(),
) => {
  const normalizedValue = normalizeUtf8Text(value).trim();
  if (!normalizedValue) return "";

  const bundle = getLocaleBundle(locale);
  const domain = masterDataDomainByField[fieldKey];
  if (domain) {
    return bundle.masterData.systemCatalogs[domain]?.[normalizedValue] || translateEnum(domain, normalizedValue, locale);
  }

  if (bundle.masterData.userManagedFields[fieldKey]) {
    return translateText(normalizedValue, locale);
  }

  const codeKey = fieldKey.endsWith("Name") ? `${fieldKey.slice(0, -4)}Code` : `${fieldKey}Code`;
  const candidateCode = row?.[codeKey];
  const normalizedCode = normalizeUtf8Text(candidateCode).trim();
  if (normalizedCode && bundle.masterData.systemCatalogs[fieldKey]?.[normalizedCode]) {
    return bundle.masterData.systemCatalogs[fieldKey][normalizedCode];
  }

  return translateText(normalizedValue, locale);
};

export const resolveTextDisplay = (
  value: unknown,
  fieldKey?: string,
  row?: Record<string, unknown>,
  locale: AppLocale = getCurrentLocale(),
): string => {
  if (value === null || value === undefined || value === "") return "-";

  if (typeof value === "boolean") {
    return translateEnum("boolean", String(value), locale);
  }

  if (Array.isArray(value)) {
    const values = value
      .map((item) => resolveTextDisplay(item, fieldKey, row, locale))
      .filter((item) => item && item !== "-");
    return values.length ? values.join(", ") : "-";
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nestedValue = record.name || record.label || record.title || record.fullName || record.code || record.id;
    return resolveTextDisplay(nestedValue, fieldKey, row, locale);
  }

  const normalized = normalizeUtf8Text(value).trim();
  if (!normalized) return "-";

  if (normalized === "true" || normalized === "false") {
    return translateEnum("boolean", normalized, locale);
  }

  if (codeListPattern.test(normalized)) {
    return normalized
      .split(",")
      .map((item) => translatePermissionCode(item.trim(), locale))
      .join(", ");
  }

  if (permissionPattern.test(normalized)) {
    return translatePermissionCode(normalized, locale);
  }

  const normalizedStatus = normalizeStatusKey(normalized);
  if (fieldKey && statusLikeKeys.has(fieldKey)) {
    const domain = masterDataDomainByField[fieldKey];
    return domain ? translateEnum(domain, normalizedStatus, locale) : translateStatus(normalizedStatus, locale).label;
  }

  if (/^[A-Z_]+$/.test(normalized) && getLocaleBundle(locale).statuses[normalizedStatus]) {
    return translateStatus(normalizedStatus, locale).label;
  }

  if (fieldKey) {
    return resolveMasterDataText(fieldKey, normalized, row, locale);
  }

  return translateText(normalized, locale);
};
