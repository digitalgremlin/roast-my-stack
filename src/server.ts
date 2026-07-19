import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { renderShareCard } from './card.js';
import { detectStack } from './detect.js';
import { fetchTarget } from './fetch.js';
import { roast } from './roast.js';
import { scoreStack } from './score.js';
import type {
  Band,
  Detection,
  RoastResult,
  ScoreResult,
  TargetSnapshot,
} from './types.js';

export interface PipelineDependencies {
  fetchTarget(url: string): Promise<TargetSnapshot>;
  detectStack(snapshot: TargetSnapshot): Detection[];
  scoreStack(detections: Detection[]): ScoreResult;
  roast(detections: Detection[], score: number, band: Band): Promise<RoastResult>;
}

export interface ServerOptions {
  publishShareResult?: (
    id: string,
    result: RoastResult,
  ) => Promise<{ shareUrl: string; cardUrl: string }>;
}

const DEFAULT_DEPENDENCIES: PipelineDependencies = {
  fetchTarget,
  detectStack,
  scoreStack,
  roast,
};
const MAX_SHARED_RESULTS = 100;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function sendFile(
  response: ServerResponse,
  filePath: string,
  contentType: string,
): Promise<void> {
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': contentType,
      'content-length': body.length,
      'cache-control': contentType === 'image/png' ? 'public, max-age=86400' : 'no-cache',
    });
    response.end(body);
  } catch {
    sendJson(response, 404, { error: 'Not found' });
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) throw new Error('Request body too large');
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validTargetUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character,
  );
}

export function createServer(
  overrides: Partial<PipelineDependencies> = {},
  options: ServerOptions = {},
): http.Server {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides };
  const sharedResults = new Map<string, RoastResult>();

  const rememberResult = (result: RoastResult): string => {
    const id = randomBytes(9).toString('base64url');
    sharedResults.set(id, result);
    if (sharedResults.size > MAX_SHARED_RESULTS) {
      const oldestId = sharedResults.keys().next().value;
      if (oldestId) sharedResults.delete(oldestId);
    }
    return id;
  };

  return http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'GET' && request.url === '/') {
      void sendFile(
        response,
        path.join(process.cwd(), 'src/ui/index.html'),
        'text/html; charset=utf-8',
      );
      return;
    }

    if (request.method === 'GET' && request.url === '/app.js') {
      void sendFile(
        response,
        path.join(process.cwd(), 'src/ui/app.js'),
        'text/javascript; charset=utf-8',
      );
      return;
    }

    if (request.method === 'GET' && request.url === '/styles.css') {
      void sendFile(
        response,
        path.join(process.cwd(), 'src/ui/styles.css'),
        'text/css; charset=utf-8',
      );
      return;
    }

    const spriteMatch = request.url?.match(
      /^\/assets\/sprites\/(pelican-(?:impressed|smug|concerned|horrified|ashes)\.png)$/,
    );
    if (request.method === 'GET' && spriteMatch?.[1]) {
      void sendFile(
        response,
        path.join(process.cwd(), 'assets/sprites', spriteMatch[1]),
        'image/png',
      );
      return;
    }

    const cardMatch = request.url?.match(/^\/card\/([a-zA-Z0-9_-]+)$/);
    if (request.method === 'GET' && cardMatch?.[1]) {
      const result = sharedResults.get(cardMatch[1]);
      if (!result) {
        sendJson(response, 404, { error: 'Shared result not found' });
        return;
      }

      void renderShareCard(result)
        .then((card) => {
          response.writeHead(200, {
            'content-type': 'image/png',
            'content-length': card.length,
            'cache-control': 'public, max-age=86400',
          });
          response.end(card);
        })
        .catch((error: unknown) => {
          console.error('Share card render failed', error);
          sendJson(response, 500, { error: 'Share card could not be rendered' });
        });
      return;
    }

    const shareMatch = request.url?.match(/^\/share\/([a-zA-Z0-9_-]+)$/);
    if (request.method === 'GET' && shareMatch?.[1]) {
      const result = sharedResults.get(shareMatch[1]);
      if (!result) {
        sendJson(response, 404, { error: 'Shared result not found' });
        return;
      }

      const forwardedProto = request.headers['x-forwarded-proto'];
      const protocol =
        (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ?? 'https';
      const host = request.headers.host ?? 'localhost';
      const origin = `${protocol}://${host}`;
      const title = `Stack score: ${result.score}/100 · Dr. Gordon Pelican`;
      const cardUrl = `${origin}/card/${shareMatch[1]}`;
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html>
        <html lang="en"><head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>${escapeHtml(title)}</title>
          <meta property="og:type" content="website">
          <meta property="og:title" content="${escapeHtml(title)}">
          <meta property="og:description" content="${escapeHtml(result.roast)}">
          <meta property="og:image" content="${escapeHtml(cardUrl)}">
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:image" content="${escapeHtml(cardUrl)}">
        </head><body>
          <a id="app-link" href="/">View the full review</a>
          <script>
            const token = new URL(window.location.href).searchParams.get('token');
            if (token) {
              const link = document.querySelector('#app-link');
              link.href = '/?token=' + encodeURIComponent(token);
            }
          </script>
        </body></html>`);
      return;
    }

    if (request.method === 'POST' && request.url === '/roast') {
      void (async () => {
        try {
          const body = (await readJson(request)) as { url?: unknown };
          if (!validTargetUrl(body?.url)) {
            sendJson(response, 400, { error: 'A valid HTTP(S) URL is required' });
            return;
          }

          const snapshot = await dependencies.fetchTarget(body.url);
          const detections = dependencies.detectStack(snapshot);
          const score = dependencies.scoreStack(detections);
          const result = await dependencies.roast(detections, score.score, score.band);
          const shareId = rememberResult(result);
          let shareUrl: string | undefined;
          if (options.publishShareResult) {
            try {
              ({ shareUrl } = await options.publishShareResult(shareId, result));
            } catch (error) {
              console.error('Public share publish failed', error);
            }
          }
          sendJson(response, 200, {
            ...result,
            shareId,
            ...(shareUrl ? { shareUrl } : {}),
          });
        } catch (error) {
          if (
            error instanceof SyntaxError ||
            (error instanceof Error && error.message === 'Request body too large')
          ) {
            sendJson(response, 400, { error: 'Invalid JSON request body' });
            return;
          }

          console.error('Roast pipeline failed', error);
          sendJson(response, 502, { error: 'Dr. Pelican could not complete the review' });
        }
      })();
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  });
}
