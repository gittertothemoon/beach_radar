const DEFAULT_BASE_URL = "https://where2beach.com";

function normalizeBaseUrl(value) {
  const input = (value || "").trim();
  const fallback = DEFAULT_BASE_URL;
  const normalized = input || fallback;
  return normalized.replace(/\/+$/, "");
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function requireHeader(response, headerName, matcher, context) {
  const headerValue = response.headers.get(headerName);
  const ok = typeof matcher === "string" ? headerValue === matcher : matcher(headerValue);
  if (!ok) {
    fail(
      `${context}: header "${headerName}" expected ${typeof matcher === "string" ? `"${matcher}"` : "custom match"} but got "${headerValue ?? "<missing>"}"`,
    );
    return false;
  }
  return true;
}

async function checkPageHeaders(baseUrl, pathName, options = {}) {
  const allowNotFound = options.allowNotFound === true;
  const url = `${baseUrl}${pathName}`;
  const response = await fetch(url, { method: "GET", redirect: "manual" });

  if (allowNotFound && response.status === 404) {
    pass(`${pathName}: route not available yet (404), skipped`);
    return;
  }

  if (response.status !== 200) {
    fail(`${pathName}: expected status 200, got ${response.status}`);
    return;
  }
  const checks = [
    requireHeader(response, "x-content-type-options", "nosniff", pathName),
    requireHeader(response, "x-frame-options", "DENY", pathName),
    requireHeader(response, "referrer-policy", "strict-origin-when-cross-origin", pathName),
    requireHeader(
      response,
      "permissions-policy",
      (value) =>
        typeof value === "string" &&
        value.includes("camera=()") &&
        value.includes("microphone=()") &&
        value.includes("payment=()") &&
        value.includes("usb=()"),
      pathName,
    ),
  ];

  if (checks.every(Boolean)) {
    pass(`${pathName}: security headers present`);
  }
}

async function checkApiHeaders(baseUrl, pathName, expectedStatuses) {
  const url = `${baseUrl}${pathName}`;
  const response = await fetch(url, { method: "GET", redirect: "manual" });
  if (!expectedStatuses.includes(response.status)) {
    fail(`${pathName}: unexpected status ${response.status} (expected one of ${expectedStatuses.join(", ")})`);
    return;
  }

  const checks = [
    requireHeader(response, "cache-control", (value) => typeof value === "string" && value.includes("no-store"), pathName),
    requireHeader(response, "pragma", "no-cache", pathName),
    requireHeader(response, "x-content-type-options", "nosniff", pathName),
  ];

  if (checks.every(Boolean)) {
    pass(`${pathName}: no-store + no-cache + nosniff headers present`);
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(process.env.SECURITY_BASE_URL || process.argv[2]);
  console.log(`Security smoke target: ${baseUrl}`);

  await checkPageHeaders(baseUrl, "/landing/");
  await checkPageHeaders(baseUrl, "/privacy/");
  await checkPageHeaders(baseUrl, "/cookie-policy/", { allowNotFound: true });
  await checkApiHeaders(baseUrl, "/api/app-access", [200, 302, 401, 403, 405]);
  await checkApiHeaders(baseUrl, "/api/signup", [405]);

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  console.log("Security smoke completed with no blocking findings.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exit(process.exitCode || 1);
});
