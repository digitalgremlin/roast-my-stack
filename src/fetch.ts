import * as cheerio from 'cheerio';

import type { TargetSnapshot } from './types.js';

const TIMEOUT_MS = 10_000;
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 RoastMyStack/0.1';

function emptySnapshot(url: string): TargetSnapshot {
  return {
    url,
    finalUrl: url,
    status: 0,
    html: '',
    headers: {},
    scripts: [],
    cookies: [],
  };
}

function collectCookies(headers: Headers): string[] {
  const values =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie')].filter((value): value is string => value !== null);

  return [
    ...new Set(
      values
        .flatMap((value) => value.split(/,(?=\s*[^;,=\s]+=[^;,]*)/))
        .map((value) => value.split('=', 1)[0]?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];
}

export async function fetchTarget(url: string): Promise<TargetSnapshot> {
  const fallback = emptySnapshot(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': DESKTOP_USER_AGENT,
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    const headers = Object.fromEntries(
      [...response.headers.entries()].map(([key, value]) => [key.toLowerCase(), value]),
    );
    const finalUrl = response.url || url;
    const contentType = headers['content-type'] ?? '';
    const isHtml = /(?:text\/html|application\/xhtml\+xml)/i.test(contentType);

    if (!response.ok || !isHtml) {
      return {
        ...fallback,
        finalUrl,
        status: response.status,
        headers,
        cookies: collectCookies(response.headers),
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const scripts = $('script[src]')
      .map((_index, element) => {
        const source = $(element).attr('src');
        if (!source) return null;

        try {
          return new URL(source, finalUrl).href;
        } catch {
          return source;
        }
      })
      .get();
    const metaGenerator =
      $('meta[name="generator" i]').first().attr('content')?.trim() || undefined;

    return {
      url,
      finalUrl,
      status: response.status,
      html,
      headers,
      scripts,
      metaGenerator,
      cookies: collectCookies(response.headers),
    };
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
