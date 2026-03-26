#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium, devices } from "playwright";

const REVIEW_BEACH_ID = process.env.REVIEW_BEACH_ID || "BR-RN-001";
const REVIEW_BEACH_NAME = process.env.REVIEW_BEACH_NAME || "Bagno Uno";
const DOWNLOADS_DIR = "/Users/ivanpanto/Downloads";
const VIDEO_WIDTH = 393;
const VIDEO_HEIGHT = 852;
const REVIEW_PACE_MULTIPLIER_RAW = process.env.REVIEW_PACE_MULTIPLIER || "1.9";
const REVIEW_PACE_MULTIPLIER = Number.isFinite(Number(REVIEW_PACE_MULTIPLIER_RAW))
  ? Math.max(1.0, Math.min(8.0, Number(REVIEW_PACE_MULTIPLIER_RAW)))
  : 1.9;
const PAUSE = {
  micro: 220,
  short: 450,
  step: 900,
  transition: 1400,
  observe: 1900,
};

function sleep(ms) {
  const pacedMs = Math.round(ms * REVIEW_PACE_MULTIPLIER);
  return new Promise((resolve) => setTimeout(resolve, pacedMs));
}

function cleanEnvValue(value) {
  return value.replace(/\\n/g, "").replace(/\r/g, "").trim();
}

function readEnvFile(filePath) {
  const out = {};
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = cleanEnvValue(value);
  }
  return out;
}

async function ensureBeachDetailOpen(page) {
  const modal = page.getByTestId("lido-modal");
  if (await modal.isVisible().catch(() => false)) return;

  const search = page.getByTestId("search-input");
  await search.click();
  await sleep(PAUSE.micro);
  await search.fill("");
  await sleep(PAUSE.micro);
  await search.fill(REVIEW_BEACH_NAME);
  await sleep(PAUSE.step);
  await page.keyboard.press("Enter");
  await modal.waitFor({ timeout: 30000 });
  await sleep(PAUSE.step);
}

async function ensureBottomSheetExpanded(page) {
  const sheetHeader = page.locator('[data-testid="bottom-sheet"] > div > button').first();
  const expanded = await sheetHeader.getAttribute("aria-expanded");
  if (expanded !== "true") {
    await sheetHeader.click({ force: true });
    await sleep(PAUSE.step);
  }
}

async function scrollLidoDetails(page) {
  const scroller = page.getByTestId("lido-modal").locator("div.overflow-y-auto").first();
  await scroller.waitFor({ timeout: 10000 });
  await scroller.evaluate((node) => {
    node.scrollTo({ top: 0, behavior: "smooth" });
  });
  await sleep(PAUSE.observe);
  await scroller.evaluate((node) => {
    node.scrollBy({ top: 420, behavior: "smooth" });
  });
  await sleep(PAUSE.observe);
  await scroller.evaluate((node) => {
    node.scrollBy({ top: 560, behavior: "smooth" });
  });
  await sleep(PAUSE.observe);
  await scroller.evaluate((node) => {
    node.scrollTo({ top: 0, behavior: "smooth" });
  });
  await sleep(PAUSE.step);
}

async function openChatbot(page) {
  await page.getByTestId("bottom-nav-chatbot").click({ force: true });
  await sleep(PAUSE.step);
  await ensureBottomSheetExpanded(page);
  await sleep(PAUSE.short);
}

async function openProfileFromSheet(page) {
  await page.getByTestId("bottom-nav-profile").click({ force: true });
  await sleep(PAUSE.step);
  await ensureBottomSheetExpanded(page);
  await sleep(PAUSE.short);

  const profileButton = page
    .locator('[data-testid="bottom-sheet"] button')
    .filter({ hasText: /apri profilo|open profile/i })
    .first();
  await profileButton.waitFor({ timeout: 15000 });
  await profileButton.click({ force: true });
  await sleep(PAUSE.step);
}

