---
title: 'ClawWatch: An Agent That Watches My Game Server and Asks Before It Acts'
description: >-
  A desktop agent that diagnoses a live FiveM server over SSH, txAdmin, RCON and
  MariaDB — rules first, LLM second, and a safety model that fails closed.
pubDate: 2026-08-30T00:00:00.000Z
tags:
  - electron
  - agents
  - devops
  - ai
project: clawwatch
draft: false
---

A player crashed out of my FiveM roleplay server with `ERR_STR_INFO_2` — a RAGE streaming crash caused by a bad addon asset. Diagnosing it meant SSHing to the VPS, tailing a log, cross-referencing which resource had just started, and knowing what that particular error code means. All of which I did, slowly, at eleven at night.

ClawWatch is the tool that should have done it for me. It's a neon Electron desktop agent that connects to the live server four different ways, recognises known failures by pattern, and can act on them — with a hard line between actions it takes on its own and actions it asks about first.

## What it does

Four connectors, each speaking a different protocol to the same box:

- **SSH** (`ssh2`) — tails the server log and reads CPU and memory.
- **txAdmin** — HTTP against the admin panel.
- **RCON** — UDP, with the packet format hand-rolled over `dgram`, because the protocol is small and the libraries are worse.
- **MariaDB** (`mysql2`) — read and write, split so that reads and writes travel different paths.

On top of those sits a **rules-first diagnosis engine**. It's regex over log lines, and it costs nothing to run. Seed rules cover `err-str-info-2`, resource-start failures (which trigger an automatic restart), Lua script errors, dropped database connections, thread hitches and out-of-memory conditions. Claude gets escalated to only when a rule misses, or when I explicitly ask.

That ordering matters more than it looks. The overwhelming majority of what a game server logs is a small set of recurring failures. Sending each of those to a language model would be slow, expensive, and *less* reliable than a pattern that has been right a hundred times. The model earns its place on the long tail, not the head.

The dashboard is health tiles, a live log with rule matches highlighted inline, an alert and audit feed, a chat pane, and a first-run setup screen.

## The safety model

This is the part I care about, because the agent has SSH, RCON and database write access to a server real people are playing on.

Actions are classified **SAFE** or **RISKY**. SAFE actions run automatically, rate-limited. RISKY actions — stopping the server, kicking or banning a player, any database write, any file operation, raw RCON or raw SSH — require a confirmation modal.

The important detail is where that classification lives. The executor **re-classifies every action itself** rather than trusting a flag handed to it by the caller, and if it decides an action is RISKY and no confirmation callback is available, it **fails closed** and refuses. A code review caught that it originally failed *open* — an action arriving without a confirm handler would simply have run. That's the difference between a safety model and a suggestion.

The agent core in `src/core`, `src/connectors` and `src/rules` has no Electron dependencies at all. That was deliberate: the eventual phase-two version is a headless always-on service, and keeping the brain free of the window means that's a drop-in rather than a rewrite.

## The gotchas

**Log lines went into the DOM via `innerHTML`.** A code review caught this one and it's the scariest bug in the project. The live log renderer built HTML from raw server log lines — lines that contain, among other things, player-supplied chat and resource names. Any player who could get text into the log could have executed script in the agent window, which holds SSH and database credentials. Fixed to `textContent`. If you are rendering untrusted text, the fix is not escaping it better; it is not using `innerHTML`.

**A regex that ate a trailing period.** The resource-name pattern matched one character too many, so `resource-name.` captured with the period attached and then failed to match anything downstream. Small, silly, and exactly the kind of thing a second reviewer catches and the author doesn't.

**Restarting the agent leaked SSH connections.** `startAgent` was re-entrant — call it twice and the first connection was orphaned rather than torn down. Caught in review, fixed with an explicit teardown.

**txAdmin's API paths move between panel versions.** There's no stable contract here, so every txAdmin call goes through `post()` and `getJson()` helpers in `txadmin.js` rather than being scattered through the codebase. When a panel upgrade breaks something, there's one file to fix.

**Real credentials never touch the project directory.** The live config lives in Electron's `userData` as `clawworld.config.json`; the repository carries only `clawworld.config.example.json`. Obvious in principle, easy to get wrong when the first thing you do is hardcode a host to test a connector.

## Where it stands

v1 is complete: 44 tests under `node:test`, with every connector exercised through injected fakes so the suite never touches the live VPS. The app launches to its setup screen; the live server only gets touched during manual end-to-end runs. Electron is pinned at 42.4.1 with a clean `npm audit`.

It was built subagent-driven across 15 test-driven tasks, and two separate code-review passes found the four real bugs above — the XSS, the fail-open confirm, the regex, and the connection leak. None of those were caught by the tests that shipped alongside the code that contained them, which is the argument for review passes in one sentence.

The code lives in a private repository with a pull request open, and also in my workspace repo at `claude/ClawWatch/`. The broader idea was three products — crash debugging, mod script building, and this agent. Only the agent exists so far.

More projects built this way are on the [projects page](/projects/).
