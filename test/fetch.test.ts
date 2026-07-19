import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchTarget } from '../src/fetch.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTarget', () => {
  it('collects page signals and normalizes headers', async () => {
    const html = `<!doctype html>
      <html>
        <head><meta name="generator" content="WordPress 6.8"></head>
        <body>
          <script src="/assets/app.js"></script>
          <script src="https://cdn.example.test/jquery.min.js"></script>
        </body>
      </html>`;
    const response = new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Powered-By': 'PHP/8.3',
        'Set-Cookie': 'session=abc; Path=/; HttpOnly',
      },
    });
    Object.defineProperty(response, 'url', { value: 'https://example.test/final' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const snapshot = await fetchTarget('https://example.test');

    expect(snapshot.scripts).toEqual([
      'https://example.test/assets/app.js',
      'https://cdn.example.test/jquery.min.js',
    ]);
    expect(snapshot.metaGenerator).toBe('WordPress 6.8');
    expect(snapshot.headers).toMatchObject({
      'content-type': 'text/html; charset=utf-8',
      'x-powered-by': 'PHP/8.3',
    });
    expect(snapshot.cookies).toEqual(['session']);
    expect(snapshot.finalUrl).toBe('https://example.test/final');
  });

  it('returns an empty, non-throwing snapshot when fetching fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Timed out', 'AbortError')));

    await expect(fetchTarget('https://blocked.example')).resolves.toMatchObject({
      url: 'https://blocked.example',
      finalUrl: 'https://blocked.example',
      status: 0,
      html: '',
      scripts: [],
      headers: {},
      cookies: [],
    });
  });

  it('discards non-HTML response bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('{"not":"html"}', {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const snapshot = await fetchTarget('https://blocked.example');

    expect(snapshot.status).toBe(403);
    expect(snapshot.html).toBe('');
  });
});
