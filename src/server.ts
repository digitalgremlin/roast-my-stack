import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

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

const DEFAULT_DEPENDENCIES: PipelineDependencies = {
  fetchTarget,
  detectStack,
  scoreStack,
  roast,
};

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

export function createServer(
  overrides: Partial<PipelineDependencies> = {},
): http.Server {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides };

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
          sendJson(response, 200, result);
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
