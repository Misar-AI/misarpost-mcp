/**
 * Reusable prompt templates exposed over MCP `prompts/list` / `prompts/get`.
 *
 * TEMPLATES executed by the calling client's model — never server-side
 * completions, which would spend credits on text the client cannot steer and
 * cannot run on stdio at all. They must be listable WITHOUT credentials, and
 * every tool named in a body must be a canonical name from the registry
 * (enforced by tests/unit/registry.test.ts).
 */

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];
  build: (args: Record<string, string>) => string;
}

export const PROMPTS: PromptDefinition[] = [
  {
    name: "plan_content_week",
    description: "Plan a week of posts grounded in past performance and what is already scheduled.",
    arguments: [
      { name: "theme", description: "Theme or campaign for the week", required: false },
      { name: "channels", description: "Which channels to post to", required: false },
    ],
    build: (a) =>
      `Plan a week of posts${a.theme ? ` around: ${a.theme}` : ""}` +
      `${a.channels ? `, for these channels: ${a.channels}` : ""}.\n\n` +
      "1. Call list_connections — only plan for accounts that are connected and active.\n" +
      "2. Call get_calendar for the week to see what is already scheduled (if it returns an upgrade message, use list_posts with status=queued instead); do not double-book a slot.\n" +
      "3. Call get_stats and get_analytics_trends to see which channels and days have performed.\n" +
      "4. Call enhance_topic on the theme, then generate_plan for hooks and time slots.\n" +
      "5. Draft the plan as a table: day, time, account, post idea. Use generate_posts for copy if I ask.\n\n" +
      "Show me the full plan and wait for my approval. Only then call schedule_post, once per post — " +
      "scheduling puts content in front of a real audience.",
  },
  {
    name: "repurpose_a_post",
    description: "Turn one piece of content into channel-native variants and schedule the approved ones.",
    arguments: [
      { name: "source", description: "A URL, or the content itself", required: true },
    ],
    build: (a) =>
      `Repurpose this for my connected channels: ${a.source || "(ask me for the source)"}\n\n` +
      "1. Call list_connections to see which channels to target.\n" +
      "2. Call get_contentripple_usage to confirm there is allowance left this month.\n" +
      "3. Call repurpose_content, choosing only the formats that match my connected channels.\n" +
      "4. Show me every variant. Each must read as native to its channel — not the same text with different hashtags.\n\n" +
      "Apply my edits with update_content_variant. Only after I approve the final text, account and time, call " +
      "schedule_content_variant for each publishable variant (or schedule_post for copy-only formats I adapt).",
  },
  {
    name: "performance_review",
    description: "Report what performed, what did not, and the single most useful change.",
    arguments: [{ name: "days", description: "7, 30 or 90 (default 30)", required: false }],
    build: (a) =>
      `Review my post performance for the last ${a.days || "30"} days.\n\n` +
      "Call get_stats and get_analytics_trends for that window, and list_posts with status=published for context.\n\n" +
      "Report the best and worst performing channel and post with a one-line reason each, then the single " +
      "highest-impact change for next period. Channels whose trend metric is posts have no engagement data — " +
      "say so instead of reporting zero engagement. Keep it under 400 words and say plainly when a figure was " +
      "unavailable rather than estimating.",
  },
  {
    name: "draft_queue_triage",
    description: "Review waiting drafts and decide what to schedule, edit or drop.",
    arguments: [],
    build: () =>
      "Triage my draft queue.\n\n" +
      "1. Call list_drafts.\n" +
      "2. Call list_posts with status=queued to see where drafts could slot in.\n\n" +
      "For each draft recommend schedule, edit or drop, with a reason. After I confirm, call review_drafts " +
      "to approve or reject them, and schedule_post only for the drafts I want published, at the times I approve.",
  },
  {
    name: "cross_post",
    description: "Publish one message to several connected accounts, adapted per platform, after approval.",
    arguments: [
      { name: "message", description: "What to announce", required: true },
      { name: "when", description: "\"now\" or a date and time", required: false },
    ],
    build: (a) =>
      `Cross-post this: ${a.message || "(ask me for the message)"}\n` +
      `Timing: ${a.when || "ask me"}\n\n` +
      "1. Call list_connections and ask me which accounts to use.\n" +
      "2. Adapt the text to each platform's length and conventions.\n" +
      "3. Where a platform needs a destination (a subreddit, board, channel or publication), call list_publish_options for it.\n" +
      "4. Show me every version with its account and time, and wait for my explicit approval.\n\n" +
      "Then call schedule_post once per account, sharing one batch id across the calls, and report which ones " +
      "succeeded and which failed — never claim a post was scheduled unless the call confirmed it.",
  },
  {
    name: "trend_response",
    description: "Find a trend worth responding to and draft credible posts about it.",
    arguments: [{ name: "topic", description: "Area to look for trends in", required: false }],
    build: (a) =>
      `Find trends worth responding to${a.topic ? ` in ${a.topic}` : ""}.\n\n` +
      "1. Call get_trends.\n" +
      "2. Call research_hashtags for the ones that fit my account.\n" +
      "3. Call enhance_topic to sharpen the angle.\n\n" +
      "Only recommend trends my account can speak to credibly — say so plainly when a trend is popular but " +
      "off-brand. For the ones I pick, call queue_trend_drafts so I can review the drafts; never schedule them " +
      "without my approval.",
  },
  {
    name: "reply_queue_review",
    description: "Review AI-drafted replies to comments and decide which to approve, edit or skip.",
    arguments: [],
    build: () =>
      "Review my pending replies.\n\n" +
      "1. Call list_persona_replies.\n" +
      "2. For each, show the inbound message, the drafted reply and its voice-match score, and recommend approve, " +
      "edit (with your suggested wording) or reject.\n\n" +
      "Call review_persona_reply only with the decision I give for each one. Approved replies go to my draft " +
      "queue — they are not posted.",
  },
  {
    name: "growth_opportunities",
    description: "Find what to post next from Growth Hub signals (Empire plan).",
    arguments: [],
    build: () =>
      "Find my best growth opportunities right now.\n\n" +
      "1. Call list_growth_opportunities for rising trends on my connected platforms.\n" +
      "2. Call get_growth_overview to see which platforms and formats are underperforming.\n" +
      "3. Call list_growth_playbooks for each platform's official cadence and format guidance.\n\n" +
      "Recommend at most three posts, each tied to a real signal from those results. If they return an upgrade " +
      "message or no signal, say so plainly — do not invent trends.",
  },
];

const BY_NAME = new Map(PROMPTS.map((p) => [p.name, p]));

export function listPrompts() {
  return PROMPTS.map(({ name, description, arguments: args }) => ({
    name,
    description,
    arguments: args,
  }));
}

export function getPrompt(name: string, args: Record<string, string> = {}) {
  const prompt = BY_NAME.get(name);
  if (!prompt) return null;
  return {
    description: prompt.description,
    messages: [{ role: "user" as const, content: { type: "text" as const, text: prompt.build(args) } }],
  };
}
