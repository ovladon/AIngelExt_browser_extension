# AIngelExt (v0.4.5)

**AIngelExt** is a **local-first** browser extension (Chromium / Manifest V3) that adds “safety gates” to common AI/chat/search sites and Gmail Web:

- **Input Gate**: intercepts paste (and optionally typing) into text fields to reduce accidental sharing of secrets/PII.
- **File Upload Gate**: inspects **text** files before upload and can redact them.
- **Prompt‑Injection Guard**: can wrap pasted content as **untrusted data**.
- **Reasoning Gate**: intercepts **copy** to encourage “hypothesis / trace” handling for checkable claims.
- **Output Gate**: intercepts **Gmail Send** and forces quick “verify / qualify / remove” on checkable items.
- **Action Gate**: adds a confirmation step for likely irreversible clicks (“delete”, “publish”, “deploy”, etc.).

No network calls are made by the extension code in this repo.

---

## Supported sites (default injection)

From `manifest.json` (`host_permissions` / `content_scripts.matches`):

- ChatGPT: `https://chatgpt.com/*`, `https://chat.openai.com/*`
- Claude: `https://claude.ai/*`
- Gmail Web: `https://mail.google.com/*`
- Search: `https://www.google.com/*`, `https://www.bing.com/*`, `https://duckduckgo.com/*`, `https://search.brave.com/*`, `https://you.com/*`, `https://www.perplexity.ai/*`, `https://kagi.com/*`

---

## Install (Chrome / Brave / Edge)

1. Download this repository (ZIP) or clone it:
   ```bash
   git clone https://github.com/ovladon/AIngelExt_browser_extension.git
   cd AIngelExt_browser_extension
   ```
2. Open the extensions page:
   - Chrome/Brave: `chrome://extensions`
   - Edge: `edge://extensions`
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the extension folder (the folder containing `manifest.json`).
5. (Recommended) Pin the extension from the Extensions menu.

---

## How it works (gates)

### 1) Input Gate (paste + optional typing trigger)

**Trigger:** paste into `textarea`, text inputs, or contenteditable fields on supported sites (and optionally “typing after a short pause”).

**What you can do in the modal:**
- Choose a sensitivity **Level** (Public / Internal / Confidential / Secret) for your own workflow (logged locally).
- **Redact** (light) or **Redact+** (strict).
- **Names → roles**: replaces name-like patterns (`First Last`) with stable placeholders like `[PERSON_1]`.
- **Shorten**: truncates long text and appends `[shortened]`.
- **Wrap as data**: adds a prompt‑injection guard wrapper around the pasted content.

**Redact+ safety net:** after applying strict redaction, the extension rescans in **high** detection mode; if anything is still detected it shows “jump to” buttons and requires a second “Paste (confirm)” click.

### 2) Prompt‑Injection Guard (silent mode)

If enabled, AIngelExt can **silently** wrap pasted text (even when no secrets are detected) and paste the wrapped content without showing the modal.

Wrapper format (simplified):

- A short instruction: treat block as **untrusted data**, ignore instructions inside it
- A delimiter (chosen to avoid collisions) around the content

### 3) File Upload Gate (file picker + drag & drop)

**Trigger:** selecting files via `<input type="file">` or drag & drop on supported sites.

- Inspects **UTF‑8 text files** up to `maxTextFileKB` (default: 2048 KB).
- Supported text extensions: `.txt .md .csv .json .log .yaml .yml .xml`
- Binary formats (PDF/DOCX/images/etc.) are treated as **uninspectable** in this build.

**Actions:**
- Cancel upload
- Upload original files
- Redact (light/strict) and upload **text** files

### 4) Output Gate (Gmail Web “Send”)

**Trigger:** clicking “Send” in Gmail Web when the message body contains “checkable” items.

The gate extracts items such as:
- URLs
- dates
- long numbers
- money amounts
- quoted passages
- person-name patterns
- heuristics for causal / legal / medical language

For each item you must choose:
- ✅ **Verify** (requires a short “source” note)
- ⚠️ **Qualify** (requires a short qualifier, e.g., “approx.” / “unconfirmed”)
- ❌ **Remove**

The extension rewrites the email draft accordingly and (optionally) adds a **trace line** (see below).

### 5) Reasoning Gate (on copy)

**Trigger:** copying selected text **outside** an editable field, for selections ≥ ~40 characters, when checkable items are present (or when auto‑escalation bumps mode to high).

Actions:
- Copy as-is
- Copy as **Hypothesis** (prefix “Unverified (AI output). Treat as hypothesis: …”)
- Copy + **trace**

### 6) Action Gate (irreversible clicks)

**Trigger:** clicking UI elements whose label matches keywords like:
`delete, remove, destroy, permanent, purge, publish, deploy, merge, pay, purchase, checkout, transfer, send to all, post`

