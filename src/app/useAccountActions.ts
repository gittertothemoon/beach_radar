import { useCallback, type Dispatch, type SetStateAction } from "react";
import {
  completeOAuthProfile,
  deleteCurrentAccount,
  setFavoriteBeach,
  signOutAccount,
  type AppAccount,
} from "../lib/account";
import { track } from "../lib/analytics";
import type { BeachWithStats } from "../lib/types";
import {
  createFavoriteAccountRequiredState,
  createResetAccountRequiredState,
  type AccountRequiredState,
} from "./accountRequiredUtils";

type ToastTone = "info" | "success" | "error";

type UseAccountActionsInput = {
  account: AppAccount | null;
  deletingAccount: boolean;
  favoriteBeachIds: Set<string>;
  beachViewsBase: BeachWithStats[];
  selectedBeachId: string | null;
  applyAccountRequiredState: (nextState: AccountRequiredState) => void;
  showLocationToast: (message: string, tone?: ToastTone) => void;
  setAccount: Dispatch<SetStateAction<AppAccount | null>>;
  setFavoriteBeachIds: Dispatch<SetStateAction<Set<string>>>;
  setProfileOpen: Dispatch<SetStateAction<boolean>>;
  setDeletingAccount: Dispatch<SetStateAction<boolean>>;
  focusBeach: (
    beachId: string,
    options?: { updateSearch?: boolean; moveMap?: boolean; solo?: boolean },
  ) => void;
  messages: {
    favoriteSyncFailed: string;
    signOutFailed: string;
    deleteAccountConfirm: string;
    deleteAccountFailed: string;
    deleteAccountSuccess: string;
  };
};

type UpdateProfileInput = {
  firstName: string;
  lastName: string;
  nickname: string;
};

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; code: "nickname_exists" | "invalid" | "network" | "unknown" };

type UseAccountActionsOutput = {
  handleToggleFavorite: (beachId: string) => void;
  handleToggleSelectedFavorite: () => void;
  handleSignOut: () => void;
  handleDeleteAccount: () => void;
  handleOpenProfile: () => void;
  handleSelectProfileFavorite: (beachId: string) => void;
  handleUpdateProfile: (input: UpdateProfileInput) => Promise<UpdateProfileResult>;
};

export const useAccountActions = ({
  account,
  deletingAccount,
  favoriteBeachIds,
  beachViewsBase,
  selectedBeachId,
  applyAccountRequiredState,
  showLocationToast,
  setAccount,
  setFavoriteBeachIds,
  setProfileOpen,
  setDeletingAccount,
  focusBeach,
  messages,
}: UseAccountActionsInput): UseAccountActionsOutput => {
  const handleToggleFavorite = useCallback((beachId: string) => {
    if (!account) {
      const beach = beachViewsBase.find((item) => item.id === beachId);
      applyAccountRequiredState(
        createFavoriteAccountRequiredState(beach?.name ?? null, beachId),
      );
      return;
    }
    const shouldFavorite = !favoriteBeachIds.has(beachId);
    track(shouldFavorite ? "favorite_add" : "favorite_remove", { beachId });

    setFavoriteBeachIds((prev) => {
      const next = new Set(prev);
      if (shouldFavorite) {
        next.add(beachId);
      } else {
        next.delete(beachId);
      }
      return next;
    });

    void setFavoriteBeach(account.id, beachId, shouldFavorite).then((result) => {
      if (result.ok) return;

      setFavoriteBeachIds((prev) => {
        const reverted = new Set(prev);
        if (shouldFavorite) {
          reverted.delete(beachId);
        } else {
          reverted.add(beachId);
        }
        return reverted;
      });

      if (result.code === "unauthorized") {
        setAccount(null);
        const beach = beachViewsBase.find((item) => item.id === beachId);
        applyAccountRequiredState(
          createFavoriteAccountRequiredState(beach?.name ?? null, beachId),
        );
        return;
      }

      showLocationToast(messages.favoriteSyncFailed, "error");
    });
  }, [
    account,
    applyAccountRequiredState,
    beachViewsBase,
    favoriteBeachIds,
    messages.favoriteSyncFailed,
    setAccount,
    setFavoriteBeachIds,
    showLocationToast,
  ]);

  const handleToggleSelectedFavorite = useCallback(() => {
    if (!selectedBeachId) return;
    handleToggleFavorite(selectedBeachId);
  }, [handleToggleFavorite, selectedBeachId]);

  const handleSignOut = useCallback(() => {
    void signOutAccount().then((result) => {
      if (!result.ok) {
        showLocationToast(messages.signOutFailed, "error");
        return;
      }
      setAccount(null);
      setFavoriteBeachIds(new Set());
      setProfileOpen(false);
      applyAccountRequiredState(createResetAccountRequiredState());
    });
  }, [
    applyAccountRequiredState,
    messages.signOutFailed,
    setAccount,
    setFavoriteBeachIds,
    setProfileOpen,
    showLocationToast,
  ]);

  const handleDeleteAccount = useCallback(() => {
    if (deletingAccount) return;
    if (!window.confirm(messages.deleteAccountConfirm)) return;
    setDeletingAccount(true);
    void deleteCurrentAccount()
      .then(async (result) => {
        if (!result.ok) {
          showLocationToast(messages.deleteAccountFailed, "error");
          return;
        }
        await signOutAccount();
        setAccount(null);
        setFavoriteBeachIds(new Set());
        setProfileOpen(false);
        showLocationToast(messages.deleteAccountSuccess, "success");
      })
      .finally(() => setDeletingAccount(false));
  }, [
    deletingAccount,
    messages.deleteAccountConfirm,
    messages.deleteAccountFailed,
    messages.deleteAccountSuccess,
    setAccount,
    setDeletingAccount,
    setFavoriteBeachIds,
    setProfileOpen,
    showLocationToast,
  ]);

  const handleUpdateProfile = useCallback(
    async (input: UpdateProfileInput): Promise<UpdateProfileResult> => {
      if (!account) return { ok: false, code: "unknown" };
      const result = await completeOAuthProfile(input);
      if (!result.ok) {
        if (result.code === "nickname_exists") return { ok: false, code: "nickname_exists" };
        if (result.code === "network") return { ok: false, code: "network" };
        return { ok: false, code: "unknown" };
      }
      setAccount(result.account);
      return { ok: true };
    },
    [account, setAccount],
  );

  const handleOpenProfile = useCallback(() => {
    if (!account) return;
    setProfileOpen(true);
  }, [account, setProfileOpen]);

  const handleSelectProfileFavorite = useCallback(
    (beachId: string) => {
      setProfileOpen(false);
      focusBeach(beachId, { solo: true });
    },
    [focusBeach, setProfileOpen],
  );

  return {
    handleUpdateProfile,
    handleToggleFavorite,
    handleToggleSelectedFavorite,
    handleSignOut,
    handleDeleteAccount,
    handleOpenProfile,
    handleSelectProfileFavorite,
  };
};
