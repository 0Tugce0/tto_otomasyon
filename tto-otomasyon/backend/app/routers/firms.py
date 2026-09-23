"""
routers/firms.py — Firma CRUD iskelet endpoint'leri.

Tüm endpoint'ler Depends(get_current_user) ile korunuyor.
CRUD mantığı adım 8 sonrası doldurulacak (şimdiki aşama: iskelet).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User

router = APIRouter()


@router.get("/", summary="Firma listesi")
def list_firms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tüm firmaları listeler. TODO: CRUD implementasyonu."""
    return []  # Placeholder


@router.post("/", summary="Yeni firma ekle", status_code=201)
def create_firm(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Yeni firma oluşturur. TODO: CRUD implementasyonu."""
    return {}  # Placeholder


@router.get("/{firm_id}", summary="Firma detayı")
def get_firm(
    firm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Firma detayını döner. TODO: CRUD implementasyonu."""
    return {}  # Placeholder


@router.put("/{firm_id}", summary="Firma güncelle")
def update_firm(
    firm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Firmayı günceller. TODO: CRUD implementasyonu."""
    return {}  # Placeholder
