import { afterEach, describe, expect, it } from 'vitest';

import { renderShareCard } from '../src/card.js';
import { createServer, type PipelineDependencies } from '../src/server.js';
import type { RoastResult, TargetSnapshot } from '../src/types.js';

const sample: RoastResult = {
  score: 46,
  band: 'concerned',
  spriteId: 'concerned',
  detections: [
    {
      name: 'WordPress',
      category: 'CMS',
      ageRisk: 'aging',
      securityRisk: 'low',
    },
  ],
  roast: 'WordPress has submitted a tenure packet written entirely in plugin updates.',
  fixes: [
    {
      title: 'WordPress: patch core and plugins',
      rationale: 'Reduce known extension vulnerabilities.',
      kind: 'security',
    },
  ],
};

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

async function startServer(): Promise<string> {
  const snapshot: TargetSnapshot = {
    url: 'https://example.test',
    finalUrl: 'https://example.test',
    status: 200,
    html: '',
    headers: {},
    scripts: [],
    cookies: [],
  };
  const dependencies: PipelineDependencies = {
    fetchTarget: async () => snapshot,
    detectStack: () => sample.detections,
    scoreStack: () => ({ score: sample.score, band: sample.band }),
    roast: async () => sample,
  };
  const server = createServer(dependencies);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  return `http://127.0.0.1:${address.port}`;
}

describe('renderShareCard', () => {
  it('renders a non-empty PNG', async () => {
    const card = await renderShareCard(sample);

    expect(card.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(card.byteLength).toBeGreaterThan(1_000);
  });
});

describe('share routes', () => {
  it('serves the minted result card and an OG share page', async () => {
    const baseUrl = await startServer();
    const roastResponse = await fetch(`${baseUrl}/roast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.test' }),
    });
    const result = (await roastResponse.json()) as RoastResult & { shareId: string };

    expect(result.shareId).toMatch(/^[a-zA-Z0-9_-]+$/);

    const cardResponse = await fetch(`${baseUrl}/card/${result.shareId}`);
    expect(cardResponse.status).toBe(200);
    expect(cardResponse.headers.get('content-type')).toBe('image/png');

    const shareResponse = await fetch(`${baseUrl}/share/${result.shareId}`);
    expect(shareResponse.status).toBe(200);
    expect(await shareResponse.text()).toContain(`/card/${result.shareId}`);
  });

  it('returns 404 for unknown result ids', async () => {
    const baseUrl = await startServer();

    expect((await fetch(`${baseUrl}/card/unknown`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/share/unknown`)).status).toBe(404);
  });
});
