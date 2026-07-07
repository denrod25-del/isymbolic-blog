---
title: 'Scrapling MCP: Giving Claude Code a Real Web Scraper'
description: >-
  I wired the open-source Scrapling scraper into Claude Code as a global MCP
  server, so the agent can fetch, scrape, screenshot, and bypass anti-bot pages
  itself.
pubDate: 2026-06-12T00:00:00.000Z
tags:
  - mcp
  - python
  - web-scraping
  - claude
project: scrapling-mcp
draft: false
devtoId: 4091124
---

Claude Code can read my files and run my shell, but out of the box it can't actually go *get* a page from the live web in a way that survives modern anti-bot defenses. A `curl` from the Bash tool gets you a 403 from anything behind Cloudflare. So I took an existing open-source scraper — [D4Vinci/Scrapling](https://github.com/D4Vinci/Scrapling) — installed it locally, and registered its built-in MCP server with Claude Code. Now the agent has ten tools for pulling the real web: plain fetches, headless-browser fetches, stealth fetches that solve Cloudflare, and screenshots. The scraper isn't mine — I want to be clear about that. What I built is the local install and the MCP integration that hands those capabilities to the agent.

## What it is

Scrapling is an adaptive web-scraping framework. The part I cared about for this is its fetchers: a fast HTTP client built on `curl_cffi` that impersonates real browser TLS fingerprints, a Playwright-backed fetcher for pages that need a real browser to render, and a "stealthy" fetcher built on patchright that bypasses anti-bot systems like Cloudflare Turnstile out of the box. It also ships a parser that "learns" a page's structure so your selectors keep working when a site redesigns. That whole engine is the maintainer's work, not mine.

What turns that library into something Claude Code can use is the MCP server Scrapling already bundles. MCP — Model Context Protocol — is the standard way an agent gets extra tools. Register an MCP server and its tools show up in the agent's toolbox alongside the built-in ones. Scrapling's server exposes ten:

- `get` and `bulk_get` — fast HTTP fetches via `curl_cffi`, single or batched
- `fetch` and `bulk_fetch` — full headless-browser fetches via Playwright, for JS-rendered pages
- `stealthy_fetch` and `bulk_stealthy_fetch` — patchright stealth fetches that get past Cloudflare
- `open_session`, `close_session`, `list_sessions` — persistent browser sessions across calls
- `screenshot` — returns an actual image block of the rendered page

The design is deliberately token-conscious, which matters when the consumer is an LLM and every byte of the response eats context. The tools default to returning markdown with `main_content_only=True`, which strips the page chrome down to the article body (and sanitizes hidden elements, which doubles as a guard against prompt injection hiding in the DOM). You can pass a `css_selector` to narrow the result before it ever reaches the model — in my testing that cut the payload by roughly 71% on a content-heavy page.

## How it was built

There wasn't much *code* to write here — the value was in the install and the wiring, which on Windows had a few sharp edges.

I cloned the repo to `claude/Scrapling/` and installed `scrapling[ai]` into its own virtualenv at `claude/Scrapling/.venv`, on Python 3.14. That last part was a small gamble — 3.14 is new enough that I half-expected a dependency to have no wheel — but every package resolved, including `curl_cffi`, which shipped an abi3 wheel that works across Python versions. Then `scrapling install` pulled down the browser binaries: Playwright's Chromium and a headless shell into `~/AppData/Local/ms-playwright`, with patchright reusing the same cache. That's roughly 700 MB of browser per Chromium build (more on disk once Playwright and patchright pull separate versions), which is the real cost of "can render and stealth real pages."

The integration itself is one block of JSON. MCP servers in Claude Code live in `~/.claude.json`, and I added `scrapling` to the global `mcpServers` block — the same place the blender, unity, and pixellab servers already lived. It's a stdio server, so the config is just a command and args: the command points straight at the venv's `scrapling.exe` (`C:\Users\skyea\claude\Scrapling\.venv\Scripts\scrapling.exe`) with args `["mcp"]`. Registering it globally rather than per-project means the scraper is available in every Claude Code session, not just one repo — which is what I wanted, since "go grab this page" is a need that doesn't belong to any single project.

The one non-obvious step: MCP servers are loaded when a session starts, so adding the block does nothing until you restart Claude Code (or re-run `/mcp`). After the restart it connected, and I ran every tool against `quotes.toscrape.com` to confirm — `get` and `fetch` returned content, `stealthy_fetch` came up clean, `screenshot` returned a real image block, and the session tools opened and closed a browser session as expected. All ten verified live.

## The gotchas

Three real ones, each of which would have cost time if I'd skipped it.

**Editing `~/.claude.json` by hand is editing the file that runs Claude Code, so back it up first.** That file holds the entire harness config — every MCP server, project history, the lot. A stray comma turns it into invalid JSON and the next launch is a bad time. Before touching it I copied it to `~/.claude.json.bak-scrapling`, then made the edit. If the edit had broken anything, recovery was a one-line file restore instead of a debugging session. When the config file *is* the thing you depend on to debug, you don't get to debug your way out of corrupting it.

**The server won't appear until you restart — adding the JSON isn't enough.** MCP servers are read at session startup, so right after saving the config the `scrapling` tools simply weren't there, which looks exactly like a broken registration. The fix is just to restart Claude Code (or run `/mcp`), but knowing that up front saves you from "re-checking" a config that was already correct. I lost a minute to this before remembering it's load-at-startup, not hot-reload.

**Python 3.14 in an isolated venv was a calculated risk that happened to pay off.** Installing into a brand-new interpreter version is where dependency wheels go to die — a single package without a 3.14 build would have meant compiling from source on Windows, which is its own afternoon. It worked because the dependency tree had 3.14 wheels (and `curl_cffi`'s abi3 wheel sidestepped the version question entirely). The thing that made the gamble safe wasn't luck, though — it was the dedicated venv. Because Scrapling lives in `claude/Scrapling/.venv` and nothing else, a failed or weird install couldn't contaminate any other project's Python, and the MCP command points at that exact interpreter, so there's no ambiguity about which environment the agent is launching.

## What it does now

The `scrapling` MCP server is registered globally and connected, and all ten tools are live-verified: `get` / `bulk_get`, `fetch` / `bulk_fetch`, `stealthy_fetch` / `bulk_stealthy_fetch`, the three session tools, and `screenshot`. In practice that means inside any Claude Code session I can ask the agent to pull a live page and it actually can — fast HTTP for simple sites, a real headless browser for JS-heavy ones, stealth mode for the ones hiding behind Cloudflare, and a screenshot when I want to *see* the page rather than read it. The same capabilities are reachable from the shell too, via Scrapling's own CLI (`scrapling extract get|fetch|stealthy_fetch URL out.md`), which is handy when I'm not in an agent loop.

To be clear about the division of credit one more time: the scraper, the stealth, the adaptive parser, and the MCP server are all D4Vinci's Scrapling. My work was the local install on Windows/Python 3.14, the global stdio registration in `~/.claude.json`, the backup-and-restart discipline around it, and verifying that all ten tools actually work end to end. The result is that the agent I already use every day can now reach out and read the modern web instead of bouncing off it.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
