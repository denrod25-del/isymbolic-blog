---
title: 'Browser Video Editor: Trim, Cut, and Export MP4 Without a Server'
description: >-
  A fully client-side video editor built with Claude — trim, multi-clip
  timeline, text overlays, and a real H.264+AAC MP4 exported in-browser via
  WebCodecs.
pubDate: 2026-06-12T00:00:00.000Z
tags:
  - react
  - typescript
  - webcodecs
  - video
project: browser-video-editor
draft: false
devtoId: 4056038
---

Browser Video Editor is a video editor that runs entirely in your browser. You import local clips, trim them, arrange them on a timeline, drop text overlays on top, scrub a live preview, and export a real `.mp4` — and the video files never leave your machine. No upload, no backend, no server doing the encoding. I built it with Claude as a pair programmer, and v1 is complete and merged to `master`.

## What it is

The shape of it is a Classic non-linear editor: a media bin on the left, a preview canvas in the middle, a properties panel on the right, and a full-width timeline underneath. You click **+ Import video** to pull a local file into the bin, click a clip to drop it onto the timeline, and from there you can adjust its in/out points, split it at the playhead, reorder clips, delete them, and add text overlays with their own position, size, color, and start/end times. The preview plays, pauses, and scrubs, and every edit redraws immediately.

Then you hit **Export MP4** and get an actual H.264 video file with AAC audio — each clip's original sound preserved and stitched in sequence — muxed together in the browser. That last part is the whole point. Plenty of "browser editors" are really thin clients that ship your footage to a render farm. This one does the encode locally, which is why your files stay on your machine.

The stack is React, TypeScript, Vite, Tailwind, and Zustand, with Vitest for the unit tests. There's deliberately no backend. Export leans on the WebCodecs API, which today means **Chrome or Edge** — preview and editing work anywhere, but on Firefox and Safari the Export button is disabled with a note explaining why.

## How it was built

The division of labor was the usual one: I decided what the editor should do, and Claude wrote essentially all of the code. We started from a design spec and an implementation plan that split v1 into 16 test-driven tasks, built via subagent-driven development with separate code-review passes, and I verified the result in a real browser before signing off.

The architecture has one idea holding it together: a single source of truth and a single way to draw a frame. The Zustand store in `src/store/editorStore.ts` owns the entire `Project` — the clips, the ordered timeline items, the text overlays, the playhead. Nothing else holds state. On top of that sit pure selector functions in `src/timeline/selectors.ts` that derive everything you actually render: the timeline layout, and crucially "what is active at time *t*". Those selectors are pure, so they're fully unit-tested without any DOM.

The piece I care most about is `Compositor.drawFrame(ctx, project, time, videoFor)`. It renders exactly one frame — the active clip plus whatever overlays are live at that moment — and it is shared by **both** the preview player and the exporter. The `requestAnimationFrame` player in `PreviewPlayer.ts` calls it to paint the canvas as you scrub; the exporter calls the same function frame-by-frame as it encodes. That's what makes the editor what-you-see-is-what-you-get: there is no separate "render path" that can drift from the preview. If a text overlay looks right while scrubbing, it looks right in the file, because the same function drew both.

The export path itself (`src/export/Exporter.ts`) is where WebCodecs earns its keep. It walks the timeline at 30fps, and for each frame it seeks the relevant source `<video>` element to the right source time, draws the composited frame to an offscreen canvas, wraps it in a `VideoFrame`, and feeds it to a `VideoEncoder` configured for H.264 (`avc1.42001f`). Audio is handled separately and more bluntly: it allocates one big merged `AudioBuffer` via an `OfflineAudioContext` (used for its `decodeAudioData` to pull in each clip's `[in, out]` slice), then a manual loop copies each clip's samples into place at the right timeline offset, chunks that buffer into `AudioData` blocks, and runs them through an `AudioEncoder` for AAC. Both streams go into `mp4-muxer`, which finalizes an in-memory MP4 that gets handed to the user as a download.

## The gotchas

Three real ones, all from the export path, all of which had concrete fixes.

**WebCodecs encoders fall over if you don't respect backpressure.** A `VideoEncoder` will happily accept frames faster than it can encode them, and the encode queue grows until things get ugly — memory balloons, frames stall. The fix is to watch `encoder.encodeQueueSize` and stop feeding it when the queue gets too deep. The exporter has a small `drainQueue` helper that awaits `setTimeout(0)` in a loop until the queue drops below 30 outstanding frames before it submits the next one, for both the video and audio encoders. Without that drain, a longer timeline would push the encoder past where it can keep up. This was one of the issues a code-review pass specifically flagged and fixed.

**Seeking a `<video>` element can silently never finish.** Exporting works by setting `video.currentTime` and waiting for the `seeked` event before drawing that frame. The problem is that `seeked` doesn't always fire — a seek to a time the browser considers "already there", or an edge near the end of a clip, can just hang, and a hung seek freezes the entire export. The fix is twofold: skip the wait entirely when the requested time is within a millisecond of the current time, and arm a 1000ms `setTimeout` fallback that resolves the promise anyway if `seeked` never arrives. The export would rather draw a slightly stale frame than deadlock forever.

**Audio sync is a sample-offset problem, not a timestamp problem.** It's tempting to encode each clip's audio as its own stream and trust timestamps to line everything up, but the reliable approach turned out to be doing the arithmetic by hand. The exporter allocates one merged buffer sized to the whole timeline, then for each clip computes the in-point sample, the slice length in samples, and the destination offset (`start * sampleRate`), and copies samples straight into the merged buffer at that offset — clamping mono sources up to stereo and guarding the bounds. Everything is resampled to a fixed 48kHz / 2-channel target so there's exactly one sample rate to reason about. Building the audio as a single correctly-offset buffer before encoding is what kept the sound aligned with the picture.

## What shipped

v1 is complete and merged to `master`: import, trim, cut/split, a multi-clip reorderable timeline, text overlays, live canvas preview, and in-browser MP4 export with audio. The suite is 27 Vitest tests across the store, the pure selectors, an id helper, and the WebCodecs capability check, and `tsc` plus the production build are clean.

The export was verified, not assumed. When v1 was done, the end-to-end run produced a valid 4.5-second, 1280×720 MP4 with the trim correctly applied and 2-channel / 48kHz AAC audio, confirmed by playing it back in an actual `<video>` element and decoding the audio track with `decodeAudioData`. A real file, with real sound, made entirely in the browser.

Some things were left out of v1 on purpose — transitions, filters and color grading, a separate music track, undo/redo, and project save/load — but the data model leaves room for all of them. This is part of a series on projects built this way; the running list is on the [projects page](/projects/).
