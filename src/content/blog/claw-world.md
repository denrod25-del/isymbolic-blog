---
title: 'Claw World: Running a FiveM Roleplay Server and Building Its Website'
description: >-
  Notes from running a live QBCore FiveM roleplay server and building the
  companion website that fronts it — applications, leaderboards, turf, and a feed.
pubDate: 2026-06-13T00:00:00.000Z
tags:
  - fivem
  - qbcore
  - gaming
  - lua
project: claw-world
draft: true
---

Claw World is a roleplay server I run on [FiveM](https://fivem.net/), the multiplayer modification for GTA V, using the [QBCore](https://github.com/qbcore-framework) framework. Alongside the server itself there's a companion website — the public face people hit before they ever join — and this post is about both halves: keeping a community RP server running, and building the site that sits in front of it. I won't be sharing connection details, addresses, or anything you'd use to reach the box; this is about the build, not the door.

## What it is

A FiveM roleplay server is a persistent online world. People create characters and stay in character — jobs, relationships, crime, consequences — rather than just running around shooting each other. FiveM is the platform that makes the multiplayer possible; QBCore is the framework that gives you the actual roleplay systems on top of it: player identities, inventory, jobs, gangs, an economy, a persistent database behind all of it. Neither of those is mine. They're the work of the FiveM and QBCore communities, and Claw World is a server built on them, not a fork of them.

The current incarnation of Claw World leans into a gritty street-level theme — an underground concrete city with a blood-red, newsprint aesthetic. There's a reputation system with tiers, gang territory you can hold or lose, player-owned businesses, and an in-world social feed. I'd call it Phase 1 complete: it exists, it runs, and the systems are in place. (The longer-term plan is to give it a South Florida identity — a stylized Palm Beach Island map — but that's a separate project still in its spec phase, so I'll leave it as "in progress" here.)

The companion website is the other half. It's a static frontend with a small Node.js/Express backend, and it's deliberately not just a landing page. It carries a whitelist application form, a leaderboard ranked by in-game reputation, a turf-control view of which gang holds which zone, headline server stats, and a feed of the latest in-world social posts. The point is that the site reflects the *living* state of the server rather than describing it from the outside.

## How it comes together

A QBCore server is less "install and play" than it sounds. The framework gives you a baseline, but a server is really an assembled thing: a stack of resources (FiveM's term for the Lua scripts and assets that make up features), each configured, each talking to the others and to a shared database. Getting the foundation stable — the framework, the resources, the database schema they expect — is most of the early work. A lot of QBCore is Lua, and a lot of the day-to-day is reading other people's resources closely enough to configure or extend them without breaking the rest.

The website was the more familiar territory for me. The frontend is a single hand-built page with its own visual language — Playfair Display for the headlines, Space Mono for everything else, all dark surfaces and red accents — split into sections you switch between rather than separate pages. The backend is a thin Express API: a handful of read endpoints that surface the server's current state (leaderboard, turf, stats, the social feed) and a write endpoint that takes whitelist applications and stores them for staff to review and approve or deny. The interesting design choice was pointing the site's read endpoints at the same data the game already produces, so the public stats and leaderboard aren't a separate thing I have to keep in sync — they're a window onto what's already happening in-world.

## Notes / what I'm learning

I should be honest about where I'm standing: FiveM and QBCore are both new to me. I came in as a hobbyist who wanted to run a community, not as someone who'd shipped Lua resources before, and a fair amount of this has been learning the platform's vocabulary and conventions as I go — what a "resource" is, how QBCore expects its database laid out, where the framework ends and your own scripts begin.

A few things have stuck so far:

- **The framework is a starting point, not a finish line.** QBCore hands you a lot, but a server with a personality is the configuration and the resource choices, not the defaults. The identity is in the assembly.
- **Treat the website as a read model of the game, not a second source of truth.** The moment the site tries to *own* state instead of reflecting it, you've signed up for keeping two systems in sync. Surfacing what the server already records was far less fragile.
- **A live server changes how you work.** People are in there. That tilts everything toward "don't break the running thing" — which, frankly, is good discipline, and a different headspace from a single-player project I can blow away and rebuild.

Honest caveat on this post: I'm writing it from notes and the website's source rather than a full code walkthrough, since the server itself lives on a remote box and not in a repo I poke at locally. So the descriptions of systems are real but high-level. If I dig back into the QBCore resource layer in a later session, there'll be a more technical follow-up with actual Lua in it.

For now: Phase 1 is up, the site is the front door, and the next real milestone is the Palm Beach map work that turns a generic street-RP server into something that feels like a specific place. That's the part I'm most curious to build.
