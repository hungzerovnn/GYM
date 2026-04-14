export type AppLocale = "vi" | "en" | "ko";

export const supportedLocales: AppLocale[] = ["vi", "en", "ko"];
export const defaultLocale: AppLocale = "vi";
export const localeStorageKey = "fitflow_locale";
export const localeCookieKey = localeStorageKey;

let currentLocale: AppLocale = defaultLocale;

const cp1252ReverseMap: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

const mojibakeFragments = ["Ã", "Â", "â€", "â€™", "â€œ", "â€", "â€“", "â€”", "â€¦", "ðŸ", "Ð", "Ñ", "Ò", "Ó", "Ô", "Õ", "Ö"];
const mojibakeChars = /[\u0080-\u009f\u02c6\u02dc\u2013\u2014\u2018\u2019\u201c\u201d\u2020\u2021\u2022\u2026\u2030\u2039\u203a]/gu;
const mojibakeKoreanPattern = /(?:[ìíîïðñòóôõö÷øùúûüýþÿëêæåœžŸ][^\s]{0,3}){2,}/gu;
const mojibakeSegmentPattern =
  /(?:[ÃÂâÐÑÒÓÔÕÖìíîïðñòóôõö÷øùúûüýþÿëêæåœžŸ][\u0080-\u024f\u02c6\u02dc\u2013\u2014\u2018\u2019\u201c\u201d\u2020\u2021\u2022\u2026\u2030\u2039\u203a]*)|(?:[\u0080-\u009f\u02c6\u02dc\u2013\u2014\u2018\u2019\u201c\u201d\u2020\u2021\u2022\u2026\u2030\u2039\u203a]{2,})/gu;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
const mojibakeLatin1Pattern = /[\u00a1-\u00bf]/gu;
const replacementCharPattern = /\uFFFD/gu;
const controlCharPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu;
const vietnameseCharPattern = /[\u00c0-\u1ef9\u0110\u0111]/gu;
const hangulCharPattern = /[\uac00-\ud7a3]/gu;

export const isSupportedLocale = (value: unknown): value is AppLocale =>
  typeof value === "string" && supportedLocales.includes(value as AppLocale);

export const getCurrentLocale = () => currentLocale;

export const setCurrentLocale = (locale: AppLocale) => {
  currentLocale = locale;
};

const readLocaleCookie = () => {
  if (typeof document === "undefined") {
    return "";
  }

  return document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${localeCookieKey}=`))
    ?.split("=")[1] || "";
};

export const resolveInitialLocale = (preferredLocale?: unknown): AppLocale => {
  if (isSupportedLocale(preferredLocale)) {
    return preferredLocale;
  }

  if (typeof window === "undefined") {
    return defaultLocale;
  }

  const stored = window.localStorage.getItem(localeStorageKey);
  if (isSupportedLocale(stored)) {
    return stored;
  }

  const cookieLocale = readLocaleCookie();
  if (isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  return defaultLocale;
};

const countOccurrences = (value: string, fragment: string) =>
  fragment ? value.split(fragment).length - 1 : 0;

const countPatternMatches = (value: string, pattern: RegExp) => value.match(pattern)?.length || 0;

const scoreMojibake = (value: string) => {
  if (!value) return 0;

  let score = 0;
  for (const fragment of mojibakeFragments) {
    score += countOccurrences(value, fragment) * 5;
  }

  score += countPatternMatches(value, mojibakeChars) * 4;
  score += countPatternMatches(value, mojibakeLatin1Pattern) * 6;
  score += countPatternMatches(value, mojibakeKoreanPattern) * 8;
  score += countPatternMatches(value, replacementCharPattern) * 12;
  score += countPatternMatches(value, controlCharPattern) * 12;
  score -= countPatternMatches(value, vietnameseCharPattern) * 2;
  score -= countPatternMatches(value, hangulCharPattern) * 2;
  return score;
};

const toSingleByteArray = (value: string, mode: "latin1" | "cp1252") => {
  const bytes: number[] = [];

  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined) {
      return null;
    }

    if (mode === "latin1") {
      if (codePoint > 0xff) {
        return null;
      }
      bytes.push(codePoint);
      continue;
    }

    const cp1252Byte = cp1252ReverseMap[codePoint];
    if (cp1252Byte !== undefined) {
      bytes.push(cp1252Byte);
      continue;
    }

    if (codePoint <= 0xff) {
      bytes.push(codePoint);
      continue;
    }

    return null;
  }

  return Uint8Array.from(bytes);
};

const redecodeSingleByte = (value: string, mode: "latin1" | "cp1252") => {
  const bytes = toSingleByteArray(value, mode);
  if (!bytes) {
    return null;
  }

  try {
    const decoded = utf8Decoder.decode(bytes);
    return decoded.includes("\uFFFD") ? null : decoded;
  } catch {
    return null;
  }
};

const repairWholeText = (value: string) => {
  let current = value;
  let currentScore = scoreMojibake(current);

  if (!currentScore) {
    return current;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidates = [redecodeSingleByte(current, "latin1"), redecodeSingleByte(current, "cp1252")].filter(
      (candidate): candidate is string => Boolean(candidate),
    );

    let bestCandidate = current;
    let bestScore = currentScore;

    for (const candidate of candidates) {
      const candidateScore = scoreMojibake(candidate);
      if (candidateScore < bestScore) {
        bestCandidate = candidate;
        bestScore = candidateScore;
      }
    }

    if (bestCandidate === current || bestScore >= currentScore) {
      break;
    }

    current = bestCandidate;
    currentScore = bestScore;

    if (!currentScore) {
      break;
    }
  }

  return current;
};

export const repairMojibakeText = (value: unknown) => {
  if (value === null || value === undefined) return "";

  let current = repairWholeText(String(value).replace(/^\uFEFF/, ""));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    let changed = false;
    current = current.replace(mojibakeSegmentPattern, (segment) => {
      const repaired = repairWholeText(segment);
      if (repaired !== segment) {
        changed = true;
      }
      return repaired;
    });

    if (!changed) {
      break;
    }
  }

  return current.normalize("NFC");
};

export const normalizeUtf8Text = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return repairMojibakeText(value);
};

export const normalizeUtf8Payload = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUtf8Payload(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return (typeof value === "string" ? normalizeUtf8Text(value) : value) as T;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, normalizeUtf8Payload(nested)]),
  ) as T;
};
