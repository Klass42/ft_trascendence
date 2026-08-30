.PHONY: help dev ci all clean fclean re logs logs-backend logs-otel status db-migrate db-generate db-push db-studio db-seed nix-check

COMPOSE := docker compose -f infra/docker/docker-compose.yml
PRISMA := pnpm --filter @ft-trascendence/backend exec prisma

# ─── Nix Check & Install (Sin Sudo) ───────────────────────
nix-check:
	@if ! command -v nix > /dev/null 2>&1; then \
		echo "\033[1;33mNix no está instalado. Iniciando instalación monousuario (sin sudo)...\033[0m"; \
		curl -L https://nixos.org/nix/install | sh -s -- --no-daemon; \
		echo "\033[1;36mConfigurando PATH y recargando entorno...\033[0m"; \
		if [ -f $$HOME/.nix-profile/etc/profile.d/nix.sh ]; then \
			. $$HOME/.nix-profile/etc/profile.d/nix.sh; \
		fi; \
	else \
		echo "\033[1;32mNix ya está instalado.\033[0m"; \
	fi
	@if [ -f $$HOME/.nix-profile/etc/profile.d/nix.sh ]; then \
		. $$HOME/.nix-profile/etc/profile.d/nix.sh; \
	fi
	@echo 'export PATH="$$HOME/.nix-profile/bin:$$PATH"' >> $$HOME/.bashrc
	@echo 'if [ -e $$HOME/.nix-profile/etc/profile.d/nix.sh ]; then . $$HOME/.nix-profile/etc/profile.d/nix.sh; fi' >> $$HOME/.bashrc
	@echo "\033[1;32m¡Nix configurado con éxito! Ejecuta 'source ~/.bashrc' si lo necesitas en otras terminales abiertas.\033[0m"

# ─── General ───────────────────────────────────────────────
help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk -F'##' '{printf "\033[32m%-15s\033[0m %s\n", $$1, $$2}'

# ─── Development ───────────────────────────────────────────
dev: nix-check ## Comprueba Nix, entra en el devShell y arranca el entorno de desarrollo
	nix develop .#dev

ci: nix-check ## Comprueba Nix y ejecuta el pipeline de CI local
	nix develop .#ci --command bash scripts/ci.sh

# ─── Deploy ────────────────────────────────________________
all: ## Despliega el stack completo (build + HTTPS + monitoring)
	$(COMPOSE) up -d --build
	@printf "\n\033[1;32mStack desplegado — todas las URLs vía HTTPS:\033[0m\n"
	@printf "  App:          https://localhost\n"
	@printf "  Grafana:      https://localhost:3001\n"
	@printf "  Prometheus:   https://localhost:9090\n"
	@printf "  Tempo:        https://localhost:3200\n"
	@printf "  Loki:         https://localhost:3100\n\n"

clean: ## Para el stack de Docker
	$(COMPOSE) down

fclean: ## Para el stack y elimina volúmenes y contenedores huérfanos
	$(COMPOSE) down -v --remove-orphans

re: fclean all ## Limpia por completo y despliega de nuevo

logs: ## Muestra logs del stack (follow)
	$(COMPOSE) logs -f

logs-backend: ## Muestra logs solo del backend
	$(COMPOSE) logs -f backend

logs-otel: ## Muestra logs del OTel Collector
	$(COMPOSE) logs -f otel-collector

status: ## Muestra estado de los servicios
	$(COMPOSE) ps

# ─── Database (Prisma) ────────────────────────────────────
db-generate: ## Genera el cliente Prisma
	$(PRISMA) generate

db-push: ## Sincroniza el schema con la BD (dev rápido, sin migraciones)
	$(PRISMA) db push

db-migrate: ## Crea una migración de Prisma (NAME=nombre)
	$(COMPOSE) run --rm -v ../../apps/backend/prisma:/app/prisma backend sh -c "npx prisma migrate dev --name $(or $(NAME),init)"

db-studio: ## Abre Prisma Studio
	$(PRISMA) studio

db-seed: ## Carga datos demo deterministas (1 org, 3 users con demo1234, 1 curso)
	$(PRISMA) db seed
