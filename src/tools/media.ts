import { apiFetch, buildQuery } from "../lib/api-client.js";
import { arg, defineTool, requireString, type ToolDefinition } from "../lib/types.js";

/**
 * Media library and AI video.
 *   GET    /media                   media:read      src/app/api/media/route.ts
 *   DELETE /media/{id}              media:write     src/app/api/media/[id]/route.ts
 *   GET    /video/avatars           media:read      src/app/api/video/avatars/route.ts
 *   GET    /video/voices            media:read      src/app/api/video/voices/route.ts
 *   POST   /video/script            generate:write  src/app/api/video/script/route.ts
 *   POST   /video/generate          generate:write  src/app/api/video/generate/route.ts
 *   GET    /video/status/{jobId}    media:read      src/app/api/video/status/[jobId]/route.ts
 *
 * Not offered: POST /media/upload accepts multipart form data only, which a
 * JSON tool call cannot carry. Attach media by public URL in schedule_post.
 */
const PROVIDER = {
  type: "string",
  description: "Video provider (default heygen, currently the only one).",
} as const;

export const mediaTools: ToolDefinition[] = [
  defineTool({
    name: "list_media",
    category: "media",
    description:
      "List the user's uploaded media library, newest first, 24 per page, with each file's public URL — usable directly in schedule_post's media_urls.",
    scopes: ["media:read"],
    annotations: { title: "List media", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: { page: { type: "number", description: "1-indexed page (default 1, 24 items per page)." } },
    },
    handler: (ctx, args) => apiFetch(ctx, `/media${buildQuery({ page: args.page })}`),
  }),

  defineTool({
    name: "delete_media",
    category: "media",
    description:
      "Permanently delete a file from the media library and storage. Posts that already include its URL keep their own copy of the URL, but the file behind it is gone. Confirm with the user first.",
    scopes: ["media:write"],
    annotations: { title: "Delete media", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["media_id"],
      properties: { media_id: { type: "string", description: "Media UUID — from list_media." } },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/media/${encodeURIComponent(requireString(args, "media_id", "id"))}`, { method: "DELETE" }),
  }),

  defineTool({
    name: "list_video_avatars",
    category: "video",
    description: "List the stock presenter avatars available for AI video generation. Pass an avatar's id to generate_video.",
    scopes: ["media:read"],
    annotations: { title: "List video avatars", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: { type: "object", properties: { provider: PROVIDER } },
    handler: (ctx, args) => apiFetch(ctx, `/video/avatars${buildQuery({ provider: args.provider })}`),
  }),

  defineTool({
    name: "list_video_voices",
    category: "video",
    description: "List the stock voices available for AI video generation. Pass a voice's id to generate_video.",
    scopes: ["media:read"],
    annotations: { title: "List video voices", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: { type: "object", properties: { provider: PROVIDER } },
    handler: (ctx, args) => apiFetch(ctx, `/video/voices${buildQuery({ provider: args.provider })}`),
  }),

  defineTool({
    name: "create_video_script",
    category: "video",
    description:
      "Write a short talking-presenter video script from a post's text. Saves nothing; counts against the monthly AI allowance. Show the script to the user before generate_video.",
    scopes: ["generate:write"],
    annotations: { title: "Write video script", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["post_text"],
      properties: { post_text: { type: "string", description: "Post text to base the script on (1–4000 characters)." } },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/video/script", {
        method: "POST",
        body: JSON.stringify({ postText: arg(args, "post_text", "postText") }),
      }),
  }),

  defineTool({
    name: "generate_video",
    category: "video",
    description:
      "Start rendering an AI presenter video from a script, avatar and voice. Returns a job id immediately; poll get_video_status until it completes. Rendering is metered and spends the user's video allowance — confirm the script first.",
    scopes: ["generate:write"],
    annotations: { title: "Generate AI video", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["script", "avatar_id", "voice_id", "aspect_ratio"],
      properties: {
        script: { type: "string", description: "What the presenter says (1–5000 characters)." },
        avatar_id: { type: "string", description: "Avatar id — from list_video_avatars." },
        voice_id: { type: "string", description: "Voice id — from list_video_voices." },
        aspect_ratio: {
          type: "string",
          enum: ["portrait", "story"],
          description: "Video shape.",
        },
        captions: { type: "boolean", description: "Burn in captions (default true)." },
        provider: PROVIDER,
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/video/generate", {
        method: "POST",
        body: JSON.stringify({
          provider: args.provider,
          script: args.script,
          avatarId: arg(args, "avatar_id", "avatarId"),
          voiceId: arg(args, "voice_id", "voiceId"),
          aspectRatio: arg(args, "aspect_ratio", "aspectRatio"),
          captions: args.captions,
        }),
      }),
  }),

  defineTool({
    name: "get_video_status",
    category: "video",
    description:
      "Check an AI video job: processing, failed (with the error), or completed with the video's URL in the media storage — ready for schedule_post's media_urls.",
    scopes: ["media:read"],
    annotations: { title: "Get video status", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["job_id"],
      properties: { job_id: { type: "string", description: "Job id — from generate_video." } },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/video/status/${encodeURIComponent(requireString(args, "job_id", "jobId"))}`),
  }),
];