The gate asks whether the action is undoable within 1 hour; if “No”, it requires either:
- a short rollback plan (≥ 12 characters), or
- confirmation of second-person review

Gmail Send is excluded here (handled by Output Gate).

---

## Detection details (what is detected)

Detection is implemented in `engine.js` using conservative regexes plus validation checks to reduce false positives.

### Always-on (all modes)
- **OpenAI keys**: `sk-...` (including `sk-proj-...`)
- **Google API keys**: `AIza...`
- **AWS access keys**: `AKIA...`
- **PEM private keys** and **certificates**
- **IBAN** (validated via **mod‑97**)

### Medium / High (not “low”)
- **GitHub tokens** (`ghp_`, `gho_`, `ghs_`, `ghu_`, `github_pat_...`)
- **Stripe** keys (`sk_test_`, `sk_live_`, `pk_test_`, `pk_live_`)
- **Slack tokens** (`xox...` formats)
- **Discord token-like** strings (heuristic)
- **Bearer tokens** in headers (`Authorization: Bearer ...`)
- “password/secret/token/api_key …” assignments (captures the **value**)
- ENV-style `...KEY=...` / `...TOKEN=...` / `...SECRET=...` assignments
- `docker login -p/--password ...` inline password
- Labeled JWT assignment (`jwt=...`)
- PIN/OTP/passcode values
- Emails (regex)
- Phones (heuristic)
- Card numbers (validated via **Luhn**)
- Obfuscated patterns (spaced emails/IBANs, split OpenAI keys)

### High only
- JWT tokens (heuristic scan) + cookie/session tokens (key=value)
- Romanian **CNP** (validated via checksum)
- Labeled identifiers: passport / ID doc / date of birth / address lines
- IPv4 addresses (validated 0–255)
- SSH public-key base64 material

---

## Options

Open **Extension options** (from the popup or `chrome://extensions` → Details → Extension options):

- Detection level: **low / medium / high**
- **Auto‑escalate** on risk signals (money/legal/medical terms)
- Input Gate:
  - enable/disable
  - auto-trigger on paste
  - auto-trigger on typing (after a short pause)
  - auto-redact default (off / light / strict)
  - redaction style: `tag` (`[EMAIL]`) or `mask` (`[IBAN••••1234]`)
- Prompt‑Injection Guard:
  - enable/disable
  - “silently wrap+paste when no sensitive data”
- Reasoning Gate (copy): enable/disable
- Output Gate (Gmail Send): enable/disable
- Action Gate: enable/disable
- File Upload Gate:
  - enable/disable
  - max inspect size (KB)
- Trace line:
  - `store` (log only)
  - `append` (append to the edited text)
  - `off`
- Local log:
  - enable/disable
  - max entries
  - clear log

---

## Local log

If enabled, events are stored in `chrome.storage.local` under the key **`aie_log`**.
Each entry includes `ts`, `url`, and an event-specific payload (e.g., `input_gate_paste`, `file_gate_redact`, `output_gate_pass`, etc.).

---

## Troubleshooting

Open the extension popup:

- **Diagnostics: PING this page**  
  Confirms the content scripts are running in the current tab.
- **Fix: Inject now (active tab)**  
  Forces injection via `chrome.scripting` + `activeTab`.
- **Self-test: open Input Gate overlay**  
  Sends a message to open the Input Gate overlay on the current page.
- **Open Playground**  
  Opens an offline test page bundled with the extension.

If pasting into a rich editor fails, AIngelExt falls back to copying the “safe” text to clipboard and shows a toast prompting a manual paste.

---

## Repository layout

- `manifest.json` — Manifest V3 definition + host permissions
- `service_worker.js` — injects scripts on supported tabs + sets default settings on install
- `engine.js` — detection + redaction utilities (no DOM)
- `injected.js` — gate logic + UI overlays + DOM insertion logic
- `popup.html` / `popup.js` — diagnostics/injection/self-test/playground links
- `options.html` / `options.js` — settings UI
- `playground.html` / `playground.js` — offline test page

---

## GitHub push protection note (important)

The playground/test pack may include strings that look like real secrets (e.g., Slack token formats).  
If GitHub **Push Protection** blocks your push:

- Do **not** commit real secrets.
- For test data, avoid literal secret-like strings in the repository. Prefer:
  - building them at runtime (string concatenation), or
  - using placeholders that **do not match** common secret patterns.

---

## Limitations

- Regex + validation heuristics can produce false positives/negatives.
- Only **text** uploads are inspectable in the File Upload Gate.
- Once you choose “Paste” or “Upload original”, the destination site handles the content normally (storage/retention is outside the extension’s control).

---

## License

This repository snapshot does not include a `LICENSE` file. Without an explicit license, default copyright applies.
