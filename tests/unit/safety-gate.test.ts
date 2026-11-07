import { describe, it, expect, vi, afterEach } from "vitest";
import { dispatch } from "../../src/registry.js";
import { httpContext } from "../../src/lib/context.js";
import { assertSafeSource, assertSafeText, collectPostText, collectSourceText, ContentSafetyError } from "../../src/lib/safety-gate.js";
import { ContentSafety } from "../../src/lib/content-safety/content-safety.js";

const ctx = httpContext("mpk_test", "https://example.invalid/api");
const BAD = "zzsexterm zzminorterm";

ContentSafety.get().addWords("sexual", ["zzsexterm"]);
ContentSafety.get().addWords("minor", ["zzminorterm"]);

afterEach(() => vi.restoreAllMocks());

/** Stub fetch so a handler that runs would be visible. */
function stubFetch(body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("collectPostText", () => {
  it("reads the post text from schedule_post and update_post args", () => {
    expect(collectPostText("schedule_post", { content_text: "a", first_comment: "b", platform: "x" })).toEqual(["a", "b"]);
    expect(collectPostText("update_post", { contentText: "c", post_id: "1" })).toEqual(["c"]);
  });

  it("reads generated posts from the result", () => {
    const result = { drafts: [{ id: "1", content: "one" }, { id: "2", content: "two", hook: "h" }] };
    expect(collectPostText("generate_posts", { topic: "t" }, result)).toEqual(["one", "two", "h"]);
  });

  it("treats topics as source text: harm-only check, so a topic like 'TODO list apps' passes", () => {
    expect(collectSourceText("generate_posts", { topic: "TODO list apps" })).toEqual(["TODO list apps"]);
    expect(() => assertSafeSource(["TODO list apps"], "generate_posts")).not.toThrow();
    expect(() => assertSafeSource(["zzsexterm zzminorterm"], "generate_posts")).toThrow(ContentSafetyError);
  });

  it("ignores results of tools that do not produce posts", () => {
    expect(collectPostText("list_posts", {}, { posts: [{ content: "x" }] })).toEqual([]);
  });
});

describe("assertSafeText", () => {
  it("throws with the problems' reasons on a block", () => {
    expect(() => assertSafeText([BAD], "t")).toThrow(ContentSafetyError);
  });

  it("passes clean text", () => {
    expect(() => assertSafeText(["Our spring sale starts Monday."], "t")).not.toThrow();
  });
});

describe("dispatch safety gate", () => {
  it("refuses schedule_post before the handler runs", async () => {
    const fetchMock = stubFetch({});
    await expect(dispatch("schedule_post", { content_text: BAD }, ctx, null)).rejects.toThrow(/content safety/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets a clean schedule_post through", async () => {
    const fetchMock = stubFetch({ ok: true });
    await expect(dispatch("schedule_post", { content_text: "Hello world" }, ctx, null)).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalled();
  });

  it("refuses generate_posts output that fails the check", async () => {
    stubFetch({ drafts: [{ content: BAD }] });
    await expect(dispatch("generate_posts", { topic: "spring sale", platforms: ["x"] }, ctx, null)).rejects.toThrow(
      ContentSafetyError,
    );
  });

  it("returns clean generate_posts output", async () => {
    stubFetch({ drafts: [{ content: "A friendly spring sale post." }] });
    await expect(dispatch("generate_posts", { topic: "spring sale", platforms: ["x"] }, ctx, null)).resolves.toBeDefined();
  });
});
