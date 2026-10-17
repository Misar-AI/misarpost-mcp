import { apiFetch } from "./lib/api-client.js";
import type { McpContext } from "./lib/context.js";

/**
 * MCP resources — read-only context an agent can pull in without spending a
 * tool call, and which clients can attach to a conversation directly.
 *
 * Kept deliberately small and stable: resources are fetched eagerly by some
 * clients, so anything expensive or paginated belongs in a tool instead. Each
 * reads a key-authenticated MisarPost route (see the matching tool).
 */

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  read: (ctx: McpContext) => Promise<unknown>;
}

export const RESOURCES: ResourceDefinition[] = [
  {
    uri: "misarpost://connections",
    name: "Connected accounts",
    description:
      "Active connected accounts with their IDs and platforms. Read before planning or scheduling — a post can only go to an account that is connected and active.",
    mimeType: "application/json",
    read: (ctx) => apiFetch(ctx, "/connections"),
  },
  {
    uri: "misarpost://queue",
    name: "Scheduled queue",
    description:
      "The first page of queued posts — what is already scheduled — so new posts do not collide with it.",
    mimeType: "application/json",
    read: (ctx) => apiFetch(ctx, "/posts?status=queued"),
  },
  {
    uri: "misarpost://drafts",
    name: "Draft queue",
    description: "Drafts awaiting review, so work in progress is resumed rather than restarted.",
    mimeType: "application/json",
    read: (ctx) => apiFetch(ctx, "/drafts"),
  },
  {
    uri: "misarpost://stats",
    name: "Account overview",
    description:
      "Queued, published and draft counts, the top performing post of the month, and the average engagement rate.",
    mimeType: "application/json",
    read: (ctx) => apiFetch(ctx, "/stats"),
  },
  {
    uri: "misarpost://tags",
    name: "Post tags",
    description: "The user's post tags (id, name, colour), for tagging and filtering posts.",
    mimeType: "application/json",
    read: (ctx) => apiFetch(ctx, "/post-tags"),
  },
  {
    uri: "misarpost://templates",
    name: "Post templates",
    description: "Saved post templates — reusable text, target accounts and platform settings.",
    mimeType: "application/json",
    read: (ctx) => apiFetch(ctx, "/post-templates"),
  },
];

const BY_URI = new Map(RESOURCES.map((r) => [r.uri, r]));

export function listResources() {
  return RESOURCES.map(({ uri, name, description, mimeType }) => ({
    uri,
    name,
    description,
    mimeType,
  }));
}

export async function readResource(uri: string, ctx: McpContext) {
  const resource = BY_URI.get(uri);
  if (!resource) return null;
  const data = await resource.read(ctx);
  return {
    contents: [{ uri, mimeType: resource.mimeType, text: JSON.stringify(data, null, 2) }],
  };
}
