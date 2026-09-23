"""
routers/records.py — work_records CRUD iskelet endpoint'leri.

Tüm endpoint'ler Depends(get_current_user) ile korunuyor.
Filtreleme (year, firm, academician, payment_status) query param olarak planlandı.
sira_no otomatik atanacak (B-5 kararı) — Create'te bulunmuyor.
CRUD mantığı adım 8 sonrası doldurulacak (şimdiki aşama: iskelet).
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User

router = APIRouter()


@router.get("/", summary="İş kaydı listesi (filtrelenebilir)")
def list_records(
    year: Optional[int] = Query(None, description="Yıl filtresi (2025, 2026 ...)"),
    firm_id: Optional[int] = Query(None, description="Firma filtresi"),
    academician_id: Optional[int] = Query(None, description="Akademisyen filtresi"),
    payment_status: Optional[str] = Query(None, description="Ödeme durumu filtresi"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Şartname madde 7.2: tüm work_records, filtrelenebilir.
    TODO: CRUD implementasyonu — filtreler query parametrelerinden uygulanacak.
    """
    return []  # Placeholder


@router.post("/", summary="Yeni iş kaydı ekle", status_code=201)
def create_record(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Şartname madde 7.3: kayıt ekleme formu.
    sira_no backend tarafından otomatik atanır (B-5 kararı).
    TODO: CRUD implementasyonu.
    """
    return {}  # Placeholder


@router.get("/{record_id}", summary="İş kaydı detayı")
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """İş kaydı detayını döner. TODO: CRUD implementasyonu."""
    return {}  # Placeholder


@router.put("/{record_id}", summary="İş kaydı güncelle")
def update_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Şartname madde 7.3: kayıt düzenleme formu.
    is_manually_adjusted frontend'den alınır.
    TODO: CRUD + hesaplama mantığı (core/calculations.py).
    """
    return {}  # Placeholder
