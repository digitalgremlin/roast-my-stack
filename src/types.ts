export type Band = 'impressed' | 'smug' | 'concerned' | 'horrified' | 'ashes';

export interface TargetSnapshot {
  url: string;
  finalUrl: string;
  status: number;
  html: string;
  headers: Record<string, string>;
  scripts: string[];
  metaGenerator?: string;
  cookies: string[];
}

export type AgeRisk = 'modern' | 'aging' | 'eol';
export type SecurityRisk = 'none' | 'low' | 'high';

export interface SignatureRule {
  name: string;
  category: string;
  html?: RegExp[];
  headerKey?: string;
  headerValue?: RegExp;
  scriptSrc?: RegExp[];
  metaGenerator?: RegExp;
  cookie?: RegExp;
  ageRisk?: AgeRisk;
  securityRisk?: SecurityRisk;
}

export interface Detection {
  name: string;
  category: string;
  ageRisk: AgeRisk;
  securityRisk: SecurityRisk;
}

export interface ScoreResult {
  score: number;
  band: Band;
}

export type FixKind = 'security' | 'modernization' | 'performance';

export interface Fix {
  title: string;
  rationale: string;
  kind: FixKind;
}

export interface RoastResult {
  score: number;
  band: Band;
  spriteId: Band;
  detections: Detection[];
  roast: string;
  fixes: Fix[];
}
