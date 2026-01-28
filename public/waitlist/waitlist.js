(() => {
  "use strict";

  function init() {
  const CONFIG = {
    ENDPOINT: "/api/waitlist",
    COUNT_ENDPOINT: "/api/waitlist/count",
    PROJECT: "beach_radar",
    VERSION: "waitlist_v1",
    CAP: 1000,
    STORAGE: {
      lang: "br_lang_v1",
      joined: "br_waitlist_joined_v1",
      meta: "br_waitlist_meta_v1",
      events: "br_events_v1"
    }
  };

  const content = {
    it: {
      langBtn: "EN",
      langTitle: "Switch to English",
      title: "Il radar per le tue spiagge.",
      descHTML:
        "Evita la folla. Scopri dove c'&egrave; posto grazie alle segnalazioni della community, in tempo reale.<br>Iscriviti <b>gratuitamente</b> per <b>Early Access</b>.",
      pill1: "Early Access",
      pill2: "Badge Founding Member",
      pill3: "Priorit\u00e0 sulla tua zona",
      scarcity: "Prima ondata <b>limitata</b>.<br>Posti rimanenti <b>{remaining}</b>/{cap}",
      btn: "OTTIENI ACCESSO ANTICIPATO",
      ctaJoined: "SEI DENTRO \u2705",
      loading: "Invio...",
      placeholder: "La tua email",
      privacyText: "Solo aggiornamenti importanti. No spam.",
      privacyLabel: "Privacy",
      success: "Sei dentro! Ti avviseremo al lancio. \u{1F4E1}",
      alreadyJoined: "Sei gia dentro \u2705",
      retry: "Riprova",
      error: "Inserisci un'email valida.",
      errorServer: "Qualcosa \u00e8 andato storto. Riprova.",
      errorRateLimit: "Troppi tentativi. Riprova pi\u00f9 tardi."
    },
    en: {
      langBtn: "IT",
      langTitle: "Switch to Italian",
      title: "The radar for your beaches.",
      descHTML:
        "Skip the crowd. Find where there\u2019s space thanks to community reports\u2014in real time.<br>Join <b>for free</b> for <b>Early Access</b>.",
      pill1: "Early Access",
      pill2: "Founding Member badge",
      pill3: "Priority for your area",
      scarcity: "First wave is <b>limited</b>.<br>Spots remaining <b>{remaining}</b>/{cap}",
      btn: "GET EARLY ACCESS",
      ctaJoined: "YOU'RE IN \u2705",
      loading: "Submitting...",
      placeholder: "Your email",
      privacyText: "Important updates only. No spam.",
      privacyLabel: "Privacy",
      success: "You're in! We'll notify you at launch. \u{1F4E1}",
      alreadyJoined: "You're already in \u2705",
      retry: "Retry",
      error: "Please enter a valid email.",
      errorServer: "Something went wrong. Please try again.",
      errorRateLimit: "Too many attempts. Please try again later."
    }
  };

  const params = parseQueryParams(window.location.search);
  const debugEnabled = getParamValue(params, "debug") === "1";

  function debugLog(...args) {
    if (debugEnabled) {
      console.log("[waitlist]", ...args);
    }
  }

  const utm = extractUtm(params);
  // Example custom params: ?poster=BR_01&city=Rome (both flow into attribution).
  const attribution = buildAttribution(params);

  let currentLang = resolveInitialLang(params);
  let joined = readStorage(CONFIG.STORAGE.joined) === "1";
  let remainingCount = null;
  let retryBtn = null;

  const companyInput = document.getElementById("company");
  if (companyInput) companyInput.value = "";

  function setFading(el, on) {
    if (!el) return;
    el.classList.toggle("is-fading", !!on);
  }

  function updateUI() {
    const t = content[currentLang];

    const titleEl = document.getElementById("t-title");
    const descEl = document.getElementById("t-desc");
    const btnEl = document.getElementById("t-btn");
    const langBtn = document.getElementById("langBtn");

    const pill1 = document.getElementById("t-pill1");
    const pill2 = document.getElementById("t-pill2");
    const pill3 = document.getElementById("t-pill3");

    const scarcityEl = document.getElementById("t-scarcity");

    const input = document.getElementById("emailInput");
    const privacyText = document.getElementById("privacyText");
    const privacyLink = document.getElementById("privacyLink");

    if (titleEl && descEl) {
      setFading(titleEl, true);
      setFading(descEl, true);
    }

    window.setTimeout(() => {
      if (titleEl) titleEl.innerText = t.title;
      if (descEl) descEl.innerHTML = t.descHTML;
      setFading(titleEl, false);
      setFading(descEl, false);
    }, 160);

    if (btnEl) btnEl.innerText = joined ? t.ctaJoined : t.btn;

    if (langBtn) {
      langBtn.innerText = t.langBtn;
      langBtn.title = t.langTitle;
    }

    if (pill1) pill1.innerText = t.pill1;
    if (pill2) pill2.innerText = t.pill2;
    if (pill3) pill3.innerText = t.pill3;

    if (scarcityEl) {
      const remaining = typeof remainingCount === "number" ? remainingCount : "x";
      const cap = CONFIG.CAP;
      const html = t.scarcity.replace("{remaining}", remaining).replace("{cap}", cap);
      scarcityEl.innerHTML = "<span>" + html + "</span>";
    }

    if (input) input.placeholder = t.placeholder;

    if (privacyText) privacyText.innerText = t.privacyText;
    if (privacyLink) privacyLink.innerText = t.privacyLabel;

    document.documentElement.lang = currentLang;

    const msg = document.getElementById("statusMsg");
    if (msg && msg.classList.contains("visible")) {
      const status = msg.dataset.status;
      if (status === "success") {
        const successType = msg.dataset.successType === "already" ? "already" : "success";
        const message = successType === "already" ? t.alreadyJoined : t.success;
        setStatusMessage(message, { kind: "success", successType });
      }
      if (status === "error") {
        const errorType = msg.dataset.errorType === "rate"
          ? "rate"
          : msg.dataset.errorType === "invalid"
            ? "invalid"
            : msg.dataset.errorType === "timeout"
              ? "timeout"
              : msg.dataset.errorType === "network"
                ? "network"
                : "server";
        const message = errorType === "rate"
          ? t.errorRateLimit
          : errorType === "invalid"
            ? t.error
            : t.errorServer;
        const retryable = msg.dataset.retryable === "1";
        setStatusMessage(message, { kind: "error", errorType, retryable });
      }
    }
  }

  function getRetryButton() {
    if (retryBtn) return retryBtn;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "retry-btn";
    button.id = "retryBtn";
    button.addEventListener("click", () => {
      const form = document.getElementById("waitlistForm");
      if (!form) return;
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
    });
    retryBtn = button;
    return button;
  }

  function setStatusMessage(message, { kind, successType = "", errorType = "", retryable = false } = {}) {
    const msg = document.getElementById("statusMsg");
    if (!msg) return;
    msg.dataset.status = kind || "";
    msg.dataset.successType = successType;
    msg.dataset.errorType = errorType;
    msg.dataset.retryable = retryable ? "1" : "0";
    msg.className = `status-msg visible ${kind || ""}`.trim();
    msg.textContent = message || "";

    const button = getRetryButton();
    if (retryable) {
      button.innerText = content[currentLang].retry;
      msg.appendChild(document.createTextNode(" "));
      msg.appendChild(button);
    } else if (button.parentNode === msg) {
      button.remove();
    }
  }

  function clearStatusMessage() {
    const msg = document.getElementById("statusMsg");
    if (!msg) return;
    msg.className = "status-msg";
    msg.textContent = "";
    msg.dataset.status = "";
    msg.dataset.successType = "";
    msg.dataset.errorType = "";
    msg.dataset.retryable = "0";
    const button = getRetryButton();
    if (button.parentNode === msg) button.remove();
  }

  function setLang(nextLang, options = {}) {
    if (!content[nextLang]) return;
    const isSame = currentLang === nextLang;

    currentLang = nextLang;
    writeStorage(CONFIG.STORAGE.lang, nextLang);
    updateUI();

    if (!options.silent && !isSame) {
      track("wl_lang_switch", { lang: currentLang });
    }
  }

  function toggleLang() {
    const next = currentLang === "it" ? "en" : "it";
    setLang(next);
  }

  window.toggleLang = toggleLang;

  setLang(currentLang, { silent: true });
  track("wl_open", { lang: currentLang, page: window.location.href });
  hydrateJoinedState();
  fetchRemainingCount();

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  }

  const formEl = document.getElementById("waitlistForm");
  const emailInput = document.getElementById("emailInput");
  const ctaButton = document.getElementById("t-btn");
  if (!formEl || !emailInput || !ctaButton) return;
  formEl.addEventListener("submit", handleSubmit);

  async function handleSubmit(event) {
    event.preventDefault();

    const btn = document.getElementById("t-btn");
    const input = document.getElementById("emailInput");
    if (!btn || !input) return;

    if (joined) {
      showJoinedState();
      return;
    }

    const email = input.value.trim();

    clearStatusMessage();

    if (!isValidEmail(email)) {
      setStatusMessage(content[currentLang].error, { kind: "error", errorType: "invalid" });
      input.focus();
      track("wl_submit_error", { reason: "invalid_email" });
      return;
    }

    btn.disabled = true;
    input.disabled = true;
    const original = btn.innerText;
    btn.innerText = content[currentLang].loading;

    getEmailFingerprint(email).then((fingerprint) => {
      track("wl_submit_attempt", {
        lang: currentLang,
        page: window.location.href,
        referrer: document.referrer || null,
        ...fingerprint
      });
    });

    const payload = buildPayload(email);
    let responseData = null;

    try {
      responseData = await postWaitlist(payload);
    } catch (error) {
      debugLog("submit error", error);
      const errorCode = error && error.code ? error.code : "network";
      const errorType = errorCode === "rate_limited"
        ? "rate"
        : errorCode === "invalid_email"
          ? "invalid"
          : errorCode === "timeout"
            ? "timeout"
            : errorCode === "network"
              ? "network"
              : "server";
      const message = errorType === "rate"
        ? content[currentLang].errorRateLimit
        : errorType === "invalid"
          ? content[currentLang].error
          : content[currentLang].errorServer;
      const retryable = errorType === "network" || errorType === "timeout";

      setStatusMessage(message, { kind: "error", errorType, retryable });
      track("wl_submit_error", { reason: errorCode });

      btn.disabled = false;
      input.disabled = false;
      btn.innerText = original;
      return;
    }

    if (!responseData || !responseData.ok) {
      setStatusMessage(content[currentLang].errorServer, { kind: "error", errorType: "server" });
      track("wl_submit_error", { reason: "server" });

      btn.disabled = false;
      input.disabled = false;
      btn.innerText = original;
      return;
    }

    if (responseData && responseData.ok && responseData.spam) {
      setStatusMessage(content[currentLang].errorServer, { kind: "error", errorType: "server" });
      track("wl_submit_error", { reason: "spam" });
      btn.disabled = false;
      input.disabled = false;
      btn.innerText = content[currentLang].btn;
      return;
    }

    const successType = responseData.already ? "already" : "success";
    joined = true;
    persistJoinedMeta(payload);

    setStatusMessage(
      successType === "already" ? content[currentLang].alreadyJoined : content[currentLang].success,
      { kind: "success", successType }
    );
    track("wl_submit_success", { already: !!responseData.already });

    btn.innerText = content[currentLang].ctaJoined;
    btn.disabled = true;
    input.disabled = true;
    input.value = "";
  }

  function buildPayload(email) {
    return {
      email,
      lang: currentLang,
      ts: new Date().toISOString(),
      project: CONFIG.PROJECT,
      version: CONFIG.VERSION,
      page: window.location.href,
      referrer: document.referrer || null,
      tz: getTimezone(),
      device: {
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio || 1,
        ua: navigator.userAgent
      },
      hp: getHoneypotValue(),
      utm,
      attribution
    };
  }

  function getHoneypotValue() {
    const input = document.getElementById("company");
    if (!input) return "";
    return String(input.value || "").trim();
  }

  async function postWaitlist(payload) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7000);

    try {
      const response = await fetch(CONFIG.ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
        keepalive: true,
        signal: controller.signal
      });

      let data = null;
      try {
        data = await response.json();
      } catch (err) {
        data = null;
      }

      if (!response.ok) {
        if (response.status === 429) {
          const error = new Error("rate_limited");
          error.code = "rate_limited";
          throw error;
        }

        if (response.status === 400 && data && data.error === "invalid_email") {
          const error = new Error("invalid_email");
          error.code = "invalid_email";
          throw error;
        }

        const error = new Error("server_error");
        error.code = data && data.error ? data.error : "server_error";
        throw error;
      }

      return data;
    } catch (error) {
      if (error && error.name === "AbortError") {
        const timeoutError = new Error("timeout");
        timeoutError.code = "timeout";
        throw timeoutError;
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function fetchRemainingCount() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(CONFIG.COUNT_ENDPOINT, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: controller.signal
      });

      if (!response.ok) return;
      const data = await response.json().catch(() => null);
      if (!data || data.ok !== true) return;

      if (typeof data.remaining === "number") {
        remainingCount = Math.max(0, data.remaining);
      } else if (typeof data.count === "number") {
        remainingCount = Math.max(0, CONFIG.CAP - data.count);
      }

      updateUI();
    } catch (_) {
      // keep placeholder
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  function persistJoinedMeta(payload) {
    writeStorage(CONFIG.STORAGE.joined, "1");

    const safeMeta = {
      ts: new Date().toISOString(),
      lang: payload.lang,
      project: payload.project,
      version: payload.version,
      page: payload.page,
      referrer: payload.referrer,
      tz: payload.tz,
      utm: payload.utm,
      attribution: payload.attribution
    };

    writeStorage(CONFIG.STORAGE.meta, JSON.stringify(safeMeta));
  }

  function hydrateJoinedState() {
    if (!joined) return;
    showJoinedState();
  }

  function showJoinedState() {
    const btn = document.getElementById("t-btn");
    const input = document.getElementById("emailInput");
    if (!btn || !input) return;

    setStatusMessage(content[currentLang].alreadyJoined, {
      kind: "success",
      successType: "already"
    });

    btn.innerText = content[currentLang].ctaJoined;
    btn.disabled = true;
    input.disabled = true;
  }

  function getTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (_) {
      return null;
    }
  }

  function track(name, payload = {}) {
    const event = {
      name,
      ts: new Date().toISOString(),
      payload
    };

    const existing = readStorage(CONFIG.STORAGE.events);
    let events = [];

    if (existing) {
      try {
        events = JSON.parse(existing);
      } catch (_) {
        events = [];
      }
    }

    events.push(event);

    if (events.length > 200) {
      events = events.slice(events.length - 200);
    }

    writeStorage(CONFIG.STORAGE.events, JSON.stringify(events));
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_) {
      return null;
    }
  }

  async function getEmailFingerprint(email) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return {};

    try {
      const hash = await sha256Hex(normalized);
      if (hash) return { email_sha256: hash };
    } catch (_) {
      // fall back
    }

    const domain = normalized.split("@")[1];
    return domain ? { email_domain: domain } : {};
  }

  async function sha256Hex(value) {
    if (!window.crypto || !window.crypto.subtle) return null;
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function parseQueryParams(search) {
    const paramsObj = {};
    const searchParams = new URLSearchParams(search || "");

    for (const [key, value] of searchParams.entries()) {
      if (Object.prototype.hasOwnProperty.call(paramsObj, key)) {
        const current = paramsObj[key];
        if (Array.isArray(current)) {
          current.push(value);
        } else {
          paramsObj[key] = [current, value];
        }
      } else {
        paramsObj[key] = value;
      }
    }

    return paramsObj;
  }

  function buildAttribution(paramsObj) {
    const allowedKeys = [
      "poster",
      "city",
      "fbclid",
      "gclid",
      "msclkid",
      "ttclid",
      "igshid",
      "twclid",
      "gbraid",
      "wbraid"
    ];
    const out = {};

    allowedKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(paramsObj, key)) {
        out[key] = paramsObj[key];
      }
    });

    return out;
  }
  function getParamValue(paramsObj, key) {
    const value = paramsObj[key];
    if (Array.isArray(value)) return value[0];
    return value || "";
  }

  function extractUtm(paramsObj) {
    const utmObj = {};
    Object.keys(paramsObj).forEach((key) => {
      if (key.toLowerCase().startsWith("utm_")) {
        utmObj[key] = paramsObj[key];
      }
    });
    return utmObj;
  }

  function resolveInitialLang(paramsObj) {
    const fromQuery = getParamValue(paramsObj, "lang").toLowerCase();
    if (content[fromQuery]) {
      writeStorage(CONFIG.STORAGE.lang, fromQuery);
      return fromQuery;
    }

    const stored = readStorage(CONFIG.STORAGE.lang);
    if (stored && content[stored]) return stored;

    const htmlLang = document.documentElement.lang;
    if (htmlLang && content[htmlLang]) return htmlLang;

    return "it";
  }


  /* -----------------------------
  3) TILT (desktop + mobile) + IDLE
  - Desktop: pointer/mouse + idle float when not interacting
  - Mobile: gyro if allowed + drag fallback
  ------------------------------ */
  const card = document.getElementById("tiltCard");
  if (card) {

  let tiltRaf = null;
  let targetX = 0;
  let targetY = 0;
  let dragging = false;
  let usingGyro = false;

  let currentX = 0;
  let currentY = 0;

  let idleTimer = null;
  const IDLE_RESUME_MS = 1800;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function applyTilt() {
    currentX += (targetX - currentX) * 0.12;
    currentY += (targetY - currentY) * 0.12;
    card.style.transform = `rotateY(${currentX}deg) rotateX(${currentY}deg)`;
    tiltRaf = null;
  }

  function setTilt(xDeg, yDeg) {
    targetX = clamp(xDeg, -10, 10);
    targetY = clamp(yDeg, -10, 10);
    if (!tiltRaf) tiltRaf = requestAnimationFrame(applyTilt);
  }

  function resetTilt() {
    setTilt(0, 0);
  }

  function setInteracting(on) {
    card.classList.toggle("is-interacting", !!on);
    if (idleTimer) clearTimeout(idleTimer);
    if (on) return;
    idleTimer = setTimeout(() => {
      card.classList.remove("is-interacting");
    }, IDLE_RESUME_MS);
  }

  function onPointerDown(event) {
    dragging = true;
    setInteracting(true);
    try {
      event.target.setPointerCapture(event.pointerId);
    } catch (_) {
      // ignore
    }
  }

  function onPointerMove(event) {
    const isFinePointer = window.matchMedia("(pointer: fine)").matches;
    if (usingGyro) return;

    if (!isFinePointer && !dragging) return;
    setInteracting(true);

    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = (event.clientX - cx) / (rect.width / 2);
    const dy = (event.clientY - cy) / (rect.height / 2);

    const x = dx * 8;
    const y = -dy * 6;
    setTilt(x, y);
  }

  function onPointerUp() {
    dragging = false;
    setInteracting(false);
    resetTilt();
  }

  document.addEventListener("pointerdown", onPointerDown, { passive: true });
  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerup", onPointerUp, { passive: true });
  document.addEventListener("pointercancel", onPointerUp, { passive: true });

  window.addEventListener("mouseleave", () => {
    setInteracting(false);
    resetTilt();
  });

  function handleOrientation(event) {
    const gamma = typeof event.gamma === "number" ? event.gamma : 0;
    const beta = typeof event.beta === "number" ? event.beta : 0;

    const x = gamma / 7;
    const y = -(beta - 20) / 14;

    setInteracting(true);
    setTilt(x, y);
    setInteracting(false);
  }

  async function enableGyroIfPossible() {
    if (!("DeviceOrientationEvent" in window)) return;

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") return;
      } catch (_) {
        return;
      }
    }

    usingGyro = true;
    window.addEventListener("deviceorientation", handleOrientation, true);
  }

  document.addEventListener(
    "pointerdown",
    () => {
      if (window.matchMedia("(pointer: coarse)").matches) enableGyroIfPossible();
    },
    { once: true, passive: true }
  );

  window.addEventListener("blur", () => {
    setInteracting(false);
    resetTilt();
  });

  setInteracting(false);
  }

  /* -----------------------------
  4) CANVAS RADAR (animato)
  ------------------------------ */
  const canvas = document.getElementById("radarCanvas");
  if (canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let w = 0;
  let h = 0;
  let tCanvas = 0;
  let rafId = null;

  const targetFps = reduceMotion ? 20 : 60;
  const frameInterval = 1000 / targetFps;
  let lastTs = 0;

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawRadarGrid() {
    ctx.strokeStyle = "rgba(6, 182, 212, 0.05)";
    ctx.lineWidth = 1;

    const centerX = w / 2;
    const centerY = h * 1.5;

    for (let i = 1; i < 10; i += 1) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, i * 150 - (tCanvas % 150), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawWaves() {
    const lines = reduceMotion ? 4 : 5;
    const stepX = reduceMotion ? 8 : 6;

    for (let i = 0; i < lines; i += 1) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(6, 182, 212, ${0.09 + i * 0.05})`;
      ctx.lineWidth = reduceMotion ? 1.6 : 2;

      const yOffset = h * 0.6 + i * 40;

      for (let x = 0; x <= w; x += stepX) {
        const y =
          yOffset +
          Math.sin(x * 0.003 + tCanvas * 0.02 + i) * (reduceMotion ? 16 : 20) +
          Math.sin(x * 0.01 + tCanvas * 0.01) * (reduceMotion ? 7 : 10);

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
    }
  }

  function render() {
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, w, h);

    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#020617");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    drawRadarGrid();
    drawWaves();
  }

  function animate(ts) {
    if (!lastTs) lastTs = ts;
    const delta = ts - lastTs;

    if (delta >= frameInterval) {
      lastTs = ts - (delta % frameInterval);
      render();
      tCanvas += reduceMotion ? 0.7 : 1;
    }

    rafId = requestAnimationFrame(animate);
  }

  function startCanvas() {
    if (rafId) return;
    lastTs = 0;
    rafId = requestAnimationFrame(animate);
  }

  function stopCanvas() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  window.addEventListener("resize", () => {
    resizeCanvas();
    render();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopCanvas();
    else startCanvas();
  });

  resizeCanvas();
  render();
  startCanvas();
  }

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
