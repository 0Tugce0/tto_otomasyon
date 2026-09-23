"""
routers/settings.py — Hesaplama oranları CRUD iskelet endpoint'leri.

Tüm endpoint'ler Depends(get_current_user) ile korunuyor.
Şartname madde 7.6: TTO payı oranı, stopaj oranı — yıl bazında düzenleme.
CRUD mantığı adım 8 sonrası doldurulacak (şimdiki aşama: iskelet).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User

router = APIRouter()


@router.get("/", summary="Oran ayarları listesi (yıl bazında)")
def list_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tüm yıllara ait oran ayarlarını listeler. TODO: CRUD implementasyonu."""
    return []  # Placeholder


@router.post("/", summary="Yeni yıl oranı ekle", status_code=201)
def create_setting(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Yeni yıl için oran ayarı oluşturur. TODO: CRUD implementasyonu."""
    return {}  # Placeholder


@router.get("/{setting_id}", summary="Oran ayarı detayı")
def get_setting(
    setting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Belirli bir yılın oran ayarını döner. TODO: CRUD implementasyonu."""
    return {}  # Placeholder


@router.put("/{setting_id}", summary="Oran ayarı güncelle")
def update_setting(
    setting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Oran ayarını günceller. TODO: CRUD implementasyonu."""
    return {}  # Placeholder
