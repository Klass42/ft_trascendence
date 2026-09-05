.PHONY: help quickstart nix-portable nix-portable-bin nix-portable-env nix-portable-reset dev ci env all up up-direct clean down fclean re logs logs-backend logs-otel status db-migrate db-generate db-push db-studio db-seed db-seed-small db-seed-large db-reset urls

.DEFAULT_GOAL := all
LOCAL_ENV    := infra/docker/.env
ENV_EXAMPLE   := infra/docker/.env.example
NP_URL      := https://github.com/DavHau/nix-portable/releases/download/v012/nix-portable-$(shell uname -m)
COMPOSE_FILE := infra/docker/docker-compose.yml
COMPOSE_ENV_FILES := --env-file $(ENV_EXAMPLE) $(if $(wildcard $(LOCAL_ENV)),--env-file $(LOCAL_ENV))
COMPOSE      := docker compose $(COMPOSE_ENV_FILES) -f $(COMPOSE_FILE)

NP_BIN      := $(pwd)/build
NP_BIN      := ./nix-portable
NIX 				:= $(NP_BIN) nix
PRISMA       := pnpm --filter @ft-trascendence/backend exec prisma

help: ## Show this help (plain `make` deploys)
	@printf "\n\033[1;36mft_trascendence\033[0m  —  \033[32mmake\033[0m\n"
	@printf "\n\033[1;33mOne command\033[0m\n"
	@printf "  \033[32mmake\033[0m     install nix-portable + docker compose up --build\n"
	@printf "           (ports/URLs/images from \033[36minfra/docker/.env.example\033[0m) + seed\n"
	@printf "  Then open the App URL, accept the self-signed cert, log in:\n"
	@printf "    \033[1mstudent@demo\033[0m / \033[1mdemo1234\033[0m   (also teacher@demo, admin@demo)\n"
	@printf "\n  Datos demo:  make db-seed-small | make db-seed-large | make db-reset\n"
	@printf "  Overlay:     make env          Stop: make down    Wipe: make fclean\n"
	@printf "  Logs:        make logs         Status: make status\n"
	@printf "\n\033[1;33mAll targets\033[0m\n"
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk -F'##' '{printf "  \033[32m%-16s\033[0m %s\n", $$1, $$2}'
	@printf "\n"

deploy-ok:
	@printf "\033[1;32mLogin\033[0m     student@demo  /  demo1234\n"
	@printf "           teacher@demo  /  demo1234\n"
	@printf "           admin@demo    /  demo1234\n"
	@printf "\033[1;33mChrome:\033[0m  accept the self-signed cert on the App URL.\n"
	@printf "\033[1;36mNext:\033[0m    make logs   |   make status   |   make fclean   |   make help\n\n"

urls: ## Imprime las URLs públicas desde LOCAL_ENV
	@set -a; . "./$(LOCAL_ENV)"; set +a; \
	  printf "\n\033[1;32mStack — URLs vía HTTPS (%s):\033[0m\n" "$(LOCAL_ENV)"; \
	  printf "  App:          https://%s:%s\n" "$$CADDY_DOMAIN" "$$CADDY_HTTPS_PORT"; \
	  printf "  Grafana:      https://%s:%s\n" "$$CADDY_DOMAIN" "$$GRAFANA_HOST_PORT"; \
	  printf "  Prometheus:   https://%s:%s\n" "$$CADDY_DOMAIN" "$$PROMETHEUS_HOST_PORT"; \
	  printf "  Tempo:        https://%s:%s\n" "$$CADDY_DOMAIN" "$$TEMPO_HOST_PORT"; \
	  printf "  Loki:         https://%s:%s\n" "$$CADDY_DOMAIN" "$$LOKI_HOST_PORT"; \
	  printf "\n"

nix-portable:
	@test -x "$(NP_BIN)" || { \
	  curl -fL "$(NP_URL)" -o "$(NP_BIN)"; \
	  chmod +x "$(NP_BIN)"; \
	}
	@echo 'export PATH=$(CURDIR):$$PATH'

