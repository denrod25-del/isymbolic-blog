---
title: "Three AI Security Scanners, Side by Side"
description: "I stood up garak, AI-Infra-Guard, and vigolium together to see what each actually covers — model-layer, infra-layer, and web-app-layer scanning."
pubDate: 2026-06-12
tags: [security, llm, docker, ai]
project: ai-security-scanners
draft: true
---

"AI security scanner" is one of those phrases that sounds specific until you try to act on it. Scan *what*, exactly — the model's responses? The infrastructure it runs on? The web app it's bolted into? Those are three different jobs, and the tools that do them aren't interchangeable. So I installed three of them on the same machine — [garak](https://github.com/NVIDIA/garak), [AI-Infra-Guard](https://github.com/Tencent/AI-Infra-Guard), and [vigolium](https://github.com/vigolium/vigolium) — and ran each one far enough to see where its lane actually starts and stops. None of these are mine; the work here was the setup and the comparison, not the scanners themselves.

## What it is

Three open-source security tools, each owned by someone else, each pointed at a different layer of the stack:

**garak** is NVIDIA's LLM vulnerability scanner (authored by Leon Derczynski). Its own README pitches it as "nmap or Metasploit, but for LLMs," and that framing is exactly right: it probes a model's *responses* for jailbreaks, prompt injection, data leakage, toxicity, hallucination, and misinformation. You give it a model adapter — a local Ollama model, an OpenAI endpoint, a Hugging Face model, anything reachable over REST — and it fires structured probe families at it, then runs detectors over the outputs to score how often the model failed. The install I ended up with reports v0.15.2.pre1 and lists 230 probe modules.

**AI-Infra-Guard** (A.I.G) is Tencent Zhuque Lab's AI red-teaming *platform* — a Go backend plus a web UI plus Python sub-engines. It doesn't care what your model says; it cares about what's exposed around it. It fingerprints AI infrastructure components (Ollama, vLLM, Dify, Gradio, and dozens more), matches them against a CVE database, scans **MCP servers and agent skills** for risk classes, evaluates agent workflows, and runs jailbreak datasets. It's the only one of the three with a real UI and a task queue.

