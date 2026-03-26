import { createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyApiSecurityHeaders, readEnv } from "./_lib/security.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 420;
const MAX_UPSTREAM_MESSAGES = 6;
const MAX_UPSTREAM_CHARS = 1_100;
const MAX_REPLY_CHARS = 1200;
const RATE_WINDOW_MS = 60 * 1000;
const DEFAULT_RATE_LIMIT = 15;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 180;
const DEFAULT_COMPLEX_MAX_OUTPUT_TOKENS = 220;
const DEFAULT_MODEL = "gpt-5.4-nano";
const DEFAULT_REASONING_EFFORT = "low";
const PROMPT_CACHE_KEY = "where2beach-chatbot-v1";
const DEFAULT_CACHE_TTL_SEC = 12 * 60 * 60;
const DEFAULT_CACHE_MAX_ITEMS = 600;

type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatContext = {
  selectedBeachName: string | null;
  selectedBeachRegion: string | null;
  favoriteCount: number | null;
  hasAccount: boolean | null;
};

type RateEntry = {
  count: number;
  resetAt: number;
};

type UsageStats = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
};

type CacheEntry = {
  reply: string;
  expiresAt: number;
};

type OpenAIResult =
  | {
    ok: true;
    reply: string;
    usage: UsageStats | null;
  }
  | {
    ok: false;
    error:
    | "upstream_auth_failed"
    | "rate_limited"
    | "upstream_failed"
    | "invalid_upstream_response"
    | "timeout";
  };

type BudgetState = {
  dayKey: string;
  usedTokens: number;
};

const rateLimits = new Map<string, RateEntry>();
const responseCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<OpenAIResult>>();
const budgetState: BudgetState = { dayKey: "", usedTokens: 0 };

const SYSTEM_INSTRUCTIONS = [
  "Sei l'assistente di Where2Beach.",
  "Aiuta solo su funzionalita dell'app: mappa, meteo, affollamento, segnalazioni, recensioni, account e preferiti.",
  "Se manca un dato in tempo reale, dillo chiaramente e invita a controllare la schermata del lido nell'app.",
  "Non inventare mai numeri o stati di una spiaggia.",
  "Rispondi in italiano semplice e breve (massimo 90 parole).",
  "Quando possibile, chiudi con un'azione concreta dentro l'app.",
].join("\n");

function readIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  if (value < min || value > max) return fallback;
  return value;
}

function readBoolEnv(name: string, fallback: boolean): boolean {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSingleString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim().length > 0) {
        return item.trim();
      }
    }
  }
  return null;
}

function sanitizeText(value: unknown, maxLength: number): string | null {
  const raw = toSingleString(value);
  if (!raw) return null;
  return raw.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function readBody(req: VercelRequest): {
  body: Record<string, unknown> | null;
  error?: string;
} {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength && contentLength > MAX_BODY_BYTES) {
    return { body: null, error: "payload_too_large" };
  }

  if (!req.body) {
    return { body: null, error: "missing_body" };
  }

  if (typeof req.body === "string") {
    if (req.body.length > MAX_BODY_BYTES) {
      return { body: null, error: "payload_too_large" };
    }
    try {
      const parsed = JSON.parse(req.body);
      if (!isObject(parsed)) return { body: null, error: "invalid_body" };
      return { body: parsed };
    } catch {
      return { body: null, error: "invalid_json" };
    }
  }

  if (!isObject(req.body)) {
    return { body: null, error: "invalid_body" };
  }

  try {
    if (JSON.stringify(req.body).length > MAX_BODY_BYTES) {
      return { body: null, error: "payload_too_large" };
    }
  } catch {
    return { body: null, error: "invalid_body" };
  }

  return { body: req.body };
}

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value)) return null;
  const messages: ChatMessage[] = [];
  for (const entry of value.slice(-MAX_MESSAGES)) {
    if (!isObject(entry)) continue;
    const role = entry.role;
    if (role !== "user" && role !== "assistant") continue;
    const content = sanitizeText(entry.content, MAX_MESSAGE_CHARS);
    if (!content) continue;
    messages.push({ role, content });
  }
  if (messages.length === 0) return null;
  const hasUser = messages.some((message) => message.role === "user");
  return hasUser ? messages : null;
}

