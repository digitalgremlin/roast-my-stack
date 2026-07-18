# Roast My Stack — Implementation Plan

> **For agentic workers:** This plan is designed to be executed by **Codex (GPT‑5.6) in the WSL2 harness** as a spec-driven `/goal`, task-by-task, using the review→repair→validate loop until each task's tests pass. Steps use checkbox (`- [ ]`) syntax for tracking. Capture the `/feedback` Codex Session ID from the primary session — it is a required Build Week submission field.

**Goal:** Ship a live Apify web app where Dr. Gordon Pelican detects a site's tech stack, roasts it with GPT‑5.6, and delivers real security/modernization fixes — built top-to-bottom with Codex for OpenAI Build Week (deadline **Tue 2026-07-21, 5:00 PM PT**).

**Architecture:** A single Apify **Standby** actor (persistent HTTP server) serving a one-page app. Request pipeline: fetch URL → lean Codex-authored detector → score → GPT‑5.6 roast + fixes → render with mood-matched pelican sprite + shareable OG card.

**Tech Stack:** TypeScript (ESM), Apify SDK v3 (Standby), cheerio, OpenAI SDK (GPT‑5.6), Vitest, satori/resvg (share card), Ideogram (pre-generated sprites).

## Global Constraints

- **License:** MIT. No vendored engine, no imported signature DB, no AGPL dependency.
- **Detector built fresh with Codex** — original code only; coverage lean (~100–150 highest-signal, roast-worthy technologies). The existing `~/Code/apify-actor/tech-stack-detector-mcp` is a **reference/test-oracle only**, never imported.
- **Deploy target:** Apify Standby actor (mirror the shipped MCP actors' deploy pattern). Multi-stage Dockerfile (single-stage `--only=prod` breaks `tsc`).
- **Model:** GPT‑5.6. Sol for hard logic/prompt work; trial Terra/Luna on the live roast path and log which tier roasts best.
- **Character:** Dr. Gordon Pelican — pompous, over-credentialed academic pelican; insists on "Dr."; punches at tech choices, never people; PG‑13.
- **Fixes lean security** (leverage GPT‑5.6's ExploitBench strength). Fixes must reference only *detected* tech (no hallucinated stack).
- **TDD, DRY, YAGNI, frequent commits.** Every task ends green + committed.
- **Tiering:** each task tier is independently demoable; Tier 1 alone is a valid submission. Validate Apify deploy continuously from Task 1.

## File Structure

```
roast-my-stack/
├── .actor/{actor.json, Dockerfile}   # Standby config + inline input schema; multi-stage build
├── src/
│   ├── main.ts        # Actor entry: boot Standby HTTP server
│   ├── server.ts      # routes: GET /, POST /roast, GET /card/:id
│   ├── fetch.ts       # fetchTarget(url) -> TargetSnapshot
│   ├── signatures.ts  # SIGNATURES: SignatureRule[]  (the lean rule set)
│   ├── detect.ts      # detectStack(snapshot) -> Detection[]
│   ├── score.ts       # scoreStack(detections) -> ScoreResult
│   ├── prompt.ts      # DR_PELICAN_SYSTEM + buildRoastMessages()
│   ├── roast.ts       # roast(detections, score) -> RoastResult   (GPT-5.6)
│   ├── card.ts        # renderShareCard(result) -> Buffer (PNG)
│   ├── types.ts       # shared types
│   └── ui/{index.html, app.js, styles.css}
├── assets/sprites/pelican-{impressed,smug,concerned,horrified,ashes}.png
├── test/{fetch,detect,score,roast,server}.test.ts
├── AGENTS.md          # slim Codex instructions (per GPT-5.6 "slimmer instructions" guidance)
├── package.json, tsconfig.json, vitest.config.ts, LICENSE (MIT), README.md
```

**Shared types (`src/types.ts`) — the contract every task depends on:**

```ts
export type Band = 'impressed' | 'smug' | 'concerned' | 'horrified' | 'ashes';
export interface TargetSnapshot {
  url: string; finalUrl: string; status: number;
  html: string; headers: Record<string, string>;
  scripts: string[]; metaGenerator?: string; cookies: string[];
}
export type AgeRisk = 'modern' | 'aging' | 'eol';
export type SecurityRisk = 'none' | 'low' | 'high';
export interface SignatureRule {
  name: string; category: string;
  html?: RegExp[]; headerKey?: string; headerValue?: RegExp;
  scriptSrc?: RegExp[]; metaGenerator?: RegExp; cookie?: RegExp;
  ageRisk?: AgeRisk; securityRisk?: SecurityRisk;
}
export interface Detection { name: string; category: string; ageRisk: AgeRisk; securityRisk: SecurityRisk; }
export interface ScoreResult { score: number; band: Band; }
export type FixKind = 'security' | 'modernization' | 'performance';
export interface Fix { title: string; rationale: string; kind: FixKind; }
export interface RoastResult {
  score: number; band: Band; spriteId: Band;
  detections: Detection[]; roast: string; fixes: Fix[];
}
```

---

### Task 0: Repo scaffold + Standby skeleton + Apify deploy

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `LICENSE`, `AGENTS.md`, `.gitignore`
- Create: `.actor/actor.json`, `.actor/Dockerfile`
- Create: `src/main.ts`, `src/server.ts`, `src/types.ts`
- Create: `test/server.test.ts`

**Interfaces:**
- Produces: `createServer(): http.Server` (routes `GET /` → 200 HTML placeholder; `GET /health` → 200 `{ok:true}`).

- [ ] **Step 1: Write failing test** — `test/server.test.ts`: start `createServer()`, `GET /health` returns 200 and body `{ ok: true }`; `GET /` returns 200 with `content-type: text/html`.
- [ ] **Step 2: Run** `npx vitest run test/server.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** `src/types.ts` (contract above), `src/server.ts` (`createServer` with the two routes; HTML placeholder = "Roast My Stack — coming soon"), `src/main.ts` (Apify Standby: read `process.env.APIFY_STANDBY_PORT`/`ACTOR_STANDBY_PORT`, listen). Add `.actor/actor.json` (`usesStandbyMode: true` **left false until final deploy**, inline all-optional input schema), multi-stage `.actor/Dockerfile`.
- [ ] **Step 4: Run** `npx vitest run` — expect PASS. Run `npx tsc --noEmit` — clean.
- [ ] **Step 5: Deploy smoke** — `apify push`; confirm green build; hit `GET /` on the Standby URL → 200. Record the exact Standby URL for `server.json`/README later.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore: scaffold Standby actor + health/placeholder routes"`.

---

### Task 1: `fetchTarget` — retrieve the page (Tier 1 core)

**Files:** Create `src/fetch.ts`, `test/fetch.test.ts`.

**Interfaces:**
- Produces: `fetchTarget(url: string): Promise<TargetSnapshot>` — HTTP GET (follow redirects, 10s timeout, desktop UA); parse with cheerio to collect `scripts` (all `<script src>`), `metaGenerator` (`<meta name=generator>`), lowercase `headers`, `set-cookie` names into `cookies`. On non-HTML/blocked/timeout, return a snapshot with `status` set and empty `html` (never throw).

- [ ] **Step 1: Write failing tests** — feed a saved HTML fixture via a mocked fetch; assert `scripts` includes the fixture's script URLs, `metaGenerator` parsed, `headers` lowercased. Add a timeout/blocked case asserting a non-throwing snapshot with empty `html`.
- [ ] **Step 2: Run** `npx vitest run test/fetch.test.ts` — FAIL.
- [ ] **Step 3: Implement** `fetchTarget` (global `fetch` + `AbortController` timeout; cheerio parse). Keep network in this module only.
- [ ] **Step 4: Run** tests — PASS; `tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `git commit -m "feat: fetchTarget page snapshot with graceful fallback"`.

---

### Task 2: `signatures.ts` + `detectStack` — the lean detector (Tier 1 core)

**Files:** Create `src/signatures.ts`, `src/detect.ts`, `test/detect.test.ts`.

**Interfaces:**
- Produces: `SIGNATURES: SignatureRule[]` and `detectStack(s: TargetSnapshot): Detection[]` — apply each rule against html/headers/scripts/meta/cookie; emit a `Detection` per match with the rule's `ageRisk`/`securityRisk` (default `modern`/`none`); de-dupe by name.

**Signature seed (author fresh; ~100–150 total — start with these ~20 highest-signal, expand in Task 9):**

```ts
// examples — Codex authors the full lean set, validated vs the oracle
{ name: 'WordPress', category: 'CMS', html: [/wp-content\//i], metaGenerator: /WordPress/i, ageRisk: 'aging', securityRisk: 'low' },
{ name: 'jQuery', category: 'JS Library', scriptSrc: [/jquery(-|\.)/i], ageRisk: 'aging', securityRisk: 'low' },
{ name: 'React', category: 'JS Framework', html: [/data-reactroot|__NEXT_DATA__/], ageRisk: 'modern' },
{ name: 'PHP', category: 'Language', headerKey: 'x-powered-by', headerValue: /PHP/i, ageRisk: 'aging' },
{ name: 'Server: Apache', category: 'Web Server', headerKey: 'server', headerValue: /Apache/i, ageRisk: 'aging' },
```

- [ ] **Step 1: Write failing tests** — build snapshots that should match WordPress+jQuery+PHP; assert `detectStack` returns those names with expected `ageRisk`/`securityRisk`. Add a "modern" snapshot (React/Next) asserting `ageRisk: 'modern'`, no false WordPress match.
- [ ] **Step 2: Run** `npx vitest run test/detect.test.ts` — FAIL.
- [ ] **Step 3: Implement** `SIGNATURES` (lean set) + `detectStack`.
- [ ] **Step 4: Oracle check** — run detector and `tech-stack-detector-mcp` against 5 sample URLs; diff detected names; note misses in the eval-log (don't chase parity — chase roast-relevant coverage).
- [ ] **Step 5: Run** tests — PASS; `tsc` clean.
- [ ] **Step 6: Commit** — `git commit -m "feat: lean tech-stack detector + signature set"`.

---

### Task 3: `scoreStack` — score + mood band (Tier 1 core)

**Files:** Create `src/score.ts`, `test/score.test.ts`.

**Interfaces:**
- Produces: `scoreStack(d: Detection[]): ScoreResult`. Start 100; subtract per detection: `aging` −8, `eol` −20; `securityRisk low` −10, `high` −25; clamp 0–100. Bands: ≥85 `impressed`, 65–84 `smug`, 40–64 `concerned`, 20–39 `horrified`, <20 `ashes`. Empty detections → `score 60, band 'concerned'` ("can't see your stack" case).

- [ ] **Step 1: Write failing tests** — modern stack → `impressed`; WordPress+jQuery+PHP(aging+low-sec) → mid band; an `eol`+`high` heavy stack → `ashes`; empty → `{60,'concerned'}`; assert clamping at 0 and 100.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `scoreStack`.
- [ ] **Step 4: Run** — PASS; `tsc` clean.
- [ ] **Step 5: Commit** — `git commit -m "feat: stack scoring + mood bands"`.

---

### Task 4: `prompt.ts` + `roast` — GPT‑5.6 roast + fixes (Tier 1 core / Tier 3 fixes)

**Files:** Create `src/prompt.ts`, `src/roast.ts`, `test/roast.test.ts`.

**Interfaces:**
- Produces: `DR_PELICAN_SYSTEM: string`; `buildRoastMessages(detections, score, band): ChatMessage[]`; `roast(detections, score, band, deps?): Promise<RoastResult>`. Uses OpenAI SDK, model `gpt-5.6` (tier configurable via `ROAST_MODEL` env; default the cheapest tier that lands the joke), **structured JSON output**: `{ roast: string, fixes: Fix[] }`. `deps` allows injecting a mock client for tests.

**Prompt rules (encode in `DR_PELICAN_SYSTEM`):** in-character Dr. Gordon Pelican; savagery scaled to `band`; **reference ONLY the provided detected tech**; produce 3–5 `fixes`, **each mapped to a detected technology**, weighted toward security; PG‑13; no attacks on people.

- [ ] **Step 1: Write failing tests** (mock the LLM client): `roast(...)` returns a `RoastResult` where `spriteId === band`, `fixes.length` in 3–5, and every `fix.kind`/title references a detected tech name (assert no fix mentions a tech not in `detections`). Assert `buildRoastMessages` includes the detected names + band in the user message.
- [ ] **Step 2: Run** `npx vitest run test/roast.test.ts` — FAIL.
- [ ] **Step 3: Implement** `prompt.ts` + `roast.ts` (structured output; post-validate that fixes reference detected names, drop any that don't).
- [ ] **Step 4: Run** tests — PASS; `tsc` clean.
- [ ] **Step 5: Live check** — one real GPT‑5.6 call against a WordPress fixture; eyeball tone + fix accuracy; log the tier + a quality note in the eval-log.
- [ ] **Step 6: Commit** — `git commit -m "feat: Dr. Pelican GPT-5.6 roast + grounded fixes"`.

---

### Task 5: Wire `POST /roast` — full pipeline (Tier 1 core, end-to-end)

**Files:** Modify `src/server.ts`; add `test/server.test.ts` cases.

**Interfaces:**
- Produces: `POST /roast { url }` → 200 `RoastResult` JSON. Invalid/missing URL → 400. Pipeline: `fetchTarget → detectStack → scoreStack → roast`.

- [ ] **Step 1: Write failing test** — POST a URL with the pipeline deps mocked; assert 200 + a well-formed `RoastResult`; POST `{}` → 400.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the route (dependency-inject the pipeline fns for testability).
- [ ] **Step 4: Run** — PASS; `tsc` clean.
- [ ] **Step 5: Deploy + live** — `apify push`; POST a real URL to the Standby endpoint; confirm a real roast returns. **Tier 1 is now a submittable entry.** Tag `git tag tier1-live`.
- [ ] **Step 6: Commit** — `git commit -m "feat: end-to-end /roast pipeline"`.

---

### Task 6: Pelican sprites + one-page UI (Tier 2)

**Files:** Create `assets/sprites/pelican-*.png` (5, via Ideogram, pre-generated & committed), `src/ui/{index.html,app.js,styles.css}`; modify `src/server.ts` to serve `ui/` + `assets/`.

**Interfaces:**
- Produces: `GET /` serves the app; `app.js` POSTs to `/roast`, renders `roast`, `fixes`, and swaps the sprite by `spriteId`.

- [ ] **Step 1:** Generate the 5 pixel-pelican expressions (Ideogram), name them per band, commit to `assets/sprites/`.
- [ ] **Step 2: Write failing test** — `GET /assets/sprites/pelican-ashes.png` → 200 `image/png`; `GET /` HTML contains the input form + result container ids used by `app.js`.
- [ ] **Step 3: Run** — FAIL.
- [ ] **Step 4: Implement** static serving + the one-page UI (pixel aesthetic; input → loading pelican → result view with sprite + roast + fixes).
- [ ] **Step 5: Run** tests — PASS; manual browser check on the deployed Standby URL.
- [ ] **Step 6: Commit** — `git commit -m "feat: pixel Dr. Pelican UI + mood sprites"`.

---

### Task 7: Share card — `GET /card/:id` (Tier 4, virality; tier-flex)

**Files:** Create `src/card.ts`, `test/card.test.ts`; modify `src/server.ts` (mint `shareId`, cache result, serve card); add OG meta to `index.html`.

**Interfaces:**
- Produces: `renderShareCard(result: RoastResult): Promise<Buffer>` (PNG via satori/resvg: pelican sprite + score + one roast line); `GET /card/:id` → 200 `image/png`; `POST /roast` returns a `shareId`; result view exposes a share URL + OG tags.

- [ ] **Step 1: Write failing test** — `renderShareCard(sample)` returns a non-empty PNG buffer (valid header); `GET /card/:id` after a roast → 200 `image/png`; unknown id → 404.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** card render + in-memory LRU `shareId → result` cache + route + OG meta.
- [ ] **Step 4: Run** tests — PASS; deploy; verify a shared URL unfurls an image.
- [ ] **Step 5: Commit** — `git commit -m "feat: shareable OG result card"`.

---

### Task 8: Deploy hardening + Standby enable (ship gate)

**Files:** Modify `.actor/actor.json`, `README.md`; add `.env.example`.

- [ ] **Step 1:** Secrets — set `OPENAI_API_KEY` (+ `ROAST_MODEL`) as Apify secrets; confirm `.env`, `storage/`, `dist/` gitignored; history scrub `git log -p --all | grep -iE "api[_-]?key|sk-"` → clean.
- [ ] **Step 2:** Final `apify push`; full QA on 5 varied sites (modern SPA, old WordPress, blocked site); confirm graceful "can't see your stack" path.
- [ ] **Step 3:** **Enable `usesStandbyMode` LAST**; request the Standby daily-test exemption (mirror the sibling actors' request).
- [ ] **Step 4:** README (H1, zero-jargon "paste a URL, get roasted," setup, sample output, Codex/GPT‑5.6 usage section, MIT LICENSE).
- [ ] **Step 5: Commit + tag** — `git commit -m "chore: production deploy + README"` && `git tag build-week-submission`.

---

### Task 9 (stretch, only if Tiers 1–4 are green): breadth + Computer-Use QA

- [ ] Expand `SIGNATURES` toward the full ~100–150 set; re-run the oracle diff; commit.
- [ ] (Optional) Use **Codex Computer Use on Windows** to drive a browser QA pass across sample sites; capture a clip for the demo; log the experience in the eval-log.

---

## Cross-cutting: eval-log + demo capture (runs throughout)

- [ ] After each task, append a dated entry to `01-Projects/openai-toolkit-eval/roast-my-stack-eval-log.md`: Task · What Codex did · Friction · Wins · vs-Claude · Verdict. (Required Build Week artifact + your SME content source.)
- [ ] Keep the `/feedback` Codex Session ID from the primary session.
- [ ] Draft the <3‑min demo video script from the eval-log once Tier 2 is live.

## Self-Review (done at write time)

- **Spec coverage:** fetch→detect→score→roast→UI→card→deploy all mapped (Tasks 1–8); lean-detector/no-vendor constraint in Task 2 + Global Constraints; tiering matches spec Build order; security-lean in Task 4; Codex/GPT‑5.6 leverage in header + Tasks 4/9 + eval-log. No gaps found.
- **Placeholders:** none — every task has concrete interfaces, test assertions, and commands. (Full signature set is intentionally seeded + expanded in Task 9, not left blank.)
- **Type consistency:** `TargetSnapshot`, `Detection`, `ScoreResult`, `Band`, `Fix`, `RoastResult` used consistently across Tasks 1–7; `spriteId === band`; `scoreStack` bands match `roast` `band` usage.
