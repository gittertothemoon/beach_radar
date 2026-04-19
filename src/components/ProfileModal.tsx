import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { STRINGS } from "../i18n/strings";
import type { ActiveBadge } from "../lib/activeBadge";
import BadgeIcon from "./BadgeIcon";

type UpdateProfileInput = {
  firstName: string;
  lastName: string;
  nickname: string;
};

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; code: "nickname_exists" | "invalid" | "network" | "unknown" };

type ProfileModalProps = {
  isOpen: boolean;
  name: string | null;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string;
  favoriteBeaches: {
    id: string;
    name: string;
    region: string;
  }[];
  activeBadge: ActiveBadge | null;
  deleting: boolean;
  onClose: () => void;
  onSelectFavorite: (beachId: string) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  onUpdateProfile: (input: UpdateProfileInput) => Promise<UpdateProfileResult>;
  onRestartTutorial?: () => void;
};

const NAME_PATTERN = /^[\p{L}'\- ]+$/u;
const NICKNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const NICKNAME_MIN = 3;
const NICKNAME_MAX = 24;

const ProfileModal = ({
  isOpen,
  name,
  email,
  firstName,
  lastName,
  nickname,
  favoriteBeaches,
  activeBadge,
  deleting,
  onClose,
  onSelectFavorite,
  onSignOut,
  onDeleteAccount,
  onUpdateProfile,
  onRestartTutorial,
}: ProfileModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState(firstName);
  const [editLastName, setEditLastName] = useState(lastName);
  const [editNickname, setEditNickname] = useState(nickname);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setEditing(false);
      setError(null);
      setNotice(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setEditFirstName(firstName);
    setEditLastName(lastName);
    setEditNickname(nickname);
  }, [firstName, lastName, nickname]);

  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;
    const focusables = container.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    focusables[0]?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const hasChanges = useMemo(() => {
    return (
      editFirstName.trim() !== firstName.trim() ||
      editLastName.trim() !== lastName.trim() ||
      editNickname.trim() !== nickname.trim()
    );
  }, [editFirstName, editLastName, editNickname, firstName, lastName, nickname]);

  const validateForm = (): string | null => {
    const f = editFirstName.trim();
    const l = editLastName.trim();
    const n = editNickname.trim();
    if (f.length === 0 || l.length === 0 || n.length === 0) {
      return STRINGS.account.requiredField;
    }
    if (!NAME_PATTERN.test(f) || !NAME_PATTERN.test(l)) {
      return STRINGS.account.invalidName;
    }
    if (n.length < NICKNAME_MIN || n.length > NICKNAME_MAX || !NICKNAME_PATTERN.test(n)) {
      return STRINGS.account.invalidNickname;
    }
    return null;
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    const validationError = validateForm();
    if (validationError) {
      setNotice(null);
      setError(validationError);
      return;
    }
    if (!hasChanges) {
      setError(null);
      setNotice(null);
      setEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await onUpdateProfile({
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        nickname: editNickname.trim(),
      });
      if (result.ok) {
        setNotice(STRINGS.account.editProfileSuccess);
        setEditing(false);
        return;
      }
      if (result.code === "nickname_exists") {
        setError(STRINGS.account.nicknameAlreadyInUse);
      } else if (result.code === "invalid") {
        setError(STRINGS.account.invalidNickname);
      } else if (result.code === "network") {
        setError(STRINGS.account.createNetworkFailed);
      } else {
        setError(STRINGS.account.editProfileFailed);
      }
    } catch {
      setError(STRINGS.account.editProfileFailed);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditFirstName(firstName);
    setEditLastName(lastName);
    setEditNickname(nickname);
    setEditing(false);
    setError(null);
    setNotice(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/78 px-0 pb-0 sm:items-center sm:px-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={STRINGS.account.profileTitle}
        className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-t-[24px] border border-white/18 bg-[rgba(7,10,14,0.96)] shadow-[0_24px_70px_-30px_rgba(0,0,0,0.82)] sm:rounded-[20px]"
        style={{ maxHeight: "calc(90 * var(--svh, 1vh))" }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[env(safe-area-inset-bottom,16px)] pt-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-[20px] font-semibold br-text-primary">
              {editing ? STRINGS.account.editProfileTitle : STRINGS.account.profileTitle}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="br-press rounded-full border border-white/25 bg-black/85 px-3 py-1 text-[11px] font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
            >
              {STRINGS.actions.close}
            </button>
          </div>

          {/* Edit form */}
          {editing ? (
            <form onSubmit={handleEditSubmit} noValidate className="mt-3 space-y-3">
              <p className="text-[12px] br-text-secondary">
                {STRINGS.account.editProfileSubtitle}
              </p>
              <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                    {STRINGS.account.firstNameLabel}
                  </span>
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(event) => {
                      setEditFirstName(event.target.value);
                      setError(null);
                      setNotice(null);
                    }}
                    placeholder={STRINGS.account.firstNamePlaceholder}
                    autoComplete="given-name"
                    className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                    {STRINGS.account.lastNameLabel}
                  </span>
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(event) => {
                      setEditLastName(event.target.value);
                      setError(null);
                      setNotice(null);
                    }}
                    placeholder={STRINGS.account.lastNamePlaceholder}
                    autoComplete="family-name"
                    className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.09em] br-text-tertiary">
                  {STRINGS.account.nicknameLabel}
                </span>
                <input
                  type="text"
                  value={editNickname}
                  onChange={(event) => {
                    setEditNickname(event.target.value);
                    setError(null);
                    setNotice(null);
                  }}
                  placeholder={STRINGS.account.nicknamePlaceholder}
                  autoCapitalize="none"
                  autoComplete="username"
                  spellCheck={false}
                  className="mt-2 w-full rounded-[10px] border border-white/20 bg-black/40 px-3 py-2.5 text-[14px] br-text-primary placeholder:text-[color:var(--text-tertiary)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                />
              </label>

              {error ? (
                <div className="rounded-[10px] border border-rose-300/60 bg-rose-500/25 px-3 py-2.5 text-[12px] text-rose-50">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving || !hasChanges}
                  className="br-press w-full rounded-[11px] border border-white/25 bg-black/85 px-3 py-2.5 text-[13px] font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? STRINGS.account.editProfileSavingAction
                    : STRINGS.account.editProfileSaveAction}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="br-press w-full rounded-[11px] border border-white/18 bg-black/50 px-3 py-2.5 text-[13px] font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {STRINGS.account.editProfileCancelAction}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Account info */}
              <div className="mt-3 rounded-[12px] border border-white/20 bg-black/82 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] br-text-tertiary">
                      {STRINGS.account.signedInAs}
                    </div>
                    {name ? (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="truncate text-[14px] font-semibold br-text-primary">{name}</div>
                        {activeBadge ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/35 bg-amber-500/15 px-2 py-0.5">
                            <BadgeIcon icon={activeBadge.icon} size={13} className="text-amber-200/90" />
                            <span className="text-[10px] font-semibold text-amber-200/90">
                              {STRINGS.badges[activeBadge.code as keyof typeof STRINGS.badges]?.name ?? activeBadge.name}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="truncate text-[13px] br-text-secondary">{email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditFirstName(firstName);
                      setEditLastName(lastName);
                      setEditNickname(nickname);
                      setError(null);
                      setNotice(null);
                      setEditing(true);
                    }}
                    className="br-press shrink-0 rounded-full border border-white/25 bg-black/85 px-3 py-1 text-[11px] font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                  >
                    {STRINGS.account.editProfileAction}
                  </button>
                </div>
              </div>

              {notice ? (
                <div className="mt-3 rounded-[10px] border border-emerald-300/45 bg-emerald-500/15 px-3 py-2 text-[12px] text-emerald-50">
                  {notice}
                </div>
              ) : null}

              {/* Favorites */}
              <div className="mt-3 rounded-[12px] border border-white/20 bg-black/82 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-100/90">
                    {STRINGS.account.profileFavoritesTitle}
                  </div>
                  <div className="text-[11px] font-semibold text-amber-100/80">
                    {favoriteBeaches.length}
                  </div>
                </div>
                {favoriteBeaches.length > 0 ? (
                  <div
                    data-testid="favorites-list"
                    className="mt-2 max-h-[220px] overflow-y-auto rounded-[10px] border border-white/12 bg-black/35"
                  >
                    {favoriteBeaches.map((beach) => (
                      <button
                        type="button"
                        key={beach.id}
                        onClick={() => onSelectFavorite(beach.id)}
                        aria-label={`${STRINGS.account.profileOpenFavoriteAction}: ${beach.name}`}
                        className="br-press flex w-full items-center justify-between border-b border-white/8 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-[-1px]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold br-text-primary">
                            {beach.name}
                          </div>
                          <div className="truncate text-[11px] br-text-tertiary">
                            {beach.region}
                          </div>
                        </div>
                        <span
                          aria-hidden="true"
                          className="ml-3 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-300/55 bg-amber-400/20 text-amber-100"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2.7l2.8 5.67 6.25.91-4.53 4.42 1.07 6.24L12 17.06 6.4 19.94l1.07-6.24-4.53-4.42 6.25-.91L12 2.7z" />
                          </svg>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-[12px] br-text-tertiary">
                    {STRINGS.account.profileFavoritesEmpty}
                  </div>
                )}
              </div>

              {/* Tutorial */}
              {onRestartTutorial ? (
                <div className="mt-3 rounded-[12px] border border-white/20 bg-black/82 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] br-text-tertiary">
                    {STRINGS.account.tutorialSectionTitle}
                  </div>
                  <p className="mt-1 text-[12px] br-text-secondary">
                    {STRINGS.account.tutorialSectionDescription}
                  </p>
                  <button
                    type="button"
                    data-testid="profile-restart-tutorial"
                    onClick={onRestartTutorial}
                    className="br-press mt-2.5 w-full rounded-[10px] border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-[13px] font-semibold text-sky-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sky-400/70 focus-visible:outline-offset-1"
                  >
                    {STRINGS.account.tutorialRestartAction}
                  </button>
                </div>
              ) : null}

              {/* Actions */}
              <div className="mt-4 space-y-2.5">
                <button
                  type="button"
                  onClick={onSignOut}
                  className="br-press w-full rounded-[11px] border border-white/24 bg-black/88 px-3 py-2.5 text-[13px] font-semibold br-text-primary focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--focus-ring)] focus-visible:outline-offset-1"
                >
                  {STRINGS.account.signOutAction}
                </button>

                <div className="rounded-[11px] border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
                  {STRINGS.account.deleteAccountHint}
                </div>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={onDeleteAccount}
                  className="br-press w-full rounded-[11px] border border-rose-300/45 bg-rose-500/20 px-3 py-2.5 text-[13px] font-semibold text-rose-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-rose-300/70 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting
                    ? STRINGS.account.deletingAccountAction
                    : STRINGS.account.deleteAccountAction}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
