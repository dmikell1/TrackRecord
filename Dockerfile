FROM node:20-bullseye-slim AS base

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

FROM base AS dev-deps
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN pnpm install --frozen-lockfile

FROM base AS prod-deps
COPY --from=dev-deps /app/node_modules ./node_modules
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm prune --prod

FROM base AS build
ARG SENTRY_AUTH_TOKEN
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build
RUN find . -name node_modules | xargs rm -rf

FROM base AS release
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app ./
COPY --from=build /app/api-core/src/schema ./build/api-core/src/schema

EXPOSE 80

CMD ["node", "./build/api-core/src/index.js"]

