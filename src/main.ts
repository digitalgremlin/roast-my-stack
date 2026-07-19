import { Actor, KeyValueStore } from 'apify';

import { createServer } from './server.js';
import { publishShareResult } from './share.js';

await Actor.init();

const port = Number(
  process.env.ACTOR_WEB_SERVER_PORT ??
    process.env.APIFY_STANDBY_PORT ??
    process.env.ACTOR_STANDBY_PORT ??
    process.env.PORT ??
    3000,
);
const shareStore = await KeyValueStore.open();
const server = createServer(
  {},
  {
    publishShareResult: (id, result) => publishShareResult(shareStore, id, result),
  },
);

server.listen(port, '0.0.0.0', () => {
  console.log(`Roast My Stack listening on port ${port}`);
});

const shutdown = (): void => {
  server.close(() => {
    void Actor.exit();
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
