import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from "react";
import logo from "../assets/logo.png";
import { STRINGS } from "../i18n/it";
import { PUBLIC_BASE_URL } from "../config/publicUrl";
import {
  getAppSessionErrorMessage,
  getForgotPasswordErrorMessage,
  getLoginErrorMessage,
  getRegisterErrorMessage,
  getResetPasswordErrorMessage,
} from "../lib/authErrorCopy";
import {
  ensureAppSession,
  loginAccount,
  registerAccount,
  requestPasswordReset,
  setFavoriteBeach,
  updateAccountPassword,
} from "../lib/account";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]{2,}$/;
const NICKNAME_PATTERN = /^[A-Za-z0-9._-]{3,24}$/;
const NON_DELIVERABLE_EMAIL_DOMAINS = new Set([
  "example.com",
  "example.net",
  "example.org",
]);
const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_NUMBER = /\d/;
const HAS_SYMBOL = /[^A-Za-z0-9]/;
const MIN_PASSWORD_LENGTH = 10;

type AuthMode = "register" | "login" | "forgot" | "reset";
type NoticeTone = "success" | "info";
const FORGOT_PASSWORD_FAST_NOTICE_MS = 700;

const hasNonDeliverableDomain = (emailValue: string): boolean => {
  const atIndex = emailValue.lastIndexOf("@");
  if (atIndex <= 0) return false;
  const domain = emailValue.slice(atIndex + 1).toLowerCase();
  return NON_DELIVERABLE_EMAIL_DOMAINS.has(domain);
};