nix-portable-clean:
	rm -rf "$(NP_LOCATION)" "$(NP_BIN)"

env: ## Crea infra/docker/.env (gitignored) desde .env.example si no existe
	@if [ ! -f "$(LOCAL_ENV)" ]; then \
		cp "$(ENV_EXAMPLE)" "$(LOCAL_ENV)"; \
		printf "\033[1;32mCreado $(LOCAL_ENV) desde $(ENV_EXAMPLE).\033[0m\n"; \
	else \
		printf "\033[1;33m$(LOCAL_ENV) ya existe, no se toca.\033[0m\n"; \
	fi

dev: nix-portable-bin ## Entra en el devShell (Node 22, pnpm, docker, k8s tools)
	$(NIX) develop .#dev

ci: nix-portable-bin ## Ejecuta el pipeline de CI local dentro del flake `ci`
	$(NIX) develop .#ci --command bash scripts/ci.sh

logs: ## Muestra logs del stack (follow)
	$(COMPOSE) logs -f

logs-backend: ## Muestra logs solo del backend
	$(COMPOSE) logs -f backend

logs-otel: ## Muestra logs del OTel Collector
	$(COMPOSE) logs -f otel-collector

status: ## Muestra estado de los servicios
	$(COMPOSE) ps

db-generate: ## Genera el cliente Prisma
	$(COMPOSE) run --rm -v $(CURDIR)/apps/backend/prisma:/app/prisma backend sh -c "npx prisma generate"

db-push: ## Sincroniza el schema con la BD (dev rápido, sin migraciones)
	$(COMPOSE) run --rm -v $(CURDIR)/apps/backend/prisma:/app/prisma backend sh -c "npx prisma db push"

db-migrate: ## Crea una migración de Prisma (NAME=nombre)
	$(COMPOSE) run --rm -v $(CURDIR)/apps/backend/prisma:/app/prisma backend sh -c "npx prisma migrate dev --name $(or $(NAME),init)"

db-studio: ## Abre Prisma Studio
	$(PRISMA) studio

db-seed: ## Reemplaza los datos por la demo estándar (Klass Academy)
	$(COMPOSE) exec -T -e SEED_SCENARIO=standard backend npx prisma db seed

db-seed-small: ## Reemplaza los datos por 1 academia pequeña (8 alumnos, 3 profesores)
	$(COMPOSE) exec -T -e SEED_SCENARIO=small backend npx prisma db seed

db-seed-large: ## Reemplaza los datos por 3 academias (cada una: >=100 alumnos, >=20 profesores)
	$(COMPOSE) exec -T -e SEED_SCENARIO=large backend npx prisma db seed

db-reset: ## ELIMINA todos los datos de aplicación y deja solo un superadmin nuevo
	$(COMPOSE) exec -T -e SEED_SCENARIO=platform backend npx prisma db seed

all: env nix-portable ## Install tools + deploy stack
	$(COMPOSE) up -d --build
	@printf "\033[1;36m==> waiting for backend /health\033[0m\n"
	@ok=0; i=0; \
	while [ $$i -lt 60 ]; do \
	  if $(COMPOSE) exec -T backend wget -q -O- http://127.0.0.1:3000/health 2>/dev/null | grep -q '"status":"ok"'; then ok=1; break; fi; \
	  i=$$((i+1)); sleep 2; \
	done; \
	if [ $$ok -ne 1 ]; then \
	  printf "\033[1;31mbackend did not become healthy — make logs-backend\033[0m\n"; \
	  $(COMPOSE) ps; exit 1; \
	fi
	@$(MAKE) --no-print-directory db-seed
	@$(MAKE) --no-print-directory urls
	@$(MAKE) --no-print-directory deploy-ok

clean: nix-portable-clean ## Para el stack de Docker
	$(COMPOSE) down

fclean: nix-portable-clean ## Para el stack y elimina volúmenes y contenedores huérfanos
	$(COMPOSE) down -v --remove-orphans

re: fclean all ## Limpia por completo y despliega de nuevo
