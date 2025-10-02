import functions from 'firebase-functions';
import admin from 'firebase-admin';
import fetch from 'node-fetch';
import archiver from 'archiver';

admin.initializeApp();
const storage = admin.storage();
const firestore = admin.firestore();

// Callable: genera uno ZIP da una lista di tracce e lo salva su Storage, ritorna l'URL firmato
export const generateAlbumZip = functions.https.onCall(async (data, context) => {
  const { artistId, albumIndex } = data || {};
  if (!artistId || typeof albumIndex !== 'number') {
    throw new functions.https.HttpsError('invalid-argument', 'artistId e albumIndex sono richiesti');
  }

  // Enforce: richiedi utente autenticato (dashboard admin)
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticazione richiesta');
  }

  // Carica artista da Firestore
  const docRef = firestore.collection('artists').doc(artistId);
  const snap = await docRef.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Artista non trovato');
  const artist = snap.data();
  const album = (artist.albums || [])[albumIndex];
  if (!album) throw new functions.https.HttpsError('not-found', 'Album non trovato');
  const tracks = (album.tracks || []).filter(t => t && t.link);
  if (!tracks.length) throw new functions.https.HttpsError('failed-precondition', 'Nessuna traccia disponibile');

  // Prepara Stream ZIP in memoria (evita file temporanei)
  const bucket = storage.bucket();
  const artistSlug = slugify(artist.nome || artist.name || 'artist');
  const albumSlug = slugify(album.title || 'album');
  const timestamp = Date.now();
  const destPath = `album-zips/${artistSlug}/${albumSlug}_${timestamp}.zip`;
  const dispositionName = `${artistSlug}-${albumSlug}.zip`.replace(/[^A-Za-z0-9._-]+/g, '_');
  const file = bucket.file(destPath);
  const passThrough = file.createWriteStream({ contentType: 'application/zip', metadata: { contentDisposition: `attachment; filename="${dispositionName}"` } });

  const archive = archiver('zip', { zlib: { level: 0 } }); // STORE-like per audio
  archive.on('warning', err => functions.logger.warn('archiver warn', err));
  archive.on('error', err => { throw err; });

  const pipePromise = new Promise((resolve, reject) => {
    passThrough.on('finish', resolve);
    passThrough.on('error', reject);
  });

  archive.pipe(passThrough);

  // Aggiungi ogni traccia
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    const idxStr = String(i + 1).padStart(2, '0');
    const baseName = (t.title || `Track ${idxStr}`).trim() || `Track ${idxStr}`;
    const safeBase = baseName.replace(/[^a-z0-9\- _()\[\].,]/gi, '_').slice(0, 80);
    const extGuess = (t.link.split('?')[0].split('.').pop() || 'mp3').toLowerCase();
    const filename = `${idxStr} - ${safeBase}.${extGuess}`;

    // Scarica la traccia (https) e appendi allo zip
    const res = await fetch(t.link);
    if (!res.ok) throw new Error(`Download failed ${t.link} ${res.status}`);
    const buf = await res.arrayBuffer();
    archive.append(Buffer.from(buf), { name: filename, store: true });
  }

  await archive.finalize();
  await pipePromise;

  // Rendi scaricabile: ottieni URL firmato
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 1000 * 60 * 60 * 24 * 30 }); // 30 giorni

  // Aggiorna Firestore con downloadLink
  const patch = { albums: [...(artist.albums || [])] };
  patch.albums[albumIndex] = { ...(patch.albums[albumIndex] || {}), downloadLink: url };
  await docRef.update(patch);

  return { url, path: destPath };
});

function slugify(str) {
  return (str || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '').slice(0, 60) || 'item';
}

// Callable: genera una Signed POST Policy V4 per upload diretto dal browser
export const getUploadPolicy = functions.https.onCall(async (data, context) => {
  const { path, contentType } = data || {};
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticazione richiesta');
  }
  if (!path || typeof path !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Parametro path mancante');
  }
  const ct = typeof contentType === 'string' && contentType ? contentType : 'application/octet-stream';
  try {
    const bucket = storage.bucket();
    const file = bucket.file(path);
    const expires = Date.now() + 10 * 60 * 1000; // 10 minuti
    const [policy] = await file.generateSignedPostPolicyV4({
      expires,
      fields: { 'Content-Type': ct }
    });
    return { url: policy.url, fields: policy.fields };
  } catch (err) {
    console.error('Errore getUploadPolicy', err);
    throw new functions.https.HttpsError('internal', err.message || 'Errore generazione policy');
  }
});
