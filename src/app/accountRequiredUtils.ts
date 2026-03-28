export type AccountRequiredReason = "favorites" | "reports";

export type AccountRequiredState = {
  open: boolean;
  reason: AccountRequiredReason;
  beachName: string | null;
  pendingFavoriteBeachId: string | null;
};

export const createResetAccountRequiredState = (): AccountRequiredState => ({
  open: false,
  reason: "favorites",
  beachName: null,
  pendingFavoriteBeachId: null,
});

export const createReportAccountRequiredState = (
  beachName: string | null,
): AccountRequiredState => ({
  open: true,
  reason: "reports",
  beachName,
  pendingFavoriteBeachId: null,
});

export const createFavoriteAccountRequiredState = (
  beachName: string | null,
  favoriteBeachId: string | null,
): AccountRequiredState => ({
  open: true,
  reason: "favorites",
  beachName,
  pendingFavoriteBeachId: favoriteBeachId,
});
