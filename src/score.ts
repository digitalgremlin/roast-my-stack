import type { Band, Detection, ScoreResult } from './types.js';

function bandFor(score: number): Band {
  if (score >= 85) return 'impressed';
  if (score >= 65) return 'smug';
  if (score >= 40) return 'concerned';
  if (score >= 20) return 'horrified';
  return 'ashes';
}

export function scoreStack(detections: Detection[]): ScoreResult {
  if (detections.length === 0) {
    return { score: 60, band: 'concerned' };
  }

  const score = detections.reduce((total, detection) => {
    const agePenalty =
      detection.ageRisk === 'eol' ? 20 : detection.ageRisk === 'aging' ? 8 : 0;
    const securityPenalty =
      detection.securityRisk === 'high' ? 25 : detection.securityRisk === 'low' ? 10 : 0;
    return total - agePenalty - securityPenalty;
  }, 100);
  const clamped = Math.max(0, Math.min(100, score));

  return { score: clamped, band: bandFor(clamped) };
}
