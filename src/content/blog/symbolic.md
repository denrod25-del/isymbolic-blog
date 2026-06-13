---
title: 'Symbolic: I Built a Search Engine (and Named This Blog After It)'
description: >-
  How I built Symbolic: a working search engine on Next.js 16 — Brave-powered
  results, an advertiser portal, an admin review queue, and a companion browser app.
pubDate: 2026-06-13T00:00:00.000Z
tags:
  - nextjs
  - search
  - typescript
  - web
project: symbolic
heroImage: /images/symbolic/hero.png
draft: true
---

This blog is called iSymbolic, and that name is not an accident. Symbolic is my search engine — a real, working web search product with its own results page, settings, an advertiser portal, and an admin panel — and it's the project I'm proudest of. The blog is the place I write about what I build; Symbolic is the thing I built that mattered enough to lend its name. There's also a companion browser app that puts Symbolic where searching actually starts. I built it all with Claude as a pair programmer.

## What it is

Symbolic is a web search engine. You land on a clean page — a NASA Earth photo behind a single search box, the tagline "Search without compromise" — you type a query, and you get a page of web results. There's an "I'm Feeling Lucky" button that jumps you straight to the top result, a settings page where you choose your SafeSearch level (strict, moderate, or off, saved to a cookie so it sticks), and paginated results so you can go deeper than the first ten. It's the search experience you already know, rebuilt from the ground up as something I own end to end.

Under the hood, the actual web index comes from the [Brave Search API](https://brave.com/search/api/). I made a deliberate decision early: I was not going to crawl and index the entire web from a home server with an RTX 3070. That's not a weekend project, it's a career. Instead, Symbolic is an independent front end and product layer over Brave's index — my own ranking surface, my own UI, my own ad system, my own policies — sourcing the raw web results from an API built for exactly this. Credit where it's due: Brave does the crawling; Symbolic is everything around it.

The part that makes it a *product* and not just a search box is the advertiser side. Symbolic has a self-serve advertiser portal where a business can sign up, create a text ad with keywords and a bid, and manage their campaigns. Ads are keyword-matched against the search query and shown above and below the organic results. Behind that sits an admin moderation panel: ads don't go live automatically — they sit in a review queue with an approval status, and only approved, active ads ever get served. I'll keep the internals of that panel deliberately vague here, but the shape of it is a real two-sided system: searchers on one side, advertisers on the other, and a human approval gate in between.

And then there's the companion browser app — the piece that closes the loop. A search engine you have to navigate to first is a search engine you mostly forget to use. The browser-app companion makes Symbolic the place your searches begin, so it's woven into how I actually browse rather than being a tab I have to remember to open. It's a companion to the web product described here, and I'll give it its own full write-up once it's further along — I'd rather under-promise it here than overstate what's shipped.

## How it was built

The stack is modern and intentionally mainstream: **Next.js 16** with the App Router, **React 19**, **TypeScript** in strict mode, and **Tailwind CSS v4**. Data lives in **PostgreSQL** through **Drizzle ORM** — with [PGlite](https://pglite.dev/) running an in-process Postgres locally so I can develop and run migrations without standing up a database server. Authentication for the advertiser portal is handled by [Clerk](https://clerk.com), the whole thing is internationalized with [next-intl](https://next-intl.dev/) (no user-facing string is hard-coded — they all flow through translation namespaces), and [Arcjet](https://arcjet.com/) provides bot and abuse protection at the edge.

I didn't start from a blank `create-next-app`. Symbolic is built on top of [ixartz's Next.js Boilerplate](https://github.com/ixartz/Next-js-Boilerplate), which gave me the entire developer-experience scaffold for free: the linting setup, the testing harness (Vitest for units, Playwright for end-to-end), the i18n wiring, the database tooling, and a sane project structure. That let me spend my time on Symbolic's actual product instead of on plumbing.

The division of labor was the same one I use on every project: I decided what Symbolic should be and how it should behave, and Claude wrote most of the code. The interesting thing about this build is how disciplined it was. Each major feature went through a written design spec, then an implementation plan, then test-driven execution — there are spec-and-plan documents in the repo for the ad display system, advertiser authentication, ad management, and the admin panel, each one dated, each one preceding the code it describes. The search core itself is small and honest: a typed client that calls the Brave API, normalizes the response into my own `SearchResult` shape, and hands it to React Server Components that render the page. Ranking of organic results is Brave's; what I built on top is the ad-selection logic — tokenize the query, find approved active ads whose keywords overlap, order by bid, cap at two slots — and the surrounding product.

## The gotchas

Three real ones, each grounded in code that's in the repo today.

**Pagination is by offset, not by row.** My first cut at "next page" did what felt natural — skip N rows and grab the next ten. But the Brave API doesn't page by row offset — its `offset` parameter is a *page index* (0–9). Asking it to skip 10 rows is not the same as asking it for page 2, and the mismatch produced duplicated and skipped results across page boundaries that looked almost-right, which is the worst kind of wrong. The fix was to stop thinking in row offsets and translate the UI's notion of position into the API's page index before the call goes out. The commit that fixed it is literally titled "paginate search by page index, not row offset, to match Brave API," because that's exactly the lesson: page the way your data source pages, not the way your intuition pages.

**An advertiser's real destination URL must never be the thing your ranking logic touches.** Ads carry a real click-through URL, but the ad's title and call-to-action don't link there directly. They link to an internal click-tracking route that records the click and then issues a redirect to the real destination. This keeps the raw destination URL out of the rendered result surface and gives me a single, auditable choke point for every ad click — which matters for billing and for catching abuse. It's a small architectural decision (one redirect route) with outsized payoff, and it's the kind of thing that's painful to retrofit, so it went in early.

**Array overlap in Postgres doesn't come for free in a query builder.** Ad keywords are stored as a Postgres text array, and matching them against the query tokens is exactly what Postgres's `&&` array-overlap operator is for. But Drizzle's typed query builder doesn't expose `&&`, so I had to drop to a raw SQL fragment — and even then, PGlite needed an explicit `::text[]` cast to resolve the operator overload correctly. It's a two-line escape hatch, but it's the kind of thing that compiles, type-checks, and then silently returns nothing until you figure out the cast. The comment explaining why the cast is there is, in this case, more valuable than the code.

## Where it's at

Symbolic is live and real: a working search front end over the Brave index, SafeSearch settings, "I'm Feeling Lucky," a self-serve advertiser portal with sign-up and campaign management, a click-tracked ad system, and an admin moderation queue — all on Next.js 16, React 19, Drizzle, and Postgres, built test-first on top of a battle-tested boilerplate. I'm honest about the scope: the web results are Brave's, not a from-scratch crawler, and that's a feature, not an apology — it let one person ship a genuinely usable search product instead of an unfinished crawler.

The companion browser app is the next chapter and deserves its own post rather than a paragraph buried at the bottom of this one. When it's ready, I'll write it up the same way I wrote this — what it is, how it was built, and the gotchas I hit on the way.

This is another entry in the series on projects built this way. The running list is on the [projects page](/projects/).
