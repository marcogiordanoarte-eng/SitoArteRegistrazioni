import functions from 'firebase-functions';
import admin from 'firebase-admin';
import { v1 as videoIntelligence } from '@google-cloud/video-intelligence';
import archiver from 'archiver';
import OpenAI from 'openai';
import sgMail from '@sendgrid/mail';
import { PassThrough } from 'stream';
import { spawn } from 'child_process';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

// Determina dinamicamente il bucket di default.
// Nota: per i progetti Firebase nuovi, lo storageBucket è "<project>.firebasestorage.app".
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'arteregistrazioni-2025';
let DEFAULT_BUCKET = `${PROJECT_ID}.appspot.com`;
try {
  if (process.env.FIREBASE_CONFIG) {
    const cfg = JSON.parse(process.env.FIREBASE_CONFIG);
    if (cfg && cfg.storageBucket) {
      DEFAULT_BUCKET = cfg.storageBucket; // es. arteregistrazioni-2025.firebasestorage.app
    }
  }
} catch {}
admin.initializeApp({ storageBucket: DEFAULT_BUCKET });
const storage = admin.storage();
const firestore = admin.firestore();
const bucket = admin.storage().bucket();

// ===== Moderation utilities =====
function likelihoodToScore(l) {
  // Vision SafeSearch likelihood mapping
  const map = {
    VERY_UNLIKELY: 0.0,
    UNLIKELY: 0.2,
    POSSIBLE: 0.5,
    LIKELY: 0.75,
    VERY_LIKELY: 0.9
  };
  return map[l] ?? 0;
}

// Text moderation via Perspective API
// ENV first (preferred): PERSPECTIVE_API_KEY, PERSPECTIVE_THRESHOLD
// Legacy fallback: functions:config:set perspective.key=... perspective.threshold=...
export const moderateText = functions.https.onCall(async (data, context) => {
  const { text } = data || {};
  const cfg = functions.config();
  const apiKey = process.env.PERSPECTIVE_API_KEY || cfg?.perspective?.key;
  const thresholdCfg = Number(process.env.PERSPECTIVE_THRESHOLD ?? cfg?.perspective?.threshold);
  const THRESHOLD = Number.isFinite(thresholdCfg) ? Math.max(0, Math.min(1, thresholdCfg)) : 0.5;
  if (!text || typeof text !== 'string') {
    return { allow: true, reason: 'empty' };
  }
  if (!apiKey) {
    // If not configured, allow but flag pending
    return { allow: true, pending: true };
  }
  try {
    const body = {
      comment: { text },
      languages: ['it', 'en'],
      requestedAttributes: {
        TOXICITY: {},
        INSULT: {},
        THREAT: {},
        IDENTITY_ATTACK: {}
      }
    };
    const resp = await fetch(`https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await resp.json();
    const toks = j?.attributeScores?.TOXICITY?.summaryScore?.value || 0;
    const insult = j?.attributeScores?.INSULT?.summaryScore?.value || 0;
    const threat = j?.attributeScores?.THREAT?.summaryScore?.value || 0;
    const ident = j?.attributeScores?.IDENTITY_ATTACK?.summaryScore?.value || 0;
    const maxScore = Math.max(toks, insult, threat, ident);
    const allow = maxScore < THRESHOLD;
    return { allow, scores: { toks, insult, threat, ident }, threshold: THRESHOLD };
  } catch (e) {
    functions.logger.warn('moderateText error', e);
    return { allow: true, pending: true };
  }
});

// Image moderation via Google Vision SafeSearch (REST) using API key
// ENV first (preferred): VISION_API_KEY
// Legacy fallback: functions:config:set vision.key=YOUR_KEY
export const moderateImage = functions.https.onCall(async (data, context) => {
  const { storagePath } = data || {};
  const key = process.env.VISION_API_KEY || functions.config()?.vision?.key;
  if (!storagePath) throw new functions.https.HttpsError('invalid-argument', 'storagePath richiesto');
  if (!key) return { allow: true, pending: true };
  try {
    const file = bucket.file(storagePath);
    const [buf] = await file.download();
    const b64 = buf.toString('base64');
    const body = {
      requests: [{
        image: { content: b64 },
        features: [{ type: 'SAFE_SEARCH_DETECTION' }]
      }]
    };
    const resp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await resp.json();
    const ann = j?.responses?.[0]?.safeSearchAnnotation || {};
    const adult = likelihoodToScore(ann.adult);
    const violence = likelihoodToScore(ann.violence);
    const racy = likelihoodToScore(ann.racy);
    const allow = (adult < 0.5) && (violence < 0.5) && (racy < 0.5);
    return { allow, scores: { adult, violence, racy } };
  } catch (e) {
    functions.logger.warn('moderateImage error', e);
    return { allow: true, pending: true };
  }
});

// Video moderation via Google Cloud Video Intelligence (Explicit Content Detection)
// Requires enabling the Video Intelligence API for the project. Auth uses the function's service account.
// Input: { storagePath?: string, gcsUri?: string, threshold?: number, segments?: [{start:number,end:number}] }
// Output: { allow: boolean, scores: { maxPornScore: number, frameCount: number }, flaggedFrames?: [{ timeSec:number, likelihood:string }], pending?: boolean }
export const moderateVideo = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    const { storagePath, gcsUri, threshold = 0.5, segments } = data || {};
    try {
      let inputUri = null;
      if (typeof gcsUri === 'string' && gcsUri.startsWith('gs://')) {
        inputUri = gcsUri;
      } else if (typeof storagePath === 'string' && storagePath.trim()) {
        const safe = storagePath.replace(/^\/+/, '');
        inputUri = `gs://${DEFAULT_BUCKET}/${safe}`;
      }
      if (!inputUri) {
        throw new functions.https.HttpsError('invalid-argument', 'Fornire storagePath o gcsUri');
      }

      const client = new videoIntelligence.VideoIntelligenceServiceClient();
      const request = {
        inputUri,
        features: ['EXPLICIT_CONTENT_DETECTION']
      };
      if (Array.isArray(segments) && segments.length > 0) {
        request.videoContext = {
          segments: segments.map(s => ({
            startTimeOffset: { seconds: Math.max(0, Math.floor(Number(s.start) || 0)) },
            endTimeOffset: { seconds: Math.max(0, Math.floor(Number(s.end) || 0)) }
          }))
        };
      }

      functions.logger.info('moderateVideo request', { inputUri, withSegments: !!request.videoContext });
      const [operation] = await client.annotateVideo(request);
      const [result] = await operation.promise();
      const ann = result?.annotationResults?.[0];
      const explicit = ann?.explicitAnnotation;
      const frames = Array.isArray(explicit?.frames) ? explicit.frames : [];

      let maxPornScore = 0;
      const flaggedFrames = [];
      for (const f of frames) {
        const likelihood = f?.pornographyLikelihood;
        const score = likelihoodToScore(likelihood);
        if (score > maxPornScore) maxPornScore = score;
        if (score >= threshold) {
          // timeOffset may have seconds and nanos
          const ts = (Number(f?.timeOffset?.seconds) || 0) + (Number(f?.timeOffset?.nanos) || 0) / 1e9;
          flaggedFrames.push({ timeSec: Math.round(ts * 100) / 100, likelihood: likelihood || 'UNKNOWN' });
        }
      }
      const allow = maxPornScore < threshold;
      const payload = {
        allow,
        scores: { maxPornScore, frameCount: frames.length },
        flaggedFrames: flaggedFrames.slice(0, 20) // limit payload size
      };
      return payload;
    } catch (e) {
      // If API not enabled or permission issue, don't block uploads but mark pending
      functions.logger.warn('moderateVideo error', e);
      return { allow: true, pending: true };
    }
  });

    // Admin-only callable: approva richiesta artista con validazione IPI/ISNI e set di claim/server flags
    // Input: { uid: string, ipiIsni: string, email?: string, displayName?: string }
    // Effects:
    //  - Valida formato IPI (9-13 cifre) o ISNI (16 cifre, con o senza spazi)
    //  - Imposta custom claims { artist: true, verifiedArtist: true } preservando altri claims
    //  - Aggiorna RTDB path users/{uid}: { verified: true, isArtist: true, ipiIsni, verifiedAt }
    //  - Scrive audit in Firestore 'artistVerifications'
    export const approveArtistRequest = functions.https.onCall(async (data, context) => {
      if (!context?.auth || context.auth.token?.admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Solo admin può approvare artisti');
      }
      const { uid, ipiIsni, email, displayName } = data || {};
      if (!uid || typeof uid !== 'string' || uid.trim().length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'uid non valido');
      }
      const raw = (ipiIsni || '').toString().trim();
      if (!raw) {
        throw new functions.https.HttpsError('invalid-argument', 'IPI/ISNI richiesto');
      }
      // Regex semplificate: ISNI 16 cifre (consenti spazi), IPI 9-13 cifre
      const isniOk = /^\s*\d{4}\s?\d{4}\s?\d{4}\s?[0-9Xx]\s*$/.test(raw) || /^\d{16}$/.test(raw.replace(/\s+/g, ''));
      const ipiOk = /^\d{9,13}$/.test(raw.replace(/\D+/g, ''));
      if (!isniOk && !ipiOk) {
        throw new functions.https.HttpsError('invalid-argument', 'Formato IPI/ISNI non riconosciuto');
      }
      try {
        // Merge custom claims
        const user = await admin.auth().getUser(uid).catch(()=>null);
        const prevClaims = (user && user.customClaims) ? user.customClaims : {};
        const newClaims = { ...prevClaims, artist: true, verifiedArtist: true };
        await admin.auth().setCustomUserClaims(uid, newClaims);

        // Update RTDB flags
        try {
          await admin.database().ref(`users/${uid}`).update({
            verified: true,
            isArtist: true,
            ipiIsni: raw,
            verifiedAt: Date.now(),
            verifiedBy: context.auth.uid
          });
        } catch (e) {
          functions.logger.warn('approveArtistRequest RTDB update warn', e);
        }

        // Audit log in Firestore
        try {
          await firestore.collection('artistVerifications').add({
            uid,
            email: email || user?.email || null,
            displayName: displayName || user?.displayName || null,
            ipiIsni: raw,
            by: context.auth.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            v: 1
          });
        } catch (e) {
          functions.logger.warn('approveArtistRequest audit warn', e);
        }

        return { ok: true };
      } catch (e) {
        functions.logger.error('approveArtistRequest error', e);
        throw new functions.https.HttpsError('internal', 'Errore approvazione artista');
      }
    });

