import type { BeachProfile, BeachWithStats } from "../lib/types";

export type ProfileFavoriteBeach = {
  id: string;
  name: string;
  region: string;
};

export const sortBeachesByDistanceThenName = (
  a: BeachWithStats,
  b: BeachWithStats,
): number => {
  if (a.distanceM !== null && b.distanceM !== null) {
    return a.distanceM - b.distanceM;
  }
  if (a.distanceM !== null) return -1;
  if (b.distanceM !== null) return 1;
  return a.name.localeCompare(b.name);
};

export const buildFavoriteBeachesForSheet = (
  beaches: BeachWithStats[],
  favoriteBeachIds: Set<string>,
): BeachWithStats[] => {
  const byId = new Map(beaches.map((beach) => [beach.id, beach] as const));
  return Array.from(favoriteBeachIds)
    .map((id) => byId.get(id))
    .filter((beach): beach is BeachWithStats => Boolean(beach))
    .sort(sortBeachesByDistanceThenName);
};

export const buildProfileFavoriteBeaches = (
  beaches: BeachWithStats[],
  favoriteBeachIds: Set<string>,
): ProfileFavoriteBeach[] => {
  const byId = new Map(beaches.map((beach) => [beach.id, beach] as const));
  return Array.from(favoriteBeachIds)
    .map((id) => byId.get(id))
    .filter((beach): beach is BeachWithStats => Boolean(beach))
    .map((beach) => ({
      id: beach.id,
      name: beach.name,
      region: beach.region,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const mergeSelectedBeachWithProfile = (
  selectedBeachBase: BeachWithStats | undefined,
  selectedBeachProfile: BeachProfile | null,
): BeachWithStats | undefined => {
  if (!selectedBeachBase) return undefined;
  if (!selectedBeachProfile || selectedBeachProfile.status !== "published") {
    return selectedBeachBase;
  }
  return {
    ...selectedBeachBase,
    hours: selectedBeachProfile.hours ?? selectedBeachBase.hours,
    phone: selectedBeachProfile.phone ?? selectedBeachBase.phone,
    website: selectedBeachProfile.website ?? selectedBeachBase.website,
    services:
      selectedBeachProfile.services.length > 0
        ? selectedBeachProfile.services
        : selectedBeachBase.services,
  };
};

export const computeLimitedDataPredRatio = (beaches: BeachWithStats[]): number => {
  const total = beaches.length;
  if (total === 0) return 0;
  let predCount = 0;
  beaches.forEach((beach) => {
    if (beach.state === "PRED") predCount += 1;
  });
  return predCount / total;
};

export const resolveAuthorName = (nickname: string, fallback: string): string => {
  const normalizedNickname = nickname.trim();
  return normalizedNickname.length > 0 ? normalizedNickname : fallback;
};
