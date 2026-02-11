import { loadAttribution } from "./attribution";
import { getSupabaseClient } from "./supabase";

export type AnalyticsEventName =
  | "app_open"
  | "qr_open"
  | "beach_view"
  | "report_open"
  | "report_submit_success"
  | "report_submit_blocked_geofence"
  | "report_submit_blocked_rate_limit"
  | "favorite_add"
  | "favorite_remove"
  | "auth_gate_redirect"
  | "share_card_generate"
  | "share_card_download";

export type AnalyticsSource = "deeplink" | "search" | "marker";

export type AnalyticsProps = {
  beachId?: string;
  level?: number;
  src?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  source?: AnalyticsSource;
};

export type AnalyticsEvent = {
  v: 1;
  id: string;
  eventId: string;
  tsISO: string;
  name: AnalyticsEventName;
  props?: AnalyticsProps;
};

type AnalyticsServerPayload = {
  eventName: AnalyticsEventName;
  ts: string;
  sessionId: string;
  path: string;
  beachId?: string;
  src?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  props?: AnalyticsProps;
  eventId?: string;
};

const EVENTS_KEY = "br_events_v1";
const SESSION_KEY = "br_session_id_v1";
const MAX_EVENTS = 500;
const SEND_TIMEOUT_MS = 1800;
const RETRY_DELAY_MS = 250;
const MAX_RETRIES = 1;

export const ANALYTICS_UPDATE_EVENT = "br_analytics_updated";

const randomHex = (length: number) => {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const randomUuid = () => {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

const notifyAnalyticsUpdate = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ANALYTICS_UPDATE_EVENT));
};

const sanitizeProps = (props?: AnalyticsProps): AnalyticsProps | undefined => {
  if (!props) return undefined;
  const next: AnalyticsProps = {};
  if (typeof props.beachId === "string" && props.beachId.trim()) {
    next.beachId = props.beachId.trim();
  }
  if (typeof props.level === "number" && Number.isFinite(props.level)) {
    next.level = props.level;
  }
  if (typeof props.src === "string" && props.src.trim()) {
    next.src = props.src.trim();
  }
  if (typeof props.utm_source === "string" && props.utm_source.trim()) {
    next.utm_source = props.utm_source.trim();
  }
  if (typeof props.utm_medium === "string" && props.utm_medium.trim()) {
    next.utm_medium = props.utm_medium.trim();
  }
  if (typeof props.utm_campaign === "string" && props.utm_campaign.trim()) {
    next.utm_campaign = props.utm_campaign.trim();
  }
  if (typeof props.utm_content === "string" && props.utm_content.trim()) {
    next.utm_content = props.utm_content.trim();
  }
  if (typeof props.utm_term === "string" && props.utm_term.trim()) {
    next.utm_term = props.utm_term.trim();
  }
  if (
    props.source === "deeplink" ||
    props.source === "search" ||
    props.source === "marker"
  ) {
    next.source = props.source;
  }
  return Object.keys(next).length > 0 ? next : undefined;
};

const waitMs = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const getSessionId = (): string => {
  const cached = window.localStorage.getItem(SESSION_KEY);
  if (cached && cached.trim().length >= 8) return cached;
  const next = randomHex(32);
  window.localStorage.setItem(SESSION_KEY, next);
  return next;
};

const getCurrentPath = () => {
  const { pathname, search } = window.location;
  return `${pathname}${search}`;
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

const postServerEvent = async (
  payload: AnalyticsServerPayload,
  authToken: string | null,
  attempt: number,
): Promise<void> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch("/api/analytics", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
      keepalive: true,
    });

    if (!response.ok && attempt < MAX_RETRIES) {
      await waitMs(RETRY_DELAY_MS * (attempt + 1));
      await postServerEvent(payload, authToken, attempt + 1);
    }
  } catch {
    if (attempt < MAX_RETRIES) {
      await waitMs(RETRY_DELAY_MS * (attempt + 1));
      await postServerEvent(payload, authToken, attempt + 1);
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const queueServerEvent = (event: AnalyticsEvent) => {
  const attribution = loadAttribution();
  const props = event.props;

  const payload: AnalyticsServerPayload = {
    eventName: event.name,
    ts: event.tsISO,
    sessionId: getSessionId(),
    path: getCurrentPath(),
    eventId: event.eventId,
    beachId: props?.beachId,
    src: props?.src ?? attribution?.src,
    utm_source: props?.utm_source ?? attribution?.utm_source,
    utm_medium: props?.utm_medium ?? attribution?.utm_medium,
    utm_campaign: props?.utm_campaign ?? attribution?.utm_campaign,
    utm_content: props?.utm_content,
    utm_term: props?.utm_term,
    props,
  };

  void loadAuthToken().then((authToken) => postServerEvent(payload, authToken, 0));
};

export const loadEvents = (): AnalyticsEvent[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(EVENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AnalyticsEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (event) =>
          event &&
          event.v === 1 &&
          typeof event.id === "string" &&
          typeof event.tsISO === "string" &&
          typeof event.name === "string",
      )
      .map((event) => ({
        ...event,
        eventId:
          typeof event.eventId === "string" && event.eventId.length > 0
            ? event.eventId
            : randomUuid(),
      }));
  } catch {
    return [];
  }
};

export const track = (name: AnalyticsEventName, props?: AnalyticsProps) => {
  if (typeof window === "undefined") return;

  const nextEvent: AnalyticsEvent = {
    v: 1,
    id: randomHex(12),
    eventId: randomUuid(),
    tsISO: new Date().toISOString(),
    name,
    props: sanitizeProps(props),
  };

  const events = loadEvents();
  const nextEvents = [...events, nextEvent].slice(-MAX_EVENTS);
  window.localStorage.setItem(EVENTS_KEY, JSON.stringify(nextEvents));
  notifyAnalyticsUpdate();

  queueServerEvent(nextEvent);
};

export const clearEvents = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EVENTS_KEY);
  notifyAnalyticsUpdate();
};
