.PHONY: setup setup-backend setup-tribe setup-frontend dev dev-backend dev-tribe dev-frontend

## ── Setup ──────────────────────────────────────────────────────────────────

setup: setup-backend setup-tribe setup-frontend
	@echo "✅  VidForge ready. Run 'make dev' to start all services."

setup-backend:
	@echo "→ Installing backend dependencies..."
	cd backend && python -m venv .venv && .venv/bin/pip install -e ".[dev]" -q
	@echo "→ Copying .env..."
	cd backend && cp -n .env.example .env || true

setup-tribe:
	@echo "→ Installing TRIBE v2 sidecar dependencies..."
	cd backend && .venv/bin/pip install fastapi uvicorn httpx tribev2 numpy -q || true
	@echo "→ Pre-downloading TRIBE v2 weights (this may take a few minutes)..."
	cd backend && .venv/bin/python -c "from tribev2 import TribeModel; TribeModel.from_pretrained('facebook/tribev2', cache_folder='./tribe_sidecar/cache')" || echo "⚠  tribev2 not installed — mock scorer will be used"

setup-frontend:
	@echo "→ Installing frontend dependencies..."
	cd frontend && npm install --silent

## ── Development ─────────────────────────────────────────────────────────────

dev:
	@echo "Starting all services..."
	$(MAKE) -j3 dev-backend dev-tribe dev-frontend

dev-backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

dev-tribe:
	cd backend && .venv/bin/uvicorn tribe_sidecar.main:app --reload --port 8001

dev-frontend:
	cd frontend && npm run dev

## ── Helpers ─────────────────────────────────────────────────────────────────

lint:
	cd backend && .venv/bin/ruff check app/ tribe_sidecar/

format:
	cd backend && .venv/bin/ruff format app/ tribe_sidecar/
