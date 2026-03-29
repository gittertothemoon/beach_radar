# CODEX Working Memory

Last update: 2026-03-29 21:47 (Europe/Rome)

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
- 2026-03-29: chiarito flusso pratico App Store quando la build iOS e' gia' presente in App Store Connect/TestFlight (caso build 18): non serve nuova submit EAS; va creata/selezionata la versione App Store corretta, collegata la build esistente e inviato il version release ad App Review dalla UI di App Store Connect.
- 2026-03-29: chiarita regola update per where2beach dopo pubblicazione su App Store: le modifiche solo lato web/API caricate dalla WebView arrivano senza nuova submit, mentre ogni cambiamento del contenitore mobile Expo/React Native va pubblicato con build+submit store; OTA Expo non risulta ancora configurato nel repo.
- 2026-03-29: definita soglia per passaggio Apple Developer `individual -> organization`: ha senso solo quando esiste entita' legale reale e stabile (azienda/associazione/ente con D-U-N-S) e serve mostrare un nome brand/aziendale al posto del nome personale, non come workaround temporaneo di privacy.
- 2026-03-29: chiarito naming pubblico App Store: con account Apple Developer `individual` il seller/developer name resta il nome legale personale, non puo' essere nickname/alias; per mostrare un nome diverso serve conversione a `organization` e, lato developer name, Apple consente nomi commerciali registrati solo per account organizzazione.
- 2026-03-29: utente ha selezionato `non trader` in App Store Connect; decisione accettata come stato temporaneo coerente con fase attuale solo-gratuita/traction, con regola di cambio immediato a `trader` al primo evento commerciale concreto (IAP, abbonamenti, ads, promozione o vendita servizi via app).
- 2026-03-29: affinata regola DSA sul caso utente pre-monetizzazione: `non trader` oggi e' sostenibile solo se app resta davvero gratuita, senza IAP/ads/subscription, senza promozione/vendita servizi e senza operare gia' in capacita' business; appena parte monetizzazione o l'app diventa canale commerciale, cambiare subito a `trader` da App Store Connect per app specifica.
- 2026-03-29: chiarito effetto scelta DSA `non operatore commerciale`: Apple non richiede contatti pubblici e informa i consumatori UE che i diritti di tutela consumer non si applicano ai contratti con lo sviluppatore; nel caso utente questa opzione riduce esposizione privacy ma resta debole sul piano compliance dato l'orientamento a monetizzazione/servizi professionali.
- 2026-03-29: verificato canale attivazione `Caselle Postali` Poste Italiane: non emerge acquisto self-service online; i canali ufficiali mostrati sono `in ufficio postale` oppure `tramite commerciale di riferimento`.
- 2026-03-29: chiarito dove attivare una `P.O. Box` in Italia: canale standard e ufficiale = `Caselle Postali` di Poste Italiane, da richiedere presso un Ufficio Postale abilitato; prezzo ufficiale visto al 2026-03-29 da 125 euro/anno IVA inclusa.
- 2026-03-29: chiarita differenza tra `P.O. Box` e indirizzo fisico: non sono la stessa cosa; la `P.O. Box` e' una casella postale/recapito postale separato che Apple ammette come alternativa pubblicabile per account individuali DSA se documentabile.
- 2026-03-29: definita raccomandazione strategica DSA per ritardi lunghi sui recapiti separati: se il launch in Italia e' prioritario e non procrastinabile, pubblicare con dati reali sapendo che sono modificabili dopo; se il costo privacy pesa piu del vantaggio di uscire subito, trattare il recapito separato come prerequisito e rinviare la release.
- 2026-03-29: verificato su documentazione Apple che i dati DSA trader possono essere cambiati in seguito; per account/app si puo' modificare lo status e aggiornare i contatti, ma ogni nuovo recapito richiede nuova verifica (email/telefono e documentazione indirizzo alternativo/P.O. Box).
- 2026-03-29: confermato vincolo geografico utente: distribuzione iniziale in Italia = distribuzione UE ai fini DSA Apple; quindi non esiste scorciatoia "solo Italia" per evitare pubblicazione dei contatti trader.
- 2026-03-29: emerso vincolo privacy utente su DSA Apple (`fastidio pubblicare casa`): raccomandazione operativa = non usare domicilio personale se non accettato; alternative realistiche solo tre: P.O. Box/indirizzo separato documentabile + numero dedicato, rilascio iniziale fuori UE, oppure accettare pubblicazione dei dati personali.
- 2026-03-29: chiarito dettaglio DSA per account individuale Apple: se dichiarato `operatore commerciale`, per la product page UE servono dati pubblici verificati `Address or P.O. Box`, `Phone number`, `Email address`; quindi senza sede/telefono aziendale si possono usare domicilio/personale, oppure meglio P.O. Box e numero dedicato se si vuole evitare esposizione dei dati privati.
- 2026-03-29: chiarita scelta DSA App Store Connect per caso utente: sviluppatore individuale con app gratuita ma progetto orientato a piano pro / servizi / SaaS => selezionare `Sono un operatore commerciale`; Apple considera rilevanti anche intenzione di commercializzare, pratiche promozionali e sviluppo in capacita' professionale, non solo ricavi attuali.
- 2026-03-29: corretto claim `W-8BEN line 10` sul caso reale utente: app gratuita, eventuale monetizzazione futura via piano pro / servizi digitali / SaaS; per Apple non va indicata `sale of applications` ma `Other` con business profits da digital services/subscriptions via app, sempre `Article 7(1), 0%, no U.S. permanent establishment`; eventuale SaaS B2B esterno all'App Store non rientra nei pagamenti Apple.
- 2026-03-29: scelta univoca per il caso specifico utente (`individual` italiano su App Store Connect, ricavi da vendita app, nessuna stabile organizzazione USA): compilazione consigliata `W-8BEN line 10 = Article 7(1), 0%, business profits from the sale of applications, no U.S. permanent establishment`.
- 2026-03-29: preparati template copy-ready per `W-8BEN Part II line 10` in due versioni: raccomandata `Article 7(1) / 0% / no PE USA` e fallback `Article 12(2)(a) / 5% software royalties` per compilazione pratica App Store Connect.
- 2026-03-29: approfondita `W-8BEN Part II line 10` per App Store Connect con fonti IRS/Apple: analisi sostanziale piu forte = modello `agency platform operator` e vendita di app al cliente come `sale of a copyrighted article` / business profits (non royalty), quindi se non c'e' PE USA il claim piu corretto e' art. 7 con aliquota effettiva 0%; fallback operativo se Apple impone classificazione royalties = trattato USA-Italia art. 12(2)(a), software royalties 5%, non 0%.
- 2026-03-29: analizzato PDF App Store Connect `U.S. Form W-8BEN` per account individuale italiano; guida pratica: campi Part I con dati anagrafici reali, `Foreign Tax Identifying Number` come codice fiscale italiano, data nascita in formato `MM-DD-YYYY`, attenzione a Part II trattato fiscale USA-Italia su proventi app prima di invio definitivo perche' Apple blocca modifiche self-service dopo submit.
- 2026-03-29: aggiunte istruzioni pratiche per Revolut: in app `Home -> Conti -> EUR -> Dettagli`; se l'IBAN inizia con `LT`, nel form lituano con `Banko kodas 70700` il `Numero del conto` corrisponde alle ultime 11 cifre dell'IBAN dopo `LTkk70700`.
- 2026-03-29: secondo chiarimento utente sul form bancario: spiegato in termini semplici che `Numero del conto` e' l'identificativo del conto bancario su cui ricevere/inviare denaro, distinto da numero carta, CVV e PIN.
- 2026-03-29: chiarito significato del campo bancario `Numero del conto` in un form con `Banko kodas`: indica il numero di conto/account number associato all'IBAN, non numero carta; con Revolut va verificato se il form richiede il conto locale oppure direttamente l'IBAN.
- 2026-03-29: implementato sistema reward per utente con saldo punti persistente legato a segnalazioni concluse (+15 punti/report), catalogo iniziale di 6 badge digitali a costo uniforme (120 pt) con riscatto atomico e struttura coupon futura; integrate migration Supabase (`13_rewards_system`), endpoint account rewards (`/api/account/rewards`) e UI profilo con saldo + redemption badge.
- 2026-03-29: verificata segnalazione mobile su build 15 (tap `Privacy`/`Cookie` in registrazione): lo screenshot corrisponde alla pagina fallback legale interna `/cookie-policy/` (card con CTA), mentre in build 18 il caso non e' risultato riproducibile; classificato come comportamento non bloccante da monitorare in QA release.
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
