import { execFileSync } from "node:child_process";

const TARGETS = ["src", "public", "api", "w2b-hero/app"];
const PATTERN = "dangerouslySetInnerHTML|innerHTML\\s*=|document\\.write\\(";

const ALLOWLIST = [
  {
    pathSuffix: "w2b-hero/app/page.tsx",
    includes: "dangerouslySetInnerHTML",
    reason: "JSON-LD script tag with pre-escaped payload",
  },
];

function isAllowedHit(line) {
  const [filePath = "", _lineNumber = "", content = ""] = line.split(":", 3);
  return ALLOWLIST.some(
    (item) => filePath.endsWith(item.pathSuffix) && content.includes(item.includes),
  );
}

function main() {
  const baseArgs = [
    "-n",
    "-e",
    PATTERN,
    ...TARGETS,
    "--glob",
    "!**/node_modules/**",
    "--glob",
    "!**/dist/**",
  ];

  let output = "";
  try {
    output = execFileSync("rg", baseArgs, { encoding: "utf8" });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      try {
        output = execFileSync(
          "grep",
          [
            "-RInE",
            PATTERN,
            ...TARGETS,
            "--exclude-dir=node_modules",
            "--exclude-dir=dist",
          ],
          { encoding: "utf8" },
        );
      } catch (fallbackError) {
        const fallbackStatus =
          fallbackError && typeof fallbackError.status === "number"
            ? fallbackError.status
            : null;
        if (fallbackStatus === 1) {
          console.log("✓ No dangerous HTML sinks found.");
          return;
        }
        throw fallbackError;
      }
      // Found matches with grep fallback.
      // Continue to allowlist filtering below.
      output = output || "";
    } else {
      const status = error && typeof error.status === "number" ? error.status : null;
      if (status === 1) {
        console.log("✓ No dangerous HTML sinks found.");
        return;
      }
      throw error;
    }

  }

  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const unexpected = lines.filter((line) => !isAllowedHit(line));
  if (unexpected.length === 0) {
    console.log("✓ No unexpected dangerous HTML sinks found.");
    return;
  }

  console.error("✗ Unexpected dangerous HTML sink usage detected:");
  for (const line of unexpected) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

main();
