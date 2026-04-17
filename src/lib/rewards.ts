import { getSupabaseClient } from "./supabase";
import { getDevMockAccount } from "./devMockAuth";

type ApiErrorPayload = {
  ok: false;
  error?: string;
};

type RewardsSummaryPayload = {
  ok: true;
  summary?: unknown;
};

type RewardBadge = {
  code: string;
  name: string;
  description: string;
  icon: string;
  pointsCost: number;
  owned: boolean;
  ownedAt: string | null;
  redeemable: boolean;
};

export type Achievement = {
  id: string;
  threshold: number;
  unlocked: boolean;
};

export type WeeklyMission = {
  goal: number;
  progress: number;
  reward: number;
  claimed: boolean;
  periodStart: string;
  periodEnd: string;
};

export type DailyMission = {
  goal: number;
  progress: number;
  reward: number;
  claimed: boolean;
  periodStart: string;
  periodEnd: string;
};

export type GamificationCelebrationEvent =
  | { type: "mission"; missionType: "weekly" | "daily"; pointsEarned: number }
  | { type: "achievement"; id: string; name: string; description: string };

export type AccountRewardsSummary = {
  balance: number;
  pointsEarned: number;
  pointsSpent: number;
  reportPoints: number;
  ownedBadgesCount: number;
  badges: RewardBadge[];
  couponConversion: {
    enabled: boolean;
    status: "coming_soon";
    message: string;
  };
  achievements: Achievement[];
  weeklyMission: WeeklyMission;
  dailyMission: DailyMission;
};

type FetchRewardsErrorCode =
  | "network"
  | "account_required"
  | "unavailable"
  | "invalid_payload";

type ClaimMissionErrorCode =
  | "network"
  | "account_required"
  | "mission_not_complete"
  | "already_claimed"
  | "unavailable"
  | "invalid_payload";

export type ClaimMissionResult =
  | { ok: true; summary: AccountRewardsSummary }
  | { ok: false; code: ClaimMissionErrorCode };

type ClaimDailyMissionErrorCode =
  | "network"
  | "account_required"
  | "mission_not_complete"
  | "already_claimed"
  | "unavailable"
  | "invalid_payload";

export type ClaimDailyMissionResult =
  | { ok: true; summary: AccountRewardsSummary }
  | { ok: false; code: ClaimDailyMissionErrorCode };

type RedeemBadgeErrorCode =
  | "network"
  | "account_required"
  | "badge_not_found"
  | "insufficient_points"
  | "badge_already_owned"
  | "invalid_badge_code"
  | "unavailable"
  | "invalid_payload";

export type FetchAccountRewardsResult =
  | { ok: true; summary: AccountRewardsSummary }
  | { ok: false; code: FetchRewardsErrorCode };

export type RedeemBadgeResult =
  | { ok: true; summary: AccountRewardsSummary }
  | { ok: false; code: RedeemBadgeErrorCode };

// Tracks how many times fetchAccountRewards has been called in mock mode (used for dev simulation)
let mockFetchCount = 0;

