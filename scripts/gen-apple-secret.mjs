#!/usr/bin/env node
// Rigenera il client secret JWT per Apple Sign In (scade ogni ~180 giorni).
// Uso: node scripts/gen-apple-secret.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, "../.env.local");
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  const env = {};
  let key = null;
  let multiline = [];
  for (const line of lines) {
    if (key) {
      if (line === '"') { env[key] = multiline.join("\n"); key = null; multiline = []; }
      else multiline.push(line);
      continue;
    }
    const m = line.match(/^([A-Z_]+)="(.*)/);
    if (!m) continue;
    if (m[2].endsWith('"')) { env[m[1]] = m[2].slice(0, -1); }
    else { key = m[1]; multiline = [m[2]]; }
  }
  return env;
}

const env = loadEnv();
const teamId = env.APPLE_TEAM_ID;
const keyId = env.APPLE_KEY_ID;
const clientId = env.APPLE_CLIENT_ID;
const privateKeyPem = env.APPLE_PRIVATE_KEY;

if (!teamId || !keyId || !clientId || !privateKeyPem) {
  console.error("Variabili APPLE_* mancanti in .env.local");
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
const payload = Buffer.from(JSON.stringify({
  iss: teamId,
  iat: now,
  exp: now + 15552000, // 180 giorni
  aud: "https://appleid.apple.com",
  sub: clientId,
})).toString("base64url");

const data = `${header}.${payload}`;
const sign = crypto.createSign("SHA256");
sign.update(data);
sign.end();
const sig = sign.sign({ key: privateKeyPem, dsaEncoding: "ieee-p1363" }).toString("base64url");
const jwt = `${data}.${sig}`;

console.log("\nNuovo APPLE_CLIENT_SECRET:");
console.log(jwt);
console.log("\nScade:", new Date((now + 15552000) * 1000).toLocaleDateString("it-IT"));
console.log("\nAggiorna APPLE_CLIENT_SECRET in .env.local e ri-esegui la configurazione Supabase.");
