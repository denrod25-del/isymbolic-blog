---
title: "The Nineveh Aqueduct: Rebuilding a 2,700-Year-Old Stone Bridge in Blender"
description: "Reconstructing Sennacherib's Jerwan aqueduct (c. 690 BCE) in Blender — corbelled stone arches in warm hazy light, with water that's actually simulated."
pubDate: 2026-06-12
tags: [blender, 3d, archaeology, simulation]
project: nineveh-aqueduct
heroImage: /images/nineveh-aqueduct/hero.png
draft: true
---

Around 690 BCE, the Assyrian king Sennacherib built a roughly 50-kilometre canal to carry water from the hills at Khinis down to his capital at Nineveh. Where the canal had to cross a valley near the modern village of Jerwan, his engineers raised a stone aqueduct-bridge on corbelled pointed arches — centuries before Rome figured out the true voussoir arch. I rebuilt a stretch of that bridge in Blender, with Claude driving the modeling and the lighting through the Blender MCP, and then I made the water in the channel an actual fluid simulation rather than a painted-on texture.

This is a post about doing that in a single session, what made the final warm, hazy look come together, and the one bug that crashed Blender hard enough to cost me forty minutes.

## What it is

![Wide view of the reconstructed Jerwan aqueduct — four corbelled pointed stone arches carrying a channel-topped deck, in warm hazy light](/images/nineveh-aqueduct/hero.png)

The historical Jerwan aqueduct is one of the oldest known monumental aqueducts in the world. It was excavated and published by Thorkild Jacobsen and Seton Lloyd in 1935, and what they documented is what I worked from: a long stone bridge carrying a water channel across a wadi, built from limestone blocks, with the canal running along the top of the deck. The arches are *corbelled* — built by stepping successive courses of stone inward until they meet — which is what gives them their pointed profile. Sennacherib's masons did this roughly four hundred years before Roman engineers standardized the rounded voussoir arch, so the structure is a genuinely pre-Roman solution to the same problem.

I didn't try to rebuild all 280 metres of the bridge. I modeled about 80 metres of it — four of the five corbelled arches — at archaeologically plausible proportions: a deck around 22 metres wide, a water channel roughly 3 metres across cut into the top of that deck, a stilling basin upstream, and inscription stones at the abutments (Sennacherib left inscriptions on the real thing). The whole scene came to 35 objects. Where I wasn't sure of an exact dimension I kept the proportions general and grounded in the published description rather than inventing precise numbers the excavation doesn't support.

## How it was built

The split of work was the usual one for these sessions: I decided what to build and judged whether each render looked right, and Claude wrote the Blender Python that actually constructed it, calling `execute_blender_code` through the MCP to build geometry, set up materials, place the camera, and render. I was looking at real rendered frames the whole way, not a description of what the scene "should" look like.

The structure itself is precision modeling — exact dimensions typed in, not eyeballed — with the arches cut into the stone mass using boolean modifiers. The limestone is a procedural shader: a Voronoi texture at object-coordinate scale draws the block joints, tightened down to thin mortar lines so the courses read as stacked masonry rather than noise. Lighting is Cycles on the GPU with the AgX view transform at medium-high contrast, a warm sun placed low (azimuth around 115°, elevation around 18°) to rake across the arches and throw long shadows, and a gradient sky for the warm hazy desert ambient.

The part I cared most about was the water. It would have been easy to drop a flat plane with a glassy shader into the channel and call it water. Instead the channel water is a **real Mantaflow fluid simulation**: a domain over the channel, an inflow at the upstream end pushing water through at a set velocity, the stone acting as a collision effector, and the domain set to output a render-ready mesh surface. At a resolution of 128 over that small domain, 180 frames baked in about 17 seconds on my RTX 3070. The domain mesh gets a glass Principled BSDF plus a touch of volume absorption for the warm, slightly silty tint you'd expect from canal water — the simulation replaces the mesh at render time, so what you see flowing in the channel is the solved surface, not a loop.

## The gotchas

**Changing a Mantaflow parameter mid-bake crashes Blender outright.** This is the one that cost real time. If you set up a fluid domain, start stepping frames to bake the cache, and then change something like `resolution_max` while that's in progress, Blender dies with an `EXCEPTION_ACCESS_VIOLATION` — a freed mesh runtime being destructed inside the dependency graph (`MeshRuntime::~MeshRuntime`, for the curious). The fix is a discipline rule, not a code change: set **all** simulation parameters — resolution, inflow velocity, the full frame range — *before* you touch `frame_set` or start the bake, and never change them once stepping has begun. Save the `.blend` before baking, too. After I adopted that, the rebake was clean every time.

**Enum names quietly moved in the 5.x line.** Two of these bit me. The boolean solver enum I reached for from memory — the old `FAST` solver — was gone, replaced rather than renamed: the options now are `FLOAT`, `EXACT`, and `MANIFOLD`, and `EXACT` is the one that gives you crisp architectural cuts in the stone. Separately, the sky-texture method I reached for had a renamed multi-scatter enum, so rather than fight it I just used a gradient world for the sky, which gave the warm haze I wanted anyway. The lesson both times: probe what the enum actually accepts on *this* build instead of assuming the value from memory.

**Camera composition mattered more than simulation quality.** A 3-metre channel of water sitting between 1-metre stone parapets is genuinely hard to *see* — from most angles the parapets hide it completely, and a beautifully simulated surface you can't see is wasted compute. The shots that worked put the camera down at deck level, looking back upstream along the channel, so the water reads as a bright ribbon running into the haze. That framing decision did more for the final image than any bump in solver resolution would have.

And one workflow rule I re-learned the hard way: **save after every major build chunk, not just once at the start.** I'd saved the file right after creating the empty scene and then built for a while before the crash above — so the crash took the lot. The rebuild went smoothly precisely because I saved after each block of work.

## The result

![Deck-level view looking upstream along the water channel, the simulated water visible as a bright ribbon between the stone parapets, palms and a lone figure in the warm haze](/images/nineveh-aqueduct/water-channel.png)

Two hero stills came out of the session. One is the wide three-quarter view of the bridge with its four corbelled arches in the raking warm light, palms and small figures giving it scale. The other is the deck-level shot looking back upstream, where you can actually see the Mantaflow water running down the channel — the framing that finally made the simulation visible. Both went straight to my iPad for a proper look.

What I like about it is that the water is *earned*. It isn't a texture that happens to look wet; it's a solved fluid surface flowing through a structure built to real proportions from a 1935 excavation report. For a single session of pair-modeling with Claude steering Blender, getting a believable, ~2,700-year-old, pre-Roman stone aqueduct with genuinely simulated water out the other end felt like a fair trade for one hard crash and forty lost minutes.

This is one of a series of posts on projects built this way. The running list is on the [projects page](/projects/).
