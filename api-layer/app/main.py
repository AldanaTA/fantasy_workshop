from __future__ import annotations

from typing import Any, Dict

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Routers (GET + POST)


# WebSocket handler


app = FastAPI(
    title="Generic TTRPG API Layer",
    version="0.1.0",
)

# Optional but common (configure as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTTP routes

