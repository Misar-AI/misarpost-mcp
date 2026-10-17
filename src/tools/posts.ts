import { apiFetch, buildQuery } from "../lib/api-client.js";
import { arg, defineTool, requireString, type ToolDefinition } from "../lib/types.js";
import { POST_STATUSES, SCHEDULE_PLATFORMS } from "./platforms.js";

/**
 * Scheduled and published posts.
 *
 * Routes (MisarPost, each `withAuth({ scope })`):
 *   GET    /posts        posts:read      src/app/api/posts/route.ts
 *   DELETE /posts        posts:write     src/app/api/posts/route.ts   (body { postId })
 *   PATCH  /posts/{id}   posts:write     src/app/api/posts/[id]/route.ts
 *   GET    /calendar     posts:read      src/app/api/calendar/route.ts
 *   POST   /schedule     schedule:write  src/app/api/schedule/route.ts
 *   POST   /posts/{id}/reply    posts:write  src/app/api/posts/[id]/reply/route.ts
 *   POST   /posts/{id}/revert   posts:write  src/app/api/posts/[id]/revert/route.ts
 *   POST   /posts/revert-batch  posts:write  src/app/api/posts/revert-batch/route.ts
 *   POST   /posts/{id}/share    posts:write  src/app/api/posts/[id]/share/route.ts
 *   DELETE /posts/{id}/share    posts:write  same file
 */
const postId = (args: Record<string, unknown>) =>
  encodeURIComponent(requireString(args, "post_id", "postId", "id"));

