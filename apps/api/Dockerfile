FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm --filter @logix/shared build
RUN pnpm --filter @logix/api prisma:generate
RUN pnpm --filter @logix/api build

FROM base AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --chown=nestjs:nodejs package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY --chown=nestjs:nodejs packages/ ./packages/
COPY --chown=nestjs:nodejs apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY --chown=nestjs:nodejs apps/api/prisma ./apps/api/prisma

COPY --chown=nestjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --chown=nestjs:nodejs --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --chown=nestjs:nodejs --from=builder /app/apps/api/dist ./apps/api/dist

USER nestjs
EXPOSE 3001
WORKDIR /app/apps/api
CMD ["node", "dist/src/main.js"]
