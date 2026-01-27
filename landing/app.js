/*
  Beach Radar landing configuration:
  - Set SUBSCRIBE_ENDPOINT to your endpoint when ready.
  - Expected payload: { email, ts, utm_source, utm_medium, utm_campaign, utm_content, br_src, source }
  - If left empty, submissions are stored locally (localStorage) and UX still completes.
*/
const SUBSCRIBE_ENDPOINT = "";
const SOURCE = "landing_qr_prereg_v2";

const STORAGE_KEY = "br_prereg_leads_v2";
const LAST_KEY = "br_prereg_last_v2";
const ATTR_KEY = "br_attr_v2";

const els = {
  panelInner: document.querySelector(".panel__inner"),
  formPanel: document.getElementById("formPanel"),
  successPanel: document.getElementById("successPanel"),
  form: document.getElementById("preregForm"),
  email: document.getElementById("emailInput"),
  emailError: document.getElementById("emailError"),
  submitButton: document.getElementById("submitButton"),
  submitLabel: document.querySelector("[data-label]"),
  successTitle: document.getElementById("successTitle"),
  whatsappInviteButton: document.getElementById("whatsappInviteButton"),
  resetButton: document.getElementById("resetButton"),
  privacyButton: document.getElementById("privacyButton"),
  privacyInlineButton: document.getElementById("privacyInlineButton"),
  privacyModal: document.getElementById("privacyModal"),
};

let isSubmitting = false;
let lastPayload = null;
const attribution = captureAttribution();

init();

function init() {
  bindEvents();
  updateSubmitState();
  track("br_prereg_view", { attribution });
}

function bindEvents() {
  els.email.addEventListener("input", () => {
    clearEmailError();
    updateSubmitState();
  });

  els.email.addEventListener("blur", () => {
    validateEmail(true);
    updateSubmitState();
  });

  els.form.addEventListener("submit", onSubmit);
  if (els.whatsappInviteButton) {
    els.whatsappInviteButton.addEventListener("click", onWhatsappInvite);
  }
  if (els.resetButton) {
    els.resetButton.addEventListener("click", resetFlow);
  }
  if (els.privacyButton) {
    els.privacyButton.addEventListener("click", openPrivacy);
  }
  if (els.privacyInlineButton) {
    els.privacyInlineButton.addEventListener("click", openPrivacy);
  }

  els.privacyModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.hasAttribute("data-close")) {
      closePrivacy();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.privacyModal.hidden) {
      closePrivacy();
    }
  });
}

async function onSubmit(event) {
  event.preventDefault();
  if (isSubmitting) {
    return;
  }

  const valid = validateEmail(true);
  if (!valid) {
    updateSubmitState();
    return;
  }

  const payload = buildPayload();
  lastPayload = payload;

  track("br_prereg_submit_attempt", {
    emailDomain: getEmailDomain(payload.email),
    attribution,
  });

  setSubmitting(true);

  try {
    if (SUBSCRIBE_ENDPOINT) {
      await submitRemote(payload);
    } else {
      persistLocal(payload);
    }

    track("br_prereg_submit_success", {
      emailDomain: getEmailDomain(payload.email),
      attribution,
      mode: SUBSCRIBE_ENDPOINT ? "remote" : "local",
    });

    showSuccess();
  } catch (error) {
    const message = error instanceof Error ? error.message : "submit_error";
    track("br_prereg_submit_error", { message, attribution });
    setEmailError("Qualcosa è andato storto. Riprova tra poco.");
    setSubmitting(false);
    updateSubmitState();
  }
}

function buildPayload() {
  const email = (els.email.value || "").trim();
  return {
    email,
    ts: new Date().toISOString(),
    source: SOURCE,
    ...attribution,
    userAgent: navigator.userAgent,
  };
}

async function submitRemote(payload) {
  const response = await fetch(SUBSCRIBE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`remote_${response.status}`);
  }
}

