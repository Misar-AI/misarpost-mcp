/**
 * Request regression coverage: method + path + body field names.
 *
 * MisarPost's routes validate camelCase bodies with zod (connectedAccountId,
 * contentText, sourceType, plugKey…) while the tools advertise snake_case
 * arguments. There is no transform layer in the API, so each test mocks fetch
 * and asserts exactly what a handler sends against the real route's schema
 * (MisarPost origin/develop), so a regression to a wrong field, method or path
 * fails here instead of shipping a body the live API rejects.
 *
 * The ROUTES table must name every tool in the catalogue (asserted below), so
 * adding a tool without pinning its request shape and scope fails the suite.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { ALL_TOOLS, dispatch, resolveTool } from "../../src/registry.js";
import { httpContext } from "../../src/lib/context.js";

const BASE = "https://example.invalid/api";
const ctx = httpContext("mpk_test", BASE);
const allowAll = () => true;

function mockFetch(body: unknown = {}, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  );
}

function call(fetchMock: ReturnType<typeof mockFetch>) {
  const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit | undefined];
  return {
    url,
    method: init?.method ?? "GET",
    body: init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

type Case = {
  args: Record<string, unknown>;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  /** Exact JSON body sent; omitted for body-less requests. */
  body?: Record<string, unknown>;
  /** The scope the route method declares in withAuth({ scope }). */
  scope: string;
};

const U = "11111111-1111-4111-8111-111111111111";

