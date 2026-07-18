---
title: "Design — Roast My Stack (Dr. Gordon Pelican)"
type: spec
status: approved
project: openai-toolkit-eval
event: openai-build-week
track: apps-for-your-life
license: MIT
tags:
  - "#project/openai-toolkit-eval"
  - "#spec"
  - "#build-week"
  - "#roast-my-stack"
created: 2026-07-17
---

# Design — Roast My Stack

## Context

The OpenAI **Build Week** entry (see [[2026-07-17-codex-eval-harness-design]] for the dev environment it's built in). Build Week closes **Tue July 21, 2026, 5:00 PM PT**. Mandatory tools: **Codex + GPT‑5.6**. Judged on: Codex usage · Design (coherent, runnable product) · Potential Impact (real problem/audience) · Idea quality (novelty). Submission = working project + **<3‑min demo video** + repo (README, setup, sample data) + a `/feedback` **Codex Session ID**. Hard constraint from Joe: the artifact **must deploy to the Apify platform**.

**The build is the eval.** Per Build Week rules, "how thoroughly does the project use Codex" is a scored axis and a Codex Session ID is required — so building this through Codex in the WSL2 harness is a graded, required part of the entry, not just our private evaluation.

## Concept

Paste a URL → **Dr. Gordon Pelican**, a pixel-art pelican, detects the site's real tech stack, roasts it with GPT‑5.6 in-character, then delivers the modernization/security fixes that actually matter. **Fun hook, useful tail** — the roast earns the share; the fixes earn the "real product" score.

## The character — Dr. Gordon Pelican

A pompous, over-credentialed academic pelican. Insists on **"Dr."** (never "Professor" — "I didn't spend all those years at Bird University to be called *professor*"). Judges your stack down his beak: withering, theatrical, but ultimately *helpful* — the fixes are his begrudging expert consultation. Punches at **tech choices, never people**; playful, PG‑13.

His mood — sprite **and** tone — is driven by the stack score:

| Score | Band | Sprite | Tone |
| --- | --- | --- | --- |
| 85–100 | Impressed | grudging nod | "Hmph. *Adequate.*" Backhanded respect. |
| 65–84 | Smug | raised brow | Mild condescension, a few jabs. |
| 40–64 | Concerned | furrowed brow | Genuine concern, sharper jabs. |
| 20–39 | Horrified | beak agape | Theatrical dismay. |
| 0–19 | Ashes | monocle popping | Total academic devastation. |

## Goals / success criteria

- A live, shareable one-page web app on Apify: URL in → pelican roast + real fixes + shareable card.
- GPT‑5.6 visibly powers the roast and the fixes; Codex visibly built it (Session ID captured).
- A <3‑min demo that lands the joke *and* the utility.
- Shipped and submitted before the July 21 deadline.

## Non-goals (4-day discipline)

- Actual code-patch generation, PRs, or auto-fixing.
- User accounts, history, database, persistence beyond a share-card cache.
- Multi-character cast (the "pick your roaster" v2), sprite animation.
- Faithful recreation of the full 5,625-signature engine, or exhaustive coverage — the detector is purpose-built and lean (top roast-worthy tech only).

## Architecture

A single **Apify Standby actor** (persistent HTTP server) serving a one-page app:

- `GET /` → the pixel-styled single-page UI (URL input → result view).
- `POST /roast { url }` → runs the pipeline, returns `{ detected[], score, band, spriteId, roast, fixes[], shareId }`.
- `GET /card/:shareId` → server-rendered shareable result image (OG card).

**Pipeline (on `POST /roast`):**
1. **Fetch** the target URL — Apify HTTP fetch first (fast); fall back to a headless browser only if needed. Capture HTML, response headers, script src list, meta/generator tags, cookies.
2. **Detect** the stack via a **fresh, lean detector authored by Codex during the event** (see Detection approach below). Output: detected technologies + categories + version/age hints for the roast-worthy tech only.
3. **Score** stack health/modernity via a transparent heuristic over detected signals (deprecated/EOL tech, known-insecure versions, age proxies, missing security headers) → 0–100 → mood band.
4. **Roast** — one GPT‑5.6 call. Input: the **detected stack + score + band** (so it roasts real findings, never hallucinated ones). Output (structured): the in-character roast (savagery scaled to band) + a prioritized `fixes[]` list, each a real modernization/security recommendation with a one-line rationale, grounded in the detected tech.
5. **Render** — mood-matched pelican sprite + roast + fixes; mint a `shareId` and generate the OG card.

**Detection approach (built top-to-bottom by Codex):** All detection *code* is authored fresh with Codex this weekend — no vendored engine, no imported signature DB, no AGPL inheritance. Coverage is deliberately **lean and purpose-built**: the ~100–150 highest-signal, roast-worthy tells (CMS/framework — WordPress, jQuery, React, Angular, Vue; server/CDN/headers; analytics; obvious age/EOL/security giveaways). Detection rules for well-known tech are public knowledge (e.g. WordPress serves `/wp-content/`, React leaves `data-reactroot`), so they're written clean. The pre-existing `tech-stack-detector-mcp` is used **only** two legitimate ways: (a) as *spec + lessons-learned input* to accelerate the Codex build (showcasing Codex's spec-driven workflow — itself a scored strength), and (b) as a **test oracle** — run both against sample sites and diff, for fast QA. Code vs. data line: all code is Codex-authored; any public signal list used is *reference data*, not an imported engine.

