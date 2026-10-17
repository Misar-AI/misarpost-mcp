import { apiFetch, buildQuery } from "../lib/api-client.js";
import { arg, defineTool, requireString, type ToolDefinition } from "../lib/types.js";
import { BRIEF_PLATFORMS, GENERATE_PLATFORMS } from "./platforms.js";

/**
 * AI writing helpers. Every route is metered (the plan's monthly AI allowance)
 * and declares `generate:write`:
 *   POST /generate            src/app/api/generate/route.ts
 *   POST /generate/enhance    src/app/api/generate/enhance/route.ts
 *   POST /generate/plan       src/app/api/generate/plan/route.ts
 *   POST /generate/hashtags   src/app/api/generate/hashtags/route.ts
 *   GET  /generate/optimize   src/app/api/generate/optimize/route.ts
 *   POST /generate/image      src/app/api/generate/image/route.ts
 *
 * They change nothing the user can see except generate_posts, which saves
 * drafts — but each call spends allowance, so none is marked read-only.
 */
export const generateTools: ToolDefinition[] = [
  defineTool({
    name: "generate_posts",
    category: "ai",
    scopes: ["generate:write"],
    description:
      "Write AI post variants about a topic for one or more platforms — up to 5 per platform — and save them as drafts (visible in list_drafts). Nothing is scheduled or published. Each call counts against the plan's monthly AI generation allowance.",
    annotations: {
      title: "Generate post drafts",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      required: ["topic", "platforms"],
      properties: {
        topic: { type: "string", description: "Topic or brief for the posts (3–500 characters)." },
        platforms: {
          type: "array",
          items: { type: "string", enum: [...GENERATE_PLATFORMS] },
          minItems: 1,
          description: "Platforms to write for (at least one).",
        },
        tone: {
          type: "string",
          enum: ["professional", "casual", "technical", "inspirational"],
          description: "Writing tone (default professional).",
        },
        count: { type: "number", description: "Variants per platform, 1–5 (default 3)." },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/generate", {
        method: "POST",
        body: JSON.stringify({
          topic: args.topic,
          platforms: args.platforms,
          tone: args.tone,
          count: args.count,
        }),
      }),
  }),

  defineTool({
    name: "enhance_topic",
    category: "ai",
    description:
      "Rewrite a raw topic or idea into a structured content brief: a sharper topic, suggested tone, content angles and key messages for the chosen platforms. Saves nothing; counts against the monthly AI allowance. Feed the result to generate_plan or generate_posts.",
    scopes: ["generate:write"],
    annotations: {
      title: "Enhance topic into brief",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      required: ["raw_topic", "platforms"],
      properties: {
        raw_topic: { type: "string", description: "Raw topic or idea (3–500 characters)." },
        goal: {
          type: "string",
          enum: ["awareness", "engagement", "conversion", "viral"],
          description: "Content goal (default engagement).",
        },
        audience: { type: "string", description: "Target audience, up to 200 characters." },
        platforms: {
          type: "array",
          items: { type: "string", enum: [...BRIEF_PLATFORMS] },
          minItems: 1,
          description: "Target platforms (at least one).",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/generate/enhance", {
        method: "POST",
        body: JSON.stringify({
          rawTopic: arg(args, "raw_topic", "rawTopic"),
          goal: args.goal,
          audience: args.audience,
          platforms: args.platforms,
        }),
      }),
  }),

  defineTool({
    name: "generate_plan",
    category: "ai",
    description:
      "For a topic or brief, suggest hook options, the best posting time slots, and trending hashtags per platform. Saves nothing and schedules nothing; counts against the monthly AI allowance.",
    scopes: ["generate:write"],
    annotations: {
      title: "Generate posting plan",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      required: ["enhanced_topic", "platforms"],
      properties: {
        enhanced_topic: {
          type: "string",
          description: "Topic or content brief (3–1000 characters), e.g. from enhance_topic.",
        },
        platforms: {
          type: "array",
          items: { type: "string", enum: [...BRIEF_PLATFORMS] },
          minItems: 1,
          description: "Target platforms (at least one).",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/generate/plan", {
        method: "POST",
        body: JSON.stringify({
          enhancedTopic: arg(args, "enhanced_topic", "enhancedTopic"),
          platforms: args.platforms,
        }),
      }),
  }),

  defineTool({
    name: "research_hashtags",
    category: "ai",
    description:
      "Build a tiered hashtag strategy for a keyword across platforms — broad, mid and niche tags plus each platform's algorithm signals. Saves nothing; counts against the monthly AI allowance.",
    scopes: ["generate:write"],
    annotations: {
      title: "Research hashtags",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      required: ["keyword", "platforms"],
      properties: {
        keyword: { type: "string", description: "Primary keyword or topic (2–200 characters)." },
        niche: { type: "string", description: "Content niche, up to 100 characters." },
        platforms: {
          type: "array",
          items: { type: "string", enum: [...GENERATE_PLATFORMS] },
          minItems: 1,
          maxItems: 7,
          description: "Target platforms (at least one).",
        },
        goal: {
          type: "string",
          enum: ["awareness", "engagement", "conversion", "viral"],
          description: "Strategy goal (default awareness).",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, "/generate/hashtags", {
        method: "POST",
        body: JSON.stringify({
          keyword: args.keyword,
          niche: args.niche,
          platforms: args.platforms,
          goal: args.goal,
        }),
      }),
  }),

  defineTool({
    name: "get_optimization_insights",
    category: "ai",
    description:
      "Analyse the last 30 days of post metrics with AI and return the best time of day, best tone, top hashtags, prompt suggestions and per-platform insights. Changes nothing, but each call counts against the monthly AI allowance.",
    scopes: ["generate:write"],
    annotations: {
      title: "Get optimization insights",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: [...GENERATE_PLATFORMS],
          description: "Only this platform's posts. Omit for all platforms.",
        },
      },
    },
    handler: (ctx, args) =>
      apiFetch(ctx, `/generate/optimize${buildQuery({ platform: args.platform })}`),
  }),
  defineTool({
    name: "generate_image",
    category: "ai",
    description:
      "Generate an image for a post from a text prompt, sized for the platform (16:9 for X, LinkedIn and YouTube, square for Instagram and Threads, 9:16 for TikTok), and store it in the user's media. Returns its URL to attach to a post. Uses one AI image action from the plan's quota. Nothing is posted.",
    scopes: ["generate:write"],
    annotations: { title: "Generate post image", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", minLength: 10, maxLength: 1000, description: "What the image should show." },
        platform: {
          type: "string",
          enum: ["twitter", "linkedin", "instagram", "threads", "tiktok", "youtube"],
          description: "Platform to size it for (default twitter).",
        },
      },
    },
    handler: (ctx, args) => {
      const body: Record<string, unknown> = { prompt: requireString(args, "prompt") };
      const platform = arg(args, "platform");
      if (platform !== undefined) body.platform = platform;
      return apiFetch(ctx, "/generate/image", { method: "POST", body: JSON.stringify(body) });
    },
  }),
];
