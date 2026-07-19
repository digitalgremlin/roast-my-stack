import { Actor } from 'apify';

import { createServer } from './server.js';

await Actor.init();

const port = Number(
  process.env.APIFY_STANDBY_PORT ?? process.env.ACTOR_STANDBY_PORT ?? process.env.PORT ?? 3000,
);
const server = createServer();

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
