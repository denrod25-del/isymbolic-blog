---
title: 'Skyhop: Building a 3D Platformer Movement Feel, Driven Through Unity MCP'
description: >-
  A movement-first 3D platformer prototype in Unity — A Short Hike meets Toree
  3D — with coyote time, input buffering, hold-to-glide, and 10 EditMode tests.
pubDate: 2026-06-12T00:00:00.000Z
tags:
  - unity
  - gamedev
  - 3d
  - prototype
project: skyhop
heroImage: /images/skyhop/hero.png
draft: true
---

Skyhop is a 3D platformer prototype I'm building in Unity, and right now it's exactly one thing: a movement feel. No levels, no enemies, no goal — just a character, a greybox gym, and a controller I keep tuning until jumping around feels good. The whole thing is being driven through Claude over the Unity MCP connector, which means I describe the mechanic and Claude writes the C# that goes into the editor. This is an in-progress prototype, not a shipped game. I'm posting it now because the interesting part — getting a 3D platformer's movement to feel right — is mostly done, and the rest is feel-tuning.

## What it is

The target is a blend of two games I like for opposite reasons. **A Short Hike** has a relaxed, floaty traversal feel — you glide off ledges and the world forgives you. **Toree 3D** is the other end: tight, responsive, snappy, built around precise little jumps. Skyhop is trying to land between them — a responsive core you can trust for precise platforming, plus a hold-to-glide that lets you drift and recover. (Those are influences, not assets — no code or art from either game is in here.)

So far that means a character who can:

- walk and run, with an orbit camera you steer independently
- jump with **variable height** — tap for a hop, hold for a full leap
- benefit from **coyote time** (a few frames of grace to jump after walking off a ledge) and **input buffering** (a jump pressed just before landing still fires)
- **hold-to-glide** — keep the jump button held past the apex and you settle into a gentle constant descent with full air control

The visual is a blocky LEGO-minifigure-style character (built out of primitive cubes) bouncing around a greybox "movement gym" — colored platforms and gaps laid out specifically to exercise each mechanic. The hero shot above is that gym: the character in the middle, a step-up staircase on one side, and the glide-gap platforms on the other.

The project is Unity 6000.4.9f1 on HDRP, using the New Input System. First-party code lives under `Assets/_Game/` in a `Skyhop.Runtime` assembly.

## How it was built

The division of labor is the same one I use on every project: I decide what the movement should feel like, Claude writes the code. The twist here is that Claude isn't handing me files to paste — it's driving the Unity editor directly through the **Unity MCP connector**. It creates scripts, wires components onto the player prefab, sets tuning values, and reads back transforms and test results, all without me touching the editor for the plumbing. I play the build, say "the jump feels mushy," and we adjust.

The movement system is split into pieces on purpose. The actual jump and glide math lives in a pure, side-effect-free class called `MoveMath` — given inputs and tuning constants, it returns velocities. That separation is the whole reason the feel is testable: the math doesn't need a running game to verify, so it has **10 EditMode unit tests** asserting things like jump apex height and glide descent rate. The rest is a thin `PlayerMotor` wrapping Unity's CharacterController, a `PlayerController` that reads input and asks `MoveMath` what to do, and a `MovementTuning` ScriptableObject (`DefaultMovementTuning`) holding every feel constant in one editable asset.

The mechanics that make it feel responsive are the classic platformer tricks, all built on top of that core:

- **Variable jump height** comes from cutting upward velocity early when you release the button, plus asymmetric gravity (you fall faster than you rise).
- **Coyote time** keeps a short grounded-grace timer running after you leave the ground, so a late jump press still counts.
- **Input buffering** remembers a jump press for a few frames so one made just before landing fires the instant you touch down.
- **Hold-to-glide** kicks in when you're holding jump past the apex — `MoveMath.GlideVertical` swaps the fall for a slow constant descent while leaving horizontal air control fully intact.

The camera is Cinemachine — a `CinemachineCamera` with `OrbitalFollow` tracking a target on the player, with the orbit axes driven by my own small input script rather than Cinemachine's built-in axis controller, so look input stays consistent with the rest of the New Input System setup.

The build came up in milestones: docs (M0), greybox gym (M1), walk/run (M2), orbit camera (M3), jump (M4), glide (M5). Each one got verified before moving on. Because Skyhop renders fine but EditMode tests run headless, the verification loop is mostly numeric — call a method, read the resulting transform or velocity — rather than watching pixels.

## The gotchas

Three real ones, each from actually building this.

**You can't verify game feel from a screenshot, so verify it numerically.** Entering Play mode in Unity drops the MCP bridge — the connector stops listening the moment the editor leaves edit mode, so live play-mode tool calls just fail until I press Stop. That sounds fatal for verifying movement, but the fix is the same separation that made the code testable: the jump and glide math is pure, so I verify it by calling the methods directly and reading the numbers. An early sanity check moved the player exactly 3.98 m as computed and reported it grounded — no play session needed. The lesson that kept paying off: if a mechanic's correctness can be expressed as "given this input, the velocity should be X," put it in a pure function and test it in EditMode.

**The camera collapsed inside the player and turned the screen into a solid color.** I added a `CinemachineDeoccluder` to stop the camera clipping through walls, and instead it slammed the camera straight into the character's own collider — the player is the nearest obstacle, so the deoccluder pulled the camera *inside* it. I tried scripting the player's tag so the deoccluder would ignore it, and that quietly didn't work either: setting `.tag` on a *prefab instance* from a script doesn't register as a serialized override (you need `PrefabUtility.RecordPrefabInstancePropertyModifications`, or you edit the prefab asset itself). The pragmatic fix was to just remove the deoccluder for now and revisit obstacle avoidance later with a layer-based setup — environment on its own layer, player excluded.

**A fresh HDRP scene renders near-black.** Spin up an empty scene on HDRP and there's no exposure configured, so everything comes back almost pitch black — which made early screenshots useless. The fix for the gym was a directional light at 10,000 lux plus a Sky & Fog Global Volume with an Exposure override set to Fixed / 12. One subtlety worth writing down: set the light's HDRP intensity directly via the additional-data component, and the `LightUnit` enum lives in the HDRP namespace, not `UnityEngine`. Also, positioned screenshots taken through a temporary camera still come out black because that temp camera doesn't see the exposure volume — capture the game view through the scene's actual Main Camera instead.

## Where it's at

Milestones M0 through M5 are done: greybox gym, walk/run, orbit camera, jump (variable height, coyote time, input buffering, asymmetric gravity, air control), and hold-to-glide. As of the last build session, the pure movement math had **10 EditMode tests, all green**. The character moves, jumps, and glides around the gym, and it already feels closer to the Short-Hike-meets-Toree blend I'm after than I expected at this stage.

What's left is **M6, the feel-tuning pass** — playtesting every value in `DefaultMovementTuning` and nudging it until the whole thing feels right, plus tightening the gym layout (as of the last build session the glide was reaching about 7.8 m and one glide-gap target sat around 10 m away, so that platform needs to come closer). There's also an open question I haven't settled: whether to stay on HDRP or move to URP before any real art goes in.

So: a working movement prototype, not a game yet. But movement is the part of a platformer that everything else rests on, and that part is standing up. This is one of a series of posts on projects built this way with Claude as a pair programmer — the running list is on the [projects page](/projects/).
