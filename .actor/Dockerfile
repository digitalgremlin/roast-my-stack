FROM node:22-bookworm-slim AS build

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /usr/src/app/dist/src ./dist
COPY src/ui ./src/ui
COPY assets ./assets
CMD ["node", "dist/main.js"]
