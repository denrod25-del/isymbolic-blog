---
title: "Archiving All 291 of My Own Saved Scribd Docs With Playwright"
description: "A small resumable Playwright tool that pulled down all 291 documents saved on my own Scribd account — surviving the daily quota and a session expiry."
pubDate: 2026-06-13
tags: [playwright, automation, archival, nodejs]
project: scribd-dl
draft: true
---

I had 291 documents saved on my own Scribd account — papers, manuals, technical PDFs I'd bookmarked over the years — and no good way to get them onto my disk where I actually keep things. Scribd's "Saved" page is a single scrolling wall of items, and there's no "download all." So I built a small Playwright tool to walk my saved list and pull down each document I had access to, one at a time. It finished with all 291 downloaded and zero failures, across two runs separated by a day, because Scribd has a daily download quota that I had to wait out. I built it with Claude as a pair programmer.

To be clear about what this is: it archives the documents I had saved under my own subscriber account, using the same download button Scribd shows me in the browser, and only for documents whose uploader enabled downloading. It's personal archival of content I already had access to — not a paywall bypass and not mass scraping.

## What it is

It's three short Node scripts in `C:\Users\skyea\claude\scribd-dl\`, each doing one job, sharing a saved login session:

- `login.js` opens a real browser, lets me log in by hand, and saves the authenticated session to `auth.json`.
- `collect.js` reuses that session, scrolls my Saved page until nothing new loads, and writes every document URL to `urls.txt`.
- `download.js` walks `urls.txt`, opens each document, drives the download dialog, and saves the file into `.\downloads\`.

The problem it solves is mundane but real: a couple hundred things I'd saved, write-only in practice because there's no bulk export, and I wanted local copies I control. The same instinct drove a couple of my other projects — this one happens to feed directly into the next. The PDFs it pulled down became the source corpus for [Book Library](/blog/book-library/), the local GPU RAG that lets me ask questions across my downloaded PDFs and get cited answers. Archiving the documents was step one; making them searchable was step two.

## How it was built

Playwright drives a headless Chromium with the saved session attached, so every page loads as if I were logged in. The interesting part isn't the automation in general — it's the specific sequence the download dialog needs, and the fact that the run had to survive being interrupted.

The download flow that actually works took some probing to nail down. For each document, `download.js`:

1. Clicks a *visible* download trigger — the sticky-toolbar button (`[data-e2e="doc-actions-download-button-sticky_metadata_column"]`) is the reliable one, because the equivalent button in the metadata column is often scrolled off-screen and not clickable.
2. Waits for the modal to open, which offers a format combobox and a confirm control. The confirm control is an `<a data-e2e="modal-download-button">` — an anchor, not a button — which matters because if you wait for a button selector it never appears.
3. Optionally switches the format combobox to PDF (it defaults to PDF for some docs and DOCX for others), then clicks the confirm anchor while listening for Playwright's `download` event with `Promise.all`, so the click and the event-wait race together instead of missing the event.

The resumable design is what made the whole thing survivable. Before opening any page, the script reads the `downloads\` folder into a set of filenames it already has, keyed by the document's numeric ID and slug. If a document is already on disk, it skips it without even opening a browser tab. That makes the run idempotent: kill it, re-launch it, and it picks up exactly where it left off, re-fetching only what's missing. There's a deliberate 3-second pause between downloads to stay polite and avoid tripping rate limits.

The division of labor was the same as my other projects: I decided what it should do, Claude wrote essentially all the code, and we drove it through the diagnostic scripts (`probe.js`, `inspect.js`) to figure out the real selectors before committing to the download loop.

## The gotchas

Three real ones, each of which cost actual time.

**The daily quota is invisible until you learn its signature.** Scribd caps how many documents you can download per day. When you hit it, the modal still opens normally — the format picker, the confirm link, all of it — but the file simply never arrives. Playwright sits there until the `download` event times out. There's no error banner, no "you've hit your limit" message; the only tell is that the download *event* (not the page, not the modal) times out, over and over. The fix is a streak counter: a timeout specifically on the download event increments it, any other kind of error resets it, and after 8 consecutive download-event timeouts the script stops early and tells me to re-run tomorrow. That's exactly what happened — run one got 193 of 291 before the streak tripped, and run two the next day picked up the remaining 98.

**The confirm control is an anchor, not a button.** My first instinct was to wait for and click a `<button>` in the download modal. That selector never resolved, and the step timed out looking like a quota hit when it wasn't. The actual confirm element is an `<a>` tagged `data-e2e="modal-download-button"`. Waiting on that selector and clicking it is what completes the download. The lesson: probe the live DOM for the real element instead of assuming a control is a button because it looks like one.

**A scrolled-off button is "present" but not clickable.** The metadata-column download button exists in the DOM on every document page, so a naive `locator(...).click()` would find it — and then fail or do nothing, because it was scrolled out of the viewport. Scoping the locator to `:visible` and preferring the sticky-toolbar trigger fixed it. Element presence isn't the same as clickability, and Playwright's auto-waiting won't save you from a control that's technically there but off-screen.

(One more worth noting: a fair number of my saved items turned out to be content-farm spam uploads — the downloads for those are tiny ad-filler PDFs. And books or audiobooks, which are DRM reader content rather than uploaded files, don't produce a download at all. The tool correctly skips anything the uploader didn't enable for download, since that's a Scribd-side permission it can't change.)

## What shipped

It's done. All **291 of 291** saved documents are in `.\downloads\`, with **0 failures** — split across two runs (193 then 98) because of the daily quota, with the resumable skip logic making the second run trivial: it walked the same `urls.txt`, skipped everything already on disk, and fetched only the 98 that were missing. No re-discovery, no duplicates, no manual bookkeeping.

The whole tool is three short scripts plus a couple of diagnostics, and the only dependency is Playwright. The engineering that mattered wasn't volume — 291 isn't a big number — it was making the run idempotent enough to survive a forced overnight pause, and reverse-engineering a download dialog that hides its quota behind a silent timeout. Those downloaded PDFs went straight into [Book Library](/blog/book-library/), where they stopped being a pile of saved links and became something I can actually search.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
