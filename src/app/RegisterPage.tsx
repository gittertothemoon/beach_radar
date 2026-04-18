import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from "react";
import logo from "../assets/logo.png";
import { STRINGS } from "../i18n/strings";
import { PUBLIC_BASE_URL } from "../config/publicUrl";
import {
  getAppSessionErrorMessage,
  getForgotPasswordErrorMessage,
  getLoginErrorMessage,
  getRegisterErrorMessage,
  getResetPasswordErrorMessage,
} from "../lib/authErrorCopy";
import {
  completeOAuthProfile,
  ensureAppSession,
  getOAuthSignInUrl,
  isNativeShellAuthContext,
  isOAuthProfileComplete,
  loginAccount,
  NATIVE_OAUTH_REDIRECT_URL,
  registerAccount,
  requestPasswordReset,
  setFavoriteBeach,
  signInWithOAuth,
  signOutAccount,
  subscribeAuthSignIn,
  updateAccountPassword,
  type AppAccount,
  type OAuthProvider,
} from "../lib/account";
import {
  DEFAULT_LEGAL_INTERNAL_PATHS,
  EMAIL_PATTERN,
  FORGOT_PASSWORD_FAST_NOTICE_MS,
  HAS_LOWERCASE,
  HAS_NUMBER,
  HAS_SYMBOL,
  HAS_UPPERCASE,
  hasNonDeliverableDomain,
  isExternalHref,
  MIN_PASSWORD_LENGTH,
  NAME_PATTERN,
  NICKNAME_PATTERN,
  normalizePathname,
  type RuntimeLegalConfig,
  type WindowWithLegalConfig,
} from "./registerPageUtils";

type AuthMode = "register" | "login" | "forgot" | "reset";
type NoticeTone = "success" | "info";

