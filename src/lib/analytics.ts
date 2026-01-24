export type AnalyticsEventName =
  | "app_open"
  | "qr_open"
  | "beach_view"
  | "report_open"
  | "report_submit_success"
  | "report_submit_blocked_geofence"
  | "report_submit_blocked_rate_limit"
  | "share_card_generate"
  | "share_card_download";

export type AnalyticsSource = "deeplink" | "search" | "marker";

export type AnalyticsProps = {
  beachId?: string;
  level?: number;
  src?: string;
  utm_campaign?: string;
  source?: AnalyticsSource;
};

export type AnalyticsEvent = {
  v: 1;
  id: string;
  tsISO: string;
  name: AnalyticsEventName;
  props?: AnalyticsProps;
};

const EVENTS_KEY = "br_events_v1";
const MAX_EVENTS = 500;
export const ANALYTICS_UPDATE_EVENT = "br_analytics_updated";

const randomHex = (length: number) => {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
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
  if (typeof props.level === "number") {
    next.level = props.level;
  }
  if (typeof props.src === "string" && props.src.trim()) {
    next.src = props.src.trim();
  }
  if (typeof props.utm_campaign === "string" && props.utm_campaign.trim()) {
    next.utm_campaign = props.utm_campaign.trim();
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

export const loadEvents = (): AnalyticsEvent[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(EVENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AnalyticsEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (event) =>
        event &&
        event.v === 1 &&
        typeof event.id === "string" &&
        typeof event.tsISO === "string" &&
        typeof event.name === "string",
    );
  } catch {
    return [];
  }
};

export const track = (name: AnalyticsEventName, props?: AnalyticsProps) => {
  if (typeof window === "undefined") return;
  const nextEvent: AnalyticsEvent = {
    v: 1,
    id: randomHex(12),
    tsISO: new Date().toISOString(),
    name,
    props: sanitizeProps(props),
  };

  const events = loadEvents();
  const nextEvents = [...events, nextEvent].slice(-MAX_EVENTS);
  window.localStorage.setItem(EVENTS_KEY, JSON.stringify(nextEvents));
  notifyAnalyticsUpdate();
};

export const clearEvents = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EVENTS_KEY);
  notifyAnalyticsUpdate();
};
