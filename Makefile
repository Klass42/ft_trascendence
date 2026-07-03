.PHONY: help env dev debug ci deps build up down logs images clean

COMPOSE_FILE := infra/docker/docker-compose.dev.yml
COMPOSE := docker compose -f $(COMPOSE_FILE)

# ─── General ───────────────────────────────────────────────
help: ## Muestra esta ayuda
	@printf "\033[1;33mComandos disponibles:\033[0m\n"
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk -F'##' '{printf "\033[32m%-15s\033[0m %s\n", $$1, $$2}'

env: ## Activa direnv
	direnv allow

# ─── Nix Shells ────────────────────────────────────────────
dev: ## Ejecuta una shell con todo lo necesario para desarrollar
	nix develop .#dev

debug: ## Ejecuta una shell con todo lo necesario para debugear
	nix develop .#debug

ci: ## Ejecuta pipeline CI local
	nix develop .#ci --command bash scripts/ci.sh

# ─── Dependencies ──────────────────────────────────────────
deps: ## Instala dependencias del proyecto (pnpm install)
	pnpm install

# ─── Build ─────────────────────────────────────────────────
build: ## Construye frontend y backend
	pnpm -r run build

# ─── Docker Compose (Development) ─────────────────────────
up: ## Levanta el stack de desarrollo completo (app + observability)
	$(COMPOSE) up -d
	@printf "\n\033[1;32mStack levantado:\033[0m\n"
	@printf "  Frontend:    http://localhost:5173\n"
	@printf "  Backend:     http://localhost:3000\n"
	@printf "  Grafana:     http://localhost:3001  (admin/admin)\n"
	@printf "  Prometheus:  http://localhost:9090\n"
	@printf "  Tempo:       http://localhost:3200\n"
	@printf "  Loki:        http://localhost:3100\n"
	@printf "  OTel:        http://localhost:4318\n\n"

down: ## Para el stack de desarrollo
	$(COMPOSE) down

down-v: ## Para el stack y elimina volúmenes
	$(COMPOSE) down -v

logs: ## Muestra logs del stack (follow)
	$(COMPOSE) logs -f

logs-backend: ## Muestra logs solo del backend
	$(COMPOSE) logs -f backend

logs-otel: ## Muestra logs del OTel Collector
	$(COMPOSE) logs -f otel-collector

status: ## Muestra estado de los servicios
	$(COMPOSE) ps

# ─── Base de datos (Prisma) ───────────────────────────────
PRISMA := pnpm --filter @ft-trascendence/backend exec prisma

db-generate: ## Genera el cliente Prisma
	$(PRISMA) generate

db-push: ## Sincroniza el schema con la BD (dev rápido, sin migraciones)
	$(PRISMA) db push

db-migrate: ## Crea/aplica una migración de desarrollo (NAME=nombre)
	$(PRISMA) migrate dev --name $(or $(NAME),init)

db-studio: ## Abre Prisma Studio
	$(PRISMA) studio

# ─── Nix OCI Images ───────────────────────────────────────
images: ## Construye imágenes OCI con Nix
	nix build .#backend-image
	nix build .#frontend-image
	@printf "\033[32mImágenes construidas.\033[0m Carga con: docker load < result\n"

# ─── Kubernetes ────────────────────────────────────────────
k8s-apply: ## Aplica manifiestos de K8s
	kubectl apply -f infra/k8s/namespace.yml
	kubectl apply -f infra/k8s/monitoring/ -R
	kubectl apply -f infra/k8s/backend/
	kubectl apply -f infra/k8s/frontend/

k8s-delete: ## Elimina todos los recursos de K8s
	kubectl delete namespace ft-trascendence --ignore-not-found

# ─── Cleanup ──────────────────────────────────────────────
clean: ## Limpia artefactos de build
	pnpm -r run clean
	rm -rf result

all: help
