import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const WEB_URL = process.env.FITFLOW_WEB_URL || "http://localhost:6173";
const API_URL = process.env.FITFLOW_API_URL || "http://localhost:6273/api";
const TENANT_KEY = process.env.FITFLOW_TENANT_KEY || "MASTER";
const DEFAULT_PASSWORD = process.env.FITFLOW_PASSWORD || "Admin@123";
const selectedRoleCodes = new Set(
  String(process.env.FITFLOW_ROLE_CODES || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);
const selectedRouteFilters = String(process.env.FITFLOW_ROUTE_FILTER || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const moduleConfigPath = path.join(repoRoot, "apps", "web", "lib", "module-config.ts");
const outputPath = path.join(repoRoot, ".tmp", "qa-role-create-dialog-results.json");
const screenshotDir = path.join(repoRoot, ".tmp", "qa-role-create-dialog");

const roleAccounts = [
  { roleCode: "branch_manager", identifier: "manager@fitflow.local" },
  { roleCode: "sales", identifier: "sales@fitflow.local" },
  { roleCode: "customer_care", identifier: "cskh@fitflow.local" },
  { roleCode: "accountant", identifier: "accountant@fitflow.local" },
  { roleCode: "trainer", identifier: "trainer@fitflow.local" },
  { roleCode: "hr", identifier: "hr@fitflow.local" },
].filter((account) => !selectedRoleCodes.size || selectedRoleCodes.has(account.roleCode));

const extractResourceRoutes = (source) => {
  const registryStart = source.indexOf("export const portalPageRegistry");
  const registryEnd = source.indexOf("const contractStatusOptions", registryStart);

  if (registryStart === -1 || registryEnd === -1 || registryEnd <= registryStart) {
    throw new Error("Could not locate portalPageRegistry in module-config.ts");
  }

  const registrySource = source.slice(registryStart, registryEnd);
  const routePattern = /^\s*(?:"([^"]+)"|([A-Za-z0-9_-]+)):\s*\{\s*kind:\s*"resource"/gm;
  const routes = [];

  for (const match of registrySource.matchAll(routePattern)) {
    const routeKey = match[1] || match[2];
    if (!routeKey || routeKey === "dashboard") continue;
    routes.push(`/${routeKey}`);
  }

  const uniqueRoutes = Array.from(new Set(routes)).sort((left, right) => left.localeCompare(right));
  if (!selectedRouteFilters.length) {
    return uniqueRoutes;
  }

  return uniqueRoutes.filter((route) => selectedRouteFilters.some((filter) => route.includes(filter)));
};

const sanitizeFileName = (value) => value.replace(/[<>:"/\\|?*\s]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");

const trimList = (items, limit = 8) => items.slice(0, limit);

const bodyHas = (bodyText, patterns) => patterns.some((pattern) => pattern.test(bodyText));

const resolvePlaywrightModulePath = () => {
  const pathEntries = String(process.env.PATH || "").split(path.delimiter);

  for (const entry of pathEntries) {
    if (!entry) continue;
    if (!entry.includes(`${path.sep}node_modules${path.sep}.bin`)) continue;

    const moduleRoot = path.resolve(entry, "..");
    const playwrightPath = path.join(moduleRoot, "playwright", "index.mjs");

    try {
      return pathToFileURL(playwrightPath).href;
    } catch {
      continue;
    }
  }

  throw new Error(
    'Could not resolve the temporary "playwright" package. Run this script via: npm exec --yes --package=playwright -- node scripts/role-create-dialog-crawl.mjs',
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
    if (failureText.includes("ERR_ABORTED")) {
      return;
    }
    events.requestFailures.push(`${request.method()} ${url} :: ${failureText}`);
  };

  const onResponse = async (response) => {
    const url = response.url();
    if (!url.startsWith(API_URL) || response.status() < 400) return;

    let details = "";
    try {
      const contentType = response.headers()["content-type"] || "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        const message =
          typeof payload?.message === "string"
            ? payload.message
            : Array.isArray(payload?.message)
              ? payload.message.join("; ")
              : "";
        details = message ? ` :: ${message}` : "";
      }
    } catch {
      details = "";
    }

    events.responseErrors.push(`${response.status()} ${response.request().method()} ${url}${details}`);
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

const loginByApi = async (identifier) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tenant-key": TENANT_KEY,
    },
    body: JSON.stringify({
      identifier,
      password: DEFAULT_PASSWORD,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.accessToken) {
    throw new Error(`Login failed for ${identifier}: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
};

const summarizeRole = (entries) => ({
  scannedRoutes: entries.length,
  unauthorizedRoutes: entries.filter((entry) => entry.unauthorized).length,
  accessibleRoutes: entries.filter((entry) => !entry.unauthorized).length,
  createCapableRoutes: entries.filter((entry) => entry.hasCreateButton).length,
  openedDialogs: entries.filter((entry) => entry.dialogOpened).length,
  issueCount: entries.filter((entry) => entry.hasIssue).length,
});

const waitForPageSettle = async (page, timeoutMs = 1800) => {
  await Promise.race([
    page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {}),
    page.waitForTimeout(timeoutMs),
  ]);
};

const main = async () => {
  const { chromium } = await loadPlaywright();
  const moduleConfigSource = await fs.readFile(moduleConfigPath, "utf8");
  const resourceRoutes = extractResourceRoutes(moduleConfigSource);

  await fs.mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const output = {
    generatedAt: new Date().toISOString(),
    webUrl: WEB_URL,
    apiUrl: API_URL,
    tenantKey: TENANT_KEY,
    routeCount: resourceRoutes.length,
    roles: [],
  };

  const issues = [];

  try {
    for (const account of roleAccounts) {
      const loginPayload = await loginByApi(account.identifier);
      const context = await browser.newContext({
        viewport: { width: 1600, height: 960 },
      });

      await context.addInitScript(
        ({ accessToken, tenantKey }) => {
          window.localStorage.setItem("fitflow_access_token", accessToken);
          window.localStorage.setItem("fitflow_tenant_key", tenantKey);
        },
        {
          accessToken: loginPayload.accessToken,
          tenantKey: TENANT_KEY,
        },
      );

      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      page.setDefaultNavigationTimeout(15000);
      await page.goto(`${WEB_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await waitForPageSettle(page, 1500);

      if (page.url().includes("/login")) {
        throw new Error(`Browser session redirected to login for role ${account.roleCode}`);
      }

      const roleEntries = [];

      for (const route of resourceRoutes) {
        console.log(`[${account.roleCode}] scanning ${route}`);
        const recorder = createRecorder(page);
        const entry = {
          roleCode: account.roleCode,
          route,
          unauthorized: false,
          moduleError: false,
          hasCreateButton: false,
          dialogOpened: false,
          exception: null,
          pageErrors: [],
          consoleErrors: [],
          requestFailures: [],
          responseErrors: [],
          screenshot: null,
          hasIssue: false,
        };

        try {
          await page.goto(`${WEB_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 12000 });
          await waitForPageSettle(page);

          const bodyText = await page.locator("body").innerText().catch(() => "");
          entry.unauthorized = bodyHas(bodyText, [
            /Khong co quyen xem module/i,
            /Không có quyền xem module/i,
            /Không co quyền xem module/i,
            /không co quyền xem module/i,
            /does not have access to this module/i,
          ]);
          entry.moduleError = bodyHas(bodyText, [
            /Module gap loi/i,
            /Không tải được dữ liệu module này/i,
            /Không tai duoc du lieu module nay/i,
            /Khong tai duoc du lieu module nay/i,
          ]);

          if (!entry.unauthorized && !entry.moduleError) {
            const createButton = page.locator("button.primary-button").first();
            entry.hasCreateButton = await createButton.isVisible().catch(() => false);

            if (entry.hasCreateButton) {
              await createButton.click();
              entry.dialogOpened = await page
                .locator("div.fixed.inset-0.z-50 form")
                .first()
                .waitFor({ state: "visible", timeout: 5000 })
                .then(() => true)
                .catch(() => false);

              await waitForPageSettle(page, 1400);

              if (entry.dialogOpened) {
                await page.locator("div.fixed.inset-0.z-50 button.secondary-button").first().click().catch(() => {});
                await page.waitForTimeout(120);
              }
            }
          }
        } catch (error) {
          entry.exception = String(error?.message || error);
        } finally {
          recorder.detach();
        }

        entry.pageErrors = trimList(recorder.events.pageErrors);
        entry.consoleErrors = trimList(recorder.events.consoleErrors);
        entry.requestFailures = trimList(recorder.events.requestFailures);
        entry.responseErrors = trimList(recorder.events.responseErrors);

        entry.hasIssue =
          Boolean(entry.exception) ||
          entry.moduleError ||
          entry.pageErrors.length > 0 ||
          entry.consoleErrors.length > 0 ||
          entry.requestFailures.length > 0 ||
          entry.responseErrors.length > 0 ||
          (entry.hasCreateButton && !entry.dialogOpened);

        if (entry.hasIssue) {
          const screenshotName = sanitizeFileName(`${account.roleCode}-${route || "root"}`) || account.roleCode;
          const screenshotPath = path.join(screenshotDir, `${screenshotName}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
          entry.screenshot = path.relative(repoRoot, screenshotPath).replace(/\\/g, "/");
          issues.push(entry);
        }

        roleEntries.push(entry);
      }

      output.roles.push({
        roleCode: account.roleCode,
        identifier: account.identifier,
        summary: summarizeRole(roleEntries),
        entries: roleEntries,
      });

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(output, null, 2));

      await context.close();
    }
  } finally {
    await browser.close();
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));

  const summaryLines = output.roles.map(
    (role) =>
      `${role.roleCode}: scanned=${role.summary.scannedRoutes}, accessible=${role.summary.accessibleRoutes}, create=${role.summary.createCapableRoutes}, opened=${role.summary.openedDialogs}, issues=${role.summary.issueCount}`,
  );

  console.log(`Resource routes scanned: ${resourceRoutes.length}`);
  console.log(summaryLines.join("\n"));
  console.log(`Detailed output: ${path.relative(repoRoot, outputPath).replace(/\\/g, "/")}`);

  if (issues.length) {
    console.error("\nIssues found:");
    for (const issue of issues) {
      const details = [
        issue.exception,
        ...issue.responseErrors,
        ...issue.requestFailures,
        ...issue.pageErrors,
        ...issue.consoleErrors,
      ]
        .filter(Boolean)
        .join(" | ");

      console.error(`- ${issue.roleCode} ${issue.route}${details ? ` :: ${details}` : ""}`);
    }

    process.exitCode = 1;
  }
};

await main();
