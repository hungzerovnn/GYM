const STORAGE_KEY = "fitflowSocialLinkBridgeState";
const DEFAULT_SERVER_URL = "http://localhost:6273/api";
const AUTO_SYNC_COOLDOWN_MS = 15000;

let autoSyncChain = Promise.resolve();

const normalizeText = (value) => String(value ?? "").trim();

const normalizeTenantKey = (value) => normalizeText(value).toUpperCase() || "MASTER";

const normalizeServerUrl = (value) => {
  const trimmed = normalizeText(value).replace(/\/$/, "");
  if (!trimmed) return DEFAULT_SERVER_URL;
  if (/\/api$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api`;
};

const detectBrowserName = () => {
  const userAgent = String(self.navigator?.userAgent || "").toLowerCase();
  if (userAgent.includes("edg/")) return "Edge";
  if (userAgent.includes("chrome/")) return "Chrome";
  if (userAgent.includes("firefox/")) return "Firefox";
  if (userAgent.includes("safari/")) return "Safari";
  return "Browser";
};

const shouldRelinkDevice = (error) =>
  /Khong tim thay thiet bi social bridge|thu hoi lien ket|deviceSecret/i.test(
    normalizeText(error?.message || error),
  );

const isMessengerUrl = (url) => {
  const normalized = normalizeText(url).toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("messenger.com")) return true;
  if (!normalized.includes("facebook.com")) return false;
  return (
    normalized.includes("/messages") ||
    normalized.includes("?sk=messages") ||
    normalized.includes("?sk=h_chr") ||
    normalized.includes("?sk=all_messages") ||
    normalized.includes("/t/")
  );
};

const storageGet = async () =>
  new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => resolve(result[STORAGE_KEY] || {}));
  });

const storageSet = async (payload) =>
  new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: payload }, () => resolve());
  });

const getAllTabs = async () =>
  new Promise((resolve) => {
    chrome.tabs.query({}, (tabs) => resolve(Array.isArray(tabs) ? tabs : []));
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

const mergeState = async (patch) => {
  const current = await storageGet();
  const nextState = {
    ...current,
    ...patch,
  };
  await storageSet(nextState);
  return nextState;
};

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
          crmUrl: normalizeText(auth?.locationHref || tab.url),
          crmTitle: normalizeText(auth?.title || tab.title),
        };
      }
    } catch {
      // Ignore tabs that do not allow script execution.
    }
  }

  return null;
};

const primeCrmAuthFromTabs = async () => {
  const crm = await findCrmBootstrap();
  if (!crm?.accessToken) {
    return null;
  }

  return mergeState({
    crmAccessToken: crm.accessToken,
    tenantKey: crm.tenantKey,
    crmUrl: crm.crmUrl,
    crmTitle: crm.crmTitle,
    lastCrmAuthAt: new Date().toISOString(),
  });
};

const ensureCrmBootstrap = async (state) => {
  if (normalizeText(state?.crmAccessToken)) {
    return state;
  }

  const primedState = await primeCrmAuthFromTabs();
  if (!primedState) {
    return state;
  }

  return {
    ...state,
    ...primedState,
  };
};

const queuePendingSnapshot = async (state, snapshot, errorMessage) => {
  const pendingState = await mergeState({
    serverUrl: normalizeServerUrl(state?.serverUrl),
    tenantKey: normalizeTenantKey(state?.tenantKey),
    lastAutoSyncError:
      normalizeText(errorMessage) || "Chua thay CRM dang dang nhap trong cung trinh duyet.",
    pendingSnapshotJson: JSON.stringify(snapshot),
  });

  return {
    ok: false,
    skipped: true,
    reason: pendingState.lastAutoSyncError,
  };
};

const clearLinkedDeviceState = async (state) => {
  const nextState = {
    ...state,
    deviceSecret: "",
    deviceCode: "",
    sessionToken: "",
    pairCode: "",
    requestedChannelKey: "",
    lastHeartbeatAt: "",
    lastSyncAt: "",
    lastSyncCount: "",
  };
  await storageSet(nextState);
  return nextState;
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

const createSessionFromCrm = async (state, provider) => {
  let accessToken = normalizeText(state.crmAccessToken);
  let nextState = state;
  if (!accessToken) {
    const primedState = await primeCrmAuthFromTabs();
    if (primedState) {
      nextState = {
        ...nextState,
        ...primedState,
      };
      accessToken = normalizeText(primedState.crmAccessToken);
    }
  }

  if (!accessToken) {
    throw new Error("Khong tim thay phien dang nhap CRM trong Chrome.");
  }

  const tenantKey = normalizeTenantKey(nextState.tenantKey);
  const requestedChannelKey = normalizeText(provider) || "multi";
  const payload = await postAuthedJson(
    `${normalizeServerUrl(nextState.serverUrl)}/social/linking/sessions`,
    accessToken,
    tenantKey,
    {
      linkMethod: "BROWSER_EXTENSION",
      requestedChannelKey,
      title: `${detectBrowserName()} ${requestedChannelKey} auto link`,
    },
  );

  const sessionToken = normalizeText(payload?.sessionToken);
  const pairCode = normalizeText(payload?.pairCode).toUpperCase();
  if (!sessionToken && !pairCode) {
    throw new Error("CRM da tao session nhung khong tra ve session token / pair code.");
  }

  return {
    ...nextState,
    tenantKey,
    sessionToken,
    pairCode,
    requestedChannelKey,
    serverUrl: normalizeServerUrl(state.serverUrl),
  };
};

const claimSessionFromState = async (state, snapshot) => {
  if (!normalizeText(state.sessionToken) && !normalizeText(state.pairCode)) {
    throw new Error("Can session token hoac pair code de claim browser extension.");
  }

  const payload = await postJson(
    `${normalizeServerUrl(state.serverUrl)}/social/linking/public/claim`,
    normalizeTenantKey(state.tenantKey),
    {
      tenantKey: normalizeTenantKey(state.tenantKey),
      sessionToken: normalizeText(state.sessionToken) || undefined,
      pairCode: normalizeText(state.pairCode).toUpperCase() || undefined,
      deviceType: "BROWSER_EXTENSION",
      deviceName: `${detectBrowserName()} extension`,
      platform: self.navigator?.platform || "browser",
      browserName: detectBrowserName(),
      browserProfile: normalizeText(state.browserProfile) || undefined,
      appVersion: `extension-${chrome.runtime.getManifest().version}`,
      accountHint:
        normalizeText(state.accountHint) ||
        normalizeText(snapshot?.pageTitle) ||
        normalizeText(snapshot?.activeUrl) ||
        undefined,
      providerHints: normalizeText(snapshot?.provider) || "messenger",
      clientFingerprint: [
        normalizeText(self.navigator?.userAgent),
        normalizeText(snapshot?.activeUrl),
      ]
        .filter(Boolean)
        .join("|"),
      capabilities: {
        browserExtension: true,
        autoClaimFromCrm: true,
        browserSidebarSync: true,
      },
      metadata: {
        source: "browser-extension-background",
        activeTabUrl: normalizeText(snapshot?.activeUrl),
        activeTabTitle: normalizeText(snapshot?.pageTitle),
      },
    },
  );

  const nextState = {
    ...state,
    deviceSecret: normalizeText(payload?.deviceSecret),
    deviceCode: normalizeText(payload?.device?.deviceCode),
    requestedChannelKey: normalizeText(payload?.requestedChannelKey) || state.requestedChannelKey,
    lastHeartbeatAt: normalizeText(payload?.connectedAt) || new Date().toISOString(),
  };
  await storageSet(nextState);
  return nextState;
};

const sendHeartbeatFromState = async (state, snapshot) => {
  if (!normalizeText(state.deviceSecret)) {
    throw new Error("Chua co device secret de gui heartbeat.");
  }

  let payload;
  try {
    payload = await postJson(
      `${normalizeServerUrl(state.serverUrl)}/social/linking/public/heartbeat`,
      normalizeTenantKey(state.tenantKey),
      {
        tenantKey: normalizeTenantKey(state.tenantKey),
        deviceSecret: normalizeText(state.deviceSecret),
        appVersion: `extension-${chrome.runtime.getManifest().version}`,
        accountHint:
          normalizeText(state.accountHint) ||
          normalizeText(snapshot?.pageTitle) ||
          normalizeText(snapshot?.activeUrl) ||
          undefined,
        providerHints: normalizeText(snapshot?.provider) || "messenger",
        capabilities: {
          browserExtension: true,
          autoClaimFromCrm: true,
          browserSidebarSync: true,
        },
        metadata: {
          source: "browser-extension-background",
          activeTabUrl: normalizeText(snapshot?.activeUrl),
          activeTabTitle: normalizeText(snapshot?.pageTitle),
        },
      },
    );
  } catch (error) {
    if (shouldRelinkDevice(error)) {
      await clearLinkedDeviceState(state);
    }
    throw error;
  }

  const nextState = {
    ...state,
    requestedChannelKey: normalizeText(payload?.requestedChannelKey) || state.requestedChannelKey,
    lastHeartbeatAt: normalizeText(payload?.serverTime) || new Date().toISOString(),
  };
  await storageSet(nextState);
  return nextState;
};

const ensureDeviceLinked = async (state, snapshot) => {
  let nextState = {
    ...state,
    serverUrl: normalizeServerUrl(state.serverUrl),
    tenantKey: normalizeTenantKey(state.tenantKey),
  };

  if (normalizeText(nextState.deviceSecret)) {
    return nextState;
  }

  nextState = await createSessionFromCrm(nextState, snapshot?.provider || "messenger");
  nextState = await claimSessionFromState(nextState, snapshot);

  try {
    nextState = await sendHeartbeatFromState(nextState, snapshot);
  } catch {
    // Heartbeat can fail transiently; sync still has a chance to succeed right away.
  }

  return nextState;
};

const fingerprintSnapshot = (snapshot) => {
  const normalizedConversations = Array.isArray(snapshot?.conversations)
    ? snapshot.conversations.map((conversation) => ({
        threadId: normalizeText(conversation?.threadId),
        title: normalizeText(conversation?.title),
        preview: normalizeText(conversation?.preview),
        unreadCount: Number(conversation?.unreadCount || 0),
      }))
    : [];

  return JSON.stringify({
    provider: normalizeText(snapshot?.provider),
    activeUrl: normalizeText(snapshot?.activeUrl),
    conversations: normalizedConversations,
  });
};

const syncSnapshot = async (snapshot) => {
  if (!Array.isArray(snapshot?.conversations) || !snapshot.conversations.length) {
    return { ok: false, skipped: true, reason: "Khong co conversation de sync." };
  }

  let state = await storageGet();
  state = {
    ...state,
    serverUrl: normalizeServerUrl(state.serverUrl),
    tenantKey: normalizeTenantKey(state.tenantKey),
  };
  state = await ensureCrmBootstrap(state);

  const fingerprint = fingerprintSnapshot(snapshot);
  const lastAutoSyncAt = Date.parse(normalizeText(state.lastAutoSyncAt) || "");
  if (
    normalizeText(state.lastAutoSyncFingerprint) === fingerprint &&
    Number.isFinite(lastAutoSyncAt) &&
    Date.now() - lastAutoSyncAt < AUTO_SYNC_COOLDOWN_MS
  ) {
    return { ok: true, skipped: true, reason: "Snapshot giong lan sync gan nhat." };
  }

  if (!normalizeText(state.crmAccessToken) && !normalizeText(state.deviceSecret)) {
    return queuePendingSnapshot(
      state,
      snapshot,
      "Chua thay CRM dang dang nhap trong cung trinh duyet.",
    );
  }

  try {
    state = await ensureDeviceLinked(state, snapshot);
  } catch (error) {
    if (
      !normalizeText(state.deviceSecret) &&
      /Khong tim thay phien dang nhap CRM/i.test(normalizeText(error?.message || error))
    ) {
      return queuePendingSnapshot(state, snapshot, error?.message || error);
    }

    throw error;
  }

  let payload;
  const syncPayload = {
    tenantKey: normalizeTenantKey(state.tenantKey),
    deviceSecret: normalizeText(state.deviceSecret),
    provider: normalizeText(snapshot?.provider) || "messenger",
    activeUrl: normalizeText(snapshot?.activeUrl),
    pageTitle: normalizeText(snapshot?.pageTitle),
    collectedAt: normalizeText(snapshot?.collectedAt) || new Date().toISOString(),
    conversations: snapshot.conversations,
    metadata: {
      source: "browser-extension-background",
      requestedChannelKey: normalizeText(state.requestedChannelKey),
      browserProfile: normalizeText(state.browserProfile),
      extensionVersion: chrome.runtime.getManifest().version,
    },
  };

  try {
    payload = await postJson(
      `${normalizeServerUrl(state.serverUrl)}/social/linking/public/browser-sync`,
      normalizeTenantKey(state.tenantKey),
      syncPayload,
    );
  } catch (error) {
    if (!shouldRelinkDevice(error)) {
      await mergeState({
        lastAutoSyncError: normalizeText(error?.message || error),
      });
      throw error;
    }

    state = await clearLinkedDeviceState(state);
    state = await ensureCrmBootstrap(state);
    if (!normalizeText(state.crmAccessToken)) {
      return queuePendingSnapshot(state, snapshot, error?.message || error);
    }
    state = await ensureDeviceLinked(state, snapshot);
    payload = await postJson(
      `${normalizeServerUrl(state.serverUrl)}/social/linking/public/browser-sync`,
      normalizeTenantKey(state.tenantKey),
      {
        ...syncPayload,
        tenantKey: normalizeTenantKey(state.tenantKey),
        deviceSecret: normalizeText(state.deviceSecret),
      },
    );
  }

  const nextState = {
    ...state,
    lastSyncAt: normalizeText(payload?.serverTime) || new Date().toISOString(),
    lastSyncCount: String(Number(payload?.conversationsTouched || snapshot.conversations.length)),
    lastAutoSyncAt: new Date().toISOString(),
    lastAutoSyncFingerprint: fingerprint,
    lastAutoSyncError: "",
    pendingSnapshotJson: "",
  };
  await storageSet(nextState);
  return {
    ok: true,
    conversationsTouched: Number(payload?.conversationsTouched || snapshot.conversations.length),
    deviceCode: normalizeText(payload?.deviceCode),
  };
};

const queueAutoSync = async (snapshot) => {
  autoSyncChain = autoSyncChain
    .catch(() => {})
    .then(() => syncSnapshot(snapshot));
  return autoSyncChain;
};

const requestSnapshotFromTab = async (tabId) =>
  new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "FITFLOW_COLLECT_SNAPSHOT" }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || "Khong gui duoc yeu cau snapshot den tab Messenger."));
        return;
      }

      if (!response?.ok) {
        reject(new Error(normalizeText(response?.error) || "Khong doc duoc sidebar Messenger."));
        return;
      }

      resolve(response);
    });
  });

const tryAutoSyncMessengerTab = async (tabId) => {
  try {
    const snapshot = await requestSnapshotFromTab(tabId);
    if (Array.isArray(snapshot?.conversations) && snapshot.conversations.length) {
      await queueAutoSync(snapshot);
    }
  } catch {
    // The content script may not be ready yet; the next tab update / message will retry.
  }
};

const handleCrmAuthMessage = async (message) => {
  const nextState = await mergeState({
    serverUrl: normalizeServerUrl(message?.serverUrl),
    tenantKey: normalizeTenantKey(message?.tenantKey),
    crmAccessToken: normalizeText(message?.accessToken),
    crmUrl: normalizeText(message?.crmUrl),
    crmTitle: normalizeText(message?.crmTitle),
    lastCrmAuthAt: new Date().toISOString(),
  });

  const pendingSnapshotJson = normalizeText(nextState.pendingSnapshotJson);
  if (pendingSnapshotJson) {
    try {
      const pendingSnapshot = JSON.parse(pendingSnapshotJson);
      await queueAutoSync(pendingSnapshot);
    } catch {
      await mergeState({ pendingSnapshotJson: "" });
    }
  }

  return { ok: true };
};

const handleSnapshotMessage = async (message) => {
  const snapshot = message?.snapshot;
  if (!Array.isArray(snapshot?.conversations) || !snapshot.conversations.length) {
    return { ok: false, skipped: true };
  }

  await queueAutoSync(snapshot);
  return { ok: true };
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "FITFLOW_CRM_AUTH") {
    handleCrmAuthMessage(message)
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: normalizeText(error?.message || error),
        });
      });
    return true;
  }

  if (message?.type === "FITFLOW_MESSENGER_SNAPSHOT") {
    handleSnapshotMessage(message)
      .then((result) => sendResponse(result))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: normalizeText(error?.message || error),
        });
      });
    return true;
  }

  return false;
});

const recordBackgroundBoot = async () => {
  try {
    await requestJson(`${DEFAULT_SERVER_URL}/health`);
    await mergeState({
      serverUrl: DEFAULT_SERVER_URL,
      backgroundBootAt: new Date().toISOString(),
      backgroundBootStatus: "online",
      backgroundBootError: "",
    });
  } catch (error) {
    await mergeState({
      serverUrl: DEFAULT_SERVER_URL,
      backgroundBootAt: new Date().toISOString(),
      backgroundBootStatus: "error",
      backgroundBootError: normalizeText(error?.message || error),
    });
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") {
    return;
  }

  const tabUrl = normalizeText(tab?.url);
  if (isMessengerUrl(tabUrl)) {
    setTimeout(() => {
      void tryAutoSyncMessengerTab(tabId);
    }, 2000);
    return;
  }

  if (looksLikeCrmTab(tab)) {
    void primeCrmAuthFromTabs();
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) {
      return;
    }

    const tabUrl = normalizeText(tab?.url);
    if (isMessengerUrl(tabUrl)) {
      void tryAutoSyncMessengerTab(activeInfo.tabId);
      return;
    }

    if (looksLikeCrmTab(tab)) {
      void primeCrmAuthFromTabs();
    }
  });
});

void recordBackgroundBoot();
