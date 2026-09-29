"""
routers/firms.py — Firma CRUD.

Şartname madde 7.5. DELETE endpoint yok (şartnamede geçmiyor; RESTRICT FK var).

GET /{firm_id}/detail — Firma Portföy & Sözleşme Kartı (Stitch modül 5).
Akademisyen detay sayfasındaki (routers/academicians.py) desenle aynı:
özet DB seviyesinde SUM()/COUNT() ile, response_model olmadan dict döner
(records.py'deki _enrich() yaklaşımıyla tutarlı).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Academician, Firm, Project, User, WorkRecord
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
    firm = Firm(
        name=body.name.strip(),
        tax_no=body.tax_no,
        tax_office=body.tax_office,
        contact_email=body.contact_email,
        created_at=datetime.now(timezone.utc),
    )
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


@router.get("/{firm_id}/detail", summary="Firma detay sayfası (Firma Portföy & Sözleşme Kartı)")
def get_firm_detail(
    firm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Firma + tüm work_records (akademisyen/proje nested) + özet istatistikler.
    Stitch modül 5. "net" burada da (amount_after_withholding - other_funds)
    anlamına gelir (academicians.py'deki modül 4 kararıyla tutarlı).
    """
    firm = db.query(Firm).filter(Firm.id == firm_id).first()
    if not firm:
        raise HTTPException(status_code=404, detail="Firma bulunamadı.")

    net_expr = WorkRecord.amount_after_withholding - func.coalesce(WorkRecord.other_funds, 0)

    agg = db.query(
        func.count(WorkRecord.id).label("record_count"),
        func.coalesce(func.sum(WorkRecord.invoice_price), 0).label("total_invoice_price"),
        func.coalesce(func.sum(WorkRecord.tto_share_amount), 0).label("total_tto_share_amount"),
        func.coalesce(func.sum(WorkRecord.amount_after_tto_share), 0).label("total_academician_gross"),
        func.count(func.distinct(WorkRecord.academician_id)).label("distinct_academician_count"),
        func.count(func.distinct(WorkRecord.project_id)).label("distinct_project_count"),
        func.coalesce(
            func.sum(case((WorkRecord.payment_status == "Ödenmedi", net_expr), else_=0)), 0
        ).label("open_balance"),
        func.min(WorkRecord.created_at).label("first_record_at"),
    ).filter(WorkRecord.firm_id == firm_id).one()

    distinct_department_count = (
        db.query(func.count(func.distinct(Academician.department)))
        .join(WorkRecord, WorkRecord.academician_id == Academician.id)
        .filter(WorkRecord.firm_id == firm_id, Academician.department.isnot(None))
        .scalar()
    ) or 0

    # Aylık hakediş trendi (created_at bazlı — request_date/paid_date çoğu kayıtta boş
    # olduğundan en güvenilir, her zaman dolu olan tarih alanı budur).
    monthly_rows = (
        db.query(
            func.strftime("%Y-%m", WorkRecord.created_at).label("month"),
            func.coalesce(func.sum(WorkRecord.invoice_price), 0).label("total"),
        )
        .filter(WorkRecord.firm_id == firm_id)
        .group_by("month")
        .order_by("month")
        .all()
    )
    monthly_trend = [{"month": m, "total": str(t)} for m, t in monthly_rows][-6:]

    summary = {
        "record_count": agg.record_count,
        "total_invoice_price": str(agg.total_invoice_price),
        "total_tto_share_amount": str(agg.total_tto_share_amount),
        "total_academician_gross": str(agg.total_academician_gross),
        "distinct_academician_count": agg.distinct_academician_count,
        "distinct_department_count": distinct_department_count,
        "distinct_project_count": agg.distinct_project_count,
        "open_balance": str(agg.open_balance),
        "first_record_at": agg.first_record_at,
        "monthly_trend": monthly_trend,
    }

    records_raw = (
        db.query(WorkRecord)
        .filter(WorkRecord.firm_id == firm_id)
        .order_by(WorkRecord.year.desc(), WorkRecord.sira_no.desc())
        .all()
    )

    work_records = []
    for wr in records_raw:
        acad = db.query(Academician).filter(Academician.id == wr.academician_id).first()
        proj = db.query(Project).filter(Project.id == wr.project_id).first() if wr.project_id else None
        work_records.append({
            "id": wr.id,
            "year": wr.year,
            "sira_no": wr.sira_no,
            "work_done": wr.work_done,
            "academician_id": wr.academician_id,
            "academician": {
                "id": acad.id, "full_name": acad.full_name, "department": acad.department, "faculty": acad.faculty,
            } if acad else None,
            "project": {"id": proj.id, "name": proj.name} if proj else None,
            "invoice_price": str(wr.invoice_price),
            "tto_share_amount": str(wr.tto_share_amount) if wr.tto_share_amount is not None else None,
            "amount_after_withholding": str(wr.amount_after_withholding),
            "other_funds": str(wr.other_funds) if wr.other_funds is not None else "0.00",
            "firm_collection_status": wr.firm_collection_status,
            "payment_status": wr.payment_status,
            "paid_date": wr.paid_date,
        })

    return {
        "id": firm.id,
        "name": firm.name,
        "tax_no": firm.tax_no,
        "tax_office": firm.tax_office,
        "contact_email": firm.contact_email,
        "created_at": firm.created_at,
        "summary": summary,
        "work_records": work_records,
    }
