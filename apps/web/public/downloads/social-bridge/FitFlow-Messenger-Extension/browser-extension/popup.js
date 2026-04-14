const STORAGE_KEY = "fitflowSocialLinkBridgeState";
const DEFAULT_SERVER_URL = "http://localhost:6273/api";
const EXTENSION_MANIFEST = chrome.runtime.getManifest();

const fields = {
  serverUrl: document.getElementById("serverUrl"),
  tenantKey: document.getElementById("tenantKey"),
  sessionToken: document.getElementById("sessionToken"),
  pairCode: document.getElementById("pairCode"),
  accountHint: document.getElementById("accountHint"),
  providerHints: document.getElementById("providerHints"),
  browserProfile: document.getElementById("browserProfile"),
  deviceSecret: document.getElementById("deviceSecret"),
  deviceCode: document.getElementById("deviceCode"),
  activeTab: document.getElementById("activeTab"),
  lastHeartbeat: document.getElementById("lastHeartbeat"),
  lastSync: document.getElementById("lastSync"),
  statusBox: document.getElementById("statusBox"),
  claimButton: document.getElementById("claimButton"),
  syncButton: document.getElementById("syncButton"),
  heartbeatButton: document.getElementById("heartbeatButton"),
  clearButton: document.getElementById("clearButton"),
};

const normalizeText = (value) => String(value ?? "").trim();

const normalizeTenantKey = (value) => normalizeText(value).toUpperCase() || "MASTER";

const inferProviderFromText = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("messenger") || normalized.includes("facebook")) return "messenger";
  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("zalo")) return "zalo";
  return "";
};

const inferProviderFromManifest = () =>
  inferProviderFromText(`${normalizeText(EXTENSION_MANIFEST.name)} ${normalizeText(EXTENSION_MANIFEST.description)}`);

const normalizeServerUrl = (value) => {
  const trimmed = normalizeText(value).replace(/\/$/, "");
  if (!trimmed) return DEFAULT_SERVER_URL;
  if (/\/api$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
};

const setStatus = (message) => {
  fields.statusBox.textContent = message;
};

const shouldRelinkDevice = (error) =>
  /Khong tim thay thiet bi social bridge|thu hoi lien ket|deviceSecret/i.test(
    normalizeText(error?.message || error),
  );

const storageGet = async () =>
  new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => resolve(result[STORAGE_KEY] || {}));
  });

const storageSet = async (payload) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: payload }, () => resolve());
  });

const detectBrowserName = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("edg/")) return "Edge";
  if (userAgent.includes("chrome/")) return "Chrome";
  if (userAgent.includes("firefox/")) return "Firefox";
  if (userAgent.includes("safari/")) return "Safari";
  return "Browser";
};

const inferProviderFromUrl = (url) => {
  const normalized = normalizeText(url).toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("messenger.com")) return "messenger";
  if (
    (normalized.includes("facebook.com/messages") ||
      normalized.includes("facebook.com/?sk=h_chr") ||
      normalized.includes("facebook.com/?sk=all_messages") ||
      normalized.includes("facebook.com/?sk=messages")) &&
    normalized.includes("facebook.com")
  ) {
    return "messenger";
  }
  if (normalized.includes("web.whatsapp.com") || normalized.includes("whatsapp.com")) return "whatsapp";
  if (normalized.includes("zalo.me")) return "zalo";
  return "";
};

const getActiveTab = async () =>
  new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0] || null));
  });

const getAllTabs = async () =>
  new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => resolve(Array.isArray(tabs) ? tabs : []));
  });

const formatLastSync = (state) => {
  const lastSyncAt = normalizeText(state.lastSyncAt);
  if (!lastSyncAt) return "-";

  const count = Number.parseInt(normalizeText(state.lastSyncCount), 10);
  if (Number.isFinite(count) && count > 0) {
    return `${lastSyncAt} (${count} threads)`;
  }

  return lastSyncAt;
};

