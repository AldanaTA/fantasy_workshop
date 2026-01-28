import os
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# -----------------------------
# Environment configuration
# -----------------------------

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Comma-separated list, e.g.:
# https://app.example.com,http://app.example.com
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "")
CORS_ORIGINS: List[str] = [
    origin.strip()
    for origin in CORS_ORIGINS_RAW.split(",")
    if origin.strip()
]

API_TITLE = os.getenv("API_TITLE", "TTRPG API")
API_VERSION = os.getenv("API_VERSION", "0.1.0")


# -----------------------------
# FastAPI app
# -----------------------------

app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    docs_url="/docs" if ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if ENVIRONMENT != "production" else None,
    openapi_url="/openapi.json" if ENVIRONMENT != "production" else None,
)


# -----------------------------
# Middleware
# -----------------------------

if CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# -----------------------------
# Health check (ALB target group)
# -----------------------------

@app.get("/health", tags=["system"])
def health_check():
    """
    ALB / monitoring health check.
    """
    return {
        "status": "ok",
        "environment": ENVIRONMENT,
    }


# -----------------------------
# Root endpoint
# -----------------------------

@app.get("/", tags=["system"])
def root():
    return {
        "name": API_TITLE,
        "version": API_VERSION,
        "environment": ENVIRONMENT,
    }


# -----------------------------
# Example API namespace
# (replace with routers later)
# -----------------------------

@app.get("/api/ping", tags=["debug"])
def ping():
    return {"pong": True}


# -----------------------------
# Startup / shutdown hooks
# -----------------------------

@app.on_event("startup")
async def on_startup():
    # Place DB connection checks, pool creation, etc here
    print(f"[startup] API starting in {ENVIRONMENT} mode")


@app.on_event("shutdown")
async def on_shutdown():
    # Close DB pools, background workers, etc here
    print("[shutdown] API shutting down")