export const postTools: ToolDefinition[] = [
  defineTool({
    name: "list_posts",
    category: "posts",
    description:
      "List the user's scheduled and published posts, newest-scheduled first, 20 per page, with platform, status, scheduled/published time, post URL, tags and engagement metrics. Filter by status (e.g. queued or pending for what is coming up — the content calendar — or published for what went out) or by tag.",
    scopes: ["posts:read"],
    annotations: {
      title: "List posts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [...POST_STATUSES],
          description:
            "Only posts in this status. Omit for every status except archived and cancelled.",
        },
        tag_id: { type: "string", description: "Only posts carrying this post tag (UUID)." },
        page: { type: "number", description: "1-indexed page number (default 1, 20 posts per page)." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(
        ctx,
        `/posts${buildQuery({ status: args.status, tagId: arg(args, "tag_id", "tagId"), page: args.page })}`,
      ),
  }),

  defineTool({
    name: "schedule_post",
    category: "posts",
    description:
      "Schedule a post to ONE connected account at a given time, or publish it immediately with scheduled_at=\"now\". This queues real content for a real audience — show the user the exact text, account and time and get explicit approval first. To post the same content to several accounts, call once per account with the same post_batch_id. The user's post signature is appended server-side, and the safety gateway may refuse a post (account health, daily limits, duplicates).",
    scopes: ["schedule:write"],
    annotations: {
      title: "Schedule or publish post",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      required: ["connected_account_id", "platform", "content_text", "scheduled_at"],
      properties: {
        connected_account_id: {
          type: "string",
          description: "Connected account UUID — from list_connections.",
        },
        platform: {
          type: "string",
          enum: [...SCHEDULE_PLATFORMS],
          description: "Platform of that connected account (must match it).",
        },
        content_text: { type: "string", description: "Post text, 1–5000 characters." },
        scheduled_at: {
          type: "string",
          description:
            "ISO 8601 datetime with timezone (e.g. 2030-01-01T09:00:00Z), or \"now\" to publish immediately.",
        },
        media_urls: {
          type: "array",
          items: { type: "string" },
          description: "Up to 10 publicly reachable media URLs to attach.",
        },
        first_comment: {
          type: "string",
          description: "Optional first comment posted under the post (max 2200 characters).",
        },
        variant_id: {
          type: "string",
          description:
            "UUID of the draft (from list_drafts or generate_posts) this post was made from; marks that draft as scheduled.",
        },
        platform_meta: {
          type: "object",
          description:
            "Platform-specific publish settings, passed through to the publisher. Examples: Reddit { subreddit, flairId }, Pinterest { board }, Discord/Slack { channelId }, YouTube { title, privacyStatus }, Hashnode/Medium { publicationId }, Listmonk { listId, templateId }, Lemmy { communityId }, Skool { groupId }. Look up valid ids with list_publish_options.",
        },
        tag_ids: {
          type: "array",
          items: { type: "string" },
          description: "Up to 20 post tag UUIDs to apply.",
        },
        post_batch_id: {
          type: "string",
          description:
            "UUID shared by every call that posts the same content to different accounts, so they can later be managed together.",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/schedule", {
        method: "POST",
        body: JSON.stringify({
          connectedAccountId: arg(args, "connected_account_id", "connectedAccountId"),
          platform: args.platform,
          contentText: arg(args, "content_text", "contentText"),
          scheduledAt: arg(args, "scheduled_at", "scheduledAt"),
          mediaUrls: arg(args, "media_urls", "mediaUrls"),
          firstComment: arg(args, "first_comment", "firstComment"),
          variantId: arg(args, "variant_id", "variantId"),
          platformMeta: arg(args, "platform_meta", "platformMeta"),
          tagIds: arg(args, "tag_ids", "tagIds"),
          postBatchId: arg(args, "post_batch_id", "postBatchId"),
        }),
      }),
  }),

  defineTool({
    name: "cancel_post",
    category: "posts",
    description:
      "Cancel a post that is still pending or queued, so it never publishes. Posts that are already publishing or published cannot be cancelled, and a cancelled post cannot be re-queued — it must be scheduled again. To change a post instead, use update_post. Confirm with the user first.",
    scopes: ["posts:write"],
    annotations: {
      title: "Cancel scheduled post",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["post_id"],
      properties: {
        post_id: { type: "string", description: "Post UUID — from list_posts." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/posts", {
        method: "DELETE",
        body: JSON.stringify({ postId: requireString(args, "post_id", "postId", "id") }),
      }),
  }),

  defineTool({
    name: "get_calendar",
    category: "posts",
    description:
      "Get every post scheduled between two dates (default: 7 days ago to 30 days ahead), oldest first, with platform, status, time, text, media, first comment and tags — the content calendar view. Optionally only posts with one tag. Needs a plan that includes the content calendar; otherwise it returns an upgrade message.",
    scopes: ["posts:read"],
    annotations: {
      title: "Get content calendar",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Start date, YYYY-MM-DD (default 7 days ago)." },
        to: { type: "string", description: "End date, YYYY-MM-DD, inclusive (default 30 days from now)." },
        tag_id: { type: "string", description: "Only posts carrying this post tag (UUID)." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(
        ctx,
        `/calendar${buildQuery({ from: args.from, to: args.to, tagId: arg(args, "tag_id", "tagId") })}`,
      ),
  }),

  defineTool({
    name: "update_post",
    category: "posts",
    description:
      "Edit a post that has not gone out yet (status pending, queued or draft): its text, its scheduled time, its first comment, or its tags. Changing the time moves when it publishes, so confirm the new text and time with the user first. Published posts cannot be edited.",
    scopes: ["posts:write"],
    annotations: {
      title: "Edit scheduled post",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["post_id"],
      properties: {
        post_id: { type: "string", description: "Post UUID — from list_posts or get_calendar." },
        content_text: { type: "string", description: "New post text." },
        scheduled_at: {
          type: "string",
          description: "New ISO 8601 datetime with timezone offset, e.g. 2030-01-01T09:00:00+05:30.",
        },
        first_comment: {
          type: ["string", "null"],
          description: "New first comment, or null to remove it.",
        },
        tag_ids: {
          type: "array",
          items: { type: "string" },
          description: "Replace the post's tags with these post tag UUIDs (max 20); [] removes all.",
        },
      },
    },
    handler: (ctx, args) => {
      const id = requireString(args, "post_id", "id");
      const body: Record<string, unknown> = {
        contentText: arg(args, "content_text", "contentText"),
        scheduledAt: arg(args, "scheduled_at", "scheduledAt"),
        tagIds: arg(args, "tag_ids", "tagIds"),
      };
      // null is meaningful here (remove the comment), so it is not dropped.
      if ("first_comment" in args) body.firstComment = args.first_comment;
      else if ("firstComment" in args) body.firstComment = args.firstComment;
      return apiFetch(ctx, `/posts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
  }),

  defineTool({
    name: "reply_to_post",
    category: "posts",
    description:
      "Post a public reply/comment on one of the user's ALREADY-PUBLISHED posts, on the platform it was published to. It goes live immediately and cannot be recalled from here. Show the user the exact text and get their explicit approval before calling. Not every platform supports replies; an unsupported one returns an error.",
    scopes: ["posts:write"],
    annotations: { title: "Reply to published post", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["post_id", "message"],
      properties: {
        post_id: { type: "string", description: "Post UUID — from list_posts (status published)." },
        message: { type: "string", minLength: 1, maxLength: 2000, description: "The reply text." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/posts/${postId(args)}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: requireString(args, "message") }),
      }),
  }),

  defineTool({
    name: "revert_post",
    category: "posts",
    description:
      "Delete an ALREADY-PUBLISHED post from the platform it went out on (unlike cancel_post, which only stops a post that has not published yet). This removes it from the user's live profile and cannot be undone. Get the user's explicit approval for this exact post first. The response includes the post's postBatchId, for revert_post_batch.",
    scopes: ["posts:write"],
    annotations: { title: "Delete published post from platform", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["post_id"],
      properties: { post_id: { type: "string", description: "Post UUID — from list_posts (status published)." } },
    },
    handler: (ctx, args) => apiFetch(ctx, `/posts/${postId(args)}/revert`, { method: "POST" }),
  }),

  defineTool({
    name: "revert_post_batch",
    category: "posts",
    description:
      "\"Delete everywhere\": delete every published post from one batch (one compose or repurpose action sent to several accounts) from all of its platforms. Each platform is attempted separately and reported separately; some platforms (e.g. TikTok) have no delete API and need manual clean-up. Cannot be undone — get the user's explicit approval first.",
    scopes: ["posts:write"],
    annotations: { title: "Delete published batch everywhere", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["post_batch_id"],
      properties: { post_batch_id: { type: "string", description: "Batch UUID — post_batch_id from list_posts, or postBatchId from revert_post." } },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/posts/revert-batch", {
        method: "POST",
        body: JSON.stringify({ postBatchId: requireString(args, "post_batch_id", "postBatchId") }),
      }),
  }),

  defineTool({
    name: "share_post",
    category: "posts",
    description:
      "Create (or return the existing) public preview link for one of the user's posts. Anyone with the link can view the post without signing in, so get the user's explicit approval before sharing. Revoke it with unshare_post.",
    scopes: ["posts:write"],
    annotations: { title: "Create public share link", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["post_id"],
      properties: { post_id: { type: "string", description: "Post UUID — from list_posts." } },
    },
    handler: (ctx, args) => apiFetch(ctx, `/posts/${postId(args)}/share`, { method: "POST" }),
  }),

  defineTool({
    name: "unshare_post",
    category: "posts",
    description: "Revoke a post's public preview link, so the old link stops working. Safe to call when no link exists.",
    scopes: ["posts:write"],
    annotations: { title: "Revoke public share link", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["post_id"],
      properties: { post_id: { type: "string", description: "Post UUID — from list_posts." } },
    },
    handler: (ctx, args) => apiFetch(ctx, `/posts/${postId(args)}/share`, { method: "DELETE" }),
  }),
];
