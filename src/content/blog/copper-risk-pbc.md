---
title: "Copper Risk PBC: Scoring Tap-Water Corrosion From Water Chemistry"
description: "A Python engine scoring copper-corrosion risk in Palm Beach County water via LSI, RSI, Larson-Skold, and a PHREEQC-validated CCPP solver. Then the data ran out."
pubDate: 2026-06-12
tags: [python, chemistry, water, data]
project: copper-risk-pbc
draft: true
---

How corrosive is your tap water to the copper pipes it runs through? That's a chemistry question with a real answer, and water utilities have computed it for decades using a handful of saturation and stability indices. Copper Risk PBC is my attempt to compute those indices for one specific water system — Palm Beach County Water Utilities, EPA public-water-system ID FL4504393, a groundwater system serving about 619,000 people — and turn them into a screening band per distribution zone. I built it with Claude as a pair programmer. The engine works and is validated against the USGS gold-standard model. The data to point it at is the part that's stuck.

To be clear up front: this is a data-and-chemistry tool, not health advice. It's about whether water sits in equilibrium with calcium carbonate scale, not about whether anyone should drink anything.

## What it is

The question is cuprosolvency — the tendency of water to dissolve copper from the plumbing it sits in. Soft, low-pH, poorly buffered water with no protective mineral scale is aggressive toward copper; harder, well-buffered, slightly scale-forming water lays down a protective calcium carbonate film and is gentle on it. The corrosion literature has standard closed-form indices for exactly this, and the engine computes four of them from a zone's plant chemistry:

- **LSI (Langelier Saturation Index)** = pH minus the pH of calcium-carbonate saturation. Negative means undersaturated and corrosive; positive means scale-forming.
- **RSI (Ryznar Stability Index)** = 2·pHs − pH, an empirical companion to LSI scaled so that under ~6 is scaling and over ~7 is corrosive.
- **Larson-Skold Index** = the ratio of chloride-plus-sulfate to alkalinity (in equivalents). Above ~1.2, those aggressive anions disrupt the protective carbonate film. This is the one that captures "the water is full of chloride," which the saturation indices miss.
- **CCPP (Calcium Carbonate Precipitation Potential)** = how many mg/L of CaCO₃ actually precipitate (positive, protective) or dissolve (negative, aggressive) when the water is brought to equilibrium with calcite. Unlike LSI/RSI, CCPP tells you *how much* scale, not just which direction — which is why it needs a real equilibrium solver, not a formula.

`score_zone()` takes seven inputs per zone — pH, temperature, TDS, calcium hardness, alkalinity, chloride, sulfate — runs all four indices, and returns a screening band (`low` / `elevated` / `high`) plus a list of plain-English drivers like `low pH (6.8)` or `negative CCPP (-7.2 mg/L — dissolves protective scale)`. The band is deliberately a transparent heuristic: low pH is weighted heavily, and the band escalates with the number of concurrent risk factors. The whole runtime is pure Python standard library — zero install.

The thing I want to be honest about, and the code's own docstring is blunt about, is that the band is a *screening triage*, not a validated predictor of copper concentration at the tap. The only things that prove copper risk are measured copper (the 90th-percentile CU90 value utilities report) or a fully calibrated equilibrium model against utility-specific data. The band tells you which zones deserve a closer look; it doesn't tell you a number of micrograms.

## How it was built

The division of labor was the same as my other projects: I decided what to build and made the chemistry calls, Claude wrote essentially all the code, test-first.

The three closed-form indices in `corrosion_indices.py` were the easy part — they're algebra over the Langelier saturation-pH formula and ion equivalents. I validated them against a published worked example (Corrosion Doctors' LSI calculation) plus hand-computed oracles. The hard part was CCPP.

CCPP isn't a formula; it's the answer to "solve the carbonate system to equilibrium." `ccpp.py` does it properly. When x moles of CaCO₃ transfer, calcium, total carbonate, and alkalinity all shift in fixed stoichiometric ratios; at every candidate x the carbonate system fixes pH from the alkalinity-and-CT balance, and calcite solubility has to hold. The solver bisects on x until the saturation residual crosses zero, with an inner bisection (in log space) solving free [H⁺] from alkalinity and CT at each step. The thermodynamics are real: temperature-dependent K₁, K₂, and Ksp(calcite) from Plummer & Busenberg (1982), Kw from Harned & Hamer, and activity coefficients from the Davies equation with ionic strength estimated from TDS.

