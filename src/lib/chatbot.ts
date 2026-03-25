export type ChatbotRole = "user" | "assistant";

export type ChatbotMessage = {
  role: ChatbotRole;
  content: string;
};

export type ChatbotContext = {
  selectedBeachName?: string | null;
  selectedBeachRegion?: string | null;
  favoriteCount?: number | null;
  hasAccount?: boolean | null;
};

type ChatbotUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
} | null;

type AskChatbotError =
  | "network"
  | "timeout"
  | "unavailable"
  | "rate_limited"
  | "not_configured"
  | "account_required"
  | "invalid_payload";

export type AskChatbotResult =
  | {
    ok: true;
    source: "local" | "openai";
    reply: string;
    usage: ChatbotUsage;
  }
  | {
    ok: false;
    error: AskChatbotError;
  };

type ChatbotApiSuccess = {
  ok: true;
  source: "local" | "openai";
  reply: string;
  usage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    cachedInputTokens?: number | null;
  } | null;
};

type ChatbotApiError = {
  ok: false;
  error?: string;
};

const MAX_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 420;

const normalizeMessage = (value: string): string =>
  value.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_CHARS);

const sanitizeMessages = (messages: ChatbotMessage[]): ChatbotMessage[] =>
  messages
    .slice(-MAX_MESSAGES)
    .map((message): ChatbotMessage => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: normalizeMessage(message.content),
    }))
    .filter((message) => message.content.length > 0);

const mapApiError = (error: string | undefined): AskChatbotError => {
  if (error === "rate_limited") return "rate_limited";
  if (error === "timeout") return "timeout";
  if (error === "not_configured") return "not_configured";
  if (error === "account_required") return "account_required";
  if (error === "invalid_payload") return "invalid_payload";
  return "unavailable";
};

export async function askChatbot(
  messages: ChatbotMessage[],
  context: ChatbotContext,
  signal?: AbortSignal,
): Promise<AskChatbotResult> {
  const sanitizedMessages = sanitizeMessages(messages);
  if (sanitizedMessages.length === 0) {
    return { ok: false, error: "invalid_payload" };
  }

  let response: Response;
  try {
    response = await fetch("/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: sanitizedMessages,
        context,
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: "network" };
  }

  let payload: ChatbotApiSuccess | ChatbotApiError | null = null;
  try {
    payload = (await response.json()) as ChatbotApiSuccess | ChatbotApiError;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    return { ok: false, error: mapApiError(payload?.ok === false ? payload.error : undefined) };
  }

  if (!payload || payload.ok !== true || typeof payload.reply !== "string") {
    return { ok: false, error: "invalid_payload" };
  }

  return {
    ok: true,
    source: payload.source,
    reply: payload.reply,
    usage: payload.usage
      ? {
        inputTokens: payload.usage.inputTokens ?? null,
        outputTokens: payload.usage.outputTokens ?? null,
        totalTokens: payload.usage.totalTokens ?? null,
        cachedInputTokens: payload.usage.cachedInputTokens ?? null,
      }
      : null,
  };
}
