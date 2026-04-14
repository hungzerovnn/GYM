#!/usr/bin/env node

import fs from "fs/promises";
import os from "os";
import path from "path";

const BRIDGE_VERSION = "0.1.0";
const DEFAULT_INTERVAL_SECONDS = 45;
const DEFAULT_SERVER_URL = "http://localhost:6273/api";

const print = (message = "") => {
  process.stdout.write(`${message}\n`);
};

const normalizeText = (value) => String(value ?? "").trim();

const normalizeTenantKey = (value) => normalizeText(value).toUpperCase() || "MASTER";

const normalizeServerUrl = (value) => {
  const trimmed = normalizeText(value).replace(/\/$/, "");
  if (!trimmed) return DEFAULT_SERVER_URL;
  if (/\/api$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
};

const readJsonSafe = async (filePath) => {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
};

const resolveConfigPath = () => {
  const override = normalizeText(process.env.FITFLOW_SOCIAL_BRIDGE_CONFIG);
  if (override) return override;

  if (process.platform === "win32") {
    const appData = normalizeText(process.env.APPDATA);
    if (appData) {
      return path.join(appData, "FitFlowSocialBridge", "config.json");
    }
  }

  return path.join(os.homedir(), ".fitflow-social-bridge.json");
};

const ensureParentDir = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const loadConfig = async () => {
  const configPath = resolveConfigPath();
  const data = (await readJsonSafe(configPath)) || {};
  return {
    configPath,
    data,
  };
};

const saveConfig = async (data) => {
  const configPath = resolveConfigPath();
  await ensureParentDir(configPath);
  await fs.writeFile(configPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return configPath;
};

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const rawKey = token.slice(2);
    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      args[rawKey] = "true";
      continue;
    }

    args[rawKey] = nextValue;
    index += 1;
  }

  return args;
};

const showHelp = () => {
  print("Social Bridge CLI");
  print("");
  print("Commands:");
  print("  link --server <url> --tenant <TENANT> --session-token <token>");
  print("  link --server <url> --tenant <TENANT> --pair-code <code>");
  print("  heartbeat [--device-secret <secret>] [--server <url>] [--tenant <TENANT>]");
  print("  run [--interval <seconds>] [--device-secret <secret>] [--server <url>] [--tenant <TENANT>]");
  print("");
  print("Optional flags:");
  print("  --device-name <name>");
  print("  --account-hint <value>");
  print("  --provider-hints <value>");
  print("  --browser-profile <value>");
  print("");
  print(`Config file: ${resolveConfigPath()}`);
};

const getOption = (args, ...keys) => {
  for (const key of keys) {
    const value = normalizeText(args[key]);
    if (value) return value;
  }
  return "";
};

const buildFingerprint = () => {
  const username = normalizeText(process.env.USERNAME || process.env.USER || "");
  return [
    os.hostname(),
    process.platform,
    process.arch,
    os.release(),
    username,
  ]
    .filter(Boolean)
    .join("|");
};

const detectProviderHints = () => {
  const currentDirectory = normalizeText(process.cwd()).toLowerCase();
  if (currentDirectory.includes("facebook")) return "facebook-messenger";
  if (currentDirectory.includes("zalo")) return "zalo-oa";
  if (currentDirectory.includes("whatsapp")) return "whatsapp";
  return "";
};

const buildDeviceName = (override) => {
  const username = normalizeText(process.env.USERNAME || process.env.USER || "");
  if (normalizeText(override)) return normalizeText(override);
  if (username) return `${os.hostname()} (${username})`;
  return os.hostname();
};

const parseResponseError = async (response) => {
  try {
    const payload = await response.json();
    if (typeof payload?.message === "string") return payload.message;
    if (Array.isArray(payload?.message)) return payload.message.join("; ");
    return JSON.stringify(payload);
  } catch {
    return `${response.status} ${response.statusText}`;
  }
};

const postJson = async ({ url, tenantKey, body }) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `gym-social-bridge/${BRIDGE_VERSION}`,
      "x-tenant-key": tenantKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseResponseError(response));
  }

  return response.json();
};

const buildRuntimeContext = async (args) => {
  const { data: config } = await loadConfig();
  const serverUrl = normalizeServerUrl(
    getOption(args, "server", "api-url") || config.serverUrl || DEFAULT_SERVER_URL,
  );
  const tenantKey = normalizeTenantKey(
    getOption(args, "tenant", "tenant-key") || config.tenantKey || "MASTER",
  );

  return {
    config,
    serverUrl,
    tenantKey,
  };
};

