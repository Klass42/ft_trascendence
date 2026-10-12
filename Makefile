# ft_trascendence — task runner. `make` deploys everything; `make help` lists targets.
# The stack itself is plain Docker Compose (compose.yaml + .env in this
# directory), so `docker compose ps|logs|exec …` also works without make.

.DEFAULT_GOAL := all

COMPOSE := docker compose
# Reuses the one-shot `migrate` service (backend image: Prisma CLI + tsx).
PRISMA_RUN := $(COMPOSE) run --rm migrate
PRISMA_DEV := $(COMPOSE) run --rm --user root -v $(CURDIR)/apps/backend/prisma:/app/prisma migrate
# $(call dotenv,KEY) → value of KEY in .env, read when the recipe runs.
dotenv = $$(sed -n 's/^$(1)=//p' .env | tail -n 1)

# Optional local toolchain (Node 22, pnpm, linters) without installing Nix.
NP_DIR := .cache/nix-portable
NP_BIN := $(NP_DIR)/nix-portable
NP_URL := https://github.com/DavHau/nix-portable/releases/download/v012/nix-portable-$(shell uname -m)

.PHONY: all up down clean fclean re reload env status logs urls help check smoke \
        db-seed db-seed-small db-seed-large db-seed-e2e db-reset db-seed-if-empty \
        db-deploy db-migrate db-push db-studio garage-status dev ci

# ─── Deploy ──────────────────────────────────────────────────────────────────

all: ## Deploy: create .env, build, start, seed demo data on first run
	@$(MAKE) --no-print-directory up
	@$(MAKE) --no-print-directory db-seed-if-empty
	@$(MAKE) --no-print-directory urls

up: env ## Build and start the stack (returns once backend and proxy are healthy)
	$(COMPOSE) up -d --build --remove-orphans

down: ## Stop and remove containers (data volumes are kept)
	$(COMPOSE) down --remove-orphans

clean: down ## Same as `down`

fclean: ## Remove containers, data volumes and locally built images (.env is kept)
	$(COMPOSE) down --volumes --remove-orphans --rmi local

re: fclean all ## Wipe everything and deploy from scratch

reload: ## Restart services whose mounted config changed (Caddyfile, Prometheus, Grafana…)
	$(COMPOSE) restart caddy otel-collector prometheus blackbox-exporter tempo loki grafana

env: ## Create .env from .env.example with generated secrets (if missing)
	@bash scripts/gen-env.sh

# ─── Inspect ─────────────────────────────────────────────────────────────────

status: ## Show service state and health
	$(COMPOSE) ps --all

logs: ## Follow logs of every service
	$(COMPOSE) logs -f --tail 100

logs-%: ## Follow logs of one service, e.g. `make logs-backend`
	$(COMPOSE) logs -f --tail 100 $*

urls: ## Print public URLs and logins
	@test -f .env || { echo "No .env yet — run make first."; exit 1; }
	@printf "\n\033[1;32mft_trascendence is up\033[0m (accept the self-signed certificate in Chrome)\n\n"
	@printf "  App       https://%s:%s\n" "$(call dotenv,CADDY_DOMAIN)" "$(call dotenv,CADDY_HTTPS_PORT)"
	@printf "            student@demo / teacher@demo / admin@demo — password demo1234, organization code klass\n"
	@printf "            platform admin (/platform/login): %s / %s\n" "$(call dotenv,PLATFORM_SUPERADMIN_EMAIL)" "$(call dotenv,PLATFORM_SUPERADMIN_PASSWORD)"
	@printf "  Grafana   https://%s:%s\n" "$(call dotenv,CADDY_DOMAIN)" "$(call dotenv,GRAFANA_HOST_PORT)"
	@printf "            %s / %s\n" "$(call dotenv,GF_SECURITY_ADMIN_USER)" "$(call dotenv,GF_SECURITY_ADMIN_PASSWORD)"
	@printf "\n  make status | make logs | make logs-backend | make down | make help\n\n"

