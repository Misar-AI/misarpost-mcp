---
name: plan-and-schedule-content
description: Plan a content calendar for the user's connected accounts and schedule it once approved. Use when asked to plan content, fill the calendar, map out a week or month of posts, or decide what to post when in MisarPost.
---

# Plan and schedule content

Everything up to `schedule_post` is reversible planning. `schedule_post` puts
real content in front of a real audience on a real date — it happens only after
the user approves the plan.

## Steps

1. `list_connections` — plan only for accounts that are connected and active.
   A plan for a channel the user has not connected cannot be scheduled.
2. `get_calendar` with `from`/`to` covering the planning window — the
   existing calendar. If it returns an upgrade message (the plan lacks the
   content calendar), use `list_posts` with `status` `queued`, then `pending`.
   Do not double-book a slot or repeat a topic already going out that week.
3. `get_stats` and `get_analytics_trends` (match `days` to the planning
   horizon: 7, 30 or 90) — let past performance pick channels and cadence,
   not a guess.
4. Sharpen the theme with `enhance_topic`, then `generate_plan` for hooks,
   time slots and hashtags. Both spend AI allowance; use them once per theme,
   not per post.
5. Draft the plan as a table: date, time with timezone, account, idea, format.
   If the user wants copy, `generate_posts` writes drafts per platform; they
   land in `list_drafts` and publish nothing. Check `list_post_templates` for
   a template the user already uses for this kind of post.
6. Show the whole plan and wait for explicit approval — of the content, the
   accounts and the times.
7. Schedule each approved item with `schedule_post` (one call per account).
   Follow the **schedule-and-publish** skill for the details. Tag the batch
   (`list_post_tags` / `create_post_tag`, then `tag_ids`) so the plan can be
   found later with `get_calendar` or `list_posts`.

## Rules

- Never schedule without showing the exact text first.
- If the user asks for more posts than their channels can carry without
  spamming, say so and propose a realistic cadence instead.
- Channels whose `get_analytics_trends` `metric` is `posts` have no engagement
  data yet — do not draw performance conclusions from their zero engagement.
- Report what was actually scheduled from each call's response, and list any
  call that failed with its error. Never say "scheduled" for a call that did
  not confirm it.
