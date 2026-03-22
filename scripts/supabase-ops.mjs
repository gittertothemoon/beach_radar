import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(".");
const SUPABASE_DIR = path.join(ROOT, "supabase");
const MIGRATIONS_DIR = path.join(SUPABASE_DIR, "migrations");
const SQL_SOURCE_DIR = path.join(ROOT, "scripts", "sql");
const ENV_FILES = [".env", ".env.local"];
const FRONTEND_SUPABASE_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

const argv = process.argv.slice(2);
const command = argv.find((arg) => !arg.startsWith("--")) ?? "all";
const useFixEnv = argv.includes("--fix-env");
const shellEnvKeys = new Set(Object.keys(process.env));

const normalizeEnvValue = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const withoutQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  return withoutQuotes.replace(/\\n/g, "").trim();
};

const parseEnvIntoProcess = async (filePath) => {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1];
    // Keep user/shell-provided env vars authoritative; allow .env.local to
    // override .env values loaded in this script.
    if (shellEnvKeys.has(key)) continue;
    process.env[key] = normalizeEnvValue(match[2]);
  }
};

const loadLocalEnv = async () => {
  for (const relativeFile of ENV_FILES) {
    await parseEnvIntoProcess(path.join(ROOT, relativeFile));
  }
};

const fixSupabaseEnvLine = (line, key) => {
  const pattern = new RegExp(`^(\\s*(?:export\\s+)?${key}\\s*=\\s*)(.*)$`);
  const match = pattern.exec(line);
  if (!match) return { changed: false, line };

  const prefix = match[1];
  const value = match[2];
  const trim = value.trim();

  if (
    (trim.startsWith('"') && trim.endsWith('"')) ||
    (trim.startsWith("'") && trim.endsWith("'"))
  ) {
    const quote = trim[0];
    const inner = trim.slice(1, -1);
    const cleaned = inner.replace(/\\n/g, "").trim();
    const next = `${prefix}${quote}${cleaned}${quote}`;
    return { changed: next !== line, line: next };
  }

  const cleaned = trim.replace(/\\n/g, "").trim();
  const next = `${prefix}${cleaned}`;
  return { changed: next !== line, line: next };
};

const fixSupabaseFrontendEnvFiles = async () => {
  const changedFiles = [];

  for (const relativeFile of ENV_FILES) {
    const filePath = path.join(ROOT, relativeFile);
    let raw;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") continue;
      throw error;
    }

    let changed = false;
    const nextLines = raw.split(/\r?\n/).map((line) => {
      let nextLine = line;
      for (const key of FRONTEND_SUPABASE_KEYS) {
        const result = fixSupabaseEnvLine(nextLine, key);
        if (result.changed) changed = true;
        nextLine = result.line;
      }
      return nextLine;
    });

    if (changed) {
      await fs.writeFile(filePath, `${nextLines.join("\n").replace(/\n+$/, "")}\n`, "utf8");
      changedFiles.push(relativeFile);
    }
  }

  return changedFiles;
};

const hostFromUrl = (value) => {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
};

const projectRefFromUrl = (value) => {
  const host = hostFromUrl(value);
  if (!host) return "";
  const [subdomain] = host.split(".");
  return subdomain ?? "";
};

const probeSupabase = async ({ url, key, pathName, useBearer = false }) => {
  if (!url || !key) {
    return { ok: false, status: 0, message: "missing_env" };
  }

  try {
    const headers = { apikey: key };
    if (useBearer) headers.Authorization = `Bearer ${key}`;
    const response = await fetch(`${url}${pathName}`, { headers });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      message: text.slice(0, 180).replace(/\s+/g, " ").trim(),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : "network_error",
    };
  }
};

const runCommand = (program, args, options = {}) => {
  execFileSync(program, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...(options.env ?? {}) },
  });
};

const ensureSupabaseInit = async () => {
  const configPath = path.join(SUPABASE_DIR, "config.toml");
  try {
    await fs.access(configPath);
    return false;
  } catch {
    runCommand("npx", ["-y", "supabase", "init", "--yes"]);
    return true;
  }
};

