import { describe, expect, it, vi } from 'vitest';

import { publishShareResult, type ShareStore } from '../src/share.js';
import type { RoastResult } from '../src/types.js';

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
  roast: 'WordPress has brought archival material to a security review.',
  fixes: [],
};

describe('publishShareResult', () => {
  it('publishes a signed public PNG and an OG page without embedding credentials', async () => {
    const records = new Map<string, { value: string | Buffer; contentType?: string }>();
    const store: ShareStore = {
      setValue: vi.fn(async (key, value, options) => {
        records.set(key, { value, contentType: options?.contentType });
      }),
      getPublicUrl: (key) => `https://storage.test/${key}?signature=signed`,
    };

    const published = await publishShareResult(store, 'share_123', sample);

    expect(published.shareUrl).toBe(
      'https://storage.test/share-share_123.html?signature=signed',
    );
    expect(published.cardUrl).toBe(
      'https://storage.test/card-share_123.png?signature=signed',
    );

    const card = records.get('card-share_123.png');
    expect(card?.contentType).toBe('image/png');
    expect(Buffer.isBuffer(card?.value) && card.value.subarray(0, 8).toString('hex')).toBe(
      '89504e470d0a1a0a',
    );

    const page = records.get('share-share_123.html');
    expect(page?.contentType).toBe('text/html; charset=utf-8');
    expect(page?.value).toContain('property="og:image"');
    expect(page?.value).toContain(published.cardUrl);
    expect(page?.value).not.toContain('apify_api_');
  });
});
