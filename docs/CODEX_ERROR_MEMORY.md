# CODEX Error Memory

Last update: 2026-04-11 (Europe/Rome)

## Scopo
- Tenere una memoria operativa degli errori commessi durante debug complessi.
- Trasformare ogni errore risolto in una regola concreta da riusare.
- Ridurre la probabilita' di ripetere gli stessi errori.

## Protocollo operativo (obbligatorio)
1. Prima di iniziare task complessi: leggere questo file.
2. Durante debug: annotare ipotesi, prove e segnali scartati.
3. Dopo la risoluzione: aggiungere una nuova voce nella sezione `Lessons`.
4. Prima di chiudere task: verificare che sia presente una `Regola permanente` azionabile.
5. Chiusura task valida solo dopo sync memoria secondo `docs/CODEX_MEMORY_PROTOCOL.md`.

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
### 2026-04-11 - `npm run check` inquinato da `.claude/worktrees/*`
- Contesto: ricognizione stato repository dopo sessioni con Claude Code e worktree locali presenti sotto `.claude/worktrees/`.
- Errore commesso: leggere il risultato di `npm run check` come stato reale della codebase principale senza separare il codice sorgente da copie/worktree di supporto.
- Segnale ignorato: centinaia di errori ESLint puntavano a percorsi `.claude/worktrees/...` invece che ai file attivi nel root del progetto.
- Causa radice: lo script `lint` usa `eslint .` e il pattern corrente non esclude automaticamente le directory di worktree Claude.
- Fix applicata: validazione stato reale fatta con check mirati sul codice attivo (`npm run typecheck`, `npm run mobile:typecheck`, `npm run build`) e interpretazione del lint globale come non affidabile finche' non si esclude `.claude/worktrees/*`.
- Regola permanente: quando sono presenti worktree/repliche locali, ogni gate qualita' deve distinguere esplicitamente `codice attivo` vs `workspace ausiliari` prima di classificare un task come rotto.
- Verifica eseguita: `npm run check` (fallito su `.claude/worktrees/*`) + `npm run typecheck` PASS + `npm run mobile:typecheck` PASS + `npm run build` PASS.
- Guardrail futuro (test/check/alert): escludere `.claude/worktrees/**` dai check globali o eseguire lint con target esplicito ai path sorgente (`src`, `api`, `scripts`, `tests`, `mobile`).

### 2026-03-29 - IPA store/device installata sul simulatore ma non launchabile
- Contesto: richiesta di misurare il boot della build 19 partendo dall'artefatto `.ipa` fornito dall'utente.
- Errore commesso: rischio di considerare l'installazione riuscita via `simctl install` come prova sufficiente che la build store sia eseguibile e quindi misurabile sul simulatore.
- Segnale ignorato: il Mach-O della build 19 e' `arm64` con `LC_BUILD_VERSION platform IOS`, non `iOS Simulator`; il launch effettivo fallisce subito con diniego SpringBoard.
- Causa radice: su Apple Silicon un'app device puo' entrare nel catalogo app del simulatore, ma non per questo e' compatibile con il runtime simulator o avviabile per misure di boot.
- Fix applicata: verificato metadata build (`CFBundleVersion=19`, `CFBundleShortVersionString=1.0.1`, `bundle id com.where2beach.mobile`), tentato install e launch reali, classificato blocco come `non misurabile su questa macchina`; controllo anche su device fisici collegati (`xcrun devicectl list devices`) con esito nessun device.
- Regola permanente: per misurare una build store specifica non fermarsi mai a `ipa valida` o `install ok`; servono sempre `launch riuscito` sul simulatore oppure un device fisico con quella build.
- Verifica eseguita: unzip IPA, `PlistBuddy`, `file`, `vtool`/`otool`, `simctl install`, `simctl launch`, log `CoreSimulator/SpringBoard`, `devicectl list devices`.
- Guardrail futuro (test/check/alert): checklist fissa per richieste "misura build X" = 1) conferma build/versione, 2) conferma piattaforma binario, 3) prova launch reale, 4) se fallisce o manca device, dichiarare impossibilita' della misura e non sostituirla con build dev.

