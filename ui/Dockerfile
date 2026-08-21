FROM node:24-alpine AS base

WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmmirror.com

ENV COREPACK_NPM_REGISTRY=${NPM_REGISTRY}

RUN corepack enable \
    && corepack prepare pnpm@9.1.0 --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml ./

RUN pnpm config set registry ${NPM_REGISTRY} \
    && pnpm config set fetch-retries 5 \
    && pnpm config set fetch-timeout 120000 \
    && pnpm install --frozen-lockfile

FROM base AS builder

WORKDIR /app

ARG API_PROXY_URL=http://127.0.0.1:8000/api/:path*

ENV API_PROXY_URL=${API_PROXY_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm exec next build --webpack

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