// Mutable mock state — survives across fetchAccountRewards / redeemBadge calls within a session
let mockState: AccountRewardsSummary = {
  balance: 45,
  pointsEarned: 60,
  pointsSpent: 15,
  reportPoints: 15,
  ownedBadgesCount: 1,
  badges: [
    { code: "occhio_del_mare", name: "Occhio del Mare", description: "Primo esploratore della costa", icon: "eye", pointsCost: 120, owned: false, ownedAt: null, redeemable: false },
    { code: "sentinella_costiera", name: "Sentinella Costiera", description: "Guida fidata per i bagnanti", icon: "shield", pointsCost: 120, owned: true, ownedAt: new Date().toISOString(), redeemable: false },
    { code: "cavalcaonde", name: "Cavalcaonde", description: "Sempre in prima linea sull'onda", icon: "wave", pointsCost: 120, owned: false, ownedAt: null, redeemable: false },
    { code: "amico_del_lido", name: "Amico del Lido", description: "Di casa in ogni spiaggia", icon: "beach", pointsCost: 120, owned: false, ownedAt: null, redeemable: false },
    { code: "faro_del_nord", name: "Faro del Nord", description: "Luce per chi cerca il posto giusto", icon: "lighthouse", pointsCost: 120, owned: false, ownedAt: null, redeemable: false },
    { code: "re_del_sole", name: "Re del Sole", description: "Leggenda vivente delle spiagge", icon: "sun", pointsCost: 120, owned: false, ownedAt: null, redeemable: false },
  ],
  couponConversion: { enabled: false, status: "coming_soon", message: "Presto potrai convertire i punti in coupon per sconti e omaggi dai partner." },
  achievements: [
    { id: "first_report", threshold: 1, unlocked: true },
    { id: "reporter_5", threshold: 5, unlocked: false },
    { id: "reporter_10", threshold: 10, unlocked: false },
    { id: "reporter_25", threshold: 25, unlocked: false },
    { id: "reporter_50", threshold: 50, unlocked: false },
  ],
  weeklyMission: {
    goal: 10,
    progress: 4,
    reward: 20,
    claimed: false,
    periodStart: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
    periodEnd: new Date(Date.now() + 4 * 86400 * 1000).toISOString(),
  },
  dailyMission: {
    goal: 3,
    progress: 1,
    reward: 5,
    claimed: false,
    periodStart: new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString(),
    periodEnd: new Date(new Date().setUTCHours(23, 59, 59, 999)).toISOString(),
  },
};

/** Returns the current mock balance (after any awardMockPoints calls). */
export function getMockBalance(): number {
  return mockState.balance;
}

/** Set daily mission progress to goal so it can be claimed. */
export function completeMockDailyMission(): void {
  mockState = {
    ...mockState,
    dailyMission: {
      ...mockState.dailyMission,
      progress: mockState.dailyMission.goal,
      claimed: false,
    },
  };
}

/** Reset daily mission so it can be triggered again in dev. */
export function resetMockDailyMission(): void {
  mockState = {
    ...mockState,
    dailyMission: {
      ...mockState.dailyMission,
      progress: 0,
      claimed: false,
    },
  };
}

/** Set weekly mission progress to goal so it can be claimed. */
export function completeMockMission(): void {
  mockState = {
    ...mockState,
    weeklyMission: {
      ...mockState.weeklyMission,
      progress: mockState.weeklyMission.goal,
      claimed: false,
    },
  };
}

/** Reset a mock achievement to locked so it can be detected as newly unlocked again. */
export function resetMockAchievement(id: string): void {
  mockState = {
    ...mockState,
    achievements: mockState.achievements.map((a) =>
      a.id === id ? { ...a, unlocked: false } : a,
    ),
  };
}

/** Unlock a mock achievement by id so the next fetchAccountRewards detects it as newly unlocked. */
export function unlockMockAchievement(id: string): void {
  mockState = {
    ...mockState,
    achievements: mockState.achievements.map((a) =>
      a.id === id ? { ...a, unlocked: true } : a,
    ),
  };
}

