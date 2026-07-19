import { describe, expect, it, vi } from 'vitest';

import { buildRoastMessages } from '../src/prompt.js';
import { roast, type RoastClient } from '../src/roast.js';
import type { Detection } from '../src/types.js';

const detections: Detection[] = [
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
];

function mockClient(payload: unknown): RoastClient {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(payload) } }],
        }),
      },
    },
  };
}

describe('buildRoastMessages', () => {
  it('grounds the user message in detected names, score, and mood band', () => {
    const messages = buildRoastMessages(detections, 46, 'concerned');
    const userMessage = messages.find(({ role }) => role === 'user')?.content ?? '';

    expect(userMessage).toContain('WordPress');
    expect(userMessage).toContain('jQuery');
    expect(userMessage).toContain('PHP');
    expect(userMessage).toContain('46');
    expect(userMessage).toContain('concerned');
  });
});

describe('roast', () => {
  it('returns a graceful no-signal roast without calling GPT', async () => {
    const client = mockClient({
      roast: 'This response must never be used.',
      fixes: [],
    });

    const result = await roast([], 60, 'concerned', { client });

    expect(result).toEqual({
      score: 60,
      band: 'concerned',
      spriteId: 'concerned',
      detections: [],
      roast: expect.stringContaining('Dr. Gordon Pelican'),
      fixes: [],
    });
    expect(client.chat.completions.create).not.toHaveBeenCalled();
  });

  it('returns a mood-matched, grounded roast with three to five fixes', async () => {
    const client = mockClient({
      roast: 'WordPress, jQuery, and PHP have assembled a faculty meeting from 2012.',
      fixes: [
        {
          title: 'WordPress: lock down extensions',
          rationale: 'Patch core, themes, and plugins promptly.',
          kind: 'security',
        },
        {
          title: 'jQuery: remove legacy dependencies',
          rationale: 'Reduce aging browser-side attack surface.',
          kind: 'modernization',
        },
        {
          title: 'PHP: stay on a supported release',
          rationale: 'Apply current runtime security fixes.',
          kind: 'security',
        },
      ],
    });

    const result = await roast(detections, 46, 'concerned', { client });

    expect(result.spriteId).toBe('concerned');
    expect(result.fixes).toHaveLength(3);
    expect(result.fixes.every((fix) => detections.some(({ name }) => fix.title.includes(name)))).toBe(
      true,
    );
  });

  it('drops fixes that mention undetected technology', async () => {
    const client = mockClient({
      roast: 'A technically grounded critique.',
      fixes: [
        {
          title: 'WordPress: enable automatic security updates',
          rationale: 'Keep the detected CMS patched.',
          kind: 'security',
        },
        {
          title: 'jQuery: upgrade or remove it',
          rationale: 'Avoid legacy client-side risk.',
          kind: 'modernization',
        },
        {
          title: 'PHP: upgrade the runtime',
          rationale: 'Stay within security support.',
          kind: 'security',
        },
        {
          title: 'React: migrate to server components',
          rationale: 'This technology was not detected.',
          kind: 'performance',
        },
      ],
    });

    const result = await roast(detections, 46, 'concerned', { client });

    expect(result.fixes.map(({ title }) => title)).not.toContain(
      'React: migrate to server components',
    );
    expect(result.fixes).toHaveLength(3);
  });
});
