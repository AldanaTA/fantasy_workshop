import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.auth_identities import router as auth_identities_router
from app.routers.games import router as games_router

from app.routers.content_packs import router as packs_router
from app.routers.content_categories import router as categories_router
from app.routers.content import router as content_router
from app.routers.invites import router as invites_router
from app.routers.campaigns import router as campaigns_router
from app.routers.chat_messages import router as chat_http_router


app = FastAPI(title="Generic TTRPG API Layer")

cors_origins = os.getenv("CORS_ORIGINS", "")
allowed_origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
if not allowed_origins:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(auth_identities_router)
app.include_router(games_router)

app.include_router(packs_router)
app.include_router(categories_router)
app.include_router(content_router)

app.include_router(campaigns_router)
app.include_router(chat_http_router)
app.include_router(invites_router)

@app.get("/health")
async def health():
    return {"ok": True}