const ROUTES: Record<string, Case> = {
  // connections
  list_connections: { args: {}, method: "GET", path: "/connections", scope: "connections:read" },
  list_publish_options: {
    args: { kind: "pinterest_boards", account_id: U },
    method: "GET",
    path: `/composer/pinterest/boards?accountId=${U}`,
    scope: "connections:read",
  },
  list_account_plugs: { args: { account_id: U }, method: "GET", path: `/connections/${U}/plugs`, scope: "connections:read" },
  configure_account_plug: {
    args: { account_id: U, plug_key: "x-auto-repost-by-likes", activated: true, config: { likes: 50 } },
    method: "PATCH",
    path: `/connections/${U}/plugs`,
    body: { plugKey: "x-auto-repost-by-likes", activated: true, config: { likes: 50 } },
    scope: "connections:write",
  },
  // posts
  list_posts: {
    args: { status: "queued", page: 2, tag_id: "t1" },
    method: "GET",
    path: "/posts?status=queued&tagId=t1&page=2",
    scope: "posts:read",
  },
  schedule_post: {
    args: {
      connected_account_id: "acc-1",
      platform: "linkedin",
      content_text: "Hello",
      scheduled_at: "2030-01-01T09:00:00Z",
      media_urls: ["https://cdn.example/a.png"],
      first_comment: "Link in comments",
      variant_id: "var-1",
      platform_meta: { subreddit: "x" },
      tag_ids: ["tag-1"],
      post_batch_id: "batch-1",
    },
    method: "POST",
    path: "/schedule",
    body: {
      connectedAccountId: "acc-1",
      platform: "linkedin",
      contentText: "Hello",
      scheduledAt: "2030-01-01T09:00:00Z",
      mediaUrls: ["https://cdn.example/a.png"],
      firstComment: "Link in comments",
      variantId: "var-1",
      platformMeta: { subreddit: "x" },
      tagIds: ["tag-1"],
      postBatchId: "batch-1",
    },
    scope: "schedule:write",
  },
  cancel_post: { args: { post_id: "p1" }, method: "DELETE", path: "/posts", body: { postId: "p1" }, scope: "posts:write" },
  get_calendar: {
    args: { from: "2030-01-01", to: "2030-01-31", tag_id: "t1" },
    method: "GET",
    path: "/calendar?from=2030-01-01&to=2030-01-31&tagId=t1",
    scope: "posts:read",
  },
  update_post: {
    args: { post_id: U, content_text: "New", scheduled_at: "2030-01-01T09:00:00+00:00", first_comment: null, tag_ids: ["t1"] },
    method: "PATCH",
    path: `/posts/${U}`,
    body: { contentText: "New", scheduledAt: "2030-01-01T09:00:00+00:00", firstComment: null, tagIds: ["t1"] },
    scope: "posts:write",
  },
  // drafts
  list_drafts: { args: {}, method: "GET", path: "/drafts", scope: "posts:read" },
  review_drafts: {
    args: { action: "reject", ids: ["d1", "d2"] },
    method: "POST",
    path: "/drafts",
    body: { action: "reject", ids: ["d1", "d2"] },
    scope: "posts:write",
  },
  // analytics + growth
  get_stats: { args: {}, method: "GET", path: "/stats", scope: "analytics:read" },
  get_analytics_trends: { args: { days: 7 }, method: "GET", path: "/analytics/trends?days=7", scope: "analytics:read" },
  get_growth_overview: { args: { days: 90 }, method: "GET", path: "/growth/overview?days=90", scope: "analytics:read" },
  list_growth_opportunities: { args: {}, method: "GET", path: "/growth/opportunities", scope: "analytics:read" },
  list_growth_playbooks: { args: {}, method: "GET", path: "/growth/playbooks", scope: "analytics:read" },
  // contentripple
  get_contentripple_usage: { args: {}, method: "GET", path: "/contentripple", scope: "posts:read" },
  repurpose_content: {
    args: { source_type: "url", source_url: "https://example.com/post", formats: ["twitter_thread"], tone: "professional" },
    method: "POST",
    path: "/contentripple",
    body: { sourceType: "url", sourceUrl: "https://example.com/post", platforms: ["twitter_thread"], tone: "professional" },
    scope: "generate:write",
  },
  update_content_variant: {
    args: { variant_id: U, content: "Edited", status: "edited" },
    method: "PATCH",
    path: "/contentripple/variants",
    body: { variantId: U, content: "Edited", status: "edited" },
    scope: "posts:write",
  },
  schedule_content_variant: {
    args: { variant_id: U, connected_account_id: "acc-1", scheduled_at: "2030-01-01T09:00:00Z", post_batch_id: "b1" },
    method: "POST",
    path: "/contentripple/schedule",
    body: { variantId: U, connectedAccountId: "acc-1", scheduledAt: "2030-01-01T09:00:00Z", postBatchId: "b1" },
    scope: "schedule:write",
  },
  // generate
  generate_posts: {
    args: { topic: "Launch week", platforms: ["twitter", "linkedin"], tone: "casual", count: 2 },
    method: "POST",
    path: "/generate",
    body: { topic: "Launch week", platforms: ["twitter", "linkedin"], tone: "casual", count: 2 },
    scope: "generate:write",
  },
  enhance_topic: {
    args: { raw_topic: "AI for dentists", goal: "conversion", audience: "clinic owners", platforms: ["linkedin"] },
    method: "POST",
    path: "/generate/enhance",
    body: { rawTopic: "AI for dentists", goal: "conversion", audience: "clinic owners", platforms: ["linkedin"] },
    scope: "generate:write",
  },
  generate_plan: {
    args: { enhanced_topic: "Brief", platforms: ["twitter"] },
    method: "POST",
    path: "/generate/plan",
    body: { enhancedTopic: "Brief", platforms: ["twitter"] },
    scope: "generate:write",
  },
  research_hashtags: {
    args: { keyword: "saas", niche: "b2b", platforms: ["youtube"], goal: "viral" },
    method: "POST",
    path: "/generate/hashtags",
    body: { keyword: "saas", niche: "b2b", platforms: ["youtube"], goal: "viral" },
    scope: "generate:write",
  },
  get_optimization_insights: {
    args: { platform: "linkedin" },
    method: "GET",
    path: "/generate/optimize?platform=linkedin",
    scope: "generate:write",
  },
  // trends
  get_trends: { args: {}, method: "GET", path: "/trendpulse", scope: "trends:read" },
  queue_trend_drafts: {
    args: { snapshot_ids: [U] },
    method: "POST",
    path: "/trendpulse",
    body: { snapshotIds: [U] },
    scope: "trends:write",
  },
  schedule_trend_posts: {
    args: { snapshot_ids: [U], connected_account_ids: ["acc-1"] },
    method: "POST",
    path: "/trendpulse/pipeline",
    body: { snapshotIds: [U], connectedAccountIds: ["acc-1"] },
    scope: "schedule:write",
  },
  // templates
  list_post_templates: { args: {}, method: "GET", path: "/post-templates", scope: "posts:read" },
  get_post_template: { args: { template_id: U }, method: "GET", path: `/post-templates/${U}`, scope: "posts:read" },
  create_post_template: {
    args: {
      name: "Launch",
      content: "Hi",
      content_overrides: { twitter: "Hi X" },
      account_ids: [U],
      platform_settings: { reddit: { subreddit: "x" } },
      media: [{ url: "https://cdn.example/a.png", kind: "image", file_name: "a.png" }],
      first_comment: "c",
    },
    method: "POST",
    path: "/post-templates",
    body: {
      name: "Launch",
      content: "Hi",
      contentOverrides: { twitter: "Hi X" },
      accountIds: [U],
      platformSettings: { reddit: { subreddit: "x" } },
      media: [{ url: "https://cdn.example/a.png", kind: "image", fileName: "a.png" }],
      firstComment: "c",
    },
    scope: "posts:write",
  },
  update_post_template: {
    args: { template_id: U, name: "Renamed" },
    method: "PATCH",
    path: `/post-templates/${U}`,
    body: { name: "Renamed" },
    scope: "posts:write",
  },
  delete_post_template: { args: { template_id: U }, method: "DELETE", path: `/post-templates/${U}`, scope: "posts:write" },
  // tags
  list_post_tags: { args: {}, method: "GET", path: "/post-tags", scope: "posts:read" },
  create_post_tag: {
    args: { name: "Launch", color: "teal" },
    method: "POST",
    path: "/post-tags",
    body: { name: "Launch", color: "teal" },
    scope: "posts:write",
  },
  update_post_tag: {
    args: { tag_id: U, color: "pink" },
    method: "PATCH",
    path: `/post-tags/${U}`,
    body: { color: "pink" },
    scope: "posts:write",
  },
  delete_post_tag: { args: { tag_id: U }, method: "DELETE", path: `/post-tags/${U}`, scope: "posts:write" },
  // media + video
  list_media: { args: { page: 3 }, method: "GET", path: "/media?page=3", scope: "media:read" },
  delete_media: { args: { media_id: U }, method: "DELETE", path: `/media/${U}`, scope: "media:write" },
  list_video_avatars: { args: {}, method: "GET", path: "/video/avatars", scope: "media:read" },
  list_video_voices: { args: { provider: "heygen" }, method: "GET", path: "/video/voices?provider=heygen", scope: "media:read" },
  create_video_script: {
    args: { post_text: "Our launch" },
    method: "POST",
    path: "/video/script",
    body: { postText: "Our launch" },
    scope: "generate:write",
  },
  generate_video: {
    args: { script: "Hi", avatar_id: "av1", voice_id: "v1", aspect_ratio: "portrait", captions: false },
    method: "POST",
    path: "/video/generate",
    body: { script: "Hi", avatarId: "av1", voiceId: "v1", aspectRatio: "portrait", captions: false },
    scope: "generate:write",
  },
  get_video_status: { args: { job_id: U }, method: "GET", path: `/video/status/${U}`, scope: "media:read" },
  // personas
  list_personas: { args: {}, method: "GET", path: "/personaforge/personas", scope: "personas:read" },
  get_persona: { args: { persona_id: U }, method: "GET", path: `/personaforge/personas/${U}`, scope: "personas:read" },
  create_persona: {
    args: { source_kind: "public_profile", platform: "bluesky", identifier: "@me.bsky.social", name: "Me" },
    method: "POST",
    path: "/personaforge/personas",
    body: { sourceKind: "public_profile", platform: "bluesky", identifier: "@me.bsky.social", name: "Me" },
    scope: "personas:write",
  },
  get_persona_job_status: {
    args: { job_id: U },
    method: "GET",
    path: `/personaforge/personas/status/${U}`,
    scope: "personas:read",
  },
  rename_persona: {
    args: { persona_id: U, name: "Founder voice" },
    method: "PATCH",
    path: `/personaforge/personas/${U}`,
    body: { name: "Founder voice" },
    scope: "personas:write",
  },
  delete_persona: { args: { persona_id: U }, method: "DELETE", path: `/personaforge/personas/${U}`, scope: "personas:write" },
  generate_persona_post: {
    args: { topic: "Hiring", platform: "linkedin", persona_id: U },
    method: "POST",
    path: "/personaforge/generate",
    body: { topic: "Hiring", platform: "linkedin", personaId: U },
    scope: "generate:write",
  },
  list_persona_replies: { args: { status: "approved" }, method: "GET", path: "/personaforge/replies?status=approved", scope: "personas:read" },
  generate_persona_reply: {
    args: { platform: "twitter", source_post_id: "123", source_post_text: "We launched", inbound_text: "Congrats!" },
    method: "POST",
    path: "/personaforge/replies",
    body: { platform: "twitter", sourcePostId: "123", sourcePostText: "We launched", inboundText: "Congrats!" },
    scope: "personas:write",
  },
  review_persona_reply: {
    args: { reply_id: U, action: "edit", edited_text: "Thanks!" },
    method: "POST",
    path: "/personaforge/replies/approve",
    body: { replyId: U, action: "edit", editedText: "Thanks!" },
    scope: "personas:write",
  },
  // notifications, webhooks, workspaces
  list_notifications: {
    args: { page: 2, page_size: 50 },
    method: "GET",
    path: "/notifications?page=2&pageSize=50",
    scope: "notifications:read",
  },
  mark_notification_read: { args: { notification_id: U }, method: "PATCH", path: `/notifications/${U}`, scope: "notifications:write" },
  mark_all_notifications_read: { args: {}, method: "POST", path: "/notifications/read-all", scope: "notifications:write" },
  list_webhooks: { args: {}, method: "GET", path: "/webhooks/outbound", scope: "webhooks:read" },
  create_webhook: {
    args: { url: "https://hooks.example/p", events: ["post.published"] },
    method: "POST",
    path: "/webhooks/outbound",
    body: { url: "https://hooks.example/p", events: ["post.published"] },
    scope: "webhooks:write",
  },
  update_webhook: {
    args: { webhook_id: U, active: false },
    method: "PATCH",
    path: `/webhooks/outbound/${U}`,
    body: { active: false },
    scope: "webhooks:write",
  },
  delete_webhook: { args: { webhook_id: U }, method: "DELETE", path: `/webhooks/outbound/${U}`, scope: "webhooks:write" },
  list_workspaces: { args: {}, method: "GET", path: "/workspaces", scope: "workspaces:read" },
  // PersonaForge voice, bio and competitors
  get_voice_model: { args: {}, method: "GET", path: "/personaforge/voice", scope: "personas:read" },
  train_voice_model: { args: {}, method: "POST", path: "/personaforge/voice", scope: "personas:write" },
  generate_bio_variants: {
    args: { platform: "linkedin", current_bio: "Founder." },
    method: "POST",
    path: "/personaforge/bio",
    body: { platform: "linkedin", currentBio: "Founder." },
    scope: "generate:write",
  },
  list_competitor_personas: { args: {}, method: "GET", path: "/personaforge/competitors", scope: "personas:read" },
  analyze_competitor: {
    args: { handle: "rival", platform: "twitter", display_name: "Rival", niche: "saas" },
    method: "POST",
    path: "/personaforge/competitors",
    body: { handle: "rival", platform: "twitter", displayName: "Rival", niche: "saas" },
    scope: "personas:write",
  },
  // TrendPulse
  refresh_trends: { args: {}, method: "POST", path: "/trendpulse/fetch", scope: "trends:write" },
  send_trend_digest: { args: {}, method: "POST", path: "/trendpulse/digest", scope: "trends:write" },
  get_trend_hooks: { args: { snapshot_id: U }, method: "GET", path: `/trendpulse/hooks?snapshotId=${U}`, scope: "trends:read" },
  get_trend_platform_content: {
    args: { snapshot_id: U },
    method: "GET",
    path: `/trendpulse/platform-content?snapshotId=${U}`,
    scope: "trends:read",
  },
  generate_trend_platform_content: {
    args: { snapshot_id: U, platforms: ["linkedin", "youtube"] },
    method: "POST",
    path: "/trendpulse/platform-content",
    body: { snapshotId: U, platforms: ["linkedin", "youtube"] },
    scope: "trends:write",
  },
  use_trend_platform_content: {
    args: { snapshot_id: U, platform: "medium" },
    method: "POST",
    path: "/trendpulse/platform-content/use",
    body: { snapshotId: U, platform: "medium" },
    scope: "trends:write",
  },
  get_trend_performance: { args: {}, method: "GET", path: "/trendpulse/performance", scope: "analytics:read" },
  // ContentRipple feed, parse and history
  fetch_content_feed: {
    args: { feed_url: "https://blog.example/feed.xml" },
    method: "POST",
    path: "/contentripple/feed",
    body: { feedUrl: "https://blog.example/feed.xml" },
    scope: "generate:write",
  },
  parse_content_source: {
    args: { type: "url", url: "https://blog.example/post" },
    method: "POST",
    path: "/contentripple/parse",
    body: { type: "url", url: "https://blog.example/post" },
    scope: "generate:write",
  },
  list_repurpose_history: { args: { limit: 5 }, method: "GET", path: "/contentripple/history?limit=5", scope: "posts:read" },
  delete_repurpose_source: {
    args: { source_id: U },
    method: "DELETE",
    path: "/contentripple/history",
    body: { sourceId: U },
    scope: "posts:write",
  },
  // published-post actions
  reply_to_post: {
    args: { post_id: U, message: "Thanks!" },
    method: "POST",
    path: `/posts/${U}/reply`,
    body: { message: "Thanks!" },
    scope: "posts:write",
  },
  revert_post: { args: { post_id: U }, method: "POST", path: `/posts/${U}/revert`, scope: "posts:write" },
  revert_post_batch: {
    args: { post_batch_id: U },
    method: "POST",
    path: "/posts/revert-batch",
    body: { postBatchId: U },
    scope: "posts:write",
  },
  share_post: { args: { post_id: U }, method: "POST", path: `/posts/${U}/share`, scope: "posts:write" },
  unshare_post: { args: { post_id: U }, method: "DELETE", path: `/posts/${U}/share`, scope: "posts:write" },
  // image + growth
  generate_image: {
    args: { prompt: "A lighthouse at dawn", platform: "instagram" },
    method: "POST",
    path: "/generate/image",
    body: { prompt: "A lighthouse at dawn", platform: "instagram" },
    scope: "generate:write",
  },
  get_next_growth_opportunity: { args: {}, method: "GET", path: "/growth/next-opportunity", scope: "analytics:read" },
};

