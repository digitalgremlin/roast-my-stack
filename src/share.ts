import { renderShareCard } from './card.js';
import type { RoastResult } from './types.js';

export interface ShareStore {
  setValue(
    key: string,
    value: string | Buffer,
    options?: { contentType?: string },
  ): Promise<void>;
  getPublicUrl(key: string): string;
}

export interface PublishedShare {
  shareUrl: string;
  cardUrl: string;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character,
  );
}

export async function publishShareResult(
  store: ShareStore,
  id: string,
  result: RoastResult,
): Promise<PublishedShare> {
  const cardKey = `card-${id}.png`;
  const pageKey = `share-${id}.html`;
  const card = await renderShareCard(result);

  await store.setValue(cardKey, card, { contentType: 'image/png' });
  const cardUrl = store.getPublicUrl(cardKey);
  const title = `Stack score: ${result.score}/100 · Dr. Gordon Pelican`;
  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(result.roast)}">
    <meta property="og:image" content="${escapeHtml(cardUrl)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeHtml(cardUrl)}">
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(result.roast)}</p>
      <img src="${escapeHtml(cardUrl)}" alt="${escapeHtml(title)}">
    </main>
  </body>
</html>`;

  await store.setValue(pageKey, page, { contentType: 'text/html; charset=utf-8' });

  return {
    shareUrl: store.getPublicUrl(pageKey),
    cardUrl,
  };
}
