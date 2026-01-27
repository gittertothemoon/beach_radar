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
  shareButton: document.getElementById("shareButton"),
  copyEmailButton: document.getElementById("copyEmailButton"),
  copyHint: document.getElementById("copyHint"),
  privacyButton: document.getElementById("privacyButton"),
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
  els.shareButton.addEventListener("click", onShare);
  els.copyEmailButton.addEventListener("click", onCopyEmail);
  els.privacyButton.addEventListener("click", openPrivacy);

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

  if (SUBSCRIBE_ENDPOINT) {
    els.copyHint.textContent = "Perfetto. Ti avviseremo appena apriamo l'accesso anticipato.";
  } else {
    els.copyHint.textContent =
      "Endpoint non configurato: abbiamo salvato localmente. Potrai copiare/esportare più tardi.";
  }
}

function disableForm() {
  const controls = els.form.querySelectorAll("input, button");
  controls.forEach((control) => control.setAttribute("disabled", "true"));
}

function setSubmitting(next) {
  isSubmitting = next;
  els.submitButton.classList.toggle("is-loading", next);
  els.submitButton.disabled = next;
  if (els.submitLabel) {
    els.submitLabel.textContent = next ? "Invio…" : "Ottieni invito";
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

async function onShare() {
  const shareUrl = getShareUrl();
  const shareData = {
    title: "Beach Radar",
    text: "Scopri in 5 secondi se la tua spiaggia è piena.",
    url: shareUrl,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      // Fall back to copy when share is dismissed or unsupported.
    }
  }

  const copied = await copyToClipboard(shareUrl);
  if (copied) {
    const original = els.shareButton.textContent;
    els.shareButton.textContent = "Link copiato";
    window.setTimeout(() => {
      els.shareButton.textContent = original;
    }, 1200);
  }
}

async function onCopyEmail() {
  const emailToCopy = lastPayload?.email || (els.email.value || "").trim();
  if (!emailToCopy) {
    return;
  }

  const copied = await copyToClipboard(emailToCopy);
  if (copied) {
    const original = els.copyEmailButton.textContent;
    els.copyEmailButton.textContent = "Email copiata";
    window.setTimeout(() => {
      els.copyEmailButton.textContent = original;
    }, 1200);
  }
}

function getShareUrl() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function copyToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    return fallbackCopy(value);
  }
}

function fallbackCopy(value) {
  try {
    const input = document.createElement("input");
    input.value = value;
    input.setAttribute("readonly", "true");
    input.style.position = "absolute";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    const result = document.execCommand("copy");
    document.body.removeChild(input);
    return result;
  } catch (error) {
    return false;
  }
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
  els.privacyButton.focus({ preventScroll: true });
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
