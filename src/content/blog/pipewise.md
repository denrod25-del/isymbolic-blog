---
title: 'PipeWise: Turning r/Plumbing Into a Content Engine'
description: >-
  Scrape a trade subreddit past its anti-bot wall, tag every post with a local
  LLM, cluster the questions people actually ask, and rank what to write next.
pubDate: 2026-08-30
tags:
  - python
  - scraping
  - llm
  - content
project: pipewise
draft: true
---

A plumbing subreddit is a corpus of every question homeowners are too embarrassed to ask a plumber. Thousands of posts, each one a real problem with a real fixture and usually a photo. As raw text it's noise. Structured, it's a map of what a plumbing business should be writing about, ranked by how often people actually need the answer.

PipeWise is the pipeline that does that structuring: scrape → enrich with a local model → store → cluster → rank → generate.

## The architecture

Four stages on the way in, three on the way out.

**Scrape** (`scrape.py`) pulls posts from old.reddit.com using Scrapling's `StealthyFetcher`. This is not optional — a plain HTTP request gets a 403; stealth gets a 200. That single fact shaped the dependency list, and it's the first gotcha below.

**Enrich** (`enrich.py`) hands each post to a local Ollama model running qwen2.5, which tags it: a `problem_type` from a 12-value enum, the fixture involved, any brands mentioned, a `resolution_type` from a 4-value enum, the questions the post asks, and a confidence score. The JSON parse is deliberately tolerant, because a 7B model producing structured output will occasionally produce structured-ish output and the correct response to that is to salvage what parsed rather than to drop the post.

**Store** (`store.py`) is SQLite with FTS5 and idempotent upserts. Running the scraper again over overlapping listings does not duplicate anything.

Then the content engine:

**Cluster** (`cluster.py`) does greedy cosine clustering over the extracted questions using `all-MiniLM-L6-v2` sentence embeddings. Fifty people asking "why does my water heater knock" in fifty different phrasings collapse into one cluster.

**Rank** (`rank.py`) scores each cluster: `content_score = frequency × evergreen × answer_gap × seasonality`. Frequency is how many people ask. Evergreen is whether the answer stays true. Answer gap is whether the existing answers are any good. Seasonality catches the fact that frozen-pipe questions are worth writing in October, not April.

**Generate** (`generate.py`) takes the top clusters and has Claude write a blog post in Markdown, a video script, and an FAQ block as JSON-LD. Before any of that, it writes `out/opportunities.md` — the ranking itself, so you can look at what it thinks is worth writing *before* spending tokens writing it.

## Why it's built this way

Two commands:

```bash
pipewise run                    # scrape → enrich → store
pipewise generate --dry-run     # show me the ranking
pipewise generate --top 3       # actually write three
```

`run` is safe to schedule. `generate` is manual, always, and never on a timer. The ingest half is cheap and local — Scrapling and a local Ollama model cost nothing per post — so it can run nightly under Windows Task Scheduler and accumulate. The generation half calls a paid API to produce something a human will publish under their name, and that should be a decision, not a cron job.

The LLM usage is tiered the same way as my [local pdf-to-podcast build](/blog/pdf-to-podcast/): a small local model does the high-volume mechanical tagging, and the expensive model only touches the handful of things that reach the top of the ranking.

Every external I/O boundary — Scrapling, Ollama, Claude, the embedding model — is injected as a function. That's what lets the whole test suite run fully mocked, with one gated live test that hits real Reddit when you ask it to.

## The gotchas

**`pip install scrapling` does not install the fetchers.** The base package omits `curl_cffi`, Playwright and Patchright. Everything imports fine, the mocked tests pass — and the first live fetch dies with `ModuleNotFoundError`. The requirements file pins `scrapling[fetchers]` for exactly this reason. Mocked tests only exercise the parser, so the gap is invisible until you touch the network.

**Reddit caps listings at roughly 1,000 items each.** You cannot backfill a subreddit's history through the listing endpoints, no matter how politely you page. The strategy that works is a seed run plus scheduled top-ups that accumulate forward from now. I looked at RedditDownloader as an alternative and rejected it: it's archived, PRAW-based, and media-oriented.

**Run pytest from the workspace root, not the project directory.** `PipeWise` needs to import as a package, which means the parent directory has to be on the path. An empty `conftest.py` at the repo root handles it. Running `pytest` from inside `PipeWise/` produces import errors that look like missing dependencies.

**Old Reddit is the right target.** Not because it's nostalgic — because it's static HTML that a parser can read, where the modern interface is a React application that needs a full browser. Choosing the older surface of a site is often the difference between a scraper and a browser automation project.

## Where it stands

The Foundation and the Content Engine are built and tested — 78 test functions plus one gated live test verified against real Reddit. It lives on a `pipewise` branch that I've deliberately left unmerged.

PipeWise was always meant to be four products sharing one corpus: a knowledge base, market intelligence, this content engine, and a diagnostic assistant. The Foundation was built once so the other three can attach to the same SQLite corpus later, each with its own spec. The content engine went first because it's the one that produces something publishable on day one.

Known rough edges: the clustering centroid is greedy-first and never recomputed, so cluster quality depends somewhat on arrival order; and `default_embed` reloads the sentence-transformer model on every call instead of batching all questions into one. Both are on the list. Neither stops the ranking from being useful, which is the bar for a v1.

More projects built this way are on the [projects page](/projects/).
