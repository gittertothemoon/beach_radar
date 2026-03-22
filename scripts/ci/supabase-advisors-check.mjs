import { execFileSync } from "node:child_process";

const DEFAULT_ALLOWLIST = ["auth_leaked_password_protection"];

function runCommand(program, args, env = process.env) {
  return execFileSync(program, args, {
    encoding: "utf8",
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function parseAllowlist() {
  const extra = (process.env.SUPABASE_ADVISORS_ALLOWLIST || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWLIST, ...extra]);
}

function getAdvisorsRawOutput() {
  const dbUrl = (process.env.SUPABASE_DB_URL || "").trim();
  if (dbUrl) {
    return runCommand("npx", [
      "-y",
      "supabase",
      "db",
      "advisors",
      "--db-url",
      dbUrl,
      "--level",
      "warn",
      "--type",
      "all",
      "-o",
      "json",
    ]);
  }

  const accessToken = (process.env.SUPABASE_ACCESS_TOKEN || "").trim();
  const projectRef = (process.env.SUPABASE_PROJECT_REF || "").trim();
  const dbPassword = (process.env.SUPABASE_DB_PASSWORD || "").trim();
  if (!accessToken || !projectRef || !dbPassword) {
    throw new Error(
      "Missing Supabase credentials. Set SUPABASE_DB_URL or (SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD).",
    );
  }

  const env = { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken };
  runCommand(
    "npx",
    [
      "-y",
      "supabase",
      "link",
      "--project-ref",
      projectRef,
      "--password",
      dbPassword,
      "--yes",
    ],
    env,
  );

  return runCommand(
    "npx",
    ["-y", "supabase", "db", "advisors", "--linked", "--level", "warn", "--type", "all", "-o", "json"],
    env,
  );
}

function normalizeIssues(raw) {
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function isAllowed(issue, allowlist) {
  const keys = [issue.cache_key, issue.name].filter(Boolean);
  return keys.some((key) => allowlist.has(key));
}

function printIssues(issues, heading) {
  if (issues.length === 0) {
    console.log(`${heading}: none`);
    return;
  }
  console.log(`${heading}:`);
  for (const issue of issues) {
    console.log(`- [${issue.level}] ${issue.name}: ${issue.detail}`);
  }
}

function main() {
  const allowlist = parseAllowlist();
  const raw = getAdvisorsRawOutput();
  const issues = normalizeIssues(raw);
  const allowed = issues.filter((issue) => isAllowed(issue, allowlist));
  const unexpected = issues.filter((issue) => !isAllowed(issue, allowlist));

  printIssues(unexpected, "Unexpected advisor findings");
  printIssues(allowed, "Allowed advisor findings");

  if (unexpected.length > 0) {
    process.exit(1);
  }

  console.log("Supabase advisors check passed.");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
