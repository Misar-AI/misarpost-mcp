/**
 * Platform enums, copied from the zod schemas of the MisarPost routes that
 * validate them. Advertising a value the route's schema rejects turns a
 * plausible agent call into a 400, so each list is tied to its route.
 */

/** MisarPost `src/app/api/schedule/route.ts` — `Schema.platform`. */
export const SCHEDULE_PLATFORMS = [
  "twitter", "linkedin", "instagram", "threads", "tiktok", "bluesky",
  "mastodon", "youtube", "reddit", "pinterest", "dribbble",
  "slack", "discord", "facebook", "telegram", "devto", "farcaster",
  "gmb", "hashnode", "lemmy", "listmonk", "medium", "mewe",
  "moltbook", "nostr", "skool", "tumblr", "twitch", "vk",
  "linkedin_page", "instagram_standalone", "tiktok_business", "whop", "wordpress", "kick",
] as const;

/** MisarPost `src/app/api/generate/route.ts` — `Schema.platforms`. */
export const GENERATE_PLATFORMS = [
  "twitter", "linkedin", "instagram", "threads", "tiktok", "bluesky", "youtube",
] as const;

/** MisarPost `src/app/api/generate/{enhance,plan}/route.ts` — `Schema.platforms`. */
export const BRIEF_PLATFORMS = [
  "twitter", "linkedin", "instagram", "threads", "tiktok", "bluesky",
] as const;

/** MisarPost `src/lib/repurpose-engine.ts` — `ALL_PLATFORMS`, used by POST /contentripple. */
export const REPURPOSE_FORMATS = [
  "twitter_thread",
  "linkedin_post",
  "linkedin_carousel",
  "instagram_caption",
  "instagram_reel_script",
  "email_newsletter",
  "youtube_description",
  "slack_announcement",
  "reddit_post",
  "notion_page",
  "threads_post",
  "mastodon_post",
  "bluesky_post",
] as const;

/**
 * ContentRipple formats `/contentripple/schedule` can auto-publish (its
 * PLATFORM_MAP). Every other format is copy-only.
 */
export const SCHEDULABLE_REPURPOSE_FORMATS = [
  "twitter_thread", "linkedin_post", "linkedin_carousel", "instagram_caption",
  "instagram_reel_script", "threads_post", "mastodon_post", "bluesky_post",
] as const;

/** MisarPost `src/lib/tags/colors.ts` — `POST_TAG_COLOR_IDS`. */
export const TAG_COLORS = [
  "red", "orange", "amber", "green", "teal", "blue", "indigo", "purple", "pink", "slate",
] as const;

/** MisarPost `src/lib/webhooks/outbound-events.ts` — `OUTBOUND_WEBHOOK_EVENTS`. */
export const WEBHOOK_EVENTS = ["post.published", "post.failed", "account.disconnected"] as const;

/** MisarPost `src/lib/personaforge/persona-extraction.ts`. */
export const PERSONA_ACCOUNT_PLATFORMS = ["instagram", "twitter", "youtube"] as const;
export const PERSONA_PROFILE_PLATFORMS = ["youtube", "medium", "mastodon", "bluesky"] as const;

/** MisarPost `src/app/api/posts/route.ts` — the `status` filter values. */
export const POST_STATUSES = [
  "pending", "queued", "publishing", "published", "failed", "rejected", "cancelled", "archived",
] as const;

/** Targets of TrendPulse per-platform content (MisarPost `ALL_TREND_TARGET_PLATFORMS`). */
export const TREND_TARGET_PLATFORMS = [
  "twitter",
  "linkedin",
  "instagram",
  "mastodon",
  "bluesky",
  "youtube",
  "medium",
];
