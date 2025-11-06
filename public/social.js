(function(){
  'use strict';

  // Elements
  const $ = (id) => document.getElementById(id);
  const form = $('composeForm');
  const inputImage = $('ssImage');
  const inputTitle = $('ssTitle');
  const inputDate = $('ssDate');
  const inputCity = $('ssCity');
  const inputDesc = $('ssDesc');
  const statusEl = $('ssStatus');
  const publishBtn = $('ssPublishBtn');
  const feedEl = $('ssFeed');
  const userNameEl = $('ssUserName');
  const fanBtn = $('ssFanBtn');
  const artistBtn = $('ssArtistBtn');
  const authBox = $('ssAuthBox');
  const logoutBtn = $('ssLogoutBtn');
  const userBox = $('ssUserBox');
  const previewImg = $('ssPreview');
  const progWrap = $('ssProgress');
  const progBar = $('ssProgressBar');
  const useLocChk = $('ssUseLocation');
  const showDistChk = $('ssShowDistance');

  // Artist verification modal elements
  const artistModal = $('artistModal');
  const artistForm = $('artistForm');
  const artistSubmit = $('artistSubmit');
  const artistCancel = $('artistCancel');
  const artistStatus = $('artistStatus');
  const artSpotify = $('artSpotify');
  const artApple = $('artApple');
  const artProof = $('artProof');

  // Profile elements
  const profForm = $('profileForm');
  const profDisplay = $('profDisplay');
  const profLink = $('profLink');
  const profBio = $('profBio');
  const profPhoto = $('profPhoto');
  const profSaveBtn = $('profSaveBtn');
  const profStatus = $('profStatus');

  // Reels elements
  const reelForm = $('reelForm');
  const reelTitle = $('reelTitle');
  const reelDesc = $('reelDesc');
  const reelVideo = $('reelVideo');
  const reelPublishBtn = $('reelPublishBtn');
  const reelStatus = $('reelStatus');
  const reelsFeed = $('reelsFeed');
  const reelProgWrap = $('reelProgress');
  const reelProgBar = $('reelProgressBar');
  // Will be assigned after Firebase init
  let db, storage, auth, fn;

  // Feed listener handles for attach/detach on auth state
  let feedRef = null;
  let feedCb = null;
  // Reels feed listener
  let reelsRef = null;
  let reelsCb = null;

  // Geolocation state
  let userGeo = null; // { lat, lng }
  let useLocation = false;
  let showDistance = false;
  let lastAuthUid = null;
  let scrolledToCompose = false;

  // ---- Debug & notifications helpers ----
  function debug(msg, extra){
    try { console.log('[Social]', msg, extra ?? ''); } catch(_) {}
  }
  function showToast(message, type = 'info', timeout = 2600){
    try {
      const container = document.getElementById('ssToastContainer') || createToastContainer();
      const el = document.createElement('div');
      const variant = (type === 'success') ? 'ss-toast-success' : (type === 'error') ? 'ss-toast-error' : 'ss-toast-info';
      el.className = `ss-toast ${variant}`;
      const p = document.createElement('p');
      p.textContent = String(message || '');
      const close = document.createElement('button');
      close.setAttribute('aria-label', 'Chiudi');
      close.textContent = '×';
      let closed = false;
      const closeNow = () => {
        if (closed) return;
        closed = true;
        try {
          el.style.animation = 'ss-toast-out .18s ease forwards';
          setTimeout(() => el.remove(), 180);
        } catch(_) { el.remove(); }
      };
      close.addEventListener('click', closeNow);
      el.appendChild(p);
      el.appendChild(close);
      container.appendChild(el);
      // limit max toasts
      while (container.children.length > 4) container.firstChild.remove();
      if (timeout) setTimeout(closeNow, timeout);
    } catch(_) {}
  }
  function createToastContainer(){
    const c = document.createElement('div');
    c.id = 'ssToastContainer';
    c.className = 'ss-toast-container';
    c.setAttribute('aria-live', 'polite');
    c.setAttribute('aria-atomic', 'true');
    document.body.appendChild(c);
    return c;
  }
  function successAlert(msg){
    setStatus(msg, 'success');
    showToast(msg, 'success');
    debug('SUCCESS: ' + msg);
  }
  function errorAlert(ctx, err, userMsg){
    try { console.error(`[Social][ERROR][${ctx}]`, err); } catch(_) {}
    setStatus(userMsg || 'Si è verificato un errore.', 'error');
    showToast(userMsg || 'Si è verificato un errore.', 'error', 3200);
  }

  function setStatus(msg, variant = 'info') {
    statusEl.textContent = msg || '';
    statusEl.style.color = variant === 'error' ? '#fca5a5' : variant === 'success' ? '#a7f3d0' : '';
  }

  function formatDate(isoDate) {
    if (!isoDate) return '';
    try {
      // Input is yyyy-mm-dd from <input type="date">
      const [y, m, d] = isoDate.split('-').map(Number);
      const dt = new Date(y, (m - 1), d);
      return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(dt);
    } catch(e) {
      return isoDate;
    }
  }

  function createPostCard(key, data){
    const card = document.createElement('article');
    card.className = 'ss-card';
    card.setAttribute('role', 'listitem');

    if (data.imageUrl) {
      const img = document.createElement('img');
      img.className = 'ss-card-img';
      img.src = data.imageUrl;
      img.alt = data.title ? `Volantino: ${data.title}` : 'Volantino evento';
      img.loading = 'lazy';
      card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'ss-card-body';

    const h3 = document.createElement('h3');
    h3.className = 'ss-card-title';
    h3.textContent = data.title || 'Evento';

    const meta = document.createElement('div');
    meta.className = 'ss-card-meta';

    const dateSpan = document.createElement('span');
    dateSpan.textContent = formatDate(data.date);

    const citySpan = document.createElement('span');
    citySpan.textContent = data.city || '';

    const userSpan = document.createElement('span');
    userSpan.textContent = data.userName ? `• ${data.userName}` : '';

    // Distance approx if both user and event have coords
    if (showDistance && userGeo && typeof data.lat === 'number' && typeof data.lng === 'number') {
      const km = haversineKm(userGeo.lat, userGeo.lng, data.lat, data.lng);
      const dist = document.createElement('span');
      dist.textContent = `• ~${Math.round(km)} km`;
      meta.appendChild(dist);
    }

    meta.appendChild(dateSpan);
    if (data.city) meta.appendChild(citySpan);
    if (data.userName) meta.appendChild(userSpan);

    const desc = document.createElement('p');
    desc.className = 'ss-card-desc';
    desc.textContent = data.desc || '';

    body.appendChild(h3);
    body.appendChild(meta);
    if (data.desc) body.appendChild(desc);

    const footer = document.createElement('div');
    footer.className = 'ss-card-footer';

    const rsvpWrap = document.createElement('div');
    rsvpWrap.className = 'ss-card-rsvp';

    const pill = document.createElement('span');
    pill.className = 'ss-pill';
    pill.textContent = `${Number(data.rsvp || 0)} RSVP`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ss-btn ss-btn-ghost';
    btn.textContent = 'Partecipo';
    btn.addEventListener('click', () => handleRSVP(key, btn, pill));

    rsvpWrap.appendChild(pill);
    rsvpWrap.appendChild(btn);

  // Likes UI
  const likePill = document.createElement('span');
  likePill.className = 'ss-pill';
  likePill.textContent = `${Number(data.likesCount || 0)} Mi piace`;

  const likeBtn = document.createElement('button');
  likeBtn.type = 'button';
  likeBtn.className = 'ss-btn ss-btn-ghost';
  likeBtn.textContent = 'Mi piace';
  likeBtn.addEventListener('click', () => handleLike(key, likeBtn, likePill));

  const likeWrap = document.createElement('div');
  likeWrap.className = 'ss-card-rsvp';
  likeWrap.appendChild(likePill);
  likeWrap.appendChild(likeBtn);

  footer.appendChild(rsvpWrap);
  footer.appendChild(likeWrap);

    // Owner actions (Edit/Delete) shown only if current user owns this post
    try {
      const uid = auth && auth.currentUser ? auth.currentUser.uid : null;
      if (uid && data && data.userId === uid) {
        const actions = document.createElement('div');
        actions.className = 'ss-card-actions';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'ss-btn ss-btn-ghost';
        editBtn.textContent = 'Modifica';
        editBtn.addEventListener('click', () => handleEditPost(key, data));

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'ss-btn ss-btn-danger';
        delBtn.textContent = 'Elimina';
        delBtn.style.marginLeft = '8px';
        delBtn.addEventListener('click', () => handleDeletePost(key, data));

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
        footer.appendChild(actions);
      }
    } catch(_) {}

    card.appendChild(body);
    card.appendChild(footer);

    return card;
  }

  function handleRSVP(key, buttonEl, pillEl){
    if (!auth.currentUser) {
      setStatus('Accedi con Google per partecipare.', 'error');
      return;
    }
    buttonEl.disabled = true;
    buttonEl.style.opacity = '0.7';
    const postRef = db.ref('posts').child(key).child('rsvp');
    postRef.transaction(current => (Number(current) || 0) + 1, (error, committed, snap) => {
      buttonEl.disabled = false;
      buttonEl.style.opacity = '';
      if (error) {
        errorAlert('post.rsvp', error, 'Impossibile registrare RSVP. Riprova.');
        return; // soft
      }
      if (committed) {
        const newVal = Number(snap && snap.val()) || 0;
        pillEl.textContent = `${newVal} RSVP`;
        debug('RSVP incremented', { key, newVal });
      }
    });
  }

  function renderFeed(snapshot){
    const val = snapshot.val() || {};
    const items = Object.entries(val)
      .map(([key, data]) => ({ key, data }))
      .sort((a, b) => Number(b.data.createdAt || 0) - Number(a.data.createdAt || 0))
      .slice(0, 50);

    // Clear
    feedEl.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'ss-status';
      empty.style.margin = '6px 0 20px';
      empty.textContent = 'Nessun evento pubblicato. Scrivi il primo annuncio!';
      feedEl.appendChild(empty);
      return;
    }

    // Rebuild
    for (const { key, data } of items) {
      const card = createPostCard(key, data);
      feedEl.appendChild(card);
    }
  }

  // ---- Reels (top-level) ----
  function createReelCard(key, data){
    const card = document.createElement('article');
    card.className = 'ss-card';
    card.setAttribute('role', 'listitem');

    const body = document.createElement('div');
    body.className = 'ss-card-body';

    const h3 = document.createElement('h3');
    h3.className = 'ss-card-title';
    h3.textContent = data.title || 'Reel';

    const meta = document.createElement('div');
    meta.className = 'ss-card-meta';
    meta.textContent = data.userName ? `• ${data.userName}` : '';

    const desc = document.createElement('p');
    desc.className = 'ss-card-desc';
    desc.textContent = data.desc || '';

    const video = document.createElement('video');
    video.src = data.videoUrl || '';
    video.controls = true;
    video.playsInline = true;
    video.muted = true;
    video.preload = 'metadata';
    video.style.width = '100%';
    video.style.borderRadius = '8px';

    body.appendChild(h3);
    body.appendChild(meta);
    if (data.desc) body.appendChild(desc);

    const footer = document.createElement('div');
    footer.className = 'ss-card-footer';

    // Owner actions
    try {
      const uid = auth && auth.currentUser ? auth.currentUser.uid : null;
      if (uid && data && data.userId === uid) {
        const actions = document.createElement('div');
        actions.className = 'ss-card-actions';
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'ss-btn ss-btn-danger';
        delBtn.textContent = 'Elimina';
        delBtn.addEventListener('click', () => handleDeleteReel(key, data));
        actions.appendChild(delBtn);
        footer.appendChild(actions);
      }
    } catch(_) {}

    card.appendChild(video);
    card.appendChild(body);
    card.appendChild(footer);
    return card;
  }

  function renderReels(snapshot){
    const val = snapshot.val() || {};
    const items = Object.entries(val)
      .map(([key, data]) => ({ key, data }))
      .sort((a, b) => Number(b.data.createdAt || 0) - Number(a.data.createdAt || 0))
      .slice(0, 20);
    if (reelsFeed) reelsFeed.innerHTML = '';
    for (const { key, data } of items) {
      const card = createReelCard(key, data);
      if (reelsFeed) reelsFeed.appendChild(card);
    }
  }

  function attachReels(){
    if (!reelsFeed || reelsRef) return;
    reelsRef = db.ref('reels').orderByChild('createdAt').limitToLast(20);
    reelsCb = renderReels;
    reelsRef.on('value', reelsCb, (err) => errorAlert('db.reels', err, 'Errore caricando i reels.'));
  }

  function detachReels(){
    if (reelsRef && reelsCb) reelsRef.off('value', reelsCb);
    reelsRef = null; reelsCb = null;
  }

  // Lightweight inline modal editor to update all main fields and optionally replace image
  function showEditModal(existing){
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.style.position = 'fixed';
      ov.style.inset = '0';
      ov.style.background = 'rgba(0,0,0,0.5)';
      ov.style.zIndex = '9999';
      ov.addEventListener('click', (e)=>{ if(e.target===ov) cleanup(null); });

      const box = document.createElement('div');
      box.style.maxWidth = '680px';
      box.style.width = '92%';
      box.style.margin = '6vh auto';
      box.style.background = '#111827';
      box.style.color = '#e5e7eb';
      box.style.borderRadius = '12px';
      box.style.boxShadow = '0 10px 30px rgba(0,0,0,.45)';
      box.style.padding = '16px';

      const title = document.createElement('h3');
      title.textContent = 'Modifica evento';
      title.style.margin = '0 0 8px';

      const f = document.createElement('form');
      f.autocomplete = 'off';

      const row = (label, inputEl) => {
        const wrap = document.createElement('div');
        wrap.style.margin = '8px 0';
        const l = document.createElement('label');
        l.textContent = label;
        l.style.display = 'block';
        l.style.marginBottom = '4px';
        wrap.appendChild(l);
        wrap.appendChild(inputEl);
        return wrap;
      };

      const inTitle = document.createElement('input');
      inTitle.type = 'text';
      inTitle.value = existing.title || '';
      inTitle.required = true;
      inTitle.style.width = '100%';

      const inDate = document.createElement('input');
      inDate.type = 'date';
      inDate.value = existing.date || '';
      inDate.required = true;
      inDate.style.width = '100%';

      const inCity = document.createElement('input');
      inCity.type = 'text';
      inCity.value = existing.city || '';
      inCity.required = true;
      inCity.style.width = '100%';

      const inDesc = document.createElement('textarea');
      inDesc.rows = 3;
      inDesc.value = existing.desc || '';
      inDesc.required = true;
      inDesc.style.width = '100%';

      const inFile = document.createElement('input');
      inFile.type = 'file';
      inFile.accept = 'image/*';
      inFile.style.width = '100%';

      const locWrap = document.createElement('div');
      locWrap.style.margin = '8px 0';
      const useLoc = document.createElement('input');
      useLoc.type = 'checkbox';
      const useLocLbl = document.createElement('label');
      useLocLbl.style.marginLeft = '6px';
      useLocLbl.textContent = 'Aggiorna posizione con la mia posizione attuale';
      locWrap.appendChild(useLoc);
      locWrap.appendChild(useLocLbl);
      if (!userGeo) { useLoc.disabled = true; useLocLbl.textContent += ' (posizione non disponibile)'; }

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '8px';
      actions.style.marginTop = '12px';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Annulla';
      cancel.className = 'ss-btn ss-btn-ghost';
      const save = document.createElement('button');
      save.type = 'submit';
      save.textContent = 'Salva';
      save.className = 'ss-btn ss-btn-primary';

      actions.appendChild(cancel);
      actions.appendChild(save);

      f.appendChild(row('Titolo', inTitle));
      f.appendChild(row('Data', inDate));
      f.appendChild(row('Città', inCity));
      f.appendChild(row('Descrizione breve', inDesc));
      f.appendChild(row('Sostituisci volantino (opzionale)', inFile));
      f.appendChild(locWrap);
      f.appendChild(actions);

      const cleanup = (result) => {
        try { document.body.removeChild(ov); } catch(_) {}
        resolve(result || null);
      };

      f.addEventListener('submit', (e)=>{
        e.preventDefault();
        const vTitle = (inTitle.value || '').trim();
        const vDate = (inDate.value || '').trim();
        const vCity = (inCity.value || '').trim();
        const vDesc = (inDesc.value || '').trim();
        if (!vTitle || !vDate || !vCity || !vDesc) { showToast('Compila tutti i campi.', 'error'); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(vDate)) { showToast('Data non valida (YYYY-MM-DD).', 'error'); return; }
        cleanup({ title: vTitle, date: vDate, city: vCity, desc: vDesc, file: (inFile.files && inFile.files[0]) || null, setGeo: !!useLoc.checked });
      });
      cancel.addEventListener('click', ()=> cleanup(null));
      document.addEventListener('keydown', function onKey(e){ if (e.key==='Escape'){ document.removeEventListener('keydown', onKey); cleanup(null);} });

      box.appendChild(title);
      box.appendChild(f);
      ov.appendChild(box);
      document.body.appendChild(ov);
    });
  }

  async function handleEditPost(key, data){
    if (!auth.currentUser || !data || data.userId !== auth.currentUser.uid) return;
    try {
      const res = await showEditModal(data);
      if (!res) return;

      const updates = { title: res.title, date: res.date, city: res.city, desc: res.desc };

      // If requested, update coordinates from current geolocation (only add; removal not supported by rules)
      if (res.setGeo && userGeo && typeof userGeo.lat === 'number' && typeof userGeo.lng === 'number') {
        updates.lat = userGeo.lat;
        updates.lng = userGeo.lng;
      }

      // If replacing image, upload and set new URL
      let newUrl = '';
      if (res.file) {
        try {
          const url = await uploadVolantino(res.file, auth.currentUser.uid, key);
          if (url) newUrl = url;
        } catch (e) {
          errorAlert('post.edit.upload', e, 'Upload nuova immagine fallito.');
        }
      }
      if (newUrl) updates.imageUrl = newUrl;

      await db.ref('posts').child(key).update(updates);

      // Try to delete old image if replaced
      if (newUrl && data.imageUrl) {
        try { const r = storage.refFromURL(data.imageUrl); await r.delete(); } catch(_) {}
      }

      successAlert('Post aggiornato');
    } catch (e) {
      errorAlert('post.edit', e, 'Impossibile aggiornare il post.');
    }
  }

  async function handleDeletePost(key, data){
    if (!auth.currentUser || !data || data.userId !== auth.currentUser.uid) return;
    try {
      const ok = confirm('Eliminare questo post? L\'azione non è reversibile.');
      if (!ok) return;

      // Delete DB node first
      await db.ref('posts').child(key).remove();

      // Attempt to delete image from Storage if present
      try {
        if (data.imageUrl) {
          const ref = storage.refFromURL(data.imageUrl);
          await ref.delete();
        }
      } catch (e) {
        // Non bloccante: l\'immagine potrebbe essere già rimossa o l\'URL non risolvibile
        console.warn('[Social] storage.delete image failed', e);
      }

      successAlert('Post eliminato');
    } catch (e) {
      errorAlert('post.delete', e, 'Impossibile eliminare il post.');
    }
  }

  function uploadVolantino(file, uid, postId, onProgress){
    if (!file) return Promise.resolve('');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `images/${uid}/${postId}/${Date.now()}_${safeName}`; // /images/{uid}/{postId}/{filename}
    const storageRef = storage.ref().child(path);
    return new Promise((resolve, reject) => {
      const task = storageRef.put(file);
      task.on('state_changed', (snap) => {
        if (onProgress && snap && snap.totalBytes) {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          onProgress(pct);
        }
      }, reject, async () => {
        try {
          const url = await storageRef.getDownloadURL();
          resolve(url);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async function onSubmit(e){
    e.preventDefault();
    if (!auth.currentUser) {
      setStatus('Accedi con Google per pubblicare.', 'error');
      return;
    }
    const title = (inputTitle.value || '').trim();
    const date = (inputDate.value || '').trim();
    const city = (inputCity.value || '').trim();
    const desc = (inputDesc.value || '').trim();
  const file = inputImage.files && inputImage.files[0];
    const user = auth.currentUser;
    const userName = (user && (user.displayName || user.email)) || (userNameEl ? (userNameEl.textContent || '').trim() : 'Utente');

    if (!title || !date || !city || !desc) {
      setStatus('Compila tutti i campi richiesti.', 'error');
      return;
    }

    publishBtn.disabled = true;
    publishBtn.style.opacity = '0.7';
    setStatus('Pubblicazione in corso…');

    try {
      const postsRef = db.ref('posts');
      const newKey = postsRef.push().key; // generate key without writing
      // show progress bar if uploading
      if (file && progWrap) { progWrap.hidden = false; progBar.style.width = '0%'; }
      const imageUrl = await uploadVolantino(file, user.uid, newKey, (pct) => {
        if (progBar) progBar.style.width = `${pct}%`;
      });

      const postData = {
        title, date, city, desc,
        imageUrl: imageUrl || '',
        userName: userName || 'Utente',
        userId: user ? user.uid : null,
        rsvp: 0,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };

      // attach geolocation if available
      if (useLocation && userGeo && typeof userGeo.lat === 'number' && typeof userGeo.lng === 'number') {
        postData.lat = userGeo.lat;
        postData.lng = userGeo.lng;
      }

      await db.ref('posts').child(newKey).set(postData);

      form.reset();
      successAlert('Pubblicato!');

      // Optional: clear status after a short delay
      setTimeout(() => setStatus(''), 2500);
    } catch (err) {
      errorAlert('post.publish', err, 'Errore durante la pubblicazione. Riprova.');
    } finally {
      publishBtn.disabled = false;
      publishBtn.style.opacity = '';
      if (progWrap) { progWrap.hidden = true; }
    }
  }

  function attachFeed(){
    if (feedRef) return; // already attached
    feedRef = db.ref('posts').orderByChild('createdAt').limitToLast(50);
    feedCb = renderFeed;
    feedRef.on('value', feedCb, (err) => errorAlert('db.feed', err, 'Errore caricando gli eventi.'));
    debug('Feed attached');
  }

  function detachFeed(){
    if (feedRef && feedCb) {
      feedRef.off('value', feedCb);
    }
    feedRef = null;
    feedCb = null;
    debug('Feed detached');
  }

  function enableCompose(enabled){
    // Permetti la digitazione anche da non loggato per migliorare il flusso;
    // il Publish resta disabilitato finché non si effettua l'accesso.
    if (publishBtn) publishBtn.disabled = !enabled;
    if (!enabled) {
      setStatus('Il feed è pubblico. Accedi come Artista per pubblicare.');
    } else {
      setStatus('');
    }
  }

  // Smooth scroll to the compose form and focus the first input
  function scrollToComposeAndFocus(){
    try {
      if (!form) return;
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // give time to scroll before focusing
      // brief highlight pulse
      try { form.classList.add('ss-highlight'); setTimeout(()=> form.classList.remove('ss-highlight'), 1600); } catch(_) {}
      setTimeout(()=> { if (inputTitle) inputTitle.focus(); }, 360);
      scrolledToCompose = true;
    } catch(_) {}
  }

  async function updateUIForUser(user){
    if (!userBox) return;
    // Ensure public feeds are visible
    attachFeed();
    attachReels();
    if (user) {
      const display = user.displayName || user.email || 'Utente';
      if (userNameEl) userNameEl.textContent = display;
      userBox.hidden = false;
      if (fanBtn) fanBtn.hidden = true;
      if (artistBtn) artistBtn.hidden = true;
      const allowed = await isArtist(user.uid);
      if (allowed) {
        enableCompose(true);
        setStatus('');
        if (!scrolledToCompose) scrollToComposeAndFocus();
      } else {
        enableCompose(false);
        setStatus('Solo gli artisti possono pubblicare. Puoi richiedere la verifica dal bottone in alto.', 'error');
      }
      maybeLoadProfile(user);
      if (user.uid !== lastAuthUid) {
        successAlert(`Accesso effettuato come ${display}`);
        lastAuthUid = user.uid;
      }
    } else {
      if (userNameEl) userNameEl.textContent = '';
      userBox.hidden = true;
      if (fanBtn) fanBtn.hidden = false;
      if (artistBtn) artistBtn.hidden = false;
      enableCompose(false);
      if (lastAuthUid) {
        successAlert('Disconnesso');
        lastAuthUid = null;
      }
      scrolledToCompose = false;
    }
  }

  // ---- Profile logic ----
  async function loadProfile(uid){
    try {
      const snap = await db.ref('profiles').child(uid).once('value');
      const p = snap.val() || {};
      if (profDisplay) profDisplay.value = p.displayName || '';
      if (profLink) profLink.value = p.link || '';
      if (profBio) profBio.value = p.bio || '';
    } catch (e) { /* ignore */ }
  }

  async function onSaveProfile(e){
    e.preventDefault();
    if (!auth.currentUser) { setProfileStatus('Accedi per salvare il profilo.', 'error'); return; }
    const uid = auth.currentUser.uid;
    const displayName = (profDisplay && profDisplay.value || '').trim();
    const link = (profLink && profLink.value || '').trim();
    const bio = (profBio && profBio.value || '').trim();
    const file = profPhoto && profPhoto.files && profPhoto.files[0];
    try {
      profSaveBtn.disabled = true;
      setProfileStatus('Salvataggio…');
      let photoUrl = '';
      if (file) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `profiles/${uid}/${Date.now()}_${safe}`;
        const ref = storage.ref().child(path);
        await ref.put(file);
        photoUrl = await ref.getDownloadURL();
      }
      const updates = { displayName, link, bio };
      if (photoUrl) updates.photoUrl = photoUrl;
      await db.ref('profiles').child(uid).update(updates);
      setProfileStatus('Profilo salvato', 'success');
    } catch (e) {
      setProfileStatus('Errore salvando il profilo', 'error');
    } finally {
      profSaveBtn.disabled = false;
      setTimeout(()=> setProfileStatus(''), 2000);
    }
  }

  function setProfileStatus(msg, variant='info'){
    if (!profStatus) return;
    profStatus.textContent = msg || '';
    profStatus.style.color = variant === 'error' ? '#fca5a5' : variant === 'success' ? '#a7f3d0' : '';
  }

  // When auth changes, prefill profile form
  function maybeLoadProfile(user){
    if (user && profForm) loadProfile(user.uid);
  }
  // Initial prefill will occur after auth state resolves via updateUIForUser
  const MAX_REEL_MB = 30;
  const MAX_REEL_BYTES = MAX_REEL_MB * 1024 * 1024;

  async function onSubmitReel(e){
    e.preventDefault();
    if (!auth.currentUser) { setReelStatus('Accedi per caricare un reel.', 'error'); return; }
    const user = auth.currentUser;
    const title = (reelTitle && reelTitle.value || '').trim();
    const desc = (reelDesc && reelDesc.value || '').trim();
    const file = reelVideo && reelVideo.files && reelVideo.files[0];
    if (!title || !file) { setReelStatus('Inserisci titolo e seleziona un video.', 'error'); return; }
    if (file.size > MAX_REEL_BYTES) { setReelStatus(`Video troppo grande (>${MAX_REEL_MB} MB).`, 'error'); return; }

    reelPublishBtn.disabled = true;
    setReelStatus('Caricamento…');
    if (reelProgWrap) { reelProgWrap.hidden = false; reelProgBar.style.width = '0%'; }

    try {
      const reelsRoot = db.ref('reels');
      const newKey = reelsRoot.push().key;
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `reels/${user.uid}/${newKey}/${Date.now()}_${safe}`;
      const storageRef = storage.ref().child(path);
      await new Promise((resolve, reject) => {
        const t = storageRef.put(file);
        t.on('state_changed', (snap)=>{
          if (snap && snap.totalBytes) {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            if (reelProgBar) reelProgBar.style.width = pct + '%';
          }
        }, reject, resolve);
      });
      const videoUrl = await storageRef.getDownloadURL();
      const userName = user.displayName || user.email || 'Utente';
      await db.ref('reels').child(newKey).set({
        title, desc: desc || '',
        videoUrl,
        userId: user.uid,
        userName,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
      setReelStatus('Reel caricato', 'success');
      reelForm.reset();
      setTimeout(()=> setReelStatus(''), 2000);
    } catch (e) {
      setReelStatus('Errore caricando il reel', 'error');
    } finally {
      reelPublishBtn.disabled = false;
      if (reelProgWrap) reelProgWrap.hidden = true;
    }
  }

  async function handleDeleteReel(key, data){
    if (!auth.currentUser || !data || data.userId !== auth.currentUser.uid) return;
    try {
      const ok = confirm('Eliminare questo reel?');
      if (!ok) return;
      await db.ref('reels').child(key).remove();
      try { if (data.videoUrl) { const r = storage.refFromURL(data.videoUrl); await r.delete(); } } catch(_) {}
      successAlert('Reel eliminato');
    } catch (e) {
      errorAlert('reel.delete', e, 'Impossibile eliminare il reel.');
    }
  }

  function setReelStatus(msg, variant='info'){
    if (!reelStatus) return;
    reelStatus.textContent = msg || '';
    reelStatus.style.color = variant === 'error' ? '#fca5a5' : variant === 'success' ? '#a7f3d0' : '';
  }

  // Likes handling: idempotent like per user
  async function handleLike(postId, buttonEl, pillEl){
    if (!auth.currentUser) {
      setStatus('Accedi come Fan per mettere Mi piace.', 'error');
      return;
    }
    const uid = auth.currentUser.uid;
    buttonEl.disabled = true;
    try {
      const likeRef = db.ref('posts').child(postId).child('likes').child(uid);
      const res = await likeRef.transaction((cur)=>{
        if (cur === true) return; // no-op to cancel commit
        return true;
      });
      const committed = res && res.committed === true;
      if (committed) {
        await db.ref('posts').child(postId).child('likesCount').transaction((n)=> (Number(n)||0) + 1);
        // update UI
        const snap = await db.ref('posts').child(postId).child('likesCount').once('value');
        const val = Number(snap.val() || 0);
        if (pillEl) pillEl.textContent = `${val} Mi piace`;
        buttonEl.textContent = 'Piaciuto';
      } else {
        // already liked
        buttonEl.textContent = 'Piaciuto';
      }
    } catch (e) {
      errorAlert('post.like', e, 'Impossibile mettere Mi piace.');
    } finally {
      buttonEl.disabled = false;
    }
  }

  async function doLogin(){
    try {
      setStatus('Accesso in corso…');
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        await auth.signInWithPopup(provider);
      } catch (err) {
        // Fallback for environments where popup is blocked or unsupported
        if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment')) {
          await auth.signInWithRedirect(provider);
        } else {
          throw err;
        }
      }
    } catch (e) {
      errorAlert('auth.login', e, 'Accesso non riuscito. Riprova.');
    }
  }

  async function handleFanEnter(){
    await doLogin();
  }

  function openArtistModal(){
    const modal = document.getElementById('artistModal');
    if (!modal) return;
    modal.hidden = false;
    try { modal.style.display = 'flex'; } catch(_) {}
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeArtistModal(){
    const modal = document.getElementById('artistModal');
    if (modal) {
      modal.hidden = true;
      try { modal.style.display = 'none'; } catch(_) {}
      modal.setAttribute('aria-hidden', 'true');
    }
    const st = document.getElementById('artistStatus');
    if (st) st.textContent = '';
    try {
      const f = document.getElementById('artistForm');
      if (f) f.reset();
    } catch(_) {}
  }

  async function onArtistSubmit(e){
    e.preventDefault();
    if (!auth.currentUser) { if (artistStatus) artistStatus.textContent = 'Accedi per inviare.'; return; }
    const uid = auth.currentUser.uid;
    const profile = { uid, email: auth.currentUser.email || '', displayName: auth.currentUser.displayName || '' };
    const payload = {
      spotify: (artSpotify && artSpotify.value || '').trim(),
      apple: (artApple && artApple.value || '').trim(),
      proof: (artProof && artProof.value || '').trim(),
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      ...profile
    };
    try {
      if (artistSubmit) artistSubmit.disabled = true;
      if (artistStatus) { artistStatus.style.color=''; artistStatus.textContent = 'Invio…'; }
      await db.ref('artistRequests').child(uid).set(payload);
      await db.ref('users').child(uid).update({ requestedAt: firebase.database.ServerValue.TIMESTAMP });
      // Try auto-verify via callable if a Spotify link is provided
      const sp = payload.spotify;
      const fx = (window.__fnEU || fn || (firebase && firebase.functions && firebase.functions()));
      if (fx && sp) {
        try {
          const callable = fx.httpsCallable('verifyArtist');
          const res = await callable({ spotify: sp });
          if (res && res.data && res.data.verified) {
            if (artistStatus) { artistStatus.style.color = '#a7f3d0'; artistStatus.textContent = 'Verificato automaticamente via Spotify.'; }
            setTimeout(closeArtistModal, 1200);
            // Re-check UI privileges shortly
            setTimeout(()=> { updateUIForUser(auth.currentUser); scrollToComposeAndFocus(); }, 1400);
            return;
          }
        } catch(_) { /* ignore */ }
      }
      if (artistStatus) { artistStatus.style.color = '#a7f3d0'; artistStatus.textContent = 'Richiesta inviata. Ti avviseremo appena verificato.'; }
      setTimeout(closeArtistModal, 1600);
    } catch (e) {
      if (artistStatus) { artistStatus.style.color = '#fca5a5'; artistStatus.textContent = 'Errore durante l\'invio.'; }
    } finally {
      if (artistSubmit) artistSubmit.disabled = false;
    }
  }

  async function handleArtistEnter(){
    if (!auth.currentUser) {
      await doLogin();
    }
    if (auth.currentUser) {
      const ok = await isArtist(auth.currentUser.uid);
      if (ok) {
        showToast('Profilo artista già verificato.', 'success');
      } else {
        openArtistModal();
      }
    }
  }

  async function doLogout(){
    try {
      await auth.signOut();
    } catch (e) {
      errorAlert('auth.logout', e, 'Errore durante la disconnessione.');
    }
  }

  async function waitForFirebase(timeoutMs = 8000){
    // Wait until firebase.initializeApp has completed (via window.__firebaseReady or apps[])
    const start = Date.now();
    if (window.__firebaseReady && typeof window.__firebaseReady.then === 'function') {
      try { await window.__firebaseReady; } catch(_) {}
    }
    while (!(window.firebase && firebase.apps && firebase.apps.length)) {
      if (Date.now() - start > timeoutMs) break;
      await new Promise(r => setTimeout(r, 50));
    }
  }

  async function init(){
    if (!form || !feedEl) return;
    // Wait firebase init
    await waitForFirebase();

    // Assign services safely
    try {
      auth = firebase.auth();
      db = firebase.database();
      storage = firebase.storage();
  fn = firebase.functions();
  try { window.__fnEU = firebase.functions('europe-west1'); } catch(_) { window.__fnEU = fn; }
    } catch (e) {
      errorAlert('firebase.init', e, 'Errore inizializzando Firebase.');
      return;
    }

  form.addEventListener('submit', onSubmit);
  if (fanBtn) fanBtn.addEventListener('click', handleFanEnter);
  if (artistBtn) artistBtn.addEventListener('click', handleArtistEnter);
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
    if (inputImage) inputImage.addEventListener('change', onFileChange);
    if (useLocChk) useLocChk.addEventListener('change', onUseLocationToggle);
    if (showDistChk) showDistChk.addEventListener('change', onShowDistanceToggle);
  if (profForm) profForm.addEventListener('submit', onSaveProfile);
  if (profPhoto) profPhoto.addEventListener('change', ()=> setStatus(''));
  if (reelForm) reelForm.addEventListener('submit', onSubmitReel);
    // Bind modal listeners (query fresh to ensure elements exist even if script loaded before DOM)
    const _artistForm = document.getElementById('artistForm');
    const _artistCancel = document.getElementById('artistCancel');
    const _artistClose = document.getElementById('artistClose');
    const _artistModal = document.getElementById('artistModal');
    if (_artistForm) _artistForm.addEventListener('submit', onArtistSubmit);
    if (_artistCancel) _artistCancel.addEventListener('click', closeArtistModal);
    if (_artistClose) _artistClose.addEventListener('click', closeArtistModal);
    if (_artistModal) {
      _artistModal.addEventListener('click', (e)=>{ if (e.target === _artistModal) closeArtistModal(); });
      document.addEventListener('keydown', function onEsc(ev){ if (ev.key === 'Escape' && !_artistModal.hidden){ closeArtistModal(); }});
    }

    // Defensive: delegate click in case the direct listener is missed by timing
    document.addEventListener('click', function(ev){
      try {
        var t = ev.target;
        if (!t) return;
        if (t.id === 'artistClose') { ev.preventDefault(); closeArtistModal(); return; }
        if (t.closest && t.closest('#artistClose')) { ev.preventDefault(); closeArtistModal(); return; }
      } catch(_) {}
    });

    // Expose a global fallback for inline onclick
    try { window.__closeArtistModal = closeArtistModal; } catch(_) {}

  // Start with public feed visible; compose disabled until artist login
  attachFeed();
  attachReels();
  enableCompose(false);
  updateUIForUser(null);

    auth.onAuthStateChanged(async (user) => {
      debug('Auth state changed', user ? { uid: user.uid, email: user.email } : null);
      await updateUIForUser(user || null);
    });

    // Try to get user geolocation for suggestions and distance
    tryGeolocate();

    // Replace blocking alerts with toasts across the page
    try { window.alert = (msg) => showToast(String(msg || ''), 'info', 2800); } catch(_) {}
  }

  // Check if current uid is in artists allowlist
  async function isArtist(uid){
    try {
      const snap = await db.ref('users').child(uid).child('isArtist').once('value');
      return snap.val() === true;
    } catch (e) { return false; }
  }

  function onUseLocationToggle(){
    useLocation = !!useLocChk.checked;
    if (useLocation && !userGeo) {
      tryGeolocate();
    }
  }

  function onShowDistanceToggle(){
    showDistance = !!showDistChk.checked;
    // Re-render feed quickly from current data
    if (feedRef) {
      feedRef.once('value', renderFeed);
    }
  }

  function tryGeolocate(){
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords || {};
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        userGeo = { lat: latitude, lng: longitude };
        debug('Geolocation OK', userGeo);
        // Suggest city if blank using reverse geocode (Nominatim)
        suggestCityFromCoords(latitude, longitude);
      }
    }, (err) => {
      try { console.warn('[Social][GEO] denied/unavailable', err); } catch(_) {}
      if (useLocation) setStatus('Impossibile ottenere la posizione. Controlla i permessi.', 'error');
    }, { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 });
  }

  async function suggestCityFromCoords(lat, lng){
    try {
      if (!inputCity) return;
      if ((inputCity.value || '').trim()) return; // don't override user's input
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=it`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      const addr = data && data.address ? data.address : {};
      const candidate = addr.city || addr.town || addr.village || addr.municipality || addr.county;
      if (candidate) {
        // Put as placeholder; if still empty, also fill value
        inputCity.placeholder = candidate;
        if (!(inputCity.value || '').trim()) {
          inputCity.value = candidate;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  function haversineKm(lat1, lon1, lat2, lon2){
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // File validation, preview, and status messaging
  const MAX_MB = 7;
  const MAX_BYTES = MAX_MB * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg','image/png','image/webp'];

  function onFileChange(){
    const file = inputImage && inputImage.files && inputImage.files[0];
    if (!file) {
      hidePreview();
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setStatus('Formato non supportato. Usa JPG, PNG o WEBP.', 'error');
      inputImage.value = '';
      hidePreview();
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus(`File troppo grande (>${MAX_MB} MB).`, 'error');
      inputImage.value = '';
      hidePreview();
      return;
    }
    // Show preview
    const url = URL.createObjectURL(file);
    if (previewImg) {
      previewImg.src = url;
      previewImg.hidden = false;
    }
    setStatus('');
  }

  function hidePreview(){
    if (previewImg) {
      previewImg.hidden = true;
      previewImg.removeAttribute('src');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
