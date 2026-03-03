from app.routers._crud import crud_router
from app.schema.models import Game
from app.schema.schemas import GameCreate, GameOut

router = crud_router(
    name="games",
    model=Game,
    create_schema=GameCreate,
    out_schema=GameOut, 
    prefix="/games",
    require_auth=True)