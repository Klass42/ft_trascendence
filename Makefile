# `make` (no args) = install tools + deploy from params.env
.DEFAULT_GOAL := all
.PHONY: help quickstart nix-portable nix-portable-bin nix-portable-env nix-portable-reset dev ci env all up up-direct clean down fclean re logs logs-backend logs-otel status db-migrate db-generate db-push db-studio db-seed urls

# ─── Paths ─────────────────────────────────────────────────
PARAMS       := infra/docker/params.env
LOCAL_ENV    := infra/docker/.env
COMPOSE_FILE := infra/docker/docker-compose.yml
OVERRIDE     := infra/docker/docker-compose.override.yml
PRISMA       := pnpm --filter @ft-trascendence/backend exec prisma

# params.env is always imported. Optional gitignored .env overlays it (last wins).
COMPOSE_ENV  := --env-file $(PARAMS) $(if $(wildcard $(LOCAL_ENV)),--env-file $(LOCAL_ENV))
COMPOSE      := docker compose $(COMPOSE_ENV) -f $(COMPOSE_FILE)
COMPOSE_DIRECT := $(COMPOSE) -f $(OVERRIDE)

# ─── nix-portable (no root, no daemon, no ~/.bashrc mutation) ─
# The upstream binary IS a ~65MB bash self-extractor (file(1) says "bash script").
# It is NOT installed globally — `which nix-portable` is empty on purpose.
# Invoke as:  $(NP_BIN) nix <cmd>   e.g.  nix-portable nix run nixpkgs#hello
# NEVER:      nix-portable run …    (that execs a missing /bin/run)
NP_DIR     := $(CURDIR)/.cache/nix-portable
NP_BIN     := $(NP_DIR)/nix-portable
NP_VERSION := v012
NP_ARCH    := $(shell uname -m)
NP_URL     := https://github.com/DavHau/nix-portable/releases/download/$(NP_VERSION)/nix-portable-$(NP_ARCH)
NP_MIN_BYTES := 10000000
# v012 x86_64 (https://github.com/DavHau/nix-portable/issues/139)
NP_SHA256_x86_64 := b409c55904c909ac3aeda3fb1253319f86a89ddd1ba31a5dec33d4a06414c72a
UNAME_S    := $(shell uname -s)

ifeq ($(UNAME_S),Linux)
  NIX := $(NP_BIN) nix
else
  NIX := nix
endif

define NP_USAGE
	printf "\n\033[1;33mHow to use (not on PATH by default)\033[0m\n"; \
	printf "  eval \"\$$(make nix-portable-env)\"   # PATH for THIS shell only\n"; \
	printf "  nix --version\n"; \
	printf "  nix run nixpkgs#hello\n"; \
	printf "  make dev                         # flake devShell via nix-portable\n"; \
	printf "\n  Direct (no PATH):\n"; \
	printf "  %s nix run nixpkgs#hello\n" "$(NP_BIN)"; \
	printf "  %s nix develop .#dev\n" "$(NP_BIN)"; \
	printf "\n\033[1;31mWrong:\033[0m  nix-portable run nixpkgs#cowsay\n"; \
	printf "\033[1;32mRight:\033[0m  nix-portable \033[1mnix\033[0m run nixpkgs#cowsay\n\n"
endef

