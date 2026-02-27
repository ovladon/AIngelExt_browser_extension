(() => {
  'use strict';

  const q = document.getElementById('q');
  const btnGo = document.getElementById('go');
  const btnOpen = document.getElementById('open');

  function normalize(s){ return String(s || '').trim(); }

  function isLikelyUrl(s) {
    const t = normalize(s);
    if (!t) return false;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return true;
    // domain.tld[/...]
    if (/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:[\/?:#].*)?$/i.test(t)) return true;
    return false;
  }

  function toUrl(s) {
    const t = normalize(s);
    if (!t) return null;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t;
    // add https:// for bare domains
    return 'https://' + t;
  }

  function searchUrl(query) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(query);
  }

  function goSearch() {
    const t = normalize(q.value);
    if (!t) return;
    // If user pasted secrets, injected.js will intercept paste and gate; here we only navigate.
    location.href = isLikelyUrl(t) ? toUrl(t) : searchUrl(t);
  }

  function goOpen() {
    const t = normalize(q.value);
    if (!t) return;
    location.href = toUrl(t);
  }

  btnGo.addEventListener('click', goSearch);
  btnOpen.addEventListener('click', goOpen);

  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goSearch();
    }
  });

  // Autofocus for parity with the default New Tab.
  setTimeout(() => { try { q.focus(); } catch {} }, 0);
})();