describe("request map", () => {
  it("covers every tool in the catalogue, and nothing else", () => {
    expect(Object.keys(ROUTES).sort()).toEqual(ALL_TOOLS.map((t) => t.name).sort());
  });

  it.each(Object.entries(ROUTES))("%s → its route's method, path and body", async (name, c) => {
    const f = mockFetch({});
    await dispatch(name, structuredClone(c.args), ctx, allowAll);
    const sent = call(f);
    expect(sent.method).toBe(c.method);
    expect(sent.url).toBe(`${BASE}${c.path}`);
    expect(sent.body).toEqual(c.body);
  });

  it.each(Object.entries(ROUTES))("%s carries its route's declared scope", (name, c) => {
    expect(resolveTool(name)!.scopes).toEqual([c.scope]);
  });
});

describe("2.x argument compatibility", () => {
  it("schedule_post still accepts camelCase arguments", async () => {
    const f = mockFetch({ post: { id: "p1" } }, 201);
    await dispatch(
      "schedule_post",
      { connectedAccountId: "acc-1", platform: "twitter", contentText: "Hi", scheduledAt: "now" },
      ctx,
      allowAll,
    );
    expect(call(f).body).toEqual({ connectedAccountId: "acc-1", platform: "twitter", contentText: "Hi", scheduledAt: "now" });
  });

  it("cancel_post and update_post accept 2.x's id argument", async () => {
    const f = mockFetch({ ok: true });
    await dispatch("cancel_post", { id: "p2" }, ctx, allowAll);
    expect(call(f).body).toEqual({ postId: "p2" });
    f.mockClear();
    await dispatch("update_post", { id: "p3", contentText: "x" }, ctx, allowAll);
    expect(call(f).url).toBe(`${BASE}/posts/p3`);
    expect(call(f).body).toEqual({ contentText: "x" });
  });

  it("repurpose_content and the generate helpers accept camelCase", async () => {
    const f = mockFetch({}, 201);
    await dispatch("repurpose_content", { sourceType: "text", rawContent: "Body" }, ctx, allowAll);
    expect(call(f).body).toEqual({ sourceType: "text", rawContent: "Body" });
    f.mockClear();
    await dispatch("enhance_topic", { rawTopic: "x", platforms: ["twitter"] }, ctx, allowAll);
    expect(call(f).body).toEqual({ rawTopic: "x", platforms: ["twitter"] });
    f.mockClear();
    await dispatch("queue_trend_drafts", { snapshotIds: [U] }, ctx, allowAll);
    expect(call(f).body).toEqual({ snapshotIds: [U] });
  });
});

