# Note Sicurezza & Policy

## Obiettivi
- Minimizzare dati sensibili in Firestore (solo URL, niente blob grossi)
- Limitare upload a utenti autenticati
- Rendere la dashboard accessibile solo agli admin
- Mantenere lettura pubblica di immagini/audio (SEO + semplicità)

## Stato Attuale
| Area | Strategia |
|------|-----------|
| Auth | Email/Password con whitelist UID |
| Admin gating | `ADMIN_UIDS` lato client (config.js) |
| Storage | Lettura pubblica / scrittura autenticati |
| Firestore artisti | Lettura pubblica / scrittura autenticati |
| Upload pattern | Base64 in memoria → Storage → URL in Firestore |
| Timeout upload | 60s + retry sequenziali |
| Player audio | HTML5 `<audio>` se bottone Play presente |

## Rischi Residui
| Rischio | Impatto | Mitigazione futura |
|---------|---------|--------------------|
| Whitelist client alterabile | Media | Passare a custom claims + regole server |
| Upload file malevoli (script/EXE) | Basso (non serviti come eseguibili) | Validare MIME / limitare estensioni |
| URL pubblici indicizzabili | Basso | Se necessario passare a tokenized URL / redirect layer |
| File orfani (non referenziati) | Spazio | Script di pulizia periodico |

## Roadmap Sicurezza
1. Custom Claims admin
2. Validazione MIME (client + eventuale funzione Cloud)
3. Rate limiting API (quando introduci funzioni scrittura server-side)
4. Download protetto con token (post-acquisto / paywall reale)
5. Log audit (Firestore collezione `audit_logs` per tracking cambi artisti)

## Esempio Regole con Custom Claim futuro
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.role == 'admin';
    }
  }
}
```

## Consigli Operativi
- Mantieni file immagini < 2MB, audio compressi.
- Usa nomi file consistenti: `artisti/{artistId}/cover.jpg`, `artisti/{artistId}/steps/step1.jpg`.
- Evita spazi nei nomi (usa trattini o underscore).

## Pulizia Periodica Suggerita
1. Esporta lista URL da Firestore.
2. Lista oggetti Storage via script Admin SDK.
3. Cancella quelli non referenziati.

## Script Bozza Listing (Node Admin)
```js
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import serviceAccount from './serviceAccountKey.json' assert { type: 'json' };

initializeApp({ credential: cert(serviceAccount) });

async function listAll(prefix=''){ // prefix opzionale
  const [files] = await getStorage().bucket().getFiles({ prefix });
  console.log('Tot file:', files.length);
  files.forEach(f => console.log(f.name));
}
listAll('artisti/');
```

---
Aggiornamento: (inserire data)
