import React, { useEffect, useState, useCallback } from 'react';
import { db, storage } from './firebase';
import { collection, addDoc, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Lista estesa di frasi suggerite (copre saluti, CTA, teoria, storia, navigazione, tono caldo, variazioni prosodiche)
const SUGGESTED_PROMPTS = [
  { id:'benvenuto1', text:'Benvenuto su Arte Registrazioni.' },
  { id:'benvenuto2', text:'Ciao e ben arrivato nel nostro universo sonoro.' },
  { id:'identita1', text:'Sono la tua guida nel mondo sonoro di Arte Registrazioni.' },
  { id:'identita2', text:'Ti accompagno tra artisti, produzioni e ispirazioni.' },
  { id:'mission1', text:'Qui valorizziamo creatività autentica e qualità artigianale.' },
  { id:'mission2', text:'Ogni ascolto sostiene chi crea musica indipendente.' },
  { id:'cta1', text:'Sostieni gli artisti acquistando la musica che ami.' },
  { id:'cta2', text:'Acquista un brano: è un gesto diretto di supporto all’artista.' },
  { id:'cta3', text:'Scarica le tracce che ti ispirano e alimenta nuova musica.' },
  { id:'naviga1', text:'Vai su Buy Music per trovare tracce uniche e royalty-free.' },
  { id:'naviga2', text:'Se vuoi ascoltare anteprime, apri la sezione Buy Music.' },
  { id:'naviga3', text:'Puoi esplorare lo Studio per vedere dove nascono i progetti.' },
  { id:'studio1', text:'Lo studio è progettato per resa acustica neutra e calda.' },
  { id:'studio2', text:'Nel nostro ambiente di registrazione curiamo dinamica e dettaglio.' },
  { id:'teoria1', text:"L'armonia modale differisce da quella tonale per la gerarchia delle funzioni." },
  { id:'teoria2', text:'Una cadenza II-V-I crea senso di direzione verso la tonica.' },
  { id:'teoria3', text:'Le triadi aumentate generano tensione aperta e ambiguità tonale.' },
  { id:'teoria4', text:'Il ritmo sincopato sposta gli accenti e crea propulsione.' },
  { id:'teoria5', text:'La poliritmia sovrappone cicli differenti generando complessità.' },
  { id:'storia1', text:'La musica barocca enfatizza contrasto, movimento e decorazione.' },
  { id:'storia2', text:'Il periodo classico ricerca equilibrio formale e chiarezza.' },
  { id:'storia3', text:'Il Romanticismo espande espressività, dinamica e timbro orchestrale.' },
  { id:'storia4', text:'Il Bebop accelera tempo, complessità armonica e interplay improvvisativo.' },
  { id:'storia5', text:'Nel Novecento emergono atonalità, minimalismo ed esplorazioni timbriche.' },
  { id:'domanda1', text:'Vuoi ascoltare qualcosa di energico oggi?' },
  { id:'domanda2', text:'Preferisci un’atmosfera calda, intima o elettronica?' },
  { id:'domanda3', text:'Cerchi ispirazione per un progetto o semplice relax?' },
  { id:'tono1', text:'Prenditi un momento per ascoltare con calma.' },
  { id:'tono2', text:'Lascia che il suono ti accompagni senza fretta.' },
  { id:'tono3', text:'Ogni traccia racconta una sfumatura diversa.' },
  { id:'varia1', text:'Se vuoi posso proporti generi diversi in sequenza.' },
  { id:'varia2', text:'Posso offrirti una panoramica rapida oppure un approfondimento.' },
  { id:'approfond1', text:'Dimmi se desideri entrare più a fondo in armonia o ritmo.' },
  { id:'approfond2', text:'Posso espandere questo concetto teorico passo dopo passo.' },
  { id:'closing1', text:'Se hai bisogno di altro sono qui.' },
  { id:'closing2', text:'Chiedimi quando vuoi un nuovo spunto.' },
  { id:'closing3', text:'Restiamo in ascolto: dimmi dove vuoi andare ora.' }
];

// Mappa completa (estesa) filename -> transcript per nuovi batch numerati 0085..0270
// Se l'utente nomina i file esattamente come da script (senza estensione) la trascrizione verrà riempita automaticamente.
// NOTA: mantieni accenti e punteggiatura come scritti qui.
const FILENAME_TRANSCRIPT_MAP = {
  '0085_Ciao_sono_Sounds': 'Ciao sono Sounds! L’iA di Arte Registrazioni, posso aiutarti?',
  '0086_Ciao_benvenuto': 'Ciao e benvenuto su Arte Registrazioni.',
  '0087_Benvenuti_tutti': 'Benvenuti su Arte Registrazioni.',
  '0088_Bentornato': 'Bentornato, felice di rivederti.',
  '0089_Bentornata': 'Bentornata, felice di rivederti.',
  '0090_Presentazione_breve': 'Sono Sounds, la voce intelligente del sito.',
  '0091_Presentazione_estesa': 'Sono Sounds, l’assistente intelligente di Arte Registrazioni.',
  '0092_Come_posso_aiutarti': 'Come posso aiutarti?',
  '0093_Dimmi_pura': 'Dimmi pure.',
  '0094_Ho_ascolto': 'Ti ascolto.',
  '0095_Un_attimo': 'Un attimo, controllo.',
  '0096_Sto_elaborando': 'Sto elaborando la tua richiesta.',
  '0097_Un_secondo_precarico': 'Un secondo, preparo le informazioni.',
  '0098_Ecco_quello_che_ho_trovato': 'Ecco quello che ho trovato.',
  '0099_Ecco_la_risposta': 'Ecco la risposta.',
  '0100_Ho_finito': 'Ho finito.',
  '0101_Fatto': 'Fatto.',
  '0102_Operazione_completata': 'Operazione completata.',
  '0103_Salvataggio_effettuato': 'Salvataggio effettuato.',
  '0104_Elemento_eliminato': 'Elemento eliminato.',
  '0105_Non_ho_trovato_risultati': 'Non ho trovato risultati.',
  '0106_Nessun_dato_disponibile': 'Nessun dato disponibile.',
  '0107_Riprova_piu_tardi': 'Riprova più tardi.',
  '0108_Per_favore_riprova': 'Per favore riprova.',
  '0109_Manca_un_informazione': 'Manca un’informazione importante.',
  '0110_Serve_nome_artista': 'Mi serve il nome dell’artista per procedere.',
  '0111_Serve_titolo_brano': 'Mi serve il titolo del brano.',
  '0112_Serve_genere': 'Seleziona prima un genere.',
  '0113_Non_capito_ripeti': 'Non ho capito, puoi ripetere?',
  '0114_Puoi_essere_piu_specifico': 'Puoi essere più specifico?',
  '0115_Scelta_genere': 'Scegli un genere musicale.',
  '0116_Ascolta_anteprima': 'Ascolta l’anteprima di quindici secondi.',
  '0117_Acquista_il_brano': 'Acquista il brano che ti conquista.',
  '0118_Diventa_tuo': 'Dopo l’acquisto il brano diventa tuo.',
  '0119_Non_sara_piu_venduto': 'Non sarà più venduto ad altri.',
  '0120_Supporta_artista': 'Così supporti direttamente l’artista.',
  '0121_Vai_a_Buy_Music': 'Vai alla sezione Buy Music.',
  '0122_Vai_a_Musica': 'Vai alla sezione Musica.',
  '0123_Vai_a_Artisti': 'Vai alla sezione Artisti.',
  '0124_Torna_alla_home': 'Torna alla home.',
  '0125_Apri_dashboard': 'Apri la dashboard.',
  '0126_Scorri_in_basso': 'Scorri in basso.',
  '0127_Scorri_in_alto': 'Scorri in alto.',
  '0128_Sto_cercando': 'Sto cercando.',
  '0129_Caricamento_in_corso': 'Caricamento in corso.',
  '0130_Analisi_in_corso': 'Analisi in corso.',
  '0131_Elaborazione_in_corso': 'Elaborazione in corso.',
  '0132_Aggiorno_dati': 'Aggiorno i dati.',
  '0133_Verifico_info': 'Verifico le informazioni.',
  '0134_Controlle_finale': 'Controllo finale.',
  '0135_Richiesta_ricevuta': 'Richiesta ricevuta.',
  '0136_Dammi_un_momento': 'Dammi un momento.',
  '0137_Grazie_attesa': 'Grazie per l’attesa.',
  '0138_Grazie_supporto': 'Grazie per il tuo supporto.',
  '0139_Grazie_visita': 'Grazie per la visita.',
  '0140_Buona_creazione': 'Buona creazione!',
  '0141_Buono_lavoro': 'Buon lavoro!',
  '0142_Buono_ascolto': 'Buon ascolto!',
  '0143_Buona_musica': 'Buona musica!',
  '0144_Pronto_per_nuova_richiesta': 'Pronto per una nuova richiesta.',
  '0145_Altro_aiuto': 'Hai bisogno di altro aiuto?',
  '0146_Posso_fare_altro': 'Posso fare altro per te?',
  '0147_Vuoi_suggerimento': 'Vuoi un suggerimento?',
  '0148_Ecco_un_suggerimento': 'Ecco un suggerimento.',
  '0149_Prova_altro_genere': 'Prova un altro genere.',
  '0150_Ascolta_un_altra_anteprima': 'Ascolta un’altra anteprima.',
  '0151_Artista_non_trovato': 'Artista non trovato.',
  '0152_Brano_non_disponibile': 'Brano non disponibile.',
  '0153_Pagina_non_disponibile': 'Pagina non disponibile.',
  '0154_Accesso_negato': 'Accesso negato.',
  '0155_Errore_inaspettato': 'Si è verificato un errore inaspettato.',
  '0156_Sto_proteggendo_dati': 'Sto proteggendo i tuoi dati.',
  '0157_Connessione_lenta': 'La connessione è lenta, attendi.',
  '0158_Tempo_scaduto': 'Tempo scaduto, riprova.',
  '0159_Non_autorizzato': 'Non sei autorizzato a eseguire questa azione.',
  '0160_Richiesta_troppo_lunga': 'La richiesta è troppo lunga.',
  '0161_Riduci_testo': 'Riduci il testo e riprova.',
  '0162_Dati_aggiornati': 'Dati aggiornati.',
  '0163_Ho_aggiornato': 'Ho aggiornato quello che mi hai chiesto.',
  '0164_File_caricato': 'File caricato.',
  '0165_File_pronto': 'File pronto.',
  '0166_File_non_valido': 'File non valido.',
  '0167_Formato_non_supportato': 'Formato non supportato.',
  '0168_Aggiorna_pagina': 'Aggiorna la pagina se il problema persiste.',
  '0169_Registrazione_completata': 'Registrazione completata.',
  '0170_Registrazione_annullata': 'Registrazione annullata.',
  '0171_Riproduzione_avviata': 'Riproduzione avviata.',
  '0172_Riproduzione_fermata': 'Riproduzione fermata.',
  '0173_Riproduzione_pausa': 'Riproduzione in pausa.',
  '0174_Riproduzione_ripresa': 'Riproduzione ripresa.',
  '0175_Aggiorno_libreria': 'Aggiorno la libreria.',
  '0176_Libreria_pronta': 'Libreria pronta.',
  '0177_Bio_non_disponibile': 'Biografia non disponibile.',
  '0178_Bio_troppo_lunga': 'La biografia è troppo lunga per intero.',
  '0179_Vuoi_leggere_tutto': 'Vuoi leggere tutto?',
  '0180_Ecco_la_biografia': 'Ecco la biografia.',
  '0181_Pagina_caricata': 'Pagina caricata.',
  '0182_Sessione_attiva': 'Sessione attiva.',
  '0183_Sessione_scaduta': 'Sessione scaduta.',
  '0184_Avvia_login': 'Avvia il login.',
  '0185_Logout_eseguito': 'Logout eseguito.',
  '0186_Credenziali_mancanti': 'Credenziali mancanti.',
  '0187_Credenziali_errate': 'Credenziali errate.',
  '0188_Autenticazione_successo': 'Autenticazione avvenuta con successo.',
  '0189_Permessi_aggiornati': 'Permessi aggiornati.',
  '0190_In_attesa_conferma': 'In attesa di conferma.',
  '0191_Conferma_ricevuta': 'Conferma ricevuta.',
  '0192_Puoi_procedere': 'Puoi procedere.',
  '0193_Hai_cancellato': 'Hai cancellato l’operazione.',
  '0194_Operazione_annullata': 'Operazione annullata.',
  '0195_Attendi_download': 'Attendi il download.',
  '0196_Download_pronto': 'Download pronto.',
  '0197_Licenza_generata': 'Licenza generata.',
  '0198_Licenza_non_disponibile': 'Licenza non disponibile.',
  '0199_Pagamento_in_corso': 'Pagamento in corso.',
  '0200_Pagamento_completato': 'Pagamento completato.',
  '0201_Pagamento_non_riuscito': 'Pagamento non riuscito.',
  '0202_Ricevuta_inviata': 'Ricevuta inviata.',
  '0203_Ricevuta_non_inviata': 'Ricevuta non inviata.',
  '0204_Carica_un_file': 'Carica un file.',
  '0205_Scegli_un_file': 'Scegli un file.',
  '0206_Trascina_qui_file': 'Trascina qui il file.',
  '0207_File_troppo_grande': 'File troppo grande.',
  '0208_Spazio_insufficiente': 'Spazio insufficiente.',
  '0209_Riprova_caricamento': 'Riprova il caricamento.',
  '0210_Sto_sincronizzando': 'Sto sincronizzando.',
  '0211_Sincronizzazione_completata': 'Sincronizzazione completata.',
  '0212_Sincronizzazione_fallita': 'Sincronizzazione fallita.',
  '0213_Aggiorna_elenco': 'Aggiorna l’elenco.',
  '0214_Elenco_vuoto': 'Elenco vuoto.',
  '0215_Elemento_gia_esistente': 'Elemento già esistente.',
  '0216_Elemento_aggiunto': 'Elemento aggiunto.',
  '0217_Elemento_non_valido': 'Elemento non valido.',
  '0218_Richiedi_conferma': 'Richiedi conferma.',
  '0219_Confermi_operazione': 'Confermi l’operazione?',
  '0220_Scelta_confermata': 'Scelta confermata.',
  '0221_Scelta_annullata': 'Scelta annullata.',
  '0222_Azione_irreversibile': 'Azione irreversibile.',
  '0223_Attenzione': 'Attenzione.',
  '0224_Avviso_importante': 'Avviso importante.',
  '0225_Procedo': 'Procedo.',
  '0226_Ecco_un_altro': 'Ecco un altro risultato.',
  '0227_Piu_risultati': 'Ci sono più risultati.',
  '0228_Solo_un_risultato': 'C’è un solo risultato.',
  '0229_Non_ci_sono_novita': 'Non ci sono novità.',
  '0230_Ci_sono_novita': 'Ci sono novità.',
  '0231_Ora_disponibile': 'Ora è disponibile.',
  '0232_Non_ancora_disponibile': 'Non è ancora disponibile.',
  '0233_Preparazione': 'In preparazione.',
  '0234_Pronto': 'Pronto.',
  '0235_E_inoltre': 'E inoltre.',
  '0236_E_poi': 'E poi.',
  '0237_Inoltre': 'Inoltre.',
  '0238_Percio': 'Perciò.',
  '0239_Dunque': 'Dunque.',
  '0240_Allora': 'Allora.',
  '0241_In_questo_momento': 'In questo momento.',
  '0242_Subito_dopo': 'Subito dopo.',
  '0243_Poi_continua': 'Poi continua.',
  '0244_E_adesso': 'E adesso.',
  '0245_Eccellente': 'Eccellente.',
  '0246_Perfetto': 'Perfetto.',
  '0247_Ottimo': 'Ottimo.',
  '0248_Ben_fatto': 'Ben fatto.',
  '0249_Fantastico': 'Fantastico.',
  '0250_Geniale': 'Geniale.',
  '0251_Mi_piace': 'Mi piace.',
  '0252_Buona_idea': 'Buona idea.',
  '0253_Ispirazione': 'Ispirazione.',
  '0254_Incredibile': 'Incredibile.',
  '0255_Sorprendente': 'Sorprendente.',
  '0256_Fine_messaggio': 'Fine messaggio.',
  '0257_A_presto': 'A presto.',
  '0258_A_piu_tardi': 'A più tardi.',
  '0259_Buona_giornata': 'Buona giornata.',
  '0260_Buona_serata': 'Buona serata.',
  '0261_Buona_notte': 'Buona notte.',
  '0262_Resto_a_disposizione': 'Resto a disposizione.',
  '0263_Chiedi_altro': 'Chiedi pure altro.',
  '0264_Grazie_e_a_presto': 'Grazie e a presto.',
  '0265_Fine_sessione': 'Fine sessione.',
  '0266_Sessione_terminata': 'Sessione terminata.',
  '0267_Riavvio_processo': 'Riavvio il processo.',
  '0268_Processo_riavviato': 'Processo riavviato.',
  '0269_Manutenzione': 'Modalità manutenzione.',
  '0270_Fine_lista': 'Fine della lista di frasi registrate.'
};

// Normalizza un nome file (senza estensione) per tentare diversi pattern e recuperare la trascrizione.
function getTranscriptFromFilename(raw) {
  if (!raw) return null;
  // Normalizza Unicode (NFC) per uniformare accenti composti / decomposti
  try { raw = raw.normalize('NFC'); } catch {}
  // Rimuovi eventuali parentesi tipo "(1)"
  let base = raw.replace(/\([^)]*\)$/,'').trim();
  // Sostituisci spazi con underscore, trattini con underscore, multiple underscore in uno
  base = base.replace(/[\s-]+/g,'_').replace(/_+/g,'_');
  // Normalizza eventuali caratteri accentati in forme semplici (fallback manuale per sicurezza)
  base = base
    .replace(/à|à/g,'a')
    .replace(/è|è/g,'e')
    .replace(/é|é/g,'e')
    .replace(/ì|ì/g,'i')
    .replace(/ò|ò/g,'o')
    .replace(/ù|ù/g,'u');
  // Elimina eventuali doppie estensioni accidentali già rimosse prima
  // Gestione leading zeros: cattura sequenza numerica iniziale lunga 3-6 cifre
  const m = base.match(/^(\d{3,6})_/);
  if (m) {
    let num = m[1];
    // Se più di 4 cifre e inizia con zeri, prendi le ultime 4
    if (num.length > 4) num = num.slice(num.length - 4);
    // Pad a 4
    num = num.padStart(4,'0');
    base = num + base.slice(m[0].length - 0); // ricompone (m[0] include underscore già)
    // Se accidentalmente abbiamo duplicato il numero (es. 0155_0155_...) mantieni solo primo
    base = base.replace(/^(\d{4})_\1_/, '$1_');
  }
  // Tentativi diretti: esatto, lower-case (anche se le chiavi sono già minuscole salvo lettere), niente cambio case necessario.
  if (FILENAME_TRANSCRIPT_MAP[base]) return FILENAME_TRANSCRIPT_MAP[base];
  // Prova a rimuovere eventuali errori di battitura: esempio 00095 -> 0095 etc.
  const numOnly = base.match(/^(\d{4})_(.*)$/);
  if (numOnly) {
    const alt = numOnly[1] + '_' + numOnly[2];
    if (FILENAME_TRANSCRIPT_MAP[alt]) return FILENAME_TRANSCRIPT_MAP[alt];
  }
  return null;
}

