FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @logix/shared build
RUN pnpm --filter @logix/packing build
RUN pnpm --filter @logix/worker build

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 workeruser

COPY --chown=workeruser:nodejs package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY --chown=workeruser:nodejs packages/ ./packages/
COPY --chown=workeruser:nodejs apps/worker/package.json ./apps/worker/

COPY --chown=workeruser:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=workeruser:nodejs --from=builder /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --chown=workeruser:nodejs --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --chown=workeruser:nodejs --from=builder /app/packages/packing/dist ./packages/packing/dist
COPY --chown=workeruser:nodejs --from=builder /app/apps/worker/dist ./apps/worker/dist

USER workeruser
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
