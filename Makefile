SHELL := /bin/bash
COMPOSE := docker compose -f infra/docker-compose.yml --env-file .env

.PHONY: help bootstrap up down logs ps restart migrate migrate-create seed reset \
        api-shell db-shell redis-shell test lint format clean

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

bootstrap: ## Install all workspace dependencies
	pnpm install

up: ## Bring up the full stack (postgres, pgbouncer, redis, prometheus, grafana, glitchtip, api, web)
	$(COMPOSE) up -d --build

down: ## Stop the stack (preserves volumes)
	$(COMPOSE) down

logs: ## Tail logs from all services
	$(COMPOSE) logs -f --tail=200

ps: ## Show running services
	$(COMPOSE) ps

restart: ## Restart api + web only
	$(COMPOSE) restart api web

migrate: ## Apply pending Prisma migrations
	$(COMPOSE) exec api pnpm prisma migrate deploy

migrate-create: ## Create a new migration (NAME=add_something)
	$(COMPOSE) exec api pnpm prisma migrate dev --name $(NAME)

seed: ## Seed demo tenant + fixtures
	$(COMPOSE) exec api pnpm db:seed

reset: ## DESTRUCTIVE: drop the database and re-migrate + seed
	$(COMPOSE) exec api pnpm prisma migrate reset --force

api-shell: ## Shell into the api container
	$(COMPOSE) exec api sh

db-shell: ## psql into the postgres container
	$(COMPOSE) exec postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB

redis-shell: ## redis-cli into the redis container
	$(COMPOSE) exec redis redis-cli

test: ## Run all workspace tests
	pnpm -r --parallel test

lint: ## Lint all workspaces
	pnpm -r --parallel lint

format: ## Format all source files
	pnpm format

clean: ## Remove node_modules and build outputs
	find . -name node_modules -type d -prune -exec rm -rf {} + ; \
	find . -name dist -type d -prune -exec rm -rf {} + ; \
	find . -name build -type d -prune -exec rm -rf {} +
