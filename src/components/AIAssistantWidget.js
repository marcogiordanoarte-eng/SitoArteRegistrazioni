import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Replaced hologram avatar with animated waveform visualization
import AssistantWaveform from './AssistantWaveform';
import { stopVoicePlayback } from './assistantVoice';
import { useMicAnalyser } from './useMicAnalyser';
import { db } from './firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { findBio, findGenre, findTheory, findPeriod, findDeep, getInitialDeepTopic, getNextDeep } from '../ai/musicKnowledge';
import { loadVoiceInventory, planClips, playClips } from './assistantVoice';

/**
 * AIAssistantWidget (fase 1 - prototipo locale senza chiamate esterne)
 * Funzioni incluse:
 *  - Chat testuale con risposte rule-based (placeholder AI)
 *  - Riconoscimento vocale (Web Speech API) se supportato
 *  - Sintesi vocale delle risposte (speechSynthesis)
 *  - Logging interazioni in Firestore (collezione aiInteractions)
 *  - Pulsante floating apri/chiudi
 *  - Suggerimenti rapidi
 *  - Architettura pronta per integrazione API LLM vera (TODO)
 */
export default function AIAssistantWidget({ page = 'home', forceWelcome = false, minimal = true }) {
  const [fabPos, setFabPos] = useState({ top: 18, right: 16 });
  const [avatarSize, setAvatarSize] = useState(96); // dimensione desktop ridotta (prima 110)
  // open (chat) will be deprecated in minimal mode; keep for non-minimal fallback
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(true); // assistant enabled/disabled (visual + audio)
  const [showRecorder, setShowRecorder] = useState(false);
  const [recentToast, setRecentToast] = useState(null); // small ephemeral transcript/answer toast
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => {
    if (minimal) return [];
    try { const raw = localStorage.getItem('ar_ai_chat_history'); if (raw) return JSON.parse(raw); } catch {}
    return [{ role: 'assistant', text: 'Ciao! Sono la guida di Arte Registrazioni. Come posso aiutarti? Puoi chiedermi di: scoprire gli artisti, ascoltare musica, vedere lo studio, partecipare al festival o contattare lo staff.' }];
  });
  const [typing, setTyping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [useAdvanced, setUseAdvanced] = useState(() => {
    try { return localStorage.getItem('ar_ai_use_adv') === '1'; } catch { return true; }
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [artists, setArtists] = useState([]); // contesto dinamico
  const [genreArtistMap, setGenreArtistMap] = useState({});
  // Stato mini chat (usato solo in modalità minimal, ma dichiarato sempre per rispettare le regole Hooks)
  const [miniOpen, setMiniOpen] = useState(false);
  const lastCtaTurnRef = useRef(-10);
  const deepTopicRef = useRef(null); // { topic, index }
  const [, forceRerender] = useState(0);

  // Load deep topic from localStorage
  useEffect(()=>{
    try { const raw = localStorage.getItem('ar_ai_deep_topic'); if (raw) deepTopicRef.current = JSON.parse(raw); } catch {}
  }, []);

  function persistDeepTopic() {
    try { if (deepTopicRef.current) localStorage.setItem('ar_ai_deep_topic', JSON.stringify(deepTopicRef.current)); } catch {}
  }
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null); // speech synthesis disabilitato
  const voiceInventoryLoadedRef = useRef(false);
  const playbackRef = useRef(null);
  const functionsRef = useRef(null);
  const welcomedRef = useRef(false);
  const welcomeAttemptsRef = useRef(0);
  const welcomeGestureBoundRef = useRef(false);
  const voices = [];
  const selectedVoiceProfile = 'f1';
  const selectedVoiceName = '';
  const verbatimMode = false;
  const voiceEnabled = active; // attiva solo se assistant abilitato
  const voiceProfiles = [];
  const speakerClicksRef = useRef(0);
  // Hook microfono (deve stare fuori da condizioni per regola Hooks)
  const mic = useMicAnalyser({ initialGain: 3 });
  // Espone controllo rapido in console se dev
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__arMic = {
        start: (id) => mic.start(id),
        stop: () => mic.stop(),
        setGain: (g) => mic.setGain(g),
        get level() { return mic.level; },
        get gain() { return mic.gain; },
        list: () => mic.inputs.map(d=> ({ id:d.deviceId, label:d.label })),
        select: (id) => { mic.setSelectedDeviceId(id); if (mic.active) { mic.stop(); setTimeout(()=>mic.start(id),60); } }
      };
      // Alias breve
      window.mic = window.__arMic;
    }
  }, [mic]);

  function loadVoices() { /* noop */ }

  useEffect(() => {
    try {
      loadVoices();
      window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    } catch {}
    let mounted = true;
    import('./firebase').then(mod => loadVoiceInventory(mod.db).then(()=> { if (mounted) voiceInventoryLoadedRef.current = true; }));
    return () => { mounted = false; try { window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices); } catch {} };
  }, []);

  // Persist messages (light)
  useEffect(() => {
    try { localStorage.setItem('ar_ai_chat_history', JSON.stringify(messages.slice(-50))); } catch {}
  }, [messages]);

  // Init callable functions ref
  useEffect(() => {
    try { functionsRef.current = getFunctions(); } catch {}
  }, []);

  // Force apertura + voce su home / buy se richiesto
  useEffect(() => {
    if (!active) return; // non eseguire welcome se disattivato
    if (!forceWelcome || welcomedRef.current) return;
    // Evita welcome se la page intro sta per riprodursi sulla home / page key equivalente
    try {
      if (page === 'home' && window.__pageVoiceIntroActive && window.__pageVoiceIntroActive['home']) {
        return; // PageVoiceIntro gestirà il primo audio lungo
      }
    } catch {}
    function getWelcomeText(){
      if (page === 'home' || page === 'global') {
        return 'Benvenuto su Arte Registrazioni. Scopri i nostri artisti, ascolta la loro musica e vivi l\'esperienza unica di Arte Registrazioni. Utilizza il menu per navigare tra le pagine e accedere a tutte le funzionalità.';
      }
      if (page === 'buy') {
        return 'Benvenuto in Buy Music. Scegli un genere, ascolta un\'anteprima di quindici secondi e acquista il brano che ti conquista per supportare direttamente gli artisti.';
      }
      return 'Ciao, posso aiutarti a esplorare i contenuti musicali.';
    }
    function attemptSpeak() {
      if (welcomedRef.current) return;
      welcomeAttemptsRef.current += 1;
  if (!minimal) setOpen(true);
  speak(getWelcomeText());
      // Se dopo un piccolo delay non ha avviato (browser blocca) prepara fallback gesture
      setTimeout(()=> {
        if (!speaking && !welcomedRef.current) {
          if (welcomeAttemptsRef.current < 3) {
            attemptSpeak();
          } else if (!welcomeGestureBoundRef.current) {
            const onFirstGesture = () => {
              if (!welcomedRef.current) {
                speak(getWelcomeText());
                welcomedRef.current = true;
              }
              ['pointerdown','keydown','touchstart'].forEach(evt=>window.removeEventListener(evt,onFirstGesture));
            };
            ['pointerdown','keydown','touchstart'].forEach(evt=>window.addEventListener(evt,onFirstGesture,{ once:true, passive:true }));
            welcomeGestureBoundRef.current = true;
          }
        } else {
          welcomedRef.current = true;
        }
      }, 350);
    }
    // Ritarda finché le voci non sono caricate (se possibile)
    const delay = voices.length ? 140 : 300; // leggero ritardo per assicurarci la voce migliore
    const to = setTimeout(()=> attemptSpeak(), delay);
    return () => clearTimeout(to);
  }, [forceWelcome, page, voices.length, speaking]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, autoScroll]);

  // Init speech recognition if available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.lang = 'it-IT';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(prev => prev ? (prev + ' ' + transcript) : transcript);
      setRecording(false);
    };
    rec.onerror = () => { setRecording(false); };
    rec.onend = () => { setRecording(false); };
    recognitionRef.current = rec;
  }, []);

  // Carica alcuni artisti per contesto
  useEffect(() => {
    let cancelled = false;
    import('./firebase').then(({ db }) => {
      import('firebase/firestore').then(({ collection, getDocs, query, limit }) => {
        getDocs(query(collection(db, 'artists'), limit(8))).then(snap => {
          if (cancelled) return;
            const arr = [];
            snap.forEach(doc => { const d = doc.data(); if (d?.nome || d?.name) arr.push(d.nome || d.name); });
            setArtists(arr.slice(0,8));
        }).catch(()=>{});
      });
    });
    return () => { cancelled = true; };
  }, []);

  // Mappa generi -> artisti (se la collezione contiene metadata genero)
  useEffect(() => {
    let cancelled = false;
    import('./firebase').then(({ db }) => {
      import('firebase/firestore').then(({ collection, getDocs, query, limit }) => {
        getDocs(query(collection(db, 'artists'), limit(40))).then(snap => {
          if (cancelled) return;
          const map = {};
          snap.forEach(doc => { const d = doc.data(); const g = (d?.genere || d?.genre || '').toLowerCase(); const name = d?.nome || d?.name; if (g && name) { if(!map[g]) map[g]=[]; if(map[g].length<6) map[g].push(name); } });
          setGenreArtistMap(map);
        }).catch(()=>{});
      });
    });
    return () => { cancelled = true; };
  }, []);

  function toggleRecording() {
    if (!recognitionRef.current) return;
    if (recording) {
      try { recognitionRef.current.stop(); } catch {}
      setRecording(false);
    } else {
      try { recognitionRef.current.start(); setRecording(true); } catch {}
    }
  }

  function refineForSpeech(raw) {
    let t = (raw||'').trim();
    t = t.replace(/([a-zÀ-ù0-9])\.(?=\S)/gi, '$1. '); // assicurare spazio dopo punto
    t = t.replace(/\s+/g,' ').replace(/ ,/g, ',');
    t = t.replace(/\(([^)]+)\)/g, ', $1, '); // parentesi come inciso
    t = t.replace(/\s+,/g, ',');
    return t;
  }
  function pickVoice(profileKey) {
    if (!voices.length) return null;
    return voices[0];
  }
  function speak(text, opts = {}) {
    if (!voiceEnabled || !text) return;
    const refined = (verbatimMode && !opts.forceRefine) ? text : refineForSpeech(text);
    // Usa campioni registrati se caricati
    if (voiceInventoryLoadedRef.current) {
      try { playbackRef.current?.cancel?.(); } catch {}
      const clips = planClips(refined);
      if (clips.length) {
        setSpeaking(true);
        playbackRef.current = playClips(clips, { onEnd: () => setSpeaking(false) });
        return;
      }
    }
  }

  async function logInteraction(q, a) {
    try {
      await addDoc(collection(db, 'aiInteractions'), { question: q, answer: a, page, createdAt: serverTimestamp() });
    } catch (e) { /* silent */ }
  }

  // Placeholder AI logic mapping keywords -> responses
  function generateRuleBasedAnswer(question) {
    const q = question.toLowerCase();
    // Mini knowledge base locale (può essere estesa o spostata server side)
    // Extensive knowledge lookups
    const bio = findBio(q);
    if (bio) {
      return appendCTA(bio + ' Vuoi che te la legga ad alta voce o desideri una curiosità in più?');
    }
    const theoryAns = findTheory(q);
    if (theoryAns) return appendCTA(theoryAns);
    const genreAns = findGenre(q);
    if (genreAns) return appendCTA(genreAns + ' Posso consigliarti di ascoltare alcuni artisti: chiedi "Mostrami gli artisti".');
    function appendCTA(text) {
      // Memoria: non ripetere se negli ultimi 2 turni
      const turn = messages.length;
      if (turn - lastCtaTurnRef.current <= 2) return text; // troppo vicino
      if (/buy music|acquista|scaricare i tuoi brani/i.test(text)) return text; // già presente
      lastCtaTurnRef.current = turn;
      return text + '\n\nAscolta gli artisti e supportali: visita Musica e usa BUY MUSIC (Sounds) per scaricare i brani che ami.';
    }
    // Periodi storici
    const period = findPeriod(q);
    if (period) {
      if (/approfondisci|dettagli|piu |più /.test(q)) return appendCTA(period.deep + ' Vuoi un altro periodo o un genere specifico?');
      return appendCTA(period.short + ' (Chiedimi "approfondisci" per più dettagli).');
    }
    // Richieste approfondimento generiche
    const deep = findDeep(q);
    if (deep) return appendCTA(deep);
    // Moderazione semplice / filtro
    const banned = [/parolacce1/i, /insulto1/i]; // placeholder pattern, sostituire con reale se necessario
    if (banned.some(r => r.test(q))) {
      return 'Preferisco mantenere un linguaggio rispettoso. Dimmi pure come posso aiutarti musicalmente.';
    }
    // Light context awareness
    if (/dove mi trovo|che pagina|dove sono/.test(q)) {
      return `Sei nella sezione: ${page}. Posso guidarti verso altre aree: Artisti, Musica, Studio, Festival, Podcast, Countdown, Contatti.`;
    }
    if (/elenco artisti|lista artisti|mostra artisti/.test(q)) {
      if (artists.length) return 'Alcuni artisti presenti: ' + artists.join(', ') + '. Vuoi aprire la pagina Artisti?';
      return 'Sto caricando gli artisti, riprova tra un attimo.';
    }
    const gotoMatch = q.match(/vai a (musica|artisti|studio|festival|podcast|contatti|countdown)/);
    if (gotoMatch) {
      const dest = gotoMatch[1];
      setTimeout(() => navigate('/' + (dest === 'musica' ? 'musica' : dest)), 450);
      return `Ti porto alla sezione ${dest}...`;
    }
    if (/chi (è|e')\s+([a-z0-9' ]+)/i.test(q)) {
      const nameQ = q.replace(/chi (è|e')\s+/, '').trim();
      const found = artists.find(a => a.toLowerCase().startsWith(nameQ.split(' ')[0]));
      if (found) return `${found}: artista presente nel catalogo. Puoi visitare la pagina Artisti per più dettagli.`;
    }
    if (/artist/i.test(q) || /artisti|cantanti|band/.test(q)) {
      return appendCTA('Per scoprire gli artisti clicca su “Artisti” nel menu oppure chiedimi: "Mostrami gli artisti".');
    }
    if (/musica|brani|ascolta|song|track/.test(q)) {
      return appendCTA('Per ascoltare i brani vai su “Musica”: trovi anteprime e puoi acquistare le tracce che ami.');
    }
    if (/studio|registraz/.test(q)) {
      return 'Lo Studio offre servizi di registrazione e produzione. Clicca su “Studio” per vedere il video e lo spazio.';
    }
    if (/festival|bando|concorso/.test(q)) {
      return 'Nel Festival puoi trovare il bando di partecipazione e le specifiche tecniche. Vai alla sezione "Festival".';
    }
    if (/podcast/.test(q)) {
      return 'Nel Podcast trovi interviste e contenuti dedicati agli artisti. Entra in “Podcast” dal menu.';
    }
    if (/countdown|uscite|release/.test(q)) {
      return 'La pagina Countdown mostra i prossimi rilasci e le uscite recenti.';
    }
    if (/contatt|email|scrivere|supporto|aiuto/.test(q)) {
      return 'Puoi scriverci dalla pagina Contatti. Riceverai una mail di ringraziamento automatica e poi una risposta personalizzata.';
    }
    if (/ciao|salve|buong/i.test(q)) {
      return 'Ciao! Come posso aiutarti? Chiedimi pure quello che cerchi.';
    }
    if (/grazie|thank/.test(q)) {
      return 'Grazie a te! Se ti serve altro sono qui.';
    }
    if (/ai |intelligenza|assistente/.test(q)) {
      return appendCTA('Sono l\'assistente olografico: ti aiuto a esplorare artisti, musica, studio e festival, e a trovare i brani perfetti.');
    }
    // Richiesta iniziale di chain approfondimento
    if (/inizia approfondimento|avvia approfondimento|spiega step|passo dopo passo/.test(q)) {
      const init = getInitialDeepTopic(q);
      if (init) { deepTopicRef.current = { topic: init.topic, index: init.index }; persistDeepTopic(); forceRerender(x=>x+1); return appendCTA(init.text + ' (Scrivi: "approfondisci ancora" per il livello successivo)'); }
      return 'Dimmi cosa vuoi approfondire (es: "inizia approfondimento armonizzazione diatonica").';
    }
    if (/approfondisci ancora|livello successivo|ancora più|vai oltre/.test(q)) {
      if (!deepTopicRef.current) return 'Non abbiamo ancora un argomento attivo. Scrivi ad esempio: "inizia approfondimento armonizzazione diatonica".';
      const nxt = getNextDeep(deepTopicRef.current.topic, deepTopicRef.current.index);
      if (nxt?.done) { persistDeepTopic(); return appendCTA(nxt.text + ' Puoi chiedere un altro argomento o una sintesi.'); }
      if (nxt) { deepTopicRef.current.index = nxt.index; persistDeepTopic(); forceRerender(x=>x+1); return appendCTA(nxt.text + ' ("approfondisci ancora" per continuare / "sintetizza" per riassumere)'); }
    }
    if (/sintetizza|riassumi|riassunto/.test(q)) {
      if (!deepTopicRef.current) return 'Dimmi prima cosa vuoi esplorare. Esempio: "inizia approfondimento ii-v-i".';
      const t = deepTopicRef.current.topic;
      return appendCTA(`Sintesi ${t}: focus su principi cardine e applicazione pratica immediata. Se vuoi cambiare argomento, chiedi un nuovo approfondimento.`);
    }
    // Comando per lettura ad alta voce generico
    if (/leggi (la )?bio|leggi.*biografia/.test(q)) {
      return 'Dimmi il nome dell\'artista di cui vuoi la biografia (ad es. "Leggi biografia di Miles Davis").';
    }
    if (/leggi.*(di |su )/.test(q)) {
      // estrai parte dopo "leggi"
      const name = q.split(/leggi/)[1].replace(/biografia|di|su|l[ao] /g,' ').trim();
      if (name.length > 2) {
        const b2 = findBio(name);
        if (b2) return appendCTA(b2 + ' Vuoi un approfondimento teorico correlato?');
      }
    }
    // Richiesta generi
    if (/generi|genere|stile musical/.test(q)) {
      return appendCTA('Macro-generi: Classica, Jazz, Rock, Pop, Elettronica, Hip Hop. Chiedi un genere per dettagli o “approfondisci jazz”.');
    }
    // Suggerisci artisti del catalogo in base al genere richiesto
    if (/jazz|rock|pop|classica|elettronic|hip hop/.test(q)) {
      const gKey = Object.keys(genreArtistMap).find(k => q.includes(k));
      if (gKey && genreArtistMap[gKey]?.length) {
        return appendCTA(`Alcuni artisti ${gKey} nel nostro catalogo: ${genreArtistMap[gKey].join(', ')}. Vuoi ascoltarli subito? Scrivi "vai a musica".`);
      }
    }
    return 'Posso aiutarti a navigare: prova a chiedere ad esempio “Mostrami gli artisti” oppure “Come ascolto la musica?”.';
  }

  async function callLLM(history) {
    // Primo tentativo: streaming SSE endpoint (richiede deploy funzione aiChatStream)
    const payload = { messages: history.map(m => ({ role: m.role, text: m.text })), page };
    try {
      const controller = new AbortController();
      const resp = await fetch('/aiChatStream', { // assumendo rewrite hosting -> cloud function
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (resp.ok && resp.headers.get('content-type')?.includes('text/event-stream')) {
        return new Promise(resolve => {
          const reader = resp.body.getReader();
          const dec = new TextDecoder();
          let answer = '';
          function pump() {
            reader.read().then(({ done, value }) => {
              if (done) { resolve({ fallback:false, answer }); return; }
              const text = dec.decode(value, { stream:true });
              const lines = text.split(/\n\n/);
              lines.forEach(line => {
                if (line.startsWith('data:')) {
                  try {
                    const obj = JSON.parse(line.slice(5).trim());
                    if (obj.chunk) {
                      answer += obj.chunk;
                      setMessages(m => {
                        const base = [...m];
                        const last = base[base.length-1];
                        if (last && last.role==='assistant' && last.streaming) last.text = answer + '▌';
                        else base.push({ role:'assistant', text: answer + '▌', streaming:true });
                        return base;
                      });
                    } else if (obj.done) {
                      setMessages(m => m.map(msg => msg.streaming ? { ...msg, streaming:false, text: msg.text.replace(/▌$/,'') } : msg));
                    }
                  } catch {}
                }
              });
              pump();
            }).catch(()=> resolve({ fallback:false, answer }));
          }
          pump();
        });
      }
    } catch {}
    // Fallback a callable
    if (!functionsRef.current) return null;
    try {
      const aiChat = httpsCallable(functionsRef.current, 'aiChat');
      const res = await aiChat(payload);
      if (res?.data) return res.data; return null;
    } catch (e) { setErrorMsg('AI avanzata non disponibile. Uso modalità base.'); return null; }
  }

  async function handleSend() {
    const question = input.trim();
    if (!question) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text: question }]);
    setTyping(true);
    const history = [...messages, { role: 'user', text: question }];
    let answerObj = null;
    if (useAdvanced) {
      answerObj = await callLLM(history);
    }
    let answer = answerObj && !answerObj.fallback ? answerObj.answer : generateRuleBasedAnswer(question);
    // Se risposta suggerisce di aprire pagina e contiene "Vuoi aprire" aggiungi prompt rapido
    let appended = false;
    if (/Vuoi aprire la pagina Artisti/i.test(answer)) {
      answer += '\n(Tip: digita "vai a artisti" per andare subito)';
      appended = true;
    }
    // Streaming char-by-char with blinking cursor
    const chars = [...answer];
    let acc = '';
    for (let i = 0; i < chars.length; i++) {
      acc += chars[i];
      await new Promise(r => setTimeout(r, 14 + Math.random()*25));
      setMessages(m => {
        const base = [...m];
        const last = base[base.length-1];
        if (last && last.role === 'assistant' && last.streaming) {
          last.text = acc + '▌';
        } else {
          base.push({ role:'assistant', text: acc + '▌', streaming:true });
        }
        return base;
      });
    }
    setMessages(m => m.map(msg => msg.streaming ? { ...msg, streaming:false, text: msg.text.replace(/▌$/,'') } : msg));
    setTyping(false);
    speak(answer);
    logInteraction(question, answer);
  }

  const baseSuggestions = [
    'Mostrami gli artisti',
    'Come ascolto la musica?',
    'Cos\'è il Festival?',
    'Voglio il podcast',
    'Come vi contatto?'
  ];
  const pageSuggestionsMap = {
    home: ['Portami agli artisti', 'Fammi ascoltare musica'],
    artisti: ['Come seleziono un artista?', 'Mostra altri artisti'],
    musica: ['Brani acquistabili', 'Come faccio anteprima?'],
    studio: ['Quali servizi offrite?', 'Video studio'],
    festival: ['Info bando', 'Specifiche tecniche'],
    podcast: ['Qual è l\'ultimo podcast?', 'Come partecipo?'],
    countdown: ['Prossime uscite', 'Uscite recenti'],
    contatti: ['Posso chiamarvi?', 'Come invio messaggio?']
  };
  const suggestions = minimal ? [] : [...(pageSuggestionsMap[page]||[]), ...baseSuggestions];

  function resetChat() {
    const init = [{ role: 'assistant', text: 'Chat resettata. Come posso aiutarti ora?' }];
    setMessages(init);
    try { localStorage.setItem('ar_ai_chat_history', JSON.stringify(init)); } catch {}
  }

  function toggleAdvanced() {
    setUseAdvanced(v => {
      const nv = !v; try { localStorage.setItem('ar_ai_use_adv', nv ? '1':'0'); } catch {}
      if (!nv) setErrorMsg('Modalità base attivata.'); else setErrorMsg('Modalità avanzata (LLM) attiva.');
      return nv;
    });
  }

  // Calcolo posizione: desktop molto a destra (quasi bordo), mobile un po' più basso sotto il logo
  useEffect(() => {
    function compute() {
      try {
        const logo = document.querySelector('.logo-wrapper');
        const isMobile = window.innerWidth < 600;
        const base = isMobile ? 72 : 96; // ridotte rispetto a prima
        setAvatarSize(base);
        if (logo) {
          const r = logo.getBoundingClientRect();
          if (isMobile) {
            // Mobile: centrato verticalmente all'altezza del logo (non sotto)
            const top = r.top + (r.height - base) / 2;
            setFabPos({ top: top < 8 ? 8 : top, right: 12 });
          } else {
            // Desktop: quasi al bordo destro, centrato verticalmente al logo
            const top = r.top + (r.height - base) / 2;
            setFabPos({ top: top < 12 ? 12 : top, right: 8 });
          }
        } else {
          // fallback se logo non trovato
            setFabPos({ top: isMobile ? 64 : 18, right: isMobile ? 12 : 8 });
        }
      } catch {}
    }
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, { passive:true });
    return () => { window.removeEventListener('resize', compute); window.removeEventListener('scroll', compute); };
  }, []);

  // Minimal Mode con mini pannello testo
  if (minimal) {
    return (
      <>
        <style>{`
          .aiw-active-ind { position:absolute; top:-6px; right:-6px; width:18px; height:18px; border-radius:50%; background: radial-gradient(circle at 35% 35%, #0ff, #09aaff); box-shadow:0 0 8px #0ff,0 0 16px #09aaff; border:1px solid #66f5ff; }
          .aiw-avatar-fab.minimal { position:fixed; z-index:12000; transition: top .35s ease, right .35s ease; }
          .aiw-mini-toggle { position:fixed; bottom:18px; right:82px; background:linear-gradient(135deg,#005b82,#00a9d8); border:1px solid #00d2ff; color:#e4fbff; padding:10px 14px; font-size:.65rem; border-radius:14px; cursor:pointer; z-index:12450; box-shadow:0 0 12px rgba(0,200,255,0.5); display:flex; align-items:center; gap:6px; }
          .aiw-mini-toggle.active { background:linear-gradient(135deg,#167c14,#27c824); border-color:#46ff62; box-shadow:0 0 14px rgba(60,255,120,0.6); }
          .aiw-mini-panel { position:fixed; bottom:86px; right:12px; width:290px; max-height:300px; display:flex; flex-direction:column; background:rgba(0,18,28,0.9); border:1px solid rgba(0,224,255,0.4); border-radius:16px; box-shadow:0 0 18px rgba(0,200,255,0.45); z-index:12500; backdrop-filter:blur(4px); }
          .aiw-mini-header { padding:7px 10px; font-size:.66rem; font-weight:600; color:#bdefff; display:flex; align-items:center; justify-content:space-between; background:linear-gradient(135deg,rgba(0,120,170,0.35),rgba(0,180,220,0.15)); border-top-left-radius:16px; border-top-right-radius:16px; }
          .aiw-mini-msgs { flex:1; overflow-y:auto; padding:6px 8px 8px; display:flex; flex-direction:column; gap:6px; font-size:.7rem; }
          .aiw-mini-msg { padding:6px 8px; border-radius:12px; line-height:1.3; white-space:pre-wrap; }
          .aiw-mini-msg.user { background:linear-gradient(135deg,#0065a8,#0099dd); color:#fff; align-self:flex-end; }
          .aiw-mini-msg.assistant { background:rgba(255,255,255,0.08); color:#dff9ff; border:1px solid rgba(255,255,255,0.08); }
          .aiw-mini-input-row { display:flex; gap:6px; padding:8px 8px 9px; border-top:1px solid rgba(0,224,255,0.25); }
          .aiw-mini-input-row input { flex:1; background:#07202c; border:1px solid #017fab; color:#dff9ff; border-radius:10px; padding:6px 8px; font-size:.68rem; }
          .aiw-mini-input-row button { background:#017fab; border:none; color:#fff; padding:6px 10px; border-radius:10px; cursor:pointer; font-size:.65rem; font-weight:600; }
        `}</style>
        <div className="aiw-avatar-fab minimal" style={{ top: fabPos.top, right: fabPos.right }}>
          <AssistantWaveform
            size={avatarSize}
            speaking={speaking}
            listening={recording || showRecorder || mic.active}
            active={active}
            level={mic.active ? mic.level : null}
            onClick={() => setMiniOpen(o=>!o)}
            onLongPress={() => { if (!active) return; setShowRecorder(true); if (!mic.active) mic.start(); }}
          />
          {active && <div className="aiw-active-ind" />}
        </div>
        <button className={`aiw-mini-toggle ${miniOpen ? 'active':''}`} onClick={()=> setMiniOpen(o=>!o)}>
          {miniOpen ? 'Chiudi Chat' : 'Apri Chat'}
          {speaking && <span style={{ width:10, height:10, background:'#0ff', borderRadius:'50%', boxShadow:'0 0 6px #0ff' }} />}
        </button>
        {miniOpen && (
          <div className="aiw-mini-panel" role="dialog" aria-label="Mini Chat Assistente">
            <div className="aiw-mini-header">
              <span>Assistente</span>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span style={{ fontSize:'.52rem', color: mic.active ? '#0ff':'#888' }}>{mic.active ? 'Mic ON':'Mic OFF'}</span>
                <button onClick={() => { const na=!active; setActive(na); if (!na) { stopVoicePlayback(); setSpeaking(false); mic.stop(); } }} style={{ background:'none', border:'1px solid #0aa2cc', color:'#a8f6ff', borderRadius:8, padding:'2px 6px', fontSize:'.52rem', cursor:'pointer' }}>{active ? 'Disatt.' : 'Attiva'}</button>
              </div>
            </div>
            <div className="aiw-mini-msgs" onScroll={(e)=>{ const el=e.currentTarget; const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10; setAutoScroll(atBottom); }}>
              {messages.map((m,i)=> <div key={i} className={`aiw-mini-msg ${m.role}${m.streaming?' streaming':''}`}>{m.text}</div> )}
              {messages.length===0 && (<div style={{ fontSize:'.58rem', opacity:.6, textAlign:'center', padding:'10px 4px' }}>Scrivi un messaggio o parla.</div>)}
            </div>
            <div className="aiw-mini-input-row">
              <input value={input} onChange={e=> setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') handleSend(); }} placeholder="Scrivi..." aria-label="Messaggio" />
              <button disabled={!input.trim() || typing} onClick={handleSend}>{typing ? '...' : 'Invia'}</button>
            </div>
          </div>
        )}
        {showRecorder && (
          <div className="aiw-recorder-modal" onClick={(e)=>{ if (e.target === e.currentTarget) setShowRecorder(false); }}>
            <div className="aiw-recorder-box">
              <h2>Richiesta vocale</h2>
              <div style={{ fontSize:'0.8rem', lineHeight:1.45, color:'#bdefff' }}>Premi REGISTRA, parla, poi FERMA per inviare.</div>
              <div style={{ minHeight:54, background:'#071722', border:'1px solid #0a5c7a', borderRadius:14, padding:'10px 14px', fontSize:'0.78rem', color:'#d9faff', display:'flex', alignItems:'center' }}>
                {recording ? '🟢 In ascolto...' : (input ? input : 'Pronto all\'ascolto')}
              </div>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                {!recording && <button className="aiw-rec-btn" onClick={toggleRecording}>🎤 REGISTRA</button>}
                {recording && <button className="aiw-rec-btn stop" onClick={toggleRecording}>◼︎ FERMA</button>}
                <button className="aiw-rec-btn stop" style={{ background:'#123b4f', boxShadow:'0 0 14px rgba(0,200,255,0.4)' }} onClick={()=> setShowRecorder(false)}>Chiudi</button>
                {!mic.active && <button className="aiw-rec-btn" style={{ background:'linear-gradient(135deg,#0676b8,#0cbcff)' }} onClick={()=> mic.start()}>🎤 Attiva Mic</button>}
              </div>
              <div style={{ marginTop:14, background:'#041b27', border:'1px solid #0a4d66', borderRadius:16, padding:'10px 12px', display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:'.65rem', color:'#7fe9ff' }}>
                  <span>Dispositivo</span>
                  <button onClick={()=> mic.refreshDevices()} style={{ background:'none', border:'1px solid #0aa2cc', color:'#7fe9ff', borderRadius:8, padding:'2px 6px', fontSize:'.55rem', cursor:'pointer' }}>Refresh</button>
                </div>
                <select value={mic.selectedDeviceId || ''} onChange={e => { mic.setSelectedDeviceId(e.target.value); if (mic.active) { mic.stop(); setTimeout(()=>mic.start(e.target.value), 60); } }} style={{ background:'#082838', color:'#d4f9ff', border:'1px solid #0aa2cc', borderRadius:10, padding:'6px 8px', fontSize:'.7rem' }}>
                  {mic.inputs.length === 0 && <option value="">Nessun dispositivo</option>}
                  {mic.inputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Input'}</option>)}
                </select>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <label style={{ fontSize:'.6rem', color:'#89d8ff' }}>Sensibilità / Gain</label>
                  <input type="range" min={0.2} max={4} step={0.05} value={mic.gain} onChange={e => mic.setGain(parseFloat(e.target.value))} />
                  <div style={{ fontSize:'.55rem', color:'#7fe9ff' }}>Livello: {(mic.level*100).toFixed(1)}% {mic.active ? '' : '(spento)'}</div>
                </div>
              </div>
              {mic.error && (<div style={{ fontSize:'.65rem', color:'#ff9f9f', marginTop:6 }}>Errore mic: {mic.error.message || mic.error.name}</div>)}
            </div>
          </div>
        )}
        {recentToast && (
          <div className="aiw-toast" style={{ position:'fixed', bottom:18, left:'50%', transform:'translateX(-50%)', background:'rgba(0,25,38,0.86)', border:'1px solid rgba(0,200,255,0.4)', boxShadow:'0 0 18px rgba(0,220,255,0.5)', color:'#d9faff', padding:'10px 18px', borderRadius:16, fontSize:'0.68rem', letterSpacing:'.3px', display:'flex', gap:10, alignItems:'center', zIndex:15000 }}>
            <div style={{ flex:1 }}>
              <strong style={{ color:'#7fe9ff' }}>Richiesta:</strong> {recentToast.q}<br />
              <strong style={{ color:'#7fe9ff' }}>Risposta:</strong> {recentToast.a}
            </div>
            <button onClick={()=> setRecentToast(null)} style={{ background:'none', border:'none', color:'#7fe9ff', cursor:'pointer', fontSize:'.65rem' }}>CHIUDI</button>
          </div>
        )}
      </>
    );
  }

  // Legacy full chat mode (non minimal)
  return (
    <>
      <style>{`
        @keyframes aiw-pulse { 0%,100% { transform:scale(1); opacity:1;} 50% { transform:scale(1.18); opacity:.3;} }
        .aiw-panel { position:fixed; bottom:96px; right:24px; width: min(420px, 92vw); max-height:70vh; display:flex; flex-direction:column; background:rgba(0,0,0,0.82); backdrop-filter:blur(8px); border:1px solid rgba(0,224,255,0.4); border-radius:18px; box-shadow:0 0 26px rgba(0,192,255,0.45),0 0 4px #00e0ff; z-index:12001; overflow:hidden; }
        .aiw-header { padding:14px 18px; display:flex; align-items:center; justify-content:space-between; font-weight:700; color:#fff; background:linear-gradient(135deg,rgba(0,90,140,0.55),rgba(0,180,220,0.3)); }
  .aiw-voices { display:flex; gap:6px; margin-left:6px; }
  .aiw-voices button { background:rgba(0,140,200,0.15); border:1px solid rgba(0,224,255,0.4); color:#bdefff; padding:4px 8px; border-radius:10px; font-size:.55rem; letter-spacing:.5px; cursor:pointer; }
  .aiw-voices button.active { background:#00a4d6; color:#fff; box-shadow:0 0 6px #00e0ff; }
  .aiw-voice-select { background:#042b3a; color:#cff7ff; border:1px solid #00b7ff; border-radius:8px; padding:4px 6px; font-size:.6rem; }
  .aiw-verbatim { display:flex; align-items:center; gap:4px; font-size:.55rem; color:#bfefff; cursor:pointer; }
        .aiw-body { padding:12px 14px; overflow-y:auto; font-size:0.95rem; display:flex; flex-direction:column; gap:10px; }
        .aiw-msg { padding:10px 14px; border-radius:14px; line-height:1.4; max-width:100%; white-space:pre-wrap; }
        .aiw-msg.user { background:linear-gradient(135deg,#004b92,#008dff); color:#fff; align-self:flex-end; box-shadow:0 0 10px rgba(0,128,255,0.5); }
        .aiw-msg.assistant.streaming { background:rgba(0,224,255,0.08); border:1px solid rgba(0,224,255,0.25); }
        .aiw-msg.assistant { background:rgba(255,255,255,0.08); color:#e9f8ff; border:1px solid rgba(255,255,255,0.08); }
  .aiw-msg.assistant.streaming::after { content:''; }
        .aiw-input-row { display:flex; gap:8px; padding:10px 12px 14px; border-top:1px solid rgba(0,224,255,0.25); background:rgba(0,0,0,0.4); }
        .aiw-input-row input { flex:1; background:#081e2c; color:#dffaff; border:1px solid #00aaff; border-radius:12px; padding:10px 12px; font-size:0.95rem; }
        .aiw-input-row button { background:linear-gradient(135deg,#0067b8,#00afff); border:none; color:#fff; font-weight:600; padding:10px 16px; border-radius:12px; cursor:pointer; display:flex; align-items:center; gap:6px; }
        .aiw-suggestions { display:flex; flex-wrap:wrap; gap:6px; padding:0 14px 10px; }
        .aiw-suggestions button { background:rgba(0,160,210,0.15); border:1px solid rgba(0,224,255,0.35); color:#bdefff; border-radius:20px; padding:6px 14px; cursor:pointer; font-size:0.75rem; letter-spacing:.5px; }
        .aiw-suggestions button:hover { background:rgba(0,224,255,0.28); }
  .aiw-avatar-fab { position:fixed; z-index:12000; transition: top .3s ease, right .3s ease; }
          .aiw-mini-panel { position:fixed; bottom:86px; right:12px; width:300px; max-height:320px; display:flex; flex-direction:column; background:rgba(0,18,28,0.88); border:1px solid rgba(0,224,255,0.4); border-radius:16px; box-shadow:0 0 20px rgba(0,200,255,0.45); z-index:12500; backdrop-filter:blur(4px); }
          .aiw-mini-header { padding:8px 12px; font-size:.68rem; font-weight:600; color:#bdefff; display:flex; align-items:center; justify-content:space-between; background:linear-gradient(135deg,rgba(0,120,170,0.35),rgba(0,180,220,0.15)); border-top-left-radius:16px; border-top-right-radius:16px; }
          .aiw-mini-msgs { flex:1; overflow-y:auto; padding:8px 10px 10px; display:flex; flex-direction:column; gap:6px; font-size:.72rem; }
          .aiw-mini-msg { padding:6px 9px; border-radius:12px; line-height:1.3; white-space:pre-wrap; }
          .aiw-mini-msg.user { background:linear-gradient(135deg,#0065a8,#0099dd); color:#fff; align-self:flex-end; }
          .aiw-mini-msg.assistant { background:rgba(255,255,255,0.08); color:#dff9ff; border:1px solid rgba(255,255,255,0.08); }
          .aiw-mini-input-row { display:flex; gap:6px; padding:8px 10px 10px; border-top:1px solid rgba(0,224,255,0.25); }
          .aiw-mini-input-row input { flex:1; background:#07202c; border:1px solid #017fab; color:#dff9ff; border-radius:10px; padding:6px 8px; font-size:.7rem; }
          .aiw-mini-input-row button { background:#017fab; border:none; color:#fff; padding:6px 10px; border-radius:10px; cursor:pointer; font-size:.68rem; font-weight:600; }
          .aiw-mini-toggle { position:fixed; bottom:18px; right:82px; background:linear-gradient(135deg,#005b82,#00a9d8); border:1px solid #00d2ff; color:#e4fbff; padding:10px 14px; font-size:.65rem; border-radius:14px; cursor:pointer; z-index:12450; box-shadow:0 0 12px rgba(0,200,255,0.5); display:flex; align-items:center; gap:6px; }
          .aiw-mini-toggle.active { background:linear-gradient(135deg,#167c14,#27c824); border-color:#46ff62; box-shadow:0 0 14px rgba(60,255,120,0.6); }
        .aiw-badge-dot { width:10px; height:10px; border-radius:50%; background:#00ffc8; box-shadow:0 0 6px #00ffc8; }
        @media (max-width:600px){ .aiw-panel { bottom:90px; right:10px; } }
      `}</style>
      <div className="aiw-avatar-fab" style={{ top: fabPos.top, right: fabPos.right }}>
        <AssistantWaveform size={avatarSize} speaking={speaking} listening={recording} active={active} onClick={() => setOpen(o=>!o)} onLongPress={()=> setActive(a=>!a)} />
      </div>
      {open && (
        <div className="aiw-panel" role="dialog" aria-label="Assistente AI">
          <div className="aiw-header">
            <span>Sounds • Assistente</span>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ fontSize:'.6rem', color:'#bdefff', letterSpacing:.5, padding:'4px 8px', background:'rgba(0,140,200,0.15)', border:'1px solid rgba(0,224,255,0.4)', borderRadius:10 }}>Voce reale • Sounds</div>
              <button onClick={toggleAdvanced} title={useAdvanced? 'Disattiva AI avanzata' : 'Attiva AI avanzata'} style={{ background: useAdvanced ? '#024d74' : '#333', border:'1px solid #00b7ff', color:'#fff', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:12 }}>{useAdvanced ? 'ADV' : 'BASIC'}</button>
              <button onClick={resetChat} style={{ background:'#333', border:'1px solid #555', color:'#fff', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:12 }}>Reset</button>
              {speaking && <div className="aiw-badge-dot" title="Riproduzione audio" />}
              <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:'#fff', fontSize:20, cursor:'pointer' }} aria-label="Chiudi">×</button>
            </div>
          </div>
          <div className="aiw-body" onScroll={(e)=>{ const el=e.currentTarget; const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10; setAutoScroll(atBottom); }}>
            {messages.map((m,i) => (
              <div key={i} className={`aiw-msg ${m.role} ${m.streaming ? 'streaming' : ''}`}>{m.text}</div>
            ))}
            {artists.length && open ? (
              <div style={{ opacity:0.55, fontSize:'0.65rem', marginTop:4 }}>Artisti caricati: {artists.join(', ')}</div>
            ) : null}
            <div ref={bottomRef} />
          </div>
          <div className="aiw-suggestions">
            {suggestions.map(s => (
              <button key={s} onClick={() => { setInput(s); setTimeout(handleSend, 40); }}>{s}</button>
            ))}
            {deepTopicRef.current && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', width:'100%', marginTop:6 }}>
                <button onClick={()=>{ setInput('approfondisci ancora'); setTimeout(handleSend,20); }} style={{ background:'#11344a', border:'1px solid #0aa7e0', color:'#bdefff', borderRadius:16, padding:'6px 12px', fontSize:'.68rem' }}>+ Livello</button>
                <button onClick={()=>{ setInput('sintetizza'); setTimeout(handleSend,20); }} style={{ background:'#24341a', border:'1px solid #5fbf41', color:'#d8ffd0', borderRadius:16, padding:'6px 12px', fontSize:'.68rem' }}>Sintesi</button>
                <button onClick={()=>{ deepTopicRef.current=null; try{localStorage.removeItem('ar_ai_deep_topic');}catch{}; forceRerender(x=>x+1); }} style={{ background:'#3a1a1a', border:'1px solid #bb5555', color:'#ffd8d8', borderRadius:16, padding:'6px 12px', fontSize:'.68rem' }}>Chiudi Topic</button>
              </div>
            )}
          </div>
          <div className="aiw-input-row">
            {/* Mic realtime control */}
            <button type="button" onClick={() => { mic.active ? mic.stop() : mic.start(); }}
              title={mic.active ? 'Disattiva microfono realtime' : 'Attiva microfono realtime'}
              style={{ background: mic.active ? '#a52d2d' : '#024d74', padding:'10px 12px', position:'relative' }}>
              {mic.active ? '🔴' : '🎤'}
              {mic.active && (
                <span style={{ position:'absolute', bottom:2, left:4, fontSize:9, color:'#fff', opacity:.75 }}>
                  {(mic.level*100).toFixed(0)}%
                </span>
              )}
            </button>
            <button type="button" onClick={toggleRecording} style={{ background: recording ? '#ff3b3b' : '#024d74', padding:'10px 14px' }} aria-label="Dettatura vocale">
              {recording ? '◼︎' : '🎤'}
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              placeholder="Scrivi o parla..."
              aria-label="Messaggio per l'assistente"
            />
            <button type="button" onClick={handleSend} disabled={!input.trim() || typing} aria-label="Invia">{typing ? '...' : 'Invia'}</button>
            <button type="button" onClick={()=>{
              const userMsgs = messages.filter(m=>m.role==='user').length;
              if (speaking) { try { synthRef.current?.cancel(); setSpeaking(false); } catch {}; return; }
              speakerClicksRef.current += 1;
              if (speakerClicksRef.current === 1 && userMsgs === 0) {
                speak('Come posso aiutarti?', { forceRefine:true, rate:0.95, pitch:0.98 });
              } else {
                const lastAssist = [...messages].reverse().find(m=>m.role==='assistant' && !m.streaming);
                if (lastAssist) speak(lastAssist.text.replace(/▌$/,'')); else speak('Come posso aiutarti?');
              }
            }} aria-label="Riproduci / Ferma" style={{ background:'#024d74' }}>{speaking ? '⏹' : '🔊'}</button>
          </div>
          <div style={{ padding:'0 14px 10px', fontSize:'0.65rem', opacity:0.55, color:'#bdefff' }}>
            {errorMsg && <div style={{ color:'#ff6b6b', marginBottom:4 }}>{errorMsg}</div>}
            {useAdvanced ? 'Modalità avanzata attiva (se backend disponibile).' : 'Modalità base locale.'} Storico salvato localmente. Max 50 messaggi.
          </div>
        </div>
      )}
    </>
  );
}
