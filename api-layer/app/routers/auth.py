from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schema.db import get_db, get_redis
from app.schema.models import User, RefreshToken
from app.schema.schemas import AuthUser, LoginIn, TokenPairOut
from app.helpers import (
    new_id,
    create_access_token,
    make_refresh_token,
    hash_refresh_token,
    hash_password,
    verify_password,
    set_refresh_cookie,
    get_refresh_cookie,
    clear_refresh_cookie,
    get_refresh_cookie_name,
)
from app.conf import settings
from app.helpers_rate_limit import rate_limit_or_429


router = APIRouter(prefix="/auth", tags=["auth"])


def utcnow():
    return datetime.now(timezone.utc)

@router.post("/login", response_model=TokenPairOut)
async def login(
    body: LoginIn,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    ip = request.client.host if request.client else "unknown"

    # -------------------------
    # RATE LIMITS
    # -------------------------

    await rate_limit_or_429(
        r,
        f"rl:auth:login:ip:{ip}",
        rate_per_sec=5 / 60,
        burst=10,
    )

    await rate_limit_or_429(
        r,
        f"rl:auth:login:email:{body.email.lower()}",
        rate_per_sec=3 / 60,
        burst=6,
    )

    # -------------------------
    # FIND USER
    # -------------------------

    q = select(User).where(User.email == body.email)
    user = (await db.execute(q)).scalars().first()

    # -------------------------
    # NEW USER REGISTRATION
    # -------------------------

    if not user:
        if not body.display_name_if_new:
            raise HTTPException(
                status_code=400,
                detail="New users must include display_name_if_new",
            )

        if not body.password:
            raise HTTPException(
                status_code=400,
                detail="Password required for new users",
            )

        user = User(
            id=new_id(),
            email=body.email,
            display_name=body.display_name_if_new,
            password_hash=hash_password(body.password),
        )

        db.add(user)

        await db.flush()
        await db.refresh(user)

    # -------------------------
    # EXISTING USER LOGIN
    # -------------------------

    else:
        if not user.password_hash:
            raise HTTPException(
                status_code=400,
                detail="Account does not support password login",
            )

        if not body.password or not verify_password(
            body.password,
            user.password_hash,
        ):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password",
            )

    # -------------------------
    # CREATE ACCESS TOKEN
    # -------------------------

    access_token = create_access_token(
        sub="user",
        user_id=str(user.id),
    )

    # -------------------------
    # CREATE REFRESH TOKEN
    # -------------------------

    refresh_raw = make_refresh_token()
    refresh_hash = hash_refresh_token(refresh_raw)

    refresh_token = RefreshToken(
        id=new_id(),
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=utcnow()
        + timedelta(seconds=settings.REFRESH_TOKEN_TTL_SECONDS),
        user_agent=request.headers.get("user-agent"),
        ip_address=ip if ip != "unknown" else None,
    )

    db.add(refresh_token)

    await db.commit()

    # -------------------------
    # SET HTTP ONLY COOKIE
    # -------------------------

    set_refresh_cookie(response, refresh_raw)

    # Refresh token is intentionally NOT returned here.
    return TokenPairOut(
        user_id=user.id,
        access_token=access_token,
    )


@router.post("/refresh", response_model=TokenPairOut)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    r: Redis = Depends(get_redis),
):
    ip = request.client.host if request.client else "unknown"

    await rate_limit_or_429(
        r,
        f"rl:auth:refresh:ip:{ip}",
        rate_per_sec=10 / 60,
        burst=20,
    )

    # -------------------------
    # READ TOKEN FROM COOKIE
    # -------------------------

    refresh_raw = get_refresh_cookie(request)
    token_hash = hash_refresh_token(refresh_raw)

    q = select(RefreshToken).where(
        RefreshToken.token_hash == token_hash
    )

    rt = (await db.execute(q)).scalars().first()

    if not rt:
        clear_refresh_cookie(response)

        raise HTTPException(
            status_code=401,
            detail="Invalid refresh token",
        )

    now = utcnow()

    if rt.revoked_at is not None or rt.expires_at <= now:
        clear_refresh_cookie(response)

        raise HTTPException(
            status_code=401,
            detail="Refresh token expired or revoked",
        )

    # -------------------------
    # ROTATE REFRESH TOKEN
    # -------------------------

    new_refresh_raw = make_refresh_token()

    new_rt = RefreshToken(
        id=new_id(),
        user_id=rt.user_id,
        token_hash=hash_refresh_token(new_refresh_raw),
        expires_at=now
        + timedelta(seconds=settings.REFRESH_TOKEN_TTL_SECONDS),
        user_agent=request.headers.get("user-agent"),
        ip_address=ip if ip != "unknown" else None,
    )

    db.add(new_rt)

    # Generate the new refresh token ID before
    # assigning it to replaced_by_id.
    await db.flush()

    rt.revoked_at = now
    rt.replaced_by_id = new_rt.id

    await db.commit()

    # -------------------------
    # CREATE NEW ACCESS TOKEN
    # -------------------------

    access_token = create_access_token(
        sub="user",
        user_id=str(rt.user_id),
    )

    # Replace the old refresh cookie.
    set_refresh_cookie(response, new_refresh_raw)

    return TokenPairOut(
        user_id=rt.user_id,
        access_token=access_token,
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_raw = request.cookies.get(get_refresh_cookie_name())

    # No cookie means the client is effectively already logged out.
    if not refresh_raw:
        clear_refresh_cookie(response)
        return {"message": "Logged out successfully"}

    token_hash = hash_refresh_token(refresh_raw)

    q = select(RefreshToken).where(
        RefreshToken.token_hash == token_hash
    )

    rt = (await db.execute(q)).scalars().first()

    if rt and rt.revoked_at is None:
        rt.revoked_at = utcnow()
        await db.commit()

    # Always remove the browser cookie.
    clear_refresh_cookie(response)

    return {"message": "Logged out successfully"}