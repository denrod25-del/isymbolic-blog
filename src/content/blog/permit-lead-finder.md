---
title: "Permit Lead Finder: Turning Public Permit Data Into Ranked Sales Leads"
description: "A Python tool that scores a county's public building-permit export into a ranked list of sales leads — categories, weighted signals, and 28 tests."
pubDate: 2026-06-12
tags: [python, data, sales, automation]
project: permit-lead-finder
draft: true
---

Every building permit a county issues is a public record, and every permit is also a small signal about a house: someone pulled a water-heater permit, someone's remodel inspection failed, someone re-roofed a place fifteen years ago. For a home-service business those signals are leads — but they arrive as a flat CSV export with hundreds of rows and no ranking. Permit Lead Finder is the thing that turns that export into a sorted list: each property scored, the high-intent ones at the top, with a plain-English reason attached to every score. I built it with Claude as a pair programmer, and it runs entirely on a public permit file with no scraping of anyone's private data.

## What it is

The problem it solves is narrow and real. Palm Beach County, FL — where I aimed it — has no free public permit API. Unincorporated permits live behind an account-and-fee-gated portal, the county's ArcGIS hub has no permits dataset, and the member cities each run their own fragmented system (Accela, CitizenServe, eTRAKiT). So you can't query permits live; what you *can* do is export them to CSV or Excel, the way the public records allow. That export is the input.

From there it's a scoring engine. You point it at a permit export and it reads each row, decides whether the property is a lead and why, and writes back a ranked file: a CSV plus a color-scaled Excel sheet where the score column shades from cold to hot. There's also a read-only web view (`permitfinder serve`) where you upload an export and browse the ranked leads in the browser. The whole thing works on public permit records only — permit type, description, status, dates, valuation, owner name as it appears in the public file. No skip-tracing, no private data, no scraping.

It sorts properties into four lead categories, each tuned for a different kind of home-service opportunity:

- **Failed / open inspection** (weight 35) — a failed inspection or a permit stuck in a stalled, expired, open, void, or revoked state. The highest-weighted signal, because it means an active job that isn't finished.
- **Water heater / plumbing** (weight 30) — water-heater, repipe, sewer, drain, gas-line, or water-service permits.
- **Remodel / renovation** (weight 25) — kitchen/bath remodels, additions, alterations.
- **Aging system** (weight 20) — an old water-heater, HVAC, or roof permit that's now near end-of-life: water heaters past 10 years, HVAC past 12, roofs past 18.

## How it was built

The pipeline is small and each stage has one job. A `Source` reads the export and yields normalized `PermitRecord` objects; the engine evaluates and scores each record; a grouping pass collapses records into per-property `Lead`s; a reporter writes the CSV/Excel; a Typer CLI and a FastAPI app sit on top. Column mapping is handled by YAML profiles in `profiles/` — a `pbc` profile that knows Palm Beach County's exact headers ("Permit Number", "Site Address", "Parcel Control Number", "Job Value", and so on) and a `generic` one. Pointing the tool at a different jurisdiction's export means writing a new profile, not touching code.

The scoring is rules-driven, all of it living in `rules.yaml` so I could tune behavior without editing Python. The category keywords and weights, the aging end-of-life thresholds, the valuation and recency bonuses, the multi-signal boost — they're all data. A record's base score is the weight of its strongest matching category, then two bonuses can stack on top:

- A **valuation bonus** (up to 15 points, scaling to full at a $50,000 job value) for remodel and plumbing permits — a bigger job is a bigger opportunity.
- A **recency bonus** (up to 15 points) for failed/open and remodel permits, full points if the permit is fresh within 30 days and decaying linearly to zero by two years. A failed inspection last week matters more than one from 2021.

Then properties get grouped. A single house can show up as several permit rows, so the engine keys each record by parcel ID (falling back to a whitespace-normalized address when the parcel is blank), sums the per-permit points across all of a property's permits, and adds a **multi-signal boost** of 10 points for each category beyond the first — a house that's both an aging-system *and* a failed-inspection lead is a stronger lead than either alone. The final number is clamped to 0–100, and the reasons from every contributing permit are deduplicated into one list so the output reads like "Failed inspection on record / Water heater permit from 2011 (~15 yrs old, near end of life)" rather than a wall of repeats.

I drove the build the same way I drive all of these: a brainstorm to pin down what it should do, a written spec, a task plan, then subagent-driven test-driven development. I made the product calls — the categories, the weighting, what counts as a hot lead — and Claude wrote essentially all the code, one tested task at a time.

## The gotchas

Three things that were messier than they looked.

**Public permit exports are dirty, and the parser has to expect it.** Valuations come in as `"$50,000"`, blank cells, or stray text; dates arrive in more than one format depending on the system that produced the file. So nothing in the ingest path is allowed to throw. The number parser strips `$` and commas and returns `0.0` on anything it can't read instead of raising; the date parser walks a list of formats from the profile (`%m/%d/%Y`, `%Y-%m-%d`, …) and returns `None` if none match rather than crashing the row; and the whole table is read as strings with `NaN` filled to empty so a missing column never becomes the literal text "nan." One bad cell should never lose you a row, and one bad row should never lose you the file.

**Weighting is a product decision disguised as a constant.** The first instinct is to add up every signal a property has, but that over-rewards a house with five mundane permits over one with a single failed inspection. The fix was to make a record's base the *strongest* category's weight rather than the sum, and to express "this property has multiple kinds of opportunity" as a separate, smaller multi-signal boost. Putting all of those numbers in `rules.yaml` instead of in code was the load-bearing choice: it meant tuning the model was editing a config file, not rewriting the engine, and the weights stay readable as a statement of priorities — failed inspection (35) beats plumbing (30) beats remodel (25) beats aging (20).

**The same house wears different names.** Deduplication is what separates a "lead list" from a "permit list." Two permits on one property might carry slightly different address strings — extra spaces, casing — so address-only grouping leaks duplicates. Keying on the parcel control number first, and only falling back to a normalized address when the parcel is blank, collapses a property's permits into one lead reliably. The representative permit shown for the lead is the most recent one, so the address and owner you see are the freshest on file.

## What shipped

v1 is complete and runs end-to-end on synthetic sample data, with 28 tests passing across the models, the CSV source, the engine, the reporter, the CLI, and the web view. It scores a public permit export into a ranked CSV and a color-scaled Excel sheet, serves a read-only browse-and-filter view in the browser, and does all of it from a config file you can re-tune without writing code. There's no remote yet — it lives in a standalone repo on my machine.

What's deliberately out of scope tells you what it is and isn't: no live API or scraping adapters (the `Source` interface is there for them later, but the durable value is the scoring engine), no "mark contacted" lead-status tracking, no skip-tracing, no geocoding or map view. It's a focused tool — public data in, a ranked and reasoned lead list out — and for that it does the job.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