const fillForm = (state) => {
  fields.serverUrl.value = normalizeText(state.serverUrl) || DEFAULT_SERVER_URL;
  fields.tenantKey.value = normalizeTenantKey(state.tenantKey);
  fields.sessionToken.value = normalizeText(state.sessionToken);
  fields.pairCode.value = normalizeText(state.pairCode);
  fields.accountHint.value = normalizeText(state.accountHint);
  fields.providerHints.value = normalizeText(state.providerHints) || inferProviderFromManifest();
  fields.browserProfile.value = normalizeText(state.browserProfile);
  fields.deviceSecret.value = normalizeText(state.deviceSecret);
  fields.deviceCode.textContent = normalizeText(state.deviceCode) || "-";
  fields.lastHeartbeat.textContent = normalizeText(state.lastHeartbeatAt) || "-";
  fields.lastSync.dataset.value = normalizeText(state.lastSyncAt);
  fields.lastSync.dataset.count = normalizeText(state.lastSyncCount);
  fields.lastSync.textContent = formatLastSync(state);
};

const clearLinkedDeviceState = async (state) => {
  const nextState = {
    ...state,
    deviceSecret: "",
    deviceCode: "",
    lastHeartbeatAt: "",
    lastSyncAt: "",
    lastSyncCount: "",
  };
  await storageSet(nextState);
  fillForm(nextState);
  return nextState;
};

const collectState = async () => {
  const activeTab = await getActiveTab();
  const activeUrl = normalizeText(activeTab?.url);
  const inferredProvider = inferProviderFromUrl(activeUrl);
  return {
    serverUrl: normalizeServerUrl(fields.serverUrl.value),
    tenantKey: normalizeTenantKey(fields.tenantKey.value),
    sessionToken: normalizeText(fields.sessionToken.value),
    pairCode: normalizeText(fields.pairCode.value).toUpperCase(),
    accountHint: normalizeText(fields.accountHint.value),
    providerHints:
      normalizeText(fields.providerHints.value) ||
      inferredProvider ||
      inferProviderFromManifest(),
    browserProfile: normalizeText(fields.browserProfile.value),
    deviceSecret: normalizeText(fields.deviceSecret.value),
    deviceCode: normalizeText(fields.deviceCode.textContent),
    lastHeartbeatAt: normalizeText(fields.lastHeartbeat.textContent),
    lastSyncAt: normalizeText(fields.lastSync.dataset.value),
    lastSyncCount: normalizeText(fields.lastSync.dataset.count),
    activeUrl,
    activeHost: activeTab?.url ? new URL(activeTab.url).host : "",
    activeTabId: activeTab?.id || null,
    activeTabTitle: normalizeText(activeTab?.title),
    inferredProvider,
  };
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: options.headers || {},
    body: options.body,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message = Array.isArray(data?.message)
      ? data.message.join("; ")
      : normalizeText(data?.message) || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return data;
};

const postJson = async (url, tenantKey, payload) =>
  requestJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-key": tenantKey,
    },
    body: JSON.stringify(payload),
  });

const postAuthedJson = async (url, accessToken, tenantKey, payload) =>
  requestJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "x-tenant-key": tenantKey,
    },
    body: JSON.stringify(payload),
  });

const executeScriptOnTab = async (tabId, func) =>
  new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        world: "MAIN",
        func,
      },
      (results) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message || "Khong chay duoc helper tren tab nay."));
          return;
        }

        resolve(Array.isArray(results) ? results : []);
      },
    );
  });

const readCrmAuthFromTab = async (tabId) => {
  const results = await executeScriptOnTab(tabId, () => {
    try {
      return {
        accessToken: window.localStorage.getItem("fitflow_access_token") || "",
        tenantKey: window.localStorage.getItem("fitflow_tenant_key") || "",
        locationHref: window.location.href || "",
        title: document.title || "",
      };
    } catch (error) {
      return {
        accessToken: "",
        tenantKey: "",
        locationHref: window.location.href || "",
        title: document.title || "",
        error: String(error?.message || error || ""),
      };
    }
  });

  return results?.[0]?.result || null;
};

