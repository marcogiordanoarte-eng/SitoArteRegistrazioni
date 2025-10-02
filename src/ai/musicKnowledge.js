// Knowledge base musicale sintetica (biografie e concetti) - contenuti descrittivi brevi e fattuali
// Espandibile in futuro (potremmo migrare a Firestore o a un indice vettoriale)

export const bios = {
  'johann sebastian bach': 'Johann Sebastian Bach (1685-1750) fu un compositore e organista barocco tedesco. Le sue opere consolidano il contrappunto e l\'uso architettonico dell\'armonia. Le Cantate, il Clavicembalo ben temperato e le Passioni mostrano rigore strutturale e profondità spirituale.',
  'antonio vivaldi': 'Antonio Vivaldi (1678-1741), violinista e compositore veneziano barocco. I suoi concerti, come Le Quattro Stagioni, esplorano colore timbrico e figurazioni violinistiche innovative con chiara forma ritornello.',
  'wolfgang amadeus mozart': 'Wolfgang A. Mozart (1756-1791) fu un prodigio del Classicismo. Sinfonie, opere e musica da camera combinano limpidezza formale, tensione drammatica e melodie memorabili. Stabilì un equilibrio ideale tra forma e espressione.',
  'ludwig van beethoven': 'Ludwig van Beethoven (1770-1827) traghetta dal Classicismo al Romanticismo. Le sue sinfonie e sonate espandono proporzioni e drammaticità, trasformando il linguaggio orchestrale ed esplorando percorsi emotivi intensi nonostante la sordità.',
  'frédéric chopin': 'Frédéric Chopin (1810-1849) legò la sua produzione quasi interamente al pianoforte. Notturni, mazurche e polacche fondono lirismo, ritmo danzante nazionale e armonie raffinate che influenzarono il Romanticismo europeo.',
  'franz liszt': 'Franz Liszt (1811-1886) virtuoso del pianoforte e innovatore. Creò il recital moderno, sperimentò il poema sinfonico e spinse tecnica e timbro pianistico verso orizzonti nuovi.',
  'claude debussy': 'Claude Debussy (1862-1918) associato all\'impressionismo musicale. Linguaggio basato su modi, pedali e timbri che evocano atmosfere sfumate, dissolvendo spesso la direzionalità tonale funzionale.',
  'igor stravinskij': 'Igor Stravinskij (1882-1971) rivoluzionò il ritmo e il colore orchestrale. Opere come La Sagra della Primavera introducono accenti irregolari, politonalità e energia percussiva che segnarono il Novecento.',
  'arnold schoenberg': 'Arnold Schoenberg (1874-1951) introdusse la dodecafonia per emancipare la dissonanza. Dal tardo Romanticismo passò a un linguaggio atonale sistematico che influenzò profondamente l\'avanguardia.',
  'miles davis': 'Miles Davis (1926-1991) trombettista innovatore in più ere del jazz: bebop, cool, modal, fusion. Album come Kind of Blue e Bitches Brew ridefiniscono spazi improvvisativi e timbriche elettriche.',
  'charlie parker': 'Charlie Parker (1920-1955) sassofonista alto faro del bebop. Linee rapide, cromatismi e sostituzioni armoniche raffinate che ampliarono il vocabolario jazz.',
  'john coltrane': 'John Coltrane (1926-1967) portò il sax tenore a nuove vette esplorando armonia ciclica (Giant Steps), modalità spirituale (A Love Supreme) e ricerca timbrica visionaria.',
  'duke ellington': 'Duke Ellington (1899-1974) pianista e bandleader. Espanse la big band jazz in laboratorio timbrico orchestrale con scrittura su misura per i suoi solisti.',
  'ella fitzgerald': 'Ella Fitzgerald (1917-1996) voce jazz cristallina, impeccabile senso dello swing e improvvisazione scat. Songbooks imprescindibili per lo standard jazz.',
  'louis armstrong': 'Louis Armstrong (1901-1971) elevò la tromba jazz e lo swing, portando il solo improvvisato in primo piano con fraseggio ritmico elastico e timbro riconoscibile.',
  'thelonious monk': 'Thelonious Monk (1917-1982) pianista compositore dallo stile percussivo e angolare. Voicings dissonanti, silenzi eloquenti e temi essenziali come Round Midnight.',
  'billie holiday': 'Billie Holiday (1915-1959) cantante jazz con fraseggio ritmico dietro al beat, timbro sofferto e capacità narrativa emotiva intensa.',
  'jimi hendrix': 'Jimi Hendrix (1942-1970) rivoluzionò la chitarra elettrica usando feedback, pedali e tecniche estese per timbri psichedelici e blues rock espanso.',
  'bob dylan': 'Bob Dylan (1941-) cantautore che fuse folk, rock e poesia surrealista, ridefinendo il songwriting come veicolo letterario.',
  'the beatles': "The Beatles (1960s) evolsero da pop melodico a studio band sperimentale: armonie vocali, forme ibride, innovazioni di produzione e influssi psichedelici.",
  'pink floyd': 'Pink Floyd esplorò rock psichedelico e progressive con strutture dilatate, sound design, concetti tematici e uso pionieristico dello studio.',
  'led zeppelin': 'Led Zeppelin unì blues amplificato, folk e sperimentazione timbrica definendo gran parte dell\'estetica hard rock.',
  'queen': 'Queen integrò rock teatrale, multitracking vocale, eclettismo stilistico e senso melodico immediato.',
  'nirvana': 'Nirvana (anni 90) catalizzò il grunge unendo raw energy punk, melodie malinconiche e dinamiche quiet-loud.',
  'radiohead': 'Radiohead fuse alternative rock, elettronica, poliritmie e sperimentazione timbrica creando un linguaggio emotivo e tecnologicamente avanzato.',
  'daft punk': 'Daft Punk definì parte dell\'house francese mescolando campionamenti filtrati, robotica estetica e groove disco-funk.',
  'aphex twin': 'Aphex Twin esplora elettronica sperimentale, IDM e ambient manipolando micro-dettagli ritmici e timbrici.',
  'kraftwerk': 'Kraftwerk pose le basi di elettronica minimale e techno: pattern ritmici meccanici, timbri sintetici puri e estetica futurista.',
  'brian eno': 'Brian Eno sviluppò il concetto di musica ambient come paesaggio sonoro modulare e generativo.',
  'david bowie': 'David Bowie reinventò identità e linguaggi pop/rock con ibridazioni teatrali, elettroniche e soul-art.',
  'björk': 'Björk combina voce espressiva, elettronica sperimentale, orchestrazioni e strumenti non convenzionali in estetica organico-digitale.',
  'beyonce': 'Beyoncé unisce R&B, pop e elementi hip hop con forte attenzione a vocalità, produzione moderna e tematiche identitarie.',
  'kanye west': 'Kanye West ha spinto la produzione hip hop verso approcci orchestrali, manipolazioni vocali e concetti album-centrici.',
  'drake': 'Drake miscela rap e canto melodico, accentuando mood atmosferici e introspezione emotiva nel mainstream.',
  'taylor swift': 'Taylor Swift evolve da country-pop a pop sintetico e folk alternando storytelling autobiografico e metamorfosi stilistica.'
};