// (1) Existing (copied) album zip generator could be re-added later if needed.

function slugify(str) {
  return (str || '').toString().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '').slice(0, 60) || 'item';
}

// Helper: load env (kept in functions config: openai.key, sendgrid.key, site.senderEmail)
function requireConfig(key) {
  const v = functions.config();
  const parts = key.split('.');
  let cur = v;
  for (const p of parts) { cur = cur?.[p]; }
  if (!cur) throw new Error(`Missing functions config key: ${key}`);
  return cur;
}

// (A) Callable LLM proxy with lightweight guardrails
export const aiChat = functions.https.onCall(async (data, context) => {
  const { messages, page } = data || {};
  if (!Array.isArray(messages) || !messages.length) {
    throw new functions.https.HttpsError('invalid-argument', 'messages array richiesto');
  }
  const openaiKey = functions.config()?.openai?.key;
  if (!openaiKey) {
    return { fallback: true, answer: 'Servizio AI avanzato non configurato. Uso ancora la logica base.' };
  }
  const client = new OpenAI({ apiKey: openaiKey });
  // Moderazione: controlla ultimo messaggio utente
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (lastUser?.text) {
    try {
      const mod = await client.moderations.create({ model: 'omni-moderation-latest', input: lastUser.text });
      const flagged = mod?.results?.[0]?.flagged;
      if (flagged) {
        return { fallback: false, answer: 'Il contenuto richiesto non è appropriato. Parliamo di musica, teoria, artisti o ascolto: chiedimi pure qualcosa in quell\'ambito.' };
      }
    } catch (e) {
      functions.logger.warn('Moderation failed (continuo lo stesso)', e);
    }
  }
  // System prompt with light context
  const system = {
    role: 'system',
    content: `Sei l'assistente olografico di Arte Registrazioni.
Linee guida:
1) Tono: italiano, caloroso, professionale, sintetico ma ricco di valore.
2) Focus: musica, produzione, artisti emergenti, catalogo piattaforma.
3) Conoscenza: teoria musicale (scale, intervalli, armonia funzionale di base, ritmo), storia della musica occidentale principale (periodi: Barocco, Classico, Romantico, Jazz, Contemporaneo), generi (classica, jazz, rock, pop, elettronica, hip hop) e figure iconiche (es. Beethoven, Mozart, Charlie Parker, Miles Davis) – fornisci descrizioni brevi e corrette.
4) Biografie richieste: offri una mini‑storia (3-6 frasi) sull'artista, poi collega il discorso agli ARTISTI della piattaforma invitando a scoprirli / ascoltarli.
5) CTA: quando pertinente (domande su musica, artisti, ascolto, generi, teoria) chiudi con un invito ad ascoltare gli artisti e ad acquistare i brani preferiti nella sezione "Musica" (BUY MUSIC / Sounds) per supportare direttamente i creatori. Non ripetere la CTA se l'hai già data negli ultimi 2 turni.
6) Se l'utente chiede qualcosa fuori contesto musicale o non adatto, reindirizza gentilmente alla mission della piattaforma.
7) Se non sei certo di un dettaglio storico specifico, dichiara l'incertezza e offri comunque un'informazione verificabile o un suggerimento.
Pagina attuale: ${page}.
Risposte sempre concentrate e senza contenuti sensibili.`
  };
  const userMessages = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })).slice(-12);
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [system, ...userMessages],
      temperature: 0.7,
      max_tokens: 400
    });
    let answer = completion.choices?.[0]?.message?.content?.trim() || 'Non ho una risposta al momento.';
    // Heuristic category classification
    function classify(text){
      const t = (text||'').toLowerCase();
      if (/ii[- ]?v[- ]?i|scala|accord|armonizz|cadenza|poliritm|sintesi sonora/.test(t)) return 'theory';
      if (/barocc|classic|romantic|novecent|impressionismo|bebop|fusion/.test(t)) return 'history';
      if (/(buy music|acquista|scaricare i brani|supportali)/.test(t)) return 'cta';
      if (/\b(1685|1750|1770|1827|1920|1955|1926|1967|1882|1971|1918)\b/.test(t)) return 'bio';
      if (/vai a |pagina |sezione /.test(t)) return 'navigation';
      return 'general';
    }
    let category = classify(answer);
    // Semplice memoria CTA in Firestore (ultimi 2 turni) – placeholder: controlla ultimo doc
    try {
      const snap = await firestore.collection('aiInteractions').orderBy('createdAt','desc').limit(2).get();
      const recent = snap.docs.map(d => d.data()?.answer || '').join('\n').toLowerCase();
      const cta = 'Ascolta gli artisti e supportali acquistando i brani che ami nella sezione Musica (BUY MUSIC / Sounds).';
      if (!recent.includes('buy music') && !recent.includes('acquista') && !answer.toLowerCase().includes('buy music')) {
        // Aggiungi CTA se pertinente all\'ambito musicale
        if (/(musica|artisti|brano|album|genere|scala|accord|ritmo|jazz|rock|classica|elettronica|hip hop)/i.test(answer)) {
          answer += '\n\n' + cta;
        }
      }
    } catch {}
    await firestore.collection('aiInteractions').add({
      page: page || 'unknown',
      question: userMessages.filter(m=>m.role==='user').slice(-1)[0]?.content || '',
      answer,
      category,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      model: 'gpt-4o-mini'
    });
    return { fallback: false, answer };
  } catch (e) {
    functions.logger.error('aiChat error', e);
    return { fallback: true, answer: 'Temporaneamente non disponibile, riprova fra poco.' };
  }
});

