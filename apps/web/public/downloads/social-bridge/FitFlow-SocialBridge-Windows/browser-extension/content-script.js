const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeToken = (value) =>
  normalizeText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const messengerThreadIdFromHref = (href) => {
  const normalizedHref = normalizeText(href);
  const matchedThread = normalizedHref.match(/\/t\/([^/?#]+)/i);
  if (matchedThread?.[1]) {
    return matchedThread[1];
  }

  try {
    const parsed = new URL(normalizedHref, window.location.origin);
    const tid = normalizeText(parsed.searchParams.get("tid"));
    if (tid) {
      return tid;
    }
  } catch {}

  return "";
};

const toAbsoluteUrl = (href) => {
  const normalizedHref = normalizeText(href);
  if (!normalizedHref) return "";

  try {
    return new URL(normalizedHref, window.location.origin).toString();
  } catch {
    return normalizedHref;
  }
};

const guessPreviewDirection = (preview) => {
  const normalizedPreview = normalizeToken(preview);
  if (normalizedPreview.startsWith("ban:") || normalizedPreview.startsWith("you:")) {
    return "OUTBOUND";
  }

  return "INBOUND";
};

const conversationContainerForAnchor = (anchor) =>
  anchor.closest('[role="listitem"], [role="row"], li, [tabindex="0"], [tabindex="-1"]') ||
  anchor.parentElement ||
  anchor;

const extractMeaningfulLines = (element) => {
  const rawText = String(element?.innerText || element?.textContent || "");
  const lines = rawText
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);

  const deduped = [];
  for (const line of lines) {
    if (!deduped.includes(line)) {
      deduped.push(line);
    }
  }

  return deduped;
};

const titleFromLines = (lines, fallbackText) => {
  const ignored = new Set(["doanchat", "chats", "messenger", "tatca", "chuadoc", "nhom"]);
  return (
    lines.find((line) => {
      if (ignored.has(normalizeToken(line))) return false;
      if (/^\d+\+?$/.test(line)) return false;
      return true;
    }) || normalizeText(fallbackText)
  );
};

const previewFromLines = (lines, title) =>
  lines.find((line) => line && line !== title && !/^\d+\+?$/.test(line)) || "";

const collectMessengerConversations = () => {
  const candidates = Array.from(
    document.querySelectorAll('a[href*="/t/"], a[href*="/messages/t/"], a[href*="tid="]'),
  );
  const conversationsByThread = new Map();

  for (const anchor of candidates) {
    const absoluteHref = toAbsoluteUrl(anchor.getAttribute("href") || anchor.href);
    const threadId = messengerThreadIdFromHref(absoluteHref);
    if (!threadId) {
      continue;
    }

    const container = conversationContainerForAnchor(anchor);
    const rect = container.getBoundingClientRect();
    if (rect.width < 160 || rect.height < 48) {
      continue;
    }

    if (rect.width > Math.min(window.innerWidth * 0.45, 520)) {
      continue;
    }

    if (rect.left > Math.max(window.innerWidth * 0.5, 720)) {
      continue;
    }

    const lines = extractMeaningfulLines(container);
    const avatar = container.querySelector("img");
    const title = titleFromLines(lines, avatar?.alt || "");
    const preview = previewFromLines(lines, title);
    if (!title || !preview) {
      continue;
    }

    const unreadBadgeValues = Array.from(container.querySelectorAll("span, div"))
      .map((node) => normalizeText(node.textContent))
      .filter((value) => /^\d+\+?$/.test(value))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isFinite(value) && value > 0 && value < 1000);

    conversationsByThread.set(threadId, {
      threadId,
      href: absoluteHref,
      title,
      preview,
      subtitle: lines.find((line) => line !== title && line !== preview) || "",
      avatarUrl:
        avatar && !String(avatar.src || "").startsWith("data:") ? avatar.src : "",
      unreadCount: unreadBadgeValues[0] || 0,
      isSelected:
        window.location.pathname.includes(`/t/${threadId}`) ||
        anchor.getAttribute("aria-current") === "page",
      previewDirection: guessPreviewDirection(preview),
      raw: {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
  }

  return Array.from(conversationsByThread.values()).sort(
    (left, right) => Number(left.raw?.top || 0) - Number(right.raw?.top || 0),
  );
};

const collectMessengerSnapshot = () => {
  const hostname = window.location.hostname;
  if (!hostname.includes("messenger.com") && !hostname.includes("facebook.com")) {
    return {
      ok: false,
      error: "Tab hien tai khong phai Messenger.",
    };
  }

  const conversations = collectMessengerConversations();
  if (!conversations.length) {
    return {
      ok: false,
      error: "Khong tim thay cot trai danh sach chat. Hay mo Messenger full page trong facebook.com/messages hoac messenger.com.",
    };
  }

  return {
    ok: true,
    provider: "messenger",
    activeUrl: window.location.href,
    pageTitle: document.title,
    collectedAt: new Date().toISOString(),
    conversations,
  };
};

const isCrmPage = () => {
  const hostname = normalizeText(window.location.hostname).toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
};

const isMessengerPage = () => {
  const hostname = normalizeText(window.location.hostname).toLowerCase();
  const href = normalizeText(window.location.href).toLowerCase();

  if (hostname.includes("messenger.com")) {
    return true;
  }

  if (!hostname.includes("facebook.com")) {
    return false;
  }

  return (
    href.includes("/messages") ||
    href.includes("?sk=messages") ||
    href.includes("?sk=h_chr") ||
    href.includes("?sk=all_messages") ||
    href.includes("/t/")
  );
};

const sendRuntimeMessage = async (payload) =>
  new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(payload, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message || "" });
          return;
        }

        resolve(response || { ok: true });
      });
    } catch (error) {
      resolve({
        ok: false,
        error: normalizeText(error?.message || error),
      });
    }
  });

