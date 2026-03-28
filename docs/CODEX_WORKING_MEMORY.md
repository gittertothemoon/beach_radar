# CODEX Working Memory

Last update: 2026-03-28 (Europe/Rome)

## Obiettivo condiviso
- Massimo livello su design, funzionalita', affidabilita' reale.
- Zero regressioni: ogni intervento deve preservare web + mobile.
- Qualita' verificata con check tecnici e test, non solo percezione.

## Preferenze operative utente
- Evitare ripetizioni: mantenere memoria aggiornata del progetto.
- Miglioramento continuo ad ogni task.
- Focus su risultato concreto e funzionante.
- Per i rilasci mobile: Codex gestisce il flusso tecnico completo senza far ripetere istruzioni.
- Fonte ufficiale regole release: `docs/CODEX_RELEASE_MEMORY.md`.
- Regola autorita suprema: aggiornare sempre le memorie a fine task (`docs/CODEX_MEMORY_PROTOCOL.md`).

## Mappa rapida progetto
- Web app principale: `src/` (Vite + React + TypeScript).
- API serverless: `api/` (Vercel Functions + Supabase).
- Landing pubblica: `public/landing/` (static + routing Vercel su `/landing/`).
- Mobile: `mobile/` (Expo, apre direttamente `/app/` via WebView).
- Test E2E: `tests/` (Playwright).

## Baseline tecnica corrente
- Branch: `main` pulito.
- `npm run check`: PASS.
- `npm run build`: PASS.
- `npm run test:app`: PASS (10 passed, 2 skipped env-dependent).

## Problemi aperti (priorita')
1. Auth E2E dipendente da policy ambiente:
- il flusso "signup -> sessione immediata" puo' non essere disponibile (provider/policy).
- il test ora valida fallback coerente su `/register` senza bloccare la suite.

## Regole di lavoro (anti-regressione)
1. Prima di chiudere un task: `check` + `build` + test mirati.
2. Se cambia routing/contratto API: aggiornare codice + test nello stesso task.
3. Validare sempre impatto web desktop, web mobile e app mobile.
4. Nessuna modifica "solo estetica" se introduce rischio funzionale.
5. Dopo debug complesso risolto: aggiornare `docs/CODEX_ERROR_MEMORY.md` con errore, causa radice, regola permanente.
6. Ogni task termina solo dopo aggiornamento memoria obbligatorio, come da `docs/CODEX_MEMORY_PROTOCOL.md`.

## Prossimi step consigliati
1. Se vuoi coverage piena del test signup-session, definire credenziali/progetto test dedicato.
2. Tenere la suite `test:app` come gate prima di ogni rilascio.
3. Prossimo sviluppo su feature/design con baseline verde.

## Log sintetico
- 2026-03-28: introdotta regola autorita suprema di aggiornamento memoria a fine task (`docs/CODEX_MEMORY_PROTOCOL.md`).
- 2026-03-28: aggiunta memoria persistente release mobile in `docs/CODEX_RELEASE_MEMORY.md` con regole vincolanti OTA vs store.
- 2026-03-25: creato registro errori persistente `docs/CODEX_ERROR_MEMORY.md` e collegato alle regole operative.
- 2026-03-24: completata ricognizione repository + baseline quality.
- 2026-03-24: allineati test auth-resume a routing reale (`/register`) e fix selettore consenso privacy.
- 2026-03-24: stabilizzata la suite auth-resume su ambienti con policy signup variabile.
- 2026-03-24: verifiche finali PASS (`npm run check`, `npm run test:app`).
- 2026-03-24: implementata nav a 3 sezioni nel BottomSheet (`Mappa`, `Profilo`, `Chatbot`) con integrazione login/profilo e placeholder chatbot.
- 2026-03-24: verifiche post-feature PASS (`npm run check`, `npm run test:app`).