smoke: ## Test the running stack through HTTPS (app, proxy, Grafana, Prometheus)
	@bash scripts/smoke.sh

check: ## Validate compose, Caddyfile and Prometheus rules (uses the pinned images)
	$(COMPOSE) --env-file .env.example config --quiet
	docker run --rm -e CADDY_DOMAIN=localhost -e CADDY_TLS=internal -e CADDY_HTTPS_PORT=4443 \
		-v $(CURDIR)/infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro \
		caddy:2.11-alpine caddy validate --config /etc/caddy/Caddyfile
	docker run --rm --entrypoint promtool -v $(CURDIR)/infra/monitoring/prometheus:/etc/prometheus:ro \
		prom/prometheus:v2.54.0 check config /etc/prometheus/prometheus.yml

# ─── Database ────────────────────────────────────────────────────────────────
# Every seed scenario REPLACES application data (see apps/backend/prisma/seed.ts).

define seed
	$(PRISMA_RUN) sh -c "node_modules/.bin/prisma migrate deploy && SEED_SCENARIO=$(1) node_modules/.bin/tsx prisma/seed.ts"
endef

db-seed: ## Replace data with the standard demo (Klass Academy)
	$(call seed,standard)

db-seed-small: ## Replace data with one small academy (8 students, 3 teachers)
	$(call seed,small)

db-seed-large: ## Replace data with 3 academies (>=100 students, >=20 teachers each)
	$(call seed,large)

db-seed-e2e: ## Replace data with the two minimal tenants used by Playwright
	$(call seed,e2e)

db-reset: ## DELETE all application data, keep only a fresh superadmin
	$(call seed,platform)

db-seed-if-empty:
	@n=$$($(COMPOSE) exec -T postgres sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -tAc "SELECT count(*) FROM \"Organization\""'); \
	if [ "$$n" = "0" ]; then \
	  printf "\033[1;36m==> empty database: loading the standard demo data\033[0m\n"; \
	  $(MAKE) --no-print-directory db-seed; \
	else \
	  printf "\033[1;36m==> database already has data: not seeding (make db-seed to reset it)\033[0m\n"; \
	fi

db-deploy: ## Apply committed Prisma migrations
	$(PRISMA_RUN)

db-migrate: ## Create a migration from schema.prisma changes (NAME=add_something)
	$(PRISMA_DEV) node_modules/.bin/prisma migrate dev --name $(or $(NAME),change)

db-push: ## Push schema.prisma to the database without a migration (prototyping)
	$(PRISMA_DEV) node_modules/.bin/prisma db push

db-studio: ## Open Prisma Studio (host Node, needs DATABASE_URL)
	pnpm --filter @ft-trascendence/backend exec prisma studio

garage-status: ## Show the Garage (S3) node, bucket and key
	$(COMPOSE) exec -T garage /garage status
	$(COMPOSE) exec -T garage /garage bucket list
	$(COMPOSE) exec -T garage /garage key list

# ─── Local toolchain (optional) ──────────────────────────────────────────────

$(NP_BIN):
	@mkdir -p $(NP_DIR)
	curl -fL "$(NP_URL)" -o $(NP_BIN)
	chmod +x $(NP_BIN)
	ln -sf nix-portable $(NP_DIR)/nix

dev: $(NP_BIN) ## Enter the Nix dev shell (Node 22, pnpm, docker client)
	$(NP_BIN) nix develop .#dev

ci: $(NP_BIN) ## Run the CI pipeline locally inside the Nix ci shell
	$(NP_BIN) nix develop .#ci --command bash scripts/ci.sh

help: ## Show this help
	@printf "\n\033[1;36mft_trascendence\033[0m — \033[32mmake\033[0m deploys the whole stack\n\n"
	@grep -hE '^[a-zA-Z0-9_%-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  \033[32m%-16s\033[0m %s\n", $$1, $$2}'
	@printf "\n"
