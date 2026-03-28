import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  getCurrentAccount,
  loadFavoriteBeachIds,
  subscribeAccountChanges,
  type AppAccount,
} from "../lib/account";

type UseAccountSyncInput = {
  devMockAccount: AppAccount | null;
  account: AppAccount | null;
  setAccount: Dispatch<SetStateAction<AppAccount | null>>;
  setFavoriteBeachIds: Dispatch<SetStateAction<Set<string>>>;
  setProfileOpen: Dispatch<SetStateAction<boolean>>;
  setDeletingAccount: Dispatch<SetStateAction<boolean>>;
};

export const useAccountSync = ({
  devMockAccount,
  account,
  setAccount,
  setFavoriteBeachIds,
  setProfileOpen,
  setDeletingAccount,
}: UseAccountSyncInput): void => {
  useEffect(() => {
    if (devMockAccount) {
      setAccount(devMockAccount);
      return () => {};
    }

    let active = true;
    void getCurrentAccount().then((nextAccount) => {
      if (!active) return;
      setAccount(nextAccount);
    });

    const unsubscribe = subscribeAccountChanges((nextAccount) => {
      if (!active) return;
      setAccount(nextAccount);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [devMockAccount, setAccount]);

  useEffect(() => {
    let active = true;
    if (!account) {
      setFavoriteBeachIds(new Set());
      return () => {
        active = false;
      };
    }
    void loadFavoriteBeachIds(account.id).then((favoriteIds) => {
      if (!active) return;
      setFavoriteBeachIds(new Set(favoriteIds));
    });
    return () => {
      active = false;
    };
  }, [account, setFavoriteBeachIds]);

  useEffect(() => {
    if (account) return;
    setProfileOpen(false);
    setDeletingAccount(false);
  }, [account, setDeletingAccount, setProfileOpen]);
};
