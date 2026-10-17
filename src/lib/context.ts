/**
 * Execution context for a MisarPost MCP tool call.
 *
 * The same tool implementations run under two transports:
 *   - stdio  (npm `@misarpost/mcp`) — credentials come from the environment or
 *            ~/.misarpost/config.json, resolved lazily at call time.
 *   - http   (`api.misar.io/post/mcp`) — credentials arrive per request on the
 *            Authorization header and MUST NOT be cached in module state.
 *
 * Passing the context explicitly (rather than reading process.env inside
 * apiFetch, or an ambient AsyncLocalStorage as 2.x did) is what makes a single
 * tool registry safe to share between them: a Next.js route serves many users
 * from one process, so any module-level credential would leak across requests.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface McpContext {
  /** Raw MisarPost API key (`mpk_…`), without the `Bearer ` prefix. */
  apiKey: string;
  /**
   * API base, e.g. `https://api.misar.io/post`. The api.misar.io host rewrites
   * `/post/<x>` to the app's `/api/<x>` (MisarPost next.config.ts), so an
   * in-process host passes `https://post.misar.io/api` instead.
   */
  baseUrl: string;
  /** Reported to the API as `X-MCP-Source` for per-transport analytics. */
  source: "mcp_stdio" | "mcp_http";
}

export const DEFAULT_BASE_URL = "https://api.misar.io/post";

/** Build a context for an HTTP request that has already been authenticated. */
export function httpContext(apiKey: string, baseUrl?: string): McpContext {
  return {
    apiKey,
    baseUrl: (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    source: "mcp_http",
  };
}

/** 2.x name for {@link McpContext}, kept so existing imports keep compiling. */
export type PostContext = McpContext;

/**
 * 2.x compatibility only — new code passes the context to `dispatch()`.
 *
 * 2.x tools read credentials from an ambient AsyncLocalStorage and hosts called
 * `runWithContext(httpContext(key, base), () => dispatch(name, args))`.
 * `dispatch()` still honours that form: with no explicit context it uses the one
 * set here. It never falls back to process-level credentials — one host process
 * serves many users.
 */
const ambient = new AsyncLocalStorage<McpContext>();

/** @deprecated Pass the context to `dispatch(name, args, ctx)` instead. */
export function runWithContext<T>(ctx: McpContext, fn: () => Promise<T>): Promise<T> {
  return ambient.run(ctx, fn);
}

/** The context set by an enclosing `runWithContext`, if any. */
export function currentContext(): McpContext | null {
  return ambient.getStore() ?? null;
}
