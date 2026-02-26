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
  const cur = await chrome.storage.sync.get(null);
  const patch = {};
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (typeof cur[k] === "undefined") patch[k] = v;
  }
  if (Object.keys(patch).length) await chrome.storage.sync.set(patch);
}

chrome.runtime.onInstalled.addListener(() => ensureDefaults());

function isTargetUrl(url) {
  if (!url) return false;
  return (url.startsWith("https://chatgpt.com/") || url.startsWith("https://chat.openai.com/") || url.startsWith("https://claude.ai/") || url.startsWith("https://mail.google.com/") || url.startsWith("https://www.google.com/") || url.startsWith("https://www.bing.com/") || url.startsWith("https://duckduckgo.com/") || url.startsWith("https://search.brave.com/") || url.startsWith("https://you.com/") || url.startsWith("https://www.perplexity.ai/") || url.startsWith("https://kagi.com/"));
}

async function tryInject(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["injected.js"]
    });
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
  } catch {}
});
