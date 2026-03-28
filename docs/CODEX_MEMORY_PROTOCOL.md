# CODEX Memory Protocol

Last update: 2026-03-28 (Europe/Rome)

## Regola Autorita Suprema (vincolante)
- Ogni task si considera chiuso solo dopo aggiornamento memoria.
- Nessuna eccezione: anche task piccoli devono lasciare traccia minima.
- Se la memoria non viene aggiornata, il task e' da considerare incompleto.

## Aggiornamento minimo obbligatorio a fine task
1. Aggiornare `docs/CODEX_WORKING_MEMORY.md`:
- `Last update`
- una riga nel `Log sintetico` con decisione/fix principale
2. Se il task include errore, debug o regressione:
- aggiornare anche `docs/CODEX_ERROR_MEMORY.md` con voce completa in `Lessons`
3. Se il task impatta rilasci mobile (OTA/store, build, submit, blocchi):
- aggiornare anche `docs/CODEX_RELEASE_MEMORY.md`

## Checklist di chiusura task (obbligatoria)
1. Modifica tecnica completata e verificata.
2. File memoria aggiornati secondo impatto reale del task.
3. Output finale all'utente con riferimento sintetico a cio' che e' stato registrato.

