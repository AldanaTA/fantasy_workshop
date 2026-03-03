from app.routers._crud import crud_router
from app.schema.models import AuthIdentity
from app.schema.schemas import AuthIdentityCreate, AuthIdentityOut

router = crud_router(
    name="auth_identities",
    model=AuthIdentity, 
    create_schema=AuthIdentityCreate, 
    out_schema=AuthIdentityOut, 
    prefix="/auth-identities", 
    require_auth=True)