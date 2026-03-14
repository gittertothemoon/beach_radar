import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const STORE_ROOT = resolve(process.cwd(), ".cache", "test-mode");
const SLEEP_BUFFER = new SharedArrayBuffer(4);
const SLEEP_VIEW = new Int32Array(SLEEP_BUFFER);
const LOCK_TIMEOUT_MS = 3_000;
const LOCK_RETRY_MS = 10;

function sleep(ms: number): void {
  Atomics.wait(SLEEP_VIEW, 0, 0, ms);
}

function storeFilePath(name: string): string {
  return resolve(STORE_ROOT, name);
}

function withStoreLock<T>(filePath: string, callback: () => T): T {
  mkdirSync(dirname(filePath), { recursive: true });
  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      mkdirSync(lockPath);
      break;
    } catch {
      if (Date.now() >= deadline) {
        throw new Error(`Timed out acquiring test-mode lock: ${lockPath}`);
      }
      sleep(LOCK_RETRY_MS);
    }
  }

  try {
    return callback();
  } finally {
    rmSync(lockPath, { recursive: true, force: true });
  }
}

function readStateUnsafe<T>(filePath: string, fallback: () => T): T {
  if (!existsSync(filePath)) return fallback();
  try {
    const raw = readFileSync(filePath, "utf8");
    if (raw.trim().length === 0) return fallback();
    return JSON.parse(raw) as T;
  } catch {
    return fallback();
  }
}

export function readTestModeStore<T>(name: string, fallback: () => T): T {
  const filePath = storeFilePath(name);
  return withStoreLock(filePath, () => readStateUnsafe(filePath, fallback));
}

export function updateTestModeStore<T, TResult>(
  name: string,
  fallback: () => T,
  updater: (state: T) => TResult,
): TResult {
  const filePath = storeFilePath(name);
  return withStoreLock(filePath, () => {
    const state = readStateUnsafe(filePath, fallback);
    const result = updater(state);

    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(state), "utf8");
    renameSync(tmpPath, filePath);

    return result;
  });
}
