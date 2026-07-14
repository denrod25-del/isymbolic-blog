---
title: 'Building Aseprite From Source: A Paid Pixel-Art Editor, Free If You Compile It'
description: >-
  Aseprite is a paid pixel-art editor whose source is public. I compiled it from
  source on Windows — and the CMake version trap that almost stopped me cold.
pubDate: 2026-06-12T00:00:00.000Z
tags:
  - cpp
  - cmake
  - windows
  - pixel-art
project: aseprite-build
draft: false
---

Aseprite is a pixel-art editor and animation tool that costs about twenty dollars on Steam and itch.io. It's also source-available: the full source lives on GitHub, and the project explicitly allows you to compile it yourself for your own use. So I did. I cloned the repo, fought the toolchain, and ended up with a working `aseprite.exe` (~20.6 MB) that launches and reports "Aseprite 1.x-dev" — the same editor, built by me, on my own machine. I did it with Claude as a pair programmer, and most of the work was untangling exactly one non-obvious trap.

## What it is

Aseprite is the editor a lot of pixel artists reach for first: a tight tool for drawing sprites, tilesets, and frame-by-frame animation, with onion skinning, palette management, and sprite-sheet export. The binaries are paid, but the source is genuinely public — not open-source in the OSI sense, but source-available under its own EULA. The distinction matters: building it for personal use is explicitly fine, while redistributing the binaries you produce is not. So this is a build-it-yourself story, not a fork-and-republish one. Full credit for the editor belongs to Igara Studio S.A. — David Capello and contributors; my work here was purely getting it to compile on Windows.

Why bother compiling something you can buy? Partly because the option exists and it's a clean test of a real toolchain — Aseprite is a substantial C++ codebase with a pile of vendored dependencies and a custom graphics backend. If you can build it, you can build almost anything. And partly because a build you control is a build you can patch, instrument, or pin to a specific commit. My checkout sits at `7063d5362`, near the `v1.3.18-beta3` tag on `main`.

The division of labor was the usual one for these projects: I decided what I wanted and made the judgment calls, and Claude wrote the scripts, read the error logs, and worked out which knob to turn next.

## How it was built

Aseprite's renderer is built on [Skia](https://skia.org/), Google's 2D graphics library — the same one behind Chrome's canvas. Skia is famously painful to compile from scratch, so the good news is you don't have to. Aseprite's own `build.sh --auto` downloads a **prebuilt Skia** matching the version the project expects, which is `m124-08a5439a6b` (the exact tag is pinned in `laf/misc/skia-tag.txt`). That one decision removes the single biggest source of pain from the whole build.

The toolchain that worked:

- **Visual Studio 2022 Build Tools** for the compiler (`cl` 14.44, x64). My machine also has VS 2026, but Aseprite officially targets VS 2022, so I pointed the build at the 2022 Build Tools deliberately rather than letting it find the newer one.
- **CMake 3.31.6, portable** — unzipped into `.deps/`, used instead of the CMake 4.x I had installed via winget. This is the trap; more on it below.
- **Ninja 1.13.2** as the build generator.
- **Prebuilt Skia m124**, auto-downloaded into `.deps/skia-m124/`.

The repo ships a `build.cmd` for Windows, but it's not usable as-is on my setup: it hardcodes a Visual Studio 2022 **Community** vcvars path I don't have (I have the Build Tools, not the full IDE), and it ends in a `pause` that hangs any non-interactive run. So I wrote a thin launcher, `build-everything.bat`, that does four things in order: prepends the portable CMake and Ninja to `PATH`, calls the VS 2022 Build Tools `vcvars64.bat` to set up the compiler environment, prints a tool-check so I can see exactly which `cl`, `cmake`, and `ninja` are about to run, and then hands off to the official `build.sh --auto --norun` through Git's bundled `sh.exe`. The `--auto` flag does the Skia download and dependency wiring; `--norun` keeps it from launching the editor when it finishes.

To rebuild after a source change, I just re-run that one batch file — Ninja handles the incremental build from there.

## The gotchas

**CMake 4.x refuses to configure the build, and "newer" is the problem, not the fix.** This is the one that cost the most time and is the single most important thing to know if you try this yourself. CMake 4.x removed support for old `cmake_minimum_required` declarations: if a project (or any library it pulls in) asks for a minimum CMake version below 3.5, CMake 4.x treats it as a hard error and stops. Aseprite vendors a stack of dependencies, several of which still declare ancient minimums — 2.4, 2.8, 3.0, 3.2, 3.4. With the winget-installed CMake 4.3.3, configuration dies on the first one it hits. The fix is counterintuitive: install an *older* CMake. I dropped a portable **CMake 3.31.6** into `.deps/` and put it ahead of everything on `PATH`. CMake 3.31 only *warns* about those old minimums instead of erroring, so the configure step completes. If you take one thing from this post: when a C++ project with vendored libraries won't configure, check your CMake version before you change anything else — bleeding-edge CMake is often the cause, not the cure.

**The repo's own `build.cmd` assumes a setup you probably don't have.** It's written for someone running full Visual Studio 2022 Community, so its vcvars path is wrong for a Build Tools install, and the trailing `pause` means it can't be driven by a script or an agent. Rather than patch it in place, I left it alone and wrote a small launcher that sets the environment explicitly and calls the cross-platform `build.sh` underneath. The lesson that generalizes: when a project's convenience script doesn't match your environment, the official `build.sh --auto` is usually the more honest path — it's what the project actually maintains, and it does the dependency fetching for you.

**Don't try to build Skia yourself — let `--auto` fetch the pinned binary.** It's tempting to think "build from source" means building *everything* from source, including Skia. Resist it. Aseprite pins an exact Skia revision (`m124-08a5439a6b`) because its renderer depends on that specific API surface, and `build.sh --auto` downloads a matching prebuilt artifact for you. Compiling Skia by hand would mean reproducing Google's depot_tools-based build and then hoping the version matched — hours of work to arrive at the same binary the script grabs in seconds. The pin in `laf/misc/skia-tag.txt` is the source of truth if you ever need to know which revision your build expects.

## What shipped

A working `build/bin/aseprite.exe`, ~20.6 MB, that launches and runs as the real editor — drawing, palettes, animation timeline, the lot — built entirely from source on Windows. Re-running `build-everything.bat` does an incremental rebuild, so the whole thing is reproducible from a clean checkout: portable CMake 3.31, VS 2022 Build Tools, Ninja, and the auto-downloaded Skia m124.

To be clear about what this is and isn't: it's a personal build of someone else's software, allowed under Aseprite's source-available license for exactly this kind of self-compiling. There's no binary to hand out and no fork to link — the value was entirely in getting a large, real C++ project to compile cleanly, and in pinning down that the CMake version was the thing standing in the way the whole time.

It's one of a series of projects I've been building this way; the running list is on the [projects page](/projects/).
