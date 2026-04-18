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
	cd backend && .venv/bin/pip install fastapi uvicorn httpx nilearn numpy -q
	@echo "→ Installing tribev2 from GitHub (LLaMA 3.2 + V-JEPA2 + Wav2Vec-BERT)..."
	cd backend && .venv/bin/pip install \
		"git+https://github.com/facebookresearch/tribev2.git" -q || \
		echo "⚠  tribev2 install failed — mock scorer will be used until it succeeds"
	@echo "→ Pre-downloading TRIBE v2 weights (requires HF_TOKEN for LLaMA 3.2)..."
	cd backend && .venv/bin/python -c \
		"from tribev2 import TribeModel; TribeModel.from_pretrained('facebook/tribev2', cache_folder='./tribe_sidecar/cache')" || \
		echo "⚠  Weight download failed — set HF_TOKEN in .env and re-run 'make setup-tribe'"

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
