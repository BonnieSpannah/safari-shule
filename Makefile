SHELL := /bin/bash
COMPOSE := docker compose -f infra/docker-compose.yml --env-file .env

.PHONY: help bootstrap up down logs ps restart migrate migrate-create seed reset \
        api-shell db-shell redis-shell test lint format clean \
        backup backup-list backup-verify restore-isolated db-masked-dump \
        access-grant access-revoke dnc-check retention-run

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

# ---------------------------------------------------------------------------
# Governance & operations (M2/M3 wire the actual scripts; stubs today print
# the exact command a human would run so the runbook is discoverable).
# ---------------------------------------------------------------------------

backup: ## Trigger a full logical Postgres backup on demand (writes to backup_jobs)
	@echo "→ Enqueue full logical backup job"
	$(COMPOSE) exec api pnpm exec ts-node --transpile-only ops/backup/enqueue.ts full || \
	echo "  (script pending — M13; use: pg_dump -Fc \"$$DATABASE_URL\" | gzip > backups/pg-$$(date +%Y%m%dT%H%M%S).dump.gz)"

backup-list: ## Show recent backup_jobs
	$(COMPOSE) exec postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB -c \
		"SELECT id, kind, target, status, size_bytes, retention_days, finished_at FROM backup_jobs ORDER BY created_at DESC LIMIT 20;"

backup-verify: ## Verify checksum + test-restore an existing backup (ID=<uuid>)
	@if [ -z "$(ID)" ]; then echo "Usage: make backup-verify ID=<uuid>"; exit 1; fi
	$(COMPOSE) exec api pnpm exec ts-node --transpile-only ops/backup/verify.ts $(ID)

restore-isolated: ## Restore a backup into an isolated sidecar Postgres (ID=<uuid>)
	@if [ -z "$(ID)" ]; then echo "Usage: make restore-isolated ID=<uuid>"; exit 1; fi
	./ops/backup/restore-isolated.sh --id $(ID)

db-masked-dump: ## Produce a masked dump of the current DB (safe to load into staging)
	./ops/masking/dump.sh --out backups/masked-$$(date +%Y%m%dT%H%M%S).sql.gz

access-grant: ## Provision time-boxed prod read access (USER=<name> DURATION=2h)
	@if [ -z "$(USER)" ] || [ -z "$(DURATION)" ]; then echo "Usage: make access-grant USER=<name> DURATION=2h"; exit 1; fi
	./ops/access/grant.sh --user "$(USER)" --duration "$(DURATION)" --scope readonly

access-revoke: ## Revoke a previously-granted access role (USER=<name>)
	@if [ -z "$(USER)" ]; then echo "Usage: make access-revoke USER=<name>"; exit 1; fi
	./ops/access/revoke.sh --user "$(USER)"

dnc-check: ## Check whether a destination is on the Do-Not-Contact list (TENANT=<slug> CHANNEL=sms DEST=+2547...)
	@if [ -z "$(TENANT)" ] || [ -z "$(CHANNEL)" ] || [ -z "$(DEST)" ]; then echo "Usage: make dnc-check TENANT=hillcrest CHANNEL=sms DEST=+254712000000"; exit 1; fi
	$(COMPOSE) exec postgres psql -U $$POSTGRES_USER -d $$POSTGRES_DB -c \
		"SELECT channel, reason, effective_from, effective_to FROM do_not_contact WHERE tenant_id = (SELECT id FROM tenants WHERE slug = '$(TENANT)') AND channel = '$(CHANNEL)'::\"DncChannel\" AND destination = '$(DEST)';"

retention-run: ## Run retention policies for a specific tenant (TENANT=<slug>)
	@if [ -z "$(TENANT)" ]; then echo "Usage: make retention-run TENANT=hillcrest"; exit 1; fi
	$(COMPOSE) exec api pnpm exec ts-node --transpile-only ops/governance/retention-run.ts --tenant $(TENANT)
