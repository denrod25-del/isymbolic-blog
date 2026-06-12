---
title: "SymStudio: Forking and Rebranding OBS Studio Into My Own Build"
description: "How I forked OBS Studio, built it from source on Windows, and rebranded it into a portable SymStudio.exe — plus an installer, theme, and starter scenes."
pubDate: 2026-06-12
tags: [obs, cpp, windows, ai]
project: symstudio
heroImage: /images/symstudio/hero.png
draft: true
---

SymStudio is my personal rebrand of OBS Studio — the same broadcasting engine, with its own name, icon, About dialog, and eventually its own theme and starter scenes. I built it with Claude as a pair programmer, starting from a clone of the OBS repo and ending with a portable `SymStudio.exe` that runs straight from a folder. OBS is GPLv2, so this is allowed: GPLv2 requires keeping the source open and the license and copyright notices intact, and removing OBS's trademarks and logo while keeping a "Based on OBS Studio" note is the clean way to do it.

## What it is

SymStudio is OBS Studio's engine wearing different clothes. v1 was a pure rebrand with zero new features: the executable is `SymStudio.exe` instead of `obs64.exe`, the window title and taskbar entry say "SymStudio", the app icon is a custom cyan aperture monogram, and the About dialog reads "SymStudio / Based on OBS Studio (GPLv2)". Everything underneath — capture, encoding, scenes, plugins — is untouched OBS. The internal config directory under `%APPDATA%` was deliberately left as `obs-studio`, so an existing OBS user keeps their profiles and settings.

That was the whole point of v1: prove I could take a large, real C++ application, build it from source, and reskin it cleanly without breaking the engine. Once that held up, v2 started adding things that are actually mine — an NSIS installer, a guided Welcome dock, a default "Midnight Cyan" theme, and a one-click starter-scenes pack.

The division of labor was the usual one for these projects: I decided what SymStudio should be and which trade-offs to make, Claude wrote the code and ran the build battles. I was the one clicking "yes that's the icon I want" and live-verifying each gate.

## How it was built

The strategy was deliberately boring: build vanilla OBS first to prove the toolchain works, then rebrand on top of a known-good build. The rebrand started on a `symstudio-rebrand` branch forked from a specific upstream commit (`f61619c`), which means vanilla OBS is always recoverable — if I ever need a clean reference build, that commit is one checkout away. (That branch has since been merged and deleted; only `master` exists now.)

OBS ships a modern CMake preset (`windows-x64`) that auto-downloads its prebuilt dependencies — Qt, FFmpeg, CEF, x264 — so configuring is two commands:

```powershell
cmake --preset windows-x64
cmake --build --preset windows-x64 --config RelWithDebInfo
```

That produces a portable run directory at `build_x64\rundir\RelWithDebInfo\bin\64bit\`, and `SymStudio.exe` runs from there with no install step.

The rebrand itself was kept to a deliberately small, well-defined surface so the engine stayed pristine. It touched exactly the user-facing identity and nothing else:

- The executable name in `frontend/CMakeLists.txt` (`obs64` → `SymStudio`).
- The window title and Qt app display name in the frontend widgets and `OBSApp.cpp`.
- The application, window, and tray icons (a generated aperture "S" — I picked option 5 of five logo concepts the generator produced).
- The user-facing locale strings in `frontend/data/locale/en-US.ini`.
- The About dialog and its `About.Info` attribution string.

The v1 rebrand landed in eight commits, engine untouched, fast-forwarded onto `master`. The whole thing is regenerable: `assets/make-logos.py` re-renders all five logo concepts, and `assets/make-icon.py` rebuilds the multi-resolution `.ico`.

v2 went deeper into the frontend. The Welcome dock (`frontend/widgets/SymStudioWelcomeDock.{hpp,cpp}`, ~245 lines) is a real Qt dock registered in `OBSBasic::OBSInit()`, mirroring how OBS registers its own stats dock. It has quick-action buttons that drive OBS through its existing machinery — `QMetaObject::invokeMethod` for menu actions, `obs_frontend_*` for stream/record — plus a one-second timer that auto-detects your setup progress (do you have a source? audio? a stream key? are you live?) and a rotating tips strip. The Midnight Cyan theme is a glossy navy-and-cyan variant of OBS's Yami theme, shipped as a `.ovt` file and set as the default. And the starter-scenes pack builds a four-scene collection (Starting Soon / Live / BRB / Ending) programmatically from Pillow-generated overlay art.

## The gotchas

**The CMake preset hardcodes a specific compiler and SDK, and "newer" doesn't satisfy it.** My machine had Visual Studio 2026 installed, but OBS's `windows-x64` preset pins the generator to *"Visual Studio 17 2022"* and the platform toolset to Windows SDK `10.0.22621`. VS 2026 does not stand in for VS 2022 here — the configure step just fails. The fix was to install the **VS 2022 Build Tools alongside** 2026 and add the **SDK 22621** component. Newer is not a superset when a build pins exact versions.

**The C++ Desktop workload alone isn't enough — several OBS plugins need ATL.** Once VS 2022 was in place, the build still failed compiling `frontend-tools`, `obs-qsv11`, and the `win-dshow` virtualcam, all of which include `atlbase.h` / `atlstr.h`. The default Desktop C++ workload doesn't bundle ATL. The fix was adding the `Microsoft.VisualStudio.Component.VC.ATL` component. One non-obvious wrinkle: a non-elevated `setup.exe modify --quiet` silently no-ops in a non-interactive shell (it returns in ~40ms having done nothing) — `winget` with `--force --override` handles the UAC elevation correctly and actually installs the component.

**Keeping vanilla recoverable mattered more than it sounds.** Because I forked from a pinned commit and kept the rebrand on its own branch, "is this bug mine or OBS's?" was always answerable by diffing against `f61619c`. That discipline is also what let the rebrand merge as a clean fast-forward with the engine provably untouched. The one honest caveat I'll flag: **auto-update is not rebranded and won't work** — `updater/updater.cpp` still waits for and relaunches `obs64.exe` and points at OBS's servers. That's harmless for a portable build, but it would need real work before any SymStudio release that actually ships updates.

## What shipped

v1 is complete and live-verified: `SymStudio.exe` (about 9.4 MB) builds, launches, and shows SymStudio branding across the title bar, taskbar, tray icon, and About dialog, with the preview pipeline fully working. All of it merged to `master`.

v2 added the parts that make it feel less like a reskin and more like its own app:

- **An installer** — `SymStudio-32.1.2-windows-x64.exe`, a ~190 MB NSIS installer produced via CPack, with SymStudio branding, shortcuts, and an uninstaller.
- **A Welcome dock** — guided quick-start with auto-detecting setup checklist and rotating tips.
- **A Midnight Cyan theme** — glossy navy-and-cyan, set as the default.
- **Starter scenes** — one click installs a four-scene SymStudio Starter collection with Midnight Cyan overlay art.

![SymStudio with the Midnight Cyan theme](/images/symstudio/hero.png)

The roadmap from here is Streamlabs-style parity: a Twitch chat dock, a stream-info dock, and alerts — most of which need a Twitch client ID and OAuth, with read-only chat being the one piece that can run on plain IRC.

This is a local, personal build — there's no public repo to link to, and SymStudio doesn't use OBS's trademarks or logos. Full credit for the engine belongs to the OBS Project and its contributors. It's one of a series of projects I've been building this way; the running list is on the [projects page](/projects/).
