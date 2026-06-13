---
title: "Moving 20,724 PDFs Off iCloud Onto a Local Drive, Zero Lost"
description: "A resumable PowerShell pipeline that copied 20,724 PDFs (~253 GB) from iCloud Drive to a local disk without filling my tiny C:, then verified nothing was lost."
pubDate: 2026-06-12
tags: [powershell, windows, icloud, automation]
project: icloud-transfer
draft: true
---

I had 20,724 PDFs — ~253 GB — sitting in iCloud Drive, and I wanted them on a local disk where I actually control them. That sounds like a drag-and-drop job. It is not, for two reasons that fight each other: the files are online-only placeholders that don't exist on disk until something touches them, and the drive I could fit them on (D:) isn't the drive iCloud hydrates them onto (C:), which only had about 60 GB free. Copy them naively and C: fills up and the whole thing stalls a third of the way through. I built the transfer with Claude as a pair programmer, and it finished with all 20,724 files copied and a verify pass showing zero missing.

## What it is

It's a single resumable PowerShell script, `_transfer.ps1`, plus two helpers — a verify pass and a gap-fill pass — that together move every PDF under `~/iCloudDrive` to `D:\iCloud-PDFs`, preserving the folder structure, without ever overflowing C:.

The hard part is the dehydration problem. iCloud Drive (and OneDrive, and Dropbox) stores most files as placeholders: the name and size are on disk, but the bytes live in the cloud. The moment any process reads the file — including a plain `Copy-Item` — Windows transparently downloads the full file onto the local drive first. With iCloud that local drive is the system drive, C:. So copying 253 GB of placeholders means 253 GB momentarily lands on a C: that has 60 GB free. You don't get a clear error; you get a slow-motion disk-full stall partway through, with a pile of hydrated files clogging C: and no obvious way to resume.

So the copy can't just copy. It has to copy *and then immediately re-dehydrate the source* to give the space back, and it has to watch C: the whole time in case it's falling behind.

## How it was built

The loop in `_transfer.ps1` is small and does exactly three things per file:

1. **Copy with the long-path prefix.** `Copy-Item -LiteralPath "\\?\$src" -Destination "\\?\$tgt"`. Copying the placeholder is what triggers iCloud to hydrate it onto C: and then write it to D:.
2. **Re-dehydrate the source.** `attrib +U -P "$src"` flips the file back to online-only ("U" = unpinned/online-only, "-P" = not pinned), so the bytes that just landed on C: get evicted and the space comes back. This is the move that makes the whole thing possible — without it, C: only ever grows.
3. **A space valve.** Every 25 files the script checks `(Get-PSDrive C).Free`. If C: free drops below 15 GB, it stops copying, re-runs `attrib +U -P` across everything it has copied so far, and sleeps in 30-second intervals (up to 30 minutes) until the eviction catches up and space recovers. Then it resumes. iCloud's eviction is asynchronous, so this back-pressure loop is what keeps a fast copy from outrunning a slow dehydrate.

Resume is by size match, not a checkbox. Before copying, the script does `Test-Path -LiteralPath $tgt` and compares the existing target's length to the expected length from the manifest. If they match, skip. That makes the whole run idempotent — kill it, re-launch it, and it picks up exactly where it stopped, re-scanning only the cheap metadata. The transfer ran as a detached process so it survived between my Claude sessions; the full job took roughly a day, bandwidth-bound — by my notes, around 13 GB/hr, and C: free never fell below roughly 45 GB.

The manifest itself is the first thing the script builds: one `Get-ChildItem -Recurse -Filter *.pdf` pass over the iCloud folder, cached to `_pdf_list.txt` as `size<TAB>fullpath` lines so a restart doesn't have to re-walk 20,000 files. A separate `_status.txt` gets rewritten every 25 files with live counts, GB-on-D:, C:-free, and elapsed time, so I could watch progress without attaching to the process.

## The gotchas

Three real ones, each of which cost real time.

**An ANSI-encoded manifest silently mangled Unicode filenames.** The script cached the file list with `Set-Content`, and in Windows PowerShell 5.1 the default encoding for `Set-Content` is ANSI (CP-1252), not UTF-8. Every filename with a Greek, Arabic, CJK, or curly-quote character got round-tripped through CP-1252 and came back with `?` substituted in. Those 42 files then couldn't be addressed by path — the script tried to copy a name that no longer pointed at a real file, and they "failed." The fix was a separate gap-fill pass, `_gapfill.ps1`, that ignores the broken text manifest entirely and enumerates **live `Get-ChildItem` FileInfo objects** instead — those carry the real Unicode names in memory, never serialized through a lossy encoding. For each one whose `\\?\`-prefixed D: target was missing, it copied it. Result: 20,682 already present, 42 newly fixed, 0 still failing. And the gap-fill log itself is written with `-Encoding UTF8`, so it doesn't repeat the original sin. The lesson is blunt: for Unicode paths, never round-trip the list through a default-encoded text file — work from live FileInfo, or write the file with `-Encoding UTF8`.

**Long paths need the `\\?\` prefix or they vanish.** Plenty of these PDFs live in deeply nested folders with long names, and a fair number of full paths exceed the legacy 260-character `MAX_PATH` limit. Standard Win32 path APIs — which `Copy-Item` and `Test-Path` sit on top of — just fail on those, often quietly. Prefixing every path with `\\?\` opts into the extended-length path syntax, and suddenly the long ones copy and can be verified like any other. Both the copy (`Copy-Item -LiteralPath "\\?\$src" ...`) and the directory creation (`[System.IO.Directory]::CreateDirectory("\\?\$dir")`) use it. The same trap bites verification: a plain `Get-ChildItem | Measure-Object` undercounts because it skips the long paths it can't see, so the real count check uses `Test-Path -LiteralPath "\\?\$p"` per file.

**The space valve has to re-dehydrate, not just wait.** My first instinct for low-disk back-pressure was "pause and let it catch up." But iCloud doesn't evict hydrated files on its own schedule fast enough — the bytes from already-copied files just sit on C:. The valve only works because, while it waits, it actively re-runs `attrib +U -P` across the set of files it has already copied, forcing those evictions. Pausing alone would have deadlocked: C: stays full, the script waits forever, nothing moves.

## The result

It's done. All **20,724 of 20,724** PDFs are on `D:\iCloud-PDFs` — 252.81 GB — mirroring the original iCloud folder structure (the big buckets: `mega app` at 7,275 files, `books` at 5,690, `Downloads` at 4,069, `heavy` at 2,292, and a long tail of smaller folders). The verify pass against the manifest reports **0 missing and 0 size mismatches**, and the gap-fill pass closed the 42 Unicode-name stragglers, so the count is genuinely complete and not just "complete except the weird filenames." The originals are untouched in iCloud, left as online-only placeholders exactly as they were.

The whole thing is three short PowerShell scripts and no dependencies. The interesting engineering wasn't volume — it was the impedance mismatch between a cloud filesystem that hydrates on read and a local disk too small to hold what it hydrates, solved by a copy-then-evict loop with a back-pressure valve. If you ever need to bulk-extract files out of iCloud or OneDrive on a space-constrained machine, that's the shape of the answer: copy, `attrib +U -P` to give the space back, watch the system drive, and use `\\?\` for everything.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
