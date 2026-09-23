"""
routers/projects.py — Proje CRUD iskelet endpoint'leri (2026+).

Tüm endpoint'ler Depends(get_current_user) ile korunuyor.
CRUD mantığı adım 8 sonrası doldurulacak (şimdiki aşama: iskelet).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User

router = APIRouter()


@router.get("/", summary="Proje listesi")
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tüm projeleri listeler. TODO: CRUD implementasyonu."""
    return []  # Placeholder


@router.post("/", summary="Yeni proje ekle", status_code=201)
def create_project(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Yeni proje oluşturur. TODO: CRUD implementasyonu."""
    return {}  # Placeholder


@router.get("/{project_id}", summary="Proje detayı")
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Proje detayını döner. TODO: CRUD implementasyonu."""
    return {}  # Placeholder


@router.put("/{project_id}", summary="Proje güncelle")
def update_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Projeyi günceller. TODO: CRUD implementasyonu."""
    return {}  # Placeholder
