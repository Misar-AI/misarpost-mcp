import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  ALL_TOOLS,
  LEGACY_ALIASES,
  dispatch,
  listTools,
  resolveTool,
  MissingScopeError,
  UnknownToolError,
} from "../../src/registry.js";
import { listPrompts, getPrompt, PROMPTS } from "../../src/prompts.js";
import { listResources, RESOURCES } from "../../src/resources.js";
import { httpContext, runWithContext } from "../../src/lib/context.js";
import type { ToolScope } from "../../src/lib/types.js";

const ctx = httpContext("mpk_test", "https://example.invalid/api");
const PKG = resolve(process.cwd(), "packages/post-mcp-server");

/**
 * MisarPost's route-scope vocabulary (src/lib/api-auth/scopes.ts API_SCOPES),
 * minus followers:read, which no route declares.
 */
const REAL_SCOPES: ToolScope[] = [
  "posts:read",
  "posts:write",
  "schedule:write",
  "generate:write",
  "analytics:read",
  "trends:read",
  "trends:write",
  "connections:read",
  "connections:write",
  "media:read",
  "media:write",
  "personas:read",
  "personas:write",
  "workspaces:read",
  "workspaces:write",
  "notifications:read",
  "notifications:write",
  "webhooks:read",
  "webhooks:write",
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tool catalogue", () => {
  it("exposes every tool with a unique snake_case name", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("carries a description and explicit annotations on every tool", () => {
    for (const tool of ALL_TOOLS) {
      // Directories rank on description quality; a bare name gets a listing buried.
      expect(tool.description.length, tool.name).toBeGreaterThan(40);
      expect(tool.annotations).toMatchObject({
        title: expect.any(String),
        readOnlyHint: expect.any(Boolean),
        destructiveHint: expect.any(Boolean),
        idempotentHint: expect.any(Boolean),
        openWorldHint: expect.any(Boolean),
      });
    }
  });

  it("declares an object inputSchema whose required fields all exist", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.inputSchema.type).toBe("object");
      for (const required of tool.inputSchema.required ?? []) {
        expect(Object.keys(tool.inputSchema.properties ?? {}), tool.name).toContain(required);
      }
    }
  });

  it("advertises snake_case argument names only", () => {
    for (const tool of ALL_TOOLS) {
      for (const prop of Object.keys(tool.inputSchema.properties ?? {})) {
        expect(prop, `${tool.name}.${prop}`).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  it("carries exactly one scope per tool — the one its route method declares", () => {
    // MisarPost routes declare a single scope via withAuth({ scope }).
    for (const tool of ALL_TOOLS) expect(tool.scopes, tool.name).toHaveLength(1);
  });

  it("only uses scopes in MisarPost's route-scope vocabulary", () => {
    // A scope that no key is ever minted with reads as access control while
    // enforcing nothing (or locking everyone out).
    for (const tool of ALL_TOOLS) {
      for (const scope of tool.scopes) expect(REAL_SCOPES, tool.name).toContain(scope);
    }
  });

  it("gives every read-only tool a :read scope and every write tool a :write scope", () => {
    for (const tool of ALL_TOOLS) {
      const kind = tool.annotations.readOnlyHint ? ":read" : ":write";
      expect(tool.scopes[0]!.endsWith(kind), `${tool.name} → ${tool.scopes[0]}`).toBe(true);
    }
  });

  it("never offers followers:read, which no route declares", () => {
    for (const tool of ALL_TOOLS) expect(tool.scopes).not.toContain("followers:read");
  });

  it("never marks a read-only tool destructive", () => {
    for (const tool of ALL_TOOLS) {
      if (tool.annotations.readOnlyHint) expect(tool.annotations.destructiveHint, tool.name).toBe(false);
    }
  });

  it("marks the tools that publish or cancel as destructive", () => {
    for (const name of [
      "schedule_post", "cancel_post", "update_post", "schedule_content_variant",
      "schedule_trend_posts", "delete_media", "delete_post_template", "delete_post_tag",
      "delete_persona", "delete_webhook",
    ]) {
      expect(resolveTool(name)!.annotations.destructiveHint, name).toBe(true);
    }
  });

  it("marks credit-spending AI tools as open-world", () => {
    for (const name of [
      "generate_posts", "repurpose_content", "enhance_topic", "generate_plan", "research_hashtags",
      "get_optimization_insights", "create_video_script", "generate_video", "generate_persona_post",
    ]) {
      expect(resolveTool(name)!.annotations.openWorldHint, name).toBe(true);
    }
  });

  it("never offers a login tool (browserLogin=false)", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    for (const n of ["login", "logout", "status", "auth_status"]) expect(names).not.toContain(n);
  });
});

describe("legacy aliases", () => {
  it("resolves every alias to a real tool", () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_ALIASES)) {
      expect(resolveTool(legacy), `alias ${legacy}`).toBeDefined();
      expect(resolveTool(legacy)!.name).toBe(canonical);
    }
  });

  it("keeps aliases out of the advertised catalogue", () => {
    // Advertising both spellings would show duplicate tools in every directory.
    const advertised = new Set(listTools().map((t) => t.name));
    for (const legacy of Object.keys(LEGACY_ALIASES)) {
      expect(advertised.has(legacy)).toBe(false);
    }
  });

  it("still serves every tool name 2.0.0 served", () => {
    // Snapshot of @misarpost/mcp 2.0.0's 20 tools. Each is served directly or
    // through a hidden alias — a pinned client never hits "Unknown tool".
    const shipped = [
      "list_connections", "get_stats", "get_contentripple_usage", "repurpose_content",
      "update_content_variant", "schedule_content_variant", "get_trends", "queue_trend_drafts",
      "get_calendar", "list_drafts", "bulk_action_drafts", "generate_posts", "enhance_topic",
      "generate_plan", "get_optimization_insights", "research_hashtags", "list_posts",
      "update_post", "cancel_post", "schedule_post",
    ];
    for (const name of shipped) expect(resolveTool(name), name).toBeDefined();
  });
});

