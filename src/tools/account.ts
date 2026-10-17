import { apiFetch, buildQuery } from "../lib/api-client.js";
import { defineTool, requireString, type ToolDefinition } from "../lib/types.js";
import { WEBHOOK_EVENTS } from "./platforms.js";

/**
 * Notifications, outbound webhooks and workspaces.
 *   GET    /notifications           notifications:read   src/app/api/notifications/route.ts
 *   PATCH  /notifications/{id}      notifications:write  src/app/api/notifications/[id]/route.ts
 *   POST   /notifications/read-all  notifications:write  src/app/api/notifications/read-all/route.ts
 *   GET    /webhooks/outbound       webhooks:read        src/app/api/webhooks/outbound/route.ts
 *   POST   /webhooks/outbound       webhooks:write       same file
 *   PATCH  /webhooks/outbound/{id}  webhooks:write       src/app/api/webhooks/outbound/[id]/route.ts
 *   DELETE /webhooks/outbound/{id}  webhooks:write       same file
 *   GET    /workspaces              workspaces:read      src/app/api/workspaces/route.ts
 */
const webhookId = (args: Record<string, unknown>) =>
  encodeURIComponent(requireString(args, "webhook_id", "id"));

const EVENTS = {
  type: "array",
  items: { type: "string", enum: [...WEBHOOK_EVENTS] },
  minItems: 1,
  description: "Events to deliver: post.published, post.failed, account.disconnected.",
} as const;

export const accountTools: ToolDefinition[] = [
  defineTool({
    name: "list_notifications",
    category: "notifications",
    description:
      "List the user's MisarPost notifications (publish results, account problems and the like), newest first, with the unread count.",
    scopes: ["notifications:read"],
    annotations: { title: "List notifications", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "1-indexed page (default 1)." },
        page_size: { type: "number", description: "Items per page (default 20, max 50)." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/notifications${buildQuery({ page: args.page, pageSize: args.page_size })}`),
  }),

  defineTool({
    name: "mark_notification_read",
    category: "notifications",
    description: "Mark one notification as read, e.g. after relaying it to the user. It drops out of the unread count.",
    scopes: ["notifications:write"],
    annotations: { title: "Mark notification read", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["notification_id"],
      properties: { notification_id: { type: "string", description: "Notification UUID — from list_notifications." } },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/notifications/${encodeURIComponent(requireString(args, "notification_id", "id"))}`, {
        method: "PATCH",
      }),
  }),

  defineTool({
    name: "mark_all_notifications_read",
    category: "notifications",
    description: "Mark every unread notification as read. There is no way to mark them unread again.",
    scopes: ["notifications:write"],
    annotations: { title: "Mark all notifications read", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/notifications/read-all", { method: "POST" }),
  }),

  defineTool({
    name: "list_webhooks",
    category: "webhooks",
    description:
      "List the user's outbound webhooks — the URLs MisarPost sends signed event payloads to — with their events and whether each is active. Signing secrets are never returned.",
    scopes: ["webhooks:read"],
    annotations: { title: "List outbound webhooks", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/webhooks/outbound"),
  }),

  defineTool({
    name: "create_webhook",
    category: "webhooks",
    description:
      "Register an outbound webhook: MisarPost will POST signed payloads for the chosen events to this URL from now on. The response carries the signing secret exactly once — tell the user to store it; it cannot be shown again. Sending account data to a new URL needs the user's explicit approval of that URL.",
    scopes: ["webhooks:write"],
    annotations: { title: "Create outbound webhook", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["url", "events"],
      properties: {
        url: { type: "string", description: "The user's public HTTPS endpoint (max 2048 characters)." },
        events: EVENTS,
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/webhooks/outbound", {
        method: "POST",
        body: JSON.stringify({ url: args.url, events: args.events }),
      }),
  }),

  defineTool({
    name: "update_webhook",
    category: "webhooks",
    description: "Change an outbound webhook's URL or events, or pause/resume it with active. Only the fields passed change.",
    scopes: ["webhooks:write"],
    annotations: { title: "Update outbound webhook", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["webhook_id"],
      properties: {
        webhook_id: { type: "string", description: "Webhook UUID — from list_webhooks." },
        url: { type: "string", description: "New public HTTPS endpoint." },
        events: EVENTS,
        active: { type: "boolean", description: "false pauses delivery, true resumes it." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/webhooks/outbound/${webhookId(args)}`, {
        method: "PATCH",
        body: JSON.stringify({ url: args.url, events: args.events, active: args.active }),
      }),
  }),

  defineTool({
    name: "delete_webhook",
    category: "webhooks",
    description: "Permanently remove an outbound webhook; events stop being delivered to its URL. Confirm with the user first.",
    scopes: ["webhooks:write"],
    annotations: { title: "Delete outbound webhook", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["webhook_id"],
      properties: { webhook_id: { type: "string", description: "Webhook UUID — from list_webhooks." } },
    },
    handler: (ctx, args) => apiFetch(ctx, `/webhooks/outbound/${webhookId(args)}`, { method: "DELETE" }),
  }),

  defineTool({
    name: "list_workspaces",
    category: "workspaces",
    description: "List the workspaces the user belongs to. When workspace scoping is on, posts, accounts and stats are limited to the active workspace.",
    scopes: ["workspaces:read"],
    annotations: { title: "List workspaces", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/workspaces"),
  }),
];