// (A2) Streaming SSE endpoint
export const aiChatStream = functions.https.onRequest(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    // Includiamo header comuni aggiuntivi per richieste fetch personalizzate
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Firebase-AppCheck');
    return res.status(204).send('');
  }
  res.set('Access-Control-Allow-Origin', '*');
  // Replica degli headers consentiti anche sulla risposta principale (coerenza CORS)
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Firebase-AppCheck');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { messages, page } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages required' });
  const openaiKey = functions.config()?.openai?.key;
  if (!openaiKey) return res.status(200).json({ fallback: true, answer: 'Servizio AI non configurato.' });
  const client = new OpenAI({ apiKey: openaiKey });
  // Moderation last user
  try {
    const lastUser = [...messages].reverse().find(m=>m.role==='user');
    if (lastUser?.text) {
      const mod = await client.moderations.create({ model: 'omni-moderation-latest', input: lastUser.text });
      if (mod?.results?.[0]?.flagged) {
        return res.status(200).json({ fallback:false, answer: 'Contenuto non appropriato. Parliamo di musica, teoria, artisti o ascolto.' });
      }
    }
  } catch {}
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  const system = { role: 'system', content: `Sei l'assistente olografico streaming. Pagina: ${page}. Concentrati su musica e invita all'ascolto senza ripetere la CTA troppo spesso.` };
  const chatMessages = [system, ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))].slice(-15);
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 500,
      stream: true
    });
    let full = '';
    for await (const part of completion) {
      const delta = part?.choices?.[0]?.delta?.content || '';
      if (delta) {
        full += delta;
        res.write(`data: ${JSON.stringify({ chunk: delta })}\n\n`);
      }
    }
    // CTA injection (simple) if not present
    if (!/buy music|acquista|scaricare i brani/i.test(full) && /(musica|artisti|brano|album|genere|scala|accord)/i.test(full)) {
      full += '\n\nAscolta gli artisti e supportali: usa BUY MUSIC per scaricare i tuoi brani.';
    }
    // classify final streamed answer
    const category2 = (()=>{ const t=(full||'').toLowerCase(); if(/ii[- ]?v[- ]?i|scala|accord|armonizz|cadenza|poliritm|sintesi sonora/.test(t)) return 'theory'; if(/barocc|classic|romantic|novecent|impressionismo|bebop|fusion/.test(t)) return 'history'; if(/(buy music|acquista|scaricare i brani|supportali)/.test(t)) return 'cta'; if(/\b(1685|1750|1770|1827|1920|1955|1926|1967|1882|1971|1918)\b/.test(t)) return 'bio'; if(/vai a |pagina |sezione /.test(t)) return 'navigation'; return 'general'; })();
    await firestore.collection('aiInteractions').add({
      page: page || 'unknown',
      question: chatMessages.filter(m=>m.role==='user').slice(-1)[0]?.content || '',
      answer: full,
      category: category2,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      model: 'gpt-4o-mini'
    });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e) {
    functions.logger.error('aiChatStream error', e);
    try { res.write(`data: ${JSON.stringify({ error: 'stream_error' })}\n\n`); } catch {}
    res.end();
  }
});

// (B) Callable: auto-reply email when a contact form is submitted
export const sendContactAutoReply = functions.https.onCall(async (data, context) => {
  const { email, name, message } = data || {};
  if (!email || !message) {
    throw new functions.https.HttpsError('invalid-argument', 'email e message richiesti');
  }
  const sendgridKey = functions.config()?.sendgrid?.key;
  const sender = functions.config()?.site?.senderemail;
  if (!sendgridKey || !sender) {
    throw new functions.https.HttpsError('failed-precondition', 'Email non configurata');
  }
  sgMail.setApiKey(sendgridKey);
  const safeName = (name || '').trim().slice(0,80) || 'Artista';
  const plain = `Ciao ${safeName},\n\nGrazie per averci scritto! Abbiamo ricevuto il tuo messaggio e ti risponderemo appena possibile.\n\nIl tuo messaggio:\n"${message.slice(0,1000)}"\n\nA presto,\nArte Registrazioni`;
  const html = `<p>Ciao ${safeName},</p><p>Grazie per averci scritto! Abbiamo ricevuto il tuo messaggio e ti risponderemo appena possibile.</p><blockquote>${message.slice(0,1000)}</blockquote><p>A presto,<br/>Arte Registrazioni</p>`;
  try {
    await sgMail.send({ to: email, from: sender, subject: 'Abbiamo ricevuto il tuo messaggio', text: plain, html });
    await firestore.collection('contacts').add({ email, name: safeName, message: message.slice(0,5000), createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { ok: true };
  } catch (e) {
    functions.logger.error('sendContactAutoReply error', e);
    throw new functions.https.HttpsError('internal', 'Invio email fallito');
  }
});

// (C) Signed upload policy (optional reuse) - trimmed minimal variant
export const getUploadPolicy = functions.https.onCall(async (data, context) => {
  const { path, contentType } = data || {};
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth richiesta');
  if (!path) throw new functions.https.HttpsError('invalid-argument', 'path richiesto');
  const bucketName = DEFAULT_BUCKET;
  const bucket = storage.bucket(bucketName);
  const safePath = String(path).replace(/^\/+/, '');
  const file = bucket.file(safePath);
  functions.logger.info('getUploadPolicy request', { bucket: bucket.name, path: safePath, contentType: contentType || 'application/octet-stream' });
  const expires = Date.now() + 10*60*1000;
  try {
    // Consenti:
    // - qualsiasi Content-Type (evita mismatch tra boundary/file.type)
    // - impostazione del token di download Firebase via metadata (x-goog-meta-firebaseStorageDownloadTokens)
    // - success_action_status opzionale (201/204)
    const [policy] = await file.generateSignedPostPolicyV4({
      expires,
      conditions: [
        ["starts-with", "$Content-Type", ""],
        ["starts-with", "$x-goog-meta-firebaseStorageDownloadTokens", ""],
        ["starts-with", "$success_action_status", ""],
      ],
    });
    return { url: policy.url, fields: policy.fields };
  } catch (e) {
    functions.logger.error('getUploadPolicy error', e);
    const msg = (e && e.message) ? e.message : String(e);
    throw new functions.https.HttpsError('internal', `Errore generazione policy: ${msg}`);
  }
});

// (D) Generate voice dataset ZIP (raw + manifest.json)
export const generateVoiceDataset = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth richiesta');
  const { requireTranscript = true, minDuration = 0.2, maxDuration = 60 } = data || {};
  try {
    const snap = await firestore.collection('voiceSamples').orderBy('createdAt','asc').get();
    if (snap.empty) return { zipUrl: null, count: 0, included:0, skipped:0, total:0 };
    const allItems = [];
    snap.forEach(d => {
      const x = d.data();
      allItems.push({
        id: d.id,
        filename: x.filename || (d.id + '.wav'),
        url: x.url,
        path: x.path || x.storagePath || null,
        transcript: x.transcript || '',
        tags: Array.isArray(x.tags) ? x.tags : [],
        size: x.size || 0,
        mime: x.mime || 'audio/wav',
        duration: typeof x.duration === 'number' ? x.duration : null
      });
    });
    const filtered = allItems.filter(it => {
      if (requireTranscript && !it.transcript.trim()) return false;
      if (it.duration != null && (it.duration < minDuration || it.duration > maxDuration)) return false;
      return true;
    });
    if (!filtered.length) return { zipUrl:null, included:0, skipped: allItems.length, total: allItems.length };
    // guard size
    let totalSize = 0;
    const finalItems = [];
    for (const it of filtered) {
      totalSize += it.size || 0;
      if (totalSize > 180 * 1024 * 1024) break; // 180MB hard cap
      finalItems.push(it);
    }
    const bucket = storage.bucket();
    const zipName = `voice_exports/voice_dataset_${Date.now()}.zip`;
    const zipFile = bucket.file(zipName);
    const passthrough = new PassThrough();
    const writeStream = zipFile.createWriteStream({ contentType: 'application/zip' });
    passthrough.pipe(writeStream);
    const archive = archiver('zip', { zlib: { level: 8 } });
    archive.on('error', err => { throw err; });
    archive.pipe(passthrough);
    const manifest = {
      version: 2,
      generatedAt: new Date().toISOString(),
      total: allItems.length,
      included: finalItems.length,
      skipped: allItems.length - finalItems.length,
      requireTranscript,
      minDuration,
      maxDuration,
      items: finalItems.map(it => ({ id: it.id, filename: it.filename, transcript: it.transcript, tags: it.tags, size: it.size, mime: it.mime, duration: it.duration }))
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    for (const it of finalItems) {
      let storagePath = it.path;
      if (!storagePath && it.url?.includes('/o/')) {
        try { storagePath = decodeURIComponent(it.url.split('/o/')[1].split('?')[0]); } catch {}
      }
      if (!storagePath) continue;
      const f = bucket.file(storagePath);
      archive.append(f.createReadStream(), { name: `audio/${it.filename}` });
    }
    await archive.finalize();
    await new Promise((resolve, reject) => { writeStream.on('finish', resolve); writeStream.on('error', reject); passthrough.on('error', reject); });
    const [signed] = await zipFile.getSignedUrl({ action:'read', expires: Date.now() + 60*60*1000 });
    return { zipUrl: signed, included: finalItems.length, skipped: allItems.length - finalItems.length, total: allItems.length };
  } catch (e) {
    functions.logger.error('generateVoiceDataset error', e);
    throw new functions.https.HttpsError('internal', 'Errore generazione dataset');
  }
});

// (E) Stub TTS synthesize -> future external provider integration
export const ttsSynthesize = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Auth richiesta');
  const { text, voice: requestedVoice } = data || {};
  if (!text || typeof text !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'text richiesto');
  }
  const trimmed = text.trim().replace(/\s+/g, ' ');
  // Limiti conservativi: evitare testi lunghi che generano blob grandi da memorizzare in Firestore
  if (trimmed.length === 0 || trimmed.length > 450) {
    throw new functions.https.HttpsError('invalid-argument', 'Lunghezza testo non valida (1-450 caratteri)');
  }
  const cfg = functions.config();
  const apiKey = cfg?.elevenlabs?.key;
  const defaultVoice = cfg?.elevenlabs?.voiceid || 'placeholder-voice';
  const voiceId = requestedVoice || defaultVoice;

  // Se non configurato, mantieni comportamento precedente (stub)
  if (!apiKey || !voiceId || voiceId === 'placeholder-voice') {
    return { pending: true, provider: null, voice: voiceId, text: trimmed, note: 'Provider ElevenLabs non configurato (functions:config:set elevenlabs.key=... elevenlabs.voiceid=...)', audioBase64: null };
  }

  // Caching per evitare richieste duplicate identiche ravvicinate
  const hash = crypto.createHash('sha256').update(voiceId + '|' + trimmed).digest('hex').slice(0, 40);
  const cacheRef = firestore.collection('ttsCache').doc(hash);
  try {
    const snap = await cacheRef.get();
    if (snap.exists) {
      const data = snap.data();
      // TTL 7 giorni
      const created = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0;
      if (Date.now() - created < 7 * 24 * 60 * 60 * 1000 && data.audioBase64 && data.mime) {
        return { cached: true, provider: 'elevenlabs', voice: voiceId, text: trimmed, audioBase64: data.audioBase64, mime: data.mime, id: hash };
      }
    }
  } catch (e) {
    functions.logger.warn('tts cache read error', e);
  }

  // Chiamata a ElevenLabs
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  let audioBase64 = null;
  let mime = 'audio/mpeg';
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: trimmed,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.45, similarity_boost: 0.85 },
        optimize_streaming_latency: 3
      })
    });
    if (!resp.ok) {
      const errTxt = await resp.text();
      functions.logger.error('ElevenLabs TTS error', resp.status, errTxt.slice(0, 300));
      throw new Error('Richiesta TTS fallita');
    }
    const arrayBuf = await resp.arrayBuffer();
    audioBase64 = Buffer.from(arrayBuf).toString('base64');
    // Salva in cache (rispettando limite Firestore 1MB; base64 ~1.37x) – se troppo grande, salta cache
    const approxBytes = audioBase64.length * 0.75; // stima bytes originali
    if (approxBytes < 800 * 1024) {
      try {
        await cacheRef.set({ voice: voiceId, text: trimmed, audioBase64, mime, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      } catch (e) {
        functions.logger.warn('tts cache write error', e);
      }
    }
    return { cached: false, provider: 'elevenlabs', voice: voiceId, text: trimmed, audioBase64, mime, id: hash };
  } catch (e) {
    functions.logger.error('ttsSynthesize error', e);
    // Fallback coerente col vecchio stub per permettere al client di attivare speechSynthesis locale
    return { pending: true, provider: 'elevenlabs', error: true, message: 'TTS non disponibile', voice: voiceId, text: trimmed, audioBase64: null };
  }
});

