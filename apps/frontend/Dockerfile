# ─── Build stage ───
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY apps/frontend/package.json apps/frontend/

RUN pnpm install --frozen-lockfile --filter @ft-trascendence/frontend

COPY apps/frontend/ apps/frontend/
RUN pnpm --filter @ft-trascendence/frontend run build

# ─── Production stage ───
FROM nginx:alpine AS production

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
