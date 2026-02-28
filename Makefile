.PHONY: setup dev build api ui install-python install-js

# Setup commands
setup: install-js install-python

install-js:
	@echo "Installing JavaScript dependencies..."
	cd ui && npm install

install-python:
	@echo "Installing Python dependencies..."
	uv venv
	uv sync

# Development commands
dev:
	@echo "Starting both UI and API servers..."
	@make -j 2 ui api

ui:
	@echo "Starting UI server..."
	cd ui && npm run dev

api:
	@echo "Starting API server..."
	uv run uvicorn finance.api:app --reload --port 3001

# Build commands
build:
	@echo "Building UI for production..."
	cd ui && npm run build

# Up Bank commands
up-sync:
	@echo "Syncing Up Bank data..."
	uv run python -m finance.up_sync

up-health:
	@echo "Checking Up Bank API connection..."
	@curl -s http://localhost:3001/up/health | python -m json.tool 