function parseContext(value: unknown): ChatContext | null {
  if (!isObject(value)) return null;
  const selectedBeachName = sanitizeText(value.selectedBeachName, 120);
  const selectedBeachRegion = sanitizeText(value.selectedBeachRegion, 120);
  const favoriteCount =
    typeof value.favoriteCount === "number" && Number.isFinite(value.favoriteCount)
      ? Math.max(0, Math.min(1000, Math.round(value.favoriteCount)))
      : null;
  const hasAccount = typeof value.hasAccount === "boolean" ? value.hasAccount : null;
  return {
    selectedBeachName,
    selectedBeachRegion,
    favoriteCount,
    hasAccount,
  };
}

function getClientIp(req: VercelRequest): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]?.trim() || null;
  }
  const remote = req.socket?.remoteAddress;
  return typeof remote === "string" ? remote : null;
}

function anonymize(value: string | null, namespace: "ip" | "ua"): string {
  const salt = readEnv("CHATBOT_SALT") ?? readEnv("ANALYTICS_SALT");
  const raw = value?.trim() || "unknown";
  const payload = salt ? `${namespace}:${salt}:${raw}` : `${namespace}:${raw}`;
  return createHash("sha256").update(payload).digest("hex");
}

function checkRateLimit(req: VercelRequest): { ok: boolean; retryAfter?: number } {
  const limit = readIntEnv("OPENAI_CHAT_RATE_LIMIT", DEFAULT_RATE_LIMIT, 3, 300);
  const now = Date.now();
  const windowStart = Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
  const ipHash = anonymize(getClientIp(req), "ip");
  const uaHash = anonymize(toSingleString(req.headers["user-agent"]), "ua");
  const key = `${ipHash}:${uaHash}:${windowStart}`;
  const existing = rateLimits.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: windowStart + RATE_WINDOW_MS });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { ok: true };
}

function normalizeForKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function lastUserMessage(messages: ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return messages[i].content;
  }
  return null;
}

