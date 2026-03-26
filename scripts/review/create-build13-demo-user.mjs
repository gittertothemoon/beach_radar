#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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

async function findUserIdByEmail(adminClient, email) {
  let page = 1;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;

    const users = data?.users ?? [];
    const found = users.find(
      (user) => (user.email || "").toLowerCase() === email.toLowerCase(),
    );
    if (found?.id) return found.id;

    if (users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  const env = readEnvFile(path.resolve(".env.local"));
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRole || !anonKey) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY in .env.local",
    );
  }

  const email = process.env.REVIEW_EMAIL || "appreview.build13@where2beach.com";
  const password =
    process.env.REVIEW_PASSWORD ||
    `W2B!Build13!${randomBytes(6).toString("base64url")}`;

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  const existingId = await findUserIdByEmail(admin, email);
  if (existingId) {
    const { error } = await admin.auth.admin.deleteUser(existingId);
    if (error) throw error;
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: "App",
      last_name: "Review",
    },
  });
  if (createErr) throw createErr;

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
  const { data: signInData, error: signInErr } =
    await client.auth.signInWithPassword({ email, password });
  if (signInErr || !signInData?.user?.id) {
    throw signInErr || new Error("Login smoke failed for review account");
  }
  await client.auth.signOut();

  const result = {
    ok: true,
    email,
    password,
    userId: created.user?.id ?? null,
    recreated: Boolean(existingId),
  };

  const credentialsOut = process.env.REVIEW_CREDENTIALS_OUT;
  if (credentialsOut) {
    fs.mkdirSync(path.dirname(credentialsOut), { recursive: true });
    fs.writeFileSync(credentialsOut, JSON.stringify(result, null, 2), "utf8");
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
