# AIngelExt (v0.5.3)

AIngelExt is a **local-first** browser extension (Chromium / Manifest V3) that helps prevent accidental sharing of **passwords, API keys, IBANs, emails, tokens, private keys, etc.** into websites (ChatGPT/LLM chats, search engines, web forms), and adds a **Gmail “Send” safety check**.

- Runs **entirely in your browser**
- **No accounts**
- **No server**
- No network calls from extension code

---

## Supported browsers

✅ Chrome / Edge / Brave / Opera (desktop/laptop, Chromium-based)

Not supported by this build:
- Firefox (requires a separate build + signing for normal installs)
- iPhone/Android browsers (mobile extension support is limited by platform)

---

## What it protects (the “gates”)

### 1) Input Gate (paste + type + submit)
Triggers when you **paste** or **try to submit/send/search** text that looks like it contains sensitive data.

You can:
- **Redact** (normal): removes common secrets/PII
- **Redact+** (strict): also catches many obfuscations (spaced emails, split keys) and applies stricter masking
- **Wrap as untrusted data**: adds a prompt-injection guard wrapper (optional)

### 2) File Upload Gate (before upload)
Triggers when you select or drag/drop **text files** into upload controls.

- Inspects text files up to the configured size limit
- Can **cancel upload**, **upload original**, or **redact then upload**
- **Polite mode:** if the website shows its own blocking popup (e.g., “Create account”), AIngelExt does **not** cover it with a full-screen overlay.

### 3) Reasoning Gate (copy)
Triggers when you **copy** longer, “checkable” content (e.g., AI outputs with claims).

Buttons:
- **Copy (as-is)**: copies selected text
- **Hypothesis (unverified)**: adds a clear “unverified/hypothesis” label
- **Copy + trace (AI footer)**: appends a short “AI-assisted” trace line

### 4) Output Gate (Gmail Web)
Intercepts **Gmail Send** and asks you to qualify/verify/remove checkable items before sending.

### 5) Action Gate (irreversible clicks)
Adds a confirmation step for actions likely to be irreversible (delete/publish/deploy/pay/transfer, etc.).

---

## Install (Chrome / Edge / Brave / Opera)

1. Download this repo as ZIP (or clone it):

   ```bash
   git clone https://github.com/ovladon/AIngelExt_browser_extension.git
   cd AIngelExt_browser_extension