describe("dispatch", () => {
  it("rejects an unknown tool", async () => {
    await expect(dispatch("nope", {}, ctx)).rejects.toBeInstanceOf(UnknownToolError);
  });

  it("enforces scopes when the caller's scopes are known", async () => {
    await expect(
      dispatch("schedule_post", {}, ctx, (req) => req.includes("posts:read")),
    ).rejects.toBeInstanceOf(MissingScopeError);
  });

  it("lets a caller holding the tool's scope through", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await dispatch("cancel_post", { post_id: "p1" }, ctx, (req) => req.includes("posts:write"));
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refuses a read tool to a key without its read scope", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(
      dispatch("list_connections", {}, ctx, (req) => req.includes("posts:read")),
    ).rejects.toBeInstanceOf(MissingScopeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the tool's exact scope to the host's checker", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const seen: string[][] = [];
    await dispatch("list_webhooks", {}, ctx, (req) => (seen.push(req), true));
    expect(seen).toEqual([["webhooks:read"]]);
  });

  it("skips the scope check when scopes are unknown (stdio)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ post: { id: "p1" } }), { status: 201 }),
    );
    await expect(dispatch("schedule_post", { content_text: "hi" }, ctx, null)).resolves.toBeDefined();
  });

  it("routes a legacy name to the canonical handler", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ updated: 1 }), { status: 200 }),
    );
    await dispatch("bulk_action_drafts", { action: "approve", ids: ["d1"] }, ctx, () => true);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://example.invalid/api/drafts");
  });

  it("surfaces the API's own error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Connected account not found" }), { status: 404 }),
    );
    await expect(dispatch("list_posts", {}, ctx, () => true)).rejects.toThrow(
      "Connected account not found",
    );
  });

  it("renders a zod validation error readably instead of [object Object]", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { formErrors: [], fieldErrors: { connectedAccountId: ["Invalid uuid"] } },
        }),
        { status: 400 },
      ),
    );
    const err = await dispatch("schedule_post", {}, ctx).catch((e: Error) => e);
    expect((err as Error).message).toContain("connectedAccountId: Invalid uuid");
    expect((err as Error).message).not.toContain("[object Object]");
  });

  it("sends the key and transport on every call", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await dispatch("get_stats", {}, ctx);
    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer mpk_test");
    expect(headers["X-MCP-Source"]).toBe("mcp_http");
  });

  it("appends the usage warning to structured results past 80%", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ variants: [] }), {
        status: 200,
        headers: {
          "x-misar-usage-feature": "ai_posts",
          "x-misar-usage-used": "9",
          "x-misar-usage-limit": "10",
        },
      }),
    );
    const result = (await dispatch("generate_posts", { topic: "x", platforms: ["twitter"] }, ctx)) as Record<
      string,
      unknown
    >;
    expect(result.usage_notice).toContain("1 of 10");
  });
});

