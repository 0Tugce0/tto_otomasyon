"""
routers/settings.py — Hesaplama oranları CRUD (yıl bazında).

Şartname madde 7.6: TTO payı, stopaj, KDV, tevkifat oranları.

B-2 kararı: valid_year UNIQUE — aynı yıl için ikinci kayıt → 409 Conflict.
DELETE endpoint yok (şartnamede geçmiyor).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Setting, User
from app.schemas import SettingCreate, SettingResponse, SettingUpdate

router = APIRouter()


@router.get("/", response_model=list[SettingResponse], summary="Tüm yıl oranları")
def list_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tüm yıllara ait oran ayarlarını valid_year'a göre sıralı döner."""
    return db.query(Setting).order_by(Setting.valid_year).all()


@router.post(
    "/",
    response_model=SettingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni yıl oranı ekle",
)
def create_setting(
    body: SettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Yeni yıl için oran ayarı oluşturur.
    Aynı yıl için kayıt varsa 409 Conflict döner (B-2: valid_year UNIQUE).
    """
    setting = Setting(**body.model_dump())
    db.add(setting)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{body.valid_year} yılı için oran zaten mevcut. Güncellemek için PUT kullanın.",
        )
    db.refresh(setting)
    return setting


@router.get("/{setting_id}", response_model=SettingResponse, summary="Yıl oranı detayı")
def get_setting(
    setting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    setting = db.query(Setting).filter(Setting.id == setting_id).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Oran ayarı bulunamadı.")
    return setting


@router.put("/{setting_id}", response_model=SettingResponse, summary="Yıl oranı güncelle")
def update_setting(
    setting_id: int,
    body: SettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mevcut yılın oranlarını kısmi olarak günceller (tüm alanlar Optional)."""
    setting = db.query(Setting).filter(Setting.id == setting_id).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Oran ayarı bulunamadı.")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(setting, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu yıl için zaten bir oran kaydı mevcut.",
        )
    db.refresh(setting)
    return setting
