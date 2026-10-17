import { apiFetch } from "../lib/api-client.js";
import { defineTool, type ToolDefinition } from "../lib/types.js";

/**
 * Draft post variants awaiting review (`post_variants` in draft or
 * pending_review). Route: MisarPost `src/app/api/drafts/route.ts`, `withAuth({ scope })`.
 */
export const draftTools: ToolDefinition[] = [
  defineTool({
    name: "list_drafts",
    category: "drafts",
    scopes: ["posts:read"],
    description:
      "List up to 50 draft post variants awaiting review (status draft or pending_review), newest first — including AI-generated drafts from generate_posts — with platform, caption, hashtags, tone and source.",
    annotations: {
      title: "List drafts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/drafts"),
  }),

  defineTool({
    name: "review_drafts",
    category: "drafts",
    scopes: ["posts:write"],
    description:
      "Approve or reject several drafts at once by ID. Approving does NOT schedule or publish anything — use schedule_post for that. Rejected drafts drop out of list_drafts. Returns how many drafts were updated.",
    annotations: {
      title: "Approve or reject drafts",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["action", "ids"],
      properties: {
        action: { type: "string", enum: ["approve", "reject"], description: "What to do with the drafts." },
        ids: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Draft UUIDs — from list_drafts.",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/drafts", {
        method: "POST",
        body: JSON.stringify({ action: args.action, ids: args.ids }),
      }),
  }),
];