export const genreInfo = {
  'classica': 'La musica classica occidentale attraversa periodi (Barocco, Classico, Romantico, Moderno) con evoluzione di forma, armonia e orchestrazione.',
  'jazz': 'Il jazz nasce dall\'incontro tra radici afroamericane, blues e ragtime: swing, improvvisazione, evoluzioni dal bebop al modal al fusion.',
  'rock': 'Il rock cresce da blues e rhythm & blues, enfatizzando chitarre elettriche, backbeat e varianti come progressive, hard, alternative.',
  'pop': 'Il pop privilegia accessibilità melodica, struttura strofa-ritornello e produzione curata orientata alla diffusione ampia.',
  'elettronica': 'L\'elettronica sfrutta sintetizzatori, campionamento e programmazione: ambient, techno, house, IDM, sperimentale.',
  'hip hop': 'Hip hop: rap ritmico su beat basati su campioni/drum machine, elementi di flow, storytelling e cultura urbana.'
};

export const theoryConcepts = [
  { re: /(scala|scale) (maggiore|maggiori)/, ans: 'Scala maggiore: intervalli T-T-S-T-T-T-S (es. Do: Do Re Mi Fa Sol La Si). Base per tonalità diatonica funzionale.' },
  { re: /(scala|scale).*(minore|minori)/, ans: 'Scale minori: naturale (T-S-T-T-S-T-T), armonica (alzato 7°), melodica ascendente (alzati 6° e 7°) discendente come naturale.' },
  { re: /accord(i|o).*(settima dominante|7\b)/, ans: 'Settima di dominante: fondamentale, terza maggiore, quinta giusta, settima minore (es. G7 in tonalità di Do) → tensione che risolve su I.' },
  { re: /cadenza (autentica|plagale|perfetta)/, ans: 'Cadenza autentica perfetta: V-I entrambi in stato fondamentale con tonica al soprano. Plagale: IV-I. Funzione: chiusura forte.' },
  { re: /(tempo|metrica|bpm|batt(iti|ute))/, ans: 'Il tempo organizza i battiti in misure (4/4, 3/4, 6/8). BPM definisce la velocità; suddivisioni interne caratterizzano stile e feel.' },
  { re: /modale|scala dorica|scala frigia|mixolidia/, ans: 'Modalità: Doria, Frigia, Lidia, Misolidia ecc. Offrono colori armonici senza la spinta tensione-risoluzione tonale classica.' },
  { re: /ii[- ]?v[- ]?i|2-5-1|251/, ans: 'Progressione II-V-I: asse fondamentale jazz/tonalità. II prepara V (dominante) → risoluzione su I (tonica). Base di molte armonizzazioni.' },
  { re: /poliritmia|polimetri?/, ans: 'Poliritmia: sovrapposizione di pattern con accenti diversi (es. 3 contro 2). Aumenta complessità e spinta ciclica.' }
];