const looksLikeCrmTab = (tab) => {
  const url = normalizeText(tab?.url).toLowerCase();
  const title = normalizeText(tab?.title).toLowerCase();
  if (!/^https?:\/\//.test(url)) return false;
  if (url.includes("messenger.com") || url.includes("facebook.com/messages")) return false;
  return (
    title.includes("fitflow") ||
    url.includes("localhost:6173") ||
    url.includes("/social/") ||
    url.includes("/members") ||
    url.includes("/dashboard")
  );
};

const findCrmBootstrap = async () => {
  const tabs = await getAllTabs();
  const prioritizedTabs = [...tabs.filter(looksLikeCrmTab), ...tabs.filter((tab) => !looksLikeCrmTab(tab))];

  for (const tab of prioritizedTabs) {
    if (!tab?.id || !/^https?:\/\//.test(normalizeText(tab.url))) {
      continue;
    }

    try {
      const auth = await readCrmAuthFromTab(tab.id);
      if (normalizeText(auth?.accessToken)) {
        return {
          accessToken: normalizeText(auth.accessToken),
          tenantKey: normalizeTenantKey(auth?.tenantKey),
          crmTabId: tab.id,
          crmUrl: normalizeText(auth?.locationHref || tab.url),
          crmTitle: normalizeText(auth?.title || tab.title),
        };
      }
    } catch {
      // Skip tabs that disallow script execution and continue scanning.
    }
  }

  return null;
};

const createSessionFromCrm = async (state, provider) => {
  const crm = await findCrmBootstrap();
  if (!crm?.accessToken) {
    throw new Error("Khong tim thay tab CRM dang dang nhap. Hay mo CRM trong cung trinh duyet roi thu lai.");
  }

  const tenantKey = normalizeTenantKey(crm.tenantKey || state.tenantKey);
  const requestedChannelKey = normalizeText(provider || state.inferredProvider || state.providerHints) || "multi";
  const payload = await postAuthedJson(`${state.serverUrl}/social/linking/sessions`, crm.accessToken, tenantKey, {
    linkMethod: "BROWSER_EXTENSION",
    requestedChannelKey,
    title: `${detectBrowserName()} ${requestedChannelKey} auto link`,
  });

  const sessionToken = normalizeText(payload?.sessionToken);
  const pairCode = normalizeText(payload?.pairCode).toUpperCase();
  if (!sessionToken && !pairCode) {
    throw new Error("CRM da tao session nhung khong tra ve ma lien ket hop le.");
  }

  return {
    tenantKey,
    sessionToken,
    pairCode,
    requestedChannelKey,
    crmTitle: crm.crmTitle,
  };
};

const claimSessionFromState = async (state) => {
  if (!state.sessionToken && !state.pairCode) {
    throw new Error("Can session token hoac pair code de claim session.");
  }

  const payload = await postJson(`${state.serverUrl}/social/linking/public/claim`, state.tenantKey, {
    tenantKey: state.tenantKey,
    sessionToken: state.sessionToken || undefined,
    pairCode: state.pairCode || undefined,
    deviceType: "BROWSER_EXTENSION",
    deviceName: `${detectBrowserName()} extension`,
    platform: navigator.platform || "browser",
    browserName: detectBrowserName(),
    browserProfile: state.browserProfile || undefined,
    appVersion: `extension-${chrome.runtime.getManifest().version}`,
    accountHint: state.accountHint || state.activeHost || undefined,
    providerHints: state.providerHints || undefined,
    clientFingerprint: [navigator.userAgent, state.activeHost].filter(Boolean).join("|"),
    capabilities: {
      browserExtension: true,
      manualHeartbeat: true,
      browserSidebarSync: true,
      activeTabConnected: Boolean(state.activeUrl),
      autoClaimFromCrm: true,
    },
    metadata: {
      source: "browser-extension",
      activeTabUrl: state.activeUrl || "",
      activeTabTitle: state.activeTabTitle || "",
      inferredProvider: state.inferredProvider || "",
    },
  });

  const nextState = {
    ...state,
    tenantKey: normalizeTenantKey(state.tenantKey),
    deviceSecret: normalizeText(payload.deviceSecret),
    deviceCode: normalizeText(payload?.device?.deviceCode),
    lastHeartbeatAt: normalizeText(payload.connectedAt),
    requestedChannelKey: normalizeText(payload.requestedChannelKey) || state.requestedChannelKey,
  };
  await storageSet(nextState);
  fillForm(nextState);
  setStatus(`Claim thanh cong: ${nextState.deviceCode || "-"}`);
  return nextState;
};

const claimSession = async () => {
  const state = await collectState();
  await claimSessionFromState(state);
};

const sendHeartbeatFromState = async (state) => {
  if (!state.deviceSecret) {
    throw new Error("Chua co device secret. Hay claim session truoc.");
  }

  let payload;
  try {
    payload = await postJson(`${state.serverUrl}/social/linking/public/heartbeat`, state.tenantKey, {
      tenantKey: state.tenantKey,
      deviceSecret: state.deviceSecret,
      appVersion: `extension-${chrome.runtime.getManifest().version}`,
      accountHint: state.accountHint || state.activeHost || undefined,
      providerHints: state.providerHints || undefined,
      capabilities: {
        browserExtension: true,
        manualHeartbeat: true,
        browserSidebarSync: true,
      },
      metadata: {
        source: "browser-extension",
        activeTabUrl: state.activeUrl || "",
        activeTabTitle: state.activeTabTitle || "",
      },
    });
  } catch (error) {
    if (shouldRelinkDevice(error)) {
      await clearLinkedDeviceState(state);
    }
    throw error;
  }

  const nextState = {
    ...state,
    requestedChannelKey: normalizeText(payload.requestedChannelKey) || state.requestedChannelKey,
    lastHeartbeatAt: normalizeText(payload.serverTime) || new Date().toISOString(),
  };
  await storageSet(nextState);
  fillForm(nextState);
  setStatus(`Heartbeat OK: ${normalizeText(payload.deviceCode) || "-"}`);
  return nextState;
};

const sendHeartbeat = async () => {
  const state = await collectState();
  await sendHeartbeatFromState(state);
};

const ensureDeviceLinked = async (providedState) => {
  let state = providedState || (await collectState());
  if (state.deviceSecret) {
    return state;
  }

  const provider =
    inferProviderFromUrl(state.activeUrl) ||
    normalizeText(state.inferredProvider) ||
    normalizeText(state.providerHints) ||
    inferProviderFromManifest();

  if (!state.sessionToken && !state.pairCode) {
    setStatus("Dang tim tab CRM de tu tao session...");
    const autoSession = await createSessionFromCrm(state, provider);
    state = {
      ...state,
      tenantKey: autoSession.tenantKey,
      sessionToken: autoSession.sessionToken,
      pairCode: autoSession.pairCode,
      requestedChannelKey: autoSession.requestedChannelKey,
      providerHints: normalizeText(state.providerHints) || provider,
    };
    await storageSet(state);
    fillForm(state);
    setStatus(`Da nhan session tu CRM: ${normalizeText(autoSession.crmTitle) || "FitFlow"}`);
  }

  setStatus("Dang claim thiet bi tu dong...");
  state = await claimSessionFromState(state);

  try {
    state = await sendHeartbeatFromState(state);
  } catch (error) {
    setStatus(`Claim OK, heartbeat chua duoc: ${normalizeText(error?.message || error)}`);
  }

  return state;
};

const requestSnapshotFromActiveTab = async (activeTabId) =>
  new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(activeTabId, { type: "FITFLOW_COLLECT_SNAPSHOT" }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        if (/Receiving end does not exist/i.test(runtimeError.message || "")) {
          reject(new Error("Khong bat duoc content script. Hay tai lai tab Messenger roi bam Sync lai."));
          return;
        }

        reject(new Error(runtimeError.message || "Khong gui duoc yeu cau den tab dang mo."));
        return;
      }

      if (!response?.ok) {
        reject(new Error(normalizeText(response?.error) || "Khong doc duoc sidebar Messenger."));
        return;
      }

      resolve(response);
    });
  });

