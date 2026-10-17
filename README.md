# MisarPost MCP Server

> Plan, generate, schedule and repurpose posts across every connected channel, and track what performs — from any AI assistant.

[![npm](https://img.shields.io/npm/v/@misarpost/mcp)](https://www.npmjs.com/package/@misarpost/mcp)
[![smithery](https://img.shields.io/badge/smithery-misar%2Fmisarpost--mcp-blue)](https://smithery.ai/server/misar/misarpost-mcp)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

**85 tools · 8 prompts · 6 resources · 8 agent skills**

Works with Claude (Desktop, Code, and web), Cursor, VS Code, Windsurf, Cline,
Zed, Gemini CLI, ChatGPT, and any other MCP-compatible client — over stdio or
Streamable HTTP.

---

## Install

### Smithery (recommended)

```bash
npx -y @smithery/cli install misar/misarpost-mcp --client claude
```

### Claude Code

```bash
claude mcp add misarpost -- npx -y @misarpost/mcp@latest
```

### Manual (any client)

```json
{
  "mcpServers": {
    "misarpost": {
      "command": "npx",
      "args": ["-y", "@misarpost/mcp@latest"],
      "env": { "MISARPOST_API_KEY": "mpk_your_key_here" }
    }
  }
}
```

Ready-made configs for every client live in [`connectors/`](./connectors).

### Remote (no install)

```json
{
  "mcpServers": {
    "misarpost": {
      "type": "streamable-http",
      "url": "https://api.misar.io/post/mcp",
      "headers": { "Authorization": "Bearer mpk_your_key_here" }
    }
  }
}
```

---

## Authentication

Create an API key at https://post.misar.io/dashboard/api-keys (Dashboard → API keys) — it starts with
`mpk_` — and give it to the server in one of three ways: the
`MISARPOST_API_KEY` environment variable, your MCP client's `env` block, or
`{ "api_key": "mpk_…" }` in `~/.misarpost/config.json`.

Self-hosted instances: set `MISARPOST_BASE_URL`.

---

## Tools

| Tool | Description |
| --- | --- |
| `list_connections` | List the user's active connected social accounts with their account ID, platform and display name. |
| `list_publish_options` | Look up the destinations a connected account can publish into — Discord or Slack channels, Pinterest boards, Reddit post flairs, Hashnode or Medium publications, Hashnode tags, Lemmy communities, Listmonk lists or templates, Skool groups, Whop forums, or WordPress categories and tags. |
| `list_account_plugs` | Show the plugs (automatic follow-up actions — e.g. |
| `configure_account_plug` | Turn a plug on or off for one connected account and set its configuration, replacing the plug's previous configuration. |
| `list_posts` | List the user's scheduled and published posts, newest-scheduled first, 20 per page, with platform, status, scheduled/published time, post URL, tags and engagement metrics. |
| `schedule_post` | Schedule a post to ONE connected account at a given time, or publish it immediately with scheduled_at="now". |
| `cancel_post` | Cancel a post that is still pending or queued, so it never publishes. |
| `get_calendar` | Get every post scheduled between two dates (default: 7 days ago to 30 days ahead), oldest first, with platform, status, time, text, media, first comment and tags — the content calendar view. |
| `update_post` | Edit a post that has not gone out yet (status pending, queued or draft): its text, its scheduled time, its first comment, or its tags. |
| `reply_to_post` | Post a public reply/comment on one of the user's ALREADY-PUBLISHED posts, on the platform it was published to. |
| `revert_post` | Delete an ALREADY-PUBLISHED post from the platform it went out on (unlike cancel_post, which only stops a post that has not published yet). |
| `revert_post_batch` | "Delete everywhere": delete every published post from one batch (one compose or repurpose action sent to several accounts) from all of its platforms. |
| `share_post` | Create (or return the existing) public preview link for one of the user's posts. |
| `unshare_post` | Revoke a post's public preview link, so the old link stops working. |
| `list_drafts` | List up to 50 draft post variants awaiting review (status draft or pending_review), newest first — including AI-generated drafts from generate_posts — with platform, caption, hashtags, tone and source.. |
| `review_drafts` | Approve or reject several drafts at once by ID. |
| `get_stats` | Get the account overview: connected accounts, posts queued, published this week and this month, drafts waiting, the last published post, the top performing post of the month, and the average engagement rate (null when no metrics exist yet).. |
| `get_analytics_trends` | Get per-channel daily trends for the last 7, 30 or 90 days: posts published and failed, engagement and impressions, totals, and the change against the previous period. |
| `get_growth_overview` | Get the Growth Hub overview for the last 7, 30 or 90 days: per-platform engagement trend lines, the weakest-performing platforms (bottlenecks), which post formats perform best, and which platforms have real trend data behind their suggestions. |
| `list_growth_opportunities` | List rising trends worth posting about now, limited to the user's niches and to platforms they have connected, each with the hashtag, its growth, and a posting suggestion. |
| `list_growth_playbooks` | Get per-platform growth playbooks for the user's connected platforms — cadence, format, timing and anti-spam guidance compiled from each platform's official creator documentation, with source links. |
| `get_next_growth_opportunity` | Get the single best next content opportunity for the user's connected platforms and niches — a compact version of list_growth_opportunities. |
| `get_contentripple_usage` | Show how many ContentRipple repurposes the user has run this month, their monthly limit (null means unlimited), and their plan tier. |
| `repurpose_content` | Turn one source — a URL, pasted text or markdown, or an RSS item — into channel-native variants such as an X thread, LinkedIn post or carousel, Instagram caption or reel script, newsletter, or YouTube description. |
| `update_content_variant` | Edit a saved ContentRipple variant's text (which marks it edited) and/or set its status. |
| `schedule_content_variant` | Schedule a saved ContentRipple variant (its text plus hashtags) to a connected account of the matching platform at a given time. |
| `fetch_content_feed` | Read an RSS or Atom feed and return its entries, so the user can pick one to repurpose with repurpose_content (source_type rss). |
| `parse_content_source` | Extract the core message, key points and structure from a URL, pasted text (50-20,000 characters) or Markdown, without generating any variants — a preview of what repurpose_content would work from. |
| `list_repurpose_history` | List past ContentRipple repurposes, newest first: each source (type, URL, title, core message) with its variants and, for variants that were scheduled, the post's status, URL and engagement.. |
| `delete_repurpose_source` | Delete one repurposed source and its variants from ContentRipple history. |
| `generate_posts` | Write AI post variants about a topic for one or more platforms — up to 5 per platform — and save them as drafts (visible in list_drafts). |
| `enhance_topic` | Rewrite a raw topic or idea into a structured content brief: a sharper topic, suggested tone, content angles and key messages for the chosen platforms. |
| `generate_plan` | For a topic or brief, suggest hook options, the best posting time slots, and trending hashtags per platform. |
| `research_hashtags` | Build a tiered hashtag strategy for a keyword across platforms — broad, mid and niche tags plus each platform's algorithm signals. |
| `get_optimization_insights` | Analyse the last 30 days of post metrics with AI and return the best time of day, best tone, top hashtags, prompt suggestions and per-platform insights. |
| `generate_image` | Generate an image for a post from a text prompt, sized for the platform (16:9 for X, LinkedIn and YouTube, square for Instagram and Threads, 9:16 for TikTok), and store it in the user's media. |
| `get_trends` | Get the latest trending hashtags and content hooks for the user's TrendPulse niches, each with a snapshot id. |
| `queue_trend_drafts` | Turn 1–3 trend snapshots (from get_trends) into draft posts — one per snapshot for each platform the user has connected — saved to the draft queue (list_drafts). |
| `schedule_trend_posts` | Publish posts about 1–3 trend snapshots to the given connected accounts, scheduled five minutes from now — one post per content hook per account, written from the trend's hooks. |
| `refresh_trends` | Force a fresh fetch of trending hashtags from every trend source for the user's niches and store new snapshots, instead of waiting for the scheduled refresh. |
| `send_trend_digest` | Email the user their trend digest (top recent trends for their niches) now. |
| `get_trend_hooks` | Get the content hooks (opening lines and angles) for one trend snapshot — snapshot ids come from get_trends.. |
| `get_trend_platform_content` | Get the per-platform content already generated for one trend snapshot — hashtags, plus title/description for YouTube and title/subtitle for Medium. |
| `generate_trend_platform_content` | Generate per-platform content (hashtags, and titles where a platform needs them) for one trend snapshot, for the platforms asked (default: all seven). |
| `use_trend_platform_content` | Turn one platform's generated trend content into a draft post (generating it first if needed). |
| `get_trend_performance` | Show how the user's trend-sourced posts actually performed: each TrendPulse draft (last 100) joined to whether it was scheduled or published and its likes, comments, reposts, impressions and reach.. |
| `list_post_templates` | List the user's saved post templates, most recently updated first — reusable composer states with text, per-platform overrides, target accounts, platform settings, media and first comment.. |
| `get_post_template` | Get one saved post template in full, by id — to reuse its text, accounts and settings in schedule_post.. |
| `create_post_template` | Save a reusable post template: default text, optional per-platform text, target accounts, platform settings, media and first comment. |
| `update_post_template` | Change a saved post template. |
| `delete_post_template` | Permanently delete a saved post template. |
| `list_post_tags` | List the user's post tags (id, name, colour). |
| `create_post_tag` | Create a post tag with a name and colour, for grouping posts by campaign or theme. |
| `update_post_tag` | Rename and/or recolour a post tag. |
| `delete_post_tag` | Permanently delete a post tag and remove it from every post that carries it. |
| `list_media` | List the user's uploaded media library, newest first, 24 per page, with each file's public URL — usable directly in schedule_post's media_urls.. |
| `delete_media` | Permanently delete a file from the media library and storage. |
| `list_video_avatars` | List the stock presenter avatars available for AI video generation. |
| `list_video_voices` | List the stock voices available for AI video generation. |
| `create_video_script` | Write a short talking-presenter video script from a post's text. |
| `generate_video` | Start rendering an AI presenter video from a script, avatar and voice. |
| `get_video_status` | Check an AI video job: processing, failed (with the error), or completed with the video's URL in the media storage — ready for schedule_post's media_urls.. |
| `list_personas` | List the user's PersonaForge personas — writing styles learned from a real account — plus extraction jobs still running and recent failures.. |
| `get_persona` | Get one persona in full: its name, cover image, source account, and the style profile used when writing in it.. |
| `create_persona` | Start learning a writing persona from recent posts — either a connected account (instagram, twitter, youtube) or a public profile (youtube, medium, mastodon, bluesky). |
| `get_persona_job_status` | Check a persona extraction job started by create_persona: its status, the new persona's id once done, or the error.. |
| `rename_persona` | Rename a persona. |
| `delete_persona` | Permanently delete a persona and its learned voice. |
| `generate_persona_post` | Write a post about a topic in a persona's voice (or the user's own trained voice when no persona is given), with a voice-match score. |
| `list_persona_replies` | List AI-drafted replies to inbound comments and messages, by status (default pending — the ones waiting for review).. |
| `generate_persona_reply` | Draft a reply, in the user's trained voice, to an inbound comment or message on one of their posts. |
| `review_persona_reply` | Approve, edit or reject one pending AI-drafted reply. |
| `get_voice_model` | Get the user's own trained voice model — tone breakdown, signature phrases, emoji patterns, average post length, preferred hooks, hashtag style and how many posts it learned from. |
| `train_voice_model` | Train (or retrain) the user's own voice model from their last 50 published posts. |
| `generate_bio_variants` | Generate two profile-bio variants for one platform in the user's trained voice — A authority-focused, B curiosity-focused — and save them as a bio A/B test. |
| `list_competitor_personas` | List the competitor accounts the user has analysed, newest first, with posting frequency, content pillars, gaps, average engagement and best posting time.. |
| `analyze_competitor` | Analyse a competitor's public X (Twitter) or LinkedIn account — posting frequency, content pillars, gaps, engagement and best posting time — and save it (re-analysing the same handle updates it). |
| `list_notifications` | List the user's MisarPost notifications (publish results, account problems and the like), newest first, with the unread count.. |
| `mark_notification_read` | Mark one notification as read, e.g. |
| `mark_all_notifications_read` | Mark every unread notification as read. |
| `list_webhooks` | List the user's outbound webhooks — the URLs MisarPost sends signed event payloads to — with their events and whether each is active. |
| `create_webhook` | Register an outbound webhook: MisarPost will POST signed payloads for the chosen events to this URL from now on. |
| `update_webhook` | Change an outbound webhook's URL or events, or pause/resume it with active. |
| `delete_webhook` | Permanently remove an outbound webhook; events stop being delivered to its URL. |
| `list_workspaces` | List the workspaces the user belongs to. |

## Prompts

Reusable workflows your client exposes as slash-commands.

| Prompt | Description |
| --- | --- |
| `plan_content_week` | Plan a week of posts grounded in past performance and what is already scheduled. |
| `repurpose_a_post` | Turn one piece of content into channel-native variants and schedule the approved ones. |
| `performance_review` | Report what performed, what did not, and the single most useful change. |
| `draft_queue_triage` | Review waiting drafts and decide what to schedule, edit or drop. |
| `cross_post` | Publish one message to several connected accounts, adapted per platform, after approval. |
| `trend_response` | Find a trend worth responding to and draft credible posts about it. |
| `reply_queue_review` | Review AI-drafted replies to comments and decide which to approve, edit or skip. |
| `growth_opportunities` | Find what to post next from Growth Hub signals (Empire plan). |

## Resources

Read-only context an agent can attach without spending a tool call.

| URI | Description |
| --- | --- |
| `misarpost://connections` | Active connected accounts with their IDs and platforms. |
| `misarpost://queue` | The first page of queued posts — what is already scheduled — so new posts do not collide with it.. |
| `misarpost://drafts` | Drafts awaiting review, so work in progress is resumed rather than restarted.. |
| `misarpost://stats` | Queued, published and draft counts, the top performing post of the month, and the average engagement rate.. |
| `misarpost://tags` | The user's post tags (id, name, colour), for tagging and filtering posts.. |
| `misarpost://templates` | Saved post templates — reusable text, target accounts and platform settings.. |

## Agent skills

Bundled in [`skills/`](./skills) — guidance an agent loads when a task matches.

| Skill | Use when |
| --- | --- |
| `find-growth-opportunities` | Find what to post next from MisarPost Growth Hub signals — rising trends on the user's connected platforms, underperforming platforms and formats, and each platform's official playbook. Use when asked what to post next, what is trending for me, how to grow an account, or why a platform is underperforming. |
| `plan-and-schedule-content` | Plan a content calendar for the user's connected accounts and schedule it once approved. Use when asked to plan content, fill the calendar, map out a week or month of posts, or decide what to post when in MisarPost. |
| `repurpose-across-channels` | Turn one article, URL, announcement or block of text into channel-native variants with ContentRipple and schedule the approved ones. Use when asked to repurpose, adapt, cross-promote or turn a blog post into social posts in MisarPost. |
| `respond-to-trends` | Find trends the user's account can credibly join and turn the chosen ones into drafts or scheduled posts in MisarPost. Use when asked what is trending, to jump on a trend, to post about something current, or for trending hashtags. |
| `review-persona-replies` | Draft and review replies to comments and messages in the user's own voice with MisarPost PersonaForge, approving only what the user signs off. Use when asked to reply to comments, handle the reply queue, answer DMs in their voice, or review AI-drafted replies. |
| `review-post-performance` | Report what performed, what did not, and the single most useful change, from MisarPost's own post and engagement data. Use when asked about post performance, engagement, reach, stats, what is working, or for a weekly or monthly report. |
| `schedule-and-publish` | Schedule or immediately publish a post to one or more connected accounts in MisarPost, with explicit confirmation, the right platform settings, and an honest report of what went out. Use when asked to post, publish, schedule, cross-post, or cancel a scheduled post. |
| `triage-draft-queue` | Work through MisarPost drafts awaiting review — decide what to schedule, edit or drop — and act only on what the user approves. Use when asked to review drafts, clear the draft queue, or approve or reject generated posts. |

---

## Safety

Destructive and irreversible actions are annotated (`destructiveHint`) so
clients can prompt before running them. The skills instruct agents to confirm
before anything that sends mail, publishes content, or is otherwise visible to
other people.

Discovery (`initialize`, `tools/list`, `prompts/list`, `resources/list`)
never requires credentials, so registries can index the server without one.
Every action does.

---

## Links

- Website — https://www.misarpost.com
- App — https://post.misar.io
- Documentation — https://docs.misar.io/post/mcp
- Smithery — https://smithery.ai/server/misar/misarpost-mcp
- npm — https://www.npmjs.com/package/@misarpost/mcp
- Source — https://github.com/Misar-AI/misarpost-mcp

MIT © [Misar.AI](https://misar.io)