const AppleIcon = () => (
  <svg width="16" height="19" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
  </svg>
);

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
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [oauthPendingAccount, setOauthPendingAccount] = useState<AppAccount | null>(null);
  const [oauthButtonPending, setOauthButtonPending] = useState<OAuthProvider | null>(null);
  const [oauthCallbackLoading, setOauthCallbackLoading] = useState(() => {
    if (window.location.hash.includes("access_token")) return true;
    return new URLSearchParams(window.location.search).has("code");
  });

  const searchParams = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const isNativeShell = useMemo(() => isNativeShellAuthContext(), []);
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

  // Strips OAuth callback params (?code, ?state, ?error) so landing on this
  // URL doesn't trigger the code-exchange flow again.
  const cleanLoginUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("mode", "login");
    for (const key of ["code", "state", "error", "error_code", "error_description"]) {
      params.delete(key);
    }
    const query = params.toString();
    return `${window.location.pathname}${query ? `?${query}` : ""}`;
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

  const internalLegalUrls = useMemo(() => {
    const queryLang = searchParams.get("lang");
    const lang = queryLang === "en" ? "en" : "it";
    const backPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const withContext = (pathname: string) => {
      const url = new URL(pathname, PUBLIC_BASE_URL);
      url.searchParams.set("lang", lang);
      url.searchParams.set("from", "app");
      url.searchParams.set("back", backPath);
      return url.toString();
    };
    return {
      privacy: withContext(DEFAULT_LEGAL_INTERNAL_PATHS.privacy),
      cookie: withContext(DEFAULT_LEGAL_INTERNAL_PATHS.cookie),
    };
  }, [searchParams]);

  const [runtimeLegalConfig, setRuntimeLegalConfig] = useState<RuntimeLegalConfig>(() => {
    if (typeof window === "undefined") return {};
    const browserWindow = window as WindowWithLegalConfig;
    return browserWindow.W2B_LEGAL_CONFIG ?? {};
  });

  useEffect(() => {
    const handleLegalConfigReady = (event: Event) => {
      const detail = (event as CustomEvent<RuntimeLegalConfig>).detail;
      if (!detail || typeof detail !== "object") return;
      setRuntimeLegalConfig(detail);
    };

    window.addEventListener(
      "w2b:legal-config-ready",
      handleLegalConfigReady as EventListener,
    );
    return () => {
      window.removeEventListener(
        "w2b:legal-config-ready",
        handleLegalConfigReady as EventListener,
      );
    };
  }, []);

  const legalLinks = useMemo(() => {
    const resolve = (rawValue: string | undefined, fallback: string, internalPath: string) => {
      if (!rawValue || rawValue.trim().length === 0) return fallback;

      try {
        const parsed = new URL(rawValue, PUBLIC_BASE_URL);
        const parsedPath = normalizePathname(parsed.pathname);
        const normalizedInternal = normalizePathname(internalPath);

        if (parsed.origin === window.location.origin && parsedPath === normalizedInternal) {
          const fallbackUrl = new URL(fallback);
          fallbackUrl.searchParams.forEach((value, key) => {
            if (!parsed.searchParams.has(key)) {
              parsed.searchParams.set(key, value);
            }
          });
        }

        return parsed.toString();
      } catch {
        return fallback;
      }
    };

    return {
      privacyUrl: resolve(
        runtimeLegalConfig.privacyUrl,
        internalLegalUrls.privacy,
        DEFAULT_LEGAL_INTERNAL_PATHS.privacy,
      ),
      cookieUrl: resolve(
        runtimeLegalConfig.cookieUrl,
        internalLegalUrls.cookie,
        DEFAULT_LEGAL_INTERNAL_PATHS.cookie,
      ),
    };
  }, [internalLegalUrls, runtimeLegalConfig]);

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

  const pageTitle = isCompletingProfile
    ? STRINGS.account.completeProfileTitle
    : isLoginMode
      ? STRINGS.account.signInTitle
      : isForgotMode
        ? STRINGS.account.forgotPasswordTitle
        : isResetMode
          ? STRINGS.account.resetPasswordTitle
          : STRINGS.account.registerTitle;

  const pageSubtitle = isCompletingProfile
    ? STRINGS.account.completeProfileSubtitle
    : isLoginMode
      ? STRINGS.account.signInSubtitle
      : isForgotMode
        ? STRINGS.account.forgotPasswordSubtitle
        : isResetMode
          ? STRINGS.account.resetPasswordSubtitle
          : STRINGS.account.registerSubtitle;

  const submitLabel = submitting
    ? isCompletingProfile
      ? STRINGS.account.completingProfileAction
      : isLoginMode
        ? STRINGS.account.signingInAction
        : isForgotMode
          ? STRINGS.account.forgotPasswordSubmittingAction
          : isResetMode
            ? STRINGS.account.resettingPasswordAction
            : STRINGS.account.creatingAction
    : isCompletingProfile
      ? STRINGS.account.completeProfileAction
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

  const handleOAuthSignInComplete = async (accountId: string) => {
    try {
      if (pendingFavoriteBeachId) {
        await setFavoriteBeach(accountId, pendingFavoriteBeachId, true);
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
      showError(STRINGS.account.loginNetworkFailed);
    }
  };

  const handleOAuthSignIn = async (provider: OAuthProvider) => {
    if (oauthButtonPending) return;
    setOauthButtonPending(provider);
    setError(null);

    if (isNativeShell) {
      const urlResult = await getOAuthSignInUrl(provider, NATIVE_OAUTH_REDIRECT_URL);
      if (!urlResult.ok) {
        setOauthButtonPending(null);
        showError(STRINGS.account.oauthSignInFailed);
        return;
      }
      const rn = (window as unknown as {
        ReactNativeWebView?: { postMessage: (msg: string) => void };
      }).ReactNativeWebView;
      if (!rn?.postMessage) {
        setOauthButtonPending(null);
        showError(STRINGS.account.oauthSignInFailed);
        return;
      }
      rn.postMessage(
        JSON.stringify({ type: "w2b-oauth-open", provider, url: urlResult.url }),
      );
      return;
    }

    const result = await signInWithOAuth(provider);
    if (!result.ok) {
      setOauthButtonPending(null);
      showError(STRINGS.account.oauthSignInFailed);
    }
  };

  const handleProfileCompletion = async () => {
    const normalizedNickname = nickname.trim();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    if (!normalizedNickname || !normalizedFirstName || !normalizedLastName) {
      showError(STRINGS.account.requiredField);
      return;
    }
    if (!NICKNAME_PATTERN.test(normalizedNickname)) {
      showError(STRINGS.account.invalidNickname);
      return;
    }
    if (
      !NAME_PATTERN.test(normalizedFirstName) ||
      !NAME_PATTERN.test(normalizedLastName)
    ) {
      showError(STRINGS.account.invalidName);
      return;
    }
    if (!consentAccepted) {
      showError(STRINGS.account.consentRequired);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await completeOAuthProfile({
        nickname: normalizedNickname,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
      });

      if (!result.ok) {
        if (result.code === "nickname_exists") {
          showError(STRINGS.account.nicknameAlreadyInUse);
        } else if (result.code === "network") {
          showError(STRINGS.account.createNetworkFailed);
        } else {
          showError(STRINGS.account.createFailed);
        }
        return;
      }

      await handleOAuthSignInComplete(result.account.id);
    } catch {
      showError(STRINGS.account.createNetworkFailed);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isCompletingProfile || !oauthPendingAccount) return;
    if (oauthPendingAccount.firstName) setFirstName(oauthPendingAccount.firstName);
    if (oauthPendingAccount.lastName) setLastName(oauthPendingAccount.lastName);
  }, [isCompletingProfile, oauthPendingAccount]);

  useEffect(() => {
    if (!isNativeShell) return;
    const handleCancelled = () => {
      setOauthButtonPending(null);
    };
    window.addEventListener("w2b-oauth-cancelled", handleCancelled);
    return () => window.removeEventListener("w2b-oauth-cancelled", handleCancelled);
  }, [isNativeShell]);

  useEffect(() => {
    const hasCallbackTokens =
      window.location.hash.includes("access_token") ||
      new URLSearchParams(window.location.search).has("code");
    if (!hasCallbackTokens) return;

    const unsubscribe = subscribeAuthSignIn((account) => {
      unsubscribe();
      setOauthCallbackLoading(false);
      if (!isOAuthProfileComplete(account)) {
        setOauthPendingAccount(account);
        setIsCompletingProfile(true);
        return;
      }
      void handleOAuthSignInComplete(account.id);
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleProfileCompletionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    void handleProfileCompletion();
  };

  const handleCancelProfileCompletion = async () => {
    // The user authenticated via OAuth but doesn't want to finish picking a
    // nickname. Sign them out so the next `/register/?mode=login` visit
    // actually shows the login form instead of immediately re-running the
    // code exchange and landing back on this screen.
    if (submitting) return;
    setSubmitting(true);
    try {
      await signOutAccount();
    } finally {
      window.location.assign(cleanLoginUrl);
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

            {oauthCallbackLoading ? (
              <div className="mt-8 flex flex-col items-center gap-4 py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-sky-400" />
                <p className="text-center text-[13px] br-text-secondary">{STRINGS.account.oauthProcessing}</p>
              </div>
            ) : (
            <form onSubmit={isCompletingProfile ? handleProfileCompletionSubmit : handleFormSubmit} noValidate autoComplete="on">
              {(isLoginMode || isRegisterMode) && !isCompletingProfile ? (
                <div className="mt-4 space-y-2.5">
                  <button
                    type="button"
                    disabled={oauthButtonPending !== null}
                    onClick={() => void handleOAuthSignIn("apple")}
                    className="br-press flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#050505] px-3 py-3 text-[14px] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] disabled:opacity-60"
                  >
                    <AppleIcon />
                    {oauthButtonPending === "apple" ? "..." : STRINGS.account.oauthSignInWithApple}
                  </button>
                  <button
                    type="button"
                    disabled={oauthButtonPending !== null}
                    onClick={() => void handleOAuthSignIn("google")}
                    className="br-press flex w-full items-center justify-center gap-2 rounded-[10px] bg-white px-3 py-3 text-[14px] font-semibold text-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.25)] disabled:opacity-60"
                  >
                    <GoogleIcon />
                    {oauthButtonPending === "google" ? "..." : STRINGS.account.oauthSignInWithGoogle}
                  </button>
                  <div className="flex items-center gap-3 pt-0.5">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[11px] br-text-tertiary">{STRINGS.account.oauthOrContinueWithEmail}</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-x-2.5 gap-y-3.5 min-[390px]:grid-cols-2">
                {isRegisterMode || isCompletingProfile ? (
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                      {STRINGS.account.firstNameLabel}
                    </span>
                    <input
                      type="text"
                      id="given-name"
                      name="given-name"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(event) => {
                        setFirstName(event.target.value);
                        setError(null);
                        setNotice(null);
                      }}
                      placeholder={STRINGS.account.firstNamePlaceholder}
                      className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                      autoFocus={isRegisterMode}
                    />
                  </label>
                ) : null}

                {isRegisterMode || isCompletingProfile ? (
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                      {STRINGS.account.lastNameLabel}
                    </span>
                    <input
                      type="text"
                      id="family-name"
                      name="family-name"
                      autoComplete="family-name"
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

                {isRegisterMode || isCompletingProfile ? (
                  <label className="col-span-full block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                      {STRINGS.account.nicknameLabel}
                    </span>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      autoComplete="username"
                      value={nickname}
                      onChange={(event) => {
                        setNickname(event.target.value);
                        setError(null);
                        setNotice(null);
                      }}
                      placeholder={STRINGS.account.nicknamePlaceholder}
                      autoCapitalize="none"
                      spellCheck={false}
                      autoFocus={isCompletingProfile}
                      className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                    />
                  </label>
                ) : null}

                {!isResetMode && !isCompletingProfile ? (
                  <label className="col-span-full block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                      {STRINGS.account.emailLabel}
                    </span>
                    <input
                      data-testid="auth-email-input"
                      type="email"
                      name={isLoginMode ? "username" : "email"}
                      autoComplete={isLoginMode ? "username" : "email"}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      inputMode="email"
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

                {!isForgotMode && !isCompletingProfile ? (
                  <label className={isLoginMode ? "col-span-full block" : "block"}>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                      {STRINGS.account.passwordLabel}
                    </span>
                    <input
                      key={`password-${showPasswords ? "visible" : "hidden"}`}
                      data-testid="auth-password-input"
                      type={showPasswords ? "text" : "password"}
                      name={isLoginMode ? "current-password" : "new-password"}
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
                      name="confirm-password"
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

                {!isForgotMode && !isCompletingProfile ? (
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

                {isRegisterMode || isCompletingProfile ? (
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
                        href={legalLinks.privacyUrl}
                        {...(isExternalHref(legalLinks.privacyUrl)
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        Privacy
                      </a>{" "}
                      ·{" "}
                      <a
                        href={legalLinks.cookieUrl}
                        {...(isExternalHref(legalLinks.cookieUrl)
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        Cookie
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
                  if (isCompletingProfile) {
                    void handleCancelProfileCompletion();
                    return;
                  }
                  if (isForgotMode || isResetMode) {
                    window.location.assign(loginModeUrl);
                    return;
                  }
                  window.location.assign(safeReturnPath);
                }}
                className="br-press w-full rounded-[10px] border border-white/16 bg-black/35 px-3 py-3.5 text-[14px] font-semibold br-text-primary backdrop-blur-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
              >
                {isCompletingProfile || isForgotMode || isResetMode
                  ? STRINGS.account.backToLoginAction
                  : STRINGS.account.cancelAndBack}
              </button>

              {isLoginMode && !isCompletingProfile ? (
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

              {isRegisterMode && !isCompletingProfile ? (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
