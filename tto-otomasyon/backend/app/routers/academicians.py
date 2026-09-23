"""
routers/academicians.py — Akademisyen CRUD iskelet endpoint'leri.

Tüm endpoint'ler Depends(get_current_user) ile korunuyor.
/{academician_id}/detail → AcademicianDetailResponse (şartname 7.4)
CRUD mantığı adım 8 sonrası doldurulacak (şimdiki aşama: iskelet).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User

router = APIRouter()


@router.get("/", summary="Akademisyen listesi")
def list_academicians(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tüm akademisyenleri listeler. TODO: CRUD implementasyonu."""
    return []  # Placeholder


@router.post("/", summary="Yeni akademisyen ekle", status_code=201)
def create_academician(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Yeni akademisyen oluşturur. TODO: CRUD implementasyonu."""
    return {}  # Placeholder


@router.get("/{academician_id}", summary="Akademisyen bilgisi")
def get_academician(
    academician_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Akademisyen bilgisini döner. TODO: CRUD implementasyonu."""
    return {}  # Placeholder


@router.put("/{academician_id}", summary="Akademisyen güncelle")
def update_academician(
    academician_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Akademisyeni günceller. TODO: CRUD implementasyonu."""
    return {}  # Placeholder


@router.get(
    "/{academician_id}/detail",
    summary="Akademisyen detay sayfası",
)
def get_academician_detail(
    academician_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Şartname madde 7.4: akademisyen + tüm work_records + özet.
    TODO: AcademicianDetailResponse döndürecek şekilde implement edilecek.
    """
    return {}  # Placeholder