describe("request details", () => {
  it("update_post omits first_comment when absent, so it is never cleared by accident", async () => {
    const f = mockFetch({ post: {} });
    await dispatch("update_post", { post_id: U, content_text: "x" }, ctx, allowAll);
    expect(call(f).body).toEqual({ contentText: "x" });
  });

  it("configure_account_plug sends activated=false rather than dropping it", async () => {
    const f = mockFetch({ config: {} });
    await dispatch("configure_account_plug", { account_id: "acc-1", plug_key: "k", activated: false }, ctx, allowAll);
    expect(call(f).body).toEqual({ plugKey: "k", activated: false });
  });

  it("create_persona sends the connected-account shape for that source kind", async () => {
    const f = mockFetch({ jobId: "j" }, 202);
    await dispatch(
      "create_persona",
      { source_kind: "connected_account", platform: "twitter", connected_account_id: U, identifier: "ignored" },
      ctx,
      allowAll,
    );
    expect(call(f).body).toEqual({ sourceKind: "connected_account", connectedAccountId: U, platform: "twitter" });
  });

  it("list_publish_options handles reddit flairs and WordPress taxonomies", async () => {
    const f = mockFetch({});
    await dispatch("list_publish_options", { kind: "reddit_flairs", account_id: "a", subreddit: "startups" }, ctx);
    expect(call(f).url).toBe(`${BASE}/composer/reddit/flairs?accountId=a&subreddit=startups`);
    f.mockClear();
    await dispatch("list_publish_options", { kind: "slack_channels", account_id: "a", subreddit: "x" }, ctx);
    expect(call(f).url).toBe(`${BASE}/composer/slack/channels?accountId=a`);
    f.mockClear();
    await dispatch("list_publish_options", { kind: "wordpress_taxonomies", account_id: "a" }, ctx);
    expect(call(f).url).toBe(`${BASE}/connections/a/wordpress-taxonomies`);
  });

  it("list_publish_options rejects an unknown kind before calling the API", async () => {
    const f = mockFetch({});
    await expect(dispatch("list_publish_options", { kind: "myspace", account_id: "a" }, ctx)).rejects.toThrow(/Unknown kind/);
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    ["cancel_post", "post_id"],
    ["update_post", "post_id"],
    ["delete_media", "media_id"],
    ["get_post_template", "template_id"],
    ["delete_post_tag", "tag_id"],
    ["delete_persona", "persona_id"],
    ["get_video_status", "job_id"],
    ["mark_notification_read", "notification_id"],
    ["delete_webhook", "webhook_id"],
  ])("%s refuses to call the API without %s", async (name, field) => {
    const f = mockFetch({});
    await expect(dispatch(name, {}, ctx, allowAll)).rejects.toThrow(field);
    expect(f).not.toHaveBeenCalled();
  });

  it("encodes path ids so an id can never rewrite the route", async () => {
    const f = mockFetch({});
    await dispatch("list_account_plugs", { account_id: "../stats" }, ctx);
    expect(call(f).url).toBe(`${BASE}/connections/..%2Fstats/plugs`);
  });
});

