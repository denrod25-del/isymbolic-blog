---
title: 'Pipe Knight: Building a Plumber-Knight Metroidvania Stage by Stage'
description: >-
  An in-progress metroidvania prototype in Unity 6 (2D URP) — a plumber-knight
  restoring flow to a pipe kingdom, built from scripts up to a live vertical slice.
pubDate: 2026-06-13T00:00:00.000Z
tags:
  - unity
  - gamedev
  - metroidvania
  - prototype
project: pipe-knight
draft: true
---

Pipe Knight is a 2D metroidvania I'm building one stage at a time: a plumber-knight wades into an underground pipe kingdom to restore the flow, and your wrench is both your weapon and your key. It's early — a working prototype, not a game you can download — and I'm writing this up while it's still rough on purpose, because the interesting part is watching a metroidvania come together piece by piece. I'm building it with Claude as a pair programmer, the same way I've built the other projects in this series.

## What it is

The pitch is Hollow Knight by way of a plumbing manual. You explore a connected set of rooms, fight sludge and steam, and find plumbing tools that double as traversal upgrades — a Valve Turn that opens gated doors, a Pressure Dash that lets you punch through steam vents you couldn't survive before. The design has four pillars I keep coming back to: tools are weapons *and* keys, a single "Water Pressure" energy bar gates your dash and specials, every room is a hand-authored beat with a room-locked camera, and locked valve doors you see early become openable once you're holding the matching tool. That last one is the metroidvania promise — backtracking with a payoff.

The thing worth being clear about up front: this is a **2D (URP)** Unity 6 project, and it deliberately lives apart from my other Unity work. My [Space Invaders](/blog/space-invaders/) clone shares a single Unity project with this prototype, walled off under its own `Assets/_Invaders/` folder and assembly so the two never collide. Pipe Knight gets its own ground under `Assets/_Game/`. They're different genres with different physics needs, and keeping them isolated meant neither could break the other.

## How it's being built

I split the prototype into five delivery stages, each one a self-contained chunk of code that compiles and adds something playable. Stage 1, **Foundation**, is the scaffolding that everything else hangs off: a `GameManager` singleton that owns scrap, respawn point, pause and victory state and fires events outward; a `CameraFollow` that smooths toward the player and clamps to room bounds; a `RoomManager` that defines each room as a trigger volume; and an `IDamageable` interface so anything that can take a hit shares one contract.

Stage 2, **Player**, is the part a metroidvania lives or dies on — the controller. It's the usual platforming feel checklist done properly: variable-height jump, coyote time, jump buffering, wall slide and wall jump, and a dash that spends pressure energy rather than being free. Alongside it sit `PlayerAbilities` (the pressure bar plus four unlock flags for the tools), `PlayerHealth` (five hearts, knockback, invincibility frames, respawn), and `PlayerCombat` (a wrench swing that does an overlap check against anything `IDamageable`, plus a shield block). Those two stages are the solid core — the foundation and a player that genuinely feels good to move.

Stages 3 through 5 — World, Enemies, and Boss plus UI — are where it gets honest about being a prototype. The code for all of them is written: interactables (valves, doors, pumps, save stations, hazards, pickups), four enemy types built on a shared `EnemyBase` (a patrolling Sludge Crawler, a sine-wave Rust Bat, a charging Pipe Rat, a projectile-spitting Steam Wisp), and a three-phase Root Clog boss that triggers the victory screen on death. I went further and assembled a full six-room vertical slice live in Unity over the MCP bridge, then ran an "amp it up" pass — camera shake, hitstop, dash afterimages, particle bursts, eleven synthesized sound effects, a JSON save system, a parallax sewer background, and URP 2D lighting. So there's more standing up than "two stages done" suggests. But it's all placeholder art and unverified balance, which is exactly why I'm calling it a prototype.

## The gotchas

Three that cost real debugging time, all of them specific to driving Unity live.

**Unity freezes its game loop when the window isn't focused, and you won't notice.** Driving the editor over MCP, I'd enter Play mode, alt-tab to send commands, and read back state — except `Time.frameCount` had stopped advancing the instant Unity lost focus. Coroutines, physics, and enemy AI all sat frozen while MCP cheerfully answered every query, so every "verification" was a snapshot of a paused game. The fix is one line at the top of each session: `Application.runInBackground = true`. With it on, frames climbed past 7000; without it, I was testing a statue. A sibling trap: Unity defers script recompilation until you leave Play mode, so edits made mid-session do nothing until you stop.

**A "losing life with no enemy" bug that turned out to be physics, not a phantom.** The player kept taking chip damage in empty rooms. Two real culprits: ground enemies patrolled *unbounded* — they only turned at walls and ledges, and since the floors are continuous, a Sludge Crawler could wander all the way into the player's spawn point and tick away health on contact while the player stood idle. And the Steam Vents were always-on hazards with no telegraph, sitting a few units from a save checkpoint — scenery that silently hurt. The fixes were to give every patroller a `homeX` and a patrol range so it turns around before reaching a spawn, and to rewrite the Steam Vent as a telegraphed pulse (safe → warning → erupt), staggered by world position so a row of them never all fire at once.

**`BoxCollider2D` auto-sizes to the sprite the moment you add it.** Early on the player kept falling through floors. The cause was that I'd added ground colliders before fixing the sprite import to 16 pixels-per-unit, so each collider auto-sized itself to a tiny 0.16-unit box matching the unscaled sprite. The lesson, now written into the project notes: set sprite PPU *before* adding ground colliders, or set the collider size explicitly. Related, and just as costly: the project shipped with the input handler set to "New only," so every legacy `Input.GetKey` call threw — and switching it to "Both" only takes effect after a full Unity restart, which is a fun thing to not know while wondering why movement is dead.

## Where it's at

Honestly: it's an early prototype. The foundation and the player controller — stages 1 and 2 — are the parts I trust; the movement feels right and the architecture underneath it is clean. The world, enemies, and boss exist as code and as a six-room slice assembled live in the editor, but everything is placeholder art (colored shapes generated by a Python script), the balance is a first pass, and there's no public build to hand you. What's left to make it a *game* rather than a prototype is real: authored art, tuned combat and difficulty, finishing the two stubbed tools (Pipe Grapple and Flow Boots), and the long tail of content a metroidvania needs to earn its backtracking.

So this is a devlog from the middle, not a launch post. The deliverable is the source — design doc, setup guide, and the scripts under `Assets/_Game/` — that drops into a fresh Unity 2D URP project. I'll write the next entry when the slice has art on it and I can actually show you a plumber-knight swinging a wrench. This is part of an ongoing series on projects built this way; the running list is on the [projects page](/projects/).
