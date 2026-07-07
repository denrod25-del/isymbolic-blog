---
title: 'PDF to Podcast, Locally: Running NVIDIA''s Blueprint Without Their Keys'
description: >-
  I took NVIDIA's pdf-to-podcast blueprint and ran it on a fully local stack —
  tiered Claude writes the script, Kokoro does the voices, no NVIDIA or
  ElevenLabs keys.
pubDate: 2026-06-12T00:00:00.000Z
tags:
  - tts
  - local-llm
  - python
  - audio
project: pdf-to-podcast
draft: false
---

NVIDIA shipped a neat blueprint called **pdf-to-podcast**: feed it a PDF and it generates a two-host podcast — a real audio file of two voices discussing the document, complete with a planned outline and back-and-forth dialogue. The catch is that out of the box it wants NVIDIA NIM endpoints for the language model and ElevenLabs for the voices, both of which mean API keys and per-call billing. I wanted to know whether the pipeline itself was good, and then whether I could run the whole thing on my own machine with no NVIDIA or ElevenLabs accounts at all. So I cloned it and built a local-stack overlay. Credit where it's due: the pipeline, the agent flow, the whole "outline then dialogue then audio" shape is NVIDIA's work. What I did was swap the cloud pieces out and fix the things that broke when I did. I built the overlay with Claude as a pair programmer.

## What it is

The original is a multi-service blueprint. A document goes in, a Docling-based service extracts the text, an agent service summarizes it and plans an outline, then turns that outline into a two-speaker conversation, and a TTS service renders the conversation to audio. The services talk over Redis and store artifacts in MinIO. You POST a PDF, poll a status endpoint, and eventually pull a finished audio file. It's a genuinely good pipeline — the part I wanted to keep.

My goal was narrow: run that exact pipeline with zero NVIDIA and zero ElevenLabs dependencies. The overlay is seven files. The language-model layer gets a `provider` field so each role can route to Anthropic, OpenAI, Ollama, or the original NVIDIA NIM, and `models.claude.json` wires the three roles the blueprint already splits work across — `reasoning`, `iteration`, and `json` — to tiered Claude models. The TTS service gets its ElevenLabs calls replaced with [Kokoro](https://github.com/hexgrad/kokoro), an open TTS model that runs locally and renders 24 kHz mono audio. The result is the same blueprint, the same API, but every external call now hits either the Anthropic API or a model running on my own machine. With the right `.env`, a POST of a PDF comes back as a playable WAV and nothing went to NVIDIA or ElevenLabs.

## How it was built

The script side uses **tiered Claude**, and the tiering isn't something I invented — the blueprint already separates its LLM calls into three roles, presumably because the authors knew not every step needs the same horsepower. The overlay just maps those roles to Claude models: Sonnet for the heavy reasoning (summarizing the document, planning the outline), Haiku for the cheap iterative folding steps, and Sonnet again — at a larger token budget — for the final structured-JSON step that emits the actual dialogue. That last assignment was a lesson, not a default; more on that below.

The voice side is **Kokoro**. The TTS service loads one Kokoro pipeline once, maps two speaker slots to two Kokoro voices (the defaults are `af_heart` and `am_michael`), and renders each dialogue turn. The two voices alternate so the output sounds like a conversation, not a monologue. The audio is written out as a single 16-bit PCM WAV through `soundfile`, which matters because of a bug I'll get to.

For scanned PDFs there's an **easyocr** path. Plenty of the documents I actually wanted to feed it are image-only scans with no text layer — the extractor would otherwise grab nothing useful (or worse, grab a watermark). The OCR workflow renders the target pages to images, runs easyocr over them, rebuilds a clean text-layer PDF, and feeds *that* into the pipeline. It's slow on CPU and it reads code and symbols poorly, but for prose it produces text clean enough that the summarizer is happy.

The division of labor was the same as my other projects: I decided what the overlay should do and made the calls about which model goes where, and Claude wrote essentially all of the code and the tests.

## The gotchas

Three real ones, each of which cost actual debugging time.

**A "3-minute podcast" came out 42 minutes long.** This was the one that genuinely surprised me. The outline step plans segment durations in *seconds* — a sensible two-minute plan might be segments of 20, 30, 30, 25, and 15 seconds. But a downstream step stored those numbers into a field that the rest of the pipeline treats as *minutes*, multiplying by a per-minute word budget. So a 2-minute request quietly became a 21,600-word target and produced a 42-minute monster. The fix is a `normalize_segment_durations` step that rescales whatever numbers the model emits so they sum to the requested total, unit-agnostic, before anything downstream reads them. On top of that there's a hard cap, `cap_dialogue_words`, set at `WORDS_PER_MINUTE = 130` (Kokoro's real speaking rate), that trims the generated dialogue down to the word budget while always keeping the final sign-off turn. After both fixes, in my testing a 3-minute request lands at about 3.04 minutes regardless of how verbose the source document is. The tradeoff is that very wordy content generates-then-trims, which wastes some tokens, but a request for N minutes now reliably yields roughly N minutes.

