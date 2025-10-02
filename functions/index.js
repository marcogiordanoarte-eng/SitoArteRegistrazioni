import functions from 'firebase-functions';
import admin from 'firebase-admin';
import fetch from 'node-fetch';
import archiver from 'archiver';
import OpenAI from 'openai';
import sgMail from '@sendgrid/mail';
import { PassThrough } from 'stream';
import { spawn } from 'child_process';
import crypto from 'crypto';

admin.initializeApp();
const storage = admin.storage();
const firestore = admin.firestore();

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
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).send('');
  }
  res.set('Access-Control-Allow-Origin', '*');
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
  const bucket = storage.bucket();
  const file = bucket.file(path);
  const expires = Date.now() + 10*60*1000;
  try {
    const [policy] = await file.generateSignedPostPolicyV4({ expires, fields: { 'Content-Type': contentType || 'application/octet-stream' } });
    return { url: policy.url, fields: policy.fields };
  } catch (e) {
    functions.logger.error('getUploadPolicy error', e);
    throw new functions.https.HttpsError('internal', 'Errore generazione policy');
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
