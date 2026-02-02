# GitDiscover Makefile
# Location: /Volumes/SSD/skills/server-ops/vps/107.174.42.198/heavy-tasks/gitdiscover.org/Makefile

.PHONY: help dev build test deploy logs backup migrate lint format clean

# Default target
.DEFAULT_GOAL := help

# Configuration
DOCKER_DIR := docker
SCRIPTS_DIR := scripts
BACKUP_DIR := backups
LOGS_DIR := logs

# Colors for output
BLUE := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
NC := \033[0m # No Color

# =============================================================================
# Help
# =============================================================================

help: ## Show this help message
	@echo "$(BLUE)GitDiscover Makefile$(NC)"
	@echo ""
	@echo "$(GREEN)Development:$(NC)"
	@echo "  make dev         Start development environment"
	@echo "  make build       Build all packages"
	@echo "  make test        Run all tests"
	@echo "  make lint        Run linter"
	@echo "  make format      Format code with Prettier"
	@echo ""
	@echo "$(GREEN)Production:$(NC)"
	@echo "  make deploy      Deploy to production"
	@echo "  make deploy-nc   Deploy without cache (rebuild all)"
	@echo "  make rollback    Rollback to previous version"
	@echo "  make migrate     Run database migrations"
	@echo "  make backup      Backup database"
	@echo ""
	@echo "$(GREEN)Operations:$(NC)"
	@echo "  make logs        Show production logs"
	@echo "  make status      Show deployment status"
	@echo "  make clean       Clean build artifacts and logs"
	@echo "  make prune       Clean Docker system"

# =============================================================================
# Development
# =============================================================================

dev: ## Start development environment
	@echo "$(BLUE)Starting development environment...$(NC)"
	npm run dev

dev-api: ## Start API server only
	@echo "$(BLUE)Starting API server...$(NC)"
	npm run dev:api

dev-web: ## Start web server only
	@echo "$(BLUE)Starting web server...$(NC)"
	npm run dev:web

dev-collector: ## Start collector service only
	@echo "$(BLUE)Starting collector service...$(NC)"
	npm run dev:collector

build: ## Build all packages
	@echo "$(BLUE)Building all packages...$(NC)"
	npm run build

build-api: ## Build API package only
	@echo "$(BLUE)Building API package...$(NC)"
	npm run build -w @gitdiscover/api

build-web: ## Build web package only
	@echo "$(BLUE)Building web package...$(NC)"
	npm run build -w @gitdiscover/web

build-collector: ## Build collector service only
	@echo "$(BLUE)Building collector service...$(NC)"
	npm run build -w @gitdiscover/collector

test: ## Run all tests
	@echo "$(BLUE)Running tests...$(NC)"
	npm run test

test-watch: ## Run tests in watch mode
	@echo "$(BLUE)Running tests in watch mode...$(NC)"
	npm run test:watch

lint: ## Run linter
	@echo "$(BLUE)Running linter...$(NC)"
	npm run lint

format: ## Format code with Prettier
	@echo "$(BLUE)Formatting code...$(NC)"
	npm run format

format-check: ## Check code formatting
	@echo "$(BLUE)Checking code formatting...$(NC)"
	npm run format:check

# =============================================================================
# Database
# =============================================================================

migrate: ## Run database migrations
	@echo "$(BLUE)Running database migrations...$(NC)"
	npm run prisma:migrate:deploy

migrate-dev: ## Run database migrations in development mode
	@echo "$(BLUE)Running database migrations (dev mode)...$(NC)"
	npm run prisma:migrate:dev

generate: ## Generate Prisma client
	@echo "$(BLUE)Generating Prisma client...$(NC)"
	npm run prisma:generate

studio: ## Open Prisma Studio
	@echo "$(BLUE)Opening Prisma Studio...$(NC)"
	npm run prisma:studio

seed: ## Seed database
	@echo "$(BLUE)Seeding database...$(NC)"
	npm run db:seed

# =============================================================================
# Production Deployment
# =============================================================================

deploy: ## Deploy to production
	@echo "$(GREEN)Deploying to production...$(NC)"
	chmod +x $(SCRIPTS_DIR)/deploy.sh
	$(SCRIPTS_DIR)/deploy.sh deploy

deploy-nc: ## Deploy without cache (rebuild all images)
	@echo "$(GREEN)Deploying to production (no cache)...$(NC)"
	chmod +x $(SCRIPTS_DIR)/deploy.sh
	$(SCRIPTS_DIR)/deploy.sh deploy --no-cache

rollback: ## Rollback to previous version
	@echo "$(YELLOW)Rolling back deployment...$(NC)"
	chmod +x $(SCRIPTS_DIR)/deploy.sh
	$(SCRIPTS_DIR)/deploy.sh rollback

status: ## Show deployment status
	@echo "$(BLUE)Checking deployment status...$(NC)"
	$(SCRIPTS_DIR)/deploy.sh status

# =============================================================================
# Docker Operations
# =============================================================================

docker-build: ## Build Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	cd $(DOCKER_DIR) && docker compose -f docker-compose.prod.yml build

docker-up: ## Start Docker services
	@echo "$(BLUE)Starting Docker services...$(NC)"
	cd $(DOCKER_DIR) && docker compose -f docker-compose.prod.yml up -d

docker-down: ## Stop Docker services
	@echo "$(BLUE)Stopping Docker services...$(NC)"
	cd $(DOCKER_DIR) && docker compose -f docker-compose.prod.yml down

docker-logs: ## Show Docker logs
	@echo "$(BLUE)Showing Docker logs...$(NC)"
	cd $(DOCKER_DIR) && docker compose -f docker-compose.prod.yml logs -f

# =============================================================================
# Logging & Monitoring
# =============================================================================

logs: ## Show production logs
	@echo "$(BLUE)Fetching production logs...$(NC)"
	cd $(DOCKER_DIR) && docker compose -f docker-compose.prod.yml logs -f --tail=100

logs-api: ## Show API logs only
	@echo "$(BLUE)Fetching API logs...$(NC)"
	cd $(DOCKER_DIR) && docker compose -f docker-compose.prod.yml logs -f api

logs-web: ## Show web logs only
	@echo "$(BLUE)Fetching web logs...$(NC)"
	cd $(DOCKER_DIR) && docker compose -f docker-compose.prod.yml logs -f web

logs-collector: ## Show collector logs only
	@echo "$(BLUE)Fetching collector logs...$(NC)"
	cd $(DOCKER_DIR) && docker compose -f docker-compose.prod.yml logs -f collector

# =============================================================================
# Backup & Maintenance
# =============================================================================

backup: ## Backup database
	@echo "$(GREEN)Creating database backup...$(NC)"
	@mkdir -p $(BACKUP_DIR)
	@bash -c ' \
		source .env; \
		DB_URL=$${DATABASE_URL%%\?*}; \
		CONN=$${DB_URL#postgresql://}; \
		USER=$${CONN%%:*}; \
		REST=$${CONN#*:}; \
		PASS=$${REST%%@*}; \
		HOST_PORT=$${REST#*@}; \
		HOST=$${HOST_PORT%%:*}; \
		PORT_DB=$${HOST_PORT#*:}; \
		PORT=$${PORT_DB%%/*}; \
		DB=$${PORT_DB#*/}; \
		echo "Backing up database: $$DB from $$HOST"; \
		PGPASSWORD=$$PASS pg_dump -h $$HOST -p $$PORT -U $$USER -d $$DB \
			-f $(BACKUP_DIR)/backup-$$(date +%Y%m%d-%H%M%S).sql \
			--clean --if-exists; \
		echo "$(GREEN)Backup completed$(NC)"; \
	'

db-shell: ## Open PostgreSQL shell
	@echo "$(BLUE)Opening database shell...$(NC)"
	@bash -c ' \
		source .env; \
		DB_URL=$${DATABASE_URL%%\?*}; \
		CONN=$${DB_URL#postgresql://}; \
		USER=$${CONN%%:*}; \
		REST=$${CONN#*:}; \
		PASS=$${REST%%@*}; \
		HOST_PORT=$${REST#*@}; \
		HOST=$${HOST_PORT%%:*}; \
		PORT_DB=$${HOST_PORT#*:}; \
		PORT=$${PORT_DB%%/*}; \
		DB=$${PORT_DB#*/}; \
		PGPASSWORD=$$PASS psql -h $$HOST -p $$PORT -U $$USER -d $$DB; \
	'

# =============================================================================
# Cleanup
# =============================================================================

clean: ## Clean build artifacts and logs
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf node_modules/.cache
	rm -rf apps/api/dist
	rm -rf apps/web/.next
	rm -rf services/collector/dist
	rm -rf packages/*/dist
	find . -name "*.log" -type f -delete 2>/dev/null || true
	@echo "$(GREEN)Cleanup completed$(NC)"

prune: ## Clean Docker system (USE WITH CAUTION)
	@echo "$(RED)Cleaning Docker system...$(NC)"
	@echo "$(YELLOW)This will remove unused Docker resources$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker system prune -f; \
		echo "$(GREEN)Docker system cleaned$(NC)"; \
	else \
		echo "$(BLUE)Aborted$(NC)"; \
	fi

# =============================================================================
# Utilities
# =============================================================================

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	npm ci

update: ## Update dependencies
	@echo "$(BLUE)Updating dependencies...$(NC)"
	npm update

shell-api: ## Open shell in API container
	@echo "$(BLUE)Opening shell in API container...$(NC)"
	docker exec -it gitdiscover-api /bin/sh

shell-web: ## Open shell in web container
	@echo "$(BLUE)Opening shell in web container...$(NC)"
	docker exec -it gitdiscover-web /bin/sh

shell-collector: ## Open shell in collector container
	@echo "$(BLUE)Opening shell in collector container...$(NC)"
	docker exec -it gitdiscover-collector /bin/sh

health: ## Check service health
	@echo "$(BLUE)Checking service health...$(NC)"
	@echo "API: $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health 2>/dev/null || echo 'unreachable')"
	@echo "Web: $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/api/health 2>/dev/null || echo 'unreachable')"
	@echo "Collector: $$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3003/health 2>/dev/null || echo 'unreachable')"
