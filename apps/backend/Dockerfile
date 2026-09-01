# ─── Build stage ───
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY apps/backend/package.json apps/backend/
RUN pnpm install --frozen-lockfile --filter @ft-trascendence/backend

# Copy source and build
COPY apps/backend/ apps/backend/
RUN pnpm --filter @ft-trascendence/backend exec prisma generate
RUN pnpm --filter @ft-trascendence/backend run build

# ─── Production stage ───
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN apk add --no-cache tini=0.19.0-r3

WORKDIR /app

COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