function maybeShortcutReply(message: string, context: ChatContext | null): string | null {
  const normalized = message.toLowerCase();
  const selectedBeachSuffix = context?.selectedBeachName
    ? ` per ${context.selectedBeachName}`
    : "";
  const favoriteCount = context?.favoriteCount;

  if (/^(ciao|salve|hey|buongiorno|buonasera)\b/.test(normalized)) {
    return "Ciao. Posso aiutarti su mappe, meteo, segnalazioni, preferiti e account di Where2Beach.";
  }

  if (/(segnal|report|affoll)/.test(normalized)) {
    return [
      `Per segnalare${selectedBeachSuffix}: apri il lido dalla mappa, tocca "Segnala affollamento" e invia.`,
      "Se sei lontano dalla spiaggia, l'app puo limitare o bloccare la segnalazione.",
      "Dopo l'invio puoi anche condividere l'aggiornamento.",
    ].join(" ");
  }

  if (/(preferit|salva|profilo|account|registr|acced)/.test(normalized)) {
    return [
      "I preferiti richiedono account.",
      "Apri Profilo dal menu in basso, fai accesso/registrazione, poi usa la stella sul lido per salvarlo.",
      favoriteCount !== null && favoriteCount !== undefined
        ? `Ora hai ${favoriteCount} preferiti salvati.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (/(pred|stima|live|recent)/.test(normalized)) {
    return "LIVE indica dati aggiornati ora, RECENT dati recenti, PRED una stima quando mancano segnalazioni fresche.";
  }

  if (/(meteo|piogg|vento|temperatur)/.test(normalized)) {
    return [
      `Per il meteo${selectedBeachSuffix}, apri il dettaglio del lido e guarda sezione Meteo.`,
      "Trovi condizioni attuali e prossime ore.",
    ].join(" ");
  }

  return null;
}

function isComplexQuestion(message: string): boolean {
  const normalized = message.toLowerCase();
  if (message.length >= 220) return true;
  if ((message.match(/\?/g) || []).length >= 2) return true;
  if (/(confronta|differenz|itinerario|strategia|analizza|dettagli|spiegami|perche)/.test(normalized)) {
    return true;
  }
  return false;
}

function pickMaxOutputTokens(baseMax: number, complexMax: number, message: string): number {
  const length = message.length;
  if (isComplexQuestion(message)) {
    return Math.max(120, Math.min(complexMax, 1024));
  }
  if (length <= 80) return Math.max(80, Math.min(baseMax, 120));
  if (length <= 180) return Math.max(100, Math.min(baseMax, 180));
  return Math.max(120, Math.min(baseMax, 1024));
}

function buildDynamicContext(context: ChatContext | null): string | null {
  if (!context) return null;
  const lines: string[] = [];
  if (context.selectedBeachName) {
    lines.push(`Lido selezionato: ${context.selectedBeachName}`);
  }
  if (context.selectedBeachRegion) {
    lines.push(`Regione lido selezionato: ${context.selectedBeachRegion}`);
  }
  if (context.favoriteCount !== null) {
    lines.push(`Numero preferiti utente: ${context.favoriteCount}`);
  }
  if (context.hasAccount !== null) {
    lines.push(`Utente autenticato: ${context.hasAccount ? "si" : "no"}`);
  }
  if (lines.length === 0) return null;
  return `Contesto app corrente:\n${lines.join("\n")}`;
}

function compactMessagesForUpstream(messages: ChatMessage[]): ChatMessage[] {
  const selected: ChatMessage[] = [];
  let chars = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message) continue;
    if (selected.length >= MAX_UPSTREAM_MESSAGES) break;
    if (chars + message.content.length > MAX_UPSTREAM_CHARS && selected.length > 0) continue;
    selected.push(message);
    chars += message.content.length;
  }

  const compacted = selected.reverse();
  return compacted.length > 0 ? compacted : messages.slice(-1);
}

function buildInput(messages: ChatMessage[], context: ChatContext | null) {
  const input: Array<{
    role: "user" | "assistant" | "developer";
    content: Array<{ type: "input_text"; text: string }>;
  }> = [];

  const contextText = buildDynamicContext(context);
  if (contextText) {
    input.push({
      role: "developer",
      content: [{ type: "input_text", text: contextText }],
    });
  }

  for (const message of messages) {
    input.push({
      role: message.role,
      content: [{ type: "input_text", text: message.content }],
    });
  }

  return input;
}

function parseNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractUsage(payload: unknown): UsageStats | null {
  if (!isObject(payload) || !isObject(payload.usage)) return null;
  const usage = payload.usage;
  const inputTokens = parseNumber(usage.input_tokens);
  const outputTokens = parseNumber(usage.output_tokens);
  const totalTokens = parseNumber(usage.total_tokens);
  const cachedInputTokens = isObject(usage.input_tokens_details)
    ? parseNumber(usage.input_tokens_details.cached_tokens)
    : null;
  if (
    inputTokens === null &&
    outputTokens === null &&
    totalTokens === null &&
    cachedInputTokens === null
  ) {
    return null;
  }
  return { inputTokens, outputTokens, totalTokens, cachedInputTokens };
}

function currentDayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function syncBudgetDay(now: number): void {
  const dayKey = currentDayKey(now);
  if (budgetState.dayKey !== dayKey) {
    budgetState.dayKey = dayKey;
    budgetState.usedTokens = 0;
  }
}

function hasBudget(now: number, dailyBudget: number): boolean {
  if (dailyBudget <= 0) return true;
  syncBudgetDay(now);
  return budgetState.usedTokens < dailyBudget;
}

function consumeBudget(now: number, usage: UsageStats | null): void {
  const tokens = usage?.totalTokens;
  if (tokens === null || tokens === undefined || tokens <= 0) return;
  syncBudgetDay(now);
  budgetState.usedTokens += tokens;
}

function getCacheKey(messages: ChatMessage[], context: ChatContext | null, model: string): string {
  const userTurns = messages
    .filter((message) => message.role === "user")
    .slice(-2)
    .map((message) => normalizeForKey(message.content))
    .join("|");
  const beach = normalizeForKey(context?.selectedBeachName ?? "-");
  const region = normalizeForKey(context?.selectedBeachRegion ?? "-");
  const account = context?.hasAccount === true ? "1" : "0";
  const contextFavoriteCount = context?.favoriteCount ?? null;
  const favorites =
    contextFavoriteCount === null
      ? "-"
      : contextFavoriteCount <= 0
        ? "0"
        : "1+";
  const signature = `v2|${model}|${beach}|${region}|${account}|${favorites}|${userTurns}`;
  return createHash("sha256").update(signature).digest("hex");
}

function readFromCache(cacheKey: string, now: number): string | null {
  const cached = responseCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    responseCache.delete(cacheKey);
    return null;
  }

  // LRU touch
  responseCache.delete(cacheKey);
  responseCache.set(cacheKey, cached);
  return cached.reply;
}

function writeToCache(cacheKey: string, reply: string, now: number): void {
  const ttlSec = readIntEnv("OPENAI_CHAT_RESPONSE_CACHE_TTL_SEC", DEFAULT_CACHE_TTL_SEC, 30, 604_800);
  const maxItems = readIntEnv("OPENAI_CHAT_RESPONSE_CACHE_MAX_ITEMS", DEFAULT_CACHE_MAX_ITEMS, 20, 5000);
  responseCache.set(cacheKey, { reply, expiresAt: now + ttlSec * 1000 });

  while (responseCache.size > maxItems) {
    const oldest = responseCache.keys().next().value;
    if (!oldest) break;
    responseCache.delete(oldest);
  }
}

function budgetFallbackReply(context: ChatContext | null): string {
  const suffix = context?.selectedBeachName ? ` su ${context.selectedBeachName}` : "";
  return [
    `In questo momento sto limitando le risposte avanzate${suffix} per mantenere il servizio veloce.`,
    "Per dati affidabili apri la scheda del lido in app: meteo, stato e segnalazioni.",
  ].join(" ");
}

function extractOutputText(payload: unknown): string | null {
  if (!isObject(payload)) return null;
  const direct = sanitizeText(payload.output_text, MAX_REPLY_CHARS);
  if (direct) return direct;

  if (!Array.isArray(payload.output)) return null;
  const parts: string[] = [];
  for (const item of payload.output) {
    if (!isObject(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isObject(content) || content.type !== "output_text") continue;
      const text = sanitizeText(content.text, MAX_REPLY_CHARS);
      if (text) parts.push(text);
    }
  }
  if (parts.length === 0) return null;
  return parts.join("\n").slice(0, MAX_REPLY_CHARS).trim();
}

async function callOpenAI(
  apiKey: string,
  model: string,
  reasoningEffort: string,
  maxOutputTokens: number,
  timeoutMs: number,
  messages: ChatMessage[],
  context: ChatContext | null,
): Promise<OpenAIResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions: SYSTEM_INSTRUCTIONS,
        input: buildInput(messages, context),
        reasoning: { effort: reasoningEffort },
        max_output_tokens: maxOutputTokens,
        prompt_cache_key: PROMPT_CACHE_KEY,
      }),
      signal: controller.signal,
    });

    let payload: unknown = null;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      payload = null;
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "upstream_auth_failed" };
    }
    if (response.status === 429) {
      return { ok: false, error: "rate_limited" };
    }
    if (!response.ok) {
      return { ok: false, error: "upstream_failed" };
    }

    const reply = extractOutputText(payload);
    if (!reply) {
      return { ok: false, error: "invalid_upstream_response" };
    }

    return {
      ok: true,
      reply,
      usage: extractUsage(payload),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: "upstream_failed" };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyApiSecurityHeaders(res, { noStore: true });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const rate = checkRateLimit(req);
  if (!rate.ok) {
    if (rate.retryAfter) {
      res.setHeader("Retry-After", String(rate.retryAfter));
    }
    return res.status(429).json({ ok: false, error: "rate_limited" });
  }

  const { body, error: bodyError } = readBody(req);
  if (bodyError) {
    const status = bodyError === "payload_too_large" ? 413 : 400;
    return res.status(status).json({ ok: false, error: bodyError });
  }
  if (!body) {
    return res.status(400).json({ ok: false, error: "missing_body" });
  }

  const messages = parseMessages(body.messages);
  if (!messages) {
    return res.status(400).json({ ok: false, error: "invalid_payload" });
  }

  const context = parseContext(body.context);
  const latestUser = lastUserMessage(messages);
  if (!latestUser) {
    return res.status(400).json({ ok: false, error: "invalid_payload" });
  }

  if (context?.hasAccount !== true) {
    return res.status(403).json({ ok: false, error: "account_required" });
  }

  const shortcutReply = maybeShortcutReply(latestUser, context);
  if (shortcutReply) {
    return res.status(200).json({
      ok: true,
      source: "local",
      reply: shortcutReply,
      usage: null,
    });
  }

  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) {
    return res.status(503).json({ ok: false, error: "not_configured" });
  }

  const baseModel = readEnv("OPENAI_CHAT_MODEL") || DEFAULT_MODEL;
  const complexModel = readEnv("OPENAI_CHAT_COMPLEX_MODEL");
  const complexRouting = readBoolEnv("OPENAI_CHAT_COMPLEX_ROUTING", false);
  const complex = isComplexQuestion(latestUser);
  const model = complexRouting && complex && complexModel ? complexModel : baseModel;
  const reasoningEffort = readEnv("OPENAI_CHAT_REASONING_EFFORT") || DEFAULT_REASONING_EFFORT;
  const baseMaxOutputTokens = readIntEnv(
    "OPENAI_CHAT_MAX_OUTPUT_TOKENS",
    DEFAULT_MAX_OUTPUT_TOKENS,
    64,
    1024,
  );
  const complexMaxOutputTokens = readIntEnv(
    "OPENAI_CHAT_MAX_OUTPUT_TOKENS_COMPLEX",
    DEFAULT_COMPLEX_MAX_OUTPUT_TOKENS,
    96,
    1024,
  );
  const maxOutputTokens = pickMaxOutputTokens(
    baseMaxOutputTokens,
    complexMaxOutputTokens,
    latestUser,
  );
  const timeoutMs = readIntEnv("OPENAI_CHAT_TIMEOUT_MS", DEFAULT_TIMEOUT_MS, 4000, 45000);
  const dailyBudget = readIntEnv("OPENAI_CHAT_DAILY_TOKEN_BUDGET", 0, 0, 100_000_000);
  const upstreamMessages = compactMessagesForUpstream(messages);
  const now = Date.now();
  const cacheKey = getCacheKey(upstreamMessages, context, model);

  const cachedReply = readFromCache(cacheKey, now);
  if (cachedReply) {
    return res.status(200).json({
      ok: true,
      source: "local",
      reply: cachedReply,
      usage: null,
    });
  }

  if (!hasBudget(now, dailyBudget)) {
    return res.status(200).json({
      ok: true,
      source: "local",
      reply: budgetFallbackReply(context),
      usage: null,
    });
  }

  const existingInFlight = inflightRequests.get(cacheKey);
  const requestPromise = existingInFlight ?? callOpenAI(
      apiKey,
      model,
      reasoningEffort,
      maxOutputTokens,
      timeoutMs,
      upstreamMessages,
      context,
    );

  if (!existingInFlight) {
    inflightRequests.set(cacheKey, requestPromise);
  }

  const result = await requestPromise;
  if (!existingInFlight) {
    inflightRequests.delete(cacheKey);
  }

  if (!result.ok) {
    if (result.error === "upstream_auth_failed") {
      return res.status(500).json({ ok: false, error: "upstream_auth_failed" });
    }
    if (result.error === "rate_limited") {
      return res.status(200).json({
        ok: true,
        source: "local",
        reply: budgetFallbackReply(context),
        usage: null,
      });
    }
    if (result.error === "invalid_upstream_response") {
      return res.status(502).json({ ok: false, error: "invalid_upstream_response" });
    }
    if (result.error === "timeout") {
      return res.status(504).json({ ok: false, error: "timeout" });
    }
    return res.status(502).json({ ok: false, error: "upstream_failed" });
  }

  consumeBudget(Date.now(), result.usage);
  writeToCache(cacheKey, result.reply, now);

  return res.status(200).json({
    ok: true,
    source: "openai",
    reply: result.reply,
    usage: result.usage,
  });
}
