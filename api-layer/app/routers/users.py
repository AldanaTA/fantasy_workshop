from app.routers._crud import crud_router
from app.schema.models import User
from app.schema.schemas import UserCreate, UserOut

router = crud_router(
    name="users",
    model=User,
    create_schema=UserCreate,
    out_schema=UserOut,
    prefix="/users",
    require_auth=True
)