export default function VoiceAdmin(){
  const [uploading, setUploading] = useState(false);
  const [filesQueue, setFilesQueue] = useState([]); // FileList visualizzata prima upload multiplo
  const [samples, setSamples] = useState([]); // firestore docs
  const [filter, setFilter] = useState('');
  const [exporting, setExporting] = useState(false);
  const [lastExportUrl, setLastExportUrl] = useState('');
  const [showPrompts, setShowPrompts] = useState(false);
  const [validationMsg, setValidationMsg] = useState('');
  const [minDuration] = useState(1.0); // secondi
  const [maxDuration] = useState(32.0); // secondi (soft cap)
  const [dropActive, setDropActive] = useState(false);
  // Bulk compilation helpers
  const [bulkText, setBulkText] = useState('');
  const [bulkStartIndex, setBulkStartIndex] = useState(1); // 1-based
  const [bulkOnlyEmpty, setBulkOnlyEmpty] = useState(true);
  const [bulkApplying, setBulkApplying] = useState(false);
  // Intro lunghe (complete) per pagine
  const [introsQueue, setIntrosQueue] = useState([]); // {file, __duration, pageKey, transcript}
  const [introsDropActive, setIntrosDropActive] = useState(false);
  const [uploadingIntros, setUploadingIntros] = useState(false);
  const [pageIntroConfig, setPageIntroConfig] = useState({});
  // Biografie: upload audio lunghi associati a testo biografia (non legate a pageIntro ma come dataset 'bio')
  const [bioQueue, setBioQueue] = useState([]); // {file, __duration, transcript, artistName}
  const [bioDropActive, setBioDropActive] = useState(false);
  const [uploadingBios, setUploadingBios] = useState(false);
  // RIMOSSI controlli di elaborazione server (Auto Process / Diagnostics)
  const [autoMap, setAutoMap] = useState(true); // assegna automaticamente transcript/tag durante upload
  const [replaceExisting, setReplaceExisting] = useState(false); // se true sostituisce campione precedente con stesso transcript
  const [dirtyIds, setDirtyIds] = useState(new Set()); // track modifiche locali non ancora salvate (nel caso l'utente non perda il focus)
  // Registrazione fallback frasi Home/Buy Music
  const [recSupported] = useState(()=> !!(navigator.mediaDevices && window.MediaRecorder));
  const [recStream, setRecStream] = useState(null);
  const [recorder, setRecorder] = useState(null);
  const [recChunks, setRecChunks] = useState([]);
  const [recState, setRecState] = useState('idle'); // idle | recording | ready
  const [recBlob, setRecBlob] = useState(null);
  const [recTranscript, setRecTranscript] = useState('');
  const [recUploading, setRecUploading] = useState(false);

  async function startRecording(){
    if (!recSupported || recState==='recording') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      setRecStream(stream);
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks = [];
      mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks, { type:'audio/webm' });
        setRecChunks([]);
        setRecBlob(blob);
        setRecState('ready');
      };
      setRecChunks(chunks);
      mr.start();
      setRecorder(mr);
      setRecState('recording');
    } catch (e) {
      alert('Accesso microfono negato: '+(e?.message||'errore'));
    }
  }
  function stopRecording(){
    if (recorder && recState==='recording') {
      recorder.stop();
      recorder.stream.getTracks().forEach(t=>t.stop());
    }
  }
  function resetRecording(){
    setRecBlob(null); setRecTranscript(''); setRecState('idle'); setRecorder(null); if (recStream) recStream.getTracks().forEach(t=>t.stop()); setRecStream(null);
  }
  async function uploadRecording(){
    if (!recBlob || recUploading) return;
    setRecUploading(true);
    try {
      const arrayBuf = await recBlob.arrayBuffer();
      const fileName = 'fallback_'+Date.now()+'.webm';
      const storagePath = 'voice/fallback/'+fileName;
      const r = ref(storage, storagePath);
      await uploadBytes(r, new Blob([arrayBuf], { type:'audio/webm' }), { contentType:'audio/webm' });
      const url = await getDownloadURL(r);
      await addDoc(collection(db,'voiceSamples'), {
        filename: fileName,
        path: storagePath,
        storagePath,
        url,
        size: recBlob.size,
        mime: 'audio/webm',
        duration: null,
        transcript: recTranscript.trim(),
        tags: ['fallback'],
        fallback: true,
        createdAt: serverTimestamp()
      });
      resetRecording();
      setValidationMsg('Registrazione fallback caricata.');
    } catch (e) {
      alert('Errore upload registrazione: '+(e?.message||'sconosciuto'));
    } finally { setRecUploading(false); }
  }

  // Mappa automatica 84 frasi (3 take per blocco) replicata dal backend
  const autoMapTable = React.useMemo(()=>{
    const blocks = [
      ['Benvenuto su Arte Registrazioni.','intro'],
      ['Sono la tua guida nel mondo sonoro di Arte Registrazioni.','intro'],
      ['Iniziamo un viaggio tra artisti, musica e creatività.','intro'],
      ['Puoi esplorare gli artisti, ascoltare anteprime e acquistare brani unici.','navigazione'],
      ['Vai su Buy Music per trovare tracce royalty-free disponibili una sola volta, Take Your Music, this is “Sounds”.','navigazione'],
      ['Vuoi approfondire la biografia di un artista? Chiedimelo.','navigazione'],
      ['Sostieni gli artisti acquistando la musica che ami.','cta'],
      ['Ogni brano racconta una storia: scegli quello che risuona con te.','cta'],
      ['Se cerchi ispirazione, lascia che ti suggerisca un genere.','cta'],
      ['L’armonia modale si distingue da quella tonale per l’uso di centri meno gerarchici.','teoria'],
      ['Nel jazz, il linguaggio evolve grazie alla tensione e risoluzione degli accordi estesi.','teoria'],
      ['La dinamica modella l’emozione: intensità e respiro sono parte del discorso musicale.','teoria'],
      ['Il blues nasce come espressione emotiva profonda, poi diventa matrice di rock e jazz.','stili'],
      ['La musica barocca enfatizza il contrasto, il movimento e la decorazione melodica.','stili'],
      ['L’elettronica ambient crea spazi contemplativi sospesi.','stili'],
      ['La luce dorata filtrava tra le corde di una chitarra appoggiata al legno scuro.','neutro'],
      ['Sette musicisti provarono lentamente una progressione in re minore.','neutro'],
      ['Un eco distante dissolse il silenzio lasciando spazio al primo accordo.','neutro'],
      ['Vuoi ascoltare qualcosa di energico oggi?','domanda'],
      ['Preferisci scoprire un artista o un genere?','domanda'],
      ['Ti accompagno in Buy Music?','domanda'],
      ['Se hai bisogno di altro, sono qui.','conclusione'],
      ['Continuiamo quando vuoi.','conclusione'],
      ['La musica è pronta: dimmi solo da dove partire.','conclusione'],
      ['Classica, jazz, elettronica, ambient, sperimentale.','elenco_generi'],
      ['Anteprima di quindici secondi.','numeri'],
      ['Un brano, un download, una sola proprietà.','numeri'],
      ['Pacchetti disponibili: uno, cinque o dieci brani.','numeri']
    ];
    const arr = [];
    let idx = 0;
    for (const [text, cat] of blocks) {
      for (let r=0;r<3;r++){ idx++; arr[idx] = { text, category:cat }; }
    }
    return arr; // arr[1..84]
  },[]);

  // Pre-calcolo duration per nuovi file prima upload
  const analyzeFileDurations = useCallback(async (fileList) => {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const enriched = [];
    for (const f of fileList) {
      try {
        const arrayBuf = await f.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));
        enriched.push(Object.assign(f, { __duration: decoded.duration }));
      } catch {
        enriched.push(Object.assign(f, { __duration: null }));
      }
    }
    try { audioCtx.close(); } catch {}
    return enriched;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'voiceSamples'), snap => {
      const list = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      list.sort((a,b)=> (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
      setSamples(list);
    });
    return () => unsub();
  }, []);

  // Snapshot della config per mostrare intro attuali
  useEffect(() => {
    const unsub = onSnapshot(doc(db,'site','config'), snap => {
      setPageIntroConfig(snap.exists() ? (snap.data()||{}) : {});
    });
    return () => unsub();
  }, []);

  function guessPageKeyFromName(name){
    if (!name) return '';
    const low = name.toLowerCase();
    const map = ['home','artisti','festival','podcast','countdown','buy','musica'];
    for (const k of map) {
      if (low.includes(k)) return k;
    }
    return '';
  }

  function onIntroFilesSelected(fileList){
    analyzeFileDurations(fileList).then(enriched => {
      const withMeta = enriched.map(f => ({
        file: f,
        __duration: f.__duration,
        pageKey: guessPageKeyFromName(f.name),
        transcript: ''
      }));
      setIntrosQueue(prev => [...prev, ...withMeta]);
    });
  }

  function handleIntroDrag(e){
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIntrosDropActive(true); else if (e.type === 'dragleave') setIntrosDropActive(false);
  }
  function handleIntroDrop(e){
    e.preventDefault(); e.stopPropagation(); setIntrosDropActive(false);
    const dtFiles = Array.from(e.dataTransfer.files||[]).filter(f => /^audio\//.test(f.type));
    if (dtFiles.length) onIntroFilesSelected(dtFiles);
  }

  async function uploadIntros(){
    if (!introsQueue.length) return;
    setUploadingIntros(true); setValidationMsg('');
    try {
      let uploaded = 0; let assigned = 0; let overwritten = 0;
      // Preleva config corrente per rilevare overwrite
      const current = { ...pageIntroConfig };
      for (const item of introsQueue) {
        const { file, pageKey } = item;
        if (!file || !pageKey) continue; // skip se non assegnata pagina
        const ext = (file.name.split('.').pop()||'wav').toLowerCase();
        const storagePath = `voice/intros/${pageKey}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const r = ref(storage, storagePath);
        await uploadBytes(r, file, { contentType: file.type });
        const url = await getDownloadURL(r);
        // Salva sample opzionale (utile se vogliamo avere transcript searchable)
        let transcript = (item.transcript||'').trim();
        if (!transcript) transcript = `Intro completa ${pageKey}`;
        try {
          await addDoc(collection(db,'voiceSamples'), {
            filename: file.name,
            path: storagePath,
            storagePath,
            url,
            size: file.size,
            mime: file.type,
            duration: item.__duration || null,
            transcript,
            tags: ['intro', pageKey],
            introFor: pageKey,
            createdAt: serverTimestamp()
          });
        } catch {}
        // Assegna alla pagina (overwrite)
        if (current[`pageIntro_${pageKey}`]) overwritten += 1; else assigned += 1;
        await setDoc(doc(db,'site','config'), { [`pageIntro_${pageKey}`]: url }, { merge:true });
        uploaded += 1;
      }
      setValidationMsg(`Caricate ${uploaded} intro. Assegnate ${assigned}, sovrascritte ${overwritten}.`);
      setIntrosQueue([]);
    } catch (e) {
      alert('Errore upload intro: '+(e?.message||'sconosciuto'));
    } finally {
      setUploadingIntros(false);
    }
  }

  async function removePageIntro(pageKey){
    if (!pageKey) return;
    if (!window.confirm('Rimuovere intro assegnata per '+pageKey+'?')) return;
    try {
      await setDoc(doc(db,'site','config'), { [`pageIntro_${pageKey}`]: deleteField() }, { merge:true });
      setValidationMsg('Intro pagina '+pageKey+' rimossa.');
    } catch (e) {
      alert('Errore rimozione intro: '+(e?.message||'sconosciuto'));
    }
  }

  // ================= Biografie =================
  function onBioFilesSelected(fileList){
    analyzeFileDurations(fileList).then(enriched => {
      const withMeta = enriched.map(f => ({ file:f, __duration:f.__duration, transcript:'', artistName: guessArtistFromFilename(f.name) }));
      setBioQueue(prev => [...prev, ...withMeta]);
    });
  }
  function handleBioDrag(e){
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setBioDropActive(true); else if (e.type === 'dragleave') setBioDropActive(false);
  }
  function handleBioDrop(e){
    e.preventDefault(); e.stopPropagation(); setBioDropActive(false);
    const dtFiles = Array.from(e.dataTransfer.files||[]).filter(f => /^audio\//.test(f.type));
    if (dtFiles.length) onBioFilesSelected(dtFiles);
  }
  function guessArtistFromFilename(name){
    if (!name) return '';
    const base = name.replace(/\.[^.]+$/,'');
    // Split by underscores or dashes
    const parts = base.split(/[_-]+/);
    // Heuristic: take first two segments if they look like words and not numbers
    const words = parts.filter(p=>!/^[0-9]+$/.test(p)).slice(0,3);
    return words.join(' ');
  }
  async function uploadBios(){
    if (!bioQueue.length) return;
    setUploadingBios(true); setValidationMsg('');
    try {
      let uploaded = 0;
      for (const item of bioQueue){
        const { file, transcript, artistName } = item;
        if (!file) continue;
        const ext = (file.name.split('.').pop()||'wav').toLowerCase();
        const storagePath = `voice/bio/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const r = ref(storage, storagePath);
        await uploadBytes(r, file, { contentType:file.type });
        const url = await getDownloadURL(r);
        await addDoc(collection(db,'voiceSamples'), {
          filename: file.name,
          path: storagePath,
          storagePath,
          url,
          size: file.size,
          mime: file.type,
          duration: item.__duration || null,
          transcript: (transcript||'').trim(),
          tags: ['bio'].concat(artistName? [artistName]: []),
          bioFor: artistName || null,
          createdAt: serverTimestamp()
        });
        uploaded += 1;
      }
      setBioQueue([]);
      setValidationMsg(`Caricate ${uploaded} biografie.`);
    } catch (e) {
      alert('Errore upload biografie: '+(e?.message||'sconosciuto'));
    } finally {
      setUploadingBios(false);
    }
  }

  async function handleUploadSelected(){
    if (!filesQueue.length) return;
    setUploading(true);
    setValidationMsg('');
    try {
      let processed = 0;
      let replaced = 0;
      const baseCount = samples.length; // posizione di partenza per nuovi file (1-based future index = baseCount + processed + 1)
      for (const file of filesQueue) {
        const dur = file.__duration;
        if (dur != null && (dur < minDuration || dur > maxDuration)) {
          // Skip file fuori range
          continue;
        }
        const ext = (file.name.split('.').pop()||'wav').toLowerCase();
        const storagePath = `voice/raw/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const r = ref(storage, storagePath);
        await uploadBytes(r, file, { contentType: file.type });
        const url = await getDownloadURL(r);
        let transcript = '';
        let tags = [];
        if (autoMap) {
          const logicalPos = baseCount + processed + 1; // 1-based
          const entry = autoMapTable[logicalPos];
          if (entry) { transcript = entry.text; tags = [entry.category]; }
        }
        // Se non assegnato dall'autoMap (oltre i primi 84) prova a dedurre dal nome file -> FILENAME_TRANSCRIPT_MAP
        if (!transcript) {
          const baseName = (file.name||'').replace(/\.[^.]+$/,'');
          const mapped = getTranscriptFromFilename(baseName);
          if (mapped) transcript = mapped;
        }
        // Se richiesto, sostituisce campione esistente con lo stesso transcript (match esatto case-insensitive)
        if (replaceExisting && transcript.trim()) {
          const existing = samples.find(s => (s.transcript||'').trim().toLowerCase() === transcript.trim().toLowerCase());
            if (existing) {
              try {
                if (existing.path) { try { await deleteObject(ref(storage, existing.path)); } catch {} }
                await deleteDoc(doc(db,'voiceSamples', existing.id));
                replaced += 1;
              } catch {}
            }
        }
        await addDoc(collection(db,'voiceSamples'), {
          filename: file.name,
          path: storagePath,
          storagePath,
          url,
          size: file.size,
          mime: file.type,
          duration: dur || null,
          transcript,
          tags,
          audioChannels: 1,
          createdAt: serverTimestamp()
        });
        processed += 1;
      }
      setFilesQueue([]);
      if (processed === 0) setValidationMsg('Nessun file caricato: forse durata fuori range (< '+minDuration+'s o > '+maxDuration+'s).');
      else if (autoMap) setValidationMsg('Caricati '+processed+' file con transcript/tag automatici.' + (replaceExisting && replaced? ' Sostituiti '+replaced+' campioni precedenti.' : ''));
    } catch (e) {
      alert('Errore upload: ' + (e?.message||'sconosciuto'));
    } finally {
      setUploading(false);
    }
  }

  function updateSampleField(id, field, value){
    setSamples(list => list.map(s => s.id === id ? { ...s, [field]: value } : s));
    setDirtyIds(prev => {
      const n = new Set(prev);
      n.add(id);
      return n;
    });
  }

  async function saveSample(sample){
    try {
      const payload = { transcript: sample.transcript||'', tags: sample.tags||[] };
      await setDoc(doc(db,'voiceSamples', sample.id), payload, { merge:true });
      setDirtyIds(prev => {
        const n = new Set(prev);
        n.delete(sample.id);
        return n;
      });
    } catch (e) {
      alert('Errore salvataggio sample: ' + (e?.message||'sconosciuto'));
    }
  }

  async function removeSample(id){
    if (!window.confirm('Eliminare definitivamente questo audio?')) return;
    try { await deleteDoc(doc(db,'voiceSamples', id)); } catch (e) { alert('Errore eliminazione: '+ (e?.message||'sconosciuto')); }
  }

  async function exportDataset(){
    setExporting(true); setLastExportUrl(''); setValidationMsg('');
    try {
      // Validazione locale transcript
      const missing = samples.filter(s => !(s.transcript||'').trim()).length;
      if (missing > 0) {
        if (!window.confirm('Ci sono '+missing+' sample senza transcript. Verranno esclusi. Procedere?')) { setExporting(false); return; }
      }
      const fn = httpsCallable(getFunctions(), 'generateVoiceDataset');
      const res = await fn({ requireTranscript: true });
      if (res?.data?.zipUrl) {
        setLastExportUrl(res.data.zipUrl);
        setValidationMsg('Dataset generato: inclusi '+res.data.included+' / '+res.data.total+' (esclusi '+res.data.skipped+').');
      } else alert('Export completato ma URL non ricevuto');
    } catch (e) {
      alert('Errore export: '+ (e?.message||'sconosciuto'));
    } finally { setExporting(false); }
  }

  const filtered = samples.filter(s => {
    const f = filter.trim().toLowerCase();
    if (!f) return true;
    return (s.filename||'').toLowerCase().includes(f) || (s.transcript||'').toLowerCase().includes(f) || (s.tags||[]).join(',').toLowerCase().includes(f);
  });

  const PAGE_KEYS = [
    { key:'home', label:'Home' },
    { key:'artisti', label:'Artisti' },
    { key:'festival', label:'Festival' },
    { key:'podcast', label:'Podcast' },
    { key:'countdown', label:'Countdown' },
    { key:'buy', label:'Buy Music' },
    { key:'musica', label:'Musica' }
  ];

  async function assignSampleToPageIntro(sample, pageKey){
    if (!sample?.url || !pageKey) return;
    try {
      await setDoc(doc(db,'site','config'), { [`pageIntro_${pageKey}`]: sample.url }, { merge:true });
      setValidationMsg(`Impostata intro pagina ${pageKey} con sample ${sample.filename||sample.id}`);
    } catch (e) {
      alert('Errore assegnazione intro: '+(e?.message||'sconosciuto'));
    }
  }

  async function autoFillFromFilenames(){
    if (!samples.length) return;
    if (!window.confirm('Autocompilare i transcript mancanti dai nomi file?')) return;
    let filled = 0;
    let unchanged = 0;
    const updates = [];
    for (const s of samples) {
      if ((s.transcript||'').trim()) { unchanged++; continue; }
      const baseName = (s.filename||'').replace(/\.[^.]+$/,'');
      if (!baseName) continue;
      const candidate = getTranscriptFromFilename(baseName);
      if (candidate) { updates.push({ id: s.id, transcript: candidate }); filled++; }
    }
    if (!filled) {
      setValidationMsg('Nessun transcript compilato: controlla che i nomi corrispondano (es. 0085_Ciao_sono_Sounds.wav).');
      return;
    }
    // Applica aggiornamenti in serie (per limitare write burst)
    for (const u of updates) {
      try { await setDoc(doc(db,'voiceSamples', u.id), { transcript: u.transcript }, { merge:true }); } catch {}
    }
    setValidationMsg('Autocompilati '+filled+' transcript (ignorati '+unchanged+' già presenti). Ricarica la pagina se non li vedi subito.');
  }

  function onFilesSelected(list) {
    analyzeFileDurations(list).then(enriched => setFilesQueue(enriched));
  }

  function handleDrop(e){
    e.preventDefault(); e.stopPropagation(); setDropActive(false);
    const dtFiles = Array.from(e.dataTransfer.files||[]).filter(f => /^audio\//.test(f.type));
    if (dtFiles.length) onFilesSelected(dtFiles);
  }

  function handleDrag(e){
    e.preventDefault(); e.stopPropagation(); if (e.type === 'dragenter' || e.type === 'dragover') setDropActive(true); else if (e.type === 'dragleave') setDropActive(false);
  }

  function formatSec(s) { if (s == null) return '—'; return (s < 10 ? s.toFixed(2) : s.toFixed(1)) + 's'; }

  async function applyBulkTranscripts(){
    if (!bulkText.trim()) return;
    setBulkApplying(true);
    try {
      const lines = bulkText.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
      if (!lines.length) { setBulkApplying(false); return; }
      // Ordine base dei samples (già ordinati createdAt asc). Usiamo l'array 'samples'.
      const startIdx = Math.max(1, bulkStartIndex);
      let changed = 0;
      const newState = samples.map((s, idx) => {
        const logicalPos = idx + 1; // 1-based
        const rel = logicalPos - startIdx; // 0-based offset
        if (rel >= 0 && rel < lines.length) {
          if (!bulkOnlyEmpty || !(s.transcript||'').trim()) {
            changed += 1;
            return { ...s, transcript: lines[rel] };
          }
        }
        return s;
      });
      setSamples(newState);
      // Salvataggio batch (solo changed) – sequenziale semplice (potremmo ottimizzare con Promise.all throttling)
      for (const s of newState) {
        if (samples.find(o=>o.id===s.id)?.transcript !== s.transcript) {
          try { await setDoc(doc(db,'voiceSamples', s.id), { transcript: s.transcript }, { merge:true }); } catch {}
        }
      }
      setValidationMsg(changed + ' transcript applicati.');
    } finally {
      setBulkApplying(false);
    }
  }

  function generateCSV(){
    // CSV: filename;transcript;tags;duration
    const header = 'filename;transcript;tags;durationSeconds';
    const rows = samples.map(s => [
      (s.filename||'').replace(/;/g, ','),
      (s.transcript||'').replace(/\n+/g,' ').replace(/;/g, ','),
      (s.tags||[]).join('|').replace(/;/g, ','),
      (s.duration!=null ? s.duration.toFixed(3) : '')
    ].join(';'));
    const content = [header, ...rows].join('\n');
    const blob = new Blob([content], { type:'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'voice_samples_manifest.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 4000);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      <h3 className="dash-section-title">Voce Arte Registrazioni - Dataset</h3>
      <p style={{ lineHeight:1.45, fontSize:'0.95rem' }}>Carica qui i campioni vocali (WAV/MP3/M4A) anche con drag & drop. Il sistema registra durata, dimensione e metadati. Inserisci la trascrizione esatta (obbligatoria per l'inclusione nel dataset) e tag opzionali (es. warm, cta, domanda, teoria). I file fuori range durata (&lt; {minDuration}s o &gt; {maxDuration}s) vengono ignorati in upload. Genera quindi lo ZIP finale con manifest esteso.</p>
      <div style={{ display:'flex', flexDirection:'column', gap:12, border:'1px solid #333', padding:14, borderRadius:10 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <strong>Frasi suggerite</strong>
          <button className="dash-small-btn" type="button" onClick={()=>setShowPrompts(v=>!v)}>{showPrompts ? 'Riduci' : 'Espandi'}</button>
        </div>
        {showPrompts && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, maxHeight:160, overflowY:'auto' }}>
            {SUGGESTED_PROMPTS.map(p => (
              <span key={p.id} style={{ fontSize:'.66rem', background:'#111', border:'1px solid #444', padding:'4px 6px', borderRadius:6, color:'#ccc' }}>{p.text}</span>
            ))}
          </div>
        )}
      </div>
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        style={{ display:'flex', flexDirection:'column', gap:10, border: dropActive? '2px solid #0af' : '1px dashed #444', padding:14, borderRadius:10, background: dropActive? 'rgba(0,160,255,0.08)': 'transparent', transition:'all .2s' }}>
        <label style={{ fontWeight:'bold', color:'#ffd700' }}>Seleziona file audio (multipli)</label>
        <input type="file" multiple accept="audio/*" onChange={e => onFilesSelected(Array.from(e.target.files||[]))} disabled={uploading} />
        <div style={{ fontSize:'.65rem', color:'#889' }}>Trascina qui i file oppure usa il selettore. Verranno mostrati durata e filtri.</div>
        {filesQueue.length > 0 && (
          <div style={{ fontSize:'.75rem', color:'#bbb', display:'flex', flexDirection:'column', gap:4 }}>
            <div>{filesQueue.length} file pronti per l'upload.</div>
            <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 70px 46px', gap:4, maxHeight:140, overflowY:'auto', fontSize:'.62rem', border:'1px solid #222', padding:6, borderRadius:6 }}>
              {filesQueue.map(f => {
                const bad = f.__duration != null && (f.__duration < minDuration || f.__duration > maxDuration);
                return <div key={f.name+f.size} style={{ display:'contents' }}>
                  <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color: bad? '#ff6666':'#ddd' }}>{f.name}</div>
                  <div style={{ textAlign:'right', color: bad? '#ff6666':'#9ad' }}>{formatSec(f.__duration)}</div>
                  <div style={{ textAlign:'right', color:'#666' }}>{(f.size/1024).toFixed(0)}k</div>
                </div>;
              })}
            </div>
            <div style={{ color:'#666' }}>Fuori range (&lt;{minDuration}s o &gt;{maxDuration}s) saranno ignorati.</div>
          </div>
        )}
        <button className="dash-btn dash-btn--primary" disabled={uploading || !filesQueue.length} onClick={handleUploadSelected}>{uploading ? 'Carico...' : 'Carica Selezionati'}</button>
        {validationMsg && <div style={{ fontSize:'.65rem', color:'#ffb347' }}>{validationMsg}</div>}
      </div>
      {/* Sezione upload Intro complete */}
      <div style={{ border:'1px solid #333', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:14, background:'rgba(0,0,0,0.35)' }}>
        <strong style={{ color:'#ffd700' }}>Intro Pagine (registrazioni lunghe)</strong>
        <div style={{ fontSize:'.65rem', color:'#ccc', lineHeight:1.4 }}>Trascina qui file (anche &gt; {maxDuration}s) per impostare intro complete delle pagine. Ogni file deve avere una pagina assegnata. Il campo esistente verrà sovrascritto. Nome file può contenere la parola "home", "artisti", ecc. per autofill.</div>
        <div
          onDragEnter={handleIntroDrag}
            onDragOver={handleIntroDrag}
            onDragLeave={handleIntroDrag}
            onDrop={handleIntroDrop}
            style={{ border: introsDropActive? '2px solid #8a2be2':'1px dashed #555', padding:14, borderRadius:10, background: introsDropActive? 'rgba(138,43,226,0.12)': 'rgba(0,0,0,0.2)', display:'flex', flexDirection:'column', gap:8 }}>
          <label style={{ fontWeight:600, fontSize:'.75rem', color:'#d7b7ff' }}>Drag & Drop Intro</label>
          <input type="file" multiple accept="audio/*" onChange={e => onIntroFilesSelected(Array.from(e.target.files||[]))} disabled={uploadingIntros} />
          {introsQueue.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:'.6rem', color:'#aaa' }}>{introsQueue.length} file in coda.</div>
              <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 70px 110px minmax(0,1fr) 60px', gap:6, fontSize:'.58rem', maxHeight:200, overflowY:'auto', border:'1px solid #222', padding:6, borderRadius:6 }}>
                <div style={{ fontWeight:600 }}>File</div>
                <div style={{ fontWeight:600 }}>Dur.</div>
                <div style={{ fontWeight:600 }}>Pagina</div>
                <div style={{ fontWeight:600 }}>Transcript</div>
                <div></div>
                {introsQueue.map((q, i) => (
                  <React.Fragment key={q.file.name+q.file.size+i}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.file.name}</div>
                    <div style={{ textAlign:'right' }}>{q.__duration!=null ? (q.__duration<600 ? q.__duration.toFixed(1)+'s' : (q.__duration/60).toFixed(1)+'m') : '—'}</div>
                    <div>
                      <select value={q.pageKey} onChange={e=>setIntrosQueue(prev => prev.map((it, idx)=> idx===i? { ...it, pageKey:e.target.value } : it))} style={{ background:'#060606', color:'#ffd700', border:'1px solid #333', borderRadius:4 }}>
                        <option value="">—</option>
                        {PAGE_KEYS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <input value={q.transcript} placeholder={`Intro completa ${q.pageKey||''}`} onChange={e=>setIntrosQueue(prev => prev.map((it, idx)=> idx===i? { ...it, transcript:e.target.value } : it))} style={{ width:'100%', background:'#050505', color:'#bdefff', border:'1px solid #333', borderRadius:4 }} />
                    </div>
                    <div>
                      <button className="dash-small-btn" type="button" onClick={()=>setIntrosQueue(prev => prev.filter((_,idx)=> idx!==i))}>✕</button>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button className="dash-btn dash-btn--primary" type="button" disabled={uploadingIntros || !introsQueue.some(q=>q.pageKey)} onClick={uploadIntros}>{uploadingIntros ? 'Carico...' : 'Carica & Assegna Intro'}</button>
                <button className="dash-btn" type="button" disabled={uploadingIntros || !introsQueue.length} onClick={()=>setIntrosQueue([])}>Svuota Coda</button>
              </div>
            </div>
          )}
          {introsQueue.length === 0 && <div style={{ fontSize:'.6rem', color:'#777' }}>Trascina o seleziona file audio lunghi dedicati alle intro di pagina.</div>}
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <strong style={{ fontSize:'.7rem', color:'#ffd700' }}>Intro attuali</strong>
          <div style={{ display:'grid', gridTemplateColumns:'90px 130px minmax(0,1fr) 140px 70px', gap:6, fontSize:'.58rem', alignItems:'center' }}>
            <div style={{ fontWeight:600 }}>Pagina</div>
            <div style={{ fontWeight:600 }}>Stato</div>
            <div style={{ fontWeight:600 }}>URL</div>
            <div style={{ fontWeight:600 }}>Controlli</div>
            <div></div>
            {PAGE_KEYS.map(p => {
              const url = pageIntroConfig['pageIntro_'+p.key];
              return (
                <React.Fragment key={p.key}>
                  <div style={{ fontWeight:500 }}>{p.label}</div>
                  <div style={{ color: url? '#7dffb3':'#ff8888' }}>{url? 'Impostata':'—'}</div>
                  <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:url? '#cff7ff':'#555' }}>{url || '—'}</div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {url && <audio src={url} controls style={{ width:140 }} />}
                    {url && <button type="button" className="dash-small-btn" onClick={()=>{ try { const a = new Audio(url); a.play(); } catch {} }}>Play</button>}
                    {url && <button type="button" className="dash-small-btn" onClick={()=>{ /* For stop: without a persistent audio ref, instruct user to use control */ alert('Per fermare usa i controlli del player, oppure ricarica se necessario.'); }}>Stop</button>}
                    {url && <button type="button" className="dash-small-btn" onClick={()=>{ try { const a = new Audio(url); a.currentTime = 0; a.play(); } catch {} }}>Riascolta</button>}
                  </div>
                  <div>
                    {url && <button className="dash-small-btn dash-small-btn--danger" type="button" onClick={()=>removePageIntro(p.key)}>Rimuovi</button>}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
      {/* Sezione Biografie (audio lunghi) */}
      <div style={{ border:'1px solid #333', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:14 }}>
        <strong style={{ color:'#ffd700' }}>Biografie (upload audio lunghi)</strong>
        <div style={{ fontSize:'.65rem', color:'#ccc', lineHeight:1.4 }}>Carica registrazioni lunghe delle biografie degli artisti. Verranno salvate come sample con tag "bio". Puoi aggiungere il nome artista e la trascrizione. Questi file potranno essere usati per letture complete.</div>
        <div
          onDragEnter={handleBioDrag}
          onDragOver={handleBioDrag}
          onDragLeave={handleBioDrag}
          onDrop={handleBioDrop}
          style={{ border: bioDropActive? '2px solid #1fa':'1px dashed #555', padding:14, borderRadius:10, background: bioDropActive? 'rgba(0,160,255,0.12)':'rgba(0,0,0,0.25)', display:'flex', flexDirection:'column', gap:8 }}>
          <label style={{ fontWeight:600, fontSize:'.75rem', color:'#9ddfff' }}>Drag & Drop Biografie</label>
          <input type="file" multiple accept="audio/*" onChange={e=>onBioFilesSelected(Array.from(e.target.files||[]))} disabled={uploadingBios} />
          {bioQueue.length>0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:'.6rem', color:'#aaa' }}>{bioQueue.length} file in coda.</div>
              <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 70px 140px minmax(0,1fr) 60px', gap:6, fontSize:'.58rem', maxHeight:240, overflowY:'auto', border:'1px solid #222', padding:6, borderRadius:6 }}>
                <div style={{ fontWeight:600 }}>File</div>
                <div style={{ fontWeight:600 }}>Dur.</div>
                <div style={{ fontWeight:600 }}>Artista</div>
                <div style={{ fontWeight:600 }}>Transcript</div>
                <div></div>
                {bioQueue.map((q,i)=>(
                  <React.Fragment key={q.file.name+q.file.size+i}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q.file.name}</div>
                    <div style={{ textAlign:'right' }}>{q.__duration!=null ? (q.__duration<600 ? q.__duration.toFixed(1)+'s' : (q.__duration/60).toFixed(1)+'m') : '—'}</div>
                    <div>
                      <input value={q.artistName} placeholder="Nome artista" onChange={e=>setBioQueue(prev=>prev.map((it,idx)=> idx===i? { ...it, artistName:e.target.value }: it))} style={{ width:'100%', background:'#050505', color:'#ffd700', border:'1px solid #333', borderRadius:4 }} />
                    </div>
                    <div>
                      <input value={q.transcript} placeholder="Trascrizione o nota" onChange={e=>setBioQueue(prev=>prev.map((it,idx)=> idx===i? { ...it, transcript:e.target.value }: it))} style={{ width:'100%', background:'#050505', color:'#bdefff', border:'1px solid #333', borderRadius:4 }} />
                    </div>
                    <div>
                      <button className="dash-small-btn" onClick={()=>setBioQueue(prev=>prev.filter((_,idx)=>idx!==i))}>✕</button>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button className="dash-btn dash-btn--primary" type="button" disabled={uploadingBios || !bioQueue.length} onClick={uploadBios}>{uploadingBios ? 'Carico...' : 'Carica Biografie'}</button>
                <button className="dash-btn" type="button" disabled={uploadingBios || !bioQueue.length} onClick={()=>setBioQueue([])}>Svuota Coda</button>
              </div>
            </div>
          )}
          {bioQueue.length===0 && <div style={{ fontSize:'.6rem', color:'#777' }}>Trascina oppure seleziona file audio delle biografie (WAV/MP3/M4A ecc.).</div>}
        </div>
      </div>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
        <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filtra per nome / testo / tag" style={{ flex:'1 1 240px', padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
        <button className="dash-btn" onClick={exportDataset} disabled={exporting || !samples.length}>{exporting ? 'Generazione...' : 'Genera Dataset (ZIP)'}</button>
        {lastExportUrl && <a className="dash-btn dash-btn--ghost" href={lastExportUrl} target="_blank" rel="noreferrer">Download ZIP</a>}
        <label style={{ fontSize:'.55rem', display:'flex', alignItems:'center', gap:4, background:'#111', padding:'4px 8px', border:'1px solid #333', borderRadius:8 }}>
          <input type="checkbox" checked={autoMap} onChange={e=>setAutoMap(e.target.checked)} /> auto transcripts
        </label>
        <label style={{ fontSize:'.55rem', display:'flex', alignItems:'center', gap:4, background:'#111', padding:'4px 8px', border:'1px solid #333', borderRadius:8 }}>
          <input type="checkbox" checked={replaceExisting} onChange={e=>setReplaceExisting(e.target.checked)} /> sostituisci se transcript esiste
        </label>
        <button type="button" className="dash-btn" onClick={autoFillFromFilenames} disabled={!samples.length}>Autocompila da filename</button>
        <button className="dash-btn dash-btn--danger" disabled={!samples.length || uploading} onClick={async()=>{
          if (!window.confirm('Eliminare TUTTI i samples e (se possibile) i file su storage? Operazione irreversibile.')) return;
          try {
            const list = [...samples];
            let deleted = 0;
            for (const s of list) {
              try {
                if (s.path) { try { await deleteObject(ref(storage, s.path)); } catch {} }
                await deleteDoc(doc(db,'voiceSamples', s.id));
                deleted += 1;
              } catch {}
            }
            setValidationMsg('Eliminati '+deleted+' samples. Ora puoi caricare i nuovi file mono con mapping automatico.');
          } catch (e) {
            alert('Errore eliminazione massiva: '+(e?.message||'sconosciuto'));
          }
        }}>Elimina Tutti</button>
      </div>
      <div style={{ overflowX:'auto', border:'1px solid #222', borderRadius:12 }}>
        <div style={{ display:'flex', justifyContent:'flex-end', padding:'4px 6px' }}>
          <button
            className="dash-btn dash-btn--primary"
            style={{ fontSize:'.62rem', padding:'6px 10px' }}
            onClick={async ()=>{
              const toSave = samples.filter(s => dirtyIds.has(s.id));
              if (!toSave.length) { setValidationMsg('Nessuna modifica da salvare.'); return; }
              let ok = 0;
              for (const s of toSave) {
                try {
                  await setDoc(doc(db,'voiceSamples', s.id), { transcript: s.transcript||'', tags: s.tags||[] }, { merge:true });
                  ok += 1;
                } catch {}
              }
              setDirtyIds(new Set());
              setValidationMsg('Salvati '+ok+' elementi.');
            }}
          >SALVA TUTTO ({dirtyIds.size||0})</button>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'.78rem' }}>
          <thead>
            <tr style={{ background:'#111' }}>
              <th style={th}>File</th>
              <th style={th}>Durata</th>
              <th style={th}>Transcript</th>
              <th style={th}>Tag (comma)</th>
              <th style={th}>Anteprima</th>
              <th style={th}>Azioni</th>
              <th style={th}>Intro Pagina</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} style={{ borderTop:'1px solid #222', background: (!s.transcript||!s.transcript.trim()) ? 'rgba(120,0,0,0.2)' : 'transparent' }}>
                <td style={td}>{s.filename || '—'}</td>
                <td style={{ ...td, whiteSpace:'nowrap' }}>{formatSec(s.duration)}</td>
                <td style={{ ...td, minWidth:260 }}>
                  <textarea
                    value={s.transcript||''}
                    onChange={e=>updateSampleField(s.id,'transcript', e.target.value)}
                    onBlur={()=>saveSample(s)}
                    rows={2}
                    style={{ width:'100%', resize:'vertical', background:'#060606', color:'#ffd700', border:'1px solid #333', borderRadius:6, padding:6 }}
                    placeholder="Trascrizione esatta..." />
                </td>
                <td style={{ ...td, minWidth:160 }}>
                  <input
                    value={(s.tags||[]).join(',')}
                    onChange={e=>updateSampleField(s.id,'tags', e.target.value.split(',').map(t=>t.trim()).filter(Boolean))}
                    onBlur={()=>saveSample(s)}
                    placeholder="es: warm,cta"
                    style={{ width:'100%', background:'#060606', color:'#bdefff', border:'1px solid #333', borderRadius:6, padding:6 }} />
                </td>
                <td style={td}>
                  {s.url ? <audio src={s.url} controls style={{ width:160 }} /> : '—'}
                </td>
                <td style={{ ...td, minWidth:140, display:'flex', flexDirection:'column', gap:6 }}>
                  <button className="dash-small-btn" onClick={()=>saveSample(s)}>Salva</button>
                  <button className="dash-small-btn dash-small-btn--danger" onClick={()=>removeSample(s.id)}>Elimina</button>
                </td>
                <td style={{ ...td, minWidth:170 }}>
                  <select
                    onChange={e => { const val = e.target.value; if (val) assignSampleToPageIntro(s, val); e.target.value=''; }}
                    defaultValue=""
                    style={{ background:'#060606', color:'#ffd700', border:'1px solid #333', borderRadius:6, padding:'4px 6px', fontSize:'.65rem' }}
                  >
                    <option value="">— assegna —</option>
                    {PAGE_KEYS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={5} style={{ padding:20, textAlign:'center', color:'#666' }}>Nessun sample trovato.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {dirtyIds.size > 0 && (
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button className="dash-btn dash-btn--primary" onClick={async ()=>{
            const toSave = samples.filter(s => dirtyIds.has(s.id));
            let ok = 0;
            for (const s of toSave) {
              try {
                await setDoc(doc(db,'voiceSamples', s.id), { transcript: s.transcript||'', tags: s.tags||[] }, { merge:true });
                ok += 1;
              } catch {}
            }
            setDirtyIds(new Set());
            setValidationMsg('Salvati '+ok+' elementi aggiornati.');
          }}>Salva tutti i cambiamenti ({dirtyIds.size})</button>
        </div>
      )}
      {/* Sezione registrazione fallback */}
      <div style={{ border:'1px solid #333', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
        <strong style={{ color:'#ffd700' }}>Registrazione Fallback (Home / Buy Music)</strong>
        {!recSupported && <div style={{ fontSize:'.65rem', color:'#f77' }}>Browser non supporta MediaRecorder.</div>}
        {recSupported && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ fontSize:'.6rem', color:'#aaa' }}>Registra una versione di sicurezza delle frasi principali così da averle sempre disponibili anche se l'AI non risponde.</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              {recState==='idle' && <button className="dash-small-btn" onClick={startRecording}>Inizia Registrazione</button>}
              {recState==='recording' && <button className="dash-small-btn dash-small-btn--danger" onClick={stopRecording}>Stop</button>}
              {recState==='ready' && <>
                <button className="dash-small-btn" onClick={uploadRecording} disabled={recUploading || !recTranscript.trim()}>{recUploading ? 'Carico...' : 'Carica Fallback'}</button>
                <button className="dash-small-btn dash-small-btn--danger" onClick={resetRecording}>Reset</button>
              </>}
              <span style={{ fontSize:'.6rem', color: recState==='recording' ? '#ff6666':'#999' }}>Stato: {recState}</span>
            </div>
            {recState==='recording' && <div style={{ fontSize:'.55rem', color:'#ff9966' }}>Registrazione in corso... parla e poi premi Stop.</div>}
            {recState==='ready' && recBlob && (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <audio controls src={URL.createObjectURL(recBlob)} style={{ maxWidth:260 }} />
                <textarea value={recTranscript} onChange={e=>setRecTranscript(e.target.value)} placeholder='Trascrizione frase registrata...' rows={2} style={{ background:'#060606', color:'#ffd700', border:'1px solid #333', borderRadius:6, padding:6, fontSize:'.65rem' }} />
              </div>
            )}
          </div>
        )}
      </div>
      {/* Bulk transcript compilation panel */}
      {samples.length > 0 && (
        <div style={{ border:'1px solid #333', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:12, background:'rgba(0,0,0,0.35)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <strong style={{ color:'#ffd700' }}>Compilazione automatica transcript</strong>
            <div style={{ fontSize:'.6rem', color:'#999' }}>Incolla una riga per ogni file (ordine cronologico / nome)</div>
          </div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <label style={{ fontSize:'.7rem', display:'flex', flexDirection:'column', gap:4 }}>Start index
              <input type="number" min={1} value={bulkStartIndex} onChange={e=>setBulkStartIndex(parseInt(e.target.value||'1',10))} style={{ width:90, background:'#060606', color:'#fff', border:'1px solid #333', borderRadius:6, padding:6 }} />
            </label>
            <label style={{ fontSize:'.7rem', display:'flex', gap:6, alignItems:'center' }}>
              <input type="checkbox" checked={bulkOnlyEmpty} onChange={e=>setBulkOnlyEmpty(e.target.checked)} /> Solo slot vuoti
            </label>
            <button type="button" className="dash-small-btn" disabled={!bulkText.trim() || bulkApplying} onClick={applyBulkTranscripts}>{bulkApplying ? 'Applico...' : 'Applica'}</button>
            <button type="button" className="dash-small-btn" onClick={generateCSV} disabled={!samples.length}>Esporta CSV</button>
          </div>
          <textarea value={bulkText} onChange={e=>setBulkText(e.target.value)} placeholder={`Incolla qui le frasi (una per riga)\nLinea 1 -> sample #${bulkStartIndex}`} rows={6} style={{ width:'100%', background:'#050505', color:'#cff7ff', border:'1px solid #333', borderRadius:8, padding:10, fontSize:'.72rem', lineHeight:1.35, resize:'vertical' }} />
          <div style={{ fontSize:'.6rem', color:'#777' }}>L'ordine prende la lista campioni ordinata per createdAt. "Start index" = posizione (1-based) del primo file a cui assegnare la prima riga. "Solo slot vuoti" lascia inalterati transcript già presenti.</div>
        </div>
      )}
    </div>
  );
}

const th = { textAlign:'left', padding:'10px 8px', fontWeight:600, fontSize:'.7rem', letterSpacing:'.5px', color:'#ffd700', borderBottom:'1px solid #222' };
const td = { padding:'8px 8px', verticalAlign:'top' };

// Helpers bulk (outside component scope not needed -> keep inside file if we move later)

// NOTE: add function implementations after component definition using prototype patch style would require ref rework; simpler integrate inside component but for brevity kept here is fine.