# Silent fetch used by `make` / `make all`. Prints usage only on `make nix-portable`.
nix-portable-bin:
ifeq ($(UNAME_S),Linux)
	@mkdir -p "$(NP_DIR)"
	@need=0; \
	if [ "$(FORCE)" = "1" ]; then need=1; fi; \
	if [ ! -x "$(NP_BIN)" ]; then need=1; fi; \
	if [ -e "$(NP_BIN)" ]; then \
	  sz=$$(wc -c < "$(NP_BIN)"); \
	  if [ "$$sz" -lt $(NP_MIN_BYTES) ]; then \
	    printf "\033[1;33m$(NP_BIN) is too small ($$sz bytes) — re-downloading\033[0m\n"; \
	    need=1; \
	  fi; \
	fi; \
	if [ "$$need" = "1" ]; then \
	  printf "\033[1;33m==> installing nix-portable $(NP_VERSION) ($(NP_ARCH))\033[0m\n"; \
	  curl -fL --retry 3 --retry-delay 2 "$(NP_URL)" -o "$(NP_BIN).tmp"; \
	  sz=$$(wc -c < "$(NP_BIN).tmp"); \
	  if [ "$$sz" -lt $(NP_MIN_BYTES) ]; then \
	    printf "\033[1;31mDownload too small ($$sz bytes). GitHub/HTML error?\033[0m\n"; \
	    rm -f "$(NP_BIN).tmp"; exit 1; \
	  fi; \
	  if [ "$(NP_ARCH)" = "x86_64" ] && command -v sha256sum >/dev/null 2>&1; then \
	    got=$$(sha256sum "$(NP_BIN).tmp" | awk '{print $$1}'); \
	    if [ "$$got" != "$(NP_SHA256_x86_64)" ]; then \
	      printf "\033[1;31msha256 mismatch\n  expected $(NP_SHA256_x86_64)\n  got      $$got\033[0m\n"; \
	      rm -f "$(NP_BIN).tmp"; exit 1; \
	    fi; \
	  fi; \
	  mv -f "$(NP_BIN).tmp" "$(NP_BIN)"; \
	  chmod +x "$(NP_BIN)"; \
	fi
	@ln -sfn nix-portable "$(NP_DIR)/nix"
	@ln -sfn nix-portable "$(NP_DIR)/nix-shell"
	@ln -sfn nix-portable "$(NP_DIR)/nix-build"
else
	@true
endif

nix-portable: nix-portable-bin ## Download nix-portable into .cache/ (Linux). FORCE=1 to re-fetch
ifeq ($(UNAME_S),Linux)
	@printf "\033[1;32mnix-portable $(NP_VERSION) → $(NP_BIN)\033[0m  (%s bytes, bash self-extractor — that is expected)\n" "$$(wc -c < "$(NP_BIN)")"
	@$(NP_USAGE)
else
	@if ! command -v nix >/dev/null 2>&1; then \
		printf "\033[1;31mnix-portable is Linux-only. Install Nix: https://nixos.org/download/\033[0m\n"; \
		exit 1; \
	fi
	@printf "\033[1;32mSystem Nix detected ($(UNAME_S)).\033[0m\n"
endif

nix-portable-env: ## Print `export PATH=...` for this repo's nix-portable (eval it)
	@printf 'export PATH=%s:$$PATH\n' "$(NP_DIR)"

nix-portable-reset: ## Wipe local nix-portable cache (repo + $$HOME/.nix-portable)
	@rm -rf "$(NP_DIR)" "$$HOME/.nix-portable"
	@printf "\033[1;32mcleared $(NP_DIR) and $$HOME/.nix-portable — run make nix-portable\033[0m\n"

# ─── General ───────────────────────────────────────────────
help: ## Show this help (plain `make` deploys)
	@printf "\n\033[1;36mft_trascendence\033[0m  —  \033[32mmake\033[0m\n"
	@printf "\n\033[1;33mOne command\033[0m\n"
	@printf "  \033[32mmake\033[0m     install nix-portable + docker compose up --build\n"
	@printf "           (ports/URLs/images from \033[36minfra/docker/params.env\033[0m) + seed\n"
	@printf "  Then open the App URL, accept the self-signed cert, log in:\n"
	@printf "    \033[1mstudent@demo\033[0m / \033[1mdemo1234\033[0m   (also teacher@demo, admin@demo)\n"
	@printf "\n  Overlay:     make env          Stop: make down    Wipe: make fclean\n"
	@printf "  Logs:        make logs         Status: make status\n"
	@printf "\n\033[1;33mAll targets\033[0m\n"
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk -F'##' '{printf "  \033[32m%-16s\033[0m %s\n", $$1, $$2}'
	@printf "\n"