function persistLocal(payload) {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    list.push(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    localStorage.setItem(LAST_KEY, JSON.stringify(payload));
  } catch (error) {
    // Local storage failures shouldn't block the UX.
  }
}

function showSuccess() {
  els.successPanel.hidden = false;
  els.panelInner.classList.add("is-success");
  setSubmitting(false);
  disableForm();

  if (els.successTitle) {
    els.successTitle.setAttribute("tabindex", "-1");
    els.successTitle.focus({ preventScroll: true });
  }
}

function disableForm() {
  const controls = els.form.querySelectorAll("input, button");
  controls.forEach((control) => control.setAttribute("disabled", "true"));
}

function enableForm() {
  const controls = els.form.querySelectorAll("input, button");
  controls.forEach((control) => control.removeAttribute("disabled"));
}

function setSubmitting(next) {
  isSubmitting = next;
  els.submitButton.classList.toggle("is-loading", next);
  els.submitButton.disabled = next;
  if (els.submitLabel) {
    els.submitLabel.textContent = next ? "Invio…" : "Voglio l’accesso early";
  }
}

function updateSubmitState() {
  const valid = isValidEmail(els.email.value);
  els.submitButton.disabled = !valid || isSubmitting;
}

function validateEmail(showError) {
  const value = (els.email.value || "").trim();
  const valid = isValidEmail(value);
  els.email.setAttribute("aria-invalid", valid ? "false" : "true");

  if (!valid && showError) {
    setEmailError("Inserisci una email valida.");
  }

  if (valid) {
    clearEmailError();
  }

  return valid;
}

function isValidEmail(value) {
  if (!value) {
    return false;
  }
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  return re.test(value.trim());
}

function setEmailError(message) {
  els.emailError.textContent = message;
  els.email.setAttribute("aria-invalid", "true");
}

function clearEmailError() {
  els.emailError.textContent = "";
  els.email.setAttribute("aria-invalid", "false");
}

async function onWhatsappInvite() {
  const shareUrl = getShareUrl();
  const shareText = "Guarda Beach Radar: scopri in 5 secondi se la tua spiaggia è piena.";
  const message = `${shareText}\n${shareUrl}`;

  track("br_prereg_invite_whatsapp", {
    attribution,
    mode: navigator.share ? "share_sheet" : "wa_link",
  });

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Beach Radar",
        text: shareText,
        url: shareUrl,
      });
      return;
    } catch (error) {
      // If the share sheet is dismissed, fall back to WhatsApp link.
    }
  }

  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank", "noopener");
}

function resetFlow() {
  els.panelInner.classList.remove("is-success");
  els.successPanel.hidden = true;
  lastPayload = null;
  setSubmitting(false);
  enableForm();
  els.email.value = "";
  clearEmailError();
  updateSubmitState();
  els.email.focus({ preventScroll: true });
}

function getShareUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function captureAttribution() {
  const fromSession = readAttrFromSession();
  const fromUrl = readAttrFromUrl();
  const merged = { ...fromSession, ...fromUrl };
  writeAttrToSession(merged);
  return merged;
}

function readAttrFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_content: params.get("utm_content") || "",
    br_src: params.get("br_src") || "",
  };
}

function readAttrFromSession() {
  try {
    const raw = sessionStorage.getItem(ATTR_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function writeAttrToSession(attr) {
  try {
    sessionStorage.setItem(ATTR_KEY, JSON.stringify(attr));
  } catch (error) {
    // Ignore session storage issues.
  }
}

function openPrivacy() {
  els.privacyModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closePrivacy() {
  els.privacyModal.hidden = true;
  document.body.style.overflow = "hidden";
  const focusTarget = els.privacyInlineButton || els.privacyButton;
  if (focusTarget) {
    focusTarget.focus({ preventScroll: true });
  }
}

function getEmailDomain(email) {
  if (!email || !email.includes("@")) {
    return null;
  }
  return email.split("@").pop().toLowerCase();
}

function track(name, detail) {
  window.dispatchEvent(new CustomEvent("br_event", { detail: { name, ...detail } }));
}
