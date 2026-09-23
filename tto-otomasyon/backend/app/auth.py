"""
auth.py — Şifre hashing + oturum doğrulama dependency.

Şartname madde 11: şifreler bcrypt hash olarak tutulur.
Onaylanan karar: passlib YOK, bcrypt.hashpw / bcrypt.checkpw doğrudan.
Onaylanan karar: JWT YOK, HttpOnly session cookie (Starlette SessionMiddleware).

get_current_user: tüm korumalı endpoint'lerin Depends() ile kullandığı
dependency — session'da user_id yoksa 401 Unauthorized döner.
"""

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User


# ---------------------------------------------------------------------------
# Şifre hashing — bcrypt.hashpw / bcrypt.checkpw
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Düz metin şifreyi bcrypt ile hash'ler, UTF-8 encode edilmiş string döner."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Düz metin şifreyi hash ile karşılaştırır."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ---------------------------------------------------------------------------
# Session dependency — korumalı endpoint'ler için
# ---------------------------------------------------------------------------

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency: session cookie'den oturum açmış kullanıcıyı döner.

    Kullanım:
        @router.get("/")
        def my_endpoint(current_user: User = Depends(get_current_user)):
            ...

    Session cookie, POST /api/auth/login endpoint'i tarafından set edilir.
    Session geçersizse veya yoksa HTTP 401 fırlatır.
    """
    user_id: int | None = request.session.get("user_id")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum açılmamış. Lütfen giriş yapın.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        # Session'da ID var ama kullanıcı silinmiş olabilir
        request.session.clear()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı bulunamadı. Lütfen tekrar giriş yapın.",
        )

    return user