### 2026-03-29 - Link web `/app/?key=...` scambiato per apertura app nativa
- Contesto: verifica richiesta utente del comportamento "dal web" aprendo `https://where2beach.com/app/?key=...` su iOS simulator con app installata.
- Errore commesso: assumere che un URL HTTPS applicativo implichi automaticamente handoff alla app nativa installata.
- Segnale ignorato: sequenza screenshot con toolbar Safari visibile anche dopo il caricamento completo della mappa; nessuno screenshot mostrava il contenitore nativo fuori da Safari.
- Causa radice: nel test reale il link apre la web app in Safari; non emerge handoff nativo automatico tramite universal link / smart banner / redirect a custom scheme per questo percorso.
- Fix applicata: nessuna modifica codice in questo task; classificazione corretta del comportamento attuale come `web in Safari`, non `apertura app nativa`.
- Regola permanente: quando si valida "apri app dal web", non basarsi sull'URL o sull'intenzione del flow; verificare sempre visivamente se sparisce Safari e se compare davvero il contenitore nativo.
- Verifica eseguita: apertura URL via `xcrun simctl openurl booted`, sequenza screenshot temporizzati, controllo app installata + launch manuale separato riuscito.
- Guardrail futuro (test/check/alert): se il requisito prodotto e' handoff web->app, introdurre test esplicito su device/simulator con esito binario `Safari resta visibile` vs `app nativa in foreground`.

### 2026-03-29 - Loader fullscreen WebView scambiato per crash/splash bloccata su iOS
- Contesto: simulazione locale dell'app mobile su iOS simulator con WebView che carica `/app/?native_shell=1` da Vite locale.
- Errore commesso: interpretare subito la schermata nera con logo come crash della web app o bootstrap Expo, senza prima confrontare il render puro della stessa URL fuori dal contenitore mobile.
- Segnale ignorato: i log WebKit indicavano page load completato e la stessa URL, aperta in browser headless, mostrava correttamente mappa, pin e bottom nav.
- Causa radice: il contenitore `mobile/src/components/WebSurface.tsx` mostrava un loader fullscreen post-boot (`loading && hasLoadedOnce`) che su iOS poteva restare attivo piu del dovuto e coprire completamente la WebView, producendo un falso "black screen".
- Fix applicata: separato il bootstrap bloccante iniziale dal loading successivo; mantenuto overlay pieno solo prima di `initialPresentationReady` e sostituito il loader post-boot con badge inline non bloccante.
- Regola permanente: se una WebView iOS sembra "nera", verificare sempre in ordine 1) se la stessa URL renderizza correttamente in browser, 2) se i log indicano page load completo, 3) se un overlay nativo/mobile sta coprendo contenuto gia pronto.
- Verifica eseguita: `npm run mobile:typecheck` PASS; screenshot simulator dopo patch con UI visibile (search bar, mappa, cluster pin, bottom nav); screenshot browser headless della stessa URL coerente.
- Guardrail futuro (test/check/alert): evitare loader fullscreen persistenti sopra WebView dopo il first paint; i loader post-boot devono essere non bloccanti o limitati a transizioni URL esplicite.

### 2026-03-29 - Segnalazione build 15 su Privacy/Cookie durante registrazione
- Contesto: utente mobile (build 15) ha toccato i link legali in registrazione ed e' finito sulla schermata "Cookie Policy" interna.
- Errore commesso: trattare il report come regressione critica senza prima verificare se la schermata mostrata fosse il fallback legale previsto.
- Segnale ignorato: screenshot coerente 1:1 con `public/cookie-policy/index.html` (CTA `Apri cookie policy`, `Gestisci preferenze cookie`, `Privacy`).
- Causa radice: quando la config legale runtime non e' ancora pronta al click, il `RegisterPage` usa fallback interni (`/privacy/`, `/cookie-policy/`) con contesto; in build 18 la segnalazione non e' stata riprodotta.
- Fix applicata: nessuna modifica codice in questo task; classificazione come comportamento fallback non bloccante e aggiunta regola QA release.
- Regola permanente: su report "privacy/cookie apre pagina inattesa", verificare prima se e' fallback legale previsto e se le CTA interne portano correttamente a policy/preferenze, prima di aprire fix regressivo.
- Verifica eseguita: controllo codice `src/app/RegisterPage.tsx`, `public/cookie-policy/index.html`, `public/legal/runtime.js` + confronto visivo con screenshot utente.
- Guardrail futuro (test/check/alert): in QA build interna eseguire smoke su registrazione -> tap `Privacy` e `Cookie`; esito accettabile = apertura policy esterna oppure fallback interno con CTA funzionanti e navigazione non bloccata.

