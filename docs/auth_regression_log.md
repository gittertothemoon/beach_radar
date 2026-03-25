# Auth Regression Log

Updated: 2026-03-25

## Goal
Keep a permanent, versioned history of authentication issues and enforce automated checks so the same regressions do not return.

## Incident History

### 2026-03-25 - Registration and auth error handling hardening
Problems found:
- Re-register with an existing email could show a misleading confirmation flow.
- Password mismatch could be hidden by weak-password validation order.
- Generic error messages made troubleshooting unclear for users.

Fixes implemented:
- Normalized Supabase auth error mapping and masked-existing-user handling.
- Centralized auth error copy with specific, user-friendly messages.
- Corrected validation precedence (password mismatch before weak-password).

Guardrail tests added:
- `tests/auth.logic.spec.ts`
- `tests/app.auth.spec.ts`
- `tests/app.auth.errors.spec.ts`

## Mandatory Guardrails

When changing any auth-related code (`src/lib/account.ts`, `src/lib/authError*`, `src/app/RegisterPage.tsx`, auth API behavior), run:

```bash
npm run typecheck
npm run lint
npm run test:app:auth
```

Do not merge auth changes if any of the commands above fail.

## CI Enforcement

Auth regression tests are part of CI (`App Quality` workflow, `auth-regression` job).  
If CI fails on auth regression tests, the change must be fixed before merge.