/** Call this from report submission in mock mode so the balance persists across refreshes. */
export function awardMockPoints(pts: number): void {
  const newBalance = mockState.balance + pts;
  mockState = {
    ...mockState,
    balance: newBalance,
    pointsEarned: mockState.pointsEarned + pts,
    badges: mockState.badges.map((b) => ({
      ...b,
      redeemable: !b.owned && newBalance >= b.pointsCost,
    })),
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && Number.isFinite(Number(value))
      ? Number(value)
      : null;

const toSingleString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const toApiErrorPayload = (value: unknown): ApiErrorPayload | null => {
  if (!isObject(value) || value.ok !== false) return null;
  return {
    ok: false,
    error: toSingleString(value.error) ?? undefined,
  };
};

const parseBadge = (value: unknown): RewardBadge | null => {
  if (!isObject(value)) return null;
  const code = toSingleString(value.code);
  const name = toSingleString(value.name);
  const description = toSingleString(value.description);
  const icon = toSingleString(value.icon);
  const pointsCost = toFiniteNumber(value.pointsCost);
  if (!code || !name || !description || !icon || pointsCost === null || pointsCost < 1) {
    return null;
  }
  return {
    code,
    name,
    description,
    icon,
    pointsCost: Math.round(pointsCost),
    owned: value.owned === true,
    ownedAt: typeof value.ownedAt === "string" ? value.ownedAt : null,
    redeemable: value.redeemable === true,
  };
};

const parseSummary = (value: unknown): AccountRewardsSummary | null => {
  if (!isObject(value)) return null;
  const balance = toFiniteNumber(value.balance);
  const pointsEarned = toFiniteNumber(value.pointsEarned);
  const pointsSpent = toFiniteNumber(value.pointsSpent);
  const reportPoints = toFiniteNumber(value.reportPoints);
  const ownedBadgesCount = toFiniteNumber(value.ownedBadgesCount);
  if (
    balance === null ||
    pointsEarned === null ||
    pointsSpent === null ||
    reportPoints === null ||
    ownedBadgesCount === null
  ) {
    return null;
  }

  const badgesRaw = Array.isArray(value.badges) ? value.badges : [];
  const badges = badgesRaw
    .map((item) => parseBadge(item))
    .filter((item): item is RewardBadge => item !== null);

  const couponConversionRaw = isObject(value.couponConversion)
    ? value.couponConversion
    : null;
  const couponStatus =
    couponConversionRaw?.status === "coming_soon" ? "coming_soon" : "coming_soon";
  const couponMessage = toSingleString(couponConversionRaw?.message)
    ?? "Conversione coupon in arrivo.";

  const achievementsRaw = Array.isArray(value.achievements) ? value.achievements : [];
  const achievements: Achievement[] = achievementsRaw
    .map((item): Achievement | null => {
      if (!isObject(item)) return null;
      const id = toSingleString(item.id);
      const threshold = toFiniteNumber(item.threshold);
      if (!id || threshold === null || threshold < 1) return null;
      return { id, threshold: Math.round(threshold), unlocked: item.unlocked === true };
    })
    .filter((a): a is Achievement => a !== null);

  const missionRaw = isObject(value.weeklyMission) ? value.weeklyMission : null;
  const missionGoal = toFiniteNumber(missionRaw?.goal) ?? 10;
  const missionProgress = toFiniteNumber(missionRaw?.progress) ?? 0;
  const missionReward = toFiniteNumber(missionRaw?.reward) ?? 20;
  const missionClaimed = missionRaw?.claimed === true;
  const periodStart = toSingleString(missionRaw?.periodStart) ?? new Date().toISOString();
  const periodEnd = toSingleString(missionRaw?.periodEnd) ?? new Date().toISOString();

  const dailyRaw = isObject(value.dailyMission) ? value.dailyMission : null;
  const dailyGoal = toFiniteNumber(dailyRaw?.goal) ?? 3;
  const dailyProgress = toFiniteNumber(dailyRaw?.progress) ?? 0;
  const dailyReward = toFiniteNumber(dailyRaw?.reward) ?? 5;
  const dailyClaimed = dailyRaw?.claimed === true;
  const dailyPeriodStart = toSingleString(dailyRaw?.periodStart) ?? new Date().toISOString();
  const dailyPeriodEnd = toSingleString(dailyRaw?.periodEnd) ?? new Date().toISOString();

  return {
    balance: Math.max(0, Math.round(balance)),
    pointsEarned: Math.max(0, Math.round(pointsEarned)),
    pointsSpent: Math.max(0, Math.round(pointsSpent)),
    reportPoints: Math.max(1, Math.round(reportPoints)),
    ownedBadgesCount: Math.max(0, Math.round(ownedBadgesCount)),
    badges,
    couponConversion: {
      enabled: couponConversionRaw?.enabled === true,
      status: couponStatus,
      message: couponMessage,
    },
    achievements,
    weeklyMission: {
      goal: Math.max(1, Math.round(missionGoal)),
      progress: Math.max(0, Math.round(missionProgress)),
      reward: Math.max(1, Math.round(missionReward)),
      claimed: missionClaimed,
      periodStart,
      periodEnd,
    },
    dailyMission: {
      goal: Math.max(1, Math.round(dailyGoal)),
      progress: Math.max(0, Math.round(dailyProgress)),
      reward: Math.max(1, Math.round(dailyReward)),
      claimed: dailyClaimed,
      periodStart: dailyPeriodStart,
      periodEnd: dailyPeriodEnd,
    },
  };
};

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const loadAuthToken = async (): Promise<string | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
};

const mapStatusToFetchError = (
  status: number,
  payload: unknown,
): FetchRewardsErrorCode => {
  const apiError = toApiErrorPayload(payload);
  if (
    status === 401 ||
    status === 403 ||
    apiError?.error === "missing_token" ||
    apiError?.error === "invalid_token"
  ) {
    return "account_required";
  }
  return "unavailable";
};

const mapStatusToRedeemError = (
  status: number,
  payload: unknown,
): RedeemBadgeErrorCode => {
  const apiError = toApiErrorPayload(payload);
  if (
    status === 401 ||
    status === 403 ||
    apiError?.error === "missing_token" ||
    apiError?.error === "invalid_token"
  ) {
    return "account_required";
  }
  if (apiError?.error === "badge_not_found" || status === 404) {
    return "badge_not_found";
  }
  if (apiError?.error === "insufficient_points") {
    return "insufficient_points";
  }
  if (apiError?.error === "badge_already_owned") {
    return "badge_already_owned";
  }
  if (apiError?.error === "invalid_badge_code" || status === 400) {
    return "invalid_badge_code";
  }
  return "unavailable";
};

export const fetchAccountRewards = async (): Promise<FetchAccountRewardsResult> => {
  if (getDevMockAccount()) {
    mockFetchCount += 1;
    // On the second fetch, auto-unlock reporter_5 so App.tsx detects it as newly unlocked
    if (mockFetchCount === 2 && !mockState.achievements.find((a) => a.id === "reporter_5")?.unlocked) {
      unlockMockAchievement("reporter_5");
    }
    return { ok: true, summary: mockState };
  }

  const authToken = await loadAuthToken();
  if (!authToken) {
    return { ok: false, code: "account_required" };
  }

  let response: Response;
  try {
    response = await fetch("/api/account/rewards", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
  } catch {
    return { ok: false, code: "network" };
  }

  const payload = await readJson(response);
  if (!response.ok) {
    return { ok: false, code: mapStatusToFetchError(response.status, payload) };
  }

  const parsed = payload as RewardsSummaryPayload;
  if (!parsed || parsed.ok !== true) {
    return { ok: false, code: "invalid_payload" };
  }

  const summary = parseSummary(parsed.summary);
  if (!summary) {
    return { ok: false, code: "invalid_payload" };
  }
  return { ok: true, summary };
};

export const claimMissionReward = async (): Promise<ClaimMissionResult> => {
  if (getDevMockAccount()) {
    if (mockState.weeklyMission.claimed) return { ok: false, code: "already_claimed" };
    if (mockState.weeklyMission.progress < mockState.weeklyMission.goal) return { ok: false, code: "mission_not_complete" };
    const pts = mockState.weeklyMission.reward;
    const newBalance = mockState.balance + pts;
    mockState = {
      ...mockState,
      balance: newBalance,
      pointsEarned: mockState.pointsEarned + pts,
      weeklyMission: { ...mockState.weeklyMission, claimed: true },
      badges: mockState.badges.map((b) => ({
        ...b,
        redeemable: !b.owned && newBalance >= b.pointsCost,
      })),
    };
    return { ok: true, summary: mockState };
  }

  const authToken = await loadAuthToken();
  if (!authToken) return { ok: false, code: "account_required" };

  let response: Response;
  try {
    response = await fetch("/api/account/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ action: "claim_mission" }),
    });
  } catch {
    return { ok: false, code: "network" };
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const apiError = toApiErrorPayload(payload);
    if (response.status === 401 || response.status === 403 || apiError?.error === "missing_token" || apiError?.error === "invalid_token") {
      return { ok: false, code: "account_required" };
    }
    if (response.status === 409) {
      const errCode = apiError?.error;
      if (errCode === "already_claimed") return { ok: false, code: "already_claimed" };
      if (errCode === "mission_not_complete") return { ok: false, code: "mission_not_complete" };
    }
    return { ok: false, code: "unavailable" };
  }

  const parsed = payload as RewardsSummaryPayload;
  if (!parsed || parsed.ok !== true) return { ok: false, code: "invalid_payload" };
  const summary = parseSummary(parsed.summary);
  if (!summary) return { ok: false, code: "invalid_payload" };
  return { ok: true, summary };
};

export const claimDailyMissionReward = async (): Promise<ClaimDailyMissionResult> => {
  if (getDevMockAccount()) {
    if (mockState.dailyMission.claimed) return { ok: false, code: "already_claimed" };
    if (mockState.dailyMission.progress < mockState.dailyMission.goal) return { ok: false, code: "mission_not_complete" };
    const pts = mockState.dailyMission.reward;
    const newBalance = mockState.balance + pts;
    mockState = {
      ...mockState,
      balance: newBalance,
      pointsEarned: mockState.pointsEarned + pts,
      dailyMission: { ...mockState.dailyMission, claimed: true },
      badges: mockState.badges.map((b) => ({
        ...b,
        redeemable: !b.owned && newBalance >= b.pointsCost,
      })),
    };
    return { ok: true, summary: mockState };
  }

  const authToken = await loadAuthToken();
  if (!authToken) return { ok: false, code: "account_required" };

  let response: Response;
  try {
    response = await fetch("/api/account/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ action: "claim_daily_mission" }),
    });
  } catch {
    return { ok: false, code: "network" };
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const apiError = toApiErrorPayload(payload);
    if (response.status === 401 || response.status === 403 || apiError?.error === "missing_token" || apiError?.error === "invalid_token") {
      return { ok: false, code: "account_required" };
    }
    if (response.status === 409) {
      const errCode = apiError?.error;
      if (errCode === "already_claimed") return { ok: false, code: "already_claimed" };
      if (errCode === "mission_not_complete") return { ok: false, code: "mission_not_complete" };
    }
    return { ok: false, code: "unavailable" };
  }

  const parsed = payload as RewardsSummaryPayload;
  if (!parsed || parsed.ok !== true) return { ok: false, code: "invalid_payload" };
  const summary = parseSummary(parsed.summary);
  if (!summary) return { ok: false, code: "invalid_payload" };
  return { ok: true, summary };
};

