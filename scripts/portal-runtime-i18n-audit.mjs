import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const WEB_URL = process.env.FITFLOW_WEB_URL || "http://localhost:6173";
const API_URL = process.env.FITFLOW_API_URL || "http://localhost:6273/api";
const TENANT_KEY = process.env.FITFLOW_TENANT_KEY || "MASTER";
const IDENTIFIER = process.env.FITFLOW_IDENTIFIER || "admin@fitflow.local";
const PASSWORD = process.env.FITFLOW_PASSWORD || "Admin@123";
const LOCALE = process.env.FITFLOW_LOCALE || "vi";
const outputDirName = process.env.FITFLOW_OUTPUT_DIR_NAME || "portal-runtime-i18n-audit";

const moduleConfigPath = path.join(repoRoot, "apps", "web", "lib", "module-config.ts");
const outputDir = path.join(repoRoot, ".tmp", outputDirName);
const screenshotDir = path.join(outputDir, "screenshots");
const outputPath = path.join(outputDir, "results.json");

const selectedRouteFilters = String(process.env.FITFLOW_ROUTE_FILTER || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const baseForbiddenPhrases = [
  "template preview",
  "template giao an",
  "upload max mb",
  "qr template / url",
  "template qr",
  "branch scope",
  "default channel",
  "audience rule",
  "provider, sender, quota",
  "smtp / provider",
  "otp login",
  "login he thong",
  "hoi vien active",
  "hd active",
  "pt active",
  "logo url",
  "app url",
  "avatar url",
];

const normalizeAuditText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const extraForbiddenPhrases = String(process.env.FITFLOW_FORBIDDEN_PHRASES || "")
  .split(",")
  .map((item) => normalizeAuditText(item))
  .filter(Boolean);

const forbiddenPhrases = Array.from(new Set([...baseForbiddenPhrases.map((phrase) => normalizeAuditText(phrase)), ...extraForbiddenPhrases]));

const allowedHangulTokens = new Set(["한국어"]);
const hangulPattern = /[가-힣]+/gu;
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

const cp1252ReverseMap = {
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

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const sanitizeFileName = (value) => value.replace(/[<>:"/\\|?*\s]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");

const toSingleByteArray = (value, mode) => {
  const bytes = [];

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

const redecodeSingleByte = (value, mode) => {
  const bytes = toSingleByteArray(value, mode);
  if (!bytes) {
    return null;
  }

  try {
    return utf8Decoder.decode(bytes);
  } catch {
    return null;
  }
};

const detectMojibakeTokens = (text) => {
  const hits = [];
  const seen = new Set();
  const tokens = String(text).match(/[^\s]+/gu) || [];

  for (const token of tokens) {
    if (!/[^\u0000-\u007f]/u.test(token)) continue;

    for (const mode of ["latin1", "cp1252"]) {
      const repaired = redecodeSingleByte(token, mode);
      if (!repaired || repaired === token) continue;
      if (!/[\p{L}\p{N}]/u.test(repaired)) continue;

      const signature = `${token} -> ${repaired}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      hits.push(signature);
      break;
    }

    if (hits.length >= 12) {
      break;
    }
  }

  return hits;
};

const waitForPageSettle = async (page, timeoutMs = 1800) => {
  await Promise.race([
    page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {}),
    page.waitForTimeout(timeoutMs),
  ]);
};

const collectDomTextFragments = async (locator) =>
  locator.evaluate((root) => {
    const fragments = [];
    const seen = new Set();

    const push = (value) => {
      const normalized = String(value || "")
        .replace(/\s+/g, " ")
        .trim();

      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      fragments.push(normalized);
    };

    push(root.innerText || "");

    root.querySelectorAll("input, textarea, select").forEach((element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        push(element.placeholder);
        push(element.value);
        push(element.getAttribute("aria-label"));
        push(element.getAttribute("title"));
        return;
      }

      if (element instanceof HTMLSelectElement) {
        push(element.getAttribute("aria-label"));
        push(element.getAttribute("title"));
        push(element.options[element.selectedIndex]?.textContent || "");
        Array.from(element.options).forEach((option) => {
          push(option.textContent || "");
        });
      }
    });

    root.querySelectorAll("[placeholder], [aria-label], [title]").forEach((element) => {
      push(element.getAttribute("placeholder"));
      push(element.getAttribute("aria-label"));
      push(element.getAttribute("title"));
    });

    return fragments;
  });

const resolvePlaywrightModulePath = () => {
  const pathEntries = String(process.env.PATH || "").split(path.delimiter);

  for (const entry of pathEntries) {
    if (!entry || !entry.includes(`${path.sep}node_modules${path.sep}.bin`)) continue;

    const moduleRoot = path.resolve(entry, "..");
    const playwrightPath = path.join(moduleRoot, "playwright", "index.mjs");

    try {
      return pathToFileURL(playwrightPath).href;
    } catch {
      continue;
    }
  }

  throw new Error(
    'Could not resolve the temporary "playwright" package. Run this script via: npm exec --yes --package=playwright -- node scripts/portal-runtime-i18n-audit.mjs',
  );
};

const loadPlaywright = async () => import(resolvePlaywrightModulePath());

const createRecorder = (page) => {
  const events = {
    pageErrors: [],
    consoleErrors: [],
    requestFailures: [],
    responseErrors: [],
  };

  const onPageError = (error) => {
    events.pageErrors.push(String(error?.message || error));
  };

  const onConsole = (message) => {
    if (message.type() === "error") {
      events.consoleErrors.push(message.text());
    }
  };

  const onRequestFailed = (request) => {
    const url = request.url();
    if (!url.startsWith(API_URL)) return;

    const failureText = request.failure()?.errorText || "request failed";
    if (failureText.includes("ERR_ABORTED")) return;
    events.requestFailures.push(`${request.method()} ${url} :: ${failureText}`);
  };

  const onResponse = async (response) => {
    const url = response.url();
    if (!url.startsWith(API_URL) || response.status() < 400) return;
    events.responseErrors.push(`${response.status()} ${response.request().method()} ${url}`);
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  return {
    events,
    detach() {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    },
  };
};

const loginByApi = async () => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-key": TENANT_KEY,
    },
    body: JSON.stringify({
      identifier: IDENTIFIER,
      password: PASSWORD,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.accessToken) {
    throw new Error(`Login failed for ${IDENTIFIER}: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
};

const extractPortalRoutes = (source) => {
  const registryStart = source.indexOf("export const portalPageRegistry");
  const registryEnd = source.indexOf("const contractStatusOptions", registryStart);

  if (registryStart === -1 || registryEnd === -1 || registryEnd <= registryStart) {
    throw new Error("Could not locate portalPageRegistry in module-config.ts");
  }

  const registrySource = source.slice(registryStart, registryEnd);
  const routePattern = /^  (?:"([^"]+)"|([A-Za-z0-9_-]+)):\s*\{\s*[\r\n]+\s*kind:\s*"(dashboard|resource|report|setting)"/gm;
  const routes = [];

  for (const match of registrySource.matchAll(routePattern)) {
    const routeKey = match[1] || match[2];
    if (!routeKey) continue;
    routes.push(routeKey === "dashboard" ? "/dashboard" : `/${routeKey}`);
  }

  const uniqueRoutes = Array.from(new Set(routes)).sort((left, right) => left.localeCompare(right));
  if (!selectedRouteFilters.length) {
    return uniqueRoutes;
  }

  return uniqueRoutes.filter((route) => selectedRouteFilters.some((filter) => route.includes(filter)));
};

const collectTextIssues = (text) => {
  const normalized = normalizeText(text);
  const phraseHits = forbiddenPhrases.filter((phrase) => normalized.includes(phrase));
  const mojibakeHits = detectMojibakeTokens(text);
  const hangulHits =
    LOCALE === "ko" ? [] : Array.from(new Set((String(text).match(hangulPattern) || []).filter((token) => !allowedHangulTokens.has(token))));

  return {
    forbiddenPhraseHits: phraseHits,
    mojibakeHits,
    hangulHits,
    hasIssue: Boolean(phraseHits.length || mojibakeHits.length || hangulHits.length),
  };
};

const main = async () => {
  const { chromium } = await loadPlaywright();
  const moduleConfigSource = await fs.readFile(moduleConfigPath, "utf8");
  const routes = extractPortalRoutes(moduleConfigSource);

  await fs.mkdir(screenshotDir, { recursive: true });

  const loginPayload = await loginByApi();
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 960 },
  });

  await context.addCookies([
    {
      name: "fitflow_locale",
      value: LOCALE,
      url: WEB_URL,
    },
  ]);

  await context.addInitScript(
    ({ accessToken, tenantKey, locale }) => {
      window.localStorage.setItem("fitflow_access_token", accessToken);
      window.localStorage.setItem("fitflow_tenant_key", tenantKey);
      window.localStorage.setItem("fitflow_locale", locale);
      document.cookie = `fitflow_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
    },
    {
      accessToken: loginPayload.accessToken,
      tenantKey: TENANT_KEY,
      locale: LOCALE,
    },
  );

  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(25000);

  const results = {
    generatedAt: new Date().toISOString(),
    webUrl: WEB_URL,
    apiUrl: API_URL,
    tenantKey: TENANT_KEY,
    locale: LOCALE,
    routeCount: routes.length,
    routes: [],
  };

  try {
    await page.goto(`${WEB_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForPageSettle(page, 1800);

    if (page.url().includes("/login")) {
      throw new Error("Browser session redirected to login after bootstrap.");
    }

    for (const route of routes) {
      console.log(`[i18n-audit] scanning ${route}`);
      const recorder = createRecorder(page);
      const routeResult = {
        route,
        detailOpened: false,
        forbiddenPhraseHits: [],
        mojibakeHits: [],
        hangulHits: [],
        pageErrors: [],
        consoleErrors: [],
        requestFailures: [],
        responseErrors: [],
        screenshotPath: null,
        hasIssue: false,
      };

      try {
        await page.goto(`${WEB_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await waitForPageSettle(page, 2200);

        if (page.url().includes("/login")) {
          throw new Error(`Redirected to login while opening ${route}`);
        }

        const samples = [(await collectDomTextFragments(page.locator("body"))).join("\n")];

        const firstRow = page.locator("tbody tr").first();
        const rowCount = await firstRow.count();
        if (rowCount) {
          const firstButton = firstRow.locator("button").first();
          if (await firstButton.count()) {
            await firstButton.click().catch(() => {});
            const drawer = page.locator("div.fixed.inset-0.z-50").last();
            if (await drawer.isVisible().catch(() => false)) {
              routeResult.detailOpened = true;
              await page.waitForTimeout(300);
              samples.push((await collectDomTextFragments(drawer).catch(() => [])).join("\n"));
            }
          }
        }

        const mergedText = samples.join("\n");
        const issueSummary = collectTextIssues(mergedText);
        routeResult.forbiddenPhraseHits = issueSummary.forbiddenPhraseHits;
        routeResult.mojibakeHits = issueSummary.mojibakeHits;
        routeResult.hangulHits = issueSummary.hangulHits;
      } catch (error) {
        routeResult.pageErrors.push(String(error?.message || error));
      } finally {
        recorder.detach();
        routeResult.pageErrors.push(...recorder.events.pageErrors);
        routeResult.consoleErrors.push(...recorder.events.consoleErrors);
        routeResult.requestFailures.push(...recorder.events.requestFailures);
        routeResult.responseErrors.push(...recorder.events.responseErrors);
        routeResult.hasIssue =
          routeResult.forbiddenPhraseHits.length > 0 ||
          routeResult.mojibakeHits.length > 0 ||
          routeResult.hangulHits.length > 0 ||
          routeResult.pageErrors.length > 0 ||
          routeResult.consoleErrors.length > 0 ||
          routeResult.requestFailures.length > 0 ||
          routeResult.responseErrors.length > 0;

        if (routeResult.hasIssue) {
          const screenshotPath = path.join(screenshotDir, `${sanitizeFileName(route)}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
          routeResult.screenshotPath = screenshotPath;
        }

        results.routes.push(routeResult);
      }
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const summary = {
    totalRoutes: results.routes.length,
    issueRoutes: results.routes.filter((route) => route.hasIssue).length,
    phraseLeakRoutes: results.routes.filter((route) => route.forbiddenPhraseHits.length).length,
    mojibakeRoutes: results.routes.filter((route) => route.mojibakeHits.length).length,
    hangulRoutes: results.routes.filter((route) => route.hangulHits.length).length,
    pageErrorRoutes: results.routes.filter((route) => route.pageErrors.length).length,
    consoleErrorRoutes: results.routes.filter((route) => route.consoleErrors.length).length,
    requestFailureRoutes: results.routes.filter((route) => route.requestFailures.length).length,
    responseErrorRoutes: results.routes.filter((route) => route.responseErrors.length).length,
  };

  const output = {
    ...results,
    summary,
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(summary, null, 2));

  if (summary.issueRoutes > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
