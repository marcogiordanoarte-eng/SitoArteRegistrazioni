Arte Registrazioni – Dashboard (Admin + Artista)

Panoramica rapida delle funzioni attive e delle variabili ambiente utili per sviluppo e manutenzione.

## Cosa c’è qui

- Dashboard Admin completa per:
  - Creare/Modificare/Eliminare artisti
  - Gestire credenziali artista (email/password, invio reset)
  - Impostare codice di login artista e link diretto alla pagina di accesso
  - Gestire Buy Music, Podcast, Countdown, Festival, Video Studio, Video Logo
- Dashboard Artista (self-service):
  - Editor identico a “Modifica artista” in admin, con due eccezioni:
    - Le 3 immagini “steps” iniziali sono nascoste
    - Il campo “Stripe Payment Link” a livello di album è nascosto

## Regole di collegamento profilo artista ↔ account

Quando l’artista accede alla propria Dashboard, il profilo viene risolto in quest’ordine:
1) Documento con id == uid dell’utente autenticato
2) Documento con campo authUid == uid dell’utente
3) Documento con campo loginEmail == email utente (lowercase)
4) Documento con campo email == email utente (lowercase)

Se il profilo viene trovato ma non ha ancora authUid, viene scritto automaticamente authUid = uid. L’artista può così modificare solo il proprio profilo.

Salvataggio resiliente (artist self):
- Primo tentativo: scrive sul documento risolto (docId trovato con le regole sopra)
- Fallback: se non permesso, salva/merge sul documento con id = uid (e mostra “Profilo migrato sul tuo account”)

## Pulizia duplicati (Admin)

Non c’è deduplica automatica. In “Gestione Artisti” usa il pulsante “Elimina” accanto al profilo non più valido. L’attuale lista è già ordinabile e ogni riga ha:
- Modifica (apre editor)
- Elimina (richiede conferma e cancella definitivamente il documento)

Suggerimento: mantieni come “buono” il documento che ha authUid o quello collegato alla nuova email artista, poi elimina l’altro.

## Variabili ambiente (dashboard/.env.local)

Le più rilevanti:

- REACT_APP_ENABLE_APPCHECK=true
- REACT_APP_RECAPTCHA_PROVIDER=enterprise (oppure v3)
- REACT_APP_RECAPTCHA_ENTERPRISE_SITE_KEY=... (o REACT_APP_RECAPTCHA_V3_SITE_KEY)
- REACT_APP_UPLOAD_SIMPLE=true (riduce problemi CORS/preflight per upload)
- Emulators (da lasciare false se si lavora su servizi reali):
  - REACT_APP_USE_STORAGE_EMULATOR=false
  - REACT_APP_USE_FIRESTORE_EMULATOR=false
  - REACT_APP_USE_AUTH_EMULATOR=false

Nota: se abiliti Storage Emulator ma non Firestore Emulator, il sistema avvisa per evitare di salvare URL locali su Firestore di produzione.

## Flussi principali

1) Creazione credenziali artista (Admin):
   - Inserisci email in “Accesso Dashboard Artista” → il sistema indica se l’utente Auth esiste
   - Se non esiste, “Crea utente” (opzione: invia automaticamente email di reset)
   - Premi “Salva” nella scheda artista per memorizzare loginEmail/codice

2) Accesso artista (pagina /artist-login):
   - L’artista entra con email/password + codice univoco artista
   - Alla prima apertura della Dashboard, se manca authUid, viene scritto sul documento

3) Salvataggio contenuti (Artista e Admin):
   - Upload a Firebase Storage al momento del salvataggio (immagini/video/audio/zip)
   - Gli URL https vengono salvati su Firestore; conversioni da gs:// sono gestite automaticamente

## Messaggi e casi limite

- “Nessun profilo artista collegato…” → non trovato con le regole sopra
- “Permesso negato. Contatta l’admin.” → regole di sicurezza impediscono la scrittura sul doc risolto; il fallback migra sul doc uid
- “Salvato con successo. (Profilo migrato sul tuo account)” → scritto/mergiato su doc id = uid
- Banner verde in alto → indica come è stato trovato/collegato il profilo (authUid/email)

## Build & run (nota)

Progetto CRA con react-scripts. Porta dev: 3001. Assicurati che .env.local sia presente e popolato. In produzione, App Check va configurato con domini pubblici autorizzati.

## Cambi recenti rilevanti (ottobre 2025)

- Dashboard artista allineata al modulo editor admin con “hideSteps / hideStripePaymentLink”
- Mapping robusto (uid → authUid → loginEmail → email) con write-back di authUid
- Salvataggio resiliente con fallback a doc uid
- Rimosso UI di deduplica automatica, lasciato “Elimina” manuale in lista
