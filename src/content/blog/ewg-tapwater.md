---
title: "EWG Tap Water Reports: Turning a Water Database Into County-Wide Reports"
description: "I scraped the EWG Tap Water Database for every Palm Beach County ZIP and turned it into SQLite, CSV, homeowner-friendly reports, and a dashboard."
pubDate: 2026-06-12
tags: [python, scraping, data, water]
project: ewg-tapwater
draft: true
---

The [Environmental Working Group](https://www.ewg.org/tapwater/) publishes a Tap Water Database that tells you what's actually in the water coming out of your tap — every contaminant a utility detected, how it compares to EWG's health guidelines, and what those chemicals do. The catch is that it's organized one utility page at a time. If you want to understand the water across a whole county — which systems are worst, which contaminant shows up everywhere, how your ZIP compares to the next town over — you're clicking through dozens of pages and copying numbers into your head. EWG Tap Water Reports is the thing that does that clicking for me. It scrapes the database for every ZIP in Palm Beach County, Florida, stores the results in a queryable database, and turns them into plain-English reports plus a dashboard. I built it with Claude as a pair programmer. All of the underlying data is EWG's; this tool just collects and reshapes it.

## What it is

It's a Python CLI that walks every Palm Beach County ZIP, looks up which water utilities serve each one, pulls each utility's full contaminant list off EWG's site, and lands everything in SQLite with a CSV export alongside. From that database it generates one homeowner-friendly report per utility — both HTML and Markdown — plus an index page tying them together. There's also a separate web dashboard for browsing the whole county interactively.

A single report reads the way a homeowner would want it to. For Boca Raton's water plant: 4 contaminants above EWG's health guidelines, the worst being haloacetic acids (HAA9) at 583× the guideline, then a table of the rest detected within legal limits. Each contaminant shows the level this utility reported, EWG's health guideline, the legal limit (which is often "No Legal Limit," and that gap is the point), and how many times over the guideline it runs. The reports are explicit that they present only what EWG publishes and are general information, not medical or legal advice.

The county-wide picture that falls out of a full crawl: 15 utilities, 228 contaminant records, 87 of them above EWG's health guidelines, drawn from 53 ZIP codes. The single worst reading is that Boca Raton HAA9 figure at 583× guideline. The whole thing is built around real public data about real drinking water, so I was careful to keep it honest — it reports EWG's numbers and EWG's stated potential effects, and credits EWG as the source on every page.

## How it was built

The pipeline is a straight line — fetch, parse, store, report — but each stage earned its own module, and the split between "talks to the network" and "parses HTML" was deliberate.

**The HTTP client** (`http_client.py`) is the only thing that touches the network. It sends a real browser User-Agent, waits a polite 1.5 seconds plus jitter between live fetches, retries with exponential backoff on the statuses that mean "slow down or try again" (403, 429, and the 5xx family), and caches every successful response to disk keyed by a SHA-1 of the URL. That cache is what makes development bearable: once a page is fetched, re-running the whole pipeline never hits EWG again, so I could iterate on parsing and report generation against local files. To make it testable without a network, the fetcher, sleep, and random functions are all injectable.

**The scraper** (`scraper.py`) is pure functions: HTML string in, dataclasses out, no network at all. One function parses a ZIP search-results page into a list of utilities (name, city, population served, the EWG system URL, and the PWSID — the public water system id pulled out of the link). Another parses a utility's system page into contaminants, splitting them into "above EWG's health guideline" and "other detected." Keeping this layer network-free is why the scraper has the most tests — you can feed it saved HTML fixtures and assert exactly what comes out.

**The store** (`storage.py`) is plain SQLite: a utilities table, a utility-to-ZIP mapping table (because one utility serves many ZIPs), and a contaminants table. Utilities upsert on their PWSID so re-running doesn't duplicate them, and a `scraped_at` timestamp drives the resume logic — a utility that's already been scraped is skipped unless you pass `--refresh`. It exports both CSV (for spreadsheets) and a single JSON blob with pre-computed summary stats, which is what feeds the dashboard.

**The report generator** (`reports.py`) renders Jinja2 templates per utility into HTML and Markdown, sorting contaminants worst-first by how far over the guideline they run, and builds an index page over all of them.

**The dashboard** is a separate Vite + React + TypeScript app in `web/`. The CLI's `export-json` subcommand dumps the SQLite database to `web/public/data/ewg.json`, and the single-page app fetches that — KPI cards, a sortable/searchable utility table, a click-to-open detail drawer with the above/other contaminant tables, a worst-readings leaderboard, and charts. It's a static build, deployable to Netlify with no backend.

As with my other projects, the division of labor was: I decided what it should be and made the calls, Claude wrote essentially all the code, and I drove it through a brainstorm-then-spec-then-plan flow before any implementation, building it task by task with the spec and plan checked into the repo.

## The gotchas

Three real ones, each found live against EWG's actual site.

**EWG returns 403 to anything that doesn't look like a browser.** A plain scraper request — no User-Agent, or an obvious bot one — gets a 403 Forbidden and no data. The fix is in `config.py`: send a full desktop-Chrome User-Agent plus matching `Accept` and `Accept-Language` headers, and treat 403 as a retryable status so a transient block backs off and tries again rather than crashing the run. Without that header, nothing works at all.

**EWG's "other contaminants" section has malformed, unclosed `<p>` tags.** This was the subtle one. On a utility's system page, the contaminants that are above the guideline parse cleanly, but the "other detected" section ships HTML where a value-bearing `<p>` never closes — so when BeautifulSoup builds the tree, the *next* paragraph gets nested as a child of the current one. Call `get_text()` on that and you run two unrelated values together, corrupting the units (a level and a legal limit smush into one garbage string). The fix is a small helper that takes only the element's first text node — `next(element.stripped_strings, "")` — instead of all descendant text. There's a dedicated test (`test_parse_system_other_section_units_not_corrupted`) pinning that behavior so a future refactor can't quietly reintroduce the bug.

**The page got redesigned mid-project, and selectors broke.** EWG had moved the ZIP search results into a `table.featured-utility-table` with `featured-utility-link` anchors, while the individual system pages kept their older `contams_above_hbl` / `contams_other` section ids. So the two pages needed different parsing strategies, and the search parser had to target the new table class. Worth noting: one of EWG's own CSS class names is misspelled — `potentital-effect` — so the selector has to match the typo, not the correct spelling. (I left a code comment on that one so it doesn't look like a bug.)

## What shipped

It's complete and works end to end. The full test suite is 27 tests, all passing — heaviest on the scraper, since pure HTML-to-dataclass parsing against saved fixtures is exactly the kind of thing that's worth pinning down. A full county crawl produced 15 utility reports in both HTML and Markdown, an index, the CSV and SQLite exports, and a JSON feed for the dashboard, covering 228 contaminant records across 53 ZIP codes with 87 readings above EWG's health guidelines. The dashboard browses all of it interactively.

To be clear about what it is and isn't: it's a faithful collector and reshaper of EWG's published data, scoped to one Florida county, for educational and personal use. It doesn't add any health judgment of its own — every number, guideline, and stated effect comes from the [Environmental Working Group's Tap Water Database](https://www.ewg.org/tapwater/), which is credited as the source on every report and in the dashboard. What it adds is the view EWG's per-utility layout doesn't give you on its own: the whole county, side by side, sorted by what matters.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