### 2026-03-28 - iOS debug bloccato su `No script URL provided` con `unsanitizedScriptURLString = (null)`
- Contesto: avvio app mobile iOS su simulator durante iterazione UI/tutorial.
- Errore commesso: assumere che Metro fosse sempre su `8081` e che `RCTBundleURLProvider.sharedSettings().jsBundleURL(...)` fosse sufficiente anche durante startup race.
- Segnale ignorato: red screen persistente con `No script URL provided` nonostante bundling Metro in corso.
- Causa radice: disallineamento potenziale tra porta Metro reale e `RCT_jsLocation`, piu fallback fragile in `AppDelegate` che poteva restituire `nil` in fase iniziale.
- Fix applicata: `scripts/run-mobile-ios-dev.mjs` ora risolve porta Metro dinamicamente (`8081-8085`), forza `expo start --ios --port <porta>`, sincronizza `RCT_jsLocation` prima/dopo launch; `mobile/ios/Where2Beach/AppDelegate.swift` ora costruisce URL bundle da `RCT_jsLocation` con fallback esplicito localhost in debug.
- Regola permanente: mai assumere `8081` fisso in bootstrap iOS; allineare sempre porta Metro, `RCT_jsLocation` e comando Expo nello stesso flusso.
- Verifica eseguita: `npm run mobile:ios` (bundle OK), `xcodebuild ... Debug ...` PASS, screenshot simulator con app caricata (no red screen).
- Guardrail futuro (test/check/alert): se compare `No script URL provided`, eseguire subito check in ordine: `curl /status` su `8081-8085` -> `defaults read com.where2beach.mobile RCT_jsLocation` -> relaunch app dal bundle id corretto.

### 2026-03-28 - Tutorial lasciava navigare l'app durante onboarding
- Contesto: step tutorial ONDA con spotlight su search/tab e richiesta interazione utente.
- Errore commesso: consentire input diretto sulla UI reale mentre tutorial attivo, generando side-effect applicativi (zoom mappa, apertura schede, cambio sezione) prima della fine guida.
- Segnale ignorato: feedback utente di flusso "caotico" con app che naviga mentre il tutorial e' ancora in corso.
- Causa radice: overlay non bloccante e design step che delegava interazioni a elementi reali della WebView.
- Fix applicata: tutorial lock totale con touch-catcher fullscreen; interazioni spostate nella card (input citta guidato per search) e azioni controllate via bottoni (`Apri ONDA`, nuovo step `Torna a Mappa`).
- Regola permanente: durante onboarding guidato, evitare side-effect non deterministici sulla UI reale; usare interazioni simulate/controllate dalla card.
- Verifica eseguita: `npm --prefix mobile run typecheck` PASS.
- Guardrail futuro (test/check/alert): smoke completa step-by-step verificando che nessun tap sulla WebView produca navigazione libera finche tutorial non termina.

### 2026-03-28 - Auto-advance troppo aggressivo negli step interattivi
- Contesto: tutorial ONDA con step guidati "tocca elemento evidenziato".
- Errore commesso: avanzare automaticamente allo step successivo subito dopo il primo tap dell'utente.
- Segnale ignorato: feedback utente "passa subito e non mi fa capire niente".
- Causa radice: confusione tra evento di "step completato" e evento di "navigazione allo step successivo".
- Fix applicata: disabilitato auto-advance per step `search` e `onda`; il tap ora marca solo completamento step, mentre il passaggio resta esplicito sul bottone `Continua`.
- Regola permanente: negli onboarding esplicativi, usare progresso a due fasi (azione completata -> conferma utente) per non perdere comprensione.
- Verifica eseguita: `npm --prefix mobile run typecheck` PASS.
- Guardrail futuro (test/check/alert): validare manualmente che i tap su step interattivi non cambino step senza input intenzionale sulla CTA.

### 2026-03-28 - Step interattivo bloccato per touch intercettato dall'overlay
- Contesto: tutorial ONDA con step "tocca la barra di ricerca per continuare".
- Errore commesso: mantenere un `Pressable` fullscreen sopra la WebView durante il tutorial, impedendo il tap reale sull'elemento evidenziato.
- Segnale ignorato: utente non riesce a sbloccare lo step nonostante tocchi correttamente la search bar.
- Causa radice: overlay con `pointerEvents` non pass-through (`auto`) + touch-catcher assoluto che assorbe input.
- Fix applicata: overlay root impostato a `pointerEvents=\"box-none\"`, rimosso touch-blocker fullscreen, estesi listener di interazione a `pointerdown` e `touchstart` oltre a click/focus.
- Regola permanente: negli step tutorial "interattivi", l'area spotlight deve lasciare pass-through verso WebView; no layer fullscreen touch-blocking sopra il target.
- Verifica eseguita: `npm --prefix mobile run typecheck` PASS.
- Guardrail futuro (test/check/alert): smoke manuale obbligatoria per ogni step con `interactionSelector` (tap reale deve aggiornare stato entro 1 interazione).