// Periodi storici sintetici
export const periods = [
  { re: /barocc|1600|1700/, short: 'Periodo Barocco (~1600-1750): stile contrappuntistico, basso continuo, forme come fuga e concerto grosso.', deep: 'Periodo Barocco (~1600-1750): centralità del basso continuo come fondamento armonico, fioritura del contrappunto imitativo (Bach), sviluppo di cicli di danze in suite, nascita dell\'opera, concerto solistico (Vivaldi) e tensione retorica affettiva. Timbri: archi dominanti, organo/clavicembalo. Armonia funzionale si consolida.' },
  { re: /classic(ismo)?|classico/, short: 'Classicismo (~1750-1820): chiarezza formale (forma sonata), equilibrio e proporzione.', deep: 'Classicismo (~1750-1820): forma-sonata standardizza esposizione-sviluppo-ripresa, periodi simmetrici, equilibrio tematico. Espansione graduale della sinfonia e quartetto. Transizione verso intensità espressiva beethoveniana.' },
  { re: /romantic(ismo)?|romantic/, short: 'Romanticismo (XIX sec.): espansione espressiva, cromatismo crescente, forme flessibili.', deep: 'Romanticismo: soggettività, cromatismo che indebolisce la cadenza perfetta, poema sinfonico (Liszt), miniatura carattere (Chopin), leitmotiv (Wagner). Pianoforte laboratorio timbrico, orchestra si amplia.' },
  { re: /novecent|xx secolo|contemporane|modern/, short: 'Novecento/Moderno: sperimentazione ritmica, timbrica, atonalità, jazz, elettronica.', deep: 'Novecento: frattura linguistica con atonalità (Schoenberg), neoclassicismo (Stravinskij), esplorazioni timbriche impressioniste (Debussy), poi jazz, minimalismo, elettronica, ibridazioni globali fino alla post-modernità e contaminazioni cross-genere.' }
];

// Approfondimenti estesi (richiesti su domanda "approfondisci" o simili)
export const deepTheory = {
  'armonizzazione diatonica': 'Armonizzazione diatonica: costruzione di accordi sulle note della scala maggiore/minore. In Do maggiore: I Cmaj7, II Dm7, III Em7, IV Fmaj7, V G7, VI Am7, VII Bm7b5. Funzioni: T (I, VI), S (II, IV), D (V, VII). Permette progressioni funzionali (es. II-V-I).',
  'progressione ii-v-i': 'Progressione II-V-I: cardine jazz e tonalità. In Do: Dm7 (funzione pre-dominante) → G7 (dominante) → Cmaj7 (tonica). Estensioni: 9, 13 e sostituzione tritonale sul V per cromatismi.',
  'poliritmia': 'Poliritmia avanzata: strati ritmici simultanei con denominatori diversi (es. pattern 3:2, 5:4). Crea tensione ciclica e interplay. Usata in afro‑cuban, progressive rock, minimalismo e jazz contemporaneo.',
  'sintesi sonora': 'Sintesi sonora di base: sottrattiva (filtro su forme d\'onda ricche), additiva (somma di sinusoidi), FM (modulazione di frequenza per spettri complessi), wavetable (scan dinamico tabelle), granulare (nuvole microcampioni). Parametri: inviluppi ADSR, LFO per modulazioni periodiche.'
};

