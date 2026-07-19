import { afterEach, describe, expect, it } from 'vitest';

import { createServer } from '../src/server.js';

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
  const server = createServer();
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

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  });
});