const reloadTabAndWait = async (activeTabId) =>
  new Promise((resolve, reject) => {
    let timeoutHandle = null;
    const listener = (tabId, changeInfo) => {
      if (tabId !== activeTabId || changeInfo.status !== "complete") {
        return;
      }

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(true);
    };

    chrome.tabs.onUpdated.addListener(listener);
    timeoutHandle = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Reload tab Messenger qua lau, chua the doc sidebar."));
    }, 15000);

    chrome.tabs.reload(activeTabId);
  });

const collectSnapshotWithRetry = async (activeTabId) => {
  try {
    return await requestSnapshotFromActiveTab(activeTabId);
  } catch (error) {
    const message = normalizeText(error?.message || error);
    if (!/content script|Receiving end/i.test(message)) {
      throw error;
    }

    setStatus("Dang tai lai tab Messenger de nap helper...");
    await reloadTabAndWait(activeTabId);
    return requestSnapshotFromActiveTab(activeTabId);
  }
};

const syncActiveTab = async (providedState) => {
  let state = providedState || (await collectState());
  if (!state.deviceSecret) {
    state = await ensureDeviceLinked(state);
  }

  if (!state.activeTabId) {
    throw new Error("Khong tim thay active tab de sync.");
  }

  const provider = inferProviderFromUrl(state.activeUrl);
  if (provider !== "messenger") {
    throw new Error("Hien moi ho tro sync sidebar tu Messenger. Hay mo tab messenger.com hoac facebook.com/messages.");
  }

  const snapshot = await collectSnapshotWithRetry(state.activeTabId);
  const conversations = Array.isArray(snapshot?.conversations) ? snapshot.conversations : [];
  if (!conversations.length) {
    throw new Error("Khong doc duoc danh sach doan chat. Hay mo cot trai Messenger va thu tai lai tab.");
  }

  let payload;
  try {
    payload = await postJson(`${state.serverUrl}/social/linking/public/browser-sync`, state.tenantKey, {
      tenantKey: state.tenantKey,
      deviceSecret: state.deviceSecret,
      provider: snapshot.provider || provider,
      activeUrl: snapshot.activeUrl || state.activeUrl,
      pageTitle: snapshot.pageTitle || state.activeTabTitle || "",
      collectedAt: snapshot.collectedAt || new Date().toISOString(),
      conversations,
      metadata: {
        source: "browser-extension",
        activeHost: state.activeHost || "",
        requestedChannelKey: normalizeText(state.requestedChannelKey),
        browserProfile: state.browserProfile || "",
        extensionVersion: chrome.runtime.getManifest().version,
      },
    });
  } catch (error) {
    if (!shouldRelinkDevice(error)) {
      throw error;
    }

    setStatus("Phat hien phien cu, dang xin lai lien ket tu CRM...");
    state = await clearLinkedDeviceState(state);
    state = await ensureDeviceLinked(state);
    payload = await postJson(`${state.serverUrl}/social/linking/public/browser-sync`, state.tenantKey, {
      tenantKey: state.tenantKey,
      deviceSecret: state.deviceSecret,
      provider: snapshot.provider || provider,
      activeUrl: snapshot.activeUrl || state.activeUrl,
      pageTitle: snapshot.pageTitle || state.activeTabTitle || "",
      collectedAt: snapshot.collectedAt || new Date().toISOString(),
      conversations,
      metadata: {
        source: "browser-extension",
        activeHost: state.activeHost || "",
        requestedChannelKey: normalizeText(state.requestedChannelKey),
        browserProfile: state.browserProfile || "",
        extensionVersion: chrome.runtime.getManifest().version,
      },
    });
  }

  const nextState = {
    ...state,
    providerHints: snapshot.provider || state.providerHints,
    lastSyncAt: normalizeText(payload.serverTime) || new Date().toISOString(),
    lastSyncCount: String(Number(payload.conversationsTouched || conversations.length)),
  };
  await storageSet(nextState);
  fillForm(nextState);
  setStatus(
    `Sync OK: ${normalizeText(payload.deviceCode) || "-"} / ${Number(
      payload.conversationsTouched || conversations.length,
    )} threads`,
  );
};

