(() => {
  'use strict';

  // AIngelExtEngine: local-only detection + redaction utilities.
  // Exposes: window.AIngelExtEngine.detect(text, {level}), redact(text,{mode,style}), summarize(hits)

  const ZERO_WIDTH_RX = /[\u200B-\u200D\uFEFF]/g;

  // Redaction tags produced by this extension (treat as safe placeholders during rescans)
  const REDACTION_TAG_RX = /^\[[A-Z][A-Z0-9_]{2,40}\]$/;
  function isRedactionTag(v) { return REDACTION_TAG_RX.test(String(v || '').trim()); }

  function stripZeroWidth(s) {
    return String(s || '').replace(ZERO_WIDTH_RX, '');
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function toDigits(s) {
    return String(s || '').replace(/\D+/g, '');
  }

  // Luhn check for card numbers
  function luhnOk(digits) {
    const s = String(digits || '');
    if (!/^\d{13,19}$/.test(s)) return false;
    let sum = 0;
    let alt = false;
    for (let i = s.length - 1; i >= 0; i--) {
      let n = s.charCodeAt(i) - 48;
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return (sum % 10) === 0;
  }

  // IBAN mod-97 check
  function ibanOk(raw) {
    const iban = String(raw || '').replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;

    // Country-length sanity (partial table; fallback just range)
    const LEN = {
      AL: 28, AD: 24, AT: 20, AZ: 28, BH: 22, BE: 16, BA: 20, BR: 29, BG: 22, CR: 22,
      HR: 21, CY: 28, CZ: 24, DK: 18, DO: 28, EE: 20, FO: 18, FI: 18, FR: 27, GE: 22,
      DE: 22, GI: 23, GR: 27, GL: 18, GT: 28, HU: 28, IS: 26, IE: 22, IL: 23, IT: 27,
      JO: 30, KZ: 20, KW: 30, LV: 21, LB: 28, LI: 21, LT: 20, LU: 20, MK: 19, MT: 31,
      MR: 27, MU: 30, MD: 24, MC: 27, ME: 22, NL: 18, NO: 15, PK: 24, PS: 29, PL: 28,
      PT: 25, QA: 29, RO: 24, SM: 27, SA: 24, RS: 22, SK: 24, SI: 19, ES: 24, SE: 24,
      CH: 21, TN: 24, TR: 26, AE: 23, GB: 22, VG: 24
    };
    const expected = LEN[iban.slice(0, 2)];
    if (expected && iban.length !== expected) return false;

    // Move first 4 to end, replace letters with numbers
    const rearr = iban.slice(4) + iban.slice(0, 4);
    let expanded = '';
    for (const ch of rearr) {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90) expanded += String(code - 55);
      else expanded += ch;
    }

    // Compute mod 97 in chunks
    let remainder = 0;
    for (let i = 0; i < expanded.length; i += 7) {
      const block = String(remainder) + expanded.slice(i, i + 7);
      remainder = Number(block) % 97;
    }
    return remainder === 1;
  }

  // Romanian CNP checksum (optional but reduces false positives)
  function cnpOk(raw) {
    const s = String(raw || '').replace(/\D+/g, '');
    if (!/^\d{13}$/.test(s)) return false;
    const w = [2,7,9,1,4,6,3,5,8,2,7,9];
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += (s.charCodeAt(i)-48) * w[i];
    let c = sum % 11;
    if (c === 10) c = 1;
    return c === (s.charCodeAt(12)-48);
  }

  function ipv4Ok(raw) {
    const s = String(raw || '');
    const parts = s.split('.');
    if (parts.length !== 4) return false;
    for (const p of parts) {
      if (!/^\d{1,3}$/.test(p)) return false;
      const n = Number(p);
      if (n < 0 || n > 255) return false;
    }
    return true;
  }

  function looksLikeJwt(token) {
    const t = String(token || '').trim();
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)) return false;
    const parts = t.split('.');
    if (parts.length !== 3) return false;
    // quick size sanity
    if (parts[0].length < 8 || parts[1].length < 8 || parts[2].length < 8) return false;
    // try decode header JSON (optional)
    try {
      const b64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
      const pad = '='.repeat((4 - (b64.length % 4)) % 4);
      const json = atob(b64 + pad);
      const obj = JSON.parse(json);
      if (!obj || typeof obj !== 'object') return false;
      if (!obj.alg) return false;
    } catch {
      // if decode fails, still treat as plausible
    }
    return true;
  }

  function scanAll(text, kind, rx, priority, validateFn) {
    const t = String(text || '');
    const r = new RegExp(rx.source, rx.flags);
    const out = [];
    let m;
    while ((m = r.exec(t)) !== null) {
      const value = m[0];
      const start = m.index;
      const end = start + value.length;
      if (validateFn && !validateFn(value, m, t)) continue;
      out.push({ kind, value, start, end, priority });
      // Avoid infinite loops on zero-length
      if (m.index === r.lastIndex) r.lastIndex++;
    }
    return out;
  }

  function overlaps(a, b) {
    return a.start < b.end && b.start < a.end;
  }

  function pickNonOverlapping(spans) {
    const sorted = [...spans].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const la = a.end - a.start;
      const lb = b.end - b.start;
      if (lb !== la) return lb - la;
      return a.start - b.start;
    });
    const chosen = [];
    for (const s of sorted) {
      let ok = true;
      for (const c of chosen) {
        if (overlaps(s, c)) { ok = false; break; }
      }
      if (ok) chosen.push(s);
    }
    chosen.sort((a, b) => a.start - b.start);
    return chosen;
  }

  function applySpans(text, spans, replacer) {
    const t = String(text || '');
    if (!spans || !spans.length) return t;
    let out = '';
    let last = 0;
    for (const s of spans) {
      out += t.slice(last, s.start);
      out += replacer(s, t.slice(s.start, s.end));
      last = s.end;
    }
    out += t.slice(last);
    return out;
  }

  // --- Patterns ---
  // Keep regexes conservative to avoid breaking UX with false positives.
  const RX = {
    email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig,

    // Phone: requires either +country OR separators; avoids long contiguous digit blobs.
    phone: /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3}[\s-]\d{3,4}\b/g,

    // IBAN rough match; validated via mod-97.
    iban: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/ig,

    // Cards: 13-19 digits with optional spaces/dashes.
    card: /\b(?:\d[ -]?){13,19}\b/g,

    // Common API keys/tokens
    openai: /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,  // allow hyphen/underscore
    google: /\bAIza[0-9A-Za-z\-_]{20,}\b/g,
    aws_access: /\bAKIA[0-9A-Z]{16}\b/g,

    // GitHub tokens
    github: /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{20,}\b/g,
    github_pat: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,

    // Stripe
    stripe_sk: /\bsk_(?:test|live)_[A-Za-z0-9]{10,}\b/g,
    stripe_pk: /\bpk_(?:test|live)_[A-Za-z0-9]{10,}\b/g,

    // Slack
    slack: /\bxox[baprs]-\d{6,}-\d{6,}-[A-Za-z0-9]{10,}\b/g,

    // Discord (heuristic)
    discord: /\b[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{25,}\b/g,

    // Bearer tokens (capture token only)
    bearer: /\bAuthorization\s*:\s*Bearer\s+([A-Za-z0-9._\-~=+\/]{12,})\b/ig,

    // Password/secret assignments (capture value)
    secret_assign: /\b(?:password|passwd|pwd|secret|token|api[_-]?key|authorization|jwt|wpa2_key|psk|wifi_pass(?:word)?)\s*[:=]\s*(["']?)([^\s"']{8,})\1/ig,

    // ENV-style assignments (captures value): OPENAI_API_KEY=..., AWS_SECRET_ACCESS_KEY=..., etc.
    env_assign: /\b(?:export\s+)?[A-Z][A-Z0-9_]{2,50}(?:KEY|TOKEN|SECRET|PASSWORD|PASS|PSK)\b\s*=\s*(["']?)([^\s"']{8,})\1/ig,

    // CLI patterns with inline secrets
    // NOTE: keep this regex on a single line; use explicit \n/\r escapes.
    docker_pass: /\bdocker\s+login\b[^\n\r]*?\s(?:-p|--password)\s+([^\s]+?)(?=\s|$)/ig,
    // Explicit JWT assignment (captures token)
    jwt_assign: /\bjwt\s*[:=]\s*(["']?)([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\1\b/ig,

    // PIN/OTP/passcode (captures digits)
    pin_kv: /\b(?:PIN|OTP|PASSCODE)\s*[:=]\s*(\d{4,10})\b/ig,

    // URLs with embedded credentials
    url_cred: /\b[a-z][a-z0-9+.-]*:\/\/[^\s\/]+:[^\s\/]+@[^\s]+/ig,

    // DB URI credentials (more specific)
    db_uri: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)\:\/\/[^\s\/]+:[^\s\/]+@[^\s]+/ig,

    // Cookies (capture value)
    cookie_kv: /\b(?:sessionid|session|csrftoken|xsrf[-_]?token|auth[_-]?token|access[_-]?token|refresh[_-]?token)\s*=\s*([A-Za-z0-9._\-_]{10,})\b/ig,

    // PEM blocks
    private_key: /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----[\s\S]{40,}?-----END(?: [A-Z0-9]+)? PRIVATE KEY-----/g,
    certificate: /-----BEGIN CERTIFICATE-----[\s\S]{40,}?-----END CERTIFICATE-----/g,

    // PII / identifiers (high mode)
    cnp: /\b[1-9]\d{12}\b/g,
    passport_kv: /\b(?:pasaport|passport)\s*(?:nr\.?|no\.?|number)?\s*[:=]\s*([A-Z0-9]{6,12})\b/ig,
    id_kv: /\b(?:serie\s*ci|id\s*(?:series|no\.?|number)|ci)\s*[:=]\s*([A-Z]{1,3}\d{3,9})\b/ig,
    dob_kv: /\b(?:dat[ăa]\s*na[sș]tere|date\s*of\s*birth|dob)\s*[:=]\s*(\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4})\b/ig,
    address_kv: /\b(?:adres[ăa]|address)\s*[:=]\s*([^\n\r]{8,})/ig,

    // Network identifiers (high mode)
    ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

    // SSH public keys (high mode) - capture base64 material
    ssh_public: /\bssh-(?:rsa|ed25519|ecdsa)\s+([A-Za-z0-9+/=]{80,})(?:\s+[^\n\r]+)?/ig,

    // Obfuscation heuristics: spaced emails and spaced IBANs
    obf_email: /\b[A-Z0-9._%+-](?:[ \t]*[A-Z0-9._%+-]){0,64}[ \t]*@[ \t]*[A-Z0-9.-](?:[ \t]*[A-Z0-9.-]){0,255}[ \t]*\.[ \t]*(?:[A-Z][ \t]*){2,}\b/ig,
    obf_iban: /\b[A-Z]\s*[A-Z]\s*\d\s*\d(?:\s*[A-Z0-9]){11,30}\b/ig,
    obf_openai: /\bs\s*k\s*-\s*(?:p\s*r\s*o\s*j\s*-\s*)?(?:[A-Za-z0-9_-]\s*){16,}\b/ig,
  };

  function validateCard(value, m, t) {
    const digits = toDigits(value);
    if (!luhnOk(digits)) return false;
    // Avoid misclassifying IBAN-like sequences as cards (common in obfuscated IBAN tests).
    try {
      const start = (m && typeof m.index === 'number') ? m.index : -1;
      if (start >= 0 && t) {
        const ctx = String(t).slice(Math.max(0, start - 20), Math.min(String(t).length, start + String(value).length + 20));
        if (/I\s*B\s*A\s*N/i.test(ctx)) return false;
      }
    } catch {}
    return true;
  }

  function validatePhone(value) {
    const digits = toDigits(value);
    if (digits.length < 7 || digits.length > 15) return false;
    // Exclude likely card numbers
    if (digits.length >= 13 && digits.length <= 19 && luhnOk(digits)) return false;
    return true;
  }

  function validateIban(value) {
    return ibanOk(value);
  }

  function validateCnp(value) {
    return cnpOk(value);
  }

  function validateIpv4(value) {
    return ipv4Ok(value);
  }

  function detect(text, opts = {}) {
    const level = String(opts.level || 'medium');
    const raw = stripZeroWidth(text);

    const spans = [];

    // Priorities: higher wins on overlaps
    // Keys/certs highest, then db/url creds, then structured IDs, then general.

    // Always-on core
    spans.push(...scanAll(raw, 'private_key', RX.private_key, 100));
    spans.push(...scanAll(raw, 'certificate', RX.certificate, 95));

    spans.push(...scanAll(raw, 'openai_key', RX.openai, 90));
    spans.push(...scanAll(raw, 'aws_access_key', RX.aws_access, 90));
    spans.push(...scanAll(raw, 'google_api_key', RX.google, 88));

    // Extended tokens
    if (level !== 'low') {
      spans.push(...scanAll(raw, 'github_token', RX.github, 86));
      spans.push(...scanAll(raw, 'github_token', RX.github_pat, 86));
      spans.push(...scanAll(raw, 'stripe_secret', RX.stripe_sk, 86));
      spans.push(...scanAll(raw, 'stripe_publishable', RX.stripe_pk, 84));
      spans.push(...scanAll(raw, 'slack_token', RX.slack, 84));
      spans.push(...scanAll(raw, 'discord_token', RX.discord, 82));

      // URL creds
      spans.push(...scanAll(raw, 'url_credentials', RX.url_cred, 80));
      spans.push(...scanAll(raw, 'db_credentials', RX.db_uri, 80));

      // Bearer token: use group 1 as value/span
      {
        const r = new RegExp(RX.bearer.source, RX.bearer.flags);
        let m;
        while ((m = r.exec(raw)) !== null) {
          const full = m[0];
          const token = m[1] || '';
          if (isRedactionTag(token)) { if (m.index === r.lastIndex) r.lastIndex++; continue; }
          const idx = m.index + full.toLowerCase().indexOf('bearer');
          const tokenStart = raw.indexOf(token, idx);
          if (tokenStart >= 0) {
            spans.push({ kind: 'bearer_token', value: token, start: tokenStart, end: tokenStart + token.length, priority: 85 });
          }
          if (m.index === r.lastIndex) r.lastIndex++;
        }
      }

      // Secret assignments: capture value only
      {
        const r = new RegExp(RX.secret_assign.source, RX.secret_assign.flags);
        let m;
        while ((m = r.exec(raw)) !== null) {
          const value = m[2] || '';
          if (isRedactionTag(value)) { if (m.index === r.lastIndex) r.lastIndex++; continue; }
          const start = raw.indexOf(value, m.index);
          if (value && start >= 0) {
            spans.push({ kind: 'secret_value', value, start, end: start + value.length, priority: 83 });
          }
          if (m.index === r.lastIndex) r.lastIndex++;
        }
      }
    }

      // ENV assignments: capture value only (e.g., OPENAI_API_KEY=...)
      {
        const r = new RegExp(RX.env_assign.source, RX.env_assign.flags);
        let m;
        while ((m = r.exec(raw)) !== null) {
          const value = m[2] || '';
          if (isRedactionTag(value)) { if (m.index === r.lastIndex) r.lastIndex++; continue; }
          const start = raw.indexOf(value, m.index);
          if (value && start >= 0) spans.push({ kind: 'secret_value', value, start, end: start + value.length, priority: 83 });
          if (m.index === r.lastIndex) r.lastIndex++;
        }
      }

      // Docker login password flag
      {
        const r = new RegExp(RX.docker_pass.source, RX.docker_pass.flags);
        let m;
        while ((m = r.exec(raw)) !== null) {
          const value = m[1] || '';
          if (isRedactionTag(value)) { if (m.index === r.lastIndex) r.lastIndex++; continue; }
          const start = raw.indexOf(value, m.index);
          if (value && start >= 0) spans.push({ kind: 'secret_value', value, start, end: start + value.length, priority: 83 });
          if (m.index === r.lastIndex) r.lastIndex++;
        }
      }

      // JWT assignment (covers shorter 'signature' cases too)
      {
        const r = new RegExp(RX.jwt_assign.source, RX.jwt_assign.flags);
        let m;
        while ((m = r.exec(raw)) !== null) {
          const value = m[2] || '';
          if (isRedactionTag(value)) { if (m.index === r.lastIndex) r.lastIndex++; continue; }
          const start = raw.indexOf(value, m.index);
          if (value && start >= 0) spans.push({ kind: 'jwt', value, start, end: start + value.length, priority: 82 });
          if (m.index === r.lastIndex) r.lastIndex++;
        }
      }

      // PIN/OTP/passcode values
      {
        const r = new RegExp(RX.pin_kv.source, RX.pin_kv.flags);
        let m;
        while ((m = r.exec(raw)) !== null) {
          const value = m[1] || '';
          const start = raw.indexOf(value, m.index);
          if (value && start >= 0) spans.push({ kind: 'pin', value, start, end: start + value.length, priority: 65 });
          if (m.index === r.lastIndex) r.lastIndex++;
        }
      }

    // PII / financial
    spans.push(...scanAll(raw, 'iban', RX.iban, 70, validateIban));

    if (level !== 'low') {
      spans.push(...scanAll(raw, 'card', RX.card, 72, validateCard));
      spans.push(...scanAll(raw, 'email', RX.email, 60));
      spans.push(...scanAll(raw, 'phone', RX.phone, 58, validatePhone));
    } else {
      spans.push(...scanAll(raw, 'email', RX.email, 60));
    }

    // High mode: JWT and cookie/session
    if (level === 'high') {
      // JWT scan: avoid monstrous false positives; do a lightweight token scan.
      const jwtRx = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
      spans.push(...scanAll(raw, 'jwt', jwtRx, 82, (v) => looksLikeJwt(v)));
      {
        const r = new RegExp(RX.cookie_kv.source, RX.cookie_kv.flags);
        let m;
        while ((m = r.exec(raw)) !== null) {
          const val = m[1] || '';
          const start = raw.indexOf(val, m.index);
          if (val && start >= 0) spans.push({ kind: 'cookie_token', value: val, start, end: start + val.length, priority: 78 });
          if (m.index === r.lastIndex) r.lastIndex++;
        }
      }

      // PII / identifiers (high only)
      spans.push(...scanAll(raw, 'cnp', RX.cnp, 74, validateCnp));

      // Labeled identifiers: redact the captured value only.
      for (const [kind, rx, pr] of [
        ['passport', RX.passport_kv, 72],
        ['id_doc', RX.id_kv, 70],
        ['dob', RX.dob_kv, 68],
      ]) {
        const r = new RegExp(rx.source, rx.flags);
        let m;
        while ((m = r.exec(raw)) !== null) {
          const val = m[1] || '';
          const start = raw.indexOf(val, m.index);
          if (val && start >= 0) spans.push({ kind, value: val, start, end: start + val.length, priority: pr });
          if (m.index === r.lastIndex) r.lastIndex++;
        }
      }

      // Address: redact the rest of the line after label.
      {
        const r = new RegExp(RX.address_kv.source, RX.address_kv.flags);
        let m;
        while ((m = r.exec(raw)) !== null) {
          const val = m[1] || '';
          const start = raw.indexOf(val, m.index);
          if (val && start >= 0) spans.push({ kind: 'address', value: val, start, end: start + val.length, priority: 66 });
          if (m.index === r.lastIndex) r.lastIndex++;
        }
      }

      // IP addresses (many orgs treat as sensitive)
      spans.push(...scanAll(raw, 'ip', RX.ipv4, 45, validateIpv4));

      // SSH public key material (redact base64 blob)
      {
        const r = new RegExp(RX.ssh_public.source, RX.ssh_public.flags);
        let m;
        while ((m = r.exec(raw)) !== null) {
          const val = m[1] || '';
          const start = raw.indexOf(val, m.index);
          if (val && start >= 0) spans.push({ kind: 'ssh_public_key', value: val, start, end: start + val.length, priority: 79 });
          if (m.index === r.lastIndex) r.lastIndex++;
        }
      }
    }


    // Obfuscation detection (medium/high): spaced email / spaced iban / split keys.
    if (level !== 'low') {
      spans.push(...scanAll(raw, 'obfuscated_email', RX.obf_email, 55));
      spans.push(...scanAll(raw, 'obfuscated_iban', RX.obf_iban, 76, (v) => ibanOk(String(v).replace(/\s+/g, ''))));

      // Split/obfuscated OpenAI keys like: "sk-\n test- \n ...".
      // Treat as openai_key and redact the whole span.
      spans.push(...scanAll(raw, 'openai_key', RX.obf_openai, 90));
    }

    const chosen = pickNonOverlapping(spans);
    const hits = chosen.map(s => ({ kind: s.kind, value: s.value }));
    return { text: raw, spans: chosen, hits };
  }

  function replacementFor(span, original, style) {
    const kind = span.kind;
    const canonical = (kind === 'obfuscated_iban') ? 'iban' : (kind === 'obfuscated_email') ? 'email' : kind;
    const tag = `[${canonical.toUpperCase()}]`;
    const st = String(style || 'tag');

    if (st === 'mask') {
      const digits = toDigits(original);
      if (canonical === 'card' && digits.length >= 4) return `[CARD••••${digits.slice(-4)}]`;
      if ((canonical.includes('key') || canonical.includes('token') || canonical === 'secret_value') && original.length >= 8) {
        return `[${canonical.toUpperCase()}••••${original.slice(-4)}]`;
      }
      if (canonical === 'iban') {
        const t = String(original).replace(/\s+/g, '');
        return t.length >= 6 ? `[IBAN••••${t.slice(-4)}]` : '[IBAN]';
      }
      if (canonical === 'email') return '[EMAIL]';
      if (canonical === 'phone') return '[PHONE]';
      return tag;
    }

    return tag;
  }

  function redact(text, opts = {}) {
    const mode = String(opts.mode || 'off');
    if (mode === 'off') return String(text || '');

    // Map existing modes to detection levels
    // light => medium detection; strict => high detection
    const level = (mode === 'strict') ? 'high' : 'medium';
    const style = opts.style || 'tag';

    const { spans } = detect(text, { level });
    return applySpans(text, spans, (s, orig) => replacementFor(s, orig, style));
  }

  function summarize(hits) {
    const m = new Map();
    for (const h of (hits || [])) {
      const k = String(h.kind || 'unknown');
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries()).map(([kind, count]) => ({ kind, count }));
  }

  window.AIngelExtEngine = { detect, redact, summarize, _internal: { luhnOk, ibanOk } };
})();