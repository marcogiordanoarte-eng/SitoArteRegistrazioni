(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const statusEl = $('admStatus');
  const listEl = $('reqList');
  const loginBtn = $('admLogin');
  const logoutBtn = $('admLogout');
  const userSpan = $('admUser');
  const gate = $('admGate');

  let auth, db, fnsEU;
  let reqRef = null, reqCb = null;

  function setStatus(msg, variant='info'){
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.style.color = variant === 'error' ? '#fca5a5' : variant === 'success' ? '#a7f3d0' : '';
  }

  async function waitForFirebase(timeoutMs = 8000){
    const start = Date.now();
    if (window.__firebaseReady && typeof window.__firebaseReady.then === 'function') {
      try { await window.__firebaseReady; } catch(_) {}
    }
    while (!(window.firebase && firebase.apps && firebase.apps.length)) {
      if (Date.now() - start > timeoutMs) break;
      await new Promise(r => setTimeout(r, 50));
    }
  }

  function createCard(uid, data){
    const card = document.createElement('article');
    card.className = 'ss-card';
    card.setAttribute('role', 'listitem');

    const body = document.createElement('div');
    body.className = 'ss-card-body';

    const title = document.createElement('h3');
    title.className = 'ss-card-title';
    title.textContent = data.displayName || data.email || uid;

    const meta = document.createElement('div');
    meta.className = 'ss-card-meta';
    const when = data.createdAt ? new Date(data.createdAt).toLocaleString('it-IT') : '';
    meta.textContent = [when, data.email || '', data.spotify || ''].filter(Boolean).join(' • ');

    const proof = document.createElement('p');
    proof.className = 'ss-card-desc';
    const parts = [];
    if (data.spotify) parts.push('Spotify: ' + data.spotify);
    if (data.apple) parts.push('Apple: ' + data.apple);
    if (data.proof) parts.push('Prova: ' + data.proof);
    proof.textContent = parts.join(' | ');

    const footer = document.createElement('div');
    footer.className = 'ss-card-footer';

  const verifyBtn = document.createElement('button');
    verifyBtn.type = 'button';
    verifyBtn.className = 'ss-btn ss-btn-ghost';
    verifyBtn.textContent = 'Verifica Spotify';
    verifyBtn.addEventListener('click', async ()=>{
      try {
        setStatus('Verifica in corso…');
        const callable = (fnsEU || firebase.functions('europe-west1')).httpsCallable('verifyArtist');
        const res = await callable({ spotify: data.spotify || '' });
        if (res && res.data && res.data.verified) {
          setStatus('Auto-verificato via Spotify', 'success');
        } else {
          setStatus('Nessuna release trovata su Spotify.', 'error');
        }
      } catch (e) {
        setStatus('Errore verifica Spotify', 'error');
      }
    });

    const approveBtn = document.createElement('button');
    approveBtn.type = 'button';
    approveBtn.className = 'ss-btn ss-btn-primary';
    approveBtn.textContent = 'Approva';
    approveBtn.style.marginLeft = '8px';
    approveBtn.addEventListener('click', async ()=>{
      try {
        setStatus('Approvazione…');
        const callable = (fnsEU || firebase.functions('europe-west1')).httpsCallable('approveArtist');
        const res = await callable({ uid });
        if (res && res.data && res.data.ok) {
          setStatus('Approvato', 'success');
        } else {
          setStatus('Approvazione fallita (risposta non OK)', 'error');
        }
      } catch (e) {
        // Mostra dettagli utili per debug: code, message
        const code = e && (e.code || e.name) || 'error';
        const msg = e && (e.message || e.toString()) || '';
        let hint = '';
        if (/app[- ]?check/i.test(msg) || /app[- ]?check/i.test(code)) {
          hint = ' • Suggerimento: se sei in locale e le Functions hanno App Check attivo, ricarica con ?debugAppCheck=1 oppure imposta localStorage.enable-appcheck-debug="1" e ricarica.';
        } else if (/permission-denied/i.test(code)) {
          hint = ' • Suggerimento: verifica di essere loggato con l’account admin e che /admins/<uid>=true sia presente.';
        }
        setStatus(`Errore durante approvazione: ${code} – ${msg}${hint}`,'error');
        try { console.error('[approveArtist] error', e); } catch(_) {}
      }
    });

    footer.appendChild(verifyBtn);
    footer.appendChild(approveBtn);

    card.appendChild(body);
    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(proof);
    card.appendChild(footer);
    return card;
  }

  function renderList(snap){
    const val = snap.val() || {};
    const items = Object.entries(val).map(([uid, data])=>({ uid, data }))
      .sort((a,b)=> (Number(b.data.createdAt||0) - Number(a.data.createdAt||0)));
    listEl.innerHTML = '';
    for (const it of items) {
      listEl.appendChild(createCard(it.uid, it.data || {}));
    }
    setStatus(items.length ? '' : 'Nessuna richiesta trovata');
  }

  function attach(){
    if (reqRef) return;
    reqRef = db.ref('artistRequests');
    reqCb = renderList;
    reqRef.on('value', reqCb, (err)=> setStatus('Errore caricando richieste', 'error'));
  }
  function detach(){
    if (reqRef && reqCb) reqRef.off('value', reqCb);
    reqRef = null; reqCb = null;
  }

  async function isAdmin(uid){
    try {
      const snap = await db.ref('admins').child(uid).once('value');
      return snap && snap.val() === true;
    } catch { return false; }
  }

  async function updateUI(user){
    if (user) {
      userSpan.textContent = user.email || user.displayName || user.uid;
      loginBtn.hidden = true; logoutBtn.hidden = false;
      const allowed = await isAdmin(user.uid);
      gate.hidden = allowed;
      if (allowed) {
        attach();
      } else {
        detach();
        setStatus('Accesso riservato agli amministratori.');
      }
    } else {
      userSpan.textContent = '';
      loginBtn.hidden = false; logoutBtn.hidden = true;
      gate.hidden = false;
      detach();
      setStatus('');
    }
  }

  async function doLogin(){
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      try { provider.setCustomParameters({ prompt: 'select_account' }); } catch(_) {}
      await auth.signInWithPopup(provider);
    } catch (e) {
      const code = e && (e.code || e.name) || 'error';
      const msg = e && (e.message || e.toString()) || '';
      let hint = '';
      const popupBlocked = /auth\/popup-blocked|popup/i.test(code);
      const popupClosed = /auth\/popup-closed-by-user/i.test(code);
      const unauthorizedDomain = /auth\/unauthorized-domain/i.test(code) || /unauthorized domain/i.test(msg);
      const unsupportedEnv = /operation-not-supported|web-storage-unsupported|third[- ]party cookie/i.test(code+ ' ' + msg);
      if (popupBlocked) hint = ' • Sblocca i popup o verrà usato il redirect.';
      else if (popupClosed) hint = ' • La finestra di login è stata chiusa: riprova.';
      else if (unauthorizedDomain) hint = ' • Aggiungi 127.0.0.1 e localhost ai Domini autorizzati in Firebase Auth.';
      else if (unsupportedEnv) hint = ' • I cookie di terze parti potrebbero essere bloccati: provo login con redirect.';
      setStatus(`Login fallito: ${code} – ${msg}${hint}`, 'error');
      try { console.error('[login] error', e); } catch(_) {}
      // Fallback automatico al redirect per i casi più comuni
      if (popupBlocked || unsupportedEnv) {
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          await auth.signInWithRedirect(provider);
        } catch (e2) {
          const code2 = e2 && (e2.code || e2.name) || 'error';
          const msg2 = e2 && (e2.message || e2.toString()) || '';
          setStatus(`Login (redirect) fallito: ${code2} – ${msg2}`, 'error');
          try { console.error('[login redirect] error', e2); } catch(_) {}
        }
      }
    }
  }
  async function doLogout(){ try { await auth.signOut(); } catch { } }

  async function init(){
    await waitForFirebase();
    auth = firebase.auth();
    db = firebase.database();
    // Initialize compat Functions instance pinned to europe-west1
    try { fnsEU = firebase.app().functions('europe-west1'); } catch(_) { fnsEU = null; }
    loginBtn.addEventListener('click', doLogin);
    logoutBtn.addEventListener('click', doLogout);
    // Gestisci eventuale ritorno dal login via redirect
    try {
      const res = await auth.getRedirectResult();
      if (res && res.user) {
        setStatus('Login completato (redirect).');
      }
    } catch (e) {
      const code = e && (e.code || e.name) || 'error';
      const msg = e && (e.message || e.toString()) || '';
      setStatus(`Errore post-redirect: ${code} – ${msg}`, 'error');
      try { console.error('[getRedirectResult] error', e); } catch(_) {}
    }
    auth.onAuthStateChanged((u)=> updateUI(u || null));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
