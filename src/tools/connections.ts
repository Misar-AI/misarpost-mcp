import { apiFetch, buildQuery } from "../lib/api-client.js";
import { arg, defineTool, requireString, type ToolDefinition } from "../lib/types.js";

/**
 * Connected accounts, their per-platform publish options, and plugs.
 *
 * Routes (MisarPost, each `withAuth({ scope })` — the scope a
 * tool carries is the one its route method declares):
 *   GET   /connections                                 → src/app/api/connections/route.ts
 *   GET   /connections/{accountId}/plugs               → …/connections/[accountId]/plugs/route.ts
 *   PATCH /connections/{accountId}/plugs               → same file
 *   GET   /connections/{accountId}/wordpress-taxonomies → …/[accountId]/wordpress-taxonomies/route.ts
 *   GET   /composer/<platform>/<list>?accountId=       → src/app/api/composer/** /route.ts
 */

/** `kind` → the composer route it reads. Every one takes `?accountId=`. */
const PUBLISH_OPTION_ROUTES: Record<string, string> = {
  discord_channels: "/composer/discord/channels",
  slack_channels: "/composer/slack/channels",
  pinterest_boards: "/composer/pinterest/boards",
  reddit_flairs: "/composer/reddit/flairs",
  hashnode_publications: "/composer/hashnode/publications",
  hashnode_tags: "/composer/hashnode/tags",
  medium_publications: "/composer/medium/publications",
  lemmy_communities: "/composer/lemmy/communities",
  listmonk_lists: "/composer/listmonk/lists",
  listmonk_templates: "/composer/listmonk/templates",
  skool_groups: "/composer/skool/groups",
  whop_forums: "/composer/whop/forums",
};

export const connectionTools: ToolDefinition[] = [
  defineTool({
    name: "list_connections",
    category: "connections",
    scopes: ["connections:read"],
    description:
      "List the user's active connected social accounts with their account ID, platform and display name. Call this before scheduling: schedule_post needs the connected_account_id, and a post can only go to an account that is connected and active.",
    annotations: {
      title: "List connected accounts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/connections"),
  }),

  defineTool({
    name: "list_publish_options",
    category: "connections",
    scopes: ["connections:read"],
    description:
      "Look up the destinations a connected account can publish into — Discord or Slack channels, Pinterest boards, Reddit post flairs, Hashnode or Medium publications, Hashnode tags, Lemmy communities, Listmonk lists or templates, Skool groups, Whop forums, or WordPress categories and tags. Use the returned ids in schedule_post's platform_meta. Reads live from the platform, so an empty list can also mean the platform could not be reached.",
    annotations: {
      title: "List publish destinations",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      required: ["kind", "account_id"],
      properties: {
        kind: {
          type: "string",
          enum: [...Object.keys(PUBLISH_OPTION_ROUTES), "wordpress_taxonomies"],
          description: "Which list to fetch; it must match the connected account's platform.",
        },
        account_id: { type: "string", description: "Connected account UUID — from list_connections." },
        subreddit: {
          type: "string",
          description: "Subreddit name (without r/). Required for kind=reddit_flairs.",
        },
      },
    },
    handler: (ctx, args) => {
      const kind = requireString(args, "kind");
      const accountId = requireString(args, "account_id", "accountId");
      if (kind === "wordpress_taxonomies") {
        return apiFetch(
          ctx,
          `/connections/${encodeURIComponent(accountId)}/wordpress-taxonomies`,
        );
      }
      const route = PUBLISH_OPTION_ROUTES[kind];
      if (!route) throw new Error(`Unknown kind: ${kind}`);
      return apiFetch(
        ctx,
        `${route}${buildQuery({ accountId, subreddit: kind === "reddit_flairs" ? args.subreddit : undefined })}`,
      );
    },
  }),

  defineTool({
    name: "list_account_plugs",
    category: "connections",
    scopes: ["connections:read"],
    description:
      "Show the plugs (automatic follow-up actions — e.g. reposting or resharing a post once it passes a likes or reactions threshold, on X, Bluesky, Threads and LinkedIn) available for one connected account, how each is currently configured and activated, and the account's 20 most recent plug runs.",
    annotations: {
      title: "List account plugs",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["account_id"],
      properties: {
        account_id: { type: "string", description: "Connected account UUID — from list_connections." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(
        ctx,
        `/connections/${encodeURIComponent(requireString(args, "account_id", "accountId"))}/plugs`,
      ),
  }),

  defineTool({
    name: "configure_account_plug",
    category: "connections",
    scopes: ["connections:write"],
    description:
      "Turn a plug on or off for one connected account and set its configuration, replacing the plug's previous configuration. An activated plug later acts on that account's published posts automatically, in public, without asking again — confirm the exact plug and settings with the user first. Get valid plug keys and config fields from list_account_plugs.",
    annotations: {
      title: "Configure account plug",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["account_id", "plug_key", "activated"],
      properties: {
        account_id: { type: "string", description: "Connected account UUID — from list_connections." },
        plug_key: { type: "string", description: "Plug key — from list_account_plugs definitions." },
        activated: { type: "boolean", description: "true to activate the plug, false to switch it off." },
        config: {
          type: "object",
          description:
            "The plug's configuration as flat key → string/number/boolean values, using the configFields list_account_plugs returns. Replaces the existing configuration.",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(
        ctx,
        `/connections/${encodeURIComponent(requireString(args, "account_id", "accountId"))}/plugs`,
        {
          method: "PATCH",
          body: JSON.stringify({
            plugKey: arg(args, "plug_key", "plugKey"),
            activated: args.activated,
            config: args.config,
          }),
        },
      ),
  }),
];
