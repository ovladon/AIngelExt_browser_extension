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

async function load() {
  const s = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const cfg = { ...DEFAULTS, ...s };

  document.getElementById("enableInputGate").checked = (cfg.enableInputGate !== false);
  document.getElementById("autoTriggerInputGate").checked = (cfg.autoTriggerInputGate !== false);
  document.getElementById("autoRedactDefault").value = cfg.autoRedactDefault || "off";

  document.getElementById("promptInjectionGuard").checked = (cfg.promptInjectionGuard === true);
  document.getElementById("guardWrapWithoutModal").checked = (cfg.guardWrapWithoutModal === true);

  document.getElementById("enableFileUploadGate").checked = (cfg.enableFileUploadGate !== false);
  document.getElementById("maxTextFileKB").value = Number.isFinite(cfg.maxTextFileKB) ? cfg.maxTextFileKB : 2048;

  document.getElementById("enableOutputGate").checked = (cfg.enableOutputGate !== false);

  document.getElementById("logEnabled").checked = (cfg.logEnabled !== false);
  document.getElementById("maxLogEntries").value = Number.isFinite(cfg.maxLogEntries) ? cfg.maxLogEntries : 200;
}

async function save() {
  const payload = {
    enableInputGate: document.getElementById("enableInputGate").checked,
    autoTriggerInputGate: document.getElementById("autoTriggerInputGate").checked,
    autoRedactDefault: document.getElementById("autoRedactDefault").value,

    promptInjectionGuard: document.getElementById("promptInjectionGuard").checked,
    guardWrapWithoutModal: document.getElementById("guardWrapWithoutModal").checked,

    enableFileUploadGate: document.getElementById("enableFileUploadGate").checked,
    maxTextFileKB: Math.max(16, Number(document.getElementById("maxTextFileKB").value || 2048)),

    enableOutputGate: document.getElementById("enableOutputGate").checked,

    logEnabled: document.getElementById("logEnabled").checked,
    maxLogEntries: Math.max(0, Number(document.getElementById("maxLogEntries").value || 0))
  };
  await chrome.storage.sync.set(payload);
  const st = document.getElementById("status");
  st.textContent = "Saved.";
  st.className = "muted ok";
  setTimeout(() => { st.textContent = ""; st.className = "muted"; }, 1200);
}

async function clearLog() {
  await chrome.storage.local.set({ ta_log: [] });
  const st = document.getElementById("status");
  st.textContent = "Log cleared.";
  st.className = "muted ok";
  setTimeout(() => { st.textContent = ""; st.className = "muted"; }, 1200);
}

document.getElementById("save").addEventListener("click", save);
document.getElementById("clearLog").addEventListener("click", clearLog);
load();