// (F) Auto process voice samples: convert to mono 48k 24bit and fill transcripts & tags from predefined mapping (for numbered 1..84)
// processVoiceSamples & voiceProcessingDiagnostics: DEPRECATE (rimosse dal frontend)
// Manteniamo stub vuoti per evitare errori da vecchi client eventualmente in cache.
export const processVoiceSamples = functions.https.onCall(async () => ({ deprecated: true }));
export const voiceProcessingDiagnostics = functions.https.onCall(async () => ({ deprecated: true }));

// (G) Spotify artist data (client-credentials flow; secrets in functions:config)
let _spotifyToken = null; // { access_token, expires_at }
async function getSpotifyToken() {
  const cfg = functions.config();
  const clientId = cfg?.spotify?.clientid;
  const clientSecret = cfg?.spotify?.clientsecret;
  if (!clientId || !clientSecret) {
    throw new functions.https.HttpsError('failed-precondition', 'Spotify non configurato (manca functions config spotify.clientid/spotify.clientsecret)');
  }
  const now = Date.now();
  if (_spotifyToken && _spotifyToken.expires_at - 15000 > now) {
    return _spotifyToken.access_token;
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  if (!resp.ok) {
    const t = await resp.text().catch(()=>'');
    throw new functions.https.HttpsError('internal', `Spotify token error ${resp.status}: ${t.slice(0,200)}`);
  }
  const json = await resp.json();
  _spotifyToken = {
    access_token: json.access_token,
    expires_at: Date.now() + (json.expires_in ? (json.expires_in * 1000) : 3600_000)
  };
  return _spotifyToken.access_token;
}

export const spotifyArtistData = functions.https.onCall(async (data, context) => {
  const { artistName, market = 'IT', byId = false } = data || {};
  if (!artistName || typeof artistName !== 'string' || artistName.trim().length < 1) {
    throw new functions.https.HttpsError('invalid-argument', 'artistName (string) richiesto');
  }
  try {
    const token = await getSpotifyToken();
    const headers = { 'Authorization': `Bearer ${token}` };
    let artist = null;
    let artistId = null;
    if (byId) {
      // Lookup diretto per ID
      const id = artistName.trim();
      const directUrl = `https://api.spotify.com/v1/artists/${encodeURIComponent(id)}`;
      let dResp = await fetch(directUrl, { headers });
      if (dResp.status === 401) { _spotifyToken = null; headers.Authorization = `Bearer ${await getSpotifyToken()}`; dResp = await fetch(directUrl, { headers }); }
      if (dResp.ok) {
        artist = await dResp.json();
        artistId = artist.id;
      } else if (dResp.status === 404) {
        return { found: false, artist: null, topTracks: [], note: 'Artista non trovato via ID' };
      } else {
        const t = await dResp.text().catch(()=> '');
        throw new Error(`Spotify artist id error ${dResp.status}: ${t.slice(0,200)}`);
      }
    }
    if (!artist) {
      // Ricerca per nome
      const q = encodeURIComponent(artistName.trim());
      const searchUrl = `https://api.spotify.com/v1/search?q=${q}&type=artist&limit=1&market=${encodeURIComponent(market)}`;
      let sResp = await fetch(searchUrl, { headers });
      if (sResp.status === 401) {
        _spotifyToken = null; headers.Authorization = `Bearer ${await getSpotifyToken()}`; sResp = await fetch(searchUrl, { headers });
      }
      if (!sResp.ok) {
        const t = await sResp.text().catch(()=> '');
        throw new Error(`Spotify search error ${sResp.status}: ${t.slice(0,200)}`);
      }
      const sJson = await sResp.json();
      artist = sJson?.artists?.items?.[0] || null;
      if (!artist) {
        return { found: false, artist: null, topTracks: [], note: 'Nessun artista trovato' };
      }
      artistId = artist.id;
    }
    const artistData = {
      id: artistId,
      name: artist.name,
      followers: artist.followers?.total ?? null,
      popularity: artist.popularity ?? null,
      images: Array.isArray(artist.images) ? artist.images : [],
      genres: Array.isArray(artist.genres) ? artist.genres : [],
      url: artist.external_urls?.spotify || null
    };
    // 2) Top tracks (per mercato)
    const ttUrl = `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}/top-tracks?market=${encodeURIComponent(market)}`;
    const ttResp = await fetch(ttUrl, { headers });
    let topTracks = [];
    if (ttResp.ok) {
      const tt = await ttResp.json();
      topTracks = Array.isArray(tt.tracks) ? tt.tracks.map(t => ({
        id: t.id,
        name: t.name,
        url: t.external_urls?.spotify || null,
        preview_url: t.preview_url || null,
        popularity: t.popularity ?? null,
        duration_ms: t.duration_ms ?? null,
        album: t.album ? {
          id: t.album.id,
          name: t.album.name,
          release_date: t.album.release_date || null,
          images: Array.isArray(t.album.images) ? t.album.images : []
        } : null,
        artists: Array.isArray(t.artists) ? t.artists.map(a => ({ id: a.id, name: a.name, url: a.external_urls?.spotify || null })) : []
      })) : [];
    } else if (ttResp.status === 429) {
      // rate limit: ritorna solo l'artista
      functions.logger.warn('Spotify 429 rate limited on top-tracks');
    }
    // Nota: Spotify non espone le "monthly listeners" via API pubbliche.
    const note = 'I "monthly listeners" non sono disponibili via API Spotify. Restituiti: followers, popularity, topTracks.';
    return { found: true, artist: artistData, topTracks, note };
  } catch (e) {
    functions.logger.error('spotifyArtistData error', e);
    throw new functions.https.HttpsError('internal', e?.message || 'Errore integrazione Spotify');
  }
});

// New: Fetch a single Spotify track by URL or ID and return compact metadata
// Input: { track: string, market?: 'IT' }
// Output: { found: boolean, track?: { id, name, url, preview_url, duration_ms, album: { id, name, images[], release_date }, artists: [{id,name,url}] } }
export const spotifyTrackData = functions.https.onCall(async (data, context) => {
  const { track, market = 'IT' } = data || {};
  if (!track || typeof track !== 'string' || track.trim().length < 3) {
    throw new functions.https.HttpsError('invalid-argument', 'track (URL o ID) richiesto');
  }
  try {
    const token = await getSpotifyToken();
    const headers = { 'Authorization': `Bearer ${token}` };
    let id = null;
    // Estrarre ID da URL se necessario
    const m = track.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
    if (m && m[1]) id = m[1];
    if (!id && /^[A-Za-z0-9]{10,}$/.test(track.trim())) id = track.trim();
    if (!id) {
      // come fallback, prova search by query string
      const q = encodeURIComponent(track.trim());
      const searchUrl = `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1&market=${encodeURIComponent(market)}`;
      let sResp = await fetch(searchUrl, { headers });
      if (sResp.status === 401) { _spotifyToken = null; headers.Authorization = `Bearer ${await getSpotifyToken()}`; sResp = await fetch(searchUrl, { headers }); }
      if (!sResp.ok) {
        const t = await sResp.text().catch(()=> '');
        throw new Error(`Spotify track search error ${sResp.status}: ${t.slice(0,200)}`);
      }
      const sJson = await sResp.json();
      const item = sJson?.tracks?.items?.[0] || null;
      if (!item) return { found: false };
      return {
        found: true,
        track: {
          id: item.id,
          name: item.name,
          url: item.external_urls?.spotify || null,
          preview_url: item.preview_url || null,
          duration_ms: item.duration_ms ?? null,
          album: item.album ? {
            id: item.album.id,
            name: item.album.name,
            release_date: item.album.release_date || null,
            images: Array.isArray(item.album.images) ? item.album.images : []
          } : null,
          artists: Array.isArray(item.artists) ? item.artists.map(a => ({ id: a.id, name: a.name, url: a.external_urls?.spotify || null })) : []
        }
      };
    }
    // Lookup diretto via ID
    const url = `https://api.spotify.com/v1/tracks/${encodeURIComponent(id)}`;
    let resp = await fetch(url, { headers });
    if (resp.status === 401) { _spotifyToken = null; headers.Authorization = `Bearer ${await getSpotifyToken()}`; resp = await fetch(url, { headers }); }
    if (resp.status === 404) return { found: false };
    if (!resp.ok) {
      const t = await resp.text().catch(()=> '');
      throw new Error(`Spotify track error ${resp.status}: ${t.slice(0,200)}`);
    }
    const tJson = await resp.json();
    return {
      found: true,
      track: {
        id: tJson.id,
        name: tJson.name,
        url: tJson.external_urls?.spotify || null,
        preview_url: tJson.preview_url || null,
        duration_ms: tJson.duration_ms ?? null,
        album: tJson.album ? {
          id: tJson.album.id,
          name: tJson.album.name,
          release_date: tJson.album.release_date || null,
          images: Array.isArray(tJson.album.images) ? tJson.album.images : []
        } : null,
        artists: Array.isArray(tJson.artists) ? tJson.artists.map(a => ({ id: a.id, name: a.name, url: a.external_urls?.spotify || null })) : []
      }
    };
  } catch (e) {
    functions.logger.error('spotifyTrackData error', e);
    throw new functions.https.HttpsError('internal', e?.message || 'Errore Spotify track');
  }
});

// (H) Apple Music artist data via Apple Music API (requires Apple dev token)
function getAppleMusicDevToken() {
  const cfg = functions.config();
  const teamId = cfg?.apple?.musickit_teamid;
  const keyId = cfg?.apple?.musickit_keyid;
  const privateKey = cfg?.apple?.musickit_privatekey; // store full PEM or single-line with \n
  if (!teamId || !keyId || !privateKey) {
    throw new functions.https.HttpsError('failed-precondition', 'Apple Music non configurato (apple.musickit_teamid/keyid/privatekey)');
  }
  // Normalize PEM newlines
  const pem = privateKey.includes('BEGIN') ? privateKey : privateKey.replace(/\\n/g, '\n');
  const token = jwt.sign({}, pem, {
    algorithm: 'ES256',
    keyid: keyId,
    issuer: teamId,
    expiresIn: '180d'
  });
  return token;
}

export const appleArtistData = functions.https.onCall(async (data, context) => {
  const { artistName, storefront = 'it' } = data || {};
  if (!artistName || typeof artistName !== 'string' || artistName.trim().length < 2) {
    throw new functions.https.HttpsError('invalid-argument', 'artistName (string) richiesto');
  }
  try {
    const devToken = getAppleMusicDevToken();
    const headers = {
      'Authorization': `Bearer ${devToken}`,
      'Accept': 'application/json'
    };
    // 1) Search artist
    const q = encodeURIComponent(artistName.trim());
    const url = `https://api.music.apple.com/v1/catalog/${encodeURIComponent(storefront)}/search?term=${q}&types=artists&limit=1`;
    const sResp = await fetch(url, { headers });
    if (!sResp.ok) {
      const t = await sResp.text().catch(()=> '');
      throw new Error(`Apple search error ${sResp.status}: ${t.slice(0,200)}`);
    }
    const sJson = await sResp.json();
    const artist = sJson?.results?.artists?.data?.[0] || null;
    if (!artist) {
      return { found: false, artist: null, topTracks: [], note: 'Nessun artista trovato' };
    }
    const artistId = artist.id;
    const attrs = artist.attributes || {};
    const artistData = {
      id: artistId,
      name: attrs.name || null,
      url: attrs.url || null,
      genreNames: attrs.genreNames || [],
      editorialNotes: attrs.editorialNotes || null,
      artwork: attrs.artwork || null
    };
    // 2) Get artist's top songs (mostra songs dell'artista)
    // Apple non espone "monthly listeners" pubblicamente.
    const songsUrl = `https://api.music.apple.com/v1/catalog/${encodeURIComponent(storefront)}/artists/${encodeURIComponent(artistId)}/view/top-songs?limit=10`;
    let topTracks = [];
    const tResp = await fetch(songsUrl, { headers });
    if (tResp.ok) {
      const tJson = await tResp.json();
      const items = tJson?.data || [];
      topTracks = items.map(it => {
        const a = it.attributes || {};
        return {
          id: it.id,
          name: a.name || null,
          url: a.url || null,
          duration_ms: typeof a.durationInMillis === 'number' ? a.durationInMillis : null,
          albumName: a.albumName || null,
          artwork: a.artwork || null,
          previews: a.previews || []
        };
      });
    } else if (tResp.status === 403) {
      functions.logger.warn('Apple Music 403 (controlla token/permessi)');
    }
    const note = 'Apple Music non espone ascoltatori mensili via API pubblica. Restituiti: artwork, URL, top songs.';
    return { found: true, artist: artistData, topTracks, note };
  } catch (e) {
    functions.logger.error('appleArtistData error', e);
    throw new functions.https.HttpsError('internal', e?.message || 'Errore integrazione Apple Music');
  }
});

// New: Fetch a single Apple Music track by URL or ID and return compact metadata
// Input: { track: string, storefront?: 'it' }
// Output: { found: boolean, track?: { id, name, url, duration_ms, albumName, artwork, previews: [{url}] } }
export const appleTrackData = functions.https.onCall(async (data, context) => {
  const { track, storefront = 'it' } = data || {};
  if (!track || typeof track !== 'string' || track.trim().length < 2) {
    throw new functions.https.HttpsError('invalid-argument', 'track (URL o ID) richiesto');
  }
  try {
    const devToken = getAppleMusicDevToken();
    const headers = { 'Authorization': `Bearer ${devToken}`, 'Accept': 'application/json' };
    let id = null;
    const raw = track.trim();
    // Estrarre ID da URL (formati: /song/<slug>/<id> oppure album/... ?i=<id>)
    try {
      const qi = raw.match(/[?&]i=(\d+)/);
      if (qi && qi[1]) id = qi[1];
      if (!id) {
        const m = raw.match(/music\.apple\.com\/[a-z]{2}\/(?:song|album)\/[^/]+\/(\d+)/i);
        if (m && m[1]) id = m[1];
      }
    } catch {}
    if (!id && /^\d{6,}$/.test(raw)) id = raw;
    if (!id) {
      // Fallback search by query string
      const q = encodeURIComponent(raw);
      const url = `https://api.music.apple.com/v1/catalog/${encodeURIComponent(storefront)}/search?term=${q}&types=songs&limit=1`;
      const sResp = await fetch(url, { headers });
      if (!sResp.ok) {
        const t = await sResp.text().catch(()=> '');
        throw new Error(`Apple track search error ${sResp.status}: ${t.slice(0,200)}`);
      }
      const sJson = await sResp.json();
      const item = sJson?.results?.songs?.data?.[0] || null;
      if (!item) return { found: false };
      const a = item.attributes || {};
      return {
        found: true,
        track: {
          id: item.id,
          name: a.name || null,
          url: a.url || null,
          duration_ms: typeof a.durationInMillis === 'number' ? a.durationInMillis : null,
          albumName: a.albumName || null,
          artwork: a.artwork || null,
          previews: Array.isArray(a.previews) ? a.previews : []
        }
      };
    }
    // Lookup diretto per ID
    const url = `https://api.music.apple.com/v1/catalog/${encodeURIComponent(storefront)}/songs/${encodeURIComponent(id)}`;
    const resp = await fetch(url, { headers });
    if (resp.status === 404) return { found: false };
    if (!resp.ok) {
      const t = await resp.text().catch(()=> '');
      throw new Error(`Apple track error ${resp.status}: ${t.slice(0,200)}`);
    }
    const j = await resp.json();
    const item = j?.data?.[0] || null;
    if (!item) return { found: false };
    const a = item.attributes || {};
    return {
      found: true,
      track: {
        id: item.id,
        name: a.name || null,
        url: a.url || null,
        duration_ms: typeof a.durationInMillis === 'number' ? a.durationInMillis : null,
        albumName: a.albumName || null,
        artwork: a.artwork || null,
        previews: Array.isArray(a.previews) ? a.previews : []
      }
    };
  } catch (e) {
    functions.logger.error('appleTrackData error', e);
    throw new functions.https.HttpsError('internal', e?.message || 'Errore Apple track');
  }
});

// (I) Aggregatore: getStreamingData
// Input: { artistName, market?: 'IT', storefront?: 'it' }
// Output: { artistName, spotify: <spotifyArtistData>, apple: <appleArtistData>, aggregated: { totalListens, cover, tracks } }
export const getStreamingData = functions.https.onCall(async (data, context) => {
  const { artistName, market = 'IT', storefront = 'it' } = data || {};
  if (!artistName || typeof artistName !== 'string' || artistName.trim().length < 2) {
    throw new functions.https.HttpsError('invalid-argument', 'artistName (string) richiesto');
  }
  try {
    // Reuse internal helpers to avoid an extra round-trip; call our handlers directly
    const [sp, ap] = await Promise.all([
      (async () => {
        try {
          const token = await getSpotifyToken();
          const headers = { 'Authorization': `Bearer ${token}` };
          const q = encodeURIComponent(artistName.trim());
          const searchUrl = `https://api.spotify.com/v1/search?q=${q}&type=artist&limit=1&market=${encodeURIComponent(market)}`;
          let sResp = await fetch(searchUrl, { headers });
          if (sResp.status === 401) { _spotifyToken = null; headers.Authorization = `Bearer ${await getSpotifyToken()}`; sResp = await fetch(searchUrl, { headers }); }
          if (!sResp.ok) throw new Error(`Spotify search error ${sResp.status}`);
          const sJson = await sResp.json();
          const artist = sJson?.artists?.items?.[0] || null;
          if (!artist) return { found: false, artist: null, topTracks: [], note: 'Nessun artista trovato' };
          const artistId = artist.id;
          const artistData = {
            id: artistId, name: artist.name, followers: artist.followers?.total ?? null, popularity: artist.popularity ?? null,
            images: Array.isArray(artist.images) ? artist.images : [], genres: Array.isArray(artist.genres) ? artist.genres : [], url: artist.external_urls?.spotify || null
          };
          const ttUrl = `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}/top-tracks?market=${encodeURIComponent(market)}`;
          const ttResp = await fetch(ttUrl, { headers });
          let topTracks = [];
          if (ttResp.ok) {
            const tt = await ttResp.json();
            topTracks = Array.isArray(tt.tracks) ? tt.tracks.map(t => ({
              id: t.id, name: t.name, url: t.external_urls?.spotify || null, preview_url: t.preview_url || null,
              popularity: t.popularity ?? null, duration_ms: t.duration_ms ?? null,
              album: t.album ? { id: t.album.id, name: t.album.name, release_date: t.album.release_date || null, images: Array.isArray(t.album.images) ? t.album.images : [] } : null,
              artists: Array.isArray(t.artists) ? t.artists.map(a => ({ id: a.id, name: a.name, url: a.external_urls?.spotify || null })) : []
            })) : [];
          }
          const note = 'I "monthly listeners" non sono disponibili via API Spotify. Restituiti: followers, popularity, topTracks.';
          return { found: true, artist: artistData, topTracks, note };
        } catch (e) {
          functions.logger.error('getStreamingData.spotify', e);
          return { found: false, error: true, message: e?.message || 'Errore Spotify' };
        }
      })(),
      (async () => {
        try {
          const devToken = getAppleMusicDevToken();
          const headers = { 'Authorization': `Bearer ${devToken}`, 'Accept': 'application/json' };
          const q = encodeURIComponent(artistName.trim());
          const url = `https://api.music.apple.com/v1/catalog/${encodeURIComponent(storefront)}/search?term=${q}&types=artists&limit=1`;
          const sResp = await fetch(url, { headers });
          if (!sResp.ok) throw new Error(`Apple search error ${sResp.status}`);
          const sJson = await sResp.json();
          const artist = sJson?.results?.artists?.data?.[0] || null;
          if (!artist) return { found: false, artist: null, topTracks: [], note: 'Nessun artista trovato' };
          const artistId = artist.id; const attrs = artist.attributes || {};
          const artistData = { id: artistId, name: attrs.name || null, url: attrs.url || null, genreNames: attrs.genreNames || [], editorialNotes: attrs.editorialNotes || null, artwork: attrs.artwork || null };
          const songsUrl = `https://api.music.apple.com/v1/catalog/${encodeURIComponent(storefront)}/artists/${encodeURIComponent(artistId)}/view/top-songs?limit=10`;
          const tResp = await fetch(songsUrl, { headers });
          let topTracks = [];
          if (tResp.ok) {
            const tJson = await tResp.json();
            const items = tJson?.data || [];
            topTracks = items.map(it => {
              const a = it.attributes || {};
              return { id: it.id, name: a.name || null, url: a.url || null, duration_ms: typeof a.durationInMillis === 'number' ? a.durationInMillis : null, albumName: a.albumName || null, artwork: a.artwork || null, previews: a.previews || [] };
            });
          }
          const note = 'Apple Music non espone ascoltatori mensili via API pubblica. Restituiti: artwork, URL, top songs.';
          return { found: true, artist: artistData, topTracks, note };
        } catch (e) {
          functions.logger.error('getStreamingData.apple', e);
          return { found: false, error: true, message: e?.message || 'Errore Apple Music' };
        }
      })()
    ]);

    // Aggregazione minimale per comodità lato client
    const followers = (sp && sp.artist && typeof sp.artist.followers === 'number') ? sp.artist.followers : 0;
    const previews = (ap && ap.topTracks) ? ap.topTracks.filter(t => Array.isArray(t.previews) && t.previews.length > 0).length : 0;
    const popularityBoost = (sp && sp.artist && typeof sp.artist.popularity === 'number') ? sp.artist.popularity * 1000 : 0;
    const totalListens = followers + popularityBoost + (previews * 500);
    let cover = null;
    if (sp?.artist?.images?.[0]?.url) cover = sp.artist.images[0].url;
    else if (ap?.artist?.artwork?.url) cover = ap.artist.artwork.url.replace('{w}x{h}', '600x600');
    else if (sp?.topTracks?.[0]?.album?.images?.[0]?.url) cover = sp.topTracks[0].album.images[0].url;
    const tracks = [];
    const apTracks = Array.isArray(ap?.topTracks) ? ap.topTracks : [];
    const spTracks = Array.isArray(sp?.topTracks) ? sp.topTracks : [];
    for (const t of apTracks) {
      const preview = Array.isArray(t.previews) && t.previews[0] ? t.previews[0].url : null;
      if (preview) tracks.push({ title: t.name || '', link: preview });
    }
    for (const t of spTracks) {
      if (t.preview_url) tracks.push({ title: t.name || '', link: t.preview_url });
    }
    return { artistName, spotify: sp, apple: ap, aggregated: { totalListens, cover, tracks } };
  } catch (e) {
    functions.logger.error('getStreamingData error', e);
    throw new functions.https.HttpsError('internal', e?.message || 'Errore getStreamingData');
  }
});

// (J) registerLivePlay: registra un play live per pulsazioni mappa
// Input: { artistId, city?, country?, lat?, lon? }
// Valida campi e normalizza; non richiede auth (può essere chiamato da endpoint sicuro proxy) ma registra IP hash
export const registerLivePlay = functions.https.onCall(async (data, context) => {
  const { artistId, city, country, lat, lon } = data || {};
  if (!artistId || typeof artistId !== 'string' || artistId.trim().length < 3) {
    throw new functions.https.HttpsError('invalid-argument', 'artistId richiesto');
  }
  // Limiti minimi: se lat/lon presenti devono essere numeri validi
  let latNum = null, lonNum = null;
  if (lat != null || lon != null) {
    latNum = Number(lat); lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) {
      throw new functions.https.HttpsError('invalid-argument', 'lat/lon non validi');
    }
  }
  const safeCity = city && typeof city === 'string' ? city.slice(0, 60) : null;
  const safeCountry = country && typeof country === 'string' ? country.slice(0, 60) : null;
  // Hash IP (non reversibile) per evitare spam massivo, se disponibile
  let ipHash = null;
  try {
    const ip = context.rawRequest?.headers['x-forwarded-for']?.split(',')[0] || context.rawRequest?.ip || '';
    if (ip) ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
  } catch {}
  try {
    await firestore.collection('livePlays').add({
      artistId: artistId.trim(),
      city: safeCity || null,
      country: safeCountry || null,
      lat: latNum,
      lon: lonNum,
      ts: admin.firestore.FieldValue.serverTimestamp(),
      sourceUid: context.auth?.uid || null,
      ipHash,
      v: 1
    });
    return { ok: true };
  } catch (e) {
    functions.logger.error('registerLivePlay error', e);
    throw new functions.https.HttpsError('internal', 'Errore registrazione play');
  }
});