export const redeemBadge = async (badgeCode: string): Promise<RedeemBadgeResult> => {
  const trimmedBadgeCode = badgeCode.trim();
  if (!trimmedBadgeCode) {
    return { ok: false, code: "invalid_badge_code" };
  }

  if (getDevMockAccount()) {
    const badge = mockState.badges.find((b) => b.code === trimmedBadgeCode);
    if (!badge) return { ok: false, code: "badge_not_found" };
    if (badge.owned) return { ok: false, code: "badge_already_owned" };
    if (mockState.balance < badge.pointsCost) return { ok: false, code: "insufficient_points" };
    const newBalance = mockState.balance - badge.pointsCost;
    mockState = {
      ...mockState,
      balance: newBalance,
      pointsSpent: mockState.pointsSpent + badge.pointsCost,
      ownedBadgesCount: mockState.ownedBadgesCount + 1,
      badges: mockState.badges.map((b) =>
        b.code === trimmedBadgeCode
          ? { ...b, owned: true, ownedAt: new Date().toISOString(), redeemable: false }
          : { ...b, redeemable: !b.owned && newBalance >= b.pointsCost },
      ),
    };
    return { ok: true, summary: mockState };
  }

  const authToken = await loadAuthToken();
  if (!authToken) {
    return { ok: false, code: "account_required" };
  }

  let response: Response;
  try {
    response = await fetch("/api/account/rewards", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ badgeCode: trimmedBadgeCode }),
    });
  } catch {
    return { ok: false, code: "network" };
  }

  const payload = await readJson(response);
  if (!response.ok) {
    return { ok: false, code: mapStatusToRedeemError(response.status, payload) };
  }

  const parsed = payload as RewardsSummaryPayload;
  if (!parsed || parsed.ok !== true) {
    return { ok: false, code: "invalid_payload" };
  }

  const summary = parseSummary(parsed.summary);
  if (!summary) {
    return { ok: false, code: "invalid_payload" };
  }

  return { ok: true, summary };
};