# ─── Deploy (`make` / `make all` / `make up` / `make quickstart`) ─
all: nix-portable-bin ## Install tools + deploy stack from params.env + seed
	@test -f "$(PARAMS)" || { printf "\033[1;31mmissing $(PARAMS)\033[0m\n"; exit 1; }
	@command -v docker >/dev/null 2>&1 || { printf "\033[1;31mdocker not found\033[0m\n"; exit 1; }
	@printf "\033[1;36m==> deploy from $(PARAMS)\033[0m\n"
	$(COMPOSE) up -d --build
	@printf "\033[1;36m==> waiting for backend /health\033[0m\n"
	@ok=0; i=0; \
	while [ $$i -lt 60 ]; do \
	  if $(COMPOSE) exec -T backend wget -q -O- http://127.0.0.1:3000/health 2>/dev/null | grep -q '"status":"ok"'; then ok=1; break; fi; \
	  i=$$((i+1)); sleep 2; \
	done; \
	if [ $$ok -ne 1 ]; then \
	  printf "\033[1;31mbackend did not become healthy — make logs-backend\033[0m\n"; \
	  $(COMPOSE) ps; \
	  exit 1; \
	fi
	@printf "\033[1;36m==> seeding demo data (student@demo / demo1234)\033[0m\n"
	@$(COMPOSE) exec -T backend npx prisma db seed || \
	  printf "\033[1;33mseed skipped/failed (stack is still up)\033[0m\n"
	@$(MAKE) --no-print-directory urls
	@printf "\033[1;32mLogin\033[0m     student@demo  /  demo1234\n"
	@printf "           teacher@demo  /  demo1234\n"
	@printf "           admin@demo    /  demo1234\n"
	@printf "\033[1;33mChrome:\033[0m  accept the self-signed cert on the App URL.\n"
	@printf "\033[1;36mNext:\033[0m    make logs   |   make status   |   make down   |   make help\n\n"

up: all ## Alias of `all`
quickstart: all ## Alias of `all`

env: ## Crea infra/docker/.env (gitignored) desde params.env si no existe
	@if [ ! -f "$(LOCAL_ENV)" ]; then \
		cp "$(PARAMS)" "$(LOCAL_ENV)"; \
		printf "\033[1;32mCreado $(LOCAL_ENV) — edita solo lo que quieras overridear.\033[0m\n"; \
	else \
		printf "\033[1;33m$(LOCAL_ENV) ya existe, no se toca.\033[0m\n"; \
	fi

# ─── Development (flake via nix-portable) ──────────────────
dev: nix-portable-bin ## Entra en el devShell (Node 22, pnpm, docker, k8s tools)
	$(NIX) develop .#dev

ci: nix-portable-bin ## Ejecuta el pipeline de CI local dentro del flake `ci`
	$(NIX) develop .#ci --command bash scripts/ci.sh

up-direct: ## Stack + overlay de puertos directos (sin pasar solo por Caddy)
	$(COMPOSE_DIRECT) up -d --build
	@$(MAKE) --no-print-directory urls

urls: ## Imprime las URLs públicas desde params.env
	@set -a; . "./$(PARAMS)"; \
	  if [ -f "$(LOCAL_ENV)" ]; then . "./$(LOCAL_ENV)"; fi; \
	  set +a; \
	  printf "\n\033[1;32mStack — URLs vía HTTPS (params.env):\033[0m\n"; \
	  printf "  App:          %s\n" "$$APP_URL"; \
	  printf "  Grafana:      %s\n" "$$GRAFANA_URL"; \
	  printf "  Prometheus:   %s\n" "$$PROMETHEUS_URL"; \
	  printf "  Tempo:        %s\n" "$$TEMPO_URL"; \
	  printf "  Loki:         %s\n" "$$LOKI_URL"; \
	  printf "\n"

clean: ## Para el stack de Docker
	$(COMPOSE) down

down: clean ## Alias de `clean`

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