// Variante HTTP con CORS esplicito per ambiente frontend (local dev / integrazioni semplici)
// POST /registerLivePlayHttp  body: { artistId, city, country, lat, lon }
export const registerLivePlayHttp = functions.https.onRequest(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    const reqHeaders = req.headers['access-control-request-headers'];
    // Includi header aggiuntivi usati dal frontend (es. X-Firebase-AppCheck)
    const allowHeaders = reqHeaders || 'Content-Type, Authorization, X-Firebase-AppCheck, X-Requested-With';
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', allowHeaders);
    res.set('Access-Control-Max-Age', '86400');
    return res.status(204).send('');
  }
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Vary', 'Origin');
  // Replica allowed headers nella risposta principale per coerenza (alcuni browser controllano anche qui)
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck, X-Requested-With');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let body = req.body || {};
  // Se il client manda JSON string
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {}
  }
  const { artistId, city, country, lat, lon } = body || {};
  if (!artistId || typeof artistId !== 'string' || artistId.trim().length < 3) {
    return res.status(400).json({ error: 'artistId richiesto' });
  }
  let latNum = null, lonNum = null;
  if (lat != null || lon != null) {
    latNum = Number(lat); lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) {
      return res.status(400).json({ error: 'lat/lon non validi' });
    }
  }
  const safeCity = city && typeof city === 'string' ? city.slice(0, 60) : null;
  const safeCountry = country && typeof country === 'string' ? country.slice(0, 60) : null;
  let ipHash = null;
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || '';
    if (ip) ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32);
  } catch {}
  try {
    await firestore.collection('livePlays').add({
      artistId: artistId.trim(),
      city: safeCity || null,
      country: safeCountry || null,
      lat: latNum,
      lon: lonNum,
      ts: admin.firestore.FieldValue.serverTimestamp(),
      sourceUid: null,
      ipHash,
      via: 'http',
      v: 2
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    functions.logger.error('registerLivePlayHttp error', e);
    return res.status(500).json({ error: 'internal' });
  }
});