### 2026-03-28 - Bootstrap mobile bloccato su JSON `missing_env` da `/api/app-access`
- Contesto: primo avvio app mobile con tutorial ONDA sopra WebView.
- Errore commesso: assumere che il bootstrap `/api/app-access` sia sempre configurato anche in ambiente locale, mostrando il tutorial sopra una risposta JSON errore.
- Segnale ignorato: testo visibile in alto con payload errore (`missing_env`) e sfondo app assente sotto overlay.
- Causa radice: dipendenza backend (`APP_ACCESS_KEY` / `APP_ACCESS_KEY_HASH`) non sempre presente dove gira la route app-access; la WebView rende il body errore invece dell'app.
- Fix applicata: in `mobile/src/config/env.ts` il bootstrap usa bypass diretto `/app/?native_shell=1` quando `EXPO_PUBLIC_BASE_URL` e' locale; in `WebSurface` aggiunta gestione `onHttpError` per mostrare errore chiaro e bloccare tutorial su errore server.
- Regola permanente: separare bootstrap locale e remoto; il gate `/api/app-access` va richiesto solo su origin remoti dove la configurazione server e' garantita.
- Verifica eseguita: `npm --prefix mobile run typecheck` PASS.
- Guardrail futuro (test/check/alert): smoke obbligatoria su iOS simulator con base URL locale per verificare che non appaia mai JSON raw in WebView al primo avvio.

### 2026-03-28 - Tutorial mostrato su WebView non ancora pronta
- Contesto: onboarding first-run ONDA su mobile con overlay animato e spotlight.
- Errore commesso: considerare `onLoadEnd` della WebView come condizione sufficiente per mostrare il tutorial, senza verificare che la UI web (ancore `data-testid`) fosse realmente montata.
- Segnale ignorato: utente vede step e card corretti ma contenuto app sotto percepito come vuoto/nero o blu.
- Causa radice: mismatch tra "document loaded" e "app UI ready" (hydration/montaggio componenti non ancora completato quando parte il tour).
- Fix applicata: introdotto bridge `w2b-tour-ready` (script inject + `postMessage`) e gating `tutorialVisible` su `tutorialDomReady`; aggiunti probe multipli e fallback temporizzato; overlay dim alleggerito nei fallback senza spotlight.
- Regola permanente: i tutorial contestuali sopra WebView devono dipendere da segnali di readiness UI (selector/marker), non solo da lifecycle `onLoadEnd`.
- Verifica eseguita: `npm --prefix mobile run typecheck` PASS.
- Guardrail futuro (test/check/alert): smoke manuale obbligatoria primo avvio su simulator con verifica che sotto overlay sia visibile contenuto reale dell'app in almeno 2 step con selector.

### 2026-03-28 - Overlay tutorial senza "buco" reale sulla WebView
- Contesto: refactor tutorial ONDA con spotlight e riposizionamento avatar step-by-step in `mobile/src/components/WebSurface.tsx`.
- Errore commesso: sostituzione parziale del backdrop (render segmentato introdotto senza stili `tutorialBackdrop*` definiti) lasciando di fatto l'app sotto non leggibile e regressione typecheck.
- Segnale ignorato: percezione utente "schermo nero/blu" durante tutorial e hint di errore in alto su simulator.
- Causa radice: integrazione incompleta tra logica layout overlay e StyleSheet (chiavi mancanti + spotlight con fill colorato invece di area trasparente).
- Fix applicata: aggiunti stili `tutorialBackdropTouch`, `tutorialBackdropLayer`, `tutorialBackdropSegment`, `tutorialBackdropFallback`; mantenuto backdrop solo fuori dal focus; reso trasparente il fill di spotlight/pulse.
- Regola permanente: quando si introduce una nuova chiave `styles.*` in render, chiudere il task solo con `typecheck` verde e verifica visiva del "hole" sul contenuto sottostante.
- Verifica eseguita: `npm --prefix mobile run typecheck` PASS.
- Guardrail futuro (test/check/alert): checklist overlay tutorial obbligatoria su simulator (intro + step con selector) per confermare visibilita' WebView e assenza schermata piena scura.

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
