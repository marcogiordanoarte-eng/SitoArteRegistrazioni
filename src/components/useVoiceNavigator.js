import { useEffect, useRef, useState } from 'react';
import siteContent from '../content/siteContent.json'; // legacy fallback
import knowledge from '../content/site-knowledge.json';

// Semplice normalizzatore
function norm(t='') { return t.toLowerCase().normalize('NFD').replace(/[^a-z0-9àèéìíòóùü\s]/gi,'').replace(/\s+/g,' ').trim(); }

// Costruzione dinamica alias da knowledge.pages
const SECTION_ALIASES = (() => {
  const base = {
    'home':'home','inizio':'home','start':'home'
  };
  try {
    if (Array.isArray(knowledge.pages)) {
      knowledge.pages.forEach(p => {
        const key = p.key || p.chiave || p.route?.replace(/\//g,'').replace(/:.+$/,'');
        if (!key) return;
        // route base
        if (!base[key]) base[key] = key;
        // titolo tokenizzato
        if (p.titolo) {
          const t = norm(p.titolo).split(' ');
          t.forEach(tok => { if (tok.length>3 && !base[tok]) base[tok] = key; });
        }
        // aggiungi alcuni alias manuali
        if (key === 'musica') { base['brani']=key; base['songs']=key; }
        if (key === 'sounds') { base['buy']='sounds'; base['compra']='sounds'; base['acquisti']='sounds'; base['acquista']='sounds'; }
        if (key === 'studio') { base['registrazione']='studio'; base['studio di registrazione']='studio'; }
        if (key === 'festival') { base['bando']='festival'; base['concorso']='festival'; }
        if (key === 'podcast') { base['interviste']='podcast'; }
        if (key === 'countdown') { base['uscite']='countdown'; base['release']='countdown'; base['prossime uscite']='countdown'; }
        if (key === 'contatti') { base['contatto']='contatti'; base['contact']='contatti'; base['email']='contatti'; }
      });
    }
  } catch {}
  return base;
})();

// Artist lookup structures
const ARTISTS = (knowledge.artists || knowledge.artisti || []).map(a => ({
  name: a.name || a.nome || '',
  bio: a.bioBreve || a.bio || '',
  tags: a.tags || a.tag || []
})).filter(a => a.name);
const ARTIST_INDEX = (() => {
  const idx = {};
  ARTISTS.forEach(a => { idx[norm(a.name)] = a; });
  return idx;
})();

export function useVoiceNavigator({ autoRestart=true, enabled=true, continuous=true, interim=false, lang='it-IT', onCommand }={}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const recogRef = useRef(null);
  const lastUserUtterRef = useRef('');

  // Azioni base di navigazione
  function performNav(section) {
    if (!section) return false;
    const path = section === 'home' ? '/' : '/' + section;
    try { if (window.location.pathname !== path) { window.history.pushState({}, '', path); } } catch {}
    // scroll top
    try { document.documentElement.scrollIntoView({behavior:'smooth'}); } catch {}
    return true;
  }
  function speakText(text) {
    try {
      import('./assistantVoice').then(mod => {
        const clips = mod.planClips(text);
        if (clips.length) {
          mod.playClips(clips, {});
          return;
        }
        // fallback: delega al pipeline globale se esiste
        if (window && window.speechSynthesis && !clips.length) {
          const ut = new SpeechSynthesisUtterance(text);
          ut.lang = 'it-IT';
          window.speechSynthesis.speak(ut);
        }
      });
    } catch {}
  }

  useEffect(() => {
    if (!enabled) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setResponse('Riconoscimento vocale non supportato.'); return; }
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = interim;
    rec.maxAlternatives = 1;
    rec.onstart = () => { setListening(true); };
    rec.onend = () => { setListening(false); if (autoRestart && enabled) { try { rec.start(); } catch {} } };
    rec.onerror = (e) => { setResponse('Errore riconoscimento: ' + (e.error||'')); };
    rec.onresult = (e) => {
      const res = e.results[e.results.length -1];
      if (!res || !res[0]) return;
      const txtRaw = res[0].transcript;
      lastUserUtterRef.current = txtRaw;
      const t = norm(txtRaw);
      setTranscript(txtRaw);
      // Pattern comandi: "vai a/va al/portami a" + sezione
      const navMatch = t.match(/^(?:portami|vai|va|andiamo) (?:a|al|alla|ai|agli) (.+)$/);
      if (navMatch) {
        const rawSec = navMatch[1];
        const secNorm = norm(rawSec);
        const tokens = secNorm.split(' ');
        let chosen = null;
        // prova match progressivo
        for (let len=tokens.length; len>0 && !chosen; len--) {
          const cand = tokens.slice(0,len).join(' ');
            if (SECTION_ALIASES[cand]) chosen = SECTION_ALIASES[cand];
        }
        if (!chosen && SECTION_ALIASES[secNorm]) chosen = SECTION_ALIASES[secNorm];
        if (chosen) {
          performNav(chosen);
          const msg = `Ti porto a ${chosen}.`;
          setResponse(msg);
          speakText(msg);
          onCommand && onCommand({ type:'navigate', target: chosen, utterance: txtRaw });
          return;
        }
        setResponse('Sezione non trovata.');
        speakText('Sezione non trovata.');
        return;
      }
      // Artist bio detection: pattern "chi e" / "dimmi di"
      const artistMatch = t.match(/^(?:chi e|chi è|dimmi di|parlami di) (.+)$/);
      if (artistMatch) {
        const query = norm(artistMatch[1]);
        // match esatto o parziale
        let chosen = ARTIST_INDEX[query];
        if (!chosen) {
          const qTokens = query.split(' ');
            chosen = ARTISTS.find(a => qTokens.every(tok => norm(a.name).includes(tok)));
        }
        if (chosen) {
          const msg = chosen.bio || `Biografia non disponibile per ${chosen.name}`;
          setResponse(msg);
          speakText(msg);
          onCommand && onCommand({ type:'artist', name: chosen.name, utterance: txtRaw });
          return;
        }
      }
      // Page info from knowledge
      const kPages = Array.isArray(knowledge.pages) ? knowledge.pages : [];
      const lower = t;
      const foundPage = kPages.find(p => {
        const key = p.key || p.chiave;
        const titolo = norm(p.titolo || p.nome || '');
        return (key && lower.includes(key)) || (titolo && lower.includes(titolo.split(' ')[0]));
      });
      if (foundPage) {
        const desc = foundPage.descrizione || 'Pagina.';
        setResponse(desc);
        speakText(desc);
        onCommand && onCommand({ type:'info', key: foundPage.key || foundPage.chiave, utterance: txtRaw });
        return;
      }
      // Legacy fallback siteContent
      const words = t.split(' ');
      let legacyKey = null;
      Object.keys(siteContent).forEach(k => {
        if (legacyKey) return;
        const title = norm(siteContent[k].title||'');
        const intro = norm(siteContent[k].intro||'');
        if (t.includes(k) || (title && t.includes(title.split(' ')[0])) || (intro && intro.split(' ').some(w => words.includes(w)))) legacyKey = k;
      });
      if (legacyKey) {
        const msg = siteContent[legacyKey].intro;
        setResponse(msg);
        speakText(msg);
        onCommand && onCommand({ type:'info-legacy', key: legacyKey, utterance: txtRaw });
        return;
      }
      setResponse('Non ho capito, ripeti?');
      speakText('Non ho capito, ripeti?');
    };
    try { rec.start(); } catch {}
    recogRef.current = rec;
    return () => { try { rec.onend = null; rec.stop(); } catch {} };
  }, [enabled, autoRestart, continuous, interim, lang, onCommand]);

  return { listening, transcript, response };
}
