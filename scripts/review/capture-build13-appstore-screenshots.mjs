#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const DOWNLOADS_DIR = "/Users/ivanpanto/Downloads";
const REVIEW_BEACH_NAME = process.env.REVIEW_BEACH_NAME || "Bagno Uno";
const OUTPUT_ROOT =
  process.env.REVIEW_SCREENSHOTS_OUT_DIR ||
  path.join(DOWNLOADS_DIR, "where2beach_build13_appstore_screenshots");

const DEVICES = [
  {
    key: "iphone65",
    label: 'iPhone 6.5"',
    viewport: { width: 414, height: 896 },
    screen: { width: 414, height: 896 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    deviceScaleFactor: 3,
    expectedOutput: { width: 1242, height: 2688 },
  },
  {
    key: "ipad13",
    label: 'iPad 13"',
    viewport: { width: 1032, height: 1376 },
    screen: { width: 1032, height: 1376 },
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    deviceScaleFactor: 2,
    expectedOutput: { width: 2064, height: 2752 },
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  await sleep(200);
  await search.fill("");
  await sleep(200);
  await search.fill(REVIEW_BEACH_NAME);
  await sleep(900);
  await page.keyboard.press("Enter");
  await modal.waitFor({ timeout: 30000 });
}

async function ensureBottomSheetExpanded(page) {
  const sheetHeader = page.locator('[data-testid="bottom-sheet"] > div > button').first();
  const expanded = await sheetHeader.getAttribute("aria-expanded");
  if (expanded !== "true") {
    await sheetHeader.click({ force: true });
    await sleep(600);
  }
}

async function closeLidoIfOpen(page) {
  const modal = page.getByTestId("lido-modal");
  if (!(await modal.isVisible().catch(() => false))) return;
  const closeButton = modal.locator("button").filter({ hasText: /chiudi|close/i }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click({ force: true });
    await sleep(500);
    return;
  }
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(500);
}

async function openChatbot(page) {
  await page.getByTestId("bottom-nav-chatbot").click({ force: true });
  await sleep(700);
  await ensureBottomSheetExpanded(page);
}

async function openProfileFromSheet(page) {
  await page.getByTestId("bottom-nav-profile").click({ force: true });
  await sleep(700);
  await ensureBottomSheetExpanded(page);
  const profileButton = page
    .locator('[data-testid="bottom-sheet"] button')
    .filter({ hasText: /apri profilo|open profile/i })
    .first();
  await profileButton.waitFor({ timeout: 15000 });
  await profileButton.click({ force: true });
}

async function capture(page, outPath) {
  await page.screenshot({
    path: outPath,
    type: "png",
    fullPage: false,
    animations: "disabled",
  });
}

async function runSet(browser, options) {
  const { device, appLaunchUrl, baseUrl, reviewEmail, reviewPassword, outputDir } = options;
  fs.mkdirSync(outputDir, { recursive: true });

  const context = await browser.newContext({
    viewport: device.viewport,
    screen: device.screen,
    userAgent: device.userAgent,
    deviceScaleFactor: device.deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    geolocation: {
      latitude: 44.0762395,
      longitude: 12.5760479,
      accuracy: 20,
    },
    permissions: ["geolocation"],
  });
  context.setDefaultTimeout(30000);

  const page = await context.newPage();
  const shots = [];
  try {
    await page.goto(appLaunchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/app\//, { timeout: 30000 });
    await page.getByTestId("app-root").waitFor({ timeout: 40000 });
    await sleep(1200);

    const mapPath = path.join(outputDir, `${device.key}_01_map_home.png`);
    await capture(page, mapPath);
    shots.push(mapPath);

    await ensureBeachDetailOpen(page);
    await sleep(1000);
    const lidoPath = path.join(outputDir, `${device.key}_02_lido_detail.png`);
    await capture(page, lidoPath);
    shots.push(lidoPath);

    const loginUrl = new URL(`${baseUrl}/register/`);
    loginUrl.searchParams.set("mode", "login");
    loginUrl.searchParams.set("returnTo", "/app/");
    await page.goto(loginUrl.toString(), { waitUntil: "domcontentloaded" });
    await page.getByTestId("auth-email-input").waitFor({ timeout: 20000 });
    await sleep(500);
    const loginPath = path.join(outputDir, `${device.key}_03_login.png`);
    await capture(page, loginPath);
    shots.push(loginPath);

    await page.getByTestId("auth-email-input").fill(reviewEmail);
    await page.getByTestId("auth-password-input").fill(reviewPassword);
    await sleep(300);
    await page.getByTestId("auth-submit").click();
    await page.waitForFunction(() => /\/app\//.test(window.location.href), null, {
      timeout: 40000,
    });
    await page.getByTestId("app-root").waitFor({ timeout: 30000 });
    await sleep(1000);

    await ensureBeachDetailOpen(page);
    await sleep(700);
    await page.getByTestId("report-cta").click();
    await page.getByTestId("report-modal").waitFor({ timeout: 15000 });
    await page.getByTestId("report-level-2").click();
    await page.getByTestId("report-jellyfish-toggle").click();
    await sleep(500);
    const reportPath = path.join(outputDir, `${device.key}_04_report_modal.png`);
    await capture(page, reportPath);
    shots.push(reportPath);

    await page.keyboard.press("Escape").catch(() => {});
    await sleep(400);
    await closeLidoIfOpen(page);

    await openChatbot(page);
    const chatInput = page.locator('[data-testid="bottom-sheet"] form input[type="text"]').first();
    if (await chatInput.isVisible().catch(() => false)) {
      await chatInput.fill("Come segnalo l'affollamento di una spiaggia?");
      await sleep(250);
      await page
        .locator('[data-testid="bottom-sheet"] form button[type="submit"]')
        .first()
        .click();
      await sleep(1900);
    }
    const ondaPath = path.join(outputDir, `${device.key}_05_onda_chat.png`);
    await capture(page, ondaPath);
    shots.push(ondaPath);

    await openProfileFromSheet(page);
    await sleep(1000);
    const profilePath = path.join(outputDir, `${device.key}_06_profile.png`);
    await capture(page, profilePath);
    shots.push(profilePath);
  } finally {
    await context.close();
  }

  return {
    device: device.label,
    expectedOutput: device.expectedOutput,
    outputDir,
    shots,
  };
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

  const appLaunchUrl = `${baseUrl}/api/app-access?key=${encodeURIComponent(appAccessKey)}&path=${encodeURIComponent("/app/")}`;
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const results = [];
    for (const device of DEVICES) {
      const outputDir = path.join(OUTPUT_ROOT, device.key);
      const result = await runSet(browser, {
        device,
        appLaunchUrl,
        baseUrl,
        reviewEmail,
        reviewPassword,
        outputDir,
      });
      results.push(result);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          outputRoot: OUTPUT_ROOT,
          sets: results,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
