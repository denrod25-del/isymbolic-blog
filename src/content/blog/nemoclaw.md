---
title: "NemoClaw on WSL: Running NVIDIA's Sandboxed Agent Stack Fully Local"
description: "I got NVIDIA's NemoClaw sandboxed-agent reference stack running entirely on my own machine — WSL, GPU passthrough, local Ollama, no cloud and no API keys."
pubDate: 2026-06-12
tags: [wsl, ollama, local-llm, agents]
project: nemoclaw
draft: true
---

NVIDIA's [NemoClaw](https://github.com/NVIDIA/NemoClaw) is a reference stack for running always-on AI agents inside hardened sandboxes. The examples all point at remote GPU instances and cloud inference. I wanted the opposite: the whole thing on my own desk — WSL, my RTX 3070, a local Ollama model, no cloud and no API keys anywhere in the loop. That took some doing, and the last mile came down to a self-signed certificate and a context-window budget. It now works end to end: I can chat with a sandboxed OpenClaw agent through the dashboard at `localhost:18789`, and every token of inference is served by a model running on my own GPU.

To be clear up front about credit: NemoClaw is NVIDIA's stack, Apache-2.0 licensed. The sandbox, the blueprint, the routed inference, the network policy — all theirs. What I did was get it running fully local on WSL and work through the two things that stood between "installed" and "actually answering."

## What it is

