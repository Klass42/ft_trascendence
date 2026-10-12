# syntax=docker/dockerfile:1
#
# One image, two uses (see compose.yaml):
#   backend  → node dist/main.js           (long-running, one process)
#   migrate  → prisma migrate deploy       (one-shot, runs before backend)
# The Prisma CLI and tsx stay in the image so `make db-seed*` keeps working.

# ─── build ───
FROM node:22-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
 && pnpm config set store-dir /pnpm/store
WORKDIR /app

# Dependencies first: this layer is reused until the lockfile changes, and the
# pnpm store survives across builds in a BuildKit cache mount.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @ft-trascendence/backend

COPY apps/backend/ apps/backend/
RUN pnpm --filter @ft-trascendence/backend exec prisma generate \
 && pnpm --filter @ft-trascendence/backend run build

# ─── runtime ───
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/prisma ./prisma
COPY --from=build /app/apps/backend/package.json ./

# Local storage driver writes here; a new named volume inherits this ownership.
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