async function main() {
  const reviewEmail = process.env.REVIEW_EMAIL;
  const reviewPassword = process.env.REVIEW_PASSWORD;
  if (!reviewEmail || !reviewPassword) {
    throw new Error("Missing REVIEW_EMAIL / REVIEW_PASSWORD env vars.");
  }

  const env = readEnvFile(path.resolve(".env.local"));
  const baseUrl = env.VITE_PUBLIC_BASE_URL || "https://where2beach.com";
  const appAccessKey = env.APP_ACCESS_KEY;
  if (!appAccessKey) {
    throw new Error("Missing APP_ACCESS_KEY in .env.local");
  }

  const appPath = "/app/";
  const appLaunchUrl = `${baseUrl}/api/app-access?key=${encodeURIComponent(appAccessKey)}&path=${encodeURIComponent(appPath)}`;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath =
    process.env.REVIEW_VIDEO_OUT ||
    path.join(DOWNLOADS_DIR, `where2beach_build13_review_simulation_${stamp}.webm`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tmpVideoDir = fs.mkdtempSync(path.join(os.tmpdir(), "w2b-build13-video-"));

  const device = devices["iPhone 14 Pro"] || {
    viewport: { width: 393, height: 852 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...device,
    viewport: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
    screen: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    geolocation: {
      latitude: 44.0762395,
      longitude: 12.5760479,
      accuracy: 20,
    },
    permissions: ["geolocation"],
    recordVideo: {
      dir: tmpVideoDir,
      size: { width: VIDEO_WIDTH, height: VIDEO_HEIGHT },
    },
  });

  context.setDefaultTimeout(30000);
  const page = await context.newPage();
  const video = page.video();

  try {
    await page.goto(appLaunchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/app\//, { timeout: 30000 });
    await page.getByTestId("app-root").waitFor({ timeout: 40000 });
    await sleep(PAUSE.transition);

    // Step 1: open a beach card from search.
    await ensureBeachDetailOpen(page);
    await sleep(PAUSE.observe);

    // Step 2: explicit lido-card scrolling.
    await scrollLidoDetails(page);

    // Step 3: show account-required gate by trying favorites.
    await page.getByTestId("favorite-toggle").click();
    await page.getByTestId("auth-required-modal").waitFor({ timeout: 15000 });
    await sleep(PAUSE.observe);
    await page.locator('[data-testid="auth-required-modal"] button').first().click();
    await sleep(PAUSE.short);

    // Close lido and move to profile sign-in entrypoint.
    const preLoginLido = page.getByTestId("lido-modal");
    if (await preLoginLido.isVisible().catch(() => false)) {
      await preLoginLido.locator("button").filter({ hasText: /chiudi|close/i }).first().click();
      await sleep(PAUSE.short);
    }
    await page.getByTestId("bottom-nav-profile").click({ force: true });
    await sleep(PAUSE.step);
    await ensureBottomSheetExpanded(page);
    await sleep(PAUSE.short);
    const signInButton = page
      .locator('[data-testid="bottom-sheet"] button')
      .filter({ hasText: /accedi|sign in/i })
      .first();
    if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click({ force: true });
      await sleep(PAUSE.short);
    }

    // Step 4: login with dedicated review account.
    const loginUrl = new URL(`${baseUrl}/register/`);
    loginUrl.searchParams.set("mode", "login");
    loginUrl.searchParams.set("returnTo", "/app/");
    await page.goto(loginUrl.toString(), { waitUntil: "domcontentloaded" });
    await page.getByTestId("auth-email-input").fill(reviewEmail);
    await sleep(PAUSE.micro);
    await page.getByTestId("auth-password-input").fill(reviewPassword);
    await sleep(PAUSE.short);
    await page.getByTestId("auth-submit").click();

    await page.waitForFunction(() => /\/app\//.test(window.location.href), null, {
      timeout: 40000,
    });
    await page.getByTestId("app-root").waitFor({ timeout: 30000 });
    await sleep(PAUSE.transition);

    // Step 5: save favorite after login.
    await ensureBeachDetailOpen(page);
    await sleep(PAUSE.short);
    await page.getByTestId("favorite-toggle").click();
    await sleep(PAUSE.observe);

    // Step 6: submit a report.
    await page.getByTestId("report-cta").click();
    await page.getByTestId("report-modal").waitFor({ timeout: 15000 });
    await sleep(PAUSE.short);
    await page.getByTestId("report-level-2").click();
    await sleep(PAUSE.micro);
    await page.getByTestId("report-jellyfish-toggle").click();
    await sleep(PAUSE.short);
    await page.getByTestId("report-submit").click();
    await sleep(PAUSE.transition);
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(PAUSE.short);
    const thanksClose = page
      .locator("div.fixed.inset-0.z-\\[70\\] button")
      .filter({ hasText: /chiudi|close/i })
      .first();
    if (await thanksClose.isVisible().catch(() => false)) {
      await thanksClose.click();
      await sleep(PAUSE.short);
    }

    // Step 7: close lido and use ONDA.
    const lidoModal = page.getByTestId("lido-modal");
    if (await lidoModal.isVisible().catch(() => false)) {
      await lidoModal.locator("button").filter({ hasText: /chiudi|close/i }).first().click();
    }
    await sleep(PAUSE.step);

    await openChatbot(page);
    const chatInput = page.locator('[data-testid="bottom-sheet"] form input[type="text"]').first();
    if (await chatInput.isVisible().catch(() => false)) {
      await chatInput.fill("Come segnalo l'affollamento di una spiaggia?");
      await sleep(PAUSE.short);
      await page
        .locator('[data-testid="bottom-sheet"] form button[type="submit"]')
        .first()
        .click();
      await sleep(PAUSE.transition);
    }

    // Step 8: profile and account deletion flow.
    await openProfileFromSheet(page);
    await sleep(PAUSE.short);
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.locator("button").filter({ hasText: /elimina account/i }).first().click();
    await sleep(PAUSE.transition);
  } finally {
    await context.close();
    await browser.close();
  }

  const recordedPath = await video.path();
  fs.copyFileSync(recordedPath, outputPath);
  console.log(
    JSON.stringify(
      { ok: true, outputPath, paceMultiplier: REVIEW_PACE_MULTIPLIER },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
