import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Resvg } from '@resvg/resvg-js';

import type { RoastResult } from './types.js';

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;',
      })[character] ?? character,
  );
}

function wrap(value: string, maxLength: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];

  for (const word of words) {
    const last = lines.at(-1);
    if (!last || last.length + word.length + 1 > maxLength) {
      if (lines.length === maxLines) break;
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${last} ${word}`;
    }
  }

  if (words.join(' ').length > lines.join(' ').length && lines.length > 0) {
    const finalIndex = lines.length - 1;
    lines[finalIndex] = `${lines[finalIndex]?.replace(/[.,;:!?]?$/, '')}…`;
  }

  return lines;
}

export async function renderShareCard(result: RoastResult): Promise<Buffer> {
  const sprite = await readFile(
    path.join(process.cwd(), 'assets/sprites', `pelican-${result.spriteId}.png`),
  );
  const spriteUrl = `data:image/png;base64,${sprite.toString('base64')}`;
  const roastLines = wrap(result.roast, 52, 4);
  const technologies =
    result.detections.map(({ name }) => name).slice(0, 6).join(' · ') || 'Signals obscured';
  const band = result.band.toUpperCase();
  const lineMarkup = roastLines
    .map(
      (line, index) =>
        `<tspan x="532" dy="${index === 0 ? 0 : 54}">${escapeXml(line)}</tspan>`,
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#07142f"/>
    <path d="M0 70H1200M0 560H1200" stroke="#e7bd62" stroke-width="2" opacity=".32"/>
    <rect x="34" y="34" width="1132" height="562" fill="none" stroke="#e7bd62" stroke-width="4"/>
    <rect x="64" y="64" width="414" height="502" fill="#0c1d3d" stroke="#e7bd62" stroke-width="2"/>
    <image href="${spriteUrl}" x="68" y="68" width="406" height="406" preserveAspectRatio="xMidYMid slice"/>
    <rect x="315" y="438" width="132" height="100" fill="#e7bd62"/>
    <text x="330" y="506" fill="#07142f" font-family="serif" font-size="68" font-weight="700">${result.score}</text>
    <text x="399" y="506" fill="#07142f" font-family="monospace" font-size="18" font-weight="700">/100</text>
    <text x="532" y="92" fill="#e7bd62" font-family="monospace" font-size="18" font-weight="700" letter-spacing="3">DR. GORDON PELICAN · ${band}</text>
    <text x="532" y="158" fill="#f7efd8" font-family="serif" font-size="42" font-style="italic">${lineMarkup}</text>
    <line x1="532" y1="405" x2="1110" y2="405" stroke="#ef8d32" stroke-width="5"/>
    <text x="532" y="453" fill="#aeb8cc" font-family="monospace" font-size="18">${escapeXml(technologies)}</text>
    <text x="532" y="531" fill="#f7efd8" font-family="serif" font-size="34" font-style="italic" font-weight="700">ROAST MY STACK</text>
    <text x="532" y="560" fill="#71809d" font-family="monospace" font-size="15">A NEEDLESSLY CREDENTIALED TECH REVIEW</text>
  </svg>`;

  const image = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: 'DejaVu Sans',
    },
  }).render();

  return Buffer.from(image.asPng());
}
