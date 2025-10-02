# Deploy su www.arteregistrazioni.com (React SPA)

Questa guida spiega come pubblicare il sito in produzione su un hosting Apache (es. public_html) con routing client-side (SPA), HTTPS e www forzati.

## 1) Build di produzione

Esegui la build dal root del progetto (dove c'è `package.json`). In genere:

- npm: `npm run build`
- yarn: `yarn build`

Output previsto:
- Create React App: cartella `build/`
- Vite: cartella `dist/`

## 2) Caricamento su hosting

- Carica i file della build nella root pubblica del dominio (`public_html`, `www`, `htdocs`).
- Assicurati che `index.html` sia nella root pubblica.
- Mantieni la struttura delle cartelle (`static/`, `assets/`, etc.).
- Carica anche il file `.htaccess` fornito qui.

## 3) .htaccess per SPA + HTTPS + www

Copia il contenuto di `.htaccess` (in questa repo) nella root pubblica.

```
RewriteEngine On

# Forza HTTPS e www
RewriteCond %{HTTPS} !=on [OR]
RewriteCond %{HTTP_HOST} !^www\. [NC]
RewriteRule ^ https://www.arteregistrazioni.com%{REQUEST_URI} [L,R=301]

# Se il file/cartella esiste, servilo
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule - [L]

# Fallback SPA: tutto a index.html
RewriteRule ^ index.html [L]

<IfModule mod_headers.c>
  <FilesMatch "\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ttf|eot)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "index\.html$">
    Header set Cache-Control "no-store, max-age=0"
  </FilesMatch>
</IfModule>
```

Se richiesto dal provider, aggiungi `RewriteBase /` subito dopo `RewriteEngine On`.

## 4) Verifiche post-pubblicazione

Apri e prova direttamente (no 404 grazie al fallback):
- https://www.arteregistrazioni.com/
- https://www.arteregistrazioni.com/buy
- https://www.arteregistrazioni.com/pagamento-esempio
- una pagina dettaglio di un genere (prezzi/pulsanti)
- https://www.arteregistrazioni.com/termini
- https://www.arteregistrazioni.com/privacy
- https://www.arteregistrazioni.com/licenza
- https://www.arteregistrazioni.com/contatti

I pulsanti devono navigare subito (usiamo `window.location.assign`) e aprirsi correttamente su iOS/desktop.

## 5) Invio info a Stripe

Dopo che il sito è live e raggiungibile:
- Home: https://www.arteregistrazioni.com/
- Buy: https://www.arteregistrazioni.com/buy
- Esempio pagamento: https://www.arteregistrazioni.com/pagamento-esempio
- Termini: https://www.arteregistrazioni.com/termini
- Privacy: https://www.arteregistrazioni.com/privacy
- Licenza: https://www.arteregistrazioni.com/licenza
- Contatti: https://www.arteregistrazioni.com/contatti
- (Opzionale) URL dettaglio genere con prezzi e pulsanti attivi

## 6) Assistenza

Se apri in VS Code la root del progetto (così vedo `package.json`), posso eseguire la build e fornirti un pacchetto `.zip` pronto per l'upload. In alternativa, carica tu i file generati come sopra e fammi sapere quando è online per un controllo finale.
