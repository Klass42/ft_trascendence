# syntax=docker/dockerfile:1
#
# Static SPA: built with Vite, served by unprivileged nginx on :8080.
# TLS, compression and /api routing live in Caddy (infra/caddy/Caddyfile).

# ─── build ───
FROM node:22-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate \
 && pnpm config set store-dir /pnpm/store
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/frontend/package.json apps/frontend/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @ft-trascendence/frontend

COPY apps/frontend/ apps/frontend/
RUN pnpm --filter @ft-trascendence/frontend run build

# ─── runtime ───
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 8080
