const DEFAULTS = {
  mode: "medium",
  autoEscalate: true,

  enableInputGate: true,
  autoTriggerInputGate: true,
  autoTriggerInputGateOnType: false,
  autoRedactDefault: "off",

  redactStyle: "tag", // tag | mask

  promptInjectionGuard: false,
  guardWrapWithoutModal: false,

  enableReasoningGate: true,
  enableOutputGate: true,
  enableActionGate: true,

  enableFileUploadGate: true,
  maxTextFileKB: 2048,

  traceLineMode: "store",

  logEnabled: true,
  maxLogEntries: 200
};

async function load() {
  const s = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const cfg = { ...DEFAULTS, ...(s || {}) };

  for (const k of Object.keys(DEFAULTS)) {
    const el = document.getElementById(k);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = !!cfg[k];
    else el.value = cfg[k];
  }
  document.getElementById("maxTextFileKB").value = Number(cfg.maxTextFileKB || 2048);
  document.getElementById("maxLogEntries").value = Number(cfg.maxLogEntries || 200);
}

async function save() {
  const payload = {};
  for (const k of Object.keys(DEFAULTS)) {
    const el = document.getElementById(k);
    if (!el) continue;
    payload[k] = (el.type === "checkbox") ? el.checked : el.value;
  }
  payload.maxTextFileKB = Math.max(16, Number(document.getElementById("maxTextFileKB").value || 2048));
  payload.maxLogEntries = Math.max(0, Number(document.getElementById("maxLogEntries").value || 200));

  await chrome.storage.sync.set(payload);
  const st = document.getElementById("status");
  st.textContent = "Saved.";
  st.className = "muted ok";
  setTimeout(() => { st.textContent = ""; st.className = "muted"; }, 1200);
}

async function clearLog() {
  await chrome.storage.local.set({ aie_log: [] });
  const st = document.getElementById("status");
  st.textContent = "Log cleared.";
  st.className = "muted ok";
  setTimeout(() => { st.textContent = ""; st.className = "muted"; }, 1200);
}

document.getElementById("save").addEventListener("click", save);
document.getElementById("clearLog").addEventListener("click", clearLog);
load();