// (K) logStreamingFetch: salva metriche di un fetch streaming per audit
// Input: { artistId, spotifyFollowers, spotifyPopularity, applePreviewCount, totalEstimate }
export const logStreamingFetch = functions.https.onCall(async (data, context) => {
  const { artistId, spotifyFollowers, spotifyPopularity, applePreviewCount, totalEstimate } = data || {};
  if (!artistId || typeof artistId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'artistId richiesto');
  }
  // Limita scrittura ai soli admin oppure al sistema server-side (auth necessaria con claim admin)
  if (!context.auth || !(context.auth.token?.admin === true)) {
    throw new functions.https.HttpsError('permission-denied', 'Solo admin può loggare metriche');
  }
  try {
    await firestore.collection('streamingFetchLogs').add({
      artistId: artistId.trim(),
      spotifyFollowers: typeof spotifyFollowers === 'number' ? spotifyFollowers : null,
      spotifyPopularity: typeof spotifyPopularity === 'number' ? spotifyPopularity : null,
      applePreviewCount: typeof applePreviewCount === 'number' ? applePreviewCount : null,
      totalEstimate: typeof totalEstimate === 'number' ? totalEstimate : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      by: context.auth.uid || null,
      v: 1
    });
    return { ok: true };
  } catch (e) {
    functions.logger.error('logStreamingFetch error', e);
    throw new functions.https.HttpsError('internal', 'Errore log metriche');
  }
});

