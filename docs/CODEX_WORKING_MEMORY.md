# CODEX Working Memory

Last update: 2026-03-28 18:22 (Europe/Rome)

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
- 2026-03-28: stabilizzato bootstrap iOS debug contro errore `No script URL provided`: porta Metro dinamica + sync `RCT_jsLocation` in `scripts/run-mobile-ios-dev.mjs`, fallback esplicito bundle URL in `mobile/ios/Where2Beach/AppDelegate.swift`; validato con build iOS riuscita e avvio app su simulator senza red screen.
- 2026-03-28: introdotto tutorial lock completo (niente tap diretti sulla WebView durante onboarding) con interazioni solo via card: step ricerca con input citta guidato interno, step ONDA con azioni controllate (`Apri ONDA` + nuovo step `Torna a Mappa`) e aggiornamento sequenza step/pose in `mobile/src/components/WebSurface.tsx`.
- 2026-03-28: affinata logica step interattivi tutorial ONDA: rimosso auto-advance immediato su tap (search/ONDA ora completano lo step ma richiedono pressione esplicita di `Continua`), con copy hint aggiornato per evitare salti percepiti come confusi in `mobile/src/components/WebSurface.tsx`.
- 2026-03-28: fix interazione step ricerca tutorial ONDA (overlay root `pointerEvents=\"box-none\"`, rimozione touch-blocker fullscreen) + hardening listener interazione (`pointerdown`/`touchstart`) e sequenza pose per-step senza duplicati consecutivi (`profile -> idle`) in `mobile/src/components/WebSurface.tsx`.
- 2026-03-28: upgrade tutorial ONDA "premium": step interattivi con completamento reale (search + ONDA), auto-advance controllato, spotlight con scroll guidato verso target fuori viewport e finale rinforzato con CTA "Inizia a esplorare" in `mobile/src/components/WebSurface.tsx`.
- 2026-03-28: fix bootstrap mobile quando `/api/app-access` risponde `missing_env`: in base URL locale bypass del gate server-side (apertura diretta `/app/?native_shell=1`) + gestione `onHttpError` con messaggio esplicito backend in `WebSurface` (`mobile/src/config/env.ts`, `mobile/src/screens/AppWebScreen.tsx`, `mobile/src/components/WebSurface.tsx`).
- 2026-03-28: aggiunto gate "DOM ready" prima di mostrare il tutorial ONDA (bridge `w2b-tour-ready` via WebView) e alleggerito il dim overlay per evitare percezione schermo vuoto/nero durante gli step (`mobile/src/components/WebSurface.tsx`).
- 2026-03-28: fix overlay tutorial per visibilita' reale della WebView sotto spotlight (backdrop segmentato con "hole" trasparente), aggiunti stili mancanti `tutorialBackdrop*` e rimosso riempimento blu interno del focus in `mobile/src/components/WebSurface.tsx`.
- 2026-03-28: corretto timing tutorial ONDA per mostrarlo solo quando la WebView e' realmente pronta (`hasLoadedOnce && !loading`) e ridotta opacita' backdrop per mantenere visibile l'app sotto durante gli step in `mobile/src/components/WebSurface.tsx`.
- 2026-03-28: fix errore console ripetuto `Style property 'width' is not supported by native animated module` nella transizione tutorial (animazione pulse spostata su `useNativeDriver: false`) in `mobile/src/components/WebSurface.tsx`.
- 2026-03-28: fix warning/error ripetuti nella transizione step tutorial (rimosso doppio `translateY` sull'avatar ONDA con merge via `Animated.add`) in `mobile/src/components/WebSurface.tsx`.
- 2026-03-28: semplificata la riga header del tutorial da testo descrittivo a progressivo neutro (`Passo X di 6`) e alleggerito lo stile per ridurre effetto “chip” in `mobile/src/components/WebSurface.tsx`.
- 2026-03-28: riscritto il copy del tutorial ONDA in tono piu user-friendly e inclusivo (obiettivo app esplicito, linguaggio semplice per tutte le eta, CTA piu chiare e coinvolgenti) in `mobile/src/components/WebSurface.tsx`.
- 2026-03-28: rimossi aura/cerchio attorno a ONDA nel tutorial e rifinito scontorno PNG `onda-*` con despill per eliminare residui bianchi sui bordi (`mobile/src/components/WebSurface.tsx`, `mobile/assets/tutorial/`).
- 2026-03-28: refactor avatar tutorial mobile a pose-per-step con crossfade (no frame-loop), nuovo set ONDA dedicato trasparente (`onda-*`) e target dinamico anti-collisione con card (`mobile/src/components/WebSurface.tsx`, `mobile/assets/tutorial/`).
- 2026-03-28: restyling ONDA tutorial mobile con avatar hero multi-frame, movimento dinamico per step e composizione senza box fisso (`mobile/src/components/WebSurface.tsx`, `mobile/assets/tutorial/onda-1..5.png`).
- 2026-03-28: implementato onboarding mobile first-run guidato da avatar ONDA con spotlight animato su WebView, step interattivi e persistenza completamento (`mobile/src/components/WebSurface.tsx`, `mobile/src/screens/AppWebScreen.tsx`, `mobile/src/services/onboarding.ts`).
- 2026-03-28: introdotta regola autorita suprema di aggiornamento memoria a fine task (`docs/CODEX_MEMORY_PROTOCOL.md`).
- 2026-03-28: aggiunta memoria persistente release mobile in `docs/CODEX_RELEASE_MEMORY.md` con regole vincolanti OTA vs store.
- 2026-03-25: creato registro errori persistente `docs/CODEX_ERROR_MEMORY.md` e collegato alle regole operative.
- 2026-03-24: completata ricognizione repository + baseline quality.
- 2026-03-24: allineati test auth-resume a routing reale (`/register`) e fix selettore consenso privacy.
- 2026-03-24: stabilizzata la suite auth-resume su ambienti con policy signup variabile.
- 2026-03-24: verifiche finali PASS (`npm run check`, `npm run test:app`).
- 2026-03-24: implementata nav a 3 sezioni nel BottomSheet (`Mappa`, `Profilo`, `Chatbot`) con integrazione login/profilo e placeholder chatbot.
- 2026-03-24: verifiche post-feature PASS (`npm run check`, `npm run test:app`).
