const statusEl = document.getElementById("status");
function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.className = "status " + (ok ? "ok" : "bad");
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0];
}

function ping(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "TA_PING" }, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) return resolve({ ok: false, error: err.message });
      resolve(resp || { ok: false, error: "No response" });
    });
  });
}

async function inject(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["engine.js", "injected.js"]
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

document.getElementById("options").addEventListener("click", () => chrome.runtime.openOptionsPage());

document.getElementById("playground").addEventListener("click", async () => {
  const url = chrome.runtime.getURL("playground.html");
  await chrome.tabs.create({ url });
});

document.getElementById("ping").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab?.id) return setStatus("No active tab.", false);
  const r = await ping(tab.id);
  if (r.ok) return setStatus(`PING OK\nVersion: ${r.version}\nFrame: ${r.frame}`, true);
  setStatus(`PING FAILED\n${r.error}`, false);
});

document.getElementById("inject").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab?.id) return setStatus("No active tab.", false);
  const inj = await inject(tab.id);
  if (!inj.ok) return setStatus("INJECT FAILED\n" + inj.error, false);
  const r = await ping(tab.id);
  if (r.ok) return setStatus(`INJECT OK + PING OK\nVersion: ${r.version}`, true);
  setStatus(`INJECT OK but PING still fails\n${r.error}`, false);
});

document.getElementById("test").addEventListener("click", async () => {
  const tab = await activeTab();
  if (!tab?.id) return setStatus("No active tab.", false);

  let r = await ping(tab.id);
  if (!r.ok) {
    const inj = await inject(tab.id);
    if (!inj.ok) return setStatus("Self-test failed: inject error\n" + inj.error, false);
    r = await ping(tab.id);
    if (!r.ok) return setStatus("Self-test failed: still no receiver after inject\n" + r.error, false);
  }

  chrome.tabs.sendMessage(tab.id, { type: "TA_SELF_TEST_INPUT" }, (resp) => {
    const err = chrome.runtime.lastError;
    if (err) return setStatus("SELF-TEST FAILED\n" + err.message, false);
    if (resp?.ok) return setStatus("SELF-TEST SENT (overlay should appear).", true);
    setStatus("SELF-TEST: no confirmation.", false);
  });
});