**The model kept emitting JSON that wouldn't parse — so I stopped trusting it to.** The final step asks the model to re-emit the entire conversation as one strict JSON object, and that turned out to be the architecturally fragile part of the whole pipeline. It would return the dialogue as a JSON *string* (double-encoded), and that inner string was itself malformed — unescaped quotes inside the text, mangled unicode, the occasional `"K&R"` breaking the parse. A strict `json.loads` rejects all of it. The fix came in layers: first bump that role to Sonnet (Haiku failed it outright, returning a scratchpad with the dialogue field missing); then, when the string is still malformed, fall back to `json-repair`; and finally an entry sanitizer that rebuilds the dialogue list by hand — keeping only entries with real text, coercing a missing speaker by alternating from the previous turn, and unescaping the text. After the sanitizer the step is structurally unable to fail schema validation no matter what the model hands back. Verified on real failing data in my run: 51 entries, zero invalid.

**The key wiring resolved to empty even though it was set.** The compose file originally interpolated `ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}` from the shell. My shell exports an empty `ANTHROPIC_API_KEY`, and Docker Compose lets a shell variable shadow the one in `.env` — so the value resolved to empty string and every Claude call failed for no obvious reason. The fix was to give the agent service `env_file: [.env]` and delete the interpolation line entirely, so the key is read straight from the file. I confirmed it by checking the key length inside the running container (108 characters, not zero). It's the kind of bug that looks like an auth problem and is actually a config-precedence problem.

(There was also a smaller one worth flagging: the original TTS service concatenated audio at the byte level, which corrupts the WAV because each turn carries its own header. Rendering all the samples and writing a single WAV header — with 350 ms of silence inserted between turns — fixed both the corruption and the pacing.)

## What works now

It runs end-to-end on a stack with zero NVIDIA and zero ElevenLabs keys. A smoke test against a sample PDF produced a valid 24 kHz mono 16-bit WAV through the API — POST the PDF, poll status, GET the audio — using only an Anthropic key and local Kokoro. The duration normalization and the hard cap mean a requested length actually maps to roughly that length: the C++ chapter that once overshot to nearly 8 minutes now lands at 3.04 minutes for a 3-minute request in my run. Both text PDFs and scanned image-only PDFs work, the latter via the easyocr path. The JSON-repair-plus-sanitizer chain holds up against the malformed output the model genuinely produces.

It's not perfect. The fragile part is still the final "re-emit everything as strict JSON" step — I made it un-failable, but un-failable is not the same as elegant, and a future version should probably stop asking the model to round-trip the whole conversation through JSON at all. TTS on CPU is slow (no GPU is wired into that container yet), and the OCR path reads code and symbols badly. The large-document story is also weak: the pipeline is built for short documents and sends the whole text in one summarize call, so a 900-page reference blows past the context window — for now the answer is to trim to the chapter you actually want. But for the thing I set out to prove — that NVIDIA's pdf-to-podcast blueprint can run, end to end, on a fully local stack with none of the keys it asks for — it delivers, and it produces a real audio file at the length I asked for.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
