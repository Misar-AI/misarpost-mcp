---
name: schedule-and-publish
description: Schedule or immediately publish a post to one or more connected accounts in MisarPost, with explicit confirmation, the right platform settings, and an honest report of what went out. Use when asked to post, publish, schedule, cross-post, or cancel a scheduled post.
---

# Schedule and publish

`schedule_post` with `scheduled_at` set to `now` publishes immediately. A
future time can be cancelled with `cancel_post` until it starts publishing.
Once a post is live, the only way back is `revert_post` (or
`revert_post_batch` for every account it went to), which deletes it from the
platform; some platforms have no delete API. Treat publishing and reverting as
external side effects that need explicit approval.

## Steps

1. `list_connections` — get each target account's `id` and `platform`. Never
   guess an account ID; `platform` must match the account.
2. Write the text per platform (length, hashtags, links, tone). For several
   accounts, one call per account — the text may differ per platform. A saved
   template (`list_post_templates`, `get_post_template`) can supply text,
   accounts and platform settings. Media must be public URLs: `list_media`
   lists the user's library, and `get_video_status` returns a finished AI
   video's URL.
3. Platform destinations. Some platforms need a target inside the account,
   passed in `platform_meta`. Look up valid ids with `list_publish_options`:
   - Reddit: `kind` `reddit_flairs` with a `subreddit` → `{ subreddit, flairId }`
   - Pinterest: `pinterest_boards` → `{ board }`
   - Discord / Slack: `discord_channels` / `slack_channels` → `{ channelId }`
   - Hashnode / Medium: `hashnode_publications` / `medium_publications` → `{ publicationId }`
   - Listmonk: `listmonk_lists`, `listmonk_templates` → `{ listId, templateId }`
   - Lemmy, Skool, Whop, WordPress: `lemmy_communities`, `skool_groups`,
     `whop_forums`, `wordpress_taxonomies`

   An empty list can mean the platform could not be reached — say so rather
   than scheduling without a destination.
4. Confirm. Show, for every post: account, platform, exact final text, media,
   first comment, and the time with its timezone (or "publishes immediately").
   Wait for an explicit yes.
5. Call `schedule_post` per account. When the same message goes to several
   accounts, pass one shared `post_batch_id` (any UUID) on every call. If the
   post came from a draft, pass its `variant_id`.
6. Report from the responses: which posts were queued (with their IDs and
   times) and which failed, with the error. Never say "scheduled" or
   "published" for a call that did not confirm it.

## Failures you will meet

- **402** — the plan's monthly post limit is reached. Tell the user; do not retry.
- **422** — the safety gateway refused the post (account health, daily limit,
  minimum gap, too many hashtags, duplicate content). Relay the reason and
  propose a fix, such as a later time or revised text.
- **409** — that account already has a post at that exact time.
- **429** — slow down; do not loop.

## Changing or cancelling

`list_posts` with `status` `queued` or `pending` (or `get_calendar`) finds
the post.

- `update_post` changes the text, time, first comment or tags of a post that
  has not gone out. Prefer it to cancel-and-recreate, which loses the slot.
  Confirm the new version first; passing `first_comment` as null removes it.
- `cancel_post` stops it. Only pending or queued posts can be cancelled, and a
  cancelled post must be scheduled again from scratch — confirm first.
