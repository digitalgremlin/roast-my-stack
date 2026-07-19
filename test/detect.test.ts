import { describe, expect, it } from 'vitest';

import { detectStack } from '../src/detect.js';
import { SIGNATURES } from '../src/signatures.js';
import type { TargetSnapshot } from '../src/types.js';

function snapshot(overrides: Partial<TargetSnapshot> = {}): TargetSnapshot {
  return {
    url: 'https://example.com',
    finalUrl: 'https://example.com',
    status: 200,
    html: '',
    headers: {},
    scripts: [],
    cookies: [],
    ...overrides,
  };
}

describe('detectStack', () => {
  it('detects an aging WordPress, jQuery, and PHP stack with its risks', () => {
    const detections = detectStack(
      snapshot({
        html: '<link rel="stylesheet" href="/wp-content/themes/legacy/style.css">',
        headers: { 'x-powered-by': 'PHP/8.1.27' },
        scripts: ['https://example.com/wp-includes/js/jquery/jquery.min.js'],
      }),
    );

    expect(detections).toEqual(
      expect.arrayContaining([
        {
          name: 'WordPress',
          category: 'CMS',
          ageRisk: 'aging',
          securityRisk: 'low',
        },
        {
          name: 'jQuery',
          category: 'JS Library',
          ageRisk: 'aging',
          securityRisk: 'low',
        },
        {
          name: 'PHP',
          category: 'Language',
          ageRisk: 'aging',
          securityRisk: 'low',
        },
      ]),
    );
  });

  it('detects a modern React and Next.js page without a WordPress false positive', () => {
    const detections = detectStack(
      snapshot({
        html: '<main id="__next"></main><script id="__NEXT_DATA__">{}</script>',
        scripts: ['/_next/static/chunks/react-dom-client.js'],
      }),
    );

    expect(detections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'React', ageRisk: 'modern' }),
        expect.objectContaining({ name: 'Next.js', ageRisk: 'modern' }),
      ]),
    );
    expect(detections).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'WordPress' })]),
    );
  });

  it('checks meta generator, cookies, and headers and emits each technology once', () => {
    const detections = detectStack(
      snapshot({
        html: '<script src="/wp-content/plugins/example/app.js"></script>',
        headers: {
          server: 'cloudflare',
          'x-powered-by': 'Express',
        },
        scripts: ['/wp-content/plugins/example/app.js'],
        metaGenerator: 'WordPress 6.8',
        cookies: ['connect.sid'],
      }),
    );

    expect(detections.filter(({ name }) => name === 'WordPress')).toHaveLength(1);
    expect(detections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Cloudflare' }),
        expect.objectContaining({ name: 'Express' }),
      ]),
    );
  });

  it('uses modern and none as default risks', () => {
    const detections = detectStack(
      snapshot({
        scripts: ['https://www.googletagmanager.com/gtag/js?id=G-TEST'],
      }),
    );

    expect(detections).toContainEqual({
      name: 'Google Analytics',
      category: 'Analytics',
      ageRisk: 'modern',
      securityRisk: 'none',
    });
  });

  it('keeps the clean-room signature set lean, unique, and evidence-based', () => {
    expect(SIGNATURES.length).toBeGreaterThanOrEqual(100);
    expect(SIGNATURES.length).toBeLessThanOrEqual(150);
    expect(new Set(SIGNATURES.map(({ name }) => name)).size).toBe(SIGNATURES.length);
    expect(
      SIGNATURES.every(
        (rule) =>
          rule.html?.length ||
          rule.scriptSrc?.length ||
          rule.metaGenerator ||
          rule.cookie ||
          (rule.headerKey && rule.headerValue),
      ),
    ).toBe(true);
  });

  it('detects representative commerce, hosting, monitoring, and backend signals', () => {
    const detections = detectStack(
      snapshot({
        html: `
          <link href="/static/version123/frontend/Magento/theme/en_US/styles.css">
          <script src="https://js.stripe.com/v3/"></script>
          <script src="https://cdn.segment.com/analytics.js/v1/key/analytics.min.js"></script>
          <script src="https://browser.sentry-cdn.com/8.0.0/bundle.min.js"></script>
        `,
        headers: {
          server: 'Vercel',
          'x-powered-by': 'Laravel',
        },
        scripts: [
          'https://js.stripe.com/v3/',
          'https://cdn.segment.com/analytics.js/v1/key/analytics.min.js',
          'https://browser.sentry-cdn.com/8.0.0/bundle.min.js',
        ],
        cookies: ['laravel_session'],
      }),
    );

    expect(detections.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['Magento', 'Stripe', 'Segment', 'Sentry', 'Vercel', 'Laravel']),
    );
  });

  it('does not match generic markup as a technology signal', () => {
    expect(
      detectStack(
        snapshot({
          html: '<main class="container"><button class="button">Continue</button></main>',
          scripts: ['/assets/app.js'],
          headers: { server: 'custom' },
          cookies: ['session'],
        }),
      ),
    ).toEqual([]);
  });
});
