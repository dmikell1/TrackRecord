FROM node:20-bullseye-slim AS base

# Build deps only (Chromium moved to image-processor for text overlay)
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y ca-certificates wget python3 make g++ \
    --no-install-recommends && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS dev-deps
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@8.10.3 && pnpm install --frozen-lockfile

FROM base AS prod-deps
COPY --from=dev-deps /app/node_modules ./node_modules
COPY package*.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@8.10.3 && pnpm prune --production

FROM base AS build
ARG SENTRY_AUTH_TOKEN
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}
COPY --from=dev-deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm@8.10.3 && pnpm run build
RUN find . -name node_modules | xargs rm -rf

FROM base AS release
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app ./
COPY --from=build /app/api-core/src/schema ./build/api-core/src/schema

EXPOSE 80

