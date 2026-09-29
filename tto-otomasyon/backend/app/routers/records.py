"""
routers/records.py — work_records CRUD.

GET /                        — filtrelenebilir + sayfalı liste (+ arama)
GET /summary                 — filtrelenmiş kayıtların toplamları (İş Kayıtları modülü özet kartları)
GET /export                  — filtrelenmiş kayıtları .xlsx olarak indirir
POST /preview-calculation    — DB'ye yazmadan hesaplama önizlemesi
POST /                       — yeni kayıt (sira_no otomatik — B-5)
GET  /{id}                   — tek kayıt detayı
PUT  /{id}                   — güncelleme (is_manually_adjusted + hesaplama)
DELETE /{id}                 — kaydı kalıcı olarak siler (hard delete, geri alınamaz)

Şartname 7.2 / 7.3.
"""

from io import BytesIO
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.utils import get_column_letter
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.core.calculations import calculate_all
from app.database import get_db
from app.models import Academician, Firm, Project, Setting, User, WorkRecord
from app.schemas import (
    PreviewCalculationRequest,
    PreviewCalculationResponse,
    WorkRecordCreate,
    WorkRecordUpdate,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Yardımcı: Liste / özet / export için ortak filtre uygulayıcı
# ---------------------------------------------------------------------------
def _apply_filters(
    q,
    year: Optional[int],
    firm_id: Optional[int],
    academician_id: Optional[int],
    payment_status: Optional[str],
    search: Optional[str],
):
    if year is not None:
        q = q.filter(WorkRecord.year == year)
    if firm_id is not None:
        q = q.filter(WorkRecord.firm_id == firm_id)
    if academician_id is not None:
        q = q.filter(WorkRecord.academician_id == academician_id)
    if payment_status is not None:
        q = q.filter(WorkRecord.payment_status == payment_status)
    if search:
        s = f"%{search.strip().lower()}%"
        q = (
            q.join(Firm, WorkRecord.firm_id == Firm.id)
            .join(Academician, WorkRecord.academician_id == Academician.id)
            .filter(
                or_(
                    func.lower(WorkRecord.work_done).like(s),
                    Firm.name.like(f"%{search.strip()}%"),  # firms.name COLLATE NOCASE
                    Academician.full_name.like(f"%{search.strip()}%"),  # COLLATE NOCASE
                )
            )
        )
    return q


# ---------------------------------------------------------------------------
# Yardımcı: WorkRecord → response dict (nested)
# ---------------------------------------------------------------------------
def _enrich(wr: WorkRecord, db: Session) -> dict:
    firm = db.query(Firm).filter(Firm.id == wr.firm_id).first()
    acad = db.query(Academician).filter(Academician.id == wr.academician_id).first()
    proj = db.query(Project).filter(Project.id == wr.project_id).first() if wr.project_id else None
    return {
        "id": wr.id,
        "year": wr.year,
        "sira_no": wr.sira_no,
        "firm_id": wr.firm_id,
        "firm": {"id": firm.id, "name": firm.name, "created_at": firm.created_at} if firm else None,
        "academician_id": wr.academician_id,
        "academician": {
            "id": acad.id,
            "full_name": acad.full_name,
            "iban": acad.iban,
            "department": acad.department,
            "faculty": acad.faculty,
            "created_at": acad.created_at,
        } if acad else None,
        "project_id": wr.project_id,
        "project": {"id": proj.id, "name": proj.name, "created_at": proj.created_at} if proj else None,
        "work_done": wr.work_done,
        "invoice_price": str(wr.invoice_price),
        "invoice_vat": str(wr.invoice_vat),
        "withholding_tax": str(wr.withholding_tax),
        "tto_share_amount": str(wr.tto_share_amount) if wr.tto_share_amount is not None else None,
        "amount_after_tto_share": str(wr.amount_after_tto_share),
        "amount_after_withholding": str(wr.amount_after_withholding),
        "other_funds": str(wr.other_funds) if wr.other_funds is not None else "0.00",
        "final_net_payable": str(wr.amount_after_withholding - (wr.other_funds or 0)),
        "request_date": wr.request_date,
        "firm_collection_status": wr.firm_collection_status,
        "payment_status": wr.payment_status,
        "paid_date": wr.paid_date,
        "iban_snapshot": wr.iban_snapshot,
        "notes": wr.notes,
        "is_manually_adjusted": wr.is_manually_adjusted,
        "created_at": wr.created_at,
        "updated_at": wr.updated_at,
    }


# ---------------------------------------------------------------------------
# GET / — Sayfalı + filtrelenebilir liste
# ---------------------------------------------------------------------------
@router.get("/", summary="İş kaydı listesi (filtrelenebilir, sayfalı, aranabilir)")
def list_records(
    year: Optional[int] = Query(None, description="Yıl filtresi"),
    firm_id: Optional[int] = Query(None, description="Firma ID filtresi"),
    academician_id: Optional[int] = Query(None, description="Akademisyen ID filtresi"),
    payment_status: Optional[str] = Query(None, description="Ödendi / Ödenmedi"),
    search: Optional[str] = Query(None, description="Yapılan iş, firma adı veya akademisyen adında arar"),
    order: str = Query("desc", pattern="^(asc|desc)$", description="Tarihe göre sıralama yönü"),
    page: int = Query(1, ge=1, description="Sayfa numarası (1'den başlar)"),
    page_size: int = Query(25, ge=1, le=200, description="Sayfa başı kayıt (max 200)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sayfa bazlı kayıt listesi.
    Dönen body: { total, page, page_size, pages, items: [...] }
    """
    q = _apply_filters(db.query(WorkRecord), year, firm_id, academician_id, payment_status, search)

    total = q.count()
    pages = max(1, (total + page_size - 1) // page_size)

    year_order = WorkRecord.year.asc() if order == "asc" else WorkRecord.year.desc()
    sira_order = WorkRecord.sira_no.asc() if order == "asc" else WorkRecord.sira_no.desc()
    records = (
        q.order_by(year_order, sira_order)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
        "items": [_enrich(r, db) for r in records],
    }


# ---------------------------------------------------------------------------
# GET /summary — Filtrelenmiş kayıtların toplamları (İş Kayıtları modülü özet kartları)
# ÖNEMLİ: /{record_id}'den ÖNCE tanımlı olmalı, yoksa "summary" bir record_id
# olarak yorumlanır (FastAPI route'ları sırayla eşleştirir).
# ---------------------------------------------------------------------------
@router.get("/summary", summary="Filtrelenmiş kayıtların toplam tutarları")
def get_summary(
    year: Optional[int] = Query(None),
    firm_id: Optional[int] = Query(None),
    academician_id: Optional[int] = Query(None),
    payment_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aynı filtrelerle (list_records ile birebir) eşleşen kayıtların toplamlarını
    döner. Sayfalamadan bağımsız — filtreye uyan TÜM kayıtları toplar.

    Dönen alanlar:
      count                    — kayıt sayısı
      total_invoice_price      — toplam fatura tutarı (KDV hariç)
      total_invoice_with_vat   — toplam KDV dahil fatura
      total_tto_share_amount   — toplam TTO payı
      total_stopaj              — toplam stopaj kesintisi (amount_after_tto_share - amount_after_withholding)
      total_withholding_tax     — toplam tevkifat (KDV × invoice_withholding_rate)
    """
    q = _apply_filters(db.query(WorkRecord), year, firm_id, academician_id, payment_status, search)

    row = q.with_entities(
        func.count(WorkRecord.id),
        func.coalesce(func.sum(WorkRecord.invoice_price), 0),
        func.coalesce(func.sum(WorkRecord.invoice_price + WorkRecord.invoice_vat), 0),
        func.coalesce(func.sum(WorkRecord.tto_share_amount), 0),
        func.coalesce(func.sum(WorkRecord.amount_after_tto_share - WorkRecord.amount_after_withholding), 0),
        func.coalesce(func.sum(WorkRecord.withholding_tax), 0),
    ).one()

    count, total_invoice_price, total_invoice_with_vat, total_tto_share_amount, total_stopaj, total_withholding_tax = row

    return {
        "count": count,
        "total_invoice_price": str(total_invoice_price),
        "total_invoice_with_vat": str(total_invoice_with_vat),
        "total_tto_share_amount": str(total_tto_share_amount),
        "total_stopaj": str(total_stopaj),
        "total_withholding_tax": str(total_withholding_tax),
    }


# ---------------------------------------------------------------------------
# GET /export — Filtrelenmiş kayıtları .xlsx olarak indirir
# ÖNEMLİ: /{record_id}'den ÖNCE tanımlı olmalı (bkz. yukarıdaki not).
# ---------------------------------------------------------------------------
@router.get("/export", summary="Filtrelenmiş kayıtları Excel (.xlsx) olarak indir")
def export_records(
    year: Optional[int] = Query(None),
    firm_id: Optional[int] = Query(None),
    academician_id: Optional[int] = Query(None),
    payment_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = _apply_filters(db.query(WorkRecord), year, firm_id, academician_id, payment_status, search)
    records = q.order_by(WorkRecord.year.desc(), WorkRecord.sira_no).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "İş Kayıtları"

    headers = [
        "Yıl", "Sıra No", "Firma", "Akademisyen", "Proje", "Yapılan İş",
        "Fatura Tutarı", "KDV", "KDV Dahil Fatura", "Tevkifat",
        "TTO Payı", "TTO Payı Sonrası", "Stopaj Sonrası (Akademisyene Net)",
        "Diğer Fon & Harçlar", "Nihai Net Ödeme",
        "Firma Tahsilat Durumu", "Ödeme Durumu", "Talep Tarihi", "Ödeme Tarihi", "Notlar",
    ]
    ws.append(headers)

    for wr in records:
        firm = db.query(Firm).filter(Firm.id == wr.firm_id).first()
        acad = db.query(Academician).filter(Academician.id == wr.academician_id).first()
        proj = db.query(Project).filter(Project.id == wr.project_id).first() if wr.project_id else None
        other_funds = wr.other_funds or 0
        ws.append([
            wr.year, wr.sira_no,
            firm.name if firm else "",
            acad.full_name if acad else "",
            proj.name if proj else "",
            wr.work_done,
            float(wr.invoice_price), float(wr.invoice_vat),
            float(wr.invoice_price + wr.invoice_vat), float(wr.withholding_tax),
            float(wr.tto_share_amount) if wr.tto_share_amount is not None else None,
            float(wr.amount_after_tto_share), float(wr.amount_after_withholding),
            float(other_funds), float(wr.amount_after_withholding - other_funds),
            wr.firm_collection_status or "",
            wr.payment_status,
            wr.request_date.isoformat() if wr.request_date else "",
            wr.paid_date.isoformat() if wr.paid_date else "",
            wr.notes or "",
        ])

    for col_idx in range(1, len(headers) + 1):
        ws.column_dimensions[get_column_letter(col_idx)].width = 18

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = "is_kayitlari"
    if year:
        filename += f"_{year}"
    filename += ".xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# POST /preview-calculation — DB'ye yazmadan hesaplama önizlemesi
# ---------------------------------------------------------------------------
@router.post(
    "/preview-calculation",
    response_model=PreviewCalculationResponse,
    summary="Hesaplama önizlemesi (DB'ye yazılmaz)",
)
def preview_calculation(
    body: PreviewCalculationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verilen yıl için settings tablosundan oranları okur ve
    invoice_price üzerinden tüm zinciri hesaplar. DB'ye yazmaz.

    Frontend RecordForm.jsx'te invoice_price onBlur'ında çağrılır.
    """
    setting = db.query(Setting).filter(Setting.valid_year == body.year).first()
    if not setting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{body.year} yılı için oran ayarı bulunamadı. Önce /api/settings/'e oran ekleyin.",
        )

    calc = calculate_all(
        body.invoice_price,
        tto_share_rate=setting.tto_share_rate,
        withholding_rate=setting.withholding_rate,
        vat_rate=setting.vat_rate,
        invoice_withholding_rate=setting.invoice_withholding_rate,
        other_funds=body.other_funds,
    )

    return PreviewCalculationResponse(
        year=body.year,
        invoice_price=body.invoice_price,
        invoice_vat=calc["invoice_vat"],
        withholding_tax=calc["withholding_tax"],
        tto_share_amount=calc["tto_share_amount"],
        amount_after_tto_share=calc["amount_after_tto_share"],
        amount_after_withholding=calc["amount_after_withholding"],
        other_funds=calc["other_funds"],
        final_net_payable=calc["final_net_payable"],
        rates_used={
            "tto_share_rate": str(setting.tto_share_rate),
            "withholding_rate": str(setting.withholding_rate),
            "vat_rate": str(setting.vat_rate),
            "invoice_withholding_rate": str(setting.invoice_withholding_rate),
        },
    )


# ---------------------------------------------------------------------------
# POST / — Yeni kayıt
# ---------------------------------------------------------------------------
@router.post("/", summary="Yeni iş kaydı ekle", status_code=status.HTTP_201_CREATED)
def create_record(
    body: WorkRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Yeni kayıt oluşturur.
    sira_no: o yılın max(sira_no)+1 (B-5 kararı).
    is_manually_adjusted=False ise frontend preview hesaplamayı zaten getirmiş olmalı.
    """
    if not db.query(Firm).filter(Firm.id == body.firm_id).first():
        raise HTTPException(status_code=404, detail="Firma bulunamadı.")
    if not db.query(Academician).filter(Academician.id == body.academician_id).first():
        raise HTTPException(status_code=404, detail="Akademisyen bulunamadı.")
    if body.project_id and not db.query(Project).filter(Project.id == body.project_id).first():
        raise HTTPException(status_code=404, detail="Proje bulunamadı.")

    max_sira = db.query(func.max(WorkRecord.sira_no)).filter(WorkRecord.year == body.year).scalar() or 0

    wr = WorkRecord(
        year=body.year,
        sira_no=max_sira + 1,
        firm_id=body.firm_id,
        work_done=body.work_done,
        academician_id=body.academician_id,
        project_id=body.project_id,
        invoice_price=body.invoice_price,
        invoice_vat=body.invoice_vat,
        withholding_tax=body.withholding_tax,
        tto_share_amount=body.tto_share_amount,
        amount_after_tto_share=body.amount_after_tto_share,
        amount_after_withholding=body.amount_after_withholding,
        other_funds=body.other_funds,
        request_date=body.request_date,
        firm_collection_status=body.firm_collection_status,
        payment_status=body.payment_status,
        paid_date=body.paid_date,
        iban_snapshot=body.iban_snapshot,
        notes=body.notes,
        is_manually_adjusted=body.is_manually_adjusted,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(wr)
    db.commit()
    db.refresh(wr)
    return _enrich(wr, db)


# ---------------------------------------------------------------------------
# GET /{id}
# ---------------------------------------------------------------------------
@router.get("/{record_id}", summary="İş kaydı detayı")
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wr = db.query(WorkRecord).filter(WorkRecord.id == record_id).first()
    if not wr:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
    return _enrich(wr, db)


# ---------------------------------------------------------------------------
# PUT /{id} — Güncelleme
# ---------------------------------------------------------------------------
@router.put("/{record_id}", summary="İş kaydı güncelle")
def update_record(
    record_id: int,
    body: WorkRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kısmi güncelleme.
    - is_manually_adjusted=False: frontend preview ile hesaplanan alanları gönderir.
    - is_manually_adjusted=True: gönderilen değerler olduğu gibi kaydedilir (hesaplama atlanır).
    """
    wr = db.query(WorkRecord).filter(WorkRecord.id == record_id).first()
    if not wr:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(wr, field, value)

    wr.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(wr)
    return _enrich(wr, db)


# ---------------------------------------------------------------------------
# DELETE /{id} — Kalıcı silme (hard delete, geri alınamaz)
# ---------------------------------------------------------------------------
@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT, summary="İş kaydını kalıcı olarak sil")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wr = db.query(WorkRecord).filter(WorkRecord.id == record_id).first()
    if not wr:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")

    db.delete(wr)
    db.commit()

