# Roast My Stack

Paste a URL, get roasted.

Dr. Gordon Pelican detects the website’s real technology, assigns a transparent
stack-health score, delivers a pompous GPT‑5.6 roast, and prescribes grounded
security and modernization fixes. He insists on “Dr.” and saves his contempt for
technology—not people.

## Try it

The production actor is live:

- [Open Roast My Stack in Apify](https://console.apify.com/actors/NPZe7pQw8LhEjqc3Y)
- Standby endpoint: `https://joeslade--roast-my-stack.apify.actor`

Open the actor’s **Standby** tab to use the app; Apify supplies authentication
there. Direct requests to a Standby endpoint require an Apify API token:

```bash
curl -X POST https://joeslade--roast-my-stack.apify.actor/roast \
  -H "Authorization: Bearer $APIFY_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"url":"https://nextjs.org"}'
```

Enter any public HTTP(S) URL. The result includes:

- detected technologies and their risk signals;
- a 0–100 score and matching Dr. Pelican mood;
- a PG‑13 roast grounded only in detected technology;
- three to five prioritized fixes, weighted toward security; and
- a share link with a generated social card.

## Sample output

```text
Detected: WordPress · jQuery · PHP
Score: 46/100 — concerned

“WordPress, jQuery, and PHP have assembled a faculty meeting from 2012.”

1. WordPress: lock down extensions — Patch core, themes, and plugins promptly.
2. jQuery: remove legacy dependencies — Reduce aging browser-side attack surface.
3. PHP: stay on a supported release — Apply current runtime security fixes.
```

Model output varies, but every accepted fix must name a technology the detector
actually found.

## Run locally

Requirements: Node.js 22+, npm, and an OpenAI API key with GPT‑5.6 access.

```bash
npm install
cp .env.example .env
```

Export the values from `.env` in your shell, then:

```bash
npm run build
npm start
```

Open `http://localhost:3000`, or call the API:

```bash
curl -X POST http://localhost:3000/roast \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}'
```

Run the validation gates with:

```bash
npm test
npm run typecheck
```

## Deploy to Apify

This is an Apify SDK v3 Standby actor built by the multi-stage
[`.actor/Dockerfile`](.actor/Dockerfile).

1. Install and authenticate the Apify CLI.
2. Store `OPENAI_API_KEY` as a secret Actor environment variable.
3. Keep `ROAST_MODEL=gpt-5.6`.
4. Run `apify push`.

The server listens on Apify’s `ACTOR_WEB_SERVER_PORT`. Standby is enabled in the
production actor definition only after local tests and the production image build
pass.

## How Codex and GPT‑5.6 are used

Codex built the application task-by-task from [`docs/plan.md`](docs/plan.md):
the clean-room detector and signatures, scoring heuristic, structured roast
prompt, HTTP pipeline, pixel UI, share renderer, tests, and Apify packaging.
The pre-existing `tech-stack-detector-mcp` is not a dependency and no signature
database was imported.

GPT‑5.6 performs one job at runtime: it turns the detected stack and deterministic
score into Dr. Pelican’s roast plus structured fixes. A strict JSON schema and
post-validation drop fixes that do not name detected technology. The default model
is `gpt-5.6` (Sol); `ROAST_MODEL` supports explicit Terra/Luna evaluation.

## Architecture

```text
URL → fetch snapshot → original detector → deterministic score
    → GPT‑5.6 structured roast/fixes → pixel UI + PNG share card
```

The detector currently uses 120 deliberately lean, original, high-signal,
roast-worthy rules. Network access is isolated in `src/fetch.ts`. Shared results
live only in a bounded in-memory cache.

Build notes and the short demo script live in
[`docs/eval-log.md`](docs/eval-log.md) and
[`docs/demo-script.md`](docs/demo-script.md).

## License

[MIT](LICENSE) © 2026 Joe Slade
