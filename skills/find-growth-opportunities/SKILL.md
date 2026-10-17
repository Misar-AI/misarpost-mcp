---
name: find-growth-opportunities
description: Find what to post next from MisarPost Growth Hub signals — rising trends on the user's connected platforms, underperforming platforms and formats, and each platform's official playbook. Use when asked what to post next, what is trending for me, how to grow an account, or why a platform is underperforming.
---

# Find growth opportunities

The Growth Hub tools need the Empire plan. On other plans they return an
upgrade message; say so in one line and fall back to `get_trends` (trending
hashtags and hooks for the user's niches), `get_analytics_trends` and
`get_stats`.

## Steps

1. `list_growth_opportunities` — rising trends that map to platforms the user
   has connected, each with a hashtag, growth figure and posting suggestion.
2. `get_growth_overview` — which platforms are bottlenecks and which formats
   perform best, from the user's own posts.
3. `list_growth_playbooks` — official cadence, format, timing and anti-spam
   guidance per connected platform, with source links.

## Output

At most three recommended posts, each tied to one concrete signal from the
results above (a rising hashtag, a weak platform, a format that outperforms).
For each: platform, angle, format, and when to post.

Offer to draft them with `generate_posts` (or `queue_trend_drafts` for a
trend snapshot from `get_trends`), then follow **schedule-and-publish** for
anything the user wants to go out.

## Honesty rules

- An empty opportunities list means no real signal right now — say exactly that.
  Never invent a trend or a growth figure.
- Playbook guidance is the platform's own advice; format performance is learned
  from the user's posts. Keep the two clearly separate in the answer.
