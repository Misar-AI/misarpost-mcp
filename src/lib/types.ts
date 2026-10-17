import type { McpContext } from "./context.js";

/**
 * A JSON Schema object describing a tool's arguments.
 *
 * Deliberately structural rather than importing the MCP SDK's `Tool` type: the
 * registry is consumed by both the SDK-based stdio server and the framework-free
 * JSON-RPC HTTP handler, and the HTTP route must not carry an SDK dependency
 * into the host's bundle.
 */
export interface JsonSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * Behavioural hints surfaced to clients and directories.
 *
 * Smithery, Claude Desktop, and VS Code all read these to decide whether a tool
 * needs confirmation before running, so every tool declares them explicitly
 * rather than relying on the SDK defaults.
 */
export interface ToolAnnotations {
  title?: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

/**
 * The route-scope vocabulary of the MisarPost public API — `API_SCOPES` in
 * MisarPost `src/lib/api-auth/scopes.ts`, stored comma-separated on
 * `api_keys.scopes`. Every key-reachable route declares exactly one of these
 * via `withAuth({ scope })`, and each tool's `scopes` is that declared scope,
 * so the hosted MCP endpoint refuses exactly what the REST API would.
 *
 * The `*` wildcard and the legacy-scope implications are resolved by the
 * host's `hasAnyScope`, never here. `followers:read` exists in the vocabulary
 * but no route declares it, so no tool can use it and it is omitted.
 */
export type ToolScope =
  | "posts:read"
  | "posts:write"
  | "schedule:write"
  | "generate:write"
  | "analytics:read"
  | "trends:read"
  | "trends:write"
  | "connections:read"
  | "connections:write"
  | "media:read"
  | "media:write"
  | "personas:read"
  | "personas:write"
  | "workspaces:read"
  | "workspaces:write"
  | "notifications:read"
  | "notifications:write"
  | "webhooks:read"
  | "webhooks:write";

export type ToolCategory =
  | "posts"
  | "drafts"
  | "templates"
  | "tags"
  | "connections"
  | "ai"
  | "repurposing"
  | "trends"
  | "analytics"
  | "growth"
  | "media"
  | "video"
  | "personas"
  | "notifications"
  | "webhooks"
  | "workspaces";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: ToolAnnotations;
  /** Grouping used by the README, docs, and directory listings. */
  category: ToolCategory;
  /** The scope the backing route method declares in `withAuth({ scope })`. */
  scopes: ToolScope[];
  handler: (ctx: McpContext, args: Record<string, unknown>) => Promise<unknown>;
}

/** Convenience builder so every tool file stays declarative. */
export function defineTool(def: ToolDefinition): ToolDefinition {
  return def;
}

/**
 * Read an argument by its canonical snake_case name, falling back to the
 * camelCase spelling 2.x advertised. Clients pinned to the old schema keep
 * working through the 3.0 rename without the old names being advertised.
 */
export function arg(args: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    const value = args[name];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

/**
 * A required string argument used in a URL path or as an identifier.
 *
 * Interpolating a missing value produced paths like `/connections/undefined/plugs`
 * that 404 with a message naming nothing the caller passed.
 */
export function requireString(args: Record<string, unknown>, ...names: string[]): string {
  const value = arg(args, ...names);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required argument: ${names[0]}`);
  }
  return value;
}
