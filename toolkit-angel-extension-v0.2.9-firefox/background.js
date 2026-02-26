// Toolkit Angel v0.2.9 (Firefox build): event-driven background script (no service worker).
const DEFAULTS = {
  enableInputGate: true,
  autoTriggerInputGate: true,
  autoRedactDefault: "off",
  promptInjectionGuard: false,
  guardWrapWithoutModal: false,
  enableFileUploadGate: true,
  maxTextFileKB: 2048,
  enableOutputGate: true,
  logEnabled: true,
  maxLogEntries: 200
};

async function ensureDefaults() {
  try {
    const cur = await chrome.storage.sync.get(null);
    const patch = {};
    for (const [k, v] of Object.entries(DEFAULTS)) {
      if (typeof cur[k] === "undefined") patch[k] = v;
    }
    if (Object.keys(patch).length) await chrome.storage.sync.set(patch);
  } catch (e) {}
}

chrome.runtime.onInstalled.addListener(() => ensureDefaults());

function isTargetUrl(url) {
  if (!url) return false;
  const u = String(url);
  return (
    u.startsWith("https://chatgpt.com/") ||
    u.startsWith("https://chat.openai.com/") ||
    u.startsWith("https://claude.ai/") ||
    u.startsWith("https://mail.google.com/") ||
    u.startsWith("https://www.google.com/") ||
    u.startsWith("https://www.bing.com/") ||
    u.startsWith("https://duckduckgo.com/") ||
    u.startsWith("https://search.brave.com/") ||
    u.startsWith("https://you.com/") ||
    u.startsWith("https://www.perplexity.ai/") ||
    u.startsWith("https://kagi.com/")
  );
}

async function tryInject(tabId) {
  try {
    if (chrome.scripting && chrome.scripting.executeScript) {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ["injected.js"]
      });
    } else if (chrome.tabs && chrome.tabs.executeScript) {
      await chrome.tabs.executeScript(tabId, { file: "injected.js", allFrames: true });
    }
  } catch (e) {}
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete") return;
  if (!isTargetUrl(tab?.url || "")) return;
  tryInject(tabId);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!isTargetUrl(tab?.url || "")) return;
    tryInject(activeInfo.tabId);
  } catch (e) {}
});