const readSqlFiles = async () => {
  let entries = [];
  try {
    entries = await fs.readdir(SQL_SOURCE_DIR, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
};

const sanitizeMigrationName = (fileName) =>
  fileName
    .replace(/\.sql$/i, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const nextTimestamp = (baseDate, offsetSeconds) => {
  const date = new Date(baseDate.getTime() + offsetSeconds * 1000);
  const two = (value) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    two(date.getUTCMonth() + 1),
    two(date.getUTCDate()),
    two(date.getUTCHours()),
    two(date.getUTCMinutes()),
    two(date.getUTCSeconds()),
  ].join("");
};

const readMigrationFiles = async () => {
  try {
    const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
};

const syncSqlToMigrations = async () => {
  await fs.mkdir(MIGRATIONS_DIR, { recursive: true });

  const sourceFiles = await readSqlFiles();
  const migrationFiles = await readMigrationFiles();
  const migrationContents = await Promise.all(
    migrationFiles.map(async (fileName) => ({
      fileName,
      content: await fs.readFile(path.join(MIGRATIONS_DIR, fileName), "utf8"),
    })),
  );

  const existingNames = new Set(migrationFiles);
  const created = [];
  const baseDate = new Date();
  let offset = 0;

  for (const sourceFile of sourceFiles) {
    const marker = `-- source: scripts/sql/${sourceFile}`;
    const alreadySynced = migrationContents.some((entry) => entry.content.includes(marker));
    if (alreadySynced) continue;

    const sourcePath = path.join(SQL_SOURCE_DIR, sourceFile);
    const sourceContent = await fs.readFile(sourcePath, "utf8");
    const suffix = sanitizeMigrationName(sourceFile) || "migration";

    let migrationFileName = "";
    while (!migrationFileName) {
      const stamp = nextTimestamp(baseDate, offset);
      const candidate = `${stamp}_${suffix}.sql`;
      offset += 1;
      if (!existingNames.has(candidate)) {
        migrationFileName = candidate;
        existingNames.add(candidate);
      }
    }

    const migrationContent = [
      marker,
      `-- synced_at: ${new Date().toISOString()}`,
      "",
      sourceContent.trimEnd(),
      "",
    ].join("\n");

    await fs.writeFile(path.join(MIGRATIONS_DIR, migrationFileName), migrationContent, "utf8");
    created.push(migrationFileName);
  }

  return created;
};

const runDoctor = async () => {
  const supabaseUrl = normalizeEnvValue(process.env.SUPABASE_URL);
  const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const viteSupabaseUrl = normalizeEnvValue(process.env.VITE_SUPABASE_URL);
  const viteAnonKey = normalizeEnvValue(
    process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );

  const missing = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!viteSupabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!viteAnonKey) missing.push("VITE_SUPABASE_ANON_KEY");

  const sameHost =
    hostFromUrl(supabaseUrl) && hostFromUrl(viteSupabaseUrl)
      ? hostFromUrl(supabaseUrl) === hostFromUrl(viteSupabaseUrl)
      : false;

  console.log(`Doctor env missing: ${missing.length > 0 ? missing.join(", ") : "none"}`);
  console.log(`Doctor same host (server/frontend): ${sameHost ? "yes" : "no"}`);

  const anonProbe = await probeSupabase({
    url: viteSupabaseUrl || supabaseUrl,
    key: viteAnonKey,
    pathName: "/auth/v1/settings",
  });
  const serviceProbe = await probeSupabase({
    url: supabaseUrl,
    key: serviceRoleKey,
    pathName: "/auth/v1/admin/users?per_page=1",
    useBearer: true,
  });

  console.log(
    `Doctor anon probe: status=${anonProbe.status} ok=${anonProbe.ok ? "yes" : "no"} message=${anonProbe.message || "-"}`,
  );
  console.log(
    `Doctor service_role probe: status=${serviceProbe.status} ok=${serviceProbe.ok ? "yes" : "no"} message=${serviceProbe.message || "-"}`,
  );

  return { ok: serviceProbe.ok, anonOk: anonProbe.ok, missing };
};

const runMigrate = async () => {
  const dbUrl = normalizeEnvValue(process.env.SUPABASE_DB_URL);
  const accessToken = normalizeEnvValue(process.env.SUPABASE_ACCESS_TOKEN);
  const projectRef =
    normalizeEnvValue(process.env.SUPABASE_PROJECT_REF) ||
    projectRefFromUrl(normalizeEnvValue(process.env.SUPABASE_URL));
  const dbPassword = normalizeEnvValue(process.env.SUPABASE_DB_PASSWORD);

  if (dbUrl) {
    console.log("Applying migrations with SUPABASE_DB_URL...");
    runCommand("npx", [
      "-y",
      "supabase",
      "migration",
      "up",
      "--db-url",
      dbUrl,
      "--include-all",
      "--yes",
    ]);
    return { applied: true, mode: "db-url" };
  }

  if (accessToken && projectRef && dbPassword) {
    console.log("Linking project and applying migrations via --linked...");
    runCommand(
      "npx",
      ["-y", "supabase", "link", "--project-ref", projectRef, "--password", dbPassword, "--yes"],
      { env: { SUPABASE_ACCESS_TOKEN: accessToken } },
    );
    runCommand(
      "npx",
      ["-y", "supabase", "migration", "up", "--linked", "--include-all", "--yes"],
      { env: { SUPABASE_ACCESS_TOKEN: accessToken } },
    );
    return { applied: true, mode: "linked" };
  }

  const missing = [];
  if (!dbUrl) {
    if (!accessToken) missing.push("SUPABASE_ACCESS_TOKEN");
    if (!projectRef) missing.push("SUPABASE_PROJECT_REF (or SUPABASE_URL)");
    if (!dbPassword) missing.push("SUPABASE_DB_PASSWORD");
  }
  console.error(
    `Cannot apply schema migrations automatically. Missing: ${missing.join(", ")}. ` +
      "Set SUPABASE_DB_URL, or provide token/project_ref/db_password for linked mode.",
  );
  return { applied: false, mode: "none" };
};

const main = async () => {
  await loadLocalEnv();

  if (command === "fix-env") {
    const changed = await fixSupabaseFrontendEnvFiles();
    await loadLocalEnv();
    console.log(
      changed.length > 0
        ? `Fixed Supabase frontend env values in: ${changed.join(", ")}`
        : "No Supabase frontend env fixes needed.",
    );
    return;
  }

  if (useFixEnv) {
    const changed = await fixSupabaseFrontendEnvFiles();
    if (changed.length > 0) {
      console.log(`Applied env fix in: ${changed.join(", ")}`);
      await loadLocalEnv();
    }
  }

  if (command === "init") {
    const created = await ensureSupabaseInit();
    console.log(created ? "Created supabase/config.toml." : "supabase/config.toml already present.");
    return;
  }

  if (command === "sync-migrations") {
    await ensureSupabaseInit();
    const created = await syncSqlToMigrations();
    console.log(
      created.length > 0
        ? `Created ${created.length} migration files:\n- ${created.join("\n- ")}`
        : "No new migrations to create.",
    );
    return;
  }

  if (command === "doctor") {
    await runDoctor();
    return;
  }

  if (command === "migrate") {
    await ensureSupabaseInit();
    const created = await syncSqlToMigrations();
    if (created.length > 0) {
      console.log(`Created ${created.length} migration files before apply.`);
    }
    const result = await runMigrate();
    if (!result.applied) process.exitCode = 1;
    return;
  }

  if (command === "all") {
    const doctor = await runDoctor();
    if (!doctor.ok) {
      console.error(
        "Service role probe failed. Fix credentials/connectivity first, then rerun supabase:auto.",
      );
      process.exitCode = 1;
      return;
    }
    await ensureSupabaseInit();
    const created = await syncSqlToMigrations();
    if (created.length > 0) {
      console.log(`Created ${created.length} migration files.`);
    }
    const result = await runMigrate();
    if (!result.applied) process.exitCode = 1;
    return;
  }

  console.error(
    "Unknown command. Use one of: fix-env, doctor, init, sync-migrations, migrate, all",
  );
  process.exitCode = 1;
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
