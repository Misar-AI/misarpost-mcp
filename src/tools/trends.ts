import { apiFetch, buildQuery } from "../lib/api-client.js";
import { arg, defineTool, requireString, type ToolDefinition } from "../lib/types.js";
import { TREND_TARGET_PLATFORMS } from "./platforms.js";

/**
 * TrendPulse — trending hashtags and hooks for the user's niches.
 *   GET  /trendpulse            trends:read     src/app/api/trendpulse/route.ts
 *   POST /trendpulse            trends:write    same file (snapshots → drafts)
 *   POST /trendpulse/pipeline   schedule:write  src/app/api/trendpulse/pipeline/route.ts
 *   POST /trendpulse/fetch      trends:write    src/app/api/trendpulse/fetch/route.ts
 *   POST /trendpulse/digest     trends:write    src/app/api/trendpulse/digest/route.ts
 *   GET  /trendpulse/hooks      trends:read     src/app/api/trendpulse/hooks/route.ts
 *   GET  /trendpulse/platform-content      trends:read   …/platform-content/route.ts
 *   POST /trendpulse/platform-content      trends:write  same file
 *   POST /trendpulse/platform-content/use  trends:write  …/platform-content/use/route.ts
 *   GET  /trendpulse/performance           analytics:read …/performance/route.ts
 */
