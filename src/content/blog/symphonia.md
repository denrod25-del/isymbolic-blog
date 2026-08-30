---
title: 'Symphonia: 144 Movements of Public-Domain Classical, Traced to Source'
description: >-
  Building a public-domain classical music library — a Supabase catalog, an
  idempotent transcode pipeline, and the CSP trailing slash that silenced it.
pubDate: 2026-08-30T00:00:00.000Z
tags:
  - nextjs
  - supabase
  - audio
  - ai
project: symphonia
heroImage: /images/symphonia/hero.png
draft: false
devtoId: 4529311
---

There is a surprising amount of genuinely public-domain classical music on the internet and almost nowhere pleasant to listen to it. The Musopen Kickstarter collection — professional recordings, released under a Public Domain Mark — sits on archive.org as a pile of FLAC files. Symphonia turns that pile into a library you can browse by composer and click to play. It's live at [symphonia-web.vercel.app](https://symphonia-web.vercel.app) with the entire collection loaded: **14 composers, 37 works, 144 movements.**

## What it is

A quiet, typographic library site. Composers with dates, works under each composer, movements under each work, and a player. Every work carries its performers and its provenance, because "public domain" is a claim you should be able to check: the tagline on the front page is "every work traced to its source," and the footer of each work names where the recording came from and under what mark.

The catalog is Beethoven's Third, all four Brahms symphonies, Mendelssohn's Third and Fourth, Mozart's 40th and Tchaikovsky's Sixth — plus overtures, tone poems, string quartets, the Goldberg Variations and seven Schubert sonatas. Performers include the Czech National Symphony Orchestra, the Musopen String Quartet, Shelley Katz on the Goldbergs and Paul Pitman on the Schubert.

The frontend is Next.js 14 on Vercel. The catalog is Supabase Postgres — five tables (composers, works, movements, renditions, sources) with row-level security that lets anonymous readers see only movements whose `stage` is `uploaded`, so half-ingested material never leaks into the UI. Audio lives in a public Supabase Storage bucket as Opus at 96 kbps.

## How it was built

The frontend arrived as a static zip with no backend at all. Everything behind it — schema, storage, ingestion — got designed and built from scratch: brainstorm, then a written design spec, then a five-task plan, then implementation.

The interesting half is the pipeline. It's a Node/TypeScript program in `pipeline/`, driven by a manifest, with six idempotent stages:

```bash
npm run pipeline sync    # read the manifest, reconcile the catalog
npm run pipeline fetch   # pull FLAC from archive.org
npm run pipeline encode  # transcode to Opus 96k
npm run pipeline upload  # push to Supabase Storage
npm run pipeline verify  # confirm what landed
npm run pipeline run     # all of the above
```

Each stage is safe to re-run, which matters more than it sounds: fetching 144 movements of FLAC is slow and flaky, and a pipeline you can't resume is a pipeline you run once and then avoid. Adding new works means extending `manifest.json` and running `pipeline run` again. There are 18 tests over the pipeline logic.

Opus at 96 kbps was the choice that made the whole thing fit. The full collection is **800 MB of the 1 GB Supabase free tier** — 80% full. Anything more (Chopin, say) needs object storage elsewhere or a paid plan. Free-tier egress is about 5 GB a month, which works out to roughly twenty full-symphony listens. That's a real constraint and it shaped the scope: ship the complete Musopen collection well rather than a partial everything.

## The gotchas

**A missing trailing slash in a Content-Security-Policy silently kills all audio.** This one cost the most time by far. The CSP's `media-src` directive is built from `NEXT_PUBLIC_AUDIO_BASE_URL` verbatim. CSP source expressions match on a path prefix — but only if the value ends in `/`. Without the slash, the browser does an exact match instead, no audio URL ever matches, and every `audio.play()` rejects with `NotSupportedError` and *zero console output*. No CSP violation warning, no network error, nothing. The page looks perfect and the music never starts.

If you take one thing from this post: the trailing slash on a CSP source is load-bearing.

**Next's dev mode needs `'unsafe-eval'` or the page renders and never hydrates.** Same category of failure — everything looks right, nothing works. Without `'unsafe-eval'` in `script-src` during development, React never hydrates, so clicks do nothing and no error appears. `next.config.mjs` now adds it only when `NODE_ENV=development`; production stays strict.

**`vercel deploy` hung forever uploading a 3.4 GB cache.** The pipeline keeps downloaded FLAC in `pipeline/cache/`, and the deploy dutifully tried to upload all of it. One line in `.vercelignore` excluding `pipeline/` fixed it. Worth checking any repo where a build tool and a data tool share a directory.

**Applying schema DDL took a detour.** The Supabase Management API endpoint (`POST /v1/projects/<ref>/database/query`) works fine — but Cloudflare 403-blocks Python's `urllib` user agent in front of `api.supabase.com`. Use `curl`.

One more that's less a gotcha than a property: the site uses ISR with a one-hour window, so newly ingested works can take up to an hour to appear unless you redeploy. Locally, deleting `.next/` busts the fetch cache.

## Where it stands

Symphonia is fully live and click-to-play has been verified in production. The full Musopen collection is ingested and serving — 14 composers, 37 works, 144 movements — with per-work performer credits and provenance. The pipeline is manifest-driven and idempotent with 18 tests. Storage sits at 80% of the free tier, which is the honest ceiling on the current shape of the project.

Known follow-ups: uploaded objects serve `Cache-Control: no-cache` despite the `cacheControl` parameter being set, which leaves CDN caching on the table; the sources footer renders four duplicate provenance lines because the frontend doesn't dedupe them; and the repo isn't on GitHub yet. None of those stop the music.

More projects built this way are on the [projects page](/projects/).