Writing an equilibrium solver from constants is exactly the kind of thing that's *plausibly* right and silently wrong, so I validated CCPP against **PHREEQC** — USGS's reference geochemical model — via `phreeqpython`. Across five waters spanning saturation index −1.8 to +0.9, the constants matched textbook pK values to within ±0.01, saturation indices agreed within 0.04, and CCPP agreed within 1.7 mg/L. PHREEQC stays a *validation-only* dev dependency: the oracle values are hardcoded into the tests, so the engine and the test suite run with no scientific Python stack at all.

With the engine validated, the next track was getting real chemistry to feed it. The natural first stop is **SDWIS**, EPA's Safe Drinking Water Information System, queried through the Envirofacts REST API. I pulled the full system profile and every Lead and Copper Rule sample for FL4504393. And that's where the project hit its wall (next section).

The fourth track was monitoring. Because the relevant federal data is a quarterly-ish API rather than a stream, I built an **n8n** workflow — "Copper Risk — SDWIS Monitor (FL4504393)" — that runs on a weekly schedule, fetches the SDWIS payload, runs a code node that detects whether any copper results have appeared and summarizes the lead numbers, logs to a history Data Table, and (when copper finally shows up) fires a Gmail alert. It's been live-tested end to end against the real payload. The core runs with no credentials; it just needs a Gmail credential and recipient filled in before the alert branch fires, which it isn't yet.

## The gotchas

Three real ones, each of which shaped the project.

**Validating a from-scratch equilibrium solver needs an external oracle, and that oracle is PHREEQC.** A carbonate-equilibrium CCPP solver has a dozen places to be subtly wrong — a conditional-constant conversion, an activity-coefficient exponent, a stoichiometry sign — and none of them throw an error; they just give you a believable-but-wrong number. Hand-computed oracles catch gross mistakes but not the activity-model details. The fix was to check the whole thing against PHREEQC on a spread of five waters from undersaturated to supersaturated. That's also where I learned the residual gaps weren't bugs: the leftover difference is the expected mismatch between my Davies activity model and PHREEQC's WATEQ one. Knowing the *source* of the remaining disagreement is what let me call it validated instead of chasing it to zero.

**The public federal database has no copper data for this system — so a records request became the critical path.** This is the finding that reframed the whole project. SDWIS returns lead 90th-percentiles for FL4504393 across four monitoring periods (0.0014 to 0.002 mg/L, all roughly 7–10× *below* the 0.015 mg/L action level), but it returns **no copper (CU90) rows at all** — I verified that with a direct joined filter that came back empty — and it carries none of the corrosion chemistry (hardness, alkalinity, TDS, chloride, sulfate) the indices need. So the one public, free, automatable source can't actually score copper risk here. The engine is built, tested, and validated, and it is sitting idle waiting for chemistry it can't get from SDWIS. The fix isn't code: it's a drafted Florida Chapter 119 public-records request to the utility and FDEP for the Monthly Operating Report chemistry. That request is the literal critical path, and it's a slower loop than any debugging session.

**LSI needs calcium hardness specifically, not total hardness.** Easy to get wrong because "hardness" colloquially means total hardness, but the Langelier saturation pH is derived from calcium concentration. Feeding it total hardness (calcium plus magnesium) biases the index optimistic. The inputs and the docstrings call this out explicitly so that whatever MOR data eventually arrives gets mapped to the right field.

## Where it's at

The engine is done and trustworthy: `corrosion_indices.py`, `ccpp.py`, and `score_zone.py`, 34 passing tests under TDD, with CCPP validated against PHREEQC and the three closed-form indices validated against a published worked example. The SDWIS pull is done and documented. The n8n monitor is built and live-tested. The second n8n workflow — ingest a real MOR spreadsheet and map indices to ZIPs — is designed but deliberately deferred until I have an actual MOR file to design against, because guessing a spreadsheet's shape is how you build the wrong importer.

What's pending is the part I can't write code for. The records request is drafted and ready to send; until the utility returns its Monthly Operating Report chemistry (or copper finally shows up in SDWIS and the monitor pings me), the validated engine has nothing real to score. That's an honest place for a project to be: the hard technical part — a PHREEQC-validated geochemical solver in pure standard-library Python — is finished, and the thing blocking it is a public agency's response time.

Credit where it's due: the validation oracle is **PHREEQC** (USGS), and the data source is **SDWIS** (EPA Envirofacts).

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