const linkCommand = async (args) => {
  const { config, serverUrl, tenantKey } = await buildRuntimeContext(args);
  const sessionToken = getOption(args, "session-token", "sessionToken");
  const pairCode = normalizeText(getOption(args, "pair-code", "pairCode")).toUpperCase();

  if (!sessionToken && !pairCode) {
    throw new Error("Can --session-token hoac --pair-code de lien ket thiet bi desktop.");
  }

  const payload = await postJson({
    url: `${serverUrl}/social/linking/public/claim`,
    tenantKey,
    body: {
      tenantKey,
      sessionToken: sessionToken || undefined,
      pairCode: pairCode || undefined,
      deviceType: "DESKTOP",
      deviceName: buildDeviceName(getOption(args, "device-name", "deviceName")),
      platform: process.platform,
      osVersion: os.release(),
      browserName: "Social Bridge",
      browserProfile: getOption(args, "browser-profile", "browserProfile") || undefined,
      appVersion: BRIDGE_VERSION,
      accountHint:
        getOption(args, "account-hint", "accountHint") ||
        normalizeText(process.env.USERNAME || process.env.USER || "") ||
        undefined,
      providerHints:
        getOption(args, "provider-hints", "providerHints") ||
        detectProviderHints() ||
        undefined,
      clientFingerprint: buildFingerprint(),
      capabilities: {
        heartbeat: true,
        desktopBridge: true,
        localProcess: true,
      },
      metadata: {
        source: "social-bridge-cli",
        processId: process.pid,
        cwd: process.cwd(),
      },
    },
  });

  const configPath = await saveConfig({
    ...config,
    serverUrl,
    tenantKey,
    requestedChannelKey: payload.requestedChannelKey || config.requestedChannelKey || "multi",
    lastLinkedAt: payload.connectedAt || new Date().toISOString(),
    deviceSecret: payload.deviceSecret,
    heartbeatUrl: payload.heartbeatUrl || `${serverUrl}/social/linking/public/heartbeat`,
    device: payload.device || {},
  });

  print("Lien ket desktop thanh cong.");
  print(`  Tenant: ${tenantKey}`);
  print(`  Server: ${serverUrl}`);
  print(`  Device: ${normalizeText(payload?.device?.deviceName) || "-"}`);
  print(`  Device code: ${normalizeText(payload?.device?.deviceCode) || "-"}`);
  print(`  Requested channel: ${normalizeText(payload?.requestedChannelKey) || "multi"}`);
  print(`  Config saved: ${configPath}`);
  print("");
  print("Device secret:");
  print(normalizeText(payload.deviceSecret));
};

const heartbeatCommand = async (args) => {
  const { config, serverUrl, tenantKey } = await buildRuntimeContext(args);
  const deviceSecret = getOption(args, "device-secret", "deviceSecret") || normalizeText(config.deviceSecret);
  if (!deviceSecret) {
    throw new Error("Khong tim thay device secret. Hay chay lenh link truoc, hoac truyen --device-secret.");
  }

  const payload = await postJson({
    url: normalizeText(config.heartbeatUrl) || `${serverUrl}/social/linking/public/heartbeat`,
    tenantKey,
    body: {
      tenantKey,
      deviceSecret,
      appVersion: BRIDGE_VERSION,
      accountHint:
        getOption(args, "account-hint", "accountHint") ||
        normalizeText(config?.device?.deviceName) ||
        undefined,
      providerHints:
        getOption(args, "provider-hints", "providerHints") ||
        normalizeText(config.requestedChannelKey) ||
        undefined,
      capabilities: {
        heartbeat: true,
        desktopBridge: true,
      },
      metadata: {
        source: "social-bridge-cli",
        heartbeatAt: new Date().toISOString(),
      },
    },
  });

  await saveConfig({
    ...config,
    serverUrl,
    tenantKey,
    deviceSecret,
    heartbeatUrl: normalizeText(config.heartbeatUrl) || `${serverUrl}/social/linking/public/heartbeat`,
    requestedChannelKey: payload.requestedChannelKey || config.requestedChannelKey || "multi",
    lastHeartbeatAt: payload.serverTime || new Date().toISOString(),
    device: config.device || {},
  });

  print(
    `Heartbeat OK: ${normalizeText(payload.deviceCode) || "-"} @ ${normalizeText(payload.serverTime) || new Date().toISOString()}`,
  );
};

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const runCommand = async (args) => {
  const intervalSeconds = Math.max(
    10,
    Number.parseInt(getOption(args, "interval"), 10) || DEFAULT_INTERVAL_SECONDS,
  );
  const { data: config } = await loadConfig();
  const hasLinkedSecret = Boolean(
    getOption(args, "device-secret", "deviceSecret") || normalizeText(config.deviceSecret),
  );
  const hasSessionReference = Boolean(
    getOption(args, "session-token", "sessionToken") || getOption(args, "pair-code", "pairCode"),
  );

  if (!hasLinkedSecret && hasSessionReference) {
    await linkCommand(args);
  }

  if (
    !hasLinkedSecret &&
    !hasSessionReference &&
    !normalizeText(config.deviceSecret)
  ) {
    throw new Error(
      "Chua co session hoac device secret. Hay chay 'link' truoc, hoac dung 'run --session-token ...'.",
    );
  }

  let shouldStop = false;
  process.on("SIGINT", () => {
    shouldStop = true;
    print("");
    print("Dang dung heartbeat loop...");
  });
  process.on("SIGTERM", () => {
    shouldStop = true;
  });

  print(`Bat dau heartbeat moi ${intervalSeconds} giay. Nhan Ctrl+C de dung.`);

  while (!shouldStop) {
    try {
      await heartbeatCommand(args);
    } catch (error) {
      print(`Heartbeat loi: ${normalizeText(error?.message || error)}`);
    }

    if (shouldStop) break;
    await wait(intervalSeconds * 1000);
  }

  print("Da dung Social Bridge.");
};

const main = async () => {
  const [command = "help", ...argv] = process.argv.slice(2);
  const args = parseArgs(argv);

  if (command === "help" || args.help === "true") {
    showHelp();
    return;
  }

  if (command === "link") {
    await linkCommand(args);
    return;
  }

  if (command === "heartbeat") {
    await heartbeatCommand(args);
    return;
  }

  if (command === "run") {
    await runCommand(args);
    return;
  }

  throw new Error(`Lenh khong hop le: ${command}`);
};

main().catch((error) => {
  print(`Social Bridge loi: ${normalizeText(error?.message || error)}`);
  process.exitCode = 1;
});
