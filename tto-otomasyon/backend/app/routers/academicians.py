"""
routers/academicians.py — Akademisyen CRUD + detay sayfası.

Şartname madde 7.4: GET /{id} → AcademicianDetailResponse
  - nested work_records
  - özet istatistikler: DB seviyesinde sqlalchemy func.sum() ile (Python döngüsü değil)
    Decimal toplamları float'a düşmemesi için coalesce + Numeric tip korunur.

DELETE endpoint yok (şartnamede geçmiyor; RESTRICT FK var).
"""

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, case
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Academician, WorkRecord, User
from app.schemas import (
    AcademicianCreate,
    AcademicianDetailResponse,
    AcademicianResponse,
    AcademicianSummary,
    AcademicianUpdate,
    WorkRecordInAcademicianResponse,
    FirmResponse,
)

router = APIRouter()

_ZERO = Decimal("0.00")


@router.get("/", response_model=list[AcademicianResponse], summary="Akademisyen listesi")
def list_academicians(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tüm akademisyenleri isme göre sıralı döner."""
    return db.query(Academician).order_by(Academician.full_name).all()


@router.post(
    "/",
    response_model=AcademicianResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni akademisyen ekle",
)
def create_academician(
    body: AcademicianCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    acad = Academician(
        full_name=body.full_name.strip(),
        iban=body.iban,
        department=body.department,
        created_at=datetime.now(timezone.utc),
    )
    db.add(acad)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"'{body.full_name}' adında akademisyen zaten mevcut.",
        )
    db.refresh(acad)
    return acad


@router.get(
    "/{academician_id}",
    response_model=AcademicianResponse,
    summary="Akademisyen bilgisi",
)
def get_academician(
    academician_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    acad = db.query(Academician).filter(Academician.id == academician_id).first()
    if not acad:
        raise HTTPException(status_code=404, detail="Akademisyen bulunamadı.")
    return acad


@router.put(
    "/{academician_id}",
    response_model=AcademicianResponse,
    summary="Akademisyen güncelle",
)
def update_academician(
    academician_id: int,
    body: AcademicianUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kısmi güncelleme — sadece gönderilen alanlar değiştirilir."""
    acad = db.query(Academician).filter(Academician.id == academician_id).first()
    if not acad:
        raise HTTPException(status_code=404, detail="Akademisyen bulunamadı.")

    for field, value in body.model_dump(exclude_unset=True).items():
        if isinstance(value, str):
            value = value.strip()
        setattr(acad, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu isimde bir akademisyen zaten mevcut.",
        )
    db.refresh(acad)
    return acad


@router.get(
    "/{academician_id}/detail",
    response_model=AcademicianDetailResponse,
    summary="Akademisyen detay sayfası (şartname 7.4)",
)
def get_academician_detail(
    academician_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Akademisyen + ilgili tüm work_records + özet istatistikler.

    Özet DB seviyesinde tek sorguda func.sum() ile hesaplanır —
    Python döngüsü kullanılmaz, Decimal toplamları float'a düşmez.
    """
    from app.models import Firm, Project

    acad = db.query(Academician).filter(Academician.id == academician_id).first()
    if not acad:
        raise HTTPException(status_code=404, detail="Akademisyen bulunamadı.")

    # ── Özet: DB seviyesinde SUM() ────────────────────────────────────────
    summary_row = db.query(
        func.coalesce(func.sum(WorkRecord.amount_after_withholding), 0).label("total_earned"),
        func.coalesce(
            func.sum(
                case(
                    (WorkRecord.payment_status == "Ödendi", WorkRecord.amount_after_withholding),
                    else_=0,
                )
            ),
            0,
        ).label("total_paid"),
        func.coalesce(
            func.sum(
                case(
                    (WorkRecord.payment_status == "Ödenmedi", WorkRecord.amount_after_withholding),
                    else_=0,
                )
            ),
            0,
        ).label("pending_amount"),
        func.count(
            case(
                (WorkRecord.payment_status == "Ödenmedi", 1),
                else_=None,
            )
        ).label("pending_count"),
    ).filter(WorkRecord.academician_id == academician_id).one()

    summary = AcademicianSummary(
        total_earned=Decimal(str(summary_row.total_earned)),
        total_paid=Decimal(str(summary_row.total_paid)),
        pending_amount=Decimal(str(summary_row.pending_amount)),
        pending_count=summary_row.pending_count,
    )

    # ── Work records: firm + project nested ───────────────────────────────
    records_raw = (
        db.query(WorkRecord)
        .filter(WorkRecord.academician_id == academician_id)
        .order_by(WorkRecord.year.desc(), WorkRecord.sira_no)
        .all()
    )

    work_records = []
    for wr in records_raw:
        firm_obj = db.query(Firm).filter(Firm.id == wr.firm_id).first()
        proj_obj = (
            db.query(Project).filter(Project.id == wr.project_id).first()
            if wr.project_id
            else None
        )
        from app.schemas import ProjectResponse
        wr_schema = WorkRecordInAcademicianResponse(
            id=wr.id,
            year=wr.year,
            sira_no=wr.sira_no,
            firm_id=wr.firm_id,
            firm=FirmResponse.model_validate(firm_obj),
            work_done=wr.work_done,
            project_id=wr.project_id,
            project=ProjectResponse.model_validate(proj_obj) if proj_obj else None,
            invoice_price=wr.invoice_price,
            invoice_vat=wr.invoice_vat,
            withholding_tax=wr.withholding_tax,
            tto_share_amount=wr.tto_share_amount,
            amount_after_tto_share=wr.amount_after_tto_share,
            amount_after_withholding=wr.amount_after_withholding,
            payment_status=wr.payment_status,
            paid_date=wr.paid_date,
            iban_snapshot=wr.iban_snapshot,
            notes=wr.notes,
            is_manually_adjusted=wr.is_manually_adjusted,
            created_at=wr.created_at,
            updated_at=wr.updated_at,
        )
        work_records.append(wr_schema)

    return AcademicianDetailResponse(
        id=acad.id,
        full_name=acad.full_name,
        iban=acad.iban,
        department=acad.department,
        created_at=acad.created_at,
        work_records=work_records,
        summary=summary,
    )
