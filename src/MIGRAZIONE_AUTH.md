# Migrazione Autenticazione Email/Password + Dashboard Admin

## Obiettivo
Passare da accesso non autenticato / potenziale uso anonimo a un sistema con:
- Registrazione e login email/password
- Accesso dashboard solo ad admin (whitelist UID per ora)
- Media caricati su Firebase Storage con URL pubblici solo in lettura
- Upload consentiti solo a utenti autenticati

## Componenti principali
| File | Ruolo |
|------|-------|
| `components/firebase.js` | Init Firebase + helper auth (registerUser, loginUser, logoutUser) |
| `components/AuthContext.js` | Stato utente + metodi signup/login/logout |
| `components/config.js` | Array `ADMIN_UIDS` con gli UID abilitati |
| `components/App.js` | Routing principale + `PrivateRoute` |
| `src/App.js` | Bridge che re-esporta `components/App.js` |
| `components/Login.js` | UI login/registrazione + redirect condizionato |
| `components/Dashboard.js` | CRUD artisti (solo admin) |
| `components/ArtistPageEditable.js` | Upload immagini/audio con conversione base64 → Storage URL |
| `components/Login.css` | Stili pagina login |

## Flusso utente
1. Utente visita `/login`
2. Se si registra: viene creato l'account e autenticato
3. Se UID è in `ADMIN_UIDS` → redirect `/dashboard`
4. Se non è admin → rimane su login con messaggio
5. Admin può creare/modificare artisti (upload media)
6. Logout libera la sessione

## Whitelist Admin
Modifica `components/config.js`:
```js
export const ADMIN_UIDS = [
  "QKWl9UFABzOOfXWwLzzmvtnnjGt1",
  "ALTRI_UID"
];
```
UID recuperato da Firebase Console → Authentication → Utenti.

## Regole Storage (applicate)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;          // immagini/audio pubblici
      allow write: if request.auth != null; // upload solo utenti loggati
    }
  }
}
```

## Regole Firestore suggerite
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artisti/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Upload pipeline (riassunto)
- Stato locale conserva file in base64
- `ensureUploaded()` effettua upload sequenziale (timeout 60s, retry)
- Converte ogni base64 in URL HTTPS pubblico (`getDownloadURL`)
- Firestore salva solo URL puliti

## Test Checklist
| Scenario | Esito atteso |
|----------|--------------|
| Non loggato → /dashboard | Redirect /login |
| Registrazione nuova | OK + resta sul login se non admin |
| Aggiunta UID a whitelist | Reload → entra in /dashboard |
| Upload immagine loggato | Successo |
| Upload da anonimo | Permission denied |
| Accesso URL immagine pubblico | Funziona |
| Logout admin | Torna / o /login se navighi a /dashboard |

## Problemi comuni
| Problema | Causa | Soluzione |
|----------|-------|-----------|
| useAuth outside provider | Usato vecchio `src/App.js` | Bridge creato |
| Redirect a home dopo login non admin | Logica precedente | Ora rimane su /login |
| Errore regole Storage | Copia su una riga | Incolla blocco formattato |
| Upload lento | Rete / file troppo grande | Retry + ottimizza dimensioni |

## Evoluzioni Future
- Custom Claims admin (rimuovere whitelist client)
- Ruoli granulari (editor / viewer)
- Firma temporanea per download protetti
- Barra progresso per singolo file

## Aggiunta admin via Custom Claim (schema futuro)
```js
// (Da eseguire con Admin SDK in ambiente server/Cloud Function)
admin.auth().setCustomUserClaims(uid, { role: 'admin' });
```
Regole allora diventano:
```allow write: if request.auth.token.role == 'admin';```

## Manutenzione periodica
- Rimuovere UID non più autorizzati
- Verificare storage per file orfani
- Aggiornare dipendenze Firebase

---
Ultimo aggiornamento automatico: (inserire data)
