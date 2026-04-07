import { promises as fs } from "node:fs";
import path from "node:path";
import { portalPageRegistry, reportRegistry, resourceRegistry, settingsRegistry } from "../apps/web/lib/module-config";
import { translateText } from "../apps/web/lib/i18n/display";
import { normalizeUtf8Text } from "../apps/web/lib/i18n/runtime";

type AuditEntry = {
  source: string;
  translated: string;
  origin: string;
  issue: "missing" | "mixed";
};

const repoRoot = process.cwd();
const locale = "ko" as const;
const translatableKeys = new Set(["title", "subtitle", "label", "description", "placeholder", "section", "searchPlaceholder", "createLabel", "allLabel"]);
const componentFiles = [
  "apps/web/components/portal/report-workspace.tsx",
  "apps/web/components/portal/resource-workspace.tsx",
  "apps/web/components/portal/dashboard-workspace.tsx",
  "apps/web/components/portal/resource-detail-drawer.tsx",
  "apps/web/components/shared/detail-drawer.tsx",
  "apps/web/components/portal/settings-workspace.tsx",
  "apps/web/components/filters/filter-sidebar.tsx",
  "apps/web/components/table/smart-data-table.tsx",
  "apps/web/components/table/column-selector.tsx",
  "apps/web/components/table/search-bar.tsx",
  "apps/web/components/layout/top-navbar.tsx",
  "apps/web/components/layout/sidebar-menu.tsx",
];
const tokenWhitelist = new Set([
  "api",
  "access",
  "csv",
  "crm",
  "email",
  "excel",
  "face",
  "facebook",
  "fitflow",
  "id",
  "ip",
  "json",
  "kpi",
  "login",
  "line",
  "localhost",
  "oa",
  "otp",
  "postgresql",
  "pdf",
  "pt",
  "pro",
  "shop",
  "smtp",
  "sms",
  "tenant",
  "token",
  "url",
  "vip",
  "vnd",
  "xlsx",
  "zalo",
  "zns",
]);

const stripDiacritics = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .normalize("NFC");

const canonicalize = (value: string) =>
  stripDiacritics(normalizeUtf8Text(value))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const hasLetter = (value: string) => /\p{L}/u.test(value);

const hasHangul = (value: string) => /[\u3131-\u318E\uAC00-\uD7A3]/u.test(value);

const getAsciiTokens = (value: string) =>
  canonicalize(value)
    .match(/[a-z][a-z0-9]+/g)
    ?.filter((token) => token.length >= 3 && !tokenWhitelist.has(token)) || [];

const shouldAudit = (value: string) => {
  const normalized = normalizeUtf8Text(value).trim();
  if (!normalized) return false;
  if (!hasLetter(normalized)) return false;
  if (normalized.startsWith("/") || normalized.startsWith("http")) return false;
  if (/^[a-z0-9/_\-.]+$/i.test(normalized) && !/\s/.test(normalized)) return false;
  if (/^[A-Z0-9_]+$/u.test(normalized)) return false;
  return true;
};

const findIssueType = (source: string, translated: string): AuditEntry["issue"] | null => {
  const canonicalSource = canonicalize(source);
  const canonicalTranslated = canonicalize(translated);

  if (!canonicalSource || !canonicalTranslated) {
    return null;
  }

  if (canonicalSource === canonicalTranslated) {
    return "missing";
  }

  const sourceTokens = getAsciiTokens(source);
  if (!sourceTokens.length || !hasHangul(translated)) {
    return null;
  }

  const leakedSourceToken = sourceTokens.find((token) => canonicalTranslated.includes(token));
  return leakedSourceToken ? "mixed" : null;
};

const pushEntry = (entries: AuditEntry[], source: string, origin: string) => {
  const normalizedSource = normalizeUtf8Text(source).trim();
  if (!shouldAudit(normalizedSource)) return;

  const translated = normalizeUtf8Text(translateText(normalizedSource, locale)).trim();
  const issue = findIssueType(normalizedSource, translated);
  if (!issue) return;

  entries.push({ source: normalizedSource, translated, origin, issue });
};

