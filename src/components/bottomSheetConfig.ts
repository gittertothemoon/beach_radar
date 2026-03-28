export const PEEK_HEIGHT = 56;
export const DRAG_THRESHOLD = 6;
export const VELOCITY_THRESHOLD = 0.45;
export const CLOSED_LIFT_PX = 34;
export const CLOSED_VISIBLE_HEIGHT = PEEK_HEIGHT + CLOSED_LIFT_PX;
export const CONTENT_MAX_VIEWPORT_RATIO = 0.62;
export const MIN_CONTENT_DRAG_RANGE_PX = 240;
export const DRAG_RANGE_OPEN_TO_CLOSE_PX = 220;
export const DRAG_RANGE_CLOSE_TO_OPEN_PX = 290;
export const OPEN_SNAP_THRESHOLD = 0.58;

export const MAX_CHAT_MESSAGES = 12;
export const MAX_CHAT_INPUT_CHARS = 420;
export const PRIVACY_URL = "/privacy/";
export const COOKIE_POLICY_URL = "/cookie-policy/";
export const LANDING_URL = "/landing/";
export const SUPPORT_EMAIL = "info@where2beach.com";
export const SHARE_APP_URL = "https://where2beach.com/";
const DEFAULT_REVIEW_URL = "https://apps.apple.com/it/search?term=where2beach";
export const APP_REVIEW_URL = import.meta.env.VITE_APP_REVIEW_URL?.trim() || DEFAULT_REVIEW_URL;

export const normalizePathname = (value: string): string =>
  value.replace(/\/+$/, "") || "/";

export type RuntimeLegalConfig = {
  privacyUrl?: string;
  termsUrl?: string;
  cookieUrl?: string;
};

export type WindowWithLegalConfig = Window & {
  W2B_LEGAL_CONFIG?: RuntimeLegalConfig;
  __W2B_NATIVE_SHELL?: boolean;
};