const debounce = (callback, waitMs) => {
  let timeoutHandle = null;

  return (...args) => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    timeoutHandle = setTimeout(() => {
      timeoutHandle = null;
      callback(...args);
    }, waitMs);
  };
};

const pushCrmAuth = async () => {
  if (!isCrmPage()) {
    return;
  }

  const accessToken = normalizeText(window.localStorage.getItem("fitflow_access_token"));
  if (!accessToken) {
    return;
  }

  await sendRuntimeMessage({
    type: "FITFLOW_CRM_AUTH",
    accessToken,
    tenantKey: normalizeText(window.localStorage.getItem("fitflow_tenant_key")),
    crmUrl: normalizeText(window.location.href),
    crmTitle: normalizeText(document.title),
  });
};

const startCrmAuthPolling = (callback) => {
  let lastFingerprint = "";

  const poll = () => {
    try {
      const accessToken = normalizeText(window.localStorage.getItem("fitflow_access_token"));
      const tenantKey = normalizeText(window.localStorage.getItem("fitflow_tenant_key"));
      const fingerprint = `${accessToken}|${tenantKey}|${normalizeText(window.location.href)}`;
      if (!accessToken || fingerprint === lastFingerprint) {
        return;
      }

      lastFingerprint = fingerprint;
      callback();
    } catch {
      // Ignore transient storage access issues and try again on the next poll.
    }
  };

  poll();
  return window.setInterval(poll, 1500);
};

const pushMessengerSnapshot = async () => {
  if (!isMessengerPage()) {
    return;
  }

  const snapshot = collectMessengerSnapshot();
  if (!snapshot?.ok || !Array.isArray(snapshot.conversations) || !snapshot.conversations.length) {
    return;
  }

  await sendRuntimeMessage({
    type: "FITFLOW_MESSENGER_SNAPSHOT",
    snapshot,
  });
};

const bootAutoBridge = () => {
  const debouncedCrmAuth = debounce(() => {
    pushCrmAuth().catch(() => {});
  }, 300);

  const debouncedMessengerSnapshot = debounce(() => {
    pushMessengerSnapshot().catch(() => {});
  }, 1200);

  if (isCrmPage()) {
    debouncedCrmAuth();
    startCrmAuthPolling(debouncedCrmAuth);
    window.addEventListener("focus", debouncedCrmAuth);
    window.addEventListener("pageshow", debouncedCrmAuth);
    window.addEventListener("popstate", debouncedCrmAuth);
    window.addEventListener("hashchange", debouncedCrmAuth);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        debouncedCrmAuth();
      }
    });
    window.addEventListener("storage", debouncedCrmAuth);

    if (document.body) {
      const observer = new MutationObserver(() => {
        debouncedCrmAuth();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    } else {
      document.addEventListener("DOMContentLoaded", debouncedCrmAuth, { once: true });
    }
  }

  if (isMessengerPage()) {
    debouncedMessengerSnapshot();
    window.addEventListener("focus", debouncedMessengerSnapshot);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        debouncedMessengerSnapshot();
      }
    });
    document.addEventListener("click", debouncedMessengerSnapshot);
    window.addEventListener("load", debouncedMessengerSnapshot);

    if (document.body) {
      const observer = new MutationObserver(() => {
        debouncedMessengerSnapshot();
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    } else {
      document.addEventListener("DOMContentLoaded", debouncedMessengerSnapshot, { once: true });
    }
  }
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "FITFLOW_COLLECT_SNAPSHOT") {
    return false;
  }

  try {
    sendResponse(collectMessengerSnapshot());
  } catch (error) {
    sendResponse({
      ok: false,
      error: normalizeText(error?.message || error) || "Khong doc duoc sidebar Messenger.",
    });
  }

  return true;
});

bootAutoBridge();