const collectFromValue = (entries: AuditEntry[], value: unknown, origin: string) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectFromValue(entries, item, `${origin}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
    if (typeof nested === "string" && translatableKeys.has(key)) {
      pushEntry(entries, nested, `${origin}.${key}`);
      return;
    }

    if (key === "options" && Array.isArray(nested)) {
      nested.forEach((option, index) => {
        if (option && typeof option === "object" && typeof (option as Record<string, unknown>).label === "string") {
          pushEntry(entries, String((option as Record<string, unknown>).label), `${origin}.options[${index}].label`);
        }
      });
      return;
    }

    collectFromValue(entries, nested, `${origin}.${key}`);
  });
};

const lineNumberForIndex = (text: string, index: number) => text.slice(0, index).split(/\r?\n/u).length;

const collectTranslateTextCalls = (entries: AuditEntry[], filePath: string, text: string) => {
  const callPattern = /translateText\(\s*(["'`])((?:\\.|(?!\1)[^\\])*?)\1/gmu;
  for (const match of text.matchAll(callPattern)) {
    const source = match[2];
    if (!source || source.includes("${")) continue;
    pushEntry(entries, source, `${filePath}:${lineNumberForIndex(text, match.index || 0)}`);
  }
};

const collectLiteralAssignments = (entries: AuditEntry[], filePath: string, text: string) => {
  const assignmentPattern = /\b(?:title|subtitle|label|description|placeholder|searchPlaceholder|createLabel|allLabel)\s*:\s*(["'`])((?:\\.|(?!\1)[^\\])*?)\1/gmu;
  for (const match of text.matchAll(assignmentPattern)) {
    const source = match[2];
    if (!source || source.includes("${")) continue;
    pushEntry(entries, source, `${filePath}:${lineNumberForIndex(text, match.index || 0)}`);
  }
};

const collectComponentObjectValues = (entries: AuditEntry[], filePath: string, text: string) => {
  const objectValuePattern = /:\s*(["'`])((?:\\.|(?!\1)[^\\])*?)\1/gmu;
  for (const match of text.matchAll(objectValuePattern)) {
    const source = match[2];
    if (!source || source.includes("${")) continue;
    if (!/\s/u.test(source) && !/[A-Z][a-z]+/.test(source) && !/[A-Z]{2,}/.test(source)) continue;
    pushEntry(entries, source, `${filePath}:${lineNumberForIndex(text, match.index || 0)}`);
  }
};

const dedupeEntries = (entries: AuditEntry[]) => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.issue}::${entry.source}::${entry.origin}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const sortEntries = (entries: AuditEntry[]) =>
  [...entries].sort((left, right) => {
    if (left.issue !== right.issue) {
      return left.issue.localeCompare(right.issue);
    }
    return left.origin.localeCompare(right.origin) || left.source.localeCompare(right.source);
  });

const audit = async () => {
  const entries: AuditEntry[] = [];

  Object.entries(resourceRegistry).forEach(([key, definition]) => collectFromValue(entries, definition, `resourceRegistry.${key}`));
  Object.entries(reportRegistry).forEach(([key, definition]) => collectFromValue(entries, definition, `reportRegistry.${key}`));
  Object.entries(settingsRegistry).forEach(([key, definition]) => collectFromValue(entries, definition, `settingsRegistry.${key}`));
  Object.entries(portalPageRegistry).forEach(([key, definition]) => collectFromValue(entries, definition, `portalPageRegistry.${key}`));

  for (const relativeFile of componentFiles) {
    const absoluteFile = path.join(repoRoot, relativeFile);
    const text = await fs.readFile(absoluteFile, "utf8");
    collectTranslateTextCalls(entries, relativeFile, text);
    collectLiteralAssignments(entries, relativeFile, text);

    if (relativeFile.endsWith("report-workspace.tsx")) {
      collectComponentObjectValues(entries, relativeFile, text);
    }
  }

  const finalEntries = sortEntries(dedupeEntries(entries));
  const issueCounts = finalEntries.reduce<Record<string, number>>(
    (acc, entry) => ({ ...acc, [entry.issue]: (acc[entry.issue] || 0) + 1 }),
    { missing: 0, mixed: 0 },
  );

  console.log(JSON.stringify({ totalIssues: finalEntries.length, issueCounts, entries: finalEntries }, null, 2));
};

void audit();
