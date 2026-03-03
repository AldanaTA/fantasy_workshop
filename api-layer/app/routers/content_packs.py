from app.routers._crud import crud_router
from app.schema.models import ContentPack
from app.schema.schemas import ContentPackCreate, ContentPackOut

router = crud_router(
    name="content_packs",
    model=ContentPack,
    create_schema=ContentPackCreate,
    out_schema=ContentPackOut,
    prefix="/content/packs",
    require_auth=True)