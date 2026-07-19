import { SIGNATURES } from './signatures.js';
import type {
  Detection,
  SignatureRule,
  TargetSnapshot,
} from './types.js';

function matches(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

function matchesAny(patterns: RegExp[] | undefined, values: string[]): boolean {
  return patterns?.some((pattern) =>
    values.some((value) => matches(pattern, value)),
  ) ?? false;
}

function headerValue(
  headers: Record<string, string>,
  wantedKey: string,
): string | undefined {
  const direct = headers[wantedKey.toLowerCase()];
  if (direct !== undefined) return direct;

  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === wantedKey.toLowerCase(),
  );
  return entry?.[1];
}

function ruleMatches(rule: SignatureRule, snapshot: TargetSnapshot): boolean {
  if (matchesAny(rule.html, [snapshot.html])) return true;
  if (matchesAny(rule.scriptSrc, snapshot.scripts)) return true;

  if (
    rule.metaGenerator &&
    snapshot.metaGenerator &&
    matches(rule.metaGenerator, snapshot.metaGenerator)
  ) {
    return true;
  }

  if (
    rule.cookie &&
    snapshot.cookies.some((cookie) => matches(rule.cookie!, cookie))
  ) {
    return true;
  }

  if (rule.headerKey && rule.headerValue) {
    const value = headerValue(snapshot.headers, rule.headerKey);
    if (value !== undefined && matches(rule.headerValue, value)) return true;
  }

  return false;
}

export function detectStack(snapshot: TargetSnapshot): Detection[] {
  const seen = new Set<string>();
  const detections: Detection[] = [];

  for (const rule of SIGNATURES) {
    if (seen.has(rule.name) || !ruleMatches(rule, snapshot)) continue;

    detections.push({
      name: rule.name,
      category: rule.category,
      ageRisk: rule.ageRisk ?? 'modern',
      securityRisk: rule.securityRisk ?? 'none',
    });
    seen.add(rule.name);
  }

  return detections;
}
