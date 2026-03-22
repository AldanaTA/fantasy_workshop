from fastapi import FastAPI
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.auth_identities import router as auth_identities_router
from app.routers.games import router as games_router

from app.routers.content_packs import router as packs_router
from app.routers.content_categories import router as categories_router
from app.routers.content import router as content_router

from app.routers.campaigns import router as campaigns_router
from app.routers.chat_messages import router as chat_http_router


app = FastAPI(title="Generic TTRPG API Layer")

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(auth_identities_router)
app.include_router(games_router)

app.include_router(packs_router)
app.include_router(categories_router)
app.include_router(content_router)

app.include_router(campaigns_router)
app.include_router(chat_http_router)


@app.get("/health")
async def health():
    return {"ok": True}