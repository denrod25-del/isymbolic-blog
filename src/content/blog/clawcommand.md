---
title: 'ClawCommand: One Dashboard for Every AI Thing on My Machine'
description: >-
  A neon Electron command centre showing every AI provider, model, service and
  GPU on a Windows box — with exactly one button that spends tokens.
pubDate: 2026-08-30T00:00:00.000Z
tags:
  - electron
  - windows
  - ai
  - monitoring
project: clawcommand
draft: false
---

At some point I had seven different AI CLIs installed, a local Ollama with a handful of models, a gateway on one port, n8n on another, LM Studio on a third, and no idea at any given moment which of them were actually alive. Checking meant seven terminal commands. So I built the dashboard: ClawCommand, a full-window neon Electron app that answers "what AI is running on this box right now" in one glance.

It's the third in the Claw family, after [ClawMonitor](/blog/clawmonitor/) and [ClawPorts](/blog/clawports/), and it reuses ClawMonitor's architecture wholesale because that architecture turned out to be right.

## What it shows

Five panels, each backed by its own collector:

**Providers** — Claude, Codex, Gemini, Cursor, Ollama, Perplexity and Manus. For each: is it installed, what version, and what's its auth state. This panel never displays or logs a key *value*; it reports presence only. Polled every 30 seconds, passively.

**Models** — Ollama's `/api/tags` and `/api/ps`, so you see what's installed, what's currently loaded into VRAM, how much it's using, and the keep-alive countdown before it unloads. Every 5 seconds.

**Services** — port probes for the gateway on 18789, Ollama on 11434, n8n on 5678, AI-Infra-Guard on 8088 and LM Studio on 1234, plus `docker ps` and `wsl -l --running`. Every 5 seconds.

**Vitals** — `nvidia-smi` and `systeminformation` for GPU, VRAM, CPU and RAM. Every 3 seconds, because these are the numbers you actually watch.

**Activity** — a `tasklist` scan for AI processes plus an event log. This one diffs consecutive snapshots into a ring buffer, so you get a running feed of *changes*: a model loaded, a service went down, an auth state flipped. That's more useful than the raw state, because the interesting thing is almost always the transition.

## The one design rule

Everything above is free. Every collector reads local state — process lists, HTTP probes to localhost, `nvidia-smi`. Nothing in the passive loop calls a paid API, ever.

But "is Claude installed and authenticated" is not the same question as "does a request actually work right now." So each provider card has a **TEST** button, and pressing it fires exactly one real request of roughly five tokens through `main/test-runner.js`. That is the only code path in the entire application that can spend money, it only runs on an explicit click, and it's the reason the passive polling can be as aggressive as it is. Separating "watch" from "verify" into two clearly different affordances is the whole design.

## How it was built

Brainstorm, spec, plan, implement — one day, 2026-07-16. The architecture is copied from ClawMonitor's proven pattern: main-process collectors on group timers, pushing a merged snapshot over IPC to a vanilla-JS renderer with no build step. Every collector takes its dependencies as injected functions, which is what makes 86 Vitest tests possible without a single real subprocess or network call in the suite.

The renderer holds no logic. It draws whatever the latest snapshot says. That constraint is load-bearing: when a collector fails, it degrades to `null` in its slice and an entry in an errors map, and the rest of the dashboard carries on rendering. There's no state in the UI that can get out of sync with reality, because the UI has no state.

## The gotchas

**A `\0` before a digit is an illegal octal escape in strict mode.** A test string contained `\0` immediately followed by a digit, which JavaScript parses as the start of a legacy octal literal and refuses in strict mode. Use `\x00`. Ten seconds to fix, twenty minutes to understand.

**The Cursor card says "not installed" and that is correct.** On this machine `cursor-agent` lives inside WSL, reached through a Git Bash shim at `~/bin/cursor-agent`. Electron and Node spawn through `cmd.exe`, which cannot see a Bash shim. So the probe genuinely cannot find it and honestly reports it missing. This is documented in the README rather than papered over — a dashboard that lies to make a card green is worse than useless.

**Cold-loading a model can blow a 60-second timeout.** The Ollama TEST path timed out once while `llama3.2:3b` cold-loaded under heavy CPU pressure — I had roughly fifteen Claude processes pinned at 91% CPU at the time. Warm, it's fast. That's not a bug so much as a fact about what a first request costs, and the fix was making the failure legible rather than making the timeout longer.

**"This operation was aborted" tells the user nothing.** The HTTP helper used to surface that raw string when a probe timed out. It now reports "timed out after Nms." A monitoring tool's error messages are its user interface.

## Where it stands

v1 is complete and live-verified on my machine: 86 tests green, providers detected correctly (Claude, Codex and Ollama green; Gemini showing auth-missing; Perplexity and Manus showing key-unset), models, services, vitals and activity all reading real data, and both the Ollama TEST success path and the fail-fast missing-key path confirmed by hand.

It lives at `claude/ClawCommand/` as its own git repository and hasn't been pushed anywhere public yet. It starts with `npm start`. Unlike ClawMonitor, which docks to a screen edge and stays out of the way, ClawCommand is a full window you open when you want to know something — which is the right shape for a question you ask a few times a day rather than glance at constantly.

More projects built this way are on the [projects page](/projects/).