**Share artifact:** `GET /card/:shareId` returns an auto-generated image (pelican + verdict + score) built to be screenshot/posted. This is the virality engine — high priority, but tier-flexible (see Build order).

## Technology

- **TypeScript ESM**, Apify SDK v3, Standby mode (mirrors the shipped MCP actors' deployment pattern).
- **Detection:** a fresh, lean, Codex-authored module (original code; no vendored engine/DB). Original `tech-stack-detector-mcp` used as spec input + test oracle only.
- **Parsing:** cheerio.
- **LLM:** OpenAI SDK → **GPT‑5.6** (structured output for roast + fixes). Prompt encodes Dr. Gordon Pelican's persona + band-scaled tone + a hard "only reference detected tech" grounding rule.
- **Share card:** server-side image render (satori/resvg or canvas) — bundled pelican sprites composited with text.
- **Sprites:** ~5 static 8-bit pelican PNGs, generated via **Ideogram** (our pixel/design image route) pre-build, bundled in the actor image.
- **Secrets:** `OPENAI_API_KEY` (+ Apify token) as Apify env/secrets; gitignored locally.
- **License:** **MIT** — no copyleft dependency forces AGPL now that the detector is built fresh; permissive is friendlier for a visibility/hackathon piece.

## Build order (tiering — protect the deadline)

Ship in this priority order; each tier is demoable on its own so we always have something to submit:

1. **Core loop** — fetch URL → lean detector (small tech set) → GPT‑5.6 roast in Dr. Pelican's voice → render text result. *(This alone is a valid entry.)*
2. **The Pelican** — mood bands + the 5 sprites wired to the score.
3. **Real fixes** — the prioritized modernization/security list alongside the roast.
4. **Share card** — the auto-generated OG image (virality engine; high priority but flex here if time is tight).
5. **Breadth** — expand detector coverage beyond the initial roast-worthy set.

Apify deploy is validated continuously from Tier 1, not saved for the end.

## Judging alignment

- **Idea quality** — pelican-benchmark in-joke (Willison nod) + roast genre = novelty.
- **Design** — mood-reactive character + coherent one-page flow + share card.
- **Potential Impact** — real prioritized modernization/security fixes for a real audience (devs, site owners).
- **Codex usage** — **built top-to-bottom with Codex** in the WSL2 harness: detector, scoring heuristic, roast layer, one-page UI, share renderer, and Apify deploy are all Codex-authored this weekend; spec-driven build (old detector as spec input) showcases Codex's Goals/spec workflow; `/feedback` Session ID captured; eval-log doubles as demo-video script.

## Toolkit leverage (GPT‑5.6 / Codex) — build directives

Deliberate use of the new suite's claimed strengths, to both accelerate the build and demo the toolkit (the eval half of the project):

- **Spec-driven Codex `/goal` build** — drive the build from this spec as a Codex Goal (outcome + constraints + proof-of-completion), using the review→repair→validate loop to green. Showcases Codex's flagship workflow.
- **Subagents for the tiers** — detector / roast / pelican / share-card are independent modules → parallel Codex subagents.
- **Model tiering** — Sol for the hard logic (detector, roast-prompt engineering); trial **Terra/Luna for the live roast path** (cheap, fast, high-volume) and log "which tier roasts best" for the write-up.
- **Lean the fixes toward security** — GPT‑5.6's ExploitBench strength means Dr. Pelican's fixes should be sharp on security: "same model does the wit *and* the security correctness" (Impact-axis story).
- **(Stretch) Codex Computer Use on Windows** — optionally drive the Apify deploy / browser QA; a "used the brand-new Windows capability" beat if time allows. Not core.

## Risks & mitigations

- **Hallucinated fixes** → GPT‑5.6 is fed only the *detected* stack and instructed to reference nothing else; fixes must map to detected tech. Validate in testing against known sites.
- **Sites blocking Apify / thin HTML (heavy JS apps)** → browser-fetch fallback; if still thin, Dr. Pelican roasts the *lack* of detectable signal (in character) rather than failing.
- **Tone risk** → persona punches at tech, never people; PG‑13 guardrail in the prompt; spot-check outputs.
- **Time (the detector is now built, not reused)** → mitigated by keeping coverage lean (top ~100–150 tech), the original detector as a QA oracle to avoid reinventing correctness, the reused Standby deploy pattern, pre-generated sprites, and strict tiering (see Build order — Tier 1 is a valid standalone entry).
- **GPT‑5.6/Codex API access** → confirm keys + GPT‑5.6 availability in the WSL2 env before build (harness secrets check).

## Follow-on (out of this spec)

- Demo video script (from the eval-log), directory/registry listing, and promo posts — post-build, within the ship window.
- Post-Build-Week: "pick your roaster" multi-character v2; optional MCP-tool wrapper so ChatGPT/Codex can call the roaster.
