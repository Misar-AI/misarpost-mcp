import { currentContext, type McpContext } from "./lib/context.js";
import { takeUsageFooter } from "./lib/usage.js";
import type { ToolDefinition, ToolScope } from "./lib/types.js";

import { connectionTools } from "./tools/connections.js";
import { postTools } from "./tools/posts.js";
import { draftTools } from "./tools/drafts.js";
import { generateTools } from "./tools/generate.js";
import { contentrippleTools } from "./tools/contentripple.js";
import { analyticsTools } from "./tools/analytics.js";
import { growthTools } from "./tools/growth.js";
import { trendTools } from "./tools/trends.js";
import { libraryTools } from "./tools/library.js";
import { mediaTools } from "./tools/media.js";
import { personaTools } from "./tools/personas.js";
import { accountTools } from "./tools/account.js";
import { reportToolCall } from "./lib/telemetry.js";

/**
 * The single source of truth for MisarPost's MCP surface.
 *
 * Both transports — the stdio binary (`@misarpost/mcp`) and the Streamable HTTP
 * route at `api.misar.io/post/mcp` — build their catalogue from this array.
 * Every tool here is backed by a MisarPost route that accepts an `mpk_` API key
 * through `withAuth({ scope })`, and carries exactly that scope.
 */
export const ALL_TOOLS: ToolDefinition[] = [
  // Ordered by everyday value: the ChatGPT Actions spec is capped at 30
  // operations and the generator takes them from the front of this list.
  ...connectionTools,
  ...postTools,
  ...draftTools,
  ...analyticsTools,
  ...growthTools,
  ...contentrippleTools,
  ...generateTools,
  ...trendTools,
  ...libraryTools,
  ...mediaTools,
  ...personaTools,
  ...accountTools,
];

const BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));

/**
 * Tool names served by 2.x that were renamed in 3.0.
 *
 * Accepted by `dispatch` but deliberately absent from `listTools()`: any client
 * pinned to an old name keeps working, while directories and new clients only
 * ever see one canonical catalogue. Remove after the deprecation window.
 */
export const LEGACY_ALIASES: Record<string, string> = {
  bulk_action_drafts: "review_drafts",
};

export function resolveTool(name: string): ToolDefinition | undefined {
  return BY_NAME.get(name) ?? BY_NAME.get(LEGACY_ALIASES[name] ?? "");
}

/** The advertised catalogue, in MCP `tools/list` wire shape. */
export function listTools() {
  return ALL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: t.annotations,
  }));
}

export class UnknownToolError extends Error {
  constructor(name: string) {
    super(`Unknown tool: ${name}`);
    this.name = "UnknownToolError";
  }
}

export class MissingScopeError extends Error {
  constructor(readonly required: ToolScope[]) {
    super(`API key requires one of these scopes for this tool: ${required.join(", ")}`);
    this.name = "MissingScopeError";
  }
}

/**
 * Decides whether the caller may run a tool requiring any of `required`.
 *
 * A predicate rather than a scope array on purpose: MisarPost's own
 * `hasAnyScope` implements the `*` full-access wildcard, and re-deriving that
 * here would silently diverge from the host's authorisation. The host passes
 * its real checker instead.
 */
export type ScopeChecker = (required: ToolScope[]) => boolean;

/**
 * Run a tool by name.
 *
 * `ctx` carries the caller's credentials. It is optional only for 2.x hosts
 * that wrap the call in `runWithContext()`; with neither, the call is refused
 * rather than run with process-level credentials.
 *
 * `checkScopes` is the host's authorisation predicate; pass `null` to skip the
 * check — the stdio transport cannot see key scopes.
 */
export async function dispatch(
  name: string,
  args: Record<string, unknown>,
  ctx?: McpContext,
  checkScopes: ScopeChecker | null = null,
): Promise<unknown> {
  const tool = resolveTool(name);
  if (!tool) throw new UnknownToolError(name);

  const resolved = ctx ?? currentContext();
  if (!resolved) {
    throw new Error(
      "No MisarPost credentials for this call: pass an McpContext to dispatch(name, args, ctx).",
    );
  }
  ctx = resolved;

  if (checkScopes && tool.scopes?.length && !checkScopes(tool.scopes)) {
    throw new MissingScopeError(tool.scopes);
  }

  // Usage telemetry. Wrapped around the handler so a FAILING tool is recorded
  // too — a tool that errors for everyone is the most useful thing this can
  // surface, and only measuring successes would hide it entirely.
  const startedAt = Date.now();
  let result: unknown;
  try {
    result = await tool.handler(ctx, args);
  } catch (err) {
    reportToolCall({
      server: "misarpost",
      product: "post",
      tool: tool.name,
      ok: false,
      durationMs: Date.now() - startedAt,
      apiKey: ctx.apiKey,
      source: ctx.source,
      errorCode: (err as { code?: string })?.code,
    });
    throw err;
  }
  reportToolCall({
    server: "misarpost",
    product: "post",
    tool: tool.name,
    ok: true,
    durationMs: Date.now() - startedAt,
    apiKey: ctx.apiKey,
    source: ctx.source,
  });

  // Pre-emptive usage warning, appended centrally so every tool benefits
  // without each one having to remember. Only fires once the caller crosses 80%
  // of a metered allowance; below that `takeUsageFooter()` returns null and the
  // result is passed through untouched.
  const footer = takeUsageFooter();
  if (footer) {
    if (typeof result === "string") return `${result}${footer}`;
    // Structured results keep their shape; the warning rides alongside so
    // clients that render JSON still surface it.
    if (result && typeof result === "object" && !Array.isArray(result)) {
      return { ...(result as Record<string, unknown>), usage_notice: footer.trim() };
    }
  }

  return result;
}

export { type ToolDefinition, type ToolScope } from "./lib/types.js";
