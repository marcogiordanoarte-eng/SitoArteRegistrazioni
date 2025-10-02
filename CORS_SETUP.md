# Guida rapida CORS per Firebase Storage

Questa procedura aggiorna le regole CORS del bucket di Storage in modo che i preflight (OPTIONS) tornino 200/204, sbloccando gli upload dal browser (localhost:3000).

1) Installare gsutil (parte di Google Cloud SDK)
- macOS (Homebrew):
  - brew install --cask google-cloud-sdk
  - gcloud init
  - gcloud auth login

2) Impostare il progetto corretto (ID: arteregistrazioni-2025)

   gcloud config set project arteregistrazioni-2025

3) Applicare la configurazione CORS al bucket (arteregistrazioni-2025.appspot.com)

   gsutil cors set storage.cors.json gs://arteregistrazioni-2025.appspot.com

4) Verifica
- Attendere 2-5 minuti di propagazione.
- Fare un preflight di prova (oppure usare il browser DevTools > Network):

   curl -i -X OPTIONS 'https://firebasestorage.googleapis.com/v0/b/arteregistrazioni-2025.appspot.com/o?name=gallery%2Ftest.jpg' \
     -H 'Origin: http://localhost:3000' \
     -H 'Access-Control-Request-Method: POST' \
     -H 'Access-Control-Request-Headers: content-type,x-goog-upload-protocol,x-goog-upload-command,x-goog-upload-file-name,x-goog-upload-header-content-length,x-firebase-appcheck'

Dovresti ricevere 200/204 e intestazioni Access-Control-Allow-*.

Note importanti
- Se App Check è in enforcement, assicurati che la tua app inizializzi App Check PRIMA di Storage e che la reCAPTCHA Site Key includa "localhost" tra i domini autorizzati.
- Estensioni, VPN, proxy o DNS possono ancora interferire. Se persiste il problema, prova hotspot o cambia DNS (1.1.1.1 e 8.8.8.8).
