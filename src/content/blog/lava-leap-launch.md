---
title: 'Shipping Lava Leap: itch.io, the Play Store, and a Bug Told by Telemetry'
description: >-
  Taking a browser game to real players — the itch build path that 404s, the
  clip encoder bug I wrongly dismissed, and the telemetry that proved the fix.
pubDate: 2026-08-30T00:00:00.000Z
tags:
  - gamedev
  - phaser
  - telemetry
  - ai
project: lava-leap
heroImage: /images/lava-leap-launch/hero.png
draft: false
---

[Lava Leap](/blog/lava-leap/) was a finished endless climber sitting on a Vercel URL. This is what happened when I tried to put it in front of people who hadn't been told about it — the publishing paths, the bug I had explained away months earlier, and the instrumentation that finally settled the argument.

It's playable at [bsymbolic.itch.io/lava-leap](https://bsymbolic.itch.io/lava-leap) and on the web, with an Android build mid-flight.

## The itch.io build that 404s

Publishing an HTML5 game to itch is genuinely a ten-minute job, with one landmine that costs an evening.

Vite emits absolute asset paths — `/assets/index-abc123.js`. itch serves games from a subpath on its CDN. So the preloader renders, the browser requests `/assets/…` at the CDN root, gets a 404, and the JavaScript never loads. The canvas stays empty. Nothing in the console tells you the problem is your build configuration.

The fix is one flag:

```bash
npx tsc && npx vite build --base=./
```

Relative paths. The Vercel build stays on the default base — this is an itch-specific package, not a global change. Alongside that: the project Kind must be set to HTML, the uploaded file has to be ticked "played in browser," and the embed wants explicit dimensions with mobile and fullscreen enabled. And itch won't let you upload anything until you've verified your account email, which is a fine policy and an annoying surprise at the moment you're trying to ship.

Once it was up I verified the whole loop from the itch origin rather than assuming: boot, menu, name prompt, a real run, death, and then score submission, player rank and telemetry events all firing against the live backend from a third-party domain. Cross-origin is exactly where a game's backend calls quietly stop working.

## The bug I had already dismissed

Months earlier, the highlight-clip feature shipped with a note in my own project notes: downloaded clips look choppy and fast-forwarded, but that's a headless-rendering artifact from the test environment, not a real bug.

Then a real player on a real machine said the clips were choppy and fast-forwarded.

The writeoff was wrong, and the mechanism is worth knowing if you ever record a canvas. `canvas.captureStream(30)` **samples** the canvas on a timer. Phaser runs with `preserveDrawingBuffer: false`, which means the drawing buffer is only reliably readable immediately after a render. So the sampler mostly caught invalid or stale reads — measured at roughly 9 effective frames per second under load — and stamped every one of them at the nominal 30 fps. Twelve seconds of gameplay became a few seconds of compacted, sped-up video.

The fix is to stop sampling and start driving: `captureStream(0)` for a manual stream, then `track.requestFrame()` on Phaser's `POST_RENDER` event, when the buffer is guaranteed valid, throttled to about 30 fps. `preserveDrawingBuffer: true` went in as a safety net for the fallback path.

Post-fix measurements on a real GPU: a 12.3-second run produced a 12.79-second clip at 29.8 fps with tight 33 ms frame deltas. Under 6× CPU throttling, with the game itself down to 42 fps, a 14.57-second run produced a 14.65-second clip. Duration tracks wall clock in both cases, which is the actual invariant.

**The invariant whose absence let the bug ship is now a test.** There's an end-to-end regression asserting that clip duration falls within 0.6–1.4× of run duration. That test would have failed on the original implementation.

The standing rule that came out of it, now written into a brief every implementing agent reads: *no unexplained measurement ships, and calling something an "artifact" requires demonstrating the mechanism.* I had used the word "artifact" as a synonym for "I don't want to investigate this."

A related trap that fooled me three separate times: a synthetic playtest bot that mashes jump dies organically and then retries. A "suspiciously short" clip is usually a perfectly correct clip of run number two. Measurements now use a survival helper that keeps the bot alive.

## Telemetry that measures itself

While instrumenting the encoder fix I discovered something worse: the `track()` function had been a **silent no-op in production since v5.** No sink was ever wired up. Every analytics event the game had emitted for five versions went nowhere.

The replacement is a write-only sink shaped like the leaderboard client: a nine-event whitelist locked by a sorted-array test, batching at ten events or fifteen seconds, `keepalive` so a closing tab still flushes, a cap of twenty batches per session, a lazily-generated UUID player id, and complete dormancy when the environment variables are absent. Server-side it's a table with zero row-level-security policies — no direct reads or writes possible — behind a rate-limited RPC.

The event that matters is `clip_ready`, which reports the recorded duration, the actual media duration, and the ratio between them. A healthy encoder reports ~100. The old bug reported ~29. **The first genuine production `clip_ready` came back at ratio 100** — 7,880 ms recorded against 7,892 ms of media. The encoder fix was confirmed by the encoder's own telemetry, from a real player's browser.

That's the shape I'd repeat: when you fix a bug you can't easily reproduce, ship a measurement of the thing that was broken, not just the fix.

## The store, which is mostly waiting

Google Play is the slow path. The app exists, the signed AAB is built and verified, the store listing and data-safety forms are done, and internal testing is active. But a new personal developer account must run a **closed test with 12 testers for 14 consecutive days** before it can go to production. There's no engineering that shortens that.

So itch and the web are the public presence in the meantime, which is the right call anyway — a browser game that needs no install is a lower-friction ask than an APK.

Two build gotchas worth recording. The Android game-intervention opt-out attribute is `android:allowGameDownscaling`, not the plausible-sounding alternative; get it wrong and `aapt` hard-fails. And Samsung's Game Optimizing Service was rendering the app at 75% resolution and 60 Hz, which felt like input lag and wasn't — measured, the touch path delivered 92 of 92 rapid taps. Diagnosing that took wireless ADB, a Chrome DevTools Protocol hook over a raw WebSocket, and `adb reverse` to get past my own firewall. The finding was that the "bug" was a platform power policy, and the fix was an opt-out file rather than anything in the game loop.

## Where it stands

Live on itch and the web, verified end to end from the itch origin including leaderboard and telemetry. 265 unit tests and 36 end-to-end tests. The keystore is backed up. The Play closed test is running out its fourteen days.

The pattern across all of it: shipping surfaced three real bugs — the itch base path, the encoder, and the dead telemetry — that no amount of local development had. Two of them had been sitting in the codebase for months looking fine.

More projects built this way are on the [projects page](/projects/).
