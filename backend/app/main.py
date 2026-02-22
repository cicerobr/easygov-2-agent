"""
EasyGov Backend — FastAPI application entry point.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.agent.scheduler import start_scheduler, stop_scheduler
from app.pncp_client import pncp_client

settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🚀 EasyGov Backend starting...")

    # Start scheduler
    if settings.scheduler_enabled:
        start_scheduler()
        logger.info("⏰ Scheduler started")

    yield

    # Shutdown
    logger.info("🛑 EasyGov Backend shutting down...")
    stop_scheduler()
    await pncp_client.close()


app = FastAPI(
    title="EasyGov API",
    description="API para automação de busca de editais no PNCP",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
from app.routes.automations import router as automations_router
from app.routes.results import router as results_router
from app.routes.notifications import router as notifications_router
from app.routes.analysis import router as analysis_router

app.include_router(automations_router, prefix="/api")
app.include_router(results_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(analysis_router, prefix="/api")


@app.get("/")
async def root():
    return {
        "app": "EasyGov",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
