# CODEX Release Memory

Last update: 2026-03-28 (Europe/Rome)

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

## Stato OTA
- Al 2026-03-28 non risultano configurazioni OTA esplicite (`runtimeVersion` / `updates`).
- Finche' non viene configurato OTA in modo esplicito e testato, usare flusso store.

## Protocollo operativo Codex
1. Classificare il tipo modifica (OTA vs store) con il check rapido.
2. Eseguire il flusso appropriato senza chiedere all'utente dettagli tecnici non necessari.
3. Riportare in output:
- tipo update scelto
- comandi eseguiti
- eventuali blocchi e fix richiesti
4. Dopo incidenti o correzioni importanti, aggiornare questo file.
5. Prima di chiudere ogni task release, applicare il protocollo memoria in `docs/CODEX_MEMORY_PROTOCOL.md`.
