---
name: review-post-performance
description: Report what performed, what did not, and the single most useful change, from MisarPost's own post and engagement data. Use when asked about post performance, engagement, reach, stats, what is working, or for a weekly or monthly report.
---

# Review post performance

## Steps

1. `get_stats` — the headline: queued, published this week and month, drafts
   waiting, top post of the month, average engagement rate.
2. `get_analytics_trends` with `days` 7, 30 or 90 to match the question — per
   channel daily series, totals, and change against the previous period.
3. `list_posts` with `status` `published` for the posts behind the numbers
   (each row carries its own likes, comments, reposts and impressions).
4. If the user is on the Empire plan, `get_growth_overview` adds bottlenecks
   and format performance; an upgrade message back means it is not available
   to them — skip it without comment beyond one line.

## Report

- Headline metrics with the period stated.
- Best and worst channel, and best and worst post, each with a one-line reason
  grounded in the data (format, timing, topic).
- The single highest-impact change for next period.

Keep it under 400 words.

## Honesty rules

- A channel whose trend `metric` is `posts` has no engagement data from its
  platform yet. Report its publish volume; never present its zero engagement
  as poor performance.
- `avgEngagementRate` null means no metrics exist yet — say so, do not
  substitute an estimate.
- If a figure was unavailable or a call failed, say which, rather than filling
  the gap.
