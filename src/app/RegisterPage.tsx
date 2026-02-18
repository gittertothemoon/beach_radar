import { useEffect, useMemo, useState } from "react";
import logo from "../assets/logo.png";
import { STRINGS } from "../i18n/it";
import { PUBLIC_BASE_URL } from "../config/publicUrl";
import {
  loginAccount,
  registerAccount,
  requestPasswordReset,
  setFavoriteBeach,
  updateAccountPassword,
} from "../lib/account";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,}$/;
const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_NUMBER = /\d/;
const HAS_SYMBOL = /[^A-Za-z0-9]/;
const MIN_PASSWORD_LENGTH = 10;

type AuthMode = "register" | "login" | "forgot" | "reset";

const RegisterPage = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const searchParams = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const authModeParam = searchParams.get("mode");
  const authMode: AuthMode =
    authModeParam === "login" || authModeParam === "forgot" || authModeParam === "reset"
      ? authModeParam
      : "register";
  const isRegisterMode = authMode === "register";
  const isLoginMode = authMode === "login";
  const isForgotMode = authMode === "forgot";
  const isResetMode = authMode === "reset";

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

  const registerModeUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete("mode");
    const query = params.toString();
    return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  }, []);

  const loginModeUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("mode", "login");
    const query = params.toString();
    return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  }, []);

  const forgotModeUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("mode", "forgot");
    const query = params.toString();
    return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  }, []);

  const resetPasswordRedirectTo = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("mode", "reset");
    params.delete("error");
    params.delete("error_code");
    params.delete("error_description");
    const query = params.toString();
    return `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ""}`;
  }, []);

  const privacyUrl = useMemo(() => {
    const url = new URL("/privacy/", PUBLIC_BASE_URL);
    const queryLang = searchParams.get("lang");
    const lang = queryLang === "en" ? "en" : "it";
    url.searchParams.set("lang", lang);
    url.searchParams.set("from", "app");
    const backPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    url.searchParams.set("back", backPath);
    return url.toString();
  }, [searchParams]);

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

  useEffect(() => {
    if (!isResetMode) return;
    const params = new URLSearchParams(window.location.search);
    const errorDescription = params.get("error_description") ?? params.get("error");
    if (!errorDescription) return;
    setError(STRINGS.account.resetPasswordInvalidLink);
  }, [isResetMode]);

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

    if (isForgotMode) {
      if (normalizedEmail.length === 0) return STRINGS.account.requiredField;
      if (!EMAIL_PATTERN.test(normalizedEmail)) return STRINGS.account.invalidEmail;
      return null;
    }

    if (isResetMode) {
      if (password.length === 0 || confirmPassword.length === 0) {
        return STRINGS.account.requiredField;
      }
      if (!isPasswordStrong) return STRINGS.account.weakPassword;
      if (password !== confirmPassword) return STRINGS.account.passwordMismatch;
      return null;
    }

    if (normalizedEmail.length === 0 || password.length === 0) {
      return STRINGS.account.requiredField;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return STRINGS.account.invalidEmail;
    }
    if (isLoginMode) {
      return null;
    }
    if (
      normalizedFirstName.length === 0 ||
      normalizedLastName.length === 0 ||
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

  const pageTitle = isLoginMode
    ? STRINGS.account.signInTitle
    : isForgotMode
      ? STRINGS.account.forgotPasswordTitle
      : isResetMode
        ? STRINGS.account.resetPasswordTitle
        : STRINGS.account.registerTitle;

  const pageSubtitle = isLoginMode
    ? STRINGS.account.signInSubtitle
    : isForgotMode
      ? STRINGS.account.forgotPasswordSubtitle
      : isResetMode
        ? STRINGS.account.resetPasswordSubtitle
        : STRINGS.account.registerSubtitle;

  const submitLabel = submitting
    ? isLoginMode
      ? STRINGS.account.signingInAction
      : isForgotMode
        ? STRINGS.account.forgotPasswordSubmittingAction
        : isResetMode
          ? STRINGS.account.resettingPasswordAction
          : STRINGS.account.creatingAction
    : isLoginMode
      ? STRINGS.account.signInSubmitAction
      : isForgotMode
        ? STRINGS.account.forgotPasswordSubmitAction
        : isResetMode
          ? STRINGS.account.resetPasswordSubmitAction
          : STRINGS.account.createAction;

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setNotice(null);
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      if (isForgotMode) {
        const forgotResult = await requestPasswordReset({
          email,
          redirectTo: resetPasswordRedirectTo,
        });
        if (!forgotResult.ok) {
          switch (forgotResult.code) {
            case "missing_config":
              setError(STRINGS.account.createMissingConfig);
              return;
            case "invalid_email":
              setError(STRINGS.account.invalidEmail);
              return;
            default:
              setError(STRINGS.account.resetPasswordRequestFailed);
              return;
          }
        }
        setNotice(STRINGS.account.forgotPasswordSent);
        return;
      }

      let accountId: string | null = null;

      if (isResetMode) {
        const resetResult = await updateAccountPassword(password);
        if (!resetResult.ok) {
          switch (resetResult.code) {
            case "missing_config":
              setError(STRINGS.account.createMissingConfig);
              return;
            case "unauthorized":
              setError(STRINGS.account.resetPasswordInvalidLink);
              return;
            case "weak_password":
              setError(STRINGS.account.weakPassword);
              return;
            default:
              setError(STRINGS.account.resetPasswordFailed);
              return;
          }
        }
        accountId = resetResult.account.id;
      } else if (isLoginMode) {
        const loginResult = await loginAccount({ email, password });
        if (!loginResult.ok) {
          if (loginResult.code === "missing_config") {
            setError(STRINGS.account.createMissingConfig);
            return;
          }
          if (loginResult.code === "invalid_credentials") {
            setError(STRINGS.account.invalidCredentials);
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
      } else {
        const registerResult = await registerAccount({
          firstName,
          lastName,
          email: email.trim().toLowerCase(),
          password,
        });
        if (!registerResult.ok) {
          switch (registerResult.code) {
            case "missing_config":
              setError(STRINGS.account.createMissingConfig);
              return;
            case "email_exists":
              setError(STRINGS.account.emailAlreadyRegistered);
              return;
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
        }
        if (!registerResult.sessionReady) {
          setError(STRINGS.account.emailConfirmationRequired);
          return;
        }
        accountId = registerResult.account.id;
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

      if (isResetMode) {
        setNotice(STRINGS.account.resetPasswordSuccess);
      }

      const target = new URL(safeReturnPath, window.location.origin);
      target.searchParams.set("resume", "1");
      window.location.assign(`${target.pathname}${target.search}${target.hash}`);
    } catch {
      if (isForgotMode) {
        setError(STRINGS.account.resetPasswordRequestFailed);
      } else if (isResetMode) {
        setError(STRINGS.account.resetPasswordFailed);
      } else {
        setError(STRINGS.account.createFailed);
      }
    } finally {
      setSubmitting(false);
    }
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
                className="h-auto w-24 drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)] sm:w-28"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-end justify-between gap-x-2.5 gap-y-1.5">
              <h1 className="text-[22px] font-semibold tracking-[-0.015em] br-text-primary sm:text-[24px]">
                {pageTitle}
              </h1>
              {beachName && !isForgotMode && !isResetMode ? (
                <div className="max-w-full shrink-0 truncate rounded-full border border-amber-300/45 bg-amber-400/12 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                  {beachName}
                </div>
              ) : null}
            </div>

            <p className="mt-2 text-[13px] leading-snug br-text-secondary">{pageSubtitle}</p>

            <div className="mt-4 grid grid-cols-1 gap-x-2.5 gap-y-3.5 min-[390px]:grid-cols-2">
              {isRegisterMode ? (
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
                      setNotice(null);
                    }}
                    placeholder={STRINGS.account.firstNamePlaceholder}
                    className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                    autoFocus
                  />
                </label>
              ) : null}

              {isRegisterMode ? (
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
                      setNotice(null);
                    }}
                    placeholder={STRINGS.account.lastNamePlaceholder}
                    className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                  />
                </label>
              ) : null}

              {!isResetMode ? (
                <label className="col-span-full block">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                    {STRINGS.account.emailLabel}
                  </span>
                  <input
                    data-testid="auth-email-input"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError(null);
                      setNotice(null);
                    }}
                    placeholder={STRINGS.account.emailPlaceholder}
                    className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                    autoFocus={isLoginMode || isForgotMode}
                  />
                </label>
              ) : null}

              {!isForgotMode ? (
                <label className={isLoginMode ? "col-span-full block" : "block"}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                    {STRINGS.account.passwordLabel}
                  </span>
                  <input
                    data-testid="auth-password-input"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError(null);
                      setNotice(null);
                    }}
                    placeholder={STRINGS.account.passwordPlaceholder}
                    className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                    autoFocus={isResetMode}
                  />
                </label>
              ) : null}

              {isRegisterMode || isResetMode ? (
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
                      setNotice(null);
                    }}
                    placeholder={STRINGS.account.confirmPasswordPlaceholder}
                    className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                  />
                </label>
              ) : null}

              {isRegisterMode || isResetMode ? (
                <div className="col-span-full rounded-[10px] border border-white/12 bg-black/30 px-3 py-2.5 text-[11px] leading-snug br-text-tertiary">
                  {STRINGS.account.passwordHint}
                </div>
              ) : null}

              {isRegisterMode ? (
                <label className="col-span-full flex items-start gap-2.5 rounded-[10px] border border-white/12 bg-black/30 px-3 py-2.5 text-[12px] leading-snug br-text-secondary">
                  <input
                    type="checkbox"
                    checked={consentAccepted}
                    onChange={(event) => {
                      setConsentAccepted(event.target.checked);
                      setError(null);
                      setNotice(null);
                    }}
                    className="mt-[1px] h-4 w-4 shrink-0 accent-sky-400"
                  />
                  <span>
                    {STRINGS.account.consentLabel}{" "}
                    <a
                      href={privacyUrl}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      Privacy
                    </a>
                  </span>
                </label>
              ) : null}
            </div>

            {error ? (
              <div className="mt-3.5 rounded-[10px] border border-rose-300/60 bg-rose-500/25 px-3 py-2.5 text-[12px] text-rose-50">
                {error}
              </div>
            ) : null}

            {notice ? (
              <div className="mt-3.5 rounded-[10px] border border-emerald-300/45 bg-emerald-500/15 px-3 py-2.5 text-[12px] text-emerald-50">
                {notice}
              </div>
            ) : null}

            <div className="mt-5 space-y-3 border-t border-white/8 pt-4">
              <button
                type="button"
                disabled={submitting}
                data-testid="auth-submit"
                onClick={() => {
                  void handleSubmit();
                }}
                className="br-press w-full rounded-[10px] border border-white/25 bg-black/50 px-3 py-3.5 text-[14px] font-semibold text-slate-50 shadow-[0_8px_20px_rgba(0,0,0,0.42)] backdrop-blur-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitLabel}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isForgotMode || isResetMode) {
                    window.location.assign(loginModeUrl);
                    return;
                  }
                  window.location.assign(safeReturnPath);
                }}
                className="br-press w-full rounded-[10px] border border-white/16 bg-black/35 px-3 py-3.5 text-[14px] font-semibold br-text-primary backdrop-blur-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
              >
                {isForgotMode || isResetMode
                  ? STRINGS.account.backToLoginAction
                  : STRINGS.account.cancelAndBack}
              </button>

              {isLoginMode ? (
                <>
                  <div className="rounded-[10px] border border-white/12 bg-black/25 px-3 py-3 text-center">
                    <p className="text-[12px] leading-snug br-text-secondary">
                      {STRINGS.account.forgotPasswordPrompt}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          window.location.assign(forgotModeUrl);
                        }}
                        className="font-semibold text-sky-200 underline decoration-sky-200/70 underline-offset-2 transition-colors hover:text-sky-100"
                      >
                        {STRINGS.account.forgotPasswordAction}
                      </button>
                    </p>
                  </div>

                  <div className="rounded-[10px] border border-white/12 bg-black/25 px-3 py-3 text-center">
                    <p className="text-[12px] leading-snug br-text-secondary">
                      {STRINGS.account.signInNoAccountPrompt}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          window.location.assign(registerModeUrl);
                        }}
                        className="font-semibold text-sky-200 underline decoration-sky-200/70 underline-offset-2 transition-colors hover:text-sky-100"
                      >
                        {STRINGS.account.signInNoAccountAction}
                      </button>
                    </p>
                  </div>
                </>
              ) : null}

              {isRegisterMode ? (
                <div className="rounded-[10px] border border-white/12 bg-black/25 px-3 py-3 text-center">
                  <p className="text-[12px] leading-snug br-text-secondary">
                    {STRINGS.account.registerHasAccountPrompt}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        window.location.assign(loginModeUrl);
                      }}
                      className="font-semibold text-sky-200 underline decoration-sky-200/70 underline-offset-2 transition-colors hover:text-sky-100"
                    >
                      {STRINGS.account.registerHasAccountAction}
                    </button>
                  </p>
                </div>
              ) : null}

              {isResetMode ? (
                <div className="rounded-[10px] border border-white/12 bg-black/25 px-3 py-3 text-center">
                  <p className="text-[12px] leading-snug br-text-secondary">
                    {STRINGS.account.resetPasswordRequestAgainPrompt}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        window.location.assign(forgotModeUrl);
                      }}
                      className="font-semibold text-sky-200 underline decoration-sky-200/70 underline-offset-2 transition-colors hover:text-sky-100"
                    >
                      {STRINGS.account.resetPasswordRequestAgainAction}
                    </button>
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
