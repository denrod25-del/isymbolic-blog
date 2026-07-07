---
title: 'Rebuilding Space Invaders in Unity, One Verified Milestone at a Time'
description: >-
  A faithful 1978 Space Invaders recreation in Unity 6 (2D URP) — accelerating
  swarm, raycast projectiles, destructible bunkers, built milestone by
  milestone.
pubDate: 2026-06-12T00:00:00.000Z
tags:
  - unity
  - gamedev
  - csharp
  - arcade
project: space-invaders
heroImage: /images/space-invaders/hero.png
draft: false
---

Space Invaders is the one almost everyone can picture: a grid of aliens marching side to side, dropping a row when they hit the wall, and speeding up to a heart-attack tempo as you thin them out. Tomohiro Nishikado built that for Taito in 1978, and the acceleration was famously a happy accident — the hardware just ran faster with fewer sprites to draw. I wanted to rebuild the whole thing in Unity, faithfully, and decided on purpose rather than by accident. I built it with Claude as a pair programmer, driving Unity live through the Unity MCP bridge, and shipped v1 with all nine milestones verified in Play mode.

## What it is

This is a faithful recreation of the classic arcade loop, not a reimagining. A 5×11 grid of invaders marches in lockstep, drops and reverses at the screen edges, and accelerates as its numbers fall. You get one cannon, three lives, and the original one-bullet-on-screen rule — you can't spam shots, so every trigger pull is a small decision (the Rapid Fire and Twin Shot power-up capsules can lift that limit for a while, but the default is one shot at a time). Four bunkers sit between you and the swarm and erode from both sides as bullets and bombs chew through them. A mystery UFO drifts across the top on a long timer for bonus points, and clearing the grid starts a new, faster wave that begins one row lower. Lose all your lives, or let the swarm reach your row, and it's game over.

Around that core I allowed only modern game-feel polish — no new mechanics. There's a title screen and a game-over flow, a high score that persists to disk between sessions, screen shake, particle bursts on every kill, and a synthesized four-note marching bass that speeds up in lockstep with the swarm. The whole thing runs in Unity 6 (2D URP) and lives entirely under `Assets/_Invaders/` with its own assembly definition and `Invaders` namespace, because it shares a Unity project with a completely separate game (a metroidvania called Pipe Knight) and the two had to never touch each other.

## How it was built

The division of labor was the same one I've settled into: I decided what the game should be and verified each build by playing it; Claude wrote essentially all of the C#. We started with a brainstorming pass that became a design spec, then a plan that broke v1 into nine milestones, M0 through M8 — scaffolding, the swarm math, the game manager and UI, the player, the alien swarm, bunkers, the UFO, juice and audio, and a final flow-polish pass. Each milestone was implemented, then verified live in Play mode before moving on. The project grew to 26 scripts across that run plus several enhancement passes.

The piece I care most about is the swarm. The trickiest, most failure-prone logic — the acceleration curve and the edge-turn decision — got pulled out into a pure, dependency-free `SwarmMath` class so it could be unit-tested in EditMode with no Unity runtime at all. The speed-up is a single readable line: the step interval lerps from a slow `maxInterval` when all aliens are alive down to a fast `minInterval` when one remains, so fewer invaders literally means faster steps. That's the 1978 acceleration made deliberate. `ResolveEdge` handles the wall: it looks one step ahead, and if the leading alien would cross a limit, it signals a drop and flips the direction for the whole grid. The marching bass cadence is driven off the same step timer, so the music tightens up exactly in time with the swarm.

The second decision that mattered was making projectiles **raycast** rather than rely on collider overlaps. A player bullet travels at 18 units per second, and the bunker chunks are only 0.25 units thick. At that ratio, a fast-moving trigger collider can leap clean over a thin chunk between two physics frames and never register a hit. So `PlayerBullet` and `AlienBomb` don't translate-then-collide; each frame they cast a ray along the exact distance they're about to move, hit the first thing on the Alien or Bunker layer, and resolve through a small `IHittable` interface. No tunnelling, and it made alien hits robust as a bonus.

## The gotchas

Three that cost real debugging time.

**Unity freezes the game loop when its window isn't focused, which silently invalidates every runtime test.** Driving Unity through MCP, I'd start Play mode, alt-tab to issue commands, and read back results — except `frameCount` had stopped advancing the moment Unity lost focus, so the swarm wasn't actually marching and every "verification" was a snapshot of a frozen frame. The fix is one line at the start of each play session: set `Application.runInBackground = true`. Without it, you're testing a paused game and don't know it. A related trap: script recompiles are deferred until you exit Play mode, so editing a script mid-session does nothing until you stop.

**The swarm refused to spawn because of subscription timing.** `AlienSwarm` listened for the game's Playing state in `OnEnable`, but that ran before `GameManager.Awake` had assigned its singleton, so the subscription either missed the event or hit a null. Moving it to `Start` helped, but the real fix was architectural: I handed all (re)start responsibility to a single `LevelReset` object that owns the clean slate — it clears projectiles, rebuilds the bunkers, recenters the cannon, and spawns the wave. The swarm no longer spawns itself, which also killed a double-spawn bug on restart. One object owning "what a fresh round looks like" beat sprinkling that logic across every component.

**The HUD piled up in the center of the screen.** All the score, high-score, and lives text stacked on top of each other in the middle instead of sitting in the corners. The cause was a zero-size RectTransform on the HUD parent: a center-anchored rect with no width or height, so every child landed at the same point. Stretching that parent to fill the canvas fixed it. The same family of bug bit again later — when I added a letterbox camera to frame the portrait-ish playfield on my very wide monitor, the HUD ended up out in the black side bars, because it was a Screen-Space-Overlay canvas spanning the whole window. Switching it to Screen-Space-Camera pinned the UI inside the pillarboxed game region. Canvas render mode is one of those settings that's invisible until it's suddenly very visible.

## What shipped

v1 is complete and verified: title, play, game-over, and restart all work; the swarm marches, drops, reverses, and visibly accelerates as you thin it; the cannon fires one bullet at a time; aliens drop bombs; bunkers erode from both sides; the UFO awards its bonus; and the high score survived a full Unity restart (it loaded 1500 from disk on relaunch). On top of that I ran several enhancement passes — a player death sequence with hitstop, lives drawn as cannon icons, floating score popups, a CRT scanline overlay, pause and mute, on-screen touch controls so it's playable on an iPad, a top-five leaderboard with name entry, and weapon-drop power-ups (Rapid Fire and Twin Shot capsules that fall from killed aliens). Later I swapped the generated placeholder art for free Creative Commons sprites and audio from the open-source pivaders project, with attribution, so the final build reads like a proper space shooter rather than colored blocks.

The hero shot above is that final build — full swarm, eroding bunkers, the planet-and-stars background, and the touch buttons along the bottom. The credit for the design goes to Nishikado and the 1978 original; the work here is the faithful modern recreation of it, built one verified milestone at a time. This is part of an ongoing series on projects built this way — the running list is on the [projects page](/projects/).
