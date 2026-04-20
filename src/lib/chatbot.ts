export type ChatbotRole = "user" | "assistant";

export type ChatbotMessage = {
  role: ChatbotRole;
  content: string;
};

export type WeatherContext = {
  temperatureC: number;
  windKmh: number;
  windDirectionLabel: string | null;
  rainProbability: number | null;
  conditionLabel: string;
};

export type CrowdContext = {
  state: string;
  crowdLevel: number;
  crowdLevelLabel: string;
  confidence: number;
  updatedAt: number | null;
  hasJellyfish?: boolean | null;
  hasAlgae?: boolean | null;
  hasRoughSea?: boolean | null;
  hasStrongWind?: boolean | null;
};

export type ChatbotContext = {
  selectedBeachName?: string | null;
  selectedBeachRegion?: string | null;
  favoriteCount?: number | null;
  hasAccount?: boolean | null;
  preferredLanguage?: "it" | "en" | null;
  interests?: string[] | null;
  weather?: WeatherContext | null;
  crowd?: CrowdContext | null;
  beachServices?: string[] | null;
  beachHours?: string | null;
  beachAddress?: string | null;
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

// Normalize input: lowercase, strip accents, normalize apostrophes/hyphens to spaces
const normalizeQuery = (input: string): string =>
  input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['''`\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const has = (q: string, ...keywords: string[]): boolean =>
  keywords.some((k) => q.includes(k));

const STATE_DISPLAY: Record<string, string> = {
  LIVE: "LIVE",
  RECENT: "RECENTE",
  PRED: "STIMA",
};

export function handleLocalQuery(
  input: string,
  context: ChatbotContext,
): string | null {
  const q = normalizeQuery(input);
  const beach = context.selectedBeachName;

  // Greetings
  if (has(q, "ciao", "salve", "buongiorno", "buonasera", "buonanotte", "hey onda", "hei onda")) {
    return "Ciao! Sono ONDA, il tuo assistente di Where2Beach. Come posso aiutarti oggi?";
  }

  // Help / what can you do
  if (has(q, "aiuto", "cosa puoi fare", "cosa sai fare", "come funzioni", "guida", "help")) {
    return "Posso aiutarti con meteo, affollamento, servizi e orari della spiaggia selezionata, e rispondere a domande sull'app. Seleziona una spiaggia sulla mappa e chiedimi quello che vuoi!";
  }

  // Weather
  if (has(q, "meteo", "temperatura", "caldo", "freddo", "pioggia", "che tempo", "com e il tempo", "previsioni meteo", "com e fuori", "com e oggi", "vento forte")) {
    if (beach && context.weather) {
      const w = context.weather;
      const tempC = Math.round(w.temperatureC);
      const windKmh = Math.round(w.windKmh);
      const windStr = w.windDirectionLabel
        ? `${windKmh} km/h da ${w.windDirectionLabel}`
        : `${windKmh} km/h`;
      const rainStr =
        w.rainProbability !== null
          ? ` Probabilità pioggia: ${Math.round(w.rainProbability)}%.`
          : "";
      return `A ${beach} ora: ${tempC}°C, ${w.conditionLabel}. Vento ${windStr}.${rainStr}`;
    }
    if (beach)
      return `Non ho ancora i dati meteo per ${beach}. Apri la scheda della spiaggia per i dettagli meteo aggiornati.`;
    return "Seleziona una spiaggia dalla mappa per vedere le condizioni meteo in tempo reale.";
  }

  // Sea / water conditions
  if (
    has(q, "com e il mare", "condizioni mare", "mare mosso", "medus", "alghe", "com e l acqua", "acqua pulita", "onde alte")
  ) {
    if (beach && context.crowd) {
      const c = context.crowd;
      const conditions: string[] = [];
      if (c.hasRoughSea) conditions.push("mare mosso");
      if (c.hasJellyfish) conditions.push("meduse segnalate");
      if (c.hasAlgae) conditions.push("alghe presenti");
      if (c.hasStrongWind) conditions.push("vento forte");
      const stateLabel = STATE_DISPLAY[c.state] ?? c.state;
      if (conditions.length > 0)
        return `A ${beach}: ${conditions.join(", ")}. Stato segnalazione: ${stateLabel}.`;
      return `Nessuna condizione critica segnalata a ${beach} al momento (stato ${stateLabel}).`;
    }
    if (beach)
      return `Apri la scheda di ${beach} per vedere le condizioni del mare segnalate di recente.`;
    return "Seleziona una spiaggia per vedere le condizioni del mare.";
  }

  // Crowd / affollamento
  if (
    has(q, "affollat", "quanta gente", "quante persone", "affluenza", "piena", "com e la spiaggia", "e libera", "e piena", "folla", "calca")
  ) {
    if (beach && context.crowd) {
      const c = context.crowd;
      const stateLabel = STATE_DISPLAY[c.state] ?? c.state;
      const confPct = Math.round(c.confidence * 100);
      return `A ${beach} ora: ${c.crowdLevelLabel} (livello ${c.crowdLevel}/4). Stato ${stateLabel}, affidabilità ${confPct}%.`;
    }
    if (beach)
      return `Seleziona la scheda di ${beach} per vedere l'affollamento aggiornato.`;
    return "Seleziona una spiaggia dalla mappa per vedere l'affollamento in tempo reale.";
  }

  // Services
  if (
    has(q, "servizi", "parcheggio", "docce", "ombrelloni", "sdraio", "attrezzature", "stabilimento", "cosa c e", "cosa ha", "strutture disponibili", "bagni", "wc", "toilet")
  ) {
    if (beach && context.beachServices && context.beachServices.length > 0)
      return `Servizi disponibili a ${beach}: ${context.beachServices.join(", ")}.`;
    if (beach)
      return `Non ho informazioni dettagliate sui servizi di ${beach}. Controlla la scheda della spiaggia.`;
    return "Seleziona una spiaggia per vedere i servizi disponibili.";
  }

  // Hours
  if (has(q, "orari", "quando apre", "quando chiude", "orario", "apertura", "chiusura", "aperta fino")) {
    if (beach && context.beachHours)
      return `${beach} è aperta: ${context.beachHours}.`;
    if (beach)
      return `Non ho gli orari ufficiali di ${beach}. Solitamente le spiagge libere sono accessibili tutto il giorno.`;
    return "Seleziona una spiaggia per vedere gli orari di apertura.";
  }

  // Address / location
  if (
    has(q, "dove si trova", "indirizzo", "come ci arrivo", "dove e la spiaggia", "posizione", "come raggiungo", "dove si trova")
  ) {
    if (beach && context.beachAddress)
      return `${beach} si trova in: ${context.beachAddress}. Puoi trovare indicazioni precise aprendo la scheda sulla mappa.`;
    if (beach)
      return `Puoi trovare ${beach} sulla mappa. Tocca il pin per centrare la vista.`;
    return "Seleziona una spiaggia dalla mappa per vedere la posizione esatta.";
  }

  // When best to go
  if (
    has(q, "quando andare", "orario migliore", "momento migliore", "meno affollata", "quando e meglio", "a che ora andare", "quando conviene")
  ) {
    if (beach)
      return `Di solito ${beach} è meno affollata la mattina presto o nel tardo pomeriggio. Apri la scheda per vedere la previsione ora per ora.`;
    return "Seleziona una spiaggia per vedere quando è meno affollata.";
  }

  // How prediction works
  if (
    has(q, "come funziona la previsione", "come calcola", "algoritmo", "come fa a sapere l affollamento", "come funzionano le previsioni", "sistema previsioni", "come prevede")
  ) {
    return "ONDA usa dati storici, meteo, stagionalità, festività e segnalazioni in tempo reale per calcolare un indice di affollamento (0-100) per le prossime ore. Più segnalazioni arrivano, più la previsione è precisa.";
  }

  // How reliability works
  if (
    has(q, "affidabilita", "quanto e affidabile", "come funziona il punteggio", "consenso", "come funziona l affidabilita", "cosa significa affidabilita")
  ) {
    return "L'affidabilità misura quanto le segnalazioni recenti concordano. Alta = concordano tutte. Media = qualche discrepanza. Bassa = dati scarsi o discordanti. Più segnalazioni, più alta l'affidabilità.";
  }

  // State: LIVE
  if (has(q, "cosa significa live", "cosa vuol dire live", "stato live", "cos e live")) {
    return "LIVE significa che c'è almeno una segnalazione degli ultimi 5 minuti. I dati riflettono la situazione attuale in tempo reale.";
  }

  // State: RECENT
  if (
    has(q, "cosa significa recent", "cosa vuol dire recent", "stato recent", "cos e recent", "cosa significa recente")
  ) {
    return "RECENTE significa che ci sono segnalazioni degli ultimi 30 minuti, ma non nell'ultimo quarto d'ora. I dati sono freschi ma non recentissimi.";
  }

  // State: PRED / STIMA
  if (
    has(q, "cosa significa pred", "cosa vuol dire pred", "stato pred", "cos e pred", "cosa significa stima", "cosa vuol dire stima", "cos e la stima")
  ) {
    return "STIMA (o PRED) significa che non ci sono segnalazioni recenti: l'affollamento mostrato è una previsione algoritmica basata su storico, meteo e giorno della settimana.";
  }

  // Registration benefits
  if (
    has(q, "perche registrarmi", "a cosa serve l account", "benefici account", "cosa cambia con l account", "perche creare un account", "vantaggi registrazione")
  ) {
    return "Con un account puoi usare ONDA, salvare spiagge preferite, inviare segnalazioni, guadagnare punti e sbloccare badge. La registrazione è gratuita.";
  }

  // Is app free
  if (has(q, "e gratuita", "quanto costa", "si paga", "abbonamento", "gratis", "free", "costo dell app", "app a pagamento")) {
    return "Sì, Where2Beach è completamente gratuita. Nessun abbonamento, nessun costo nascosto.";
  }

  // How many beaches
  if (has(q, "quante spiagge", "quante ne hai", "copertura spiagge", "quante spiagge ci sono")) {
    return "Where2Beach copre centinaia di spiagge lungo tutta la costa italiana, dal nord al sud.";
  }

  // How to report
  if (
    has(q, "come segnalo", "come invio una segnalazione", "come faccio una segnalazione", "aggiornare la mappa", "inviare report", "fare una segnalazione", "come aggiorno la mappa")
  ) {
    return "Seleziona una spiaggia → tocca il tasto Segnala → scegli livello di affollamento e condizioni → invia. La mappa si aggiorna subito!";
  }

  // How to save favorites
  if (
    has(q, "come salvo", "come aggiungo ai preferiti", "salvare una spiaggia", "aggiungere preferito", "come si mette nei preferiti", "come salvo un preferito")
  ) {
    return "Apri la scheda di una spiaggia → tocca l'icona cuore per aggiungerla ai preferiti. Richiede un account.";
  }

  // Navigation - Map
  if (has(q, "mostrami la mappa", "vai alla mappa", "apri la mappa", "torna alla mappa")) {
    return "Tocca l'icona Mappa (prima icona in basso a sinistra) nella barra di navigazione.";
  }

  // Navigation - Favorites / Profile
  if (has(q, "vai ai preferiti", "apri preferiti", "le mie spiagge preferite", "dove trovo i preferiti")) {
    return "I tuoi preferiti si trovano nella sezione Profilo. Tocca l'icona del profilo nella barra in basso.";
  }

  // Navigation - Profile
  if (has(q, "apri profilo", "vai al profilo", "dove trovo il profilo", "sezione profilo", "il mio profilo")) {
    return "Tocca l'icona Profilo (ultima icona in basso a destra) nella barra di navigazione.";
  }

  // Nearby beaches
  if (has(q, "spiagge vicino", "spiagge nelle vicinanze", "vicino a me", "spiagge nella mia zona")) {
    return "Nella scheda Mappa puoi vedere tutte le spiagge vicine. Attiva la posizione per trovare quelle più vicine a te.";
  }

  // Rewards / badges
  if (has(q, "premi", "badge", "punti", "ricompense", "missioni", "livelli")) {
    return "Puoi guadagnare punti inviando segnalazioni, sbloccare badge e completare missioni. Trovi tutto nella sezione Premi del tuo profilo.";
  }

  return null;
}

export async function askChatbot(
  messages: ChatbotMessage[],
  context: ChatbotContext,
  signal?: AbortSignal,
): Promise<AskChatbotResult> {
  const sanitizedMessages = sanitizeMessages(messages);
  if (sanitizedMessages.length === 0) {
    return { ok: false, error: "invalid_payload" };
  }

  // Try local pattern matching first (no API cost)
  const lastUserMessage = [...sanitizedMessages].reverse().find((m) => m.role === "user");
  if (lastUserMessage) {
    const localReply = handleLocalQuery(lastUserMessage.content, context);
    if (localReply !== null) {
      return { ok: true, source: "local", reply: localReply, usage: null };
    }
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
