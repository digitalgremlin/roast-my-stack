import { afterEach, describe, expect, it } from 'vitest';

import { createServer, type PipelineDependencies } from '../src/server.js';
import type { RoastResult, TargetSnapshot } from '../src/types.js';

const servers: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

async function startServer(dependencies?: Partial<PipelineDependencies>): Promise<string> {
  const server = createServer(dependencies);
  servers.push(server);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP server address');

  return `http://127.0.0.1:${address.port}`;
}

describe('createServer', () => {
  it('reports health as JSON', async () => {
    const response = await fetch(`${await startServer()}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('serves an HTML placeholder', async () => {
    const response = await fetch(await startServer());
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('id="roast-form"');
    expect(html).toContain('id="result"');
  });

  it('preserves query-token authentication for browser assets and API calls', async () => {
    const origin = await startServer();
    const [pageResponse, scriptResponse] = await Promise.all([
      fetch(origin),
      fetch(`${origin}/app.js`),
    ]);
    const [html, script] = await Promise.all([
      pageResponse.text(),
      scriptResponse.text(),
    ]);

    expect(html).toContain('searchParams.get(\'token\')');
    expect(html).toContain('import(authUrl(\'/app.js\'))');
    expect(script).toContain('searchParams.get(\'token\')');
    expect(script).toContain("fetch(authUrl('/roast')");
    expect(script).toContain("pelican.src = authUrl(`/assets/sprites/");
    expect(script).toContain("shareLink.href = authUrl(`/share/");
  });

  it('serves mood sprites as PNG assets', async () => {
    const response = await fetch(
      `${await startServer()}/assets/sprites/pelican-ashes.png`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(100);
  });

  it('runs the full roast pipeline and returns a RoastResult', async () => {
    const snapshot: TargetSnapshot = {
      url: 'https://example.test',
      finalUrl: 'https://example.test',
      status: 200,
      html: '',
      headers: {},
      scripts: [],
      cookies: [],
    };
    const expected: RoastResult = {
      score: 100,
      band: 'impressed',
      spriteId: 'impressed',
      detections: [
        {
          name: 'React',
          category: 'JS Framework',
          ageRisk: 'modern',
          securityRisk: 'none',
        },
      ],
      roast: 'Hmph. Adequate.',
      fixes: [
        {
          title: 'React: keep dependencies patched',
          rationale: 'Current dependencies reduce known security exposure.',
          kind: 'security',
        },
      ],
    };
    const dependencies: PipelineDependencies = {
      fetchTarget: async () => snapshot,
      detectStack: () => expected.detections,
      scoreStack: () => ({ score: 100, band: 'impressed' }),
      roast: async () => expected,
    };
    const response = await fetch(`${await startServer(dependencies)}/roast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.test' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...expected,
      shareId: expect.any(String),
    });
  });

  it.each([
    {},
    { url: 'not a URL' },
    { url: 'file:///etc/passwd' },
  ])('rejects invalid roast input %#', async (body) => {
    const response = await fetch(`${await startServer()}/roast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
  });
});
