import { describe, expect, it } from 'vitest';

import { scoreStack } from '../src/score.js';
import type { Detection } from '../src/types.js';

function detection(overrides: Partial<Detection> = {}): Detection {
  return {
    name: 'React',
    category: 'JS Framework',
    ageRisk: 'modern',
    securityRisk: 'none',
    ...overrides,
  };
}

describe('scoreStack', () => {
  it('rates a fully modern stack as impressed and clamps at 100', () => {
    expect(scoreStack([detection(), detection({ name: 'Next.js' })])).toEqual({
      score: 100,
      band: 'impressed',
    });
  });

  it('rates an aging, low-security-risk stack in the concerned band', () => {
    const stack = ['WordPress', 'jQuery', 'PHP'].map((name) =>
      detection({ name, ageRisk: 'aging', securityRisk: 'low' }),
    );

    expect(scoreStack(stack)).toEqual({ score: 46, band: 'concerned' });
  });

  it('rates a heavily EOL and high-risk stack as ashes and clamps at zero', () => {
    const stack = ['Old CMS', 'Old Runtime', 'Old Server'].map((name) =>
      detection({ name, ageRisk: 'eol', securityRisk: 'high' }),
    );

    expect(scoreStack(stack)).toEqual({ score: 0, band: 'ashes' });
  });

  it('uses the cannot-see-stack fallback for no detections', () => {
    expect(scoreStack([])).toEqual({ score: 60, band: 'concerned' });
  });

});
