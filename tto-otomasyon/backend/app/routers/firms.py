"""
routers/firms.py — Firma CRUD.

Şartname madde 7.5. DELETE endpoint yok (şartnamede geçmiyor; RESTRICT FK var).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Firm, User
from app.schemas import FirmCreate, FirmResponse, FirmUpdate

router = APIRouter()


@router.get("/", response_model=list[FirmResponse], summary="Firma listesi")
def list_firms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tüm firmaları isme göre sıralı döner."""
    return db.query(Firm).order_by(Firm.name).all()


@router.post(
    "/",
    response_model=FirmResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni firma ekle",
)
def create_firm(
    body: FirmCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Yeni firma oluşturur."""
    from datetime import datetime, timezone
    firm = Firm(name=body.name.strip(), created_at=datetime.now(timezone.utc))
    db.add(firm)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"'{body.name}' adında firma zaten mevcut.",
        )
    db.refresh(firm)
    return firm


@router.get("/{firm_id}", response_model=FirmResponse, summary="Firma bilgisi")
def get_firm(
    firm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    firm = db.query(Firm).filter(Firm.id == firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail="Firma bulunamadı.")
    return firm


@router.put("/{firm_id}", response_model=FirmResponse, summary="Firma güncelle")
def update_firm(
    firm_id: int,
    body: FirmUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Firma adını günceller (kısmi güncelleme)."""
    firm = db.query(Firm).filter(Firm.id == firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail="Firma bulunamadı.")

    for field, value in body.model_dump(exclude_unset=True).items():
        if isinstance(value, str):
            value = value.strip()
        setattr(firm, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu isimde bir firma zaten mevcut.",
        )
    db.refresh(firm)
    return firm
