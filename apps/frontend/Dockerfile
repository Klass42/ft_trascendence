FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
# changed: filter needs the workspace package or pnpm matches 0 projects and skips node_modules
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile --filter @ft-trascendence/frontend

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_BACKEND_URL=/api
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

RUN pnpm --filter @ft-trascendence/frontend run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN pnpm add -g serve
COPY --from=builder --chown=node:node /app/apps/frontend/dist ./dist
EXPOSE 5173
USER node
# same listen port as vite.config.ts (FRONTEND_PORT, default 5173 — USER node cannot bind 80)
CMD ["sh", "-c", "serve -s dist -l ${FRONTEND_PORT:-5173}"]
