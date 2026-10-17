import type { McpContext } from "./context.js";
import { apiError } from "./errors.js";
import { noteUsage } from "./usage.js";

export function buildQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (!entries.length) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

/**
 * Call a MisarPost API route under `<baseUrl>` (i.e. `…/post/<path>`, which the
 * api.misar.io host rewrites to the app's `/api/<path>`).
 */
export async function apiFetch<T = unknown>(
  ctx: McpContext,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${ctx.baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.apiKey}`,
      "X-MCP-Source": ctx.source,
      ...options.headers,
    },
  });
  // Record remaining allowance before anything can throw, so dispatch can
  // append the 80% warning to a successful result.
  noteUsage(res.headers);

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw apiError(res.status, body);
  return body as T;
}

/**
 * Unwrap a `{ data }` envelope when a route uses one.
 *
 * Tools should return the payload, not the envelope — an agent reading
 * `{"data":{…}}` wastes a turn drilling into `.data`. MisarPost's routes mostly
 * return named keys (`{ posts }`, `{ accounts }`), which pass through untouched.
 */
export function unwrap<T>(body: unknown): T {
  if (typeof body === "object" && body !== null && "data" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}
