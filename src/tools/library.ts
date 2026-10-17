import { apiFetch } from "../lib/api-client.js";
import { arg, defineTool, requireString, type ToolDefinition } from "../lib/types.js";
import { TAG_COLORS } from "./platforms.js";

/**
 * Reusable post templates and post tags.
 *   GET    /post-templates        posts:read   src/app/api/post-templates/route.ts
 *   POST   /post-templates        posts:write  same file
 *   GET    /post-templates/{id}   posts:read   src/app/api/post-templates/[id]/route.ts
 *   PATCH  /post-templates/{id}   posts:write  same file
 *   DELETE /post-templates/{id}   posts:write  same file
 *   GET    /post-tags             posts:read   src/app/api/post-tags/route.ts
 *   POST   /post-tags             posts:write  same file
 *   PATCH  /post-tags/{id}        posts:write  src/app/api/post-tags/[id]/route.ts
 *   DELETE /post-tags/{id}        posts:write  same file
 */

const TEMPLATE_FIELDS = {
  name: { type: "string", description: "Template name (1–120 characters)." },
  content: { type: "string", description: "Default post text, up to 20,000 characters." },
  content_overrides: {
    type: "object",
    description: "Per-platform text that replaces content for that platform, as platform → text.",
  },
  account_ids: {
    type: "array",
    items: { type: "string" },
    description: "Connected account UUIDs the template targets (max 50) — from list_connections.",
  },
  platform_settings: {
    type: "object",
    description: "Per-platform publish settings, as platform → settings object (same keys as schedule_post's platform_meta).",
  },
  media: {
    type: "array",
    items: {
      type: "object",
      required: ["url", "kind", "file_name"],
      properties: {
        url: { type: "string", description: "Public media URL." },
        kind: { type: "string", enum: ["image", "video"] },
        file_name: { type: "string", description: "Display file name (max 300 characters)." },
      },
    },
    description: "Up to 10 media attachments.",
  },
  first_comment: { type: "string", description: "First comment text (max 2200 characters)." },
} as const;

function templateBody(args: Record<string, unknown>): Record<string, unknown> {
  const media = args.media as { url?: unknown; kind?: unknown; file_name?: unknown; fileName?: unknown }[] | undefined;
  return {
    name: args.name,
    content: args.content,
    contentOverrides: arg(args, "content_overrides", "contentOverrides"),
    accountIds: arg(args, "account_ids", "accountIds"),
    platformSettings: arg(args, "platform_settings", "platformSettings"),
    media: Array.isArray(media)
      ? media.map((m) => ({ url: m.url, kind: m.kind, fileName: m.file_name ?? m.fileName }))
      : undefined,
    firstComment: arg(args, "first_comment", "firstComment"),
  };
}

const templateId = (args: Record<string, unknown>) =>
  encodeURIComponent(requireString(args, "template_id", "id"));
const tagId = (args: Record<string, unknown>) => encodeURIComponent(requireString(args, "tag_id", "id"));

export const libraryTools: ToolDefinition[] = [
  defineTool({
    name: "list_post_templates",
    category: "templates",
    description:
      "List the user's saved post templates, most recently updated first — reusable composer states with text, per-platform overrides, target accounts, platform settings, media and first comment.",
    scopes: ["posts:read"],
    annotations: { title: "List post templates", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/post-templates"),
  }),

  defineTool({
    name: "get_post_template",
    category: "templates",
    description: "Get one saved post template in full, by id — to reuse its text, accounts and settings in schedule_post.",
    scopes: ["posts:read"],
    annotations: { title: "Get post template", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["template_id"],
      properties: { template_id: { type: "string", description: "Template UUID — from list_post_templates." } },
    },
    handler: (ctx, args) => apiFetch(ctx, `/post-templates/${templateId(args)}`),
  }),

  defineTool({
    name: "create_post_template",
    category: "templates",
    description:
      "Save a reusable post template: default text, optional per-platform text, target accounts, platform settings, media and first comment. Saving publishes nothing.",
    scopes: ["posts:write"],
    annotations: { title: "Create post template", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: { type: "object", required: ["name"], properties: { ...TEMPLATE_FIELDS } },
    handler: (ctx, args) =>
      apiFetch(ctx, "/post-templates", { method: "POST", body: JSON.stringify(templateBody(args)) }),
  }),

  defineTool({
    name: "update_post_template",
    category: "templates",
    description:
      "Change a saved post template. Only the fields passed are changed, and each one passed replaces the stored value entirely (e.g. account_ids replaces the whole list).",
    scopes: ["posts:write"],
    annotations: { title: "Update post template", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["template_id"],
      properties: {
        template_id: { type: "string", description: "Template UUID — from list_post_templates." },
        ...TEMPLATE_FIELDS,
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/post-templates/${templateId(args)}`, {
        method: "PATCH",
        body: JSON.stringify(templateBody(args)),
      }),
  }),

  defineTool({
    name: "delete_post_template",
    category: "templates",
    description: "Permanently delete a saved post template. Posts already scheduled from it are not affected. Confirm with the user first.",
    scopes: ["posts:write"],
    annotations: { title: "Delete post template", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["template_id"],
      properties: { template_id: { type: "string", description: "Template UUID — from list_post_templates." } },
    },
    handler: (ctx, args) => apiFetch(ctx, `/post-templates/${templateId(args)}`, { method: "DELETE" }),
  }),

  defineTool({
    name: "list_post_tags",
    category: "tags",
    description: "List the user's post tags (id, name, colour). Tag ids filter list_posts and get_calendar and are applied with schedule_post or update_post.",
    scopes: ["posts:read"],
    annotations: { title: "List post tags", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/post-tags"),
  }),

  defineTool({
    name: "create_post_tag",
    category: "tags",
    description: "Create a post tag with a name and colour, for grouping posts by campaign or theme. Names must be unique per user.",
    scopes: ["posts:write"],
    annotations: { title: "Create post tag", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["name", "color"],
      properties: {
        name: { type: "string", description: "Tag name (1–60 characters)." },
        color: { type: "string", enum: [...TAG_COLORS], description: "Tag colour." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/post-tags", { method: "POST", body: JSON.stringify({ name: args.name, color: args.color }) }),
  }),

  defineTool({
    name: "update_post_tag",
    category: "tags",
    description: "Rename and/or recolour a post tag. Posts keep the tag.",
    scopes: ["posts:write"],
    annotations: { title: "Update post tag", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["tag_id"],
      properties: {
        tag_id: { type: "string", description: "Tag UUID — from list_post_tags." },
        name: { type: "string", description: "New name (1–60 characters)." },
        color: { type: "string", enum: [...TAG_COLORS], description: "New colour." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/post-tags/${tagId(args)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: args.name, color: args.color }),
      }),
  }),

  defineTool({
    name: "delete_post_tag",
    category: "tags",
    description: "Permanently delete a post tag and remove it from every post that carries it. The posts themselves are not affected. Confirm with the user first.",
    scopes: ["posts:write"],
    annotations: { title: "Delete post tag", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["tag_id"],
      properties: { tag_id: { type: "string", description: "Tag UUID — from list_post_tags." } },
    },
    handler: (ctx, args) => apiFetch(ctx, `/post-tags/${tagId(args)}`, { method: "DELETE" }),
  }),
];
