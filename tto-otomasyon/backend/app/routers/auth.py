"""
routers/auth.py — Kimlik doğrulama endpoint'leri.

POST /api/auth/login   — giriş yap, session cookie set et
POST /api/auth/logout  — çıkış yap, session temizle
GET  /api/auth/me      — mevcut kullanıcı bilgisi (oturum doğrulama için)

Şartname madde 7.1: giriş ekranı.
Onaylanan karar: HttpOnly session cookie (Starlette SessionMiddleware).
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, LoginResponse, UserResponse

router = APIRouter()


@router.post("/login", response_model=LoginResponse, summary="Giriş yap")
def login(credentials: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Kullanıcı adı VEYA e-posta ile giriş yapar (Login sayfası — Stitch modül 1).
    Başarılı girişte HttpOnly session cookie set edilir.
    remember_me=true ise çerez ömrü uzatılır (bkz. core/session.py).
    """
    user = (
        db.query(User)
        .filter(or_(User.username == credentials.identifier, User.email == credentials.identifier))
        .first()
    )

    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı adı/e-posta veya şifre hatalı.",
        )

    # Session cookie'ye user_id yaz (RememberableSessionMiddleware imzalar)
    request.session["user_id"] = user.id
    if credentials.remember_me:
        request.session["_remember"] = True

    return LoginResponse(
        message="Giriş başarılı",
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", summary="Çıkış yap")
def logout(request: Request, _: User = Depends(get_current_user)):
    """Oturumu sonlandırır, session cookie'yi temizler."""
    request.session.clear()
    return {"message": "Çıkış yapıldı"}


@router.get("/me", response_model=UserResponse, summary="Mevcut kullanıcı")
def me(current_user: User = Depends(get_current_user)):
    """Oturum açmış kullanıcının bilgisini döner (401 → giriş yapılmamış)."""
    return UserResponse.model_validate(current_user)
