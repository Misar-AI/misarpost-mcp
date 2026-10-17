import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_BASE_URL, type McpContext } from "./context.js";
import { authGuidance } from "./auth-guidance.js";

/**
 * stdio-transport credential storage.
 *
 * HTTP transport never touches this file — see `httpContext()`. Keeping the
 * filesystem read confined to this module is what lets the package be imported
 * into a Next.js route without pulling `node:fs` behaviour into the request path.
 */

const CONFIG_DIR = join(homedir(), ".misarpost");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

interface MisarConfig {
  api_key?: string;
  base_url?: string;
}

function loadConfig(): MisarConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as MisarConfig;
  } catch {
    return {};
  }
}

/**
 * Merge-write the config.
 *
 * Merging (rather than replacing) keeps a previously configured base_url when
 * only the key changes. Pass `undefined` for a field to drop it.
 */
export function saveConfig(config: MisarConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const merged: MisarConfig = { ...loadConfig(), ...config };
  for (const key of Object.keys(merged) as (keyof MisarConfig)[]) {
    if (merged[key] === undefined) delete merged[key];
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
}

export function getBaseUrl(): string {
  const envUrl = (process.env.MISARPOST_BASE_URL ?? "").trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const cfg = loadConfig();
  if (cfg.base_url) return cfg.base_url.replace(/\/$/, "");
  return DEFAULT_BASE_URL;
}

export function tryGetApiKey(): string | null {
  const envKey = process.env.MISARPOST_API_KEY?.trim();
  if (envKey) return envKey;
  return loadConfig().api_key ?? null;
}

/**
 * Resolve the stdio context lazily, at call time — never at import time.
 *
 * Registry scanners start the process with no credentials and immediately call
 * `tools/list`. An import-time failure on a missing key is exactly what froze a
 * sibling product's listing at a stale snapshot. Discovery must always succeed;
 * only `tools/call` may demand a key.
 */
export function stdioContext(): McpContext {
  const apiKey = tryGetApiKey();
  if (!apiKey) {
    // The full guidance block, not a one-liner: this text is relayed verbatim
    // to the end user by their MCP client and is the only authentication UX
    // they get. See src/lib/auth-guidance.ts (generated).
    throw new Error(authGuidance("missing"));
  }
  return { apiKey, baseUrl: getBaseUrl(), source: "mcp_stdio" };
}
