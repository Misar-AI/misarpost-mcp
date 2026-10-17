import { apiFetch, buildQuery } from "../lib/api-client.js";
import { arg, defineTool, requireString, type ToolDefinition } from "../lib/types.js";
import { PERSONA_ACCOUNT_PLATFORMS, PERSONA_PROFILE_PLATFORMS } from "./platforms.js";

/**
 * PersonaForge — writing personas learned from real accounts.
 *   GET    /personaforge/personas                 personas:read   src/app/api/personaforge/personas/route.ts
 *   POST   /personaforge/personas                 personas:write  same file
 *   GET    /personaforge/personas/status/{jobId}  personas:read   …/personas/status/[jobId]/route.ts
 *   GET    /personaforge/personas/{id}            personas:read   …/personas/[id]/route.ts
 *   PATCH  /personaforge/personas/{id}            personas:write  same file
 *   DELETE /personaforge/personas/{id}            personas:write  same file
 *   POST   /personaforge/generate                 generate:write  src/app/api/personaforge/generate/route.ts
 *   GET    /personaforge/replies                  personas:read   src/app/api/personaforge/replies/route.ts
 *   POST   /personaforge/replies                  personas:write  same file
 *   POST   /personaforge/replies/approve          personas:write  …/replies/approve/route.ts
 *   GET    /personaforge/voice                    personas:read   src/app/api/personaforge/voice/route.ts
 *   POST   /personaforge/voice                    personas:write  same file
 *   POST   /personaforge/bio                      generate:write  src/app/api/personaforge/bio/route.ts
 *   GET    /personaforge/competitors              personas:read   src/app/api/personaforge/competitors/route.ts
 *   POST   /personaforge/competitors              personas:write  same file
 */
const personaId = (args: Record<string, unknown>) =>
  encodeURIComponent(requireString(args, "persona_id", "id"));