const tryAutoSync = async (reason) => {
  let state = await collectState();
  const provider = inferProviderFromUrl(state.activeUrl);
  if (provider !== "messenger" || !state.activeTabId) {
    return false;
  }

  if (!state.deviceSecret) {
    setStatus("Dang tu dong lien ket voi CRM...");
    state = await ensureDeviceLinked(state);
  }

  setStatus(reason || "Dang tu dong sync sidebar Messenger...");
  await syncActiveTab(state);
  return true;
};

const clearState = async () => {
  const nextState = {
    serverUrl: DEFAULT_SERVER_URL,
    tenantKey: "MASTER",
  };
  await storageSet(nextState);
  fillForm(nextState);
  setStatus("Da xoa state local cua extension.");
};

const bootstrap = async () => {
  const saved = await storageGet();
  const activeTab = await getActiveTab();
  const activeUrl = normalizeText(activeTab?.url);
  const activeHost = activeUrl ? new URL(activeUrl).host : "-";
  const inferredProvider = inferProviderFromUrl(activeUrl);

  fillForm({
    serverUrl: saved.serverUrl || DEFAULT_SERVER_URL,
    tenantKey: saved.tenantKey || "MASTER",
    sessionToken: saved.sessionToken || "",
    pairCode: saved.pairCode || "",
    accountHint: saved.accountHint || "",
    providerHints: saved.providerHints || inferredProvider || inferProviderFromManifest() || "",
    browserProfile: saved.browserProfile || "",
    deviceSecret: saved.deviceSecret || "",
    deviceCode: saved.deviceCode || "-",
    lastHeartbeatAt: saved.lastHeartbeatAt || "",
    lastSyncAt: saved.lastSyncAt || "",
    lastSyncCount: saved.lastSyncCount || "",
  });

  fields.activeTab.textContent = activeHost;

  fields.claimButton.addEventListener("click", async () => {
    try {
      const state = await collectState();
      const provider = inferProviderFromUrl(state.activeUrl);
      if (provider === "messenger") {
        setStatus("Dang lien ket va sync Messenger...");
        await syncActiveTab(state);
      } else {
        setStatus("Dang lien ket thiet bi...");
        await ensureDeviceLinked(state);
      }
    } catch (error) {
      setStatus(`Lien ket loi: ${normalizeText(error?.message || error)}`);
    }
  });

  fields.syncButton.addEventListener("click", async () => {
    try {
      setStatus("Dang sync sidebar that tu Messenger...");
      await syncActiveTab();
    } catch (error) {
      setStatus(`Sync loi: ${normalizeText(error?.message || error)}`);
    }
  });

  fields.heartbeatButton.addEventListener("click", async () => {
    try {
      setStatus("Dang gui heartbeat...");
      await sendHeartbeat();
    } catch (error) {
      setStatus(`Heartbeat loi: ${normalizeText(error?.message || error)}`);
    }
  });

  fields.clearButton.addEventListener("click", async () => {
    try {
      await clearState();
    } catch (error) {
      setStatus(`Xoa state loi: ${normalizeText(error?.message || error)}`);
    }
  });

  setStatus("Ready. Neu CRM dang mo cung trinh duyet, extension se thu tu dong lien ket va sync sidebar Messenger.");

  try {
    await tryAutoSync("Dang tu dong sync sidebar Messenger...");
  } catch (error) {
    setStatus(`Ready. Tu dong sync chua duoc: ${normalizeText(error?.message || error)}`);
  }
};

bootstrap().catch((error) => {
  setStatus(`Khoi tao extension loi: ${normalizeText(error?.message || error)}`);
});
