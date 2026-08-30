---
title: 'The Signal: Turning a Nightly News Task Into a Newsletter'
description: >-
  A weekly AI newsletter built on top of an existing scheduled task — the
  pipeline, the format, one live issue, and why AI news is hard to source
  safely.
pubDate: 2026-08-30T00:00:00.000Z
tags:
  - newsletter
  - automation
  - ai
  - writing
project: the-signal
heroImage: /images/the-signal/hero.png
draft: false
---

I already had a scheduled task that read me the day's AI news every evening at nine. It ran, I listened, and the output evaporated. The obvious move was to keep it: five days of nightly briefings is most of a weekly newsletter already, and the expensive part of a newsletter is not the writing, it's knowing what happened.

The Signal is that newsletter. It's on Substack at [btheaisignal.substack.com](https://btheaisignal.substack.com), and the promise on the tin is "The AI week, without the hype. Five stories. Every Wednesday."

## The pipeline

There's a scheduled task — cron `0 21 * * *` — whose entire prompt is a request to look up the latest AI news from top tech sources and read it back. It runs every night, unattended.

That's the sourcing layer. It costs nothing extra, it accumulates whether or not I do anything, and by Sunday there are five nights of stories with the day's context already attached. Writing an issue becomes editing rather than researching: pick the five that still matter by the end of the week, cut the four that turned out to be press releases, and write the connective tissue.

The insight I'd generalise: **an automation you already run for yourself is the cheapest possible content pipeline.** I didn't build a news-gathering system for the newsletter. I noticed that the thing I built for my own use produced the raw material, and put a publication on the end of it.

## The format

The whole editorial position is in the tagline. Not "here's everything," but five stories, with the vendor announcements filtered out.

Each issue is:

- A title that makes an editorial claim about the week, not a date stamp.
- A one-line subtitle previewing the top stories.
- A two-or-three sentence hook. No throat-clearing.
- Four or five sections, each with an emoji and a bold header, two to four short paragraphs, **each ending in a "why it matters" line.**
- A one-or-two sentence closing takeaway. No sign-off fluff.

The "why it matters" line per section is the constraint that does the most work. It's very easy to write a paragraph summarising a model release. It is considerably harder to say, in one sentence, why a reader should care — and if you can't, that story probably shouldn't be one of the five. The format enforces the editing.

Promotion is split by platform: a punchy bullet list or single hook for X, a more professional breakdown with arrows for LinkedIn, posted a few hours after the issue goes live so the URL exists to link.

## The sourcing problem

AI news is unusually hard to source safely, and this is the part I'd warn anyone about.

The volume is high enough that a large amount of what surfaces in search results is content-farm output — sites that generate plausible-sounding roundups at scale, including **confidently stated facts about models and releases that do not exist**. They are well-formatted, they cite each other, and they rank. A pipeline that starts with "look up the latest AI news" will hoover them up alongside real reporting, and a summarising layer downstream will smooth them into something that reads exactly like the true items.

Which means the nightly task is a *sourcing* layer, not a fact layer. Anything specific that goes into an issue — a model name, a benchmark number, a company action — needs to trace back to a primary source or a publication that would print a correction. The failure mode isn't hallucination in the usual sense; it's laundering, where a fabricated claim gets more credible at every hop because each hop adds formatting rather than verification.

This bit me elsewhere on this site: the auto-published weekly digest series here has carried claims sourced this way, and it's the reason the newsletter treats the nightly output as leads rather than as copy.

## Where it stands

Honestly: the publication is live, branded, and has **one issue.**

Issue #1 — "The week AI stopped being a tool and became infrastructure," dated August 3 — went out covering a week of model releases, agent capabilities, an energy-efficiency result, and a chip-manufacturing move. The format worked. The pipeline worked. The archive has one thing in it.

That's the gap worth naming rather than glossing over. "Every Wednesday" is a promise about cadence, and a publication that has published once has made a claim it hasn't yet kept. The sourcing layer runs nightly regardless, so the material for the missed weeks exists; what hasn't happened is the hour of editing per week that turns five nights of briefings into five stories.

There's a version of this post that stops after "the pipeline is elegant." The more useful version says the pipeline was the easy half, and the recurring commitment is the actual product. Sequencing infrastructure before habit is a mistake I appear to make reliably — [TapTrace](/blog/taptrace/) is feature-complete and unlaunched for structurally similar reasons.

More projects built this way are on the [projects page](/projects/).