export const trendTools: ToolDefinition[] = [
  defineTool({
    name: "get_trends",
    category: "trends",
    description:
      "Get the latest trending hashtags and content hooks for the user's TrendPulse niches, each with a snapshot id. Returns cached results under two hours old, or refreshes them live from the trend sources.",
    scopes: ["trends:read"],
    annotations: {
      title: "Get trending hashtags and hooks",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/trendpulse"),
  }),

  defineTool({
    name: "queue_trend_drafts",
    category: "trends",
    description:
      "Turn 1–3 trend snapshots (from get_trends) into draft posts — one per snapshot for each platform the user has connected — saved to the draft queue (list_drafts). Nothing is scheduled or published.",
    scopes: ["trends:write"],
    annotations: {
      title: "Queue trend-based drafts",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["snapshot_ids"],
      properties: {
        snapshot_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 3,
          description: "1–3 trend snapshot UUIDs — from get_trends.",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/trendpulse", {
        method: "POST",
        body: JSON.stringify({ snapshotIds: arg(args, "snapshot_ids", "snapshotIds") }),
      }),
  }),

  defineTool({
    name: "schedule_trend_posts",
    category: "trends",
    description:
      "Publish posts about 1–3 trend snapshots to the given connected accounts, scheduled five minutes from now — one post per content hook per account, written from the trend's hooks. This puts real content in front of a real audience almost immediately and the user does not see the text first: show them get_trends' hooks and get explicit approval. Prefer queue_trend_drafts when they want to review.",
    scopes: ["schedule:write"],
    annotations: {
      title: "Schedule trend posts",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      required: ["snapshot_ids", "connected_account_ids"],
      properties: {
        snapshot_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 3,
          description: "1–3 trend snapshot UUIDs — from get_trends.",
        },
        connected_account_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Connected account UUIDs to post to — from list_connections.",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/trendpulse/pipeline", {
        method: "POST",
        body: JSON.stringify({
          snapshotIds: arg(args, "snapshot_ids", "snapshotIds"),
          connectedAccountIds: arg(args, "connected_account_ids", "connectedAccountIds"),
        }),
      }),
  }),
  defineTool({
    name: "refresh_trends",
    category: "trends",
    description:
      "Force a fresh fetch of trending hashtags from every trend source for the user's niches and store new snapshots, instead of waiting for the scheduled refresh. Needs a plan that includes manual refresh; otherwise it returns an upgrade message. Use get_trends afterwards to read them.",
    scopes: ["trends:write"],
    annotations: { title: "Refresh trends now", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/trendpulse/fetch", { method: "POST" }),
  }),
  defineTool({
    name: "send_trend_digest",
    category: "trends",
    description:
      "Email the user their trend digest (top recent trends for their niches) now. It always goes to the account owner's own address — never anyone else. Returns `skipped` when the digest is turned off or there are no recent trends.",
    scopes: ["trends:write"],
    annotations: { title: "Send trend digest email", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/trendpulse/digest", { method: "POST" }),
  }),
  defineTool({
    name: "get_trend_hooks",
    category: "trends",
    description: "Get the content hooks (opening lines and angles) for one trend snapshot — snapshot ids come from get_trends.",
    scopes: ["trends:read"],
    annotations: { title: "Get trend hooks", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["snapshot_id"],
      properties: { snapshot_id: { type: "string", description: "Trend snapshot UUID — from get_trends." } },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/trendpulse/hooks${buildQuery({ snapshotId: requireString(args, "snapshot_id", "snapshotId") })}`),
  }),
  defineTool({
    name: "get_trend_platform_content",
    category: "trends",
    description:
      "Get the per-platform content already generated for one trend snapshot — hashtags, plus title/description for YouTube and title/subtitle for Medium. Empty until generate_trend_platform_content has run for it.",
    scopes: ["trends:read"],
    annotations: { title: "Get trend platform content", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["snapshot_id"],
      properties: { snapshot_id: { type: "string", description: "Trend snapshot UUID — from get_trends." } },
    },
    handler: (ctx, args) =>
      apiFetch(
        ctx,
        `/trendpulse/platform-content${buildQuery({ snapshotId: requireString(args, "snapshot_id", "snapshotId") })}`,
      ),
  }),
  defineTool({
    name: "generate_trend_platform_content",
    category: "trends",
    description:
      "Generate per-platform content (hashtags, and titles where a platform needs them) for one trend snapshot, for the platforms asked (default: all seven). Regenerating replaces the earlier content for those platforms. Nothing is posted — turn one into a draft with use_trend_platform_content.",
    scopes: ["trends:write"],
    annotations: { title: "Generate trend platform content", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["snapshot_id"],
      properties: {
        snapshot_id: { type: "string", description: "Trend snapshot UUID — from get_trends." },
        platforms: {
          type: "array",
          minItems: 1,
          items: { type: "string", enum: TREND_TARGET_PLATFORMS },
          description: "Platforms to generate for. Omit for all of them.",
        },
      },
    },
    handler: (ctx, args) => {
      const body: Record<string, unknown> = { snapshotId: requireString(args, "snapshot_id", "snapshotId") };
      const platforms = arg(args, "platforms");
      if (platforms !== undefined) body.platforms = platforms;
      return apiFetch(ctx, "/trendpulse/platform-content", { method: "POST", body: JSON.stringify(body) });
    },
  }),
  defineTool({
    name: "use_trend_platform_content",
    category: "trends",
    description:
      "Turn one platform's generated trend content into a draft post (generating it first if needed). The draft lands in the review queue (list_drafts) — nothing is published or scheduled.",
    scopes: ["trends:write"],
    annotations: { title: "Draft from trend platform content", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["snapshot_id", "platform"],
      properties: {
        snapshot_id: { type: "string", description: "Trend snapshot UUID — from get_trends." },
        platform: { type: "string", enum: TREND_TARGET_PLATFORMS, description: "Which platform's content to draft." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/trendpulse/platform-content/use", {
        method: "POST",
        body: JSON.stringify({
          snapshotId: requireString(args, "snapshot_id", "snapshotId"),
          platform: requireString(args, "platform"),
        }),
      }),
  }),
  defineTool({
    name: "get_trend_performance",
    category: "trends",
    description:
      "Show how the user's trend-sourced posts actually performed: each TrendPulse draft (last 100) joined to whether it was scheduled or published and its likes, comments, reposts, impressions and reach.",
    scopes: ["analytics:read"],
    annotations: { title: "Get trend post performance", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/trendpulse/performance"),
  }),
];
