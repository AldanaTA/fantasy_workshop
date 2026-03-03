from app.routers._crud import crud_router
from app.schema.models import ContentCategory
from app.schema.schemas import ContentCategoryCreate, ContentCategoryOut

router = crud_router(
    name="content_categories",
    model=ContentCategory,
    create_schema=ContentCategoryCreate,
    out_schema=ContentCategoryOut,
    prefix="/content/categories",
    require_auth=True)