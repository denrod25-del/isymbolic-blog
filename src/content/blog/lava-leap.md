---
title: 'Lava Leap: Shipping an Endless Climber with an AI Pair Programmer'
description: >-
  How a Phaser 3 endless vertical climber went from idea to public release —
  procedural levels that are provably beatable, chiptune juice, and 53 tests.
pubDate: 2026-06-12T00:00:00.000Z
tags:
  - gamedev
  - phaser
  - typescript
  - ai
project: lava-leap
heroImage: /images/lava-leap/hero.png
draft: false
---

Lava Leap is an endless vertical climber: you scale procedurally generated platforms while lava rises from below, and your score is your height plus the coins you grab on the way up. I built it with Claude as a pair programmer over two release cycles, and it's now public on [GitHub](https://github.com/denrod25-del/lava-leap) at v0.2.0.

## What it is

The core loop is simple to describe and hard to put down. You run, jump, double jump, wall slide, wall jump, and air dash your way up a tower of platforms that never ends. Some platforms crumble under your feet, some move, and the lava below accelerates the longer you survive. Die, see your score, press Space, go again. Your best run persists in localStorage.

Around that loop, version 0.2.0 added the things that make a small game feel like a finished one: named zones with their own palettes and lava pacing (the Volcanic Throat's sub-zones turn over roughly every 1000 height units — Magma Vault at 0, The Forge at 1000, Ashfall at 2000, and Obsidian Crown at 3000 — each raising lava speed and biasing toward harder platform types), hand-authored set-piece chunks injected into the random stream, achievements, a daily challenge seed, a cosmetics shop that spends banked coins, procedural chiptune music, eight synthesized sound effects, pause and settings menus, and a crash-recovery overlay so an unhandled error never strands you on a blank canvas.

The stack is Phaser 3, TypeScript, and Vite, with Vitest for unit tests and Playwright for end-to-end smoke tests. The pixel art player and tiles were generated with PixelLab. Clone the [repo](https://github.com/denrod25-del/lava-leap) and run `npm run dev` to see it move — a game about momentum is better experienced than screenshotted.

## How it was built

The division of labor was consistent: I decided what the game should be, Claude wrote nearly all of the code. We started with a brainstorming session that produced a design spec, then a plan that broke v1 into 28 test-driven tasks across 8 milestones. Claude implemented each milestone with separate reviewer passes, and I played the build live before signing off on each one. v1 shipped in 31 commits; v2 repeated the process with 9 more milestones.

The architectural decision I care most about is **parametric reachability**: every generated level is provably climbable. The generator doesn't place platforms randomly and hope. It clamps every next platform inside the player's actual movement envelope — jump height, double-jump extension, dash distance — using reach-budget constants that live in one tuning file alongside the physics values they're derived from. Difficulty scaling raises the lava speed and biases toward crumbling and moving platforms as you climb, but it never places a gap the movement system can't cross. The generator alone has 12 unit tests asserting this. When v2 added hand-authored set-piece chunks, they had to pass a `validateChunk` gate that rejects any template exceeding the reach widths — and, after a reviewer pass caught it, any template that puts coins on crumbling platforms, which created sucker bets the player couldn't win.

The second load-bearing piece is a typed **event spine**: a small, framework-free event emitter in `src/core/events.ts`. Gameplay code emits events (platform landed, coin collected, death) and everything else subscribes — achievements, run analytics, the audio director, score popups. That's what made v2's feature pile tractable: the achievements system never touches the player class. One naming landmine: the field on the game scene is `gameEvents`, because `events` already exists on `Phaser.Scene` and shadowing it breaks the scene lifecycle.

The juice pass came last and mattered more than I expected: squash-and-stretch on landings, dust particles, screen shake, floating score popups, drifting embers, and a slow-motion beat on death. Even the audio is code — `tools/gen-music.mjs` synthesizes the chiptune loops from scratch, so the repo contains no purchased third-party asset packs — sprites are PixelLab-generated and all audio is regenerable from the synthesis scripts.

## The gotchas

Three real ones, each of which cost real debugging time.

**A bare `tsc` in the build script silently shadowed our sources.** The build ran `tsc && vite build`, and `tsc` emitted compiled `.js` files next to their `.ts` sources. Vite resolves `.js` before `.ts`, so the dev server started serving stale compiled output while we edited the TypeScript — changes just stopped appearing. The fix is `"noEmit": true` in `tsconfig.json` (the build only needs `tsc` as a type-check; Vite does the bundling). The rule we took away: never let stray `.js` files sit in `src/`.

**You can't reliably screenshot a WebGL game, so verify behaviorally.** Phaser's canvas doesn't set `preserveDrawingBuffer`, so screenshots taken between frames come back blank or flaky. Synthetic `KeyboardEvent`s with `keyCode` are ignored by the browser, so you can't fake input that way either. Our fix: in dev builds the game instance is exposed as `window.__game`, and verification reads scene and physics state directly — player y-position, lava height, platform counts — instead of pixels. Input is driven by setting Phaser `Key.isDown` flags and stepping the player update, or emitting `keydown-SPACE` on `scene.input.keyboard` for menu handlers. Related: a hidden browser tab stops `requestAnimationFrame`, which freezes the whole game loop mid-test — you can pump frames manually with `game.step()`.

**`scene.start()` stops the scene that calls it.** Opening Settings from the main menu used `scene.start('Settings')`, which silently stopped the Menu scene. Backing out of Settings then revealed... nothing. A black screen, because the menu no longer existed. The fix is that Settings must explicitly `scene.start('Menu')` on exit rather than assuming there's a live scene to return to. If you're using Phaser's scene manager for overlay-style screens, `launch`/`pause` semantics versus `start` semantics will bite you exactly once.

## What shipped

v0.2.0 is live and public at [github.com/denrod25-del/lava-leap](https://github.com/denrod25-del/lava-leap): the full climb loop, four-stage zone progression, set-pieces, achievements, daily seeds, a shop, procedural music and SFX, pause/settings, and crash recovery. The test suite stands at 51 unit tests across 12 files plus 2 Playwright end-to-end tests, and every milestone in both releases was reviewed and verified live before merge.

This is the first post in a series on projects built this way — there are about 27 more in the queue. The running list is on the [projects page](/projects/).
