# CODEX Error Memory

Last update: 2026-03-25 (Europe/Rome)

## Scopo
- Tenere una memoria operativa degli errori commessi durante debug complessi.
- Trasformare ogni errore risolto in una regola concreta da riusare.
- Ridurre la probabilita' di ripetere gli stessi errori.

## Protocollo operativo (obbligatorio)
1. Prima di iniziare task complessi: leggere questo file.
2. Durante debug: annotare ipotesi, prove e segnali scartati.
3. Dopo la risoluzione: aggiungere una nuova voce nella sezione `Lessons`.
4. Prima di chiudere task: verificare che sia presente una `Regola permanente` azionabile.

## Template nuova voce
```md
### YYYY-MM-DD - Titolo breve
- Contesto:
- Errore commesso:
- Segnale ignorato:
- Causa radice:
- Fix applicata:
- Regola permanente:
- Verifica eseguita:
- Guardrail futuro (test/check/alert):
```

## Lessons
### 2026-03-25 - iOS WebView offline per server locale non avviato
- Contesto: avvio simulatore iOS con mobile che punta a `EXPO_PUBLIC_BASE_URL=http://192.168.1.8:5173`.
- Errore commesso: avviare l'app iOS senza verificare prima che frontend (`:5173`) e API (`:3000`) fossero up.
- Segnale ignorato: errore WebView `NSURLErrorDomain -1004` ("Impossibile connettersi al server").
- Causa radice: dipendenza runtime non soddisfatta (URL locale configurato ma servizi non in ascolto).
- Fix applicata: avviati `npm run dev -- --host 0.0.0.0 --port 5173` e `vercel dev --listen 3000 --yes`, poi reload app.
- Regola permanente: se `mobile/.env` usa base URL locale, prima del reload iOS eseguire sempre health-check su `5173` e `3000`.
- Verifica eseguita: `curl` su homepage (`200`) e su `/api/app-access` (`302`), poi reload Metro riuscito.
- Guardrail futuro (test/check/alert): checklist pre-avvio obbligatoria `lsof :5173`, `lsof :3000`, `curl http://<base-url>`.

### 2026-03-25 - Apertura landing sbagliata (root invece di `/landing/`)
- Contesto: richiesta di aprire la landing in uso su `www.where2beach.com`.
- Errore commesso: aprire entrypoint di dev non allineati al routing reale della produzione.
- Segnale ignorato: in produzione la root redirige a `/landing/`.
- Causa radice: uso di flussi di dev multipli senza vincolare il path canonico.
- Fix applicata: `landing:dev` aggiornato ad aprire sempre `/landing/` con runner locale dedicato.
- Regola permanente: non usare mai la root come landing; usare solo `/landing/` come path canonico.
- Verifica eseguita: `/` => `307` verso `/landing/`, `/landing/` => `200`.
- Guardrail futuro (test/check/alert): dopo ogni avvio landing eseguire check automatico redirect root -> `/landing/`.

### 2026-03-24 - Assunzione fragile su signup immediato
- Contesto: test auth E2E su ambienti con policy signup diverse.
- Errore commesso: assumere sessione immediata sempre disponibile dopo signup.
- Segnale ignorato: comportamenti diversi tra ambienti/progetti.
- Causa radice: dipendenza non esplicitata da policy/provider esterni.
- Fix applicata: fallback coerente sul flusso `/register` quando la sessione non e' disponibile.
- Regola permanente: nei test auth non assumere comportamento unico; modellare fallback espliciti.
- Verifica eseguita: `npm run test:app` con scenario auth-resume.
- Guardrail futuro (test/check/alert): mantenere test che validi sia path principale sia fallback.

### 2026-03-24 - Selettore E2E troppo fragile
- Contesto: consenso privacy nel flusso auth.
- Errore commesso: usare selettore non robusto alla variazione UI.
- Segnale ignorato: flakiness intermittente e mismatch tra label/DOM.
- Causa radice: accoppiamento del test a dettagli di presentazione.
- Fix applicata: aggiornato selettore su ancoraggio stabile del flusso reale.
- Regola permanente: preferire sempre selettori semantici e stabili (`data-testid` o ruoli affidabili).
- Verifica eseguita: `npm run test:app` dopo fix selettore.
- Guardrail futuro (test/check/alert): introdurre convenzione unica per test selectors nei punti critici.