export const personaTools: ToolDefinition[] = [
  defineTool({
    name: "list_personas",
    category: "personas",
    description:
      "List the user's PersonaForge personas — writing styles learned from a real account — plus extraction jobs still running and recent failures.",
    scopes: ["personas:read"],
    annotations: { title: "List personas", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/personaforge/personas"),
  }),

  defineTool({
    name: "get_persona",
    category: "personas",
    description: "Get one persona in full: its name, cover image, source account, and the style profile used when writing in it.",
    scopes: ["personas:read"],
    annotations: { title: "Get persona", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["persona_id"],
      properties: { persona_id: { type: "string", description: "Persona UUID — from list_personas." } },
    },
    handler: (ctx, args) => apiFetch(ctx, `/personaforge/personas/${personaId(args)}`),
  }),

  defineTool({
    name: "create_persona",
    category: "personas",
    description:
      "Start learning a writing persona from recent posts — either a connected account (instagram, twitter, youtube) or a public profile (youtube, medium, mastodon, bluesky). Fetches the posts and analyses them with AI in the background (counts against the plan's AI image allowance, for the persona cover); returns a job id to poll with get_persona_job_status.",
    scopes: ["personas:write"],
    annotations: { title: "Create persona", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["source_kind", "platform"],
      properties: {
        source_kind: {
          type: "string",
          enum: ["connected_account", "public_profile"],
          description: "Learn from one of the user's connected accounts, or from a public profile.",
        },
        platform: {
          type: "string",
          enum: [...new Set([...PERSONA_ACCOUNT_PLATFORMS, ...PERSONA_PROFILE_PLATFORMS])],
          description: `connected_account: ${PERSONA_ACCOUNT_PLATFORMS.join(", ")}. public_profile: ${PERSONA_PROFILE_PLATFORMS.join(", ")}.`,
        },
        connected_account_id: {
          type: "string",
          description: "Required for connected_account — from list_connections.",
        },
        identifier: {
          type: "string",
          description: "Required for public_profile — the profile handle or URL (max 300 characters).",
        },
        name: { type: "string", description: "Optional persona name (max 60 characters)." },
      },
    },
    handler: (ctx, args) => {
      const sourceKind = arg(args, "source_kind", "sourceKind");
      const body =
        sourceKind === "connected_account"
          ? {
              sourceKind,
              connectedAccountId: arg(args, "connected_account_id", "connectedAccountId"),
              platform: args.platform,
              name: args.name,
            }
          : { sourceKind, platform: args.platform, identifier: args.identifier, name: args.name };
      return apiFetch(ctx, "/personaforge/personas", { method: "POST", body: JSON.stringify(body) });
    },
  }),

  defineTool({
    name: "get_persona_job_status",
    category: "personas",
    description: "Check a persona extraction job started by create_persona: its status, the new persona's id once done, or the error.",
    scopes: ["personas:read"],
    annotations: { title: "Get persona job status", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["job_id"],
      properties: { job_id: { type: "string", description: "Job id — from create_persona." } },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/personaforge/personas/status/${encodeURIComponent(requireString(args, "job_id", "jobId"))}`),
  }),

  defineTool({
    name: "rename_persona",
    category: "personas",
    description: "Rename a persona. Its learned voice is unchanged.",
    scopes: ["personas:write"],
    annotations: { title: "Rename persona", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["persona_id", "name"],
      properties: {
        persona_id: { type: "string", description: "Persona UUID — from list_personas." },
        name: { type: "string", description: "New name (1–60 characters)." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/personaforge/personas/${personaId(args)}`, {
        method: "PATCH",
        body: JSON.stringify({ name: args.name }),
      }),
  }),

  defineTool({
    name: "delete_persona",
    category: "personas",
    description: "Permanently delete a persona and its learned voice. Recreating it means re-running create_persona. Confirm with the user first.",
    scopes: ["personas:write"],
    annotations: { title: "Delete persona", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["persona_id"],
      properties: { persona_id: { type: "string", description: "Persona UUID — from list_personas." } },
    },
    handler: (ctx, args) => apiFetch(ctx, `/personaforge/personas/${personaId(args)}`, { method: "DELETE" }),
  }),

  defineTool({
    name: "generate_persona_post",
    category: "personas",
    description:
      "Write a post about a topic in a persona's voice (or the user's own trained voice when no persona is given), with a voice-match score. The post is saved for review, not scheduled. Counts against the monthly PersonaForge post allowance.",
    scopes: ["generate:write"],
    annotations: { title: "Write post in persona voice", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["topic", "platform"],
      properties: {
        topic: { type: "string", description: "What the post is about (1–500 characters)." },
        platform: { type: "string", description: "Platform to write for, e.g. linkedin or twitter." },
        persona_id: {
          type: "string",
          description: "Persona UUID — from list_personas. Omit to use the user's own trained voice.",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/personaforge/generate", {
        method: "POST",
        body: JSON.stringify({
          topic: args.topic,
          platform: args.platform,
          personaId: arg(args, "persona_id", "personaId"),
        }),
      }),
  }),

  defineTool({
    name: "list_persona_replies",
    category: "personas",
    description: "List AI-drafted replies to inbound comments and messages, by status (default pending — the ones waiting for review).",
    scopes: ["personas:read"],
    annotations: { title: "List persona replies", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "approved", "edited", "posted", "skipped"],
          description: "Which replies to list (default pending).",
        },
      },
    },
    handler: (ctx, args) => apiFetch(ctx, `/personaforge/replies${buildQuery({ status: args.status })}`),
  }),

  defineTool({
    name: "generate_persona_reply",
    category: "personas",
    description:
      "Draft a reply, in the user's trained voice, to an inbound comment or message on one of their posts. The draft is saved as pending for review (list_persona_replies) — nothing is sent. Needs a plan with PersonaForge replies.",
    scopes: ["personas:write"],
    annotations: { title: "Draft persona reply", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["platform", "source_post_id", "source_post_text", "inbound_text"],
      properties: {
        platform: { type: "string", description: "Platform the conversation is on." },
        source_post_id: { type: "string", description: "Platform id of the user's post being replied under." },
        source_post_text: { type: "string", description: "Text of that post (max 1000 characters)." },
        inbound_text: { type: "string", description: "The comment or message to reply to (max 2000 characters)." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/personaforge/replies", {
        method: "POST",
        body: JSON.stringify({
          platform: args.platform,
          sourcePostId: arg(args, "source_post_id", "sourcePostId"),
          sourcePostText: arg(args, "source_post_text", "sourcePostText"),
          inboundText: arg(args, "inbound_text", "inboundText"),
        }),
      }),
  }),

  defineTool({
    name: "review_persona_reply",
    category: "personas",
    description:
      "Approve, edit or reject one pending AI-drafted reply. Approving or editing adds the final text to the draft queue (list_drafts) — it is not posted. Reject marks it skipped. Act only on the user's decision.",
    scopes: ["personas:write"],
    annotations: { title: "Review persona reply", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      required: ["reply_id", "action"],
      properties: {
        reply_id: { type: "string", description: "Reply UUID — from list_persona_replies." },
        action: { type: "string", enum: ["approve", "edit", "reject"], description: "Decision." },
        edited_text: { type: "string", description: "Required for action=edit: the corrected reply (max 2000 characters)." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/personaforge/replies/approve", {
        method: "POST",
        body: JSON.stringify({
          replyId: arg(args, "reply_id", "replyId"),
          action: args.action,
          editedText: arg(args, "edited_text", "editedText"),
        }),
      }),
  }),
  defineTool({
    name: "get_voice_model",
    category: "personas",
    description:
      "Get the user's own trained voice model — tone breakdown, signature phrases, emoji patterns, average post length, preferred hooks, hashtag style and how many posts it learned from. `model` is null until train_voice_model has run.",
    scopes: ["personas:read"],
    annotations: { title: "Get voice model", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/personaforge/voice"),
  }),
  defineTool({
    name: "train_voice_model",
    category: "personas",
    description:
      "Train (or retrain) the user's own voice model from their last 50 published posts. Replaces the existing voice model. Uses one AI text action from the plan's quota and fails with a clear message when the user has no published posts yet. Confirm with the user before retraining.",
    scopes: ["personas:write"],
    annotations: { title: "Train voice model", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/personaforge/voice", { method: "POST" }),
  }),
  defineTool({
    name: "generate_bio_variants",
    category: "personas",
    description:
      "Generate two profile-bio variants for one platform in the user's trained voice — A authority-focused, B curiosity-focused — and save them as a bio A/B test. Optionally pass the current bio to improve on. Uses one AI text action. Nothing is changed on the platform itself.",
    scopes: ["generate:write"],
    annotations: { title: "Generate bio variants", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["platform"],
      properties: {
        platform: { type: "string", minLength: 1, description: "Platform the bio is for, e.g. twitter or linkedin." },
        current_bio: { type: "string", maxLength: 500, description: "The bio the user has now, to improve on." },
      },
    },
    handler: (ctx, args) => {
      const body: Record<string, unknown> = { platform: requireString(args, "platform") };
      const currentBio = arg(args, "current_bio", "currentBio");
      if (currentBio !== undefined) body.currentBio = currentBio;
      return apiFetch(ctx, "/personaforge/bio", { method: "POST", body: JSON.stringify(body) });
    },
  }),
  defineTool({
    name: "list_competitor_personas",
    category: "personas",
    description:
      "List the competitor accounts the user has analysed, newest first, with posting frequency, content pillars, gaps, average engagement and best posting time.",
    scopes: ["personas:read"],
    annotations: { title: "List competitor analyses", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {} },
    handler: (ctx) => apiFetch(ctx, "/personaforge/competitors"),
  }),
  defineTool({
    name: "analyze_competitor",
    category: "personas",
    description:
      "Analyse a competitor's public X (Twitter) or LinkedIn account — posting frequency, content pillars, gaps, engagement and best posting time — and save it (re-analysing the same handle updates it). Needs a plan that includes competitor analysis; otherwise it returns an upgrade message.",
    scopes: ["personas:write"],
    annotations: { title: "Analyse competitor", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["handle", "platform"],
      properties: {
        handle: { type: "string", minLength: 1, description: "The competitor's handle on that platform." },
        platform: { type: "string", enum: ["twitter", "linkedin"], description: "Platform the handle is on." },
        display_name: { type: "string", description: "Name to show for this competitor." },
        niche: { type: "string", description: "The competitor's niche, for context." },
      },
    },
    handler: (ctx, args) => {
      const body: Record<string, unknown> = {
        handle: requireString(args, "handle"),
        platform: requireString(args, "platform"),
      };
      const displayName = arg(args, "display_name", "displayName");
      if (displayName !== undefined) body.displayName = displayName;
      const niche = arg(args, "niche");
      if (niche !== undefined) body.niche = niche;
      return apiFetch(ctx, "/personaforge/competitors", { method: "POST", body: JSON.stringify(body) });
    },
  }),
];
