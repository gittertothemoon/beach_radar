# CODEX Release Memory

Last update: 2026-03-29 22:28 (Europe/Rome)

## Scopo
- Evitare di ripetere ogni volta il flusso di rilascio mobile.
- Dare a Codex una regola operativa unica e stabile per gli update.
- Ridurre rischio errori (build sbagliata, submit non necessario, tempi persi).

## Preferenza utente (vincolante)
- L'utente vuole dire solo "facciamo update".
- Codex deve decidere e gestire il flusso corretto end-to-end.
- Se mancano prerequisiti tecnici, Codex deve segnalarli e proporre fix immediato.

## Regola decisionale (single source of truth)
1. Se il cambiamento e' solo JS/UI/logica webview (nessun cambiamento nativo):
- preferire OTA update (senza review Apple).
2. Se tocca parti native iOS/Android:
- fare build production + submit store (con review Apple/Google).
3. Se c'e' dubbio su impatto nativo:
- trattare come update store (approccio conservativo).

## Chiarimento specifico progetto where2beach
- L'app mobile e' un contenitore Expo che apre la web app dentro `react-native-webview`.
- Se la modifica e' solo lato sito/API servita da `https://where2beach.com` e non richiede cambiamenti nel codice mobile, l'update arriva agli utenti dentro l'app senza nuova submit App Store.
- Se invece cambia il contenitore mobile (`mobile/`, configurazione Expo/EAS, asset nativi, permessi, plugin, SDK, logica RN/WebView), trattarlo come update store.
- Al momento non risultano configurazioni OTA Expo esplicite (`runtimeVersion` / `updates`), quindi per modifiche del contenitore mobile usare build+submit store.
- Il simulatore locale in dev e' utile per validare UI/UX del contenitore e integrazione WebView, ma non coincide 1:1 con produzione se usa `mobile/.env` locale o flag QA/dev (`mock_auth`, `report_anywhere`, base URL LAN). La build preview/production definita in `mobile/eas.json` punta invece a `https://where2beach.com` e non include quei flag locali.
- Traduzione pratica: cio' che "pubblichi" su App Store e' soprattutto il contenitore mobile; cio' che l'utente "vede" dopo l'installazione e' per larga parte la web app live servita dal dominio al momento dell'apertura, salvo differenze introdotte da codice/config nativi del contenitore.

## Check rapido prima di scegliere il tipo update
- Sono cambiati `mobile/ios/` o `mobile/android/`?
- Sono cambiati `mobile/app.json` (permessi, plugin, bundle/package, native config)?
- E' cambiata versione SDK Expo o dipendenze native?
- Sono stati aggiunti/rimossi plugin o capability native?

Se anche solo una risposta e' "si", usare update store.

## Flusso store (attuale, pronto nel repo)
Da `mobile/`:
```bash
npm run eas:build:ios:prod
npm run eas:submit:ios:prod
```

Note:
- `eas.json` ha `autoIncrement: true` in production.
- App Store Connect iOS gia' configurato (`submit.production.ios.ascAppId`).
- Se la build e' gia' stata caricata in App Store Connect/TestFlight (es. build pronta in stato distribuibile), non serve rifare `submit`: basta entrare nella pagina versione iOS, associare quella build alla nuova versione App Store e inviare la versione ad App Review.

## Stato OTA
- Al 2026-03-28 non risultano configurazioni OTA esplicite (`runtimeVersion` / `updates`).
- Finche' non viene configurato OTA in modo esplicito e testato, usare flusso store.

## Regola di misura build specifica
- Se l'utente chiede timing/comportamento di una build store specifica (es. `build 19`), non usare la dev build del simulatore come sostituto.
- Prima verificare la disponibilita' reale del binario da misurare: `.ipa`, `.xcarchive`, dev/preview build installata, oppure device con quella build.
- Se nel simulatore compare `CFBundleVersion` diverso dalla build richiesta, dichiarare il blocco in modo esplicito: la misura non e' della build richiesta ma della build locale installata.
- Se viene fornita una `.ipa` store/device e il simulatore Apple Silicon la accetta in installazione, non assumere che sia eseguibile: verificare sempre il launch reale. `install ok` nel catalogo simulator non equivale a `boot misurabile`; se SpringBoard nega l'apertura, la misura resta valida solo su device fisico o su build compilata per simulator.

