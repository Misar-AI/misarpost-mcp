import { apiFetch, buildQuery } from "../lib/api-client.js";
import { defineTool, type ToolDefinition } from "../lib/types.js";

/**
 * Performance reporting.
 *
 * Routes (MisarPost, `withAuth({ scope })`):
 *   GET /stats              → src/app/api/stats/route.ts
 *   GET /analytics/trends   → src/app/api/analytics/trends/route.ts
 */
export const analyticsTools: ToolDefinition[] = [
  defineTool({
    name: "get_stats",
    category: "analytics",
    scopes: ["analytics:read"],
    description:
      "Get the account overview: connected accounts, posts queued, published this week and this month, drafts waiting, the last published post, the top performing post of the month, and the average engagement rate (null when no metrics exist yet).",
    annotations: {
      title: "Get overview stats",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/stats"),
  }),

  defineTool({
    name: "get_analytics_trends",
    category: "analytics",
    scopes: ["analytics:read"],
    description:
      "Get per-channel daily trends for the last 7, 30 or 90 days: posts published and failed, engagement and impressions, totals, and the change against the previous period. Each channel's metric field says whether real engagement data exists for it (engagement) or only publish volume (posts) — never present a posts-only channel's zero engagement as a real result.",
    annotations: {
      title: "Get channel trends",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", enum: [7, 30, 90], description: "Window in days (default 30)." },
      },
    },
    handler: (ctx, args) => apiFetch(ctx, `/analytics/trends${buildQuery({ days: args.days })}`),
  }),
];
