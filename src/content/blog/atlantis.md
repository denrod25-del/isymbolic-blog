---
title: Building Plato's Atlantis in Blender — a Parametric Ring City
description: >-
  Generating Plato's concentric-ring Atlantis in Blender from a parametric
  script: water and land rings, a gold-domed Temple of Poseidon, and an
  orichalcum wall.
pubDate: 2026-06-12T00:00:00.000Z
tags:
  - blender
  - 3d
  - render
  - art
project: atlantis
heroImage: /images/atlantis/hero.png
draft: false
devtoId: 4108008
---

In Plato's *Critias*, Atlantis is laid out as a set of concentric rings — a central island crowned by the Temple of Poseidon, wrapped by alternating bands of water and land joined by bridges, sealed by a great outer wall, and pierced by a canal running out to the open sea. It's one of those descriptions that's basically a build spec already. So I had Claude write a single parametric Blender script that generates the whole city from that geometry, and rendered it a few different ways. This is a post about what the script does and how the renders turned out.

## What it is

![Three-quarter view of the Atlantis ring city at sunset — concentric stone rings of water and land around a central gold-domed temple, ringed by mountains](/images/atlantis/hero.png)

The scene is the city as Plato describes it, built from the centre out. A central acropolis carries the Temple of Poseidon. Around it run three pairs of rings — water, then land, then water, then land — each land ring scattered with buildings, all of it enclosed by a defensive wall and ringed by mountains. A canal cuts straight out through the rings to the sea.

The look is clean and stylized rather than photoreal — smooth marble-white platforms, a gold dome, red-and-gold roofs on the scattered structures, simple conical mountains. It reads more like an architectural model or a diorama than a photograph, and I think that suits a half-legendary city. Everything is driven by a config block at the top of the script, so the island radius, the number and width of the rings, the building count, and the direction of the canal are all just numbers you can change.

## How it was built

The split of work was the usual one for these sessions: I decided what to build and judged whether each render looked right, and Claude wrote the Blender Python. The whole thing is one file, `atlantis.py`, that runs headless (`blender --background --python atlantis.py`) or from Blender's text editor, and writes a still at the end.

The geometry is generated procedurally, not modeled by hand. The rings and platforms are built with `bmesh` rather than primitives — there's a `disc` helper that lays down a solid cylinder for the central island, and a `ring` helper that builds a hollow annular band for each ring of land, both walked vertex by vertex around 96–140 segments. The script plans the concentric layout first, marching a radius outward and appending a `(water, land)` pair for each ring, then builds each band at the right inner and outer radius. A single huge sea disc underneath fills every water ring and extends out as the open ocean.

The buildings are scattered, not placed. For each land ring the script drops a set number of structures at random angles and radii — sometimes a round tower with a conical roof, sometimes a rectangular hall — picking from a small palette of marble, stone, and wall materials, with roofs in red tile or gold. It deliberately keeps a wedge clear where the canal runs so nothing gets built across the channel. Because it's seeded (the config fixes the random seed), the same layout comes back every run.

The centrepiece is the Temple of Poseidon, built explicitly rather than scattered: a stepped circular marble base, a ring of sixteen columns, an entablature and a rounded gold dome, topped with a small golden finial. The other set pieces follow Plato's text too — bridges span each water ring along the cardinal axes (skipping the one direction the canal occupies), and the great outer wall is a ring of stone capped and studded with towers, tipped in gold to stand in for *orichalcum*, the legendary metal Plato says sheathed Atlantis. A band of conical mountains encircles the whole thing.

Materials are plain Principled BSDF shaders set up in code — a palette of sea, land, stone, marble, gold, roof-red, wall, and mountain, each just a base colour with roughness and the odd metallic or transmission value. There are no image textures and no procedural node graphs; the clean diorama look comes entirely from flat-coloured materials under a single sun. The render is EEVEE (the script asks for EEVEE Next and falls back to plain EEVEE), at 1600×1000, with a single sun, a blue-tinted world for ambient light, and an elevated three-quarter camera tracked to the centre of the city. For the hero pass I dropped the sun low and warm to get the sunset light; that's a lighting choice for the shot, not something the script hardcodes.

One small thing worth noting from the code: the material socket for transmission got renamed across Blender versions, so the helper tries `Transmission Weight` first and falls back to `Transmission`. That's the kind of version drift that quietly breaks Blender scripts, and it's handled here by probing for whichever socket name exists rather than assuming one.

## The renders

![Overhead daylight view of the full Atlantis plan — the complete concentric ring layout under a blue sky, mountains all around](/images/atlantis/plan.png)

I rendered the scene a few ways by varying the camera and the lighting. The hero above is the sunset pass: a low warm sun raking across the rings, the gold dome catching the light, long soft shadows. It's the most flattering angle — close enough to read the temple and the red-roofed towers, low enough to feel like you're standing on the outer wall.

The daylight render here is the plan view — a higher, wider three-quarter angle under a plain blue sky that shows the whole concentric layout at once: the temple at dead centre, the three rings of water and land, the wall, and the mountains closing the ring. It's the shot that makes the *Critias* geometry obvious.

The third pass is an "underwater" variant — the same city under a heavy teal-green cast, as if the legend had played out and Atlantis had sunk. I should be honest about what that is: it's a colour-and-lighting grade of the same geometry, not a true underwater scene. There's no volumetric water, no caustics, no floating particulate — just the green tint and flatter light selling the idea. It works as a mood, but it isn't a simulation, and I'd rather say so than overclaim it. There's also a turntable that spins the city for a full rotation.

## Notes

This one is mostly a geometry exercise: take a 2,000-year-old text that happens to read like a spec, turn it into a parametric generator, and see the legendary city come out the other end with its rings and bridges and gold-roofed temple in the right places. Because every dimension is a config value, it's less a single render than a little machine for making Atlantises — more rings, a wider canal, a different seed, and you get a different city that still obeys Plato. The clean stylized look is a choice the materials make for me, and the sunset pass is the one I'd hang on the wall.

This is one of a series of posts on projects built this way. The running list is on the [projects page](/projects/).