## Protocollo operativo Codex
1. Classificare il tipo modifica (OTA vs store) con il check rapido.
2. Eseguire il flusso appropriato senza chiedere all'utente dettagli tecnici non necessari.
3. Riportare in output:
- tipo update scelto
- comandi eseguiti
- eventuali blocchi e fix richiesti
4. Dopo incidenti o correzioni importanti, aggiornare questo file.
5. Prima di chiudere ogni task release, applicare il protocollo memoria in `docs/CODEX_MEMORY_PROTOCOL.md`.

## Guardrail operativo iOS (dev bootstrap)
- Se durante sviluppo iOS appare `No script URL provided`:
- non assumere Metro su `8081`; verificare `http://127.0.0.1:<porta>/status` su `8081-8085`.
- allineare sempre `RCT_jsLocation` alla porta reale di Metro prima del launch app.
- usare il runner standard del repo (`npm run mobile:ios`) per mantenere sincronizzati porta Expo/Metro e simulator defaults.
- Se stai validando splash/logo/timing in Expo Go, ricordare che non rappresenta perfettamente la splash nativa della build pubblicata: opzioni come `expo-splash-screen` e parte del comportamento splash custom richiedono development build o build store per essere validate fedelmente.

## Guardrail QA legali (build interne/TestFlight)
- Durante registrazione, verificare tap su `Privacy` e `Cookie` almeno una volta per build.
- Esito valido: apertura diretta policy esterna oppure fallback interno `/cookie-policy/` con CTA attive (`Apri cookie policy`, `Gestisci preferenze cookie`, `Privacy`) e nessun blocco di navigazione.
- Se il fallback interno compare ma le CTA non funzionano, classificare come bug release-blocker.

## Guardrail compliance App Store (DSA UE)
- Per account `individual` con app gratuita ma progetto orientato a monetizzazione futura (abbonamenti, piano pro, servizi digitali, SaaS collegato), in App Store Connect DSA selezionare `trader` / `operatore commerciale`.
- Motivo operativo: Apple richiede self-assessment e considera indicatori di trader non solo i ricavi attuali ma anche attivita' professionale/commerciale, advertising/promozione e intenzione di commercializzare; la sola assenza di monetizzazione oggi non basta a qualificare il progetto come hobbyistico.
- Conseguenza pratica: preparare indirizzo, telefono ed email pubblicabili sulla product page UE prima della submit.
- Per account individuali senza sede/telefono aziendale, Apple consente `Address or P.O. Box`; quindi il fallback lecito e' usare domicilio personale + numero personale, ma se si vuole ridurre esposizione pubblica conviene predisporre una P.O. Box documentabile e un numero dedicato prima della release UE.
- Se l'utente non accetta la pubblicazione di domicilio/telefono personali, trattare la compliance DSA come release blocker per distribuzione UE finche' non esiste recapito separato verificabile (P.O. Box/indirizzo alternativo documentato + numero dedicato) oppure finche' non si decide di escludere l'UE dalla distribuzione iniziale.
- L'Italia conta come territorio UE per questo obbligo; quindi una release "solo Italia" non evita i requisiti DSA trader su App Store.
- I dati DSA non sono irrevocabili: possono essere aggiornati in seguito da App Store Connect, ma trattare ogni cambio recapito come mini-step di compliance con nuova verifica dei contatti e dei documenti associati all'indirizzo alternativo.
- Strategia decisionale quando il recapito separato richiede tempo: se il time-to-market in UE e' critico, e' accettabile una prima release con dati personali consapevolmente temporanei; se la privacy personale ha priorita' piu alta del lancio immediato, bloccare la release fino a disponibilita' di recapiti separati verificabili.
- Dichiararsi `non trader` evita la pubblicazione dei contatti, ma Apple mostra ai consumatori UE che i diritti consumer applicabili non si applicano; usare questa opzione solo se l'auto-valutazione e' realmente difendibile, non come scorciatoia privacy per progetti con chiaro orientamento commerciale.
- Soglia operativa per il caso utente pre-monetizzazione: `non trader` e' tollerabile solo finche' non esistono ricavi, IAP, abbonamenti, ads o promozione/vendita di servizi via app e finche' il progetto non viene gestito in chiara capacita' business; al primo passo commerciale concreto, aggiornare subito lo status a `trader` a livello app.