const RegisterPage = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("success");

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

  const returnToRaw = searchParams.get("returnTo") || "/app/";
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
    const isLocalHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    const baseUrl = (isLocalHost ? window.location.origin : PUBLIC_BASE_URL).replace(
      /\/+$/,
      "",
    );
    return `${baseUrl}/register/${query ? `?${query}` : ""}`;
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
    const normalizedNickname = nickname.trim();
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
      if (password !== confirmPassword) return STRINGS.account.passwordMismatch;
      if (!isPasswordStrong) return STRINGS.account.weakPassword;
      return null;
    }

    if (normalizedEmail.length === 0 || password.length === 0) {
      return STRINGS.account.requiredField;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return STRINGS.account.invalidEmail;
    }
    if (!isLoginMode && hasNonDeliverableDomain(normalizedEmail)) {
      return STRINGS.account.invalidEmail;
    }
    if (isLoginMode) {
      return null;
    }
    if (
      normalizedFirstName.length === 0 ||
      normalizedLastName.length === 0 ||
      normalizedNickname.length === 0 ||
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
    if (!NICKNAME_PATTERN.test(normalizedNickname)) {
      return STRINGS.account.invalidNickname;
    }
    if (password !== confirmPassword) {
      return STRINGS.account.passwordMismatch;
    }
    if (!isPasswordStrong) {
      return STRINGS.account.weakPassword;
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

  const passwordFieldStyle = {
    WebkitTextSecurity: showPasswords ? "none" : "disc",
  } as CSSProperties;

  const showNotice = (message: string, tone: NoticeTone = "success") => {
    setError(null);
    setNoticeTone(tone);
    setNotice(message);
  };

  const showError = (message: string) => {
    setNotice(null);
    setNoticeTone("success");
    setError(message);
  };

  const showEmailConfirmationRequiredNotice = () => {
    showNotice(STRINGS.account.emailConfirmationRequired, "info");
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setNotice(null);
      setNoticeTone("success");
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    setNoticeTone("success");

    try {
      if (isForgotMode) {
        const forgotPromise = requestPasswordReset({
          email,
          redirectTo: resetPasswordRedirectTo,
        });

        const earlyResult = await Promise.race([
          forgotPromise.then((result) => ({ type: "result" as const, result })),
          new Promise<{ type: "timeout" }>((resolve) => {
            window.setTimeout(() => resolve({ type: "timeout" }), FORGOT_PASSWORD_FAST_NOTICE_MS);
          }),
        ]);

        if (earlyResult.type === "result") {
          const forgotResult = earlyResult.result;
          if (!forgotResult.ok) {
            showError(getForgotPasswordErrorMessage(forgotResult.code));
            return;
          }
          showNotice(STRINGS.account.forgotPasswordSent, "success");
          return;
        }

        showNotice(STRINGS.account.forgotPasswordSent, "success");
        void forgotPromise.then((forgotResult) => {
          if (!forgotResult.ok) {
            showError(getForgotPasswordErrorMessage(forgotResult.code));
          }
        }).catch(() => {
          showError(STRINGS.account.resetPasswordRequestNetworkFailed);
        });
        return;
      }

      let accountId: string | null = null;

      if (isResetMode) {
        const resetResult = await updateAccountPassword(password);
        if (!resetResult.ok) {
          showError(getResetPasswordErrorMessage(resetResult.code));
          return;
        }
        accountId = resetResult.account.id;
      } else if (isLoginMode) {
        const loginResult = await loginAccount({ email, password });
        if (!loginResult.ok) {
          if (loginResult.code === "email_not_confirmed") {
            showEmailConfirmationRequiredNotice();
            return;
          }
          showError(getLoginErrorMessage(loginResult.code));
          return;
        }
        if (!loginResult.sessionReady) {
          showEmailConfirmationRequiredNotice();
          return;
        }
        accountId = loginResult.account.id;
      } else {
        const registerResult = await registerAccount({
          firstName,
          lastName,
          nickname,
          email: email.trim().toLowerCase(),
          password,
        });
        if (!registerResult.ok) {
          showError(getRegisterErrorMessage(registerResult.code));
          return;
        }
        if (!registerResult.sessionReady) {
          showEmailConfirmationRequiredNotice();
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
        showNotice(STRINGS.account.resetPasswordSuccess, "success");
      }

      const target = new URL(safeReturnPath, window.location.origin);
      const needsAppSession =
        target.pathname === "/app" || target.pathname.startsWith("/app/");
      if (needsAppSession) {
        const appSessionResult = await ensureAppSession();
        if (!appSessionResult.ok) {
          showError(getAppSessionErrorMessage(appSessionResult.code));
          return;
        }
      }
      target.searchParams.set("resume", "1");
      window.location.assign(`${target.pathname}${target.search}${target.hash}`);
    } catch {
      if (isForgotMode) {
        showError(STRINGS.account.resetPasswordRequestNetworkFailed);
      } else if (isResetMode) {
        showError(STRINGS.account.resetPasswordNetworkFailed);
      } else if (isLoginMode) {
        showError(STRINGS.account.loginNetworkFailed);
      } else {
        showError(STRINGS.account.createNetworkFailed);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    void handleSubmit();
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

            <form onSubmit={handleFormSubmit} noValidate>
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

                {isRegisterMode ? (
                  <label className="col-span-full block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                      {STRINGS.account.nicknameLabel}
                    </span>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(event) => {
                        setNickname(event.target.value);
                        setError(null);
                        setNotice(null);
                      }}
                      placeholder={STRINGS.account.nicknamePlaceholder}
                      autoCapitalize="none"
                      spellCheck={false}
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
                      key={`password-${showPasswords ? "visible" : "hidden"}`}
                      data-testid="auth-password-input"
                      type={showPasswords ? "text" : "password"}
                      autoComplete={isLoginMode ? "current-password" : "new-password"}
                      autoCapitalize="none"
                      spellCheck={false}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError(null);
                        setNotice(null);
                      }}
                      placeholder={STRINGS.account.passwordPlaceholder}
                      className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                      style={passwordFieldStyle}
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
                      key={`confirm-password-${showPasswords ? "visible" : "hidden"}`}
                      type={showPasswords ? "text" : "password"}
                      autoComplete="new-password"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setError(null);
                        setNotice(null);
                      }}
                      placeholder={STRINGS.account.confirmPasswordPlaceholder}
                      className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                      style={passwordFieldStyle}
                    />
                  </label>
                ) : null}

                {isRegisterMode || isResetMode ? (
                  <div className="col-span-full rounded-[10px] border border-white/12 bg-black/30 px-3 py-2.5 text-[11px] leading-snug br-text-tertiary">
                    {STRINGS.account.passwordHint}
                  </div>
                ) : null}

                {!isForgotMode ? (
                  <label className="col-span-full flex items-center gap-2.5 rounded-[10px] border border-white/12 bg-black/30 px-3 py-2.5 text-[12px] leading-snug br-text-secondary">
                    <input
                      type="checkbox"
                      checked={showPasswords}
                      onChange={(event) => {
                        setShowPasswords(event.target.checked);
                      }}
                      className="h-4 w-4 shrink-0 accent-sky-400"
                    />
                    <span>{STRINGS.account.showPasswordsAction}</span>
                  </label>
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
              <div
                className={`mt-3.5 rounded-[10px] px-3 py-2.5 text-[12px] ${
                  noticeTone === "info"
                    ? "border border-sky-300/45 bg-sky-500/15 text-sky-50"
                    : "border border-emerald-300/45 bg-emerald-500/15 text-emerald-50"
                }`}
              >
                {notice}
              </div>
            ) : null}

              <div className="mt-5 space-y-3 border-t border-white/8 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="auth-submit"
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
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