// (L) logPlay: registra eventi di riproduzione (start / threshold / complete) e incrementa contatori
// Input: { artistId, trackId?, title?, src?, event, playedSec?, durationSec? }
// Policy:
//  - Evento "start": incrementa playsTotal artista e (se trackId) traccia immediatamente.
//  - Evento "threshold": dopo ~30s o >=50% durata: incrementa playsVerified (qualificato per report SIAE).
//  - Evento "complete": salva playedSec finale e incrementa playsCompleted.
// Anti-spam: hash IP e debounce (max 1 start per trackId/ipHash ogni 25 minuti).
export const logPlay = functions.https.onCall(async (data, context) => {
  const { artistId, trackId, title, src, event, playedSec, durationSec } = data || {};
  if (!artistId || typeof artistId !== 'string' || artistId.trim().length < 3) {
    throw new functions.https.HttpsError('invalid-argument', 'artistId richiesto');
  }
  const allowedEvents = new Set(['start','threshold','complete']);
  if (!allowedEvents.has(event)) {
    throw new functions.https.HttpsError('invalid-argument', 'event non valido');
  }
  // Hash IP per limitare exploit massivi
  let ipHash = null;
  try {
    const ip = context.rawRequest?.headers['x-forwarded-for']?.split(',')[0] || context.rawRequest?.ip || '';
    if (ip) ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 40);
  } catch {}
  const now = Date.now();
  const dayKey = new Date().toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
  const docPayload = {
    artistId: artistId.trim(),
    trackId: trackId ? String(trackId) : null,
    title: title ? String(title).slice(0,180) : null,
    src: src ? String(src).slice(0,500) : null,
    event,
    playedSec: typeof playedSec === 'number' ? Math.max(0, Math.min(playedSec, 60*60)) : null,
    durationSec: typeof durationSec === 'number' ? Math.max(0, Math.min(durationSec, 60*60)) : null,
    ipHash,
    dayKey,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    v: 1
  };
  try {
    // Debounce start events per track/IP (25 min)
    if (event === 'start' && ipHash && trackId) {
      const recent = await firestore.collection('playLogs')
        .where('ipHash','==', ipHash)
        .where('trackId','==', String(trackId))
        .where('event','==','start')
        .orderBy('createdAt','desc')
        .limit(1)
        .get();
      const lastTs = recent.docs[0]?.createTime?.toDate?.().getTime();
      if (lastTs && (now - lastTs) < (25 * 60 * 1000)) {
        // Skip duplicate start
        return { skipped: true, reason: 'duplicate_start_debounce' };
      }
    }
  } catch (e) {
    functions.logger.warn('logPlay debounce check error', e);
  }
  try {
    await firestore.collection('playLogs').add(docPayload);
  } catch (e) {
    functions.logger.error('logPlay write error', e);
  }
  // Aggiornamenti counters
  const artistRef = firestore.collection('artisti').doc(artistId.trim());
  const updates = {};
  if (event === 'start') {
    updates.playsTotal = admin.firestore.FieldValue.increment(1);
    updates['playsDaily_' + dayKey] = admin.firestore.FieldValue.increment(1);
  }
  if (event === 'threshold') {
    updates.playsVerified = admin.firestore.FieldValue.increment(1);
    updates['playsVerifiedDaily_' + dayKey] = admin.firestore.FieldValue.increment(1);
  }
  if (event === 'complete') {
    updates.playsCompleted = admin.firestore.FieldValue.increment(1);
    updates['playsCompletedDaily_' + dayKey] = admin.firestore.FieldValue.increment(1);
  }
  // Track subdoc (optional)
  let trackUpdates = null;
  if (trackId) {
    trackUpdates = {};
    if (event === 'start') {
      trackUpdates.playsTotal = admin.firestore.FieldValue.increment(1);
      trackUpdates['playsDaily_' + dayKey] = admin.firestore.FieldValue.increment(1);
    }
    if (event === 'threshold') {
      trackUpdates.playsVerified = admin.firestore.FieldValue.increment(1);
      trackUpdates['playsVerifiedDaily_' + dayKey] = admin.firestore.FieldValue.increment(1);
    }
    if (event === 'complete') {
      trackUpdates.playsCompleted = admin.firestore.FieldValue.increment(1);
      trackUpdates['playsCompletedDaily_' + dayKey] = admin.firestore.FieldValue.increment(1);
    }
  }
  try {
    if (Object.keys(updates).length > 0) {
      await artistRef.set(updates, { merge: true });
    }
  } catch (e) {
    functions.logger.warn('logPlay artist counters error', e);
  }
  if (trackUpdates) {
    try {
      const trackRef = firestore.collection('artisti').doc(artistId.trim()).collection('tracks').doc(String(trackId));
      await trackRef.set(trackUpdates, { merge: true });
    } catch (e) {
      functions.logger.warn('logPlay track counters error', e);
    }
  }
  return { ok: true };
});

