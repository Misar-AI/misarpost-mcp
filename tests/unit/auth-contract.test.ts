/**
 * The authentication contract every Misar MCP server must satisfy.
 *
 * Three rules, all violated in production on a sibling product before:
 *
 *  1. Discovery NEVER requires credentials. A server that refuses (or exits)
 *     without a key never gets catalogued by registry scanners — which is why
 *     MisarMail's Smithery listing sat frozen at a stale 16-tool snapshot.
 *  2. Execution ALWAYS requires credentials. tools/call must refuse without a
 *     valid key, with the RFC 9728 challenge attached.
 *  3. The refusal must be ACTIONABLE. An MCP client relays this text straight
 *     to the model and on to the user, so it is the whole authentication UX.
 *
 * MisarPost has no /authorize consent page (browserLogin=false in
 * scripts/mcp/generate-distribution.mjs), so rule 3 is checked against the
 * manual-key path only, and the guidance must NOT offer a browser login.
 * Kept in sync with the mail suite — see docs/Guidelines/MCP_SERVER_PROTOCOL.md.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createHttpHandler } from "../../src/http.js";
import { listTools, dispatch, UnknownToolError } from "../../src/registry.js";
import {
  authGuidance,
  AUTH_URLS,
  ENV_KEY,
  KEY_PREFIX,
  CONFIG_PATH,
  HAS_BROWSER_LOGIN,
} from "../../src/lib/auth-guidance.js";

const VALID = "Bearer mpk_good";

const handler = createHttpHandler({
  baseUrl: "https://example.invalid/api",
  authenticate: async (h) => (h === VALID ? { userId: "u1" } : null),
});

function post(body: unknown, headers: Record<string, string> = {}) {
  return handler(
    new Request("https://api.misar.io/post/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

const INIT = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rule 1 — discovery never requires credentials", () => {
  it.each(["initialize", "tools/list", "prompts/list", "resources/list"])(
    "%s answers unauthenticated",
    async (method) => {
      const res = await post({ jsonrpc: "2.0", id: 1, method, params: method === "initialize" ? INIT.params : {} });
      expect(res.status).toBe(200);
    },
  );

  it("advertises the full catalogue to an unauthenticated scanner", async () => {
    const res = await post({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    const body = await res.json();
    // A scanner that sees fewer tools than the registry holds is the stale
    // listing failure all over again.
    expect(body.result.tools).toHaveLength(listTools().length);
  });

  it("reports the misarpost server identity on initialize", async () => {
    const res = await post(INIT);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe("misarpost");
  });
});

describe("rule 2 — execution always requires credentials", () => {
  it("refuses tools/call without a key", async () => {
    const res = await post({
      jsonrpc: "2.0", id: 2, method: "tools/call",
      params: { name: "list_posts", arguments: {} },
    });
    expect(res.status).toBe(401);
  });

  it("attaches the RFC 9728 challenge so OAuth clients can recover", async () => {
    const res = await post({
      jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_posts", arguments: {} },
    });
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
    expect(res.headers.get("WWW-Authenticate")).toContain("MisarPost");
  });

  it("accepts tools/call with a valid key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ posts: [] }), { status: 200 }),
    );
    const res = await post(
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_posts", arguments: {} } },
      { authorization: VALID },
    );
    expect(res.status).toBe(200);
  });

  it("refuses resources/read without a key", async () => {
    const res = await post({
      jsonrpc: "2.0", id: 3, method: "resources/read",
      params: { uri: "misarpost://connections" },
    });
    expect(res.status).toBe(401);
  });
});

describe("rule 3 — the refusal is actionable", () => {
  it("tells the user every way to provide a key", async () => {
    const res = await post({
      jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_posts", arguments: {} },
    });
    const message = (await res.json()).error.message as string;

    // Manual path — a real dashboard URL, not "generate a key somewhere".
    expect(message).toContain(AUTH_URLS.apiKeys);
    expect(AUTH_URLS.apiKeys).toBe("https://post.misar.io/dashboard/api-keys");
    expect(message).toContain(KEY_PREFIX);
    expect(KEY_PREFIX).toBe("mpk_");
    // Where the key actually goes, for local AND cloud setups.
    expect(message).toContain(ENV_KEY);
    expect(ENV_KEY).toBe("MISARPOST_API_KEY");
    expect(message).toContain(CONFIG_PATH);
    expect(CONFIG_PATH).toBe("~/.misarpost/config.json");
    expect(message).toContain("env");
    // Somewhere to read more.
    expect(message).toContain(AUTH_URLS.docs);
  });

  it("does NOT promise a browser flow this product has not shipped", async () => {
    // There is no /authorize page and no login tool. Pointing a stuck user at
    // a 404, or at a tool that is not registered, strands them worse than the
    // manual key path alone. Flip browserLogin in the generator in the same
    // change that ships the consent page — reach is the worked example.
    expect(HAS_BROWSER_LOGIN).toBe(false);
    for (const reason of ["missing", "rejected"] as const) {
      const text = authGuidance(reason);
      expect(text).not.toContain("/authorize");
      expect(text).not.toMatch(/\blogin\b/i);
    }
    expect(listTools().map((t) => t.name)).not.toContain("login");
  });

  it("distinguishes a missing key from a rejected one", () => {
    expect(authGuidance("missing")).toContain("Not authenticated");
    expect(authGuidance("rejected")).toContain("rejected");
    expect(authGuidance("rejected")).toContain(AUTH_URLS.apiKeys);
  });

  it("turns an API 401 into the rejected-key guidance", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    );
    const { httpContext } = await import("../../src/lib/context.js");
    await expect(dispatch("list_posts", {}, httpContext("mpk_revoked", "https://example.invalid/api")))
      .rejects.toThrow(/rejected/);
  });

  it("never leaks a credential into the guidance", () => {
    for (const reason of ["missing", "rejected"] as const) {
      expect(authGuidance(reason)).not.toMatch(/mpk_[A-Za-z0-9]{12,}/);
    }
  });

  it("never names the wrong product or key prefix", () => {
    for (const reason of ["missing", "rejected"] as const) {
      const text = authGuidance(reason);
      expect(text).not.toMatch(/msk_|misarsocial|social\.misar\.io/i);
    }
  });

  it("reports an unknown tool as unknown, not as an auth failure", async () => {
    const { httpContext } = await import("../../src/lib/context.js");
    await expect(dispatch("__typo__", {}, httpContext("", ""))).rejects.toBeInstanceOf(UnknownToolError);
  });
});