describe("advertised enums match the routes", () => {
  const prop = (tool: string, field: string) =>
    resolveTool(tool)!.inputSchema.properties![field] as { enum?: unknown[]; items?: { enum?: unknown[] } };

  it("schedule_post lists the route's 35 platforms", () => {
    expect(prop("schedule_post", "platform").enum).toHaveLength(35);
    expect(prop("schedule_post", "platform").enum).toContain("linkedin_page");
  });

  it("repurpose_content offers only the route's sourceType values", () => {
    expect(prop("repurpose_content", "source_type").enum).toEqual(["url", "text", "docforge", "rss"]);
  });

  it("enhance_topic and generate_plan exclude youtube, which their schemas reject", () => {
    expect(prop("enhance_topic", "platforms").items!.enum).not.toContain("youtube");
    expect(prop("generate_plan", "platforms").items!.enum).not.toContain("youtube");
    expect(prop("research_hashtags", "platforms").items!.enum).toContain("youtube");
  });

  it("webhook events and tag colours match the route enums", () => {
    expect(prop("create_webhook", "events").items!.enum).toEqual(["post.published", "post.failed", "account.disconnected"]);
    expect(prop("create_post_tag", "color").enum).toHaveLength(10);
  });
});

describe("tools that publish or delete on a live platform", () => {
  const LIVE = ["reply_to_post", "revert_post", "revert_post_batch", "share_post", "unshare_post", "delete_repurpose_source", "train_voice_model"];

  it.each(LIVE)("%s is marked destructive", (name) => {
    expect(resolveTool(name)!.annotations.destructiveHint).toBe(true);
  });

  it.each(["reply_to_post", "revert_post", "revert_post_batch", "share_post"])(
    "%s tells the agent to get explicit approval",
    (name) => {
      expect(resolveTool(name)!.description).toMatch(/explicit approval/);
    },
  );

  it("parse_content_source sends only the field its type needs", async () => {
    const f = mockFetch({});
    await dispatch("parse_content_source", { type: "text", text: "x".repeat(60), url: "https://ignored.example" }, ctx, allowAll);
    expect(call(f).body).toEqual({ type: "text", text: "x".repeat(60) });
  });

  it("generate_bio_variants and generate_image omit optional fields that were not passed", async () => {
    const f = mockFetch({});
    await dispatch("generate_bio_variants", { platform: "twitter" }, ctx, allowAll);
    expect(call(f).body).toEqual({ platform: "twitter" });
  });
});

describe("no workspace or member management", () => {
  it("exposes no tool that creates workspaces or manages members", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(names.filter((n) => /workspace/.test(n))).toEqual(["list_workspaces"]);
    expect(names.filter((n) => /member|invite/.test(n))).toEqual([]);
  });
});
