import { useEffect, useMemo, useState } from "react";
import logo from "../assets/logo.png";
import { STRINGS } from "../i18n/it";
import {
  loginAccount,
  registerAccount,
  setFavoriteBeach,
} from "../lib/account";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,}$/;
const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_NUMBER = /\d/;
const HAS_SYMBOL = /[^A-Za-z0-9]/;
const MIN_PASSWORD_LENGTH = 10;

const RegisterPage = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const returnToRaw = searchParams.get("returnTo") || "/";
  const pendingFavoriteBeachId = searchParams.get("fav");
  const beachName = searchParams.get("beachName");

  const safeReturnPath = useMemo(() => {
    const parsed = new URL(returnToRaw, window.location.origin);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "") || "/";
    if (normalizedPath === "/register" || normalizedPath === "/app/register") {
      return normalizedPath.startsWith("/app") ? "/app" : "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }, [returnToRaw]);

  useEffect(() => {
    const root = document.getElementById("root");
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverflowY = document.body.style.overflowY;
    const prevRootOverflow = root?.style.overflow;
    const prevRootOverflowY = root?.style.overflowY;

    document.body.style.overflow = "auto";
    document.body.style.overflowY = "auto";
    if (root) {
      root.style.overflow = "auto";
      root.style.overflowY = "auto";
    }

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overflowY = prevBodyOverflowY;
      if (root) {
        root.style.overflow = prevRootOverflow ?? "";
        root.style.overflowY = prevRootOverflowY ?? "";
      }
    };
  }, []);

  const isPasswordStrong = useMemo(
    () =>
      password.length >= MIN_PASSWORD_LENGTH &&
      HAS_UPPERCASE.test(password) &&
      HAS_LOWERCASE.test(password) &&
      HAS_NUMBER.test(password) &&
      HAS_SYMBOL.test(password),
    [password],
  );

  const validateForm = () => {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (
      normalizedFirstName.length === 0 ||
      normalizedLastName.length === 0 ||
      normalizedEmail.length === 0 ||
      password.length === 0 ||
      confirmPassword.length === 0
    ) {
      return STRINGS.account.requiredField;
    }
    if (
      !NAME_PATTERN.test(normalizedFirstName) ||
      !NAME_PATTERN.test(normalizedLastName)
    ) {
      return STRINGS.account.invalidName;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return STRINGS.account.invalidEmail;
    }
    if (!isPasswordStrong) {
      return STRINGS.account.weakPassword;
    }
    if (password !== confirmPassword) {
      return STRINGS.account.passwordMismatch;
    }
    if (!consentAccepted) {
      return STRINGS.account.consentRequired;
    }
    return null;
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[radial-gradient(1100px_600px_at_12%_-8%,rgba(56,189,248,0.14),transparent_55%),radial-gradient(900px_500px_at_95%_12%,rgba(251,191,36,0.12),transparent_58%),linear-gradient(160deg,#07090d_0%,#0b0f16_70%,#0f1720_100%)] px-3 py-[calc(env(safe-area-inset-top)+10px)] text-slate-100 sm:px-4 sm:py-[calc(env(safe-area-inset-top)+20px)]">
      <div className="mx-auto flex h-full w-full max-w-screen-sm items-start sm:items-center">
        <div className="contrast-guard max-h-[94dvh] w-full overflow-y-auto overflow-x-hidden rounded-[18px] border border-white/15 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-4 shadow-[0_18px_44px_rgba(0,0,0,0.42)] sm:max-h-[92svh] sm:px-5 sm:pb-[calc(env(safe-area-inset-bottom)+16px)] sm:pt-5">
          <div className="flex flex-col">
            <div className="flex shrink-0 flex-col items-center">
              <img
                src={logo}
                alt={STRINGS.appName}
                className="h-16 w-auto drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)] sm:h-20"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-2.5 gap-y-1.5">
              <h1 className="text-[22px] font-semibold tracking-[-0.015em] br-text-primary sm:text-[24px]">
                {STRINGS.account.registerTitle}
              </h1>
              {beachName ? (
                <div className="max-w-full shrink-0 truncate rounded-full border border-amber-300/45 bg-amber-400/12 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                  {beachName}
                </div>
              ) : null}
            </div>

            <p className="mt-2 text-[13px] leading-snug br-text-secondary">
              {STRINGS.account.registerSubtitle}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-x-2.5 gap-y-3.5 min-[390px]:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                  {STRINGS.account.firstNameLabel}
                </span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(event) => {
                    setFirstName(event.target.value);
                    setError(null);
                  }}
                  placeholder={STRINGS.account.firstNamePlaceholder}
                  className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                  {STRINGS.account.lastNameLabel}
                </span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(event) => {
                    setLastName(event.target.value);
                    setError(null);
                  }}
                  placeholder={STRINGS.account.lastNamePlaceholder}
                  className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                />
              </label>

              <label className="col-span-full block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                  {STRINGS.account.emailLabel}
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                  placeholder={STRINGS.account.emailPlaceholder}
                  className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                  {STRINGS.account.passwordLabel}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  placeholder={STRINGS.account.passwordPlaceholder}
                  className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                  {STRINGS.account.confirmPasswordLabel}
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setError(null);
                  }}
                  placeholder={STRINGS.account.confirmPasswordPlaceholder}
                  className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                />
              </label>

              <div className="col-span-full rounded-[10px] border border-white/12 bg-black/30 px-3 py-2.5 text-[11px] leading-snug br-text-tertiary">
                {STRINGS.account.passwordHint}
              </div>

              <label className="col-span-full flex items-start gap-2.5 rounded-[10px] border border-white/12 bg-black/30 px-3 py-2.5 text-[12px] leading-snug br-text-secondary">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(event) => {
                    setConsentAccepted(event.target.checked);
                    setError(null);
                  }}
                  className="mt-[1px] h-4 w-4 shrink-0 accent-sky-400"
                />
                <span>
                  {STRINGS.account.consentLabel}{" "}
                  <a
                    href="/privacy/"
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    Privacy
                  </a>
                </span>
              </label>
            </div>

            {error ? (
              <div className="mt-3.5 rounded-[10px] border border-rose-300/60 bg-rose-500/25 px-3 py-2.5 text-[12px] text-rose-50">
                {error}
              </div>
            ) : null}

            <div className="mt-5 space-y-3 border-t border-white/8 pt-4">
              <button
                type="button"
                disabled={submitting}
                onClick={async () => {
                  const validationError = validateForm();
                  if (validationError) {
                    setError(validationError);
                    return;
                  }

                  setSubmitting(true);
                  try {
                    const registerResult = await registerAccount({
                      firstName,
                      lastName,
                      email: email.trim().toLowerCase(),
                      password,
                    });

                    let accountId: string | null = null;
                    if (!registerResult.ok) {
                      switch (registerResult.code) {
                        case "missing_config":
                          setError(STRINGS.account.createMissingConfig);
                          return;
                        case "email_exists":
                          break;
                        case "weak_password":
                          setError(STRINGS.account.weakPassword);
                          return;
                        case "invalid_email":
                          setError(STRINGS.account.invalidEmail);
                          return;
                        default:
                          setError(STRINGS.account.createFailed);
                          return;
                      }
                    } else {
                      if (!registerResult.sessionReady) {
                        setError(STRINGS.account.emailConfirmationRequired);
                        return;
                      }
                      accountId = registerResult.account.id;
                    }

                    if (accountId === null) {
                      const loginResult = await loginAccount({
                        email,
                        password,
                      });
                      if (!loginResult.ok) {
                        if (loginResult.code === "missing_config") {
                          setError(STRINGS.account.createMissingConfig);
                          return;
                        }
                        if (loginResult.code === "invalid_credentials") {
                          setError(STRINGS.account.loginFailed);
                          return;
                        }
                        setError(STRINGS.account.createFailed);
                        return;
                      }
                      if (!loginResult.sessionReady) {
                        setError(STRINGS.account.emailConfirmationRequired);
                        return;
                      }
                      accountId = loginResult.account.id;
                    }

                    if (pendingFavoriteBeachId && accountId) {
                      const favoriteResult = await setFavoriteBeach(
                        accountId,
                        pendingFavoriteBeachId,
                        true,
                      );
                      if (!favoriteResult.ok) {
                        setError(STRINGS.account.favoriteSyncFailed);
                        return;
                      }
                    }

                    const target = new URL(safeReturnPath, window.location.origin);
                    target.searchParams.set("resume", "1");
                    window.location.assign(
                      `${target.pathname}${target.search}${target.hash}`,
                    );
                  } catch {
                    setError(STRINGS.account.createFailed);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                className="br-press w-full rounded-[10px] border border-white/25 bg-black/50 px-3 py-3.5 text-[14px] font-semibold text-slate-50 shadow-[0_8px_20px_rgba(0,0,0,0.42)] backdrop-blur-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? STRINGS.account.creatingAction
                  : STRINGS.account.createAction}
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.assign(safeReturnPath);
                }}
                className="br-press w-full rounded-[10px] border border-white/16 bg-black/35 px-3 py-3.5 text-[14px] font-semibold br-text-primary backdrop-blur-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
              >
                {STRINGS.account.cancelAndBack}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