// (M) sendAuditionNotification: email interno quando arriva una nuova audition
// Input: { name, email, linkSpotifySoundCloud?, linkAppleMusic?, fileUrls: [url] }
// Uses SendGrid (functions:config:set sendgrid.key=... site.senderemail=...)
export const sendAuditionNotification = functions.https.onCall(async (data, context) => {
  const { name, email, linkSpotifySoundCloud, linkAppleMusic, fileUrls } = data || {};
  const safeName = (name || '').toString().trim().slice(0,80) || 'Creativo';
  const safeEmail = (email || '').toString().trim().slice(0,120);
  if (!safeName || !safeEmail || !Array.isArray(fileUrls) || fileUrls.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'name, email e fileUrls richiesti');
  }
  const sendgridKey = functions.config()?.sendgrid?.key;
  const sender = functions.config()?.site?.senderemail;
  if (!sendgridKey || !sender) {
    throw new functions.https.HttpsError('failed-precondition', 'SendGrid non configurato');
  }
  sgMail.setApiKey(sendgridKey);
  const adminDest = 'arteregistrazioni@gmail.com'; // destinatario fisso richiesto
  const links = [];
  if (linkSpotifySoundCloud) links.push(`Spotify/SoundCloud: ${linkSpotifySoundCloud}`);
  if (linkAppleMusic) links.push(`Apple Music: ${linkAppleMusic}`);
  const filesList = fileUrls.map(u => `* ${u}`).join('\n');
  const plain = `Nuova audition ricevuta\nNome: ${safeName}\nEmail: ${safeEmail}\n${links.length?links.join('\n')+'\n':''}File:\n${filesList}`;
  const html = `<h3>Nuova audition</h3><p><strong>Nome:</strong> ${safeName}<br/><strong>Email:</strong> ${safeEmail}</p>` +
    (links.length ? `<p>${links.map(l=>`<div>${l}</div>`).join('')}</p>` : '') +
    `<p><strong>File:</strong><br/>${fileUrls.map(u=>`<a href="${u}" target="_blank" rel="noopener">${u}</a>`).join('<br/>')}</p>`;
  try {
    await sgMail.send({ to: adminDest, from: sender, subject: `Sounds, ascolta: ${safeName}`, text: plain, html });
    await firestore.collection('auditionsMeta').add({
      name: safeName,
      email: safeEmail,
      linkSpotifySoundCloud: linkSpotifySoundCloud || null,
      linkAppleMusic: linkAppleMusic || null,
      fileUrls: fileUrls.slice(0,10),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      notified: true,
      v: 1
    });
    return { ok: true };
  } catch (e) {
    functions.logger.error('sendAuditionNotification error', e);
    throw new functions.https.HttpsError('internal', 'Invio notifica fallito');
  }
});
