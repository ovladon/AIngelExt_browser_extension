# AIngelExt

Local-first safety gates for LLM workflows in the browser: intercept **paste** and **file uploads** on common AI/chat/search sites, optionally **wrap untrusted data to reduce prompt-injection risk**, and add a lightweight **Gmail “Output Gate”** before sending.

> Note: this codebase currently displays **“Toolkit Angel (Prototype v0.2.9)”** in the UI/manifest. If you want the visible name to be **AIngelExt**, update `manifest.json` (`name`, `action.default_title`) and `popup.html`/`options.html` titles.

## What it does

### 1) Input Gate (paste)
When you paste into an editable field on a supported site, AIngelExt scans the clipboard text **locally** using regex heuristics. If it detects likely sensitive data, it blocks the site’s paste handler and opens a modal that lets you:

- Review the text before it reaches the page
- **Auto‑redact** (light or strict)
- Optionally **wrap** the content as **untrusted data** (prompt‑injection guard)
- Paste the “safe” version into the original field (with robust fallbacks)

**Detected (current build):**
- OpenAI-style API keys: `sk-…`
- AWS access keys: `AKIA…`
- Google API keys: `AIza…`
- IBANs
- Emails
- Phone-like numbers

**Redaction modes:**
- **light**: keys/emails/phones/IBAN
- **strict**: light + URLs + dates + 4+ digit numbers

### 2) File Upload Gate (text files)
When you select files via a file picker **or drag-and-drop** on supported sites, AIngelExt inspects **text** files (UTF‑8) up to a configurable size limit and reports hits. You can:

- Cancel the upload
- Upload originals
- **Redact (light/strict) and upload** (text files only)

Supported text types (current build): `.txt .md .csv .json .log .yaml .yml .xml`  
Binary files (PDF/DOCX/images/etc.) are **not inspectable** in this build; they are flagged as uninspectable.

### 3) Output Gate (Gmail Web)
Before sending an email in Gmail Web, AIngelExt can block “Send” and show a quick verification gate when the draft contains checkable items (currently: URLs, dates, long numbers). You can cancel or “Send anyway”.

### 4) Local event log
Optionally stores a capped event log in `chrome.storage.local` under `ta_log` (toggleable in Options). No network calls are made by the extension.

## Supported sites (current build)

Injected by default on:

- ChatGPT: `chatgpt.com`, `chat.openai.com`
- Claude: `claude.ai`
- Gmail Web: `mail.google.com`
- Search: `www.google.com`, `www.bing.com`, `duckduckgo.com`, `search.brave.com`, `you.com`, `www.perplexity.ai`, `kagi.com`

If a site uses a different hostname (e.g., a non-`www.google.com` Google domain), the popup includes **Inject now** as a fallback.

## Installation (Chromium: Chrome / Brave / Edge)

1. Download or clone this repository.
2. Ensure the extension folder contains `manifest.json` at its root.
3. Open:
   - Chrome/Brave: `chrome://extensions`
   - Edge: `edge://extensions`
4. Enable **Developer mode**.
5. Click **Load unpacked** and select the extension folder.

## Usage

- Navigate to a supported site.
- On load, the content script shows a short toast: “active (v0.2.9)”.
- Paste text into an input/textarea/contenteditable field:
  - If sensitive patterns are detected, the **Input Gate** modal opens.
  - Choose redaction and/or wrapping, then **Paste safe text**.
- Upload files through a file input or by drag & drop:
  - The **File Upload Gate** modal opens and offers “Upload original” or “Redact + upload”.
- In Gmail Web, click **Send**:
  - If checkable items are detected, the **Output Gate** modal opens.

## Options

Open the extension options page (from the extension popup or `chrome://extensions` → Details → Extension options):

- **Input Gate**
  - Enable/disable
  - Auto-trigger on paste
- **Auto-redact defaults**
  - off / light / strict (applied before showing the modal)
- **Prompt‑injection wrapper**
  - Wrap pasted content as untrusted data
  - Optionally wrap silently when no sensitive data is detected (no modal)
- **File Upload Gate**
  - Enable/disable
  - Max inspectable size (KB) for text files
- **Output Gate (Gmail)**
  - Enable/disable
- **Local log**
  - Enable/disable
  - Max entries
  - Clear log

## Prompt‑injection wrapper format (current build)

When enabled, the wrapper prepends a short safety instruction and surrounds the pasted content with a delimiter (chosen to avoid collisions with your text). This is meant to reduce accidental instruction-following when pasting untrusted content into LLM prompts.

## Permissions (why they exist)

- `scripting`: injects `injected.js` into supported pages.
- `tabs`: detects active/updated tabs to (re)inject as needed.
- `activeTab`: allows manual injection via the popup (**Inject now**).
- `storage`: stores settings (sync) and local event log (local).

## Limitations and threat model

- Detection is regex-based and will produce **false positives** and **false negatives**.
- The extension does not provide enterprise-grade DLP guarantees; it is a **user-side safety assist**.
- Binary documents are not inspected in this build; the File Upload Gate can only redact **text** files.
- Once you choose “Upload original” or paste content, the destination site processes it normally. AIngelExt does not control downstream storage/retention by those services.

## Troubleshooting

- **No toast / no gating appears**
  - Click the extension icon → **Diagnostics: PING this page**
  - If PING fails, click **Fix: Inject now (active tab)**
- **Paste did not insert into a rich editor**
  - The script includes fallbacks, but some editors are hostile to programmatic insertion. If insertion fails, the extension copies the “safe” text to clipboard and prompts you to paste once.

## Development notes

Key files:

- `manifest.json`: MV3 definition + host permissions.
- `service_worker.js`: injects `injected.js` on matching tabs and sets defaults on install.
- `injected.js`: all gates (paste, file upload, Gmail send) + UI modal + detection/redaction logic.
- `popup.html` / `popup.js`: diagnostics (PING), manual injection, self-test.
- `options.html` / `options.js`: settings UI.

## Version

Current code: **v0.2.9** (as embedded in `manifest.json` and `injected.js`).