NemoClaw runs an agent — [OpenClaw](https://openclaw.ai) by default — inside an [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) sandbox. OpenShell is the container layer that gives the agent a locked-down environment: an L7 egress proxy, a network policy that controls what it can reach, capability drops, and a routed inference path so the agent talks to a model through a managed hostname rather than punching straight out to the internet. NemoClaw wraps all of that in a single CLI that handles onboarding, lifecycle, and the blueprint that defines the sandbox.

The intended deployment is a remote GPU box with a hosted model behind it. My goal was to collapse that to one machine. Inference shouldn't leave the box; the model should be something I run myself; and the sandbox's safety properties should stay intact while I do it. On a Windows machine with an 8 GB GPU, that meant WSL2 for the Linux container host, Docker Desktop's WSL integration for the runtime, GPU passthrough so the sandbox can see the card, and [Ollama](https://ollama.com) on the host serving the model that OpenShell's routed inference points at.

## How it was built

The host is WSL2 running Ubuntu 24.04, with Docker Desktop's WSL integration enabled for that distro. GPU passthrough works through the WSL2 CUDA path, so the sandbox sees the RTX 3070 — when it comes up it reports the card detected and the GPU policy preset active.

Installation is a script NVIDIA hosts. One wrinkle I hit: the piped `curl … | bash` form quietly no-ops when it ends up in a detached process, so I downloaded the installer to `/tmp` and ran it directly with the non-interactive and third-party-acceptance flags. The installer brings up Node 22 through nvm inside WSL, which sidesteps any Windows Node leaking onto the PATH. Provider choice doesn't happen during the install stage — you run `nemoclaw onboard` separately with `NEMOCLAW_PROVIDER=ollama` to point it at the local server.

The model is the interesting constraint. Stock Ollama loaded `qwen2.5:7b` at a 4096-token context, and the sandboxed OpenClaw agent needs roughly 7k just for its system prompt and tool definitions before it does anything useful — so a fresh session couldn't even start. The `OLLAMA_CONTEXT_LENGTH` environment variable wasn't honored by the Ollama version I had, so I built a derived model from a Modelfile with a `PARAMETER num_ctx` override. My first attempt aimed low to save VRAM: a derived model at `num_ctx 24576`, re-onboarded with `NEMOCLAW_CONTEXT_WINDOW=24576` so the sandbox's config agreed with it. That failed — the agent's own reserve left too small a usable budget, and a fresh session died on a preflight-compaction error before the first message (more on that below). So I bumped both sides to qwen2.5's maximum: a derived model — `qwen2.5-claw:7b` — at `PARAMETER num_ctx 32768`, re-onboarded with `NEMOCLAW_CONTEXT_WINDOW=32768`. qwen2.5 uses grouped-query attention, which keeps the KV cache small enough that a 32k window still fits in 8 GB of VRAM (it sits around 5.5 GB). NemoClaw's start script supports that exact override — it's a documented env var in the entrypoint.

What you end up with is a sandbox (`my-claw` in my setup) in the Ready phase, running OpenClaw with its full tool set and the RTX 3070 passed through, with a dashboard forwarded to `localhost:18789` on the Windows side via WSL2's localhost forwarding. If the gateway forward ever drops, `nemoclaw my-claw recover` brings it back.

## The gotchas

Two real ones stood between "the sandbox is up" and "the agent actually replies." Both took real digging.

**The self-signed `inference.local` certificate broke every agent turn.** This was the big one. OpenShell signs its managed inference route — `https://inference.local`, the hostname the agent's traffic is routed through — with its own "OpenShell Sandbox CA." A plain `curl` or a standalone Node process validates that fine, because they honor `NODE_EXTRA_CA_CERTS` and the CA bundle is mounted in the sandbox. But OpenClaw's provider transport uses a custom undici dispatcher that does *not* honor `NODE_EXTRA_CA_CERTS`, so every agent turn died with `SELF_SIGNED_CERT_IN_CHAIN`. That dispatcher does respect the global `rejectUnauthorized` flag, so the fix is `NODE_TLS_REJECT_UNAUTHORIZED=0`. The catch: NemoClaw's environment allowlist passes `NODE_EXTRA_CA_CERTS` through to the gateway but filters `NODE_TLS_REJECT_UNAUTHORIZED` out, so setting it from outside does nothing — it has to be exported inside the container's `nemoclaw-start` entrypoint, before that filtering happens. So that's where it goes, gated behind a `NEMOCLAW_TRUST_INFERENCE_TLS` flag that defaults to `1` — so it's on by default (opt-out), and you set `NEMOCLAW_TRUST_INFERENCE_TLS=0` to turn it off. This is acceptable precisely because of the sandbox's design: all the gateway's egress already runs through the OpenShell L7 proxy and the network policy, so the agent can't reach anything the policy doesn't allow regardless of TLS verification. The proper upstream fix is OpenClaw's dispatcher learning to trust `NODE_EXTRA_CA_CERTS`; until then, the entrypoint export is the local workaround.

**The context window had to clear the agent's reserve, not just fit the model.** This was the failure behind my first context attempt. With both the model and the sandbox set to a 24576 window, a fresh session died with "Preflight compaction required but failed." OpenClaw reserves a large slice of the context window for itself — at 24576, the reserve left only about 8000 tokens for a system-plus-tools prompt that was itself around 8090 tokens, so a brand-new conversation was already over budget before the first message. The fix was to stop being clever about fitting and go straight to qwen2.5's maximum: bump both the model's `num_ctx` and the sandbox's `contextWindow` to 32768. The rough rule I took away is that the usable budget is roughly half the configured window, so size the window for double what the agent's system prompt and tools actually cost.

One persistence note worth recording: the TLS export survives a container restart because it lives in the entrypoint, and the model's `num_ctx` survives because it's baked into the host Ollama model — but a full `nemoclaw rebuild` or re-onboard reverts the config side, so the entrypoint line and the `NEMOCLAW_CONTEXT_WINDOW=32768` onboard both have to be re-applied after a rebuild.

## What works now

The sandbox is up, the agent answers, and the inference is entirely local. I confirmed the dashboard chat end to end with a headless browser driving the real UI at `localhost:18789` — sent a prompt, the sandboxed OpenClaw agent replied through the browser, with the completion served by `qwen2.5-claw:7b` on my own GPU. No cloud endpoint, no API key, nothing leaving the machine for inference. The agent's full tool set is available and the sandbox's network policy and proxy are doing their job around it.

One honest caveat: the CLI `openclaw agent` path still falls back to an embedded mode rather than connecting to the gateway over its websocket, so the browser dashboard is the way in that actually works. For a local single-user setup that's fine — the dashboard is where I'd be anyway.

The credit split stays the same as where I started: NemoClaw, OpenShell, and OpenClaw are NVIDIA's and the OpenClaw maintainers' work. Mine was getting the whole stack running on one Windows machine through WSL — local Ollama, GPU passthrough, the right context budget — and tracking the self-signed-cert failure down to the one entrypoint line that fixes it. The payoff is a hardened, always-on agent sandbox that runs start to finish on hardware I own.

This is one post in a series on projects built this way. The running list is on the [projects page](/projects/).