// Deep stacks (multi-livello) per "approfondisci ancora"
export const deepStacks = {
  'armonizzazione diatonica': [
    'Livello 1: Gradi e triadi diatoniche: I ii iii IV V vi vii° (in tonalità maggiore).',
    'Livello 2: Estensioni 7, 9, 11, 13 derivate dalla sovrapposizione di terze di scala.',
    'Livello 3: Funzioni secondarie (V/V, V/ii) e modulazioni pivot per espandere centri tonali.',
    'Livello 4: Sostituzioni cromatiche: prestito modale, cadenze ingannevoli e tritone sub.',
    'Livello 5: Reharm jazz: applicazione di progressioni cicliche (coltrane changes) e chord-scale approach.'
  ],
  'progressione ii-v-i': [
    'Livello 1: Struttura base II- V - I con voice leading discendente (7→3).',
    'Livello 2: Aggiunta estensioni naturali (9 su II, 13 su V).',
    'Livello 3: Sostituzione tritonale: sostituisci V con bII7 (Db7 in luogo di G7).',
    'Livello 4: Diminuiti passanti e approcci cromatici ai target chord tones.',
    'Livello 5: Superimposition lineare e pattern intervallari fuori dai chord tones per tensione controllata.'
  ],
  'poliritmia': [
    'Livello 1: 3:2 base (accenti ternari sopra pulsazione binaria).',
    'Livello 2: Sovrapposizione 4:3 e spostamenti metrici (metric displacement).',
    'Livello 3: Additivi (5+7) vs frazionari (12/8 percepito 3+3+2+2+2).',
    'Livello 4: Layer multipli (3:2 + 5:4) in ensemble contemporanei.',
    'Livello 5: Polimetria vs poliritmia: misure diverse simultanee vs accenti incrociati.'
  ],
  'sintesi sonora': [
    'Livello 1: Oscillatori basici (sine, saw, square) + filtro passa basso.',
    'Livello 2: Modulazione ampiezza (tremolo) e frequenza (vibrato) via LFO.',
    'Livello 3: FM ratio operatori e indice modulazione per complessità spettrale.',
    'Livello 4: Wavetable morph + modulazione posizione tavola.',
    'Livello 5: Granulare: densità, durata grani, spray temporale e random pitch.'
  ]
};

export function findPeriod(query) {
  const q = query.toLowerCase();
  for (const p of periods) if (p.re.test(q)) return p;
  return null;
}

export function findDeep(query) {
  const q = query.toLowerCase();
  if (/approfondisci|dettagli|spiega meglio|più dettagli|piu dettagli/.test(q)) {
    // Trova chiave deep corrispondente
    for (const key of Object.keys(deepTheory)) {
      if (q.includes(key.split(' ')[0])) return deepTheory[key];
    }
  }
  // anche request diretta
  for (const key of Object.keys(deepTheory)) {
    if (q.includes(key)) return deepTheory[key] + ' (Puoi chiedermi di sintetizzare o altri approfondimenti.)';
  }
  return null;
}

export function getInitialDeepTopic(query) {
  const q = query.toLowerCase();
  for (const key of Object.keys(deepStacks)) {
    if (q.includes(key.split(' ')[0])) return { topic: key, index: 0, text: deepStacks[key][0] };
  }
  return null;
}

export function getNextDeep(topic, currentIndex) {
  const arr = deepStacks[topic];
  if (!arr) return null;
  const next = currentIndex + 1;
  if (next >= arr.length) return { done: true, text: 'Hai raggiunto il livello massimo di approfondimento per questo argomento.' };
  return { topic, index: next, text: arr[next] };
}

export function findBio(query) {
  const q = query.toLowerCase();
  const keys = Object.keys(bios);
  const k = keys.find(k => q.includes(k));
  return k ? bios[k] : null;
}

export function findGenre(query) {
  const q = query.toLowerCase();
  const g = Object.keys(genreInfo).find(k => q.includes(k));
  return g ? genreInfo[g] : null;
}

export function findTheory(query) {
  const q = query.toLowerCase();
  for (const t of theoryConcepts) { if (t.re.test(q)) return t.ans; }
  return null;
}
