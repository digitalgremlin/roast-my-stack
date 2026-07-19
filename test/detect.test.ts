import { describe, expect, it } from 'vitest';

import { detectStack } from '../src/detect.js';
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
});
