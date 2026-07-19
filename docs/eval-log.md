# Roast My Stack — Build Week eval log

Build window: July 18–19, 2026

Primary model: GPT‑5.6

Builder: Codex

Primary Codex session ID: `019f77e1-6086-7fc2-8edf-3d6ad0a37307`

## Task record

| Task | Codex work | Friction | Win | Verdict |
| --- | --- | --- | --- | --- |
| 0 — scaffold | Authored the TypeScript ESM actor, tests, shared contracts, and multi-stage image. | Standby must remain disabled until the ship gate. | First Apify image built and health route passed. | Green. |
| 1 — fetch | Built a bounded, redirect-following page fetcher with HTML signal extraction and non-throwing failures. | Blocked and non-HTML sites need useful empty snapshots. | Network behavior is isolated and deterministic in tests. | Green. |
| 2 — detector | Authored a clean-room rules engine and initial high-signal set without importing an engine or database. | The private reference oracle was absent locally and had to be run separately from `/tmp`. | Fixture tests cover modern, legacy, and false-positive cases. | Green; five-site oracle diff completed. |
| 3 — score | Added the transparent 0–100 risk calculation and five mood bands. | Empty evidence needs a distinct, honest outcome. | Every deduction and boundary is directly testable. | Green. |
| 4 — roast | Engineered Dr. Gordon Pelican’s structured GPT‑5.6 prompt and post-validation. | Model fixes can drift unless technology names are enforced. | Undetected-technology fixes are dropped; 3–5 grounded fixes are required. | Green. |
| 5 — pipeline | Connected fetch → detect → score → roast behind `POST /roast`. | Live credentials initially differed from the process environment. | A real GPT‑5.6 roast returned from Apify. | Tier 1 live. |
| 6 — UI | Built the responsive one-page pixel interface and five mood sprites. | The requested Ideogram integration was unavailable in this environment. | Five original generated PNG sprites are bundled and mood-swapped. | Green. |
| 7 — share card | Added bounded result caching, share pages, and PNG cards with Satori/Resvg. | Standby URLs require Apify authentication, including external crawlers. | Signed Apify storage URLs make the share page and card anonymously fetchable without exposing an account token. | Green. |
| 9 — breadth | Expanded the fresh detector to 120 roast-worthy rules and added representative false-positive tests. | Breadth can easily become a noisy signature dump. | Coverage remains lean, evidence-based, and original. | Green. |
| 8 — hardening | Added secret-backed actor config, current Standby port handling, dependency remediation, docs, and live QA. | Warm Standby runs retained prior images, and query-token browser loads did not authenticate subrequests automatically. | Rotating the old run put verified build 0.1.7 live; the browser preserves its existing token without storing one, and empty detection avoids GPT entirely. | Green. |

## GPT‑5.6 tier trial

Fixture: WordPress + jQuery + PHP, score 46, concerned band. Each successful
response returned five grounded fixes.

| Model | Result | Latency | Security fixes | Quality note |
| --- | --- | ---: | ---: | --- |
| `gpt-5.6` (Sol) | Success | 16.8 s | 2/5 | Best theatrical line and strongest “academic procession” character voice. |
| `gpt-5.6-terra` | Success | 6.3 s | 3/5 | Faster and more security-weighted; tone was useful but less funny. |
| `gpt-5.6-luna` | API denied | 0.3 s | — | The available key returned HTTP 401 insufficient permissions. |

Verdict: keep Sol (`gpt-5.6`) for the submission because the product’s hook is
the character voice. Terra is the permission-denied fallback and the best
cost/latency candidate after Build Week; it remains within the GPT‑5.6 family.

## Detector oracle diff

The private `tech-stack-detector-mcp` repository was cloned to `/tmp` and run
only as a black-box comparison oracle. No source, signatures, or data were copied
into Roast My Stack.

| Site | Shared | Roast My Stack only | Oracle only |
| --- | --- | --- | --- |
| nextjs.org | Next.js, Vercel | — | Node.js, React |
| wordpress.org | WordPress | Nginx, Google Tag Manager | PHP |
| shopify.com | Cloudflare | Shopify | — |
| github.com | — | React, Contentful, GitHub Pages | — |
| httpbin.org/html | — | — | — |

The gaps are acceptable for the purpose-built detector: it favors directly
observable, roast-worthy signals and does not chase parity with inferred
relationships. All five fetches returned HTTP 200 to both implementations.

## Final validation evidence

- 28 Vitest tests pass across fetch, detector, scoring, roast, server, and card.
- `tsc --noEmit` passes.
- Production dependency audit reports zero vulnerabilities.
- The exact tagged source build succeeded and is served by the active Standby run.
- Live health, detected-stack roast, empty-stack fallback, share page, and PNG
  card checks pass with Apify Standby authentication.
- The public actor is limited-permission and uses an Apify-stored OpenAI secret.

Apify’s direct Standby hostname requires an API token even for this public actor.
The official client’s anonymous-runnable update was attempted and rejected by the
platform schema. The app therefore preserves a token already supplied in its page
URL for browser subrequests, while the Apify Standby tab handles authentication
automatically. Share HTML and PNG cards use storage-record signatures scoped only
to those generated records, so social crawlers can unfurl them anonymously
without an Apify account token in the page or metadata.

## Codex evaluation

Codex was strongest when the contract was explicit: failing tests made each
module small, and the review → repair → validate loop caught both model grounding
drift and stale production containers. The main friction was external platform
state—model-tier permissions, authenticated Standby URLs, and absent oracle
source—not implementation ambiguity.
