const elInput = document.getElementById('input');
const elOutput = document.getElementById('output');
const elPills = document.getElementById('pills');
const elMeta = document.getElementById('meta');
const elStyle = document.getElementById('style');

const RAW_TEST_PACK = `=== AIngelExt – TEST PACK (SINTETIC / FICTIV) ===
Scop: să declanșeze detectarea pentru cât mai multe tipuri de date sensibile.
ATENȚIE: NU înlocui nimic cu date reale.

[1] EMAIL-uri
- test@example.com
- nume.prenume+tag@sub.domeniu.ro
- support@company.tld
- "Nume Prenume" <nume.prenume@domeniu.com>

[2] TELEFON
- +40 721 234 567
- 0721-234-567
- +1 (202) 555-0199

[3] IBAN / CONT BANCAR
- IBAN (RO): RO49AAAA1B31007593840000
- IBAN (DE): DE89370400440532013000
- IBAN (GB): GB29NWBK60161331926819

[4] CARD (NUMERE DE TEST)
- VISA test: 4242 4242 4242 4242  exp: 12/34  CVV: 123
- MasterCard test: 5555 5555 5555 4444  exp: 11/33  CVV: 321
- AMEX test: 3782 822463 10005  exp: 10/35  CID: 1234

[5] PAROLE / PASSFRAZE / PIN
- password=Pa$$w0rd!2026
- passphrase: correct horse battery staple
- PIN: 4938
- WiFi: SSID=HOME_NET_5G ; WPA2_KEY=MyWiFiPass!234

[6] API KEYS / TOKENS (FICTIVE)
- OpenAI-like: sk-proj-TESTabcDEF1234567890xyzTEST
- GitHub token: ghp_1A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r
- Stripe secret: sk_test_51N0fakeKey1234567890abcdefghijklmnopqrstuv
- Stripe publishable: pk_test_51N0fakeKey1234567890abcdefghijklmnopqrstuv
- Google API key-like: AIzaSyD-FAKEKEY_1234567890abcdefghijklmn
- Slack bot token-like: s/xoxb-REDACTED/SLACK_TOKEN_REDACTED/g
- Discord token-like: MTAwMDAwMDAwMDAwMDAwMDAw.GhIjKl.MnOpQrStUvWxYz0123456789ab

[7] JWT / BEARER TOKEN (FICTIV)
- Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiZHVtbXkiLCJleHAiOjQ3NDA5NjAwMDB9.signature

[8] CONEXIUNI / CREDENTIALS ÎN URL / DB
- https://user:SuperSecretPass!@example.com/private
- postgresql://dbuser:DBpass!2026@db.example.local:5432/appdb?sslmode=require

[9] COOKIE / SESSION (FICTIV)
- Cookie: sessionid=sess_7f3a9c1e2d4b5a6c7d8e9f0a; csrftoken=csrf_abcdef0123456789

[10] PEM (FICTIV)
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDcFAKEFAKEFAKE
FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE
-----END PRIVATE KEY-----

[11] OBFUSCARE
- e m a i l : t e s t @ e x a m p l e . c o m
- I B A N : R O 4 9 A A A A 1 B 3 1 0 0 7 5 9 3 8 4 0 0 0 0
=== END TEST PACK ===`;

function pill(kind, count) {
  const d = document.createElement('div');
  d.className = 'pill';
  d.textContent = `${kind} ×${count}`;
  return d;
}

function renderSummary(hits) {
  elPills.innerHTML = '';
  const summary = window.AIngelExtEngine.summarize(hits);
  summary.sort((a,b) => b.count - a.count || a.kind.localeCompare(b.kind));
  for (const it of summary) elPills.appendChild(pill(it.kind, it.count));
  elMeta.textContent = summary.length ? `• kinds: ${summary.length} • hits: ${hits.length}` : '• no hits';
}

function runDetect() {
  const t = elInput.value || '';
  const res = window.AIngelExtEngine.detect(t, { level: 'high' });
  renderSummary(res.hits);
  elOutput.textContent = t;
}

function runRedact(mode) {
  const style = elStyle.value;
  const t = elInput.value || '';
  const out = window.AIngelExtEngine.redact(t, { mode, style });
  const res = window.AIngelExtEngine.detect(out, { level: 'high' });
  renderSummary(res.hits);
  elOutput.textContent = out;
}

document.getElementById('load').addEventListener('click', () => {
  elInput.value = RAW_TEST_PACK;
  runDetect();
});

document.getElementById('detect').addEventListener('click', runDetect);
document.getElementById('redactLight').addEventListener('click', () => runRedact('light'));
document.getElementById('redactStrict').addEventListener('click', () => runRedact('strict'));

document.getElementById('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(elOutput.textContent || '');
  } catch {}
});

// Initial content
elInput.value = RAW_TEST_PACK;
runDetect();