describe("2.x host compatibility", () => {
  it("runs a context-less dispatch inside runWithContext (2.x thin-route form)", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ accounts: [] }), { status: 200 }),
    );
    await runWithContext(httpContext("mpk_ambient", "https://example.invalid/api"), () =>
      dispatch("list_connections", {}),
    );
    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer mpk_ambient");
  });

  it("refuses a context-less dispatch outside runWithContext instead of using process credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    process.env.MISARPOST_API_KEY = "mpk_should_never_be_used";
    try {
      await expect(dispatch("list_connections", {})).rejects.toThrow(/McpContext/);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      delete process.env.MISARPOST_API_KEY;
    }
  });

  it("keeps every symbol the 2.x package root exported", async () => {
    const root = await import("../../src/index.js");
    for (const symbol of [
      "ALL_TOOLS", "dispatch", "listTools", "resolveTool", "UnknownToolError",
      "PROMPTS", "listPrompts", "getPrompt", "RESOURCES", "listResources", "readResource",
      "httpContext", "runWithContext", "createSandboxServer", "SERVER_NAME", "SERVER_VERSION",
      "createHttpHandler", "corsPreflight",
    ]) {
      expect(root, symbol).toHaveProperty(symbol);
    }
  });
});

describe("prompts and resources", () => {
  it("lists every prompt with its arguments", () => {
    expect(listPrompts()).toHaveLength(PROMPTS.length);
  });

  it("only references tool names that exist in the catalogue", () => {
    // A prompt naming a tool that was renamed sends the agent chasing nothing.
    const known = new Set(ALL_TOOLS.map((t) => t.name));
    for (const prompt of PROMPTS) {
      const body = prompt.build({});
      for (const match of body.matchAll(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g)) {
        expect(known.has(match[1]!), `prompt "${prompt.name}" references unknown tool ${match[1]}`).toBe(true);
      }
    }
  });

  it("builds a prompt body for every prompt with no arguments supplied", () => {
    for (const prompt of PROMPTS) {
      expect(getPrompt(prompt.name)!.messages[0]!.content.text.length).toBeGreaterThan(50);
    }
  });

  it("returns null for an unknown prompt", () => {
    expect(getPrompt("nope")).toBeNull();
  });

  it("exposes resources with misarpost:// URIs", () => {
    expect(listResources()).toHaveLength(RESOURCES.length);
    for (const resource of listResources()) {
      expect(resource.uri).toMatch(/^misarpost:\/\//);
      expect(resource.mimeType).toBe("application/json");
    }
  });
});

describe("skills", () => {
  const dir = join(PKG, "skills");
  const skills = existsSync(dir) ? readdirSync(dir).filter((d) => existsSync(join(dir, d, "SKILL.md"))) : [];

  it("ships at least four skills", () => {
    expect(skills.length).toBeGreaterThanOrEqual(4);
  });

  it.each(skills)("%s names only real tools and carries frontmatter", (name) => {
    const text = readFileSync(join(dir, name, "SKILL.md"), "utf8");
    expect(text).toMatch(new RegExp(`^---\\nname: ${name}\\ndescription: .{40,}\\n---`));
    const known = new Set([...ALL_TOOLS.map((t) => t.name)]);
    // Snake_case words in backticks are tool names, unless they are an
    // argument name, an argument's enum value, or a status the API returns.
    const schemaWords = new Set<string>(["pending_review"]);
    const collect = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(collect);
      if (!node || typeof node !== "object") return;
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key === "properties" && value && typeof value === "object") {
          for (const prop of Object.keys(value)) schemaWords.add(prop);
        }
        if (key === "enum" && Array.isArray(value)) value.forEach((v) => schemaWords.add(String(v)));
        collect(value);
      }
    };
    ALL_TOOLS.forEach((t) => collect(t.inputSchema));
    for (const match of text.matchAll(/`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g)) {
      const word = match[1]!;
      if (!schemaWords.has(word)) expect(known.has(word), `${name} names unknown tool ${word}`).toBe(true);
    }
  });
});

describe("product naming", () => {
  it("never uses the retired product name or key prefix in source, skills or prompts", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(ts|md)$/.test(entry.name)) files.push(p);
      }
    };
    walk(join(PKG, "src"));
    walk(join(PKG, "skills"));
    for (const file of files) {
      // upgrade.ts/usage.ts are vendored from @misar/upsell and list every product.
      if (/lib\/(upgrade|usage)\.ts$/.test(file)) continue;
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/misarsocial|social\.misar\.io|MisarSocial|msk_/);
    }
  });
});
