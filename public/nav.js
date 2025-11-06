(function(){
  'use strict';
  // Lightweight global navigation helper injected on any page that includes this file.
  // Provides: Indietro, Avanti, Home, Chiudi.

  function goBack(){
    try {
      if (window.history && window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch(_) {}
    // Fallback to home
    goHome();
  }
  function goForward(){
    try { window.history.forward(); } catch(_) { /* noop */ }
  }
  function goHome(){
    // Home ufficiale (produzione) = SPA React su '/'
    var home = '/';
    try { window.location.href = home; }
    catch(_) { window.location.href = '/index.html'; }
  }
  function tryClose(){
    // Try to close a popup/child window; if not allowed, fallback to home
    var closed = false;
    try {
      window.close();
      // Some browsers ignore close() on non-popup tabs; schedule a fallback check
      setTimeout(function(){
        if (!closed) { goHome(); }
      }, 150);
    } catch(_) {
      goHome();
    }
  }

  function buildUI(){
    // Avoid duplicates
    if (document.getElementById('global-nav-bar')) return;
    var bar = document.createElement('div');
    bar.id = 'global-nav-bar';
    bar.style.position = 'fixed';
    bar.style.right = '12px';
    bar.style.bottom = '12px';
    bar.style.display = 'flex';
    bar.style.gap = '8px';
    bar.style.zIndex = '99999';
    bar.style.background = 'rgba(8,12,24,.72)';
    bar.style.backdropFilter = 'saturate(1.4) blur(6px)';
    bar.style.border = '1px solid rgba(255,255,255,.08)';
    bar.style.borderRadius = '999px';
    bar.style.padding = '8px';

    function btn(label, action, variant){
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.font = '500 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      b.style.padding = '6px 10px';
      b.style.borderRadius = '999px';
      b.style.border = '1px solid rgba(255,255,255,.12)';
      b.style.cursor = 'pointer';
      b.style.color = '#e5e7eb';
      b.style.background = variant === 'primary' ? 'linear-gradient(180deg,#16a34a,#15803d)' : 'rgba(255,255,255,.06)';
      b.style.boxShadow = variant === 'primary' ? 'inset 0 1px rgba(255,255,255,.18), 0 6px 14px rgba(0,0,0,.35)' : 'inset 0 1px rgba(255,255,255,.10)';
      b.addEventListener('click', action);
      return b;
    }

    bar.appendChild(btn('Indietro', goBack));
    bar.appendChild(btn('Avanti', goForward));
    bar.appendChild(btn('Home', goHome, 'primary'));
    bar.appendChild(btn('Chiudi', tryClose));

    document.body.appendChild(bar);
  }

  function wireAutoCloseHook(){
    // Allow pages to call window.__closeAfter(ms) to auto-close/redirect to home.
    try {
      window.__closeAfter = function(ms){
        var t = Number(ms || 1200);
        setTimeout(tryClose, t);
      };
    } catch(_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ buildUI(); wireAutoCloseHook(); });
  } else {
    buildUI(); wireAutoCloseHook();
  }
})();
