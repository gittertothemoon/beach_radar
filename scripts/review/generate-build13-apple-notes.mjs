#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DOWNLOADS_DIR = "/Users/ivanpanto/Downloads";

function ensure(value, label) {
  if (!value || !String(value).trim()) {
    throw new Error(`Missing ${label}`);
  }
  return String(value).trim();
}

function nowIso() {
  return new Date().toISOString();
}

const reviewEmail = ensure(process.env.REVIEW_EMAIL, "REVIEW_EMAIL");
const reviewPassword = ensure(process.env.REVIEW_PASSWORD, "REVIEW_PASSWORD");
const reviewVideoPath = ensure(process.env.REVIEW_VIDEO_PATH, "REVIEW_VIDEO_PATH");

const submissionDate = "March 25, 2026";
const buildLabel = "Where2Beach iOS 1.0.0 (build 13)";

const body = `App Review Information - ${buildLabel}\nPrepared: ${nowIso()}\n\n1) Screen recording and core flow\nA mobile end-to-end screen recording is attached for this submission.\nVideo file: ${reviewVideoPath}\nCovered flow sequence:\n- App launch and map boot\n- Open beach detail from map context\n- Account access flow (login)\n- Favorites (save beach)\n- User-generated content flow (report submission)\n- ONDA assistant usage\n- Account deletion flow\n- Location usage in app context (map centering/report eligibility)\n\n2) App purpose\nWhere2Beach helps beachgoers quickly evaluate beach conditions and choose where to go.\nIt provides a live map experience with beach status signals, user reports, weather context, and account-based favorites.\nThe primary value is reducing uncertainty before and during beach trips, with faster decision-making for nearby options.\n\n3) Access instructions and test credentials\nMain access path:\n- Launch the app and open any beach detail from the map.\n- Account-only features include Favorites, Report submission, ONDA chat access, and Profile actions.\n\nReview account credentials (dedicated for App Review):\n- Email: ${reviewEmail}\n- Password: ${reviewPassword}\n\nNotes:\n- No special hardware is required beyond normal iPhone capabilities.\n- If location access is denied, map centering and geofence-related checks may be limited.\n\n4) External services, tools, and platforms used for core functionality\n- Supabase: authentication and core data services (account/session/report persistence).\n- OpenAI Responses API: ONDA assistant responses.\n- Open-Meteo API: weather forecast data shown in beach details.\n- CARTO + OpenStreetMap tiles: map tile rendering and attribution.\n- Vercel: API/runtime hosting and app delivery infrastructure.\n\n5) Regional differences\nCore app behavior and feature set are consistent across all supported regions.\nCurrent beach content dataset is focused on Italy (multiple Italian regions), while feature logic remains the same regardless of region.\n\n6) Regulated industry statement\nThis app does not operate in a highly regulated industry (for example medical, financial brokerage, gambling, or legal practice) and does not require special regulatory credentials for operation.\n\nAdditional compliance notes\n- No in-app purchase or subscription flow is currently active in this build.\n- Privacy policy and cookie policy are available from the product surface and linked web pages.\n- This note package was prepared for the ${submissionDate} submission cycle.`;

const outPath =
  process.env.REVIEW_NOTES_OUT ||
  path.join(DOWNLOADS_DIR, "where2beach_build13_app_review_notes.txt");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, body, "utf8");

console.log(JSON.stringify({ ok: true, outPath }, null, 2));
