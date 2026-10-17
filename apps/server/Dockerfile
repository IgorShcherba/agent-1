FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/terminal/package.json apps/terminal/package.json
RUN yarn install --immutable

COPY apps/server apps/server
RUN yarn workspace @pi-durable-bot/server build
RUN yarn workspaces focus @pi-durable-bot/server --production

FROM node:24.18.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4310 DATA_DIR=/app/data

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/server/package.json ./apps/server/package.json
COPY --from=build --chown=node:node /app/apps/server/dist ./apps/server/dist
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 4310
CMD ["node", "apps/server/dist/index.js"]
