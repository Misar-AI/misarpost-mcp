import { apiFetch, buildQuery } from "../lib/api-client.js";
import { defineTool, type ToolDefinition } from "../lib/types.js";

/**
 * Growth Hub (Empire plan).
 *
 * Routes (MisarPost, `withAuth({ scope })`):
 *   GET /growth/overview       → src/app/api/growth/overview/route.ts
 *   GET /growth/opportunities  → src/app/api/growth/opportunities/route.ts
 *   GET /growth/playbooks      → src/app/api/growth/playbooks/route.ts
 *   GET /growth/next-opportunity → src/app/api/growth/next-opportunity/route.ts
 *
 * Each gates on the Empire tier and returns 403 with an upgrade message below it.
 */
const EMPIRE_NOTE = " Requires the Empire plan; on other plans it returns an upgrade message.";

export const growthTools: ToolDefinition[] = [
  defineTool({
    name: "get_growth_overview",
    category: "growth",
    scopes: ["analytics:read"],
    description:
      "Get the Growth Hub overview for the last 7, 30 or 90 days: per-platform engagement trend lines, the weakest-performing platforms (bottlenecks), which post formats perform best, and which platforms have real trend data behind their suggestions." +
      EMPIRE_NOTE,
    annotations: {
      title: "Get growth overview",
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
    handler: (ctx, args) => apiFetch(ctx, `/growth/overview${buildQuery({ days: args.days })}`),
  }),

  defineTool({
    name: "list_growth_opportunities",
    category: "growth",
    scopes: ["analytics:read"],
    description:
      "List rising trends worth posting about now, limited to the user's niches and to platforms they have connected, each with the hashtag, its growth, and a posting suggestion. Returns an empty list — never an invented one — when no real signal exists." +
      EMPIRE_NOTE,
    annotations: {
      title: "List growth opportunities",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/growth/opportunities"),
  }),

  defineTool({
    name: "list_growth_playbooks",
    category: "growth",
    scopes: ["analytics:read"],
    description:
      "Get per-platform growth playbooks for the user's connected platforms — cadence, format, timing and anti-spam guidance compiled from each platform's official creator documentation, with source links." +
      EMPIRE_NOTE,
    annotations: {
      title: "List growth playbooks",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/growth/playbooks"),
  }),
  defineTool({
    name: "get_next_growth_opportunity",
    category: "growth",
    scopes: ["analytics:read"],
    description:
      "Get the single best next content opportunity for the user's connected platforms and niches — a compact version of list_growth_opportunities. Returns `{ opportunity: null }` rather than an invented one when there is no real signal." +
      EMPIRE_NOTE,
    annotations: { title: "Get next growth opportunity", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/growth/next-opportunity"),
  }),
];