**vigolium** is a web-application DAST by [@j3ssie](https://github.com/j3ssie). Here the AI is the *engine*, not the subject: it's a fast, modular vulnerability scanner — 250-plus modules across injection, access control, file/path, API/protocol, and out-of-band classes — with an optional "agentic" mode that lets an LLM plan attacks and audit source code. You point it at a web app you own, not at a model.

The throughline is the layer each one sits at. garak asks *is my chatbot jailbreakable?* A.I.G asks *is my AI infrastructure exposed?* vigolium asks *is my website hackable?* Same broad neighborhood, three genuinely different questions.

## How it was set up

Two of the three went in via Docker; one needed a hand-pinned Python environment.

**garak — uv venv pinned to Python 3.12.** This was the only fiddly install, and the reason is a version mismatch. garak's officially supported ceiling is Python 3.12, but the system Python on this machine is 3.14 — new enough that the ML wheels garak pulls in (torch and friends) have no build for it. The clean fix was to not touch the system interpreter at all: I made a `uv venv` pinned to 3.12 at `claude/garak/.venv` and run everything through it, e.g. `.venv/Scripts/python.exe -m garak --model_type ollama --model_name qwen2.5:7b --probes dan`. Reports land in `garak-report/`. Keeping it in its own pinned venv meant the 3.14/3.12 split never became a problem anywhere else on the box.

**AI-Infra-Guard — Docker Compose, prebuilt images.** A.I.G ships a compose file that pulls Tencent's prebuilt `zhuquelab/aig-server` and `aig-agent` images, so there was no Go or Python build to do locally: `docker compose -f docker-compose.images.yml up -d`, and the web UI comes up at `http://localhost:8088` (verified HTTP 200, server healthy). One Windows wrinkle worth noting: cloning the repo throws a case-collision warning between an `OpenClaw/` and an `openclaw/` CVE directory. It's harmless — the scan actually runs inside the Linux Docker container, where the two paths don't collide — but it looks alarming on checkout.

**vigolium — Docker image pull.** The simplest of the three to stand up: `docker pull j3ssie/vigolium:latest` (about 5 GB), then `docker run --rm j3ssie/vigolium:latest scan -h` to confirm the CLI works. The first real scan downloads Chromium and Nuclei templates on demand (you can pass `--skip-dependency-check` to skip that), and the agentic mode needs an LLM key wired in via `-e` before it'll do anything AI-driven. The source is also cloned locally, but building from source wants Go 1.26 and bun 1.3.11, so the Docker image was the pragmatic path to a working scanner.

## What each one finds

The most useful thing about running all three is watching how little they overlap.

**garak operates entirely on text the model emits.** I ran six DAN-family jailbreak probes against a local `qwen2.5:7b` and let garak score how often each one slipped past the model's safety behavior. The model was partially resistant — several classic jailbreaks (DAN Jailbreak, DUDE, AntiDAN) scored 0%, but the more elaborate persona and instruction-override framings landed more often, with persona-adoption probes being the weakest spot. The takeaway isn't the specific number; it's that garak's entire field of view is the conversation. It never looks at a port, a CVE, or a line of source — only at what the model said back.

**A.I.G operates on the infrastructure, and shipped with a real finding about itself.** The most important thing I learned standing up A.I.G is a property of A.I.G: **it has no authentication by default.** The web UI at `:8088` is wide open — anyone who can reach the port can drive the scanner. On localhost that's fine. The moment it's on a network anyone else can touch, it's a problem, because a red-teaming platform with no auth is itself an exposed AI component. So the operational rule is simply: never bind it to a public interface. That this is the headline caveat for an *AI-infra* scanner is a fitting illustration of exactly the layer it's meant to watch. (Its most relevant module for me is the MCP-server scanner, given how many MCP servers I run — the engine ran end to end against one, though a local 7B model is too weak to drive the structured tool-calling these auditors expect, so a trustworthy report needs a stronger model.)

**vigolium operates on web requests and source, and the AI is optional.** Its default "native" scan is deterministic — a Go worker pool firing 250-plus modules at a target, no LLM involved at all. The LLM only enters in "agentic" mode, where it plans which modules to run and can audit source code. That ordering matters for trust: the boring, repeatable part doesn't depend on a model behaving, and you only opt into AI-driven scanning (and an API key, and the non-determinism that comes with it) when you specifically want it. It's the inverse of garak — here the model is the tool doing the scanning, not the thing being scanned.

## Takeaways

After setting all three up, the "which one" question answers itself by layer.

- Reach for **garak** when the thing you're worried about is what your model *says* — jailbreaks, leaks, prompt injection, toxic output. It's the only one of the three that treats the LLM's responses as the attack surface. Budget for the Python-version pinning; a dedicated 3.12 venv via `uv` saves the headache.
- Reach for **AI-Infra-Guard** when the thing you're worried about is what's *exposed* — vulnerable AI components, risky MCP servers, agent-skill audits. It's the most "platform"-shaped of the three, with a UI and a task queue. Just remember the no-auth default and keep it on localhost.
- Reach for **vigolium** when the target is a *web app* and the AI is incidental. It's a serious DAST first, with an optional AI brain on top — useful when you want the model to plan the scan rather than be the scan.

Credit where it's due: garak is NVIDIA's (Leon Derczynski's project), AI-Infra-Guard is Tencent Zhuque Lab's, and vigolium is @j3ssie's. My contribution was getting all three running on one Windows box — a pinned uv venv for garak, Docker for the other two — and figuring out where each one's lane begins and ends. The short version: there is no single "AI security scanner," and treating these three as substitutes for one another is how you end up scanning the wrong layer.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
