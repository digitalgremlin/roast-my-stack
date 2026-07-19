import OpenAI from 'openai';

import { buildRoastMessages } from './prompt.js';
import type { Band, Detection, Fix, FixKind, RoastResult } from './types.js';

interface RoastCompletion {
  choices: Array<{ message: { content: string | null } }>;
}

export interface RoastClient {
  chat: {
    completions: {
      create(input: unknown): Promise<RoastCompletion>;
    };
  };
}

export interface RoastDependencies {
  client?: RoastClient;
  model?: string;
}

interface ModelRoast {
  roast: string;
  fixes: Fix[];
}

const FIX_KINDS = new Set<FixKind>(['security', 'modernization', 'performance']);

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['roast', 'fixes'],
  properties: {
    roast: { type: 'string', minLength: 1 },
    fixes: {
      type: 'array',
      minItems: 0,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'rationale', 'kind'],
        properties: {
          title: { type: 'string', minLength: 1 },
          rationale: { type: 'string', minLength: 1 },
          kind: {
            type: 'string',
            enum: ['security', 'modernization', 'performance'],
          },
        },
      },
    },
  },
} as const;

function parseModelRoast(content: string | null): ModelRoast {
  if (!content) throw new Error('GPT-5.6 returned no roast');

  const value: unknown = JSON.parse(content);
  if (!value || typeof value !== 'object') throw new Error('GPT-5.6 returned invalid JSON');

  const candidate = value as Partial<ModelRoast>;
  if (typeof candidate.roast !== 'string' || !Array.isArray(candidate.fixes)) {
    throw new Error('GPT-5.6 returned an invalid roast shape');
  }

  const fixes = candidate.fixes.filter(
    (fix): fix is Fix =>
      Boolean(fix) &&
      typeof fix.title === 'string' &&
      typeof fix.rationale === 'string' &&
      FIX_KINDS.has(fix.kind),
  );

  return { roast: candidate.roast, fixes };
}

function isGroundedFix(fix: Fix, detections: Detection[]): boolean {
  const title = fix.title.toLocaleLowerCase();
  return detections.some(({ name }) => title.includes(name.toLocaleLowerCase()));
}

export async function roast(
  detections: Detection[],
  score: number,
  band: Band,
  dependencies: RoastDependencies = {},
): Promise<RoastResult> {
  const client =
    dependencies.client ??
    (new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) as unknown as RoastClient);
  const model = dependencies.model ?? process.env.ROAST_MODEL ?? 'gpt-5.6';
  const completion = await client.chat.completions.create({
    model,
    messages: buildRoastMessages(detections, score, band),
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'dr_pelican_roast',
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
    max_completion_tokens: 900,
  });
  const parsed = parseModelRoast(completion.choices[0]?.message.content ?? null);
  const fixes = parsed.fixes.filter((fix) => isGroundedFix(fix, detections)).slice(0, 5);

  if (detections.length > 0 && fixes.length < 3) {
    throw new Error('GPT-5.6 returned fewer than three grounded fixes');
  }

  return {
    score,
    band,
    spriteId: band,
    detections,
    roast: parsed.roast,
    fixes: detections.length === 0 ? [] : fixes,
  };
}
