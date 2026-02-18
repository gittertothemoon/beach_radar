#!/usr/bin/env node

import {mkdirSync} from "node:fs";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";

const parseArg = (name) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
};

const fromArg = Number.parseInt(parseArg("from"), 10);
const toArg = Number.parseInt(parseArg("to"), 10);

const from = Number.isFinite(fromArg) ? Math.max(1, fromArg) : 1;
const to = Number.isFinite(toArg) ? Math.max(from, toArg) : 30;

const outDir = resolve(process.cwd(), "out", "bomb-pack");
mkdirSync(outDir, {recursive: true});

const remotionBin = process.platform === "win32"
  ? resolve(process.cwd(), "node_modules", ".bin", "remotion.cmd")
  : resolve(process.cwd(), "node_modules", ".bin", "remotion");

for (let index = from; index <= to; index += 1) {
  const id = String(index).padStart(2, "0");
  const composition = `Where2Beach-Bomb-${id}`;
  const output = resolve(outDir, `day-${id}.mp4`);

  console.log(`[render] ${composition} -> ${output}`);
  const result = spawnSync(
    remotionBin,
    ["render", "src/index.ts", composition, output],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`[render] completed ${to - from + 1} videos in ${outDir}`);
