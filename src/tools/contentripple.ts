import { apiFetch, buildQuery } from "../lib/api-client.js";
import { arg, defineTool, requireString, type ToolDefinition } from "../lib/types.js";
import { REPURPOSE_FORMATS, SCHEDULABLE_REPURPOSE_FORMATS } from "./platforms.js";

/**
 * ContentRipple — repurpose one source into channel-native variants.
 *   GET   /contentripple            posts:read      src/app/api/contentripple/route.ts
 *   POST  /contentripple            generate:write  same file
 *   PATCH /contentripple/variants   posts:write     src/app/api/contentripple/variants/route.ts
 *   POST  /contentripple/schedule   schedule:write  src/app/api/contentripple/schedule/route.ts
 *   POST  /contentripple/feed       generate:write  src/app/api/contentripple/feed/route.ts
 *   POST  /contentripple/parse      generate:write  src/app/api/contentripple/parse/route.ts
 *   GET   /contentripple/history    posts:read      src/app/api/contentripple/history/route.ts
 *   DELETE /contentripple/history   posts:write     same file (body { sourceId })
 */
export const contentrippleTools: ToolDefinition[] = [
  defineTool({
    name: "get_contentripple_usage",
    category: "repurposing",
    scopes: ["posts:read"],
    description:
      "Show how many ContentRipple repurposes the user has run this month, their monthly limit (null means unlimited), and their plan tier. Check before a large repurposing run so it does not stop halfway.",
    annotations: {
      title: "Get ContentRipple usage",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/contentripple"),
  }),

  defineTool({
    name: "repurpose_content",
    category: "repurposing",
    scopes: ["generate:write"],
    description:
      "Turn one source — a URL, pasted text or markdown, or an RSS item — into channel-native variants such as an X thread, LinkedIn post or carousel, Instagram caption or reel script, newsletter, or YouTube description. Fetches the URL, extracts the core message, writes each variant with AI, and saves source and variants. Returns each saved variant with its id. Nothing is scheduled or published. Counts against the monthly ContentRipple allowance.",
    annotations: {
      title: "Repurpose content into variants",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      required: ["source_type"],
      properties: {
        source_type: {
          type: "string",
          enum: ["url", "text", "docforge", "rss"],
          description:
            "url: fetch source_url. text or docforge: use raw_content (pasted text or markdown). rss: pass the item's URL as source_url.",
        },
        source_url: { type: "string", description: "Source URL (required for source_type=url)." },
        raw_content: {
          type: "string",
          description: "Source text or markdown, up to 20,000 characters (required for text/docforge).",
        },
        formats: {
          type: "array",
          items: { type: "string", enum: [...REPURPOSE_FORMATS] },
          description: "Which variants to write. Omit for all of them.",
        },
        tone: { type: "string", description: "Writing tone (default professional)." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/contentripple", {
        method: "POST",
        body: JSON.stringify({
          sourceType: arg(args, "source_type", "sourceType"),
          sourceUrl: arg(args, "source_url", "sourceUrl"),
          rawContent: arg(args, "raw_content", "rawContent"),
          platforms: arg(args, "formats", "platforms"),
          tone: args.tone,
        }),
      }),
  }),

  defineTool({
    name: "update_content_variant",
    category: "repurposing",
    description:
      "Edit a saved ContentRipple variant's text (which marks it edited) and/or set its status. Use the variant id returned by repurpose_content. Publishes nothing.",
    scopes: ["posts:write"],
    annotations: {
      title: "Edit content variant",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["variant_id"],
      properties: {
        variant_id: { type: "string", description: "Content variant UUID — from repurpose_content." },
        content: { type: "string", description: "New variant text, up to 20,000 characters." },
        status: {
          type: "string",
          enum: ["generated", "edited", "queued", "posted"],
          description: "New status. At least one of content or status is required.",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/contentripple/variants", {
        method: "PATCH",
        body: JSON.stringify({
          variantId: requireString(args, "variant_id", "variantId"),
          content: args.content,
          status: args.status,
        }),
      }),
  }),

  defineTool({
    name: "schedule_content_variant",
    category: "repurposing",
    description:
      `Schedule a saved ContentRipple variant (its text plus hashtags) to a connected account of the matching platform at a given time. Only these formats can be published: ${SCHEDULABLE_REPURPOSE_FORMATS.join(", ")} — the rest are copy-only. This queues real content for a real audience; confirm the text, account and time with the user first.`,
    scopes: ["schedule:write"],
    annotations: {
      title: "Schedule content variant",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      required: ["variant_id", "connected_account_id", "scheduled_at"],
      properties: {
        variant_id: { type: "string", description: "Content variant UUID — from repurpose_content." },
        connected_account_id: {
          type: "string",
          description: "Connected account UUID on the variant's platform — from list_connections.",
        },
        scheduled_at: { type: "string", description: "ISO 8601 datetime (UTC, e.g. 2030-01-01T09:00:00Z)." },
        post_batch_id: {
          type: "string",
          description: "Optional UUID shared with sibling posts of the same content, for managing them together.",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/contentripple/schedule", {
        method: "POST",
        body: JSON.stringify({
          variantId: arg(args, "variant_id", "variantId"),
          connectedAccountId: arg(args, "connected_account_id", "connectedAccountId"),
          scheduledAt: arg(args, "scheduled_at", "scheduledAt"),
          postBatchId: arg(args, "post_batch_id", "postBatchId"),
        }),
      }),
  }),
  defineTool({
    name: "fetch_content_feed",
    category: "repurposing",
    scopes: ["generate:write"],
    description:
      "Read an RSS or Atom feed and return its entries, so the user can pick one to repurpose with repurpose_content (source_type rss). Nothing is saved.",
    annotations: { title: "Fetch RSS/Atom feed", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["feed_url"],
      properties: { feed_url: { type: "string", format: "uri", description: "URL of the RSS or Atom feed." } },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/contentripple/feed", {
        method: "POST",
        body: JSON.stringify({ feedUrl: requireString(args, "feed_url", "feedUrl") }),
      }),
  }),
  defineTool({
    name: "parse_content_source",
    category: "repurposing",
    scopes: ["generate:write"],
    description:
      "Extract the core message, key points and structure from a URL, pasted text (50-20,000 characters) or Markdown, without generating any variants — a preview of what repurpose_content would work from. Counts against the monthly repurpose limit and uses one AI text action, so prefer repurpose_content when the user wants variants anyway.",
    annotations: { title: "Parse content source", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["type"],
      properties: {
        type: { type: "string", enum: ["url", "text", "docforge"], description: "What kind of source: a URL, plain text, or Markdown (docforge)." },
        url: { type: "string", format: "uri", description: "Required when type is url." },
        text: { type: "string", minLength: 50, maxLength: 20000, description: "Required when type is text." },
        markdown: { type: "string", minLength: 50, maxLength: 20000, description: "Required when type is docforge." },
      },
    },
    handler: (ctx, args) => {
      const type = requireString(args, "type");
      const field = type === "url" ? "url" : type === "text" ? "text" : "markdown";
      return apiFetch(ctx, "/contentripple/parse", {
        method: "POST",
        body: JSON.stringify({ type, [field]: requireString(args, field) }),
      });
    },
  }),
  defineTool({
    name: "list_repurpose_history",
    category: "repurposing",
    scopes: ["posts:read"],
    description:
      "List past ContentRipple repurposes, newest first: each source (type, URL, title, core message) with its variants and, for variants that were scheduled, the post's status, URL and engagement.",
    annotations: { title: "List repurpose history", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 50, description: "How many sources (default 20, at most 50)." } },
    },
    handler: (ctx, args) => apiFetch(ctx, `/contentripple/history${buildQuery({ limit: arg(args, "limit") })}`),
  }),
  defineTool({
    name: "delete_repurpose_source",
    category: "repurposing",
    scopes: ["posts:write"],
    description:
      "Delete one repurposed source and its variants from ContentRipple history. Posts already scheduled or published from it are not touched. This cannot be undone — confirm with the user first.",
    annotations: { title: "Delete repurpose source", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["source_id"],
      properties: { source_id: { type: "string", description: "Source UUID — from list_repurpose_history." } },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/contentripple/history", {
        method: "DELETE",
        body: JSON.stringify({ sourceId: requireString(args, "source_id", "sourceId") }),
      }),
  }),
];
