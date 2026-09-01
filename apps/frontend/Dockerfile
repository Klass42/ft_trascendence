# ─── Build stage ───
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY apps/frontend/package.json apps/frontend/

RUN pnpm install --frozen-lockfile --filter @ft-trascendence/frontend

COPY apps/frontend/ apps/frontend/

ARG VITE_BACKEND_URL=/api
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}

RUN pnpm --filter @ft-trascendence/frontend run build

# ─── Production stage ───
FROM nginx:alpine AS production

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# envsubst on ${BACKEND_HOST}/${BACKEND_PORT} at start (official nginx image).
# $host / $uri / $remote_addr are left alone — they are not in the container env.
COPY apps/frontend/nginx.conf /etc/nginx/templates/default.conf.template

ENV BACKEND_HOST=backend
ENV BACKEND_PORT=3000
ENV FRONTEND_PORT=80

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
