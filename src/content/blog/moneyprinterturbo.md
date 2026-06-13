---
title: 'MoneyPrinterTurbo, Locally: An AI Short-Video Generator on My Own Hardware'
description: >-
  Running an open-source AI short-video generator end-to-end on a local stack —
  topic in, vertical MP4 out — with a local Ollama model and no paid LLM keys.
pubDate: 2026-06-12T00:00:00.000Z
tags:
  - ai-video
  - ollama
  - python
  - tts
project: moneyprinterturbo
draft: true
---

I wanted to see how far an AI short-video pipeline could run on my own machine: type in a topic, get a finished vertical MP4 out the other end, with no cloud LLM bill and no proprietary API keys. The answer is "all the way." I took the open-source [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) project, got it running locally on Windows with Claude as a pair, swapped its language model over to a local Ollama instance, and generated a real 1080x1920, 27-second clip about the benefits of drinking water — script, voiceover, subtitles, stock footage, and all.

The project itself is `harry0703/MoneyPrinterTurbo`. None of the pipeline is mine. What's mine is getting it to run end-to-end on local hardware and working through the handful of things that broke along the way.

## What it is

MoneyPrinterTurbo is a one-click AI short-video generator. You give it a subject or a keyword and it produces a finished short: it writes a script with an LLM, derives search terms from that script, pulls matching stock footage, synthesizes a voiceover, generates timed subtitles, and stitches the whole thing together with ffmpeg into a 1080p vertical MP4.

Concretely, the pipeline that ran on my machine looked like this:

1. **Script** — the LLM takes the topic ("The benefits of drinking water") and writes a short narration plus a list of visual search terms.
2. **Footage** — those search terms hit a stock-video source (I used Pexels) and the matching clips get downloaded into a local cache.
3. **Voiceover** — the narration is read aloud by a TTS engine (edge-tts, the free Microsoft Edge voices).
4. **Subtitles** — the audio is turned into a timed `.srt` that's burned onto the video.
5. **Render** — ffmpeg concatenates the footage, lays the voiceover and optional background music underneath, overlays the subtitles, and outputs the final MP4.

It's a Python MVC app. There are two ways in: a Streamlit WebUI on port 8501, and a FastAPI service on port 8080 (with Swagger docs at `/docs`). I drove it almost entirely through the WebUI.

## How it was built

Getting it running locally was the whole exercise, so the "build" is really a setup-and-port story.

**The environment.** My default Python is 3.14, which the project rejects — it wants `>=3.11,<3.13`. `uv sync` solved that cleanly by provisioning its own Python 3.11.15 into a project-local `.venv`. ffmpeg was already on my PATH from a winget install. From there, the WebUI launches via `.\webui.bat`, which auto-selects the `.venv` Python and finds a free port in the 8501–8599 range.

**The language model.** This is the part I most wanted to keep local. The project supports a long list of LLM providers, but I didn't want to pay for any of them or hand over keys. So I pointed it at a native Windows [Ollama](https://ollama.com/) instance running `qwen2.5:7b` on `http://127.0.0.1:11434/v1` — free, unlimited, and entirely on my own RTX 3070. Script generation on the 7B model took roughly three and a half minutes per run. That's slow compared to a hosted API, but it's free and it never rate-limits.

**The footage.** Stock video is the one piece that genuinely needs an external service, since you can't synthesize generic B-roll locally. I used Pexels with a free API key. Everything else in the chain — the voice (edge-tts), the subtitles (edge), the render (ffmpeg) — is free and needs no key.

So the final working configuration is: local Ollama for the script, Pexels for the footage, edge-tts for the voice, edge for subtitles, ffmpeg for the render. The only thing leaving my machine is the footage search.

## The gotchas

Three things cost real debugging time.

**The Pollinations free tier is effectively unusable, so I switched to local Ollama.** The config template's default pointed at Pollinations as a free LLM (my own `config.toml` has since been corrected to local Ollama, but a fresh clone still starts from the template default), and that default is broken two ways. The shipped `pollinations_base_url` (`https://pollinations.ai/api/v1`) returns a 405, and even after fixing it to the correct endpoint the code already knows about (`https://text.pollinations.ai/openai`), the anonymous free tier just returns `429 Too Many Requests` on essentially every call. There's no usable free LLM hiding in there. The fix was to stop fighting it and run the model myself: local Ollama with `qwen2.5:7b`. Slower per request, but it actually completes.

**The WebUI rewrites `config.toml` from memory, so you edit the disk file *then* restart.** This one is a genuine trap. The running Streamlit app holds its startup config in memory and rewrites `config.toml` on every rerun, reverting any hand-edits you make to the file while it's running. I'd change the LLM provider on disk, the app would quietly stomp it back, and I'd wonder why my change had no effect. The fix is the right order of operations: stop the WebUI, edit `config.toml` on disk, *then* restart `webui.bat` so it reads the new values into memory on startup. (The rewrite itself isn't corruption — it's the app persisting UI defaults. It just fights you if you edit out of band.)

**Streamlit's first-run email prompt blocks a headless launch.** On its first run, Streamlit prints an interactive "enter your email" prompt, which hangs `webui.bat` when there's no one to answer it. The fix is to pre-create `~/.streamlit/credentials.toml` with an empty email:

```toml
[general]
email = ""
```

With that file in place, the prompt is satisfied and the WebUI boots straight through.

(One more cosmetic one: during the render the Windows console spews `UnicodeEncodeError: charmap can't encode ①` lines. That's just loguru failing to print circled-number glyphs to the cp1252 console — the video renders fine regardless.)

## What shipped

It works end-to-end, locally. The verification run produced a real `final-1.mp4`: 1080x1920, H.264 video with AAC audio, 27.0 seconds long, on the topic "The benefits of drinking water." The script was written by the local `qwen2.5:7b` model, the voice is edge-tts (Jenny), the subtitles are a generated `.srt`, and the footage came from Pexels — assembled by ffmpeg into a finished vertical short. Nothing in that chain cost a cent or required a proprietary LLM key.

All credit for the generator goes to the upstream [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) project. My contribution was narrow but specific: getting it to run entirely on local hardware on Windows, replacing the LLM with a local Ollama model, and documenting the fixes — the Pollinations dead end, the config-rewrite ordering, and the Streamlit email prompt — so the next person can skip the part where I lost an afternoon.
