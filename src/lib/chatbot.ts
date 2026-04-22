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
    .replace(/['''`-]/g, " ")
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

  // ── Identity / What is ONDA ──────────────────────────────────────────────
  if (has(q, "chi sei", "sei un bot", "sei un ai", "sei una ia", "sei artificiale", "sei umano", "cos e onda", "cosa sei")) {
    return "Sono ONDA, l'assistente AI di Where2Beach! Posso rispondere a domande sull'app, sul meteo, sull'affollamento delle spiagge e molto altro.";
  }

  if (has(q, "perche si chiama onda", "cosa significa onda", "nome onda", "perche onda")) {
    return "ONDA è il nome del tuo assistente AI su Where2Beach — fluido come un'onda, sempre pronto ad aiutarti a trovare la spiaggia giusta!";
  }

  // ── Greetings ────────────────────────────────────────────────────────────
  if (has(q, "ciao", "salve", "buongiorno", "buonasera", "buonanotte", "hey onda", "hei onda")) {
    return "Ciao! Sono ONDA, il tuo assistente di Where2Beach. Come posso aiutarti oggi?";
  }

  // ── Help / what can you do ───────────────────────────────────────────────
  if (has(q, "aiuto", "cosa puoi fare", "cosa sai fare", "come funzioni", "guida", "help", "di cosa sei capace", "cosa posso chiederti")) {
    return "Posso aiutarti con: meteo e condizioni del mare, affollamento in tempo reale, segnalazioni, preferiti, premi/badge, account e navigazione nell'app. Seleziona una spiaggia sulla mappa e chiedimi quello che vuoi!";
  }

  // ── What is Where2Beach ─────────────────────────────────────────────────
  if (has(q, "cos e where2beach", "cosa e where2beach", "cosa fa l app", "a cosa serve l app", "di cosa si occupa", "che app e", "spiegami l app")) {
    return "Where2Beach è un'app per trovare la spiaggia giusta in tempo reale. Mostra l'affollamento, le condizioni del mare e il meteo di centinaia di spiagge italiane, grazie a segnalazioni live dalla community.";
  }

  if (has(q, "chi ha fatto", "chi ha creato", "chi ha sviluppato", "creatori dell app", "sviluppatori dell app")) {
    return "Where2Beach è sviluppata da un team italiano appassionato di spiagge e tecnologia. Siamo sempre aperti a feedback e suggerimenti!";
  }

  // ── Weather ──────────────────────────────────────────────────────────────
  if (has(q, "meteo", "temperatura", "caldo", "freddo", "pioggia", "che tempo", "com e il tempo", "previsioni meteo", "com e fuori", "com e oggi", "vento forte", "nuvoloso", "soleggiato")) {
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

  // ── Sea / water conditions ───────────────────────────────────────────────
  if (
    has(q, "com e il mare", "condizioni mare", "mare mosso", "medus", "alghe", "com e l acqua", "acqua pulita", "onde alte", "ci sono meduse", "pericolo meduse", "acqua sicura")
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

  // ── Crowd / affollamento ─────────────────────────────────────────────────
  if (
    has(q, "affollat", "quanta gente", "quante persone", "affluenza", "piena", "com e la spiaggia", "e libera", "e piena", "folla", "calca", "quanto e piena", "posta")
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

  // ── Crowding level scale ─────────────────────────────────────────────────
  if (has(q, "cosa significa livello", "livelli di affollamento", "scala affollamento", "livello 1", "livello 2", "livello 3", "livello 4", "cosa significano i livelli", "come funziona la scala")) {
    return "La scala dell'affollamento va da 1 a 4: 1 = quasi deserta, 2 = poco affollata, 3 = moderatamente affollata, 4 = molto affollata. I colori sulla mappa rispecchiano questi livelli.";
  }

  // ── Map pin / marker colors ──────────────────────────────────────────────
  if (has(q, "cosa significano i colori", "colori sulla mappa", "colori dei pin", "colori delle spiagge", "pin verde", "pin rosso", "pin giallo", "cosa indicano i colori", "colore pin", "marker mappa")) {
    return "I colori sulla mappa indicano l'affollamento stimato: verde = poca gente, giallo = moderato, rosso = molto affollata. I pin grigi indicano spiagge senza dati recenti.";
  }

  // ── Services ─────────────────────────────────────────────────────────────
  if (
    has(q, "servizi", "parcheggio", "docce", "ombrelloni", "sdraio", "attrezzature", "stabilimento", "cosa c e", "cosa ha", "strutture disponibili", "bagni", "wc", "toilet")
  ) {
    if (beach && context.beachServices && context.beachServices.length > 0)
      return `Servizi disponibili a ${beach}: ${context.beachServices.join(", ")}.`;
    if (beach)
      return `Non ho informazioni dettagliate sui servizi di ${beach}. Controlla la scheda della spiaggia.`;
    return "Seleziona una spiaggia per vedere i servizi disponibili.";
  }

  // ── Hours ────────────────────────────────────────────────────────────────
  if (has(q, "orari", "quando apre", "quando chiude", "orario", "apertura", "chiusura", "aperta fino")) {
    if (beach && context.beachHours)
      return `${beach} è aperta: ${context.beachHours}.`;
    if (beach)
      return `Non ho gli orari ufficiali di ${beach}. Solitamente le spiagge libere sono accessibili tutto il giorno.`;
    return "Seleziona una spiaggia per vedere gli orari di apertura.";
  }

  // ── Address / location ───────────────────────────────────────────────────
  if (
    has(q, "dove si trova", "indirizzo", "come ci arrivo", "dove e la spiaggia", "posizione", "come raggiungo", "come arrivo")
  ) {
    if (beach && context.beachAddress)
      return `${beach} si trova in: ${context.beachAddress}. Puoi trovare indicazioni precise aprendo la scheda sulla mappa.`;
    if (beach)
      return `Puoi trovare ${beach} sulla mappa. Tocca il pin per centrare la vista.`;
    return "Seleziona una spiaggia dalla mappa per vedere la posizione esatta.";
  }

  // ── When best to go ──────────────────────────────────────────────────────
  if (
    has(q, "quando andare", "orario migliore", "momento migliore", "meno affollata", "quando e meglio", "a che ora andare", "quando conviene")
  ) {
    if (beach)
      return `Di solito ${beach} è meno affollata la mattina presto o nel tardo pomeriggio. Apri la scheda per vedere la previsione ora per ora.`;
    return "Seleziona una spiaggia per vedere quando è meno affollata.";
  }

  // ── Beach card / what info is shown ─────────────────────────────────────
  if (has(q, "cosa mostra la scheda", "cosa c e nella scheda", "informazioni sulla spiaggia", "cosa vedo nella scheda", "scheda della spiaggia", "cosa trovo nella scheda")) {
    return "La scheda di ogni spiaggia mostra: affollamento attuale, meteo, condizioni del mare (meduse, alghe, mare mosso), servizi disponibili, orari, previsione ora per ora e recensioni.";
  }

  if (has(q, "cosa significano le icone", "icone sulla scheda", "icona vento", "icona onde", "cosa vuol dire l icona", "icone spiaggia")) {
    return "Le icone sulla scheda spiaggia indicano le condizioni segnalate: vento forte, mare mosso, meduse, alghe. Le icone dei servizi indicano cosa è disponibile in spiaggia (docce, parcheggio, ecc.).";
  }

  // ── How prediction works ─────────────────────────────────────────────────
  if (
    has(q, "come funziona la previsione", "come calcola", "algoritmo", "come fa a sapere l affollamento", "come funzionano le previsioni", "sistema previsioni", "come prevede", "intelligenza artificiale previsioni")
  ) {
    return "ONDA usa dati storici, meteo, stagionalità, festività e segnalazioni in tempo reale per calcolare un indice di affollamento (0-100) per le prossime ore. Più segnalazioni arrivano, più la previsione è precisa.";
  }

  if (has(q, "quanto e accurata", "precisione previsione", "accuratezza", "quanto e affidabile la previsione", "errore previsione")) {
    return "La precisione delle previsioni migliora con più segnalazioni. In alta stagione, con tanti utenti attivi, la previsione è molto accurata. In bassa stagione o per spiagge poco visitate, si basa più sullo storico.";
  }

  // ── How reliability works ────────────────────────────────────────────────
  if (
    has(q, "affidabilita", "quanto e affidabile", "come funziona il punteggio", "consenso", "come funziona l affidabilita", "cosa significa affidabilita", "percentuale affidabilita")
  ) {
    return "L'affidabilità misura quanto le segnalazioni recenti concordano. Alta = concordano tutte. Media = qualche discrepanza. Bassa = dati scarsi o discordanti. Più segnalazioni, più alta l'affidabilità.";
  }

  // ── State: LIVE ──────────────────────────────────────────────────────────
  if (has(q, "cosa significa live", "cosa vuol dire live", "stato live", "cos e live")) {
    return "LIVE significa che c'è almeno una segnalazione degli ultimi 5 minuti. I dati riflettono la situazione attuale in tempo reale.";
  }

  // ── State: RECENT ────────────────────────────────────────────────────────
  if (
    has(q, "cosa significa recent", "cosa vuol dire recent", "stato recent", "cos e recent", "cosa significa recente")
  ) {
    return "RECENTE significa che ci sono segnalazioni degli ultimi 30 minuti, ma non nell'ultimo quarto d'ora. I dati sono freschi ma non recentissimi.";
  }

  // ── State: PRED / STIMA ──────────────────────────────────────────────────
  if (
    has(q, "cosa significa pred", "cosa vuol dire pred", "stato pred", "cos e pred", "cosa significa stima", "cosa vuol dire stima", "cos e la stima", "cosa e pred")
  ) {
    return "STIMA (o PRED) significa che non ci sono segnalazioni recenti: l'affollamento mostrato è una previsione algoritmica basata su storico, meteo e giorno della settimana.";
  }

  // ── Report duration & validity ───────────────────────────────────────────
  if (has(q, "quanto dura una segnalazione", "per quanto vale", "quando scade", "segnalazione scade", "validita segnalazione", "per quanto tempo vale la segnalazione")) {
    return "Una segnalazione rimane 'live' per circa 5-30 minuti. Dopo, contribuisce alla stima storica ma non è più considerata un dato in tempo reale. Più segnalazioni fresche ci sono, più i dati sono affidabili.";
  }

  if (has(q, "perche scadono", "perche non durano", "perche si aggiornano i dati", "perche cambiano i dati")) {
    return "Le segnalazioni scadono perché l'affollamento cambia velocemente. Una segnalazione di 2 ore fa potrebbe non riflettere la situazione attuale. Il sistema premia sempre i dati più freschi.";
  }

  if (has(q, "cosa succede dopo la segnalazione", "cosa succede quando segnalo", "dopo che invio", "effetto della segnalazione", "cosa cambia dopo")) {
    return "Dopo la tua segnalazione, la mappa si aggiorna subito. Il tuo contributo influenza l'indice di affollamento in tempo reale e guadagni punti per i Premi!";
  }

  // ── How to report ────────────────────────────────────────────────────────
  if (
    has(q, "come segnalo", "come invio una segnalazione", "come faccio una segnalazione", "aggiornare la mappa", "inviare report", "fare una segnalazione", "come aggiorno la mappa", "inviare una segnalazione", "mandare segnalazione")
  ) {
    return "Seleziona una spiaggia → tocca il tasto Aggiorna → scegli livello di affollamento e condizioni → invia. La mappa si aggiorna subito!";
  }

  // ── How to save favorites ────────────────────────────────────────────────
  if (
    has(q, "come salvo", "come aggiungo ai preferiti", "salvare una spiaggia", "aggiungere preferito", "come si mette nei preferiti", "come salvo un preferito", "aggiungere ai preferiti")
  ) {
    return "Apri la scheda di una spiaggia → tocca l'icona stella per aggiungerla ai preferiti. Richiede un account.";
  }

  // ── Navigation — Map ─────────────────────────────────────────────────────
  if (has(q, "mostrami la mappa", "vai alla mappa", "apri la mappa", "torna alla mappa")) {
    return "Tocca 'Mappa' nella barra di navigazione in basso.";
  }

  if (has(q, "come zoomo", "come mi sposto sulla mappa", "come navigo la mappa", "come uso la mappa", "zoom mappa", "ingrandire mappa", "muoversi sulla mappa")) {
    return "Sulla mappa puoi muoverti trascinando e zoomare con due dita (pinch) o con la rotella del mouse. Tocca un pin per aprire la scheda di quella spiaggia.";
  }

  if (has(q, "come cerco una spiaggia", "cercare una spiaggia", "trovare una spiaggia specifica", "ricerca spiagge", "come trovo una spiaggia specifica", "cerca spiaggia")) {
    return "Naviga sulla mappa verso l'area che ti interessa e tocca i pin delle spiagge. Puoi zoomare per vedere spiagge specifiche nella zona.";
  }

  // ── Navigation — Favorites / Profile ────────────────────────────────────
  if (has(q, "vai ai preferiti", "apri preferiti", "le mie spiagge preferite", "dove trovo i preferiti", "i miei preferiti")) {
    return "I tuoi preferiti si trovano nella sezione Profilo. Tocca 'Profilo' nella barra in basso.";
  }

  // ── Navigation — Profile ─────────────────────────────────────────────────
  if (has(q, "apri profilo", "vai al profilo", "dove trovo il profilo", "sezione profilo", "il mio profilo")) {
    return "Tocca 'Profilo' nella barra di navigazione in basso (ultima icona a destra).";
  }

  // ── Navigation — Rewards/Premi ───────────────────────────────────────────
  if (has(q, "vai ai premi", "apri premi", "dove trovo i premi", "sezione premi", "tab premi")) {
    return "Tocca 'Premi' nella barra di navigazione in basso per vedere i tuoi punti, badge e classifiche.";
  }

  // ── Account — Create ─────────────────────────────────────────────────────
  if (has(q, "come mi registro", "come creo un account", "registrazione", "come creo il profilo", "iscrivermi", "iscriviti", "come faccio il profilo", "aprire un account", "creare account", "nuovo account")) {
    return "Tocca 'Profilo' nella barra in basso → 'Accedi' → puoi registrarti con email o continuare con Google/Apple. La registrazione è gratuita.";
  }

  // ── Account — Login ──────────────────────────────────────────────────────
  if (has(q, "come accedo", "come mi loggo", "come faccio il login", "dimenticato la password", "non riesco ad accedere", "fare login", "entrare nell account")) {
    return "Tocca 'Profilo' in basso → 'Accedi'. Puoi entrare con email/password o con Google/Apple. Se hai dimenticato la password, usa 'Hai dimenticato la password?' nella schermata di accesso.";
  }

  // ── Account — Delete ─────────────────────────────────────────────────────
  if (has(q, "come elimino l account", "cancellare account", "eliminare profilo", "cancellare profilo", "voglio eliminare i miei dati", "eliminare account")) {
    return "Puoi eliminare il tuo account dalla sezione Profilo → Impostazioni → Elimina account. Tutti i tuoi dati verranno rimossi permanentemente.";
  }

  // ── Registration benefits ────────────────────────────────────────────────
  if (
    has(q, "perche registrarmi", "a cosa serve l account", "benefici account", "cosa cambia con l account", "perche creare un account", "vantaggi registrazione", "senza account cosa posso fare")
  ) {
    return "Con un account puoi usare ONDA, salvare spiagge preferite, inviare segnalazioni, guadagnare punti e sbloccare badge. La registrazione è gratuita.";
  }

  // ── Rewards / Premi ──────────────────────────────────────────────────────
  if (has(q, "come guadagno punti", "quanti punti", "cosa sono i badge", "come sblocco un badge", "cos e la sezione premi", "sezione premi", "a cosa servono i punti", "sistema punti")) {
    return "Nella sezione Premi guadagni punti ogni volta che invii una segnalazione. Accumula punti per salire di livello e sbloccare badge esclusivi. Più segnali, più premi!";
  }

  if (has(q, "premi", "badge", "punti", "ricompense", "missioni", "livelli")) {
    return "Puoi guadagnare punti inviando segnalazioni, sbloccare badge e completare missioni. Trovi tutto nella sezione Premi della barra in basso.";
  }

  // ── Reviews ──────────────────────────────────────────────────────────────
  if (has(q, "come lascio una recensione", "recensione spiaggia", "come valuto", "scrivere recensione", "mia recensione", "lasciare recensione", "votare spiaggia")) {
    return "Puoi lasciare una recensione dalla scheda della spiaggia, nella sezione Recensioni. Aggiungi un voto e un commento sulla tua esperienza. Richiede un account.";
  }

  // ── Nearby beaches ───────────────────────────────────────────────────────
  if (has(q, "spiagge vicino", "spiagge nelle vicinanze", "vicino a me", "spiagge nella mia zona", "spiagge piu vicine")) {
    return "Nella scheda Mappa puoi vedere tutte le spiagge vicine. Attiva la posizione per trovare quelle più vicine a te.";
  }

  // ── How many beaches / coverage ─────────────────────────────────────────
  if (has(q, "quante spiagge", "quante ne hai", "copertura spiagge", "quante spiagge ci sono", "quali spiagge coprite", "dove funziona")) {
    return "Where2Beach copre centinaia di spiagge lungo tutta la costa italiana, dal nord al sud. La copertura cresce con la community!";
  }

  // ── Comparing beaches ────────────────────────────────────────────────────
  if (has(q, "confrontare spiagge", "quale e meglio", "spiaggia migliore", "quale preferire", "migliore spiaggia")) {
    return "Per confrontare le spiagge, apri la scheda di ognuna dalla mappa e guarda l'indice di affollamento, meteo e servizi. Puoi salvare le tue preferite per averle sempre a portata di mano!";
  }

  // ── Season / best time ───────────────────────────────────────────────────
  if (has(q, "stagione migliore", "quando e la stagione", "periodo migliore", "quando andare al mare", "stagione balneare", "quando aprono le spiagge")) {
    return "La stagione balneare in Italia va tipicamente da giugno a settembre. Where2Beach è più utile in estate, quando ci sono più segnalazioni e l'affollamento è più rilevante.";
  }

  // ── Privacy / data ───────────────────────────────────────────────────────
  if (has(q, "privacy", "dati personali", "cosa raccogliete", "i miei dati", "sicurezza dati", "gdpr", "dati raccolti", "cosa sapete di me", "sono al sicuro")) {
    return "Where2Beach raccoglie solo i dati necessari: email per l'account, segnalazioni anonime, posizione solo se la consenti esplicitamente. Nessun dato viene venduto a terzi.";
  }

  // ── Notifications ────────────────────────────────────────────────────────
  if (has(q, "notifiche", "come attivo le notifiche", "disattivare notifiche", "push notification", "avvisi", "come gestisco le notifiche")) {
    return "Le notifiche si gestiscono dalle impostazioni del tuo dispositivo. Vai in Impostazioni → Notifiche → Where2Beach per abilitarle o disabilitarle.";
  }

  // ── Offline usage ────────────────────────────────────────────────────────
  if (has(q, "funziona offline", "senza connessione", "senza internet", "funziona senza rete", "dati offline", "modalita offline")) {
    return "Where2Beach richiede una connessione internet per i dati in tempo reale. Senza rete, non puoi vedere affollamento e meteo aggiornati.";
  }

  // ── Bug reporting / feedback ─────────────────────────────────────────────
  if (has(q, "segnalare un bug", "fare feedback", "contattarvi", "come vi contatto", "problema nell app", "c e un errore nell app", "app non funziona", "ho trovato un problema")) {
    return "Puoi segnalare problemi o lasciare feedback dalla sezione Profilo dell'app. Il tuo feedback ci aiuta a migliorare Where2Beach!";
  }

  // ── Language ─────────────────────────────────────────────────────────────
  if (has(q, "cambiare lingua", "come cambio la lingua", "lingua dell app", "inglese", "altra lingua", "impostare la lingua", "supporto lingue")) {
    return "Al momento Where2Beach è disponibile in italiano. Il supporto per altre lingue è in lavorazione!";
  }

  // ── App download ─────────────────────────────────────────────────────────
  if (has(q, "dove scarico l app", "download app", "come installo l app", "app store", "google play", "versione mobile", "l app per iphone", "l app per android")) {
    return "Where2Beach è disponibile sull'App Store per iPhone. Cercala come 'Where2Beach' o vai sul sito ufficiale per il link diretto.";
  }

  // ── Is app free ─────────────────────────────────────────────────────────
  if (has(q, "e gratuita", "quanto costa", "si paga", "abbonamento", "gratis", "free", "costo dell app", "app a pagamento")) {
    return "Sì, Where2Beach è completamente gratuita. Nessun abbonamento, nessun costo nascosto.";
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
