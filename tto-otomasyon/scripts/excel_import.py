#!/usr/bin/env python3
"""
scripts/excel_import.py — TTO Excel Veri Aktarım Scripti
=========================================================

Gerçek Excel dosyasını okuyarak firms, academicians, projects ve
work_records tablolarını ilk kez doldurur.

KULLANIM (proje kökünden, venv aktif):
    cd /Users/tugce/Desktop/TTO/tto-otomasyon
    backend/venv/bin/python scripts/excel_import.py

UYARI:
  - Bu script BİR KERELİK çalıştırılır.
  - work_records tablosu dolu bulunursa DUR ve çıkar (silme/üzerine yazma yapmaz).
  - Veri kaynağı: backend/data/source/TTO_Yapılan_İşler_ve_Ödemeler.xlsx

Kurallara ilişkin notlar:
  bkz. docs/ARCHITECTURE.md §7 (Excel Import Notları)
"""

from __future__ import annotations

import sys
import re
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from typing import Optional

# ── Python path: scripts/ bir üst dizinden backend/ modüllerine erişim ───
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
BACKEND_DIR = PROJECT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

try:
    import openpyxl
except ImportError:
    sys.exit(
        "\nHATA: openpyxl yüklü değil.\n"
        "Çözüm: backend/venv/bin/pip install openpyxl==3.1.5\n"
    )

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Academician, Firm, Project, WorkRecord

# ── Sabit yollar ──────────────────────────────────────────────────────────
EXCEL_PATH  = BACKEND_DIR / "data" / "source" / "TTO_Yapılan_İşler_ve_Ödemeler.xlsx"
REPORT_PATH = PROJECT_DIR / "docs" / "EXCEL_IMPORT_REPORT.md"

# Excel'deki gerçek veri başlangıç satırı (1-2 = header, 3 = ilk veri)
DATA_START_ROW = 3

# ═══════════════════════════════════════════════════════════════════════════
# BÖLÜM 1 — Yardımcı / dönüşüm fonksiyonları
# ═══════════════════════════════════════════════════════════════════════════

_TWO = Decimal("0.01")


def _round2(v: Decimal) -> Decimal:
    return v.quantize(_TWO, rounding=ROUND_HALF_UP)


def to_decimal(val) -> Optional[Decimal]:
    """Excel hücresini Decimal'e çevir; dönüştürülemezse None."""
    if val is None:
        return None
    if isinstance(val, bool):
        return None
    try:
        return _round2(Decimal(str(val)))
    except (InvalidOperation, ValueError):
        return None


def to_str(val) -> Optional[str]:
    """Hücreyi string'e çevir; None / boş → None."""
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def normalize_name(val) -> Optional[str]:
    """İsim normalizasyonu: strip (baştaki/sondaki boşluk temizle)."""
    return to_str(val)  # to_str zaten strip() yapıyor


def is_text_kdv(val) -> bool:
    """KDV hücresi sayı değil metin mi? (KDV istisnası kural 12)"""
    if val is None or isinstance(val, bool):
        return False
    if isinstance(val, (int, float, Decimal)):
        return False
    return to_decimal(val) is None and bool(str(val).strip())


def parse_date(val) -> Optional[date]:
    """Excel tarih değerini Python date'e çevir."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    s = str(val).strip()
    if not s:
        return None
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None  # tanınmayan format — None kabul et


def split_academician_names(val) -> list[str]:
    """Virgülle ayrılmış akademisyen isim listesi."""
    s = to_str(val)
    if not s:
        return []
    return [p.strip() for p in s.split(",") if p.strip()]


# ═══════════════════════════════════════════════════════════════════════════
# BÖLÜM 2 — Veritabanı yardımcıları
# ═══════════════════════════════════════════════════════════════════════════

def check_db_empty(db: Session) -> bool:
    """work_records tablosu boş mu?"""
    count = db.query(func.count(WorkRecord.id)).scalar()
    return count == 0


def get_max_sira_no(db: Session, year: int) -> int:
    """O yılki max sira_no; kayıt yoksa 0."""
    val = db.query(func.max(WorkRecord.sira_no)).filter(WorkRecord.year == year).scalar()
    return val or 0


def get_or_create_firm(db: Session, name: str, cache: dict) -> int:
    """Firma al veya oluştur; ID döner."""
    if name in cache:
        return cache[name]
    existing = db.query(Firm).filter(Firm.name == name).first()
    if existing:
        cache[name] = existing.id
        return existing.id
    firm = Firm(name=name, created_at=datetime.now(timezone.utc))
    db.add(firm)
    db.flush()
    cache[name] = firm.id
    return firm.id


def get_or_create_academician(
    db: Session, name: str, iban: Optional[str], cache: dict
) -> int:
    """Akademisyen al veya oluştur; IBAN varsa ve henüz set edilmemişse güncelle."""
    if name in cache:
        return cache[name]
    existing = db.query(Academician).filter(Academician.full_name == name).first()
    if existing:
        if iban and not existing.iban:
            existing.iban = iban
            db.flush()
        cache[name] = existing.id
        return existing.id
    acad = Academician(full_name=name, iban=iban, created_at=datetime.now(timezone.utc))
    db.add(acad)
    db.flush()
    cache[name] = acad.id
    return acad.id


def get_or_create_project(db: Session, name: str, cache: dict) -> int:
    """Proje al veya oluştur; ID döner."""
    if name in cache:
        return cache[name]
    existing = db.query(Project).filter(Project.name == name).first()
    if existing:
        cache[name] = existing.id
        return existing.id
    proj = Project(name=name, created_at=datetime.now(timezone.utc))
    db.add(proj)
    db.flush()
    cache[name] = proj.id
    return proj.id


# ═══════════════════════════════════════════════════════════════════════════
# BÖLÜM 3 — Sekme ayrıştırma (parse)
# ═══════════════════════════════════════════════════════════════════════════

def _row_values(ws, row_num: int, n_cols: int) -> list:
    """ws'den row_num satırının ilk n_cols sütun değerlerini liste olarak döner."""
    return [ws.cell(row=row_num, column=c).value for c in range(1, n_cols + 1)]


def parse_sheet_2025(ws, report: dict) -> list[dict]:
    """
    2025 sekmesi — sütun eşlemesi:
      A(0)=sira_no  B(1)=firma     C(2)=yapilan_is    D(3)=akademisyen
      E(4)=fiyat    F(5)=kdv       G(6)=tevkifat
      H(7)=tto_sonrasi  I(8)=stopaj_sonrasi
      J(9)=odenen_tarih  K(10)=DURUM_NOTU → notes (payment_status değil!)
    """
    records: list[dict] = []

    for row_num in range(DATA_START_ROW, ws.max_row + 1):
        cols = _row_values(ws, row_num, 11)

        # Tamamen boş satır → atla
        if all(v is None for v in cols):
            continue

        sira_no_raw   = cols[0]
        firma_raw     = cols[1]
        yapilan_is    = to_str(cols[2])
        akad_raw      = cols[3]
        fiyat_raw     = cols[4]
        kdv_raw       = cols[5]
        tevkifat_raw  = cols[6]
        tto_son_raw   = cols[7]   # amount_after_tto_share
        stop_son_raw  = cols[8]   # amount_after_withholding
        tarih_raw     = cols[9]
        durum_raw     = cols[10]  # → notes (kural 10)

        firma   = normalize_name(firma_raw)
        akad    = to_str(akad_raw)
        fiyat   = to_decimal(fiyat_raw)
        tarih   = parse_date(tarih_raw)

        # ── Kural 7: firma / akademisyen boş ─────────────────────────────
        if not firma or not akad:
            report["skipped_missing_entity"].append({
                "sheet": "2025", "row": row_num,
                "reason": f"firma={firma_raw!r} | akad={akad_raw!r}",
            })
            continue

        # ── Kural 6a / 6b: fiyat boş ─────────────────────────────────────
        if fiyat is None:
            if tarih is not None:
                report["skipped_missing_price"].append({
                    "sheet": "2025", "row": row_num,
                    "reason": f"Fiyat boş, tarih dolu ({tarih}). Eksik veri.",
                })
            else:
                report["skipped_draft"].append({
                    "sheet": "2025", "row": row_num,
                    "reason": "Fiyat + tarih boş. Taslak satır.",
                })
            continue

        # ── Kural 12: KDV istisnası ───────────────────────────────────────
        kdv_exception_text = None
        if is_text_kdv(kdv_raw):
            kdv_exception_text = str(kdv_raw).strip()
            kdv       = Decimal("0.00")
            tevkifat  = Decimal("0.00")
            report["kdv_exception"].append({
                "sheet": "2025", "row": row_num, "kdv_text": kdv_exception_text,
            })
        else:
            kdv      = to_decimal(kdv_raw)      or Decimal("0.00")
            tevkifat = to_decimal(tevkifat_raw) or Decimal("0.00")

        amount_after_tto        = to_decimal(tto_son_raw)  or Decimal("0.00")
        amount_after_withholding = to_decimal(stop_son_raw) or Decimal("0.00")
        # 2025'te tto_share_amount ayrı sütun yok — türet (kural ARCHITECTURE.md)
        tto_share_amount = _round2(fiyat - amount_after_tto)

        # ── Kural 9: payment_status türet ────────────────────────────────
        payment_status = "Ödendi" if tarih else "Ödenmedi"

        # ── Kural 10: K sütunu → notes ────────────────────────────────────
        notes_parts: list[str] = []
        if kdv_exception_text:
            notes_parts.append(f"[KDV MUAFİYETİ] {kdv_exception_text}")
        durum_str = to_str(durum_raw)
        if durum_str:
            notes_parts.append(durum_str)
        notes = " | ".join(notes_parts) or None

        records.append({
            "year":            2025,
            "sira_no_original": sira_no_raw,
            "sira_no_assigned": None,          # expand aşamasında doldurulur
            "firma":           firma,
            "yapilan_is":      yapilan_is or "",
            "akademisyen_str": akad,
            "invoice_price":   fiyat,
            "invoice_vat":     kdv,
            "withholding_tax": tevkifat,
            "tto_share_amount":       tto_share_amount,
            "amount_after_tto_share": amount_after_tto,
            "amount_after_withholding": amount_after_withholding,
            "payment_status":  payment_status,
            "paid_date":       tarih,
            "notes":           notes,
            "project_name":    None,
            "iban":            None,
            "is_manually_adjusted": False,
            "sheet":           "2025",
            "row_num":         row_num,
        })

    return records


def parse_sheet_2026(ws, report: dict) -> list[dict]:
    """
    2026 sekmesi — sütun eşlemesi:
      A(0)=sira_no   B(1)=firma      C(2)=yapilan_is   D(3)=akademisyen
      E(4)=proje     F(5)=fiyat      G(6)=kdv           H(7)=tevkifat
      I(8)=tto_tl    J(9)=tto_son    K(10)=stop_son
      L(11)=tarih    M(12)=payment_status  N(13)=iban
    """
    records: list[dict] = []

    for row_num in range(DATA_START_ROW, ws.max_row + 1):
        cols = _row_values(ws, row_num, 14)

        if all(v is None for v in cols):
            continue

        sira_no_raw   = cols[0]
        firma_raw     = cols[1]
        yapilan_is    = to_str(cols[2])
        akad_raw      = cols[3]
        proje_raw     = cols[4]
        fiyat_raw     = cols[5]
        kdv_raw       = cols[6]
        tevkifat_raw  = cols[7]
        tto_tl_raw    = cols[8]   # tto_share_amount
        tto_son_raw   = cols[9]   # amount_after_tto_share
        stop_son_raw  = cols[10]  # amount_after_withholding
        tarih_raw     = cols[11]
        status_raw    = cols[12]
        iban_raw      = cols[13]

        firma  = normalize_name(firma_raw)
        akad   = to_str(akad_raw)
        fiyat  = to_decimal(fiyat_raw)
        tarih  = parse_date(tarih_raw)
        status = to_str(status_raw)
        iban   = to_str(iban_raw)

        # ── Kural 7 ───────────────────────────────────────────────────────
        if not firma or not akad:
            report["skipped_missing_entity"].append({
                "sheet": "2026", "row": row_num,
                "reason": f"firma={firma_raw!r} | akad={akad_raw!r}",
            })
            continue

        # ── Kural 6a / 6b ─────────────────────────────────────────────────
        if fiyat is None:
            has_info = tarih is not None or (status is not None)
            if has_info:
                report["skipped_missing_price"].append({
                    "sheet": "2026", "row": row_num,
                    "reason": f"Fiyat boş | tarih={tarih} | status={status!r}. Eksik veri.",
                })
            else:
                report["skipped_draft"].append({
                    "sheet": "2026", "row": row_num,
                    "reason": "Fiyat + tarih + status boş. Taslak satır.",
                })
            continue

        # ── Kural 12: KDV istisnası ───────────────────────────────────────
        kdv_exception_text = None
        if is_text_kdv(kdv_raw):
            kdv_exception_text = str(kdv_raw).strip()
            kdv      = Decimal("0.00")
            tevkifat = Decimal("0.00")
            report["kdv_exception"].append({
                "sheet": "2026", "row": row_num, "kdv_text": kdv_exception_text,
            })
        else:
            kdv      = to_decimal(kdv_raw)      or Decimal("0.00")
            tevkifat = to_decimal(tevkifat_raw) or Decimal("0.00")

        tto_share_amount         = to_decimal(tto_tl_raw)   or Decimal("0.00")
        amount_after_tto         = to_decimal(tto_son_raw)  or Decimal("0.00")
        amount_after_withholding = to_decimal(stop_son_raw) or Decimal("0.00")

        # payment_status doğrulama
        payment_status = "Ödenmedi"
        extra_note = None
        if status in ("Ödendi", "Ödenmedi"):
            payment_status = status
        elif status:
            extra_note = f"[Orijinal payment_status: {status!r}]"

        # Kural 5: proje "-" → None
        proje = to_str(proje_raw)
        if proje == "-":
            proje = None

        # Notes birleştirme
        notes_parts: list[str] = []
        if kdv_exception_text:
            notes_parts.append(f"[KDV MUAFİYETİ] {kdv_exception_text}")
        if extra_note:
            notes_parts.append(extra_note)
        notes = " | ".join(notes_parts) or None

        records.append({
            "year":            2026,
            "sira_no_original": sira_no_raw,
            "sira_no_assigned": None,
            "firma":           firma,
            "yapilan_is":      yapilan_is or "",
            "akademisyen_str": akad,
            "invoice_price":   fiyat,
            "invoice_vat":     kdv,
            "withholding_tax": tevkifat,
            "tto_share_amount":       tto_share_amount,
            "amount_after_tto_share": amount_after_tto,
            "amount_after_withholding": amount_after_withholding,
            "payment_status":  payment_status,
            "paid_date":       tarih,
            "notes":           notes,
            "project_name":    proje,
            "iban":            iban,
            "is_manually_adjusted": False,
            "sheet":           "2026",
            "row_num":         row_num,
        })

    return records


# ═══════════════════════════════════════════════════════════════════════════
# BÖLÜM 4 — Çoklu akademisyen genişletme (kural 8 + 11)
# ═══════════════════════════════════════════════════════════════════════════

def expand_multi_academician(raw_records: list[dict], report: dict) -> list[dict]:
    """
    Virgülle ayrılmış çoklu akademisyen satırlarını kişi başı kayıtlara böler.
    Bölünen kayıtlara orijinal sira_no yerine yeni sira_no atanır (kural 11).
    Yeni sira_no'lar: o yılın raw_records içindeki max sira_no'dan itibaren artar.
    """
    # Her yıl için parsed sira_no max değerini bul (bölünmeden önce)
    year_max: dict[int, int] = {}
    for rec in raw_records:
        y = rec["year"]
        sn = rec["sira_no_original"]
        try:
            sn_int = int(sn) if sn is not None else 0
        except (ValueError, TypeError):
            sn_int = 0
        year_max[y] = max(year_max.get(y, 0), sn_int)

    # Kopya — expand işlemi burada yapılır
    expanded: list[dict] = []

    for rec in raw_records:
        names = split_academician_names(rec["akademisyen_str"])

        if len(names) <= 1:
            # Tekli — sira_no_original kullan
            r = dict(rec)
            try:
                r["sira_no_assigned"] = int(rec["sira_no_original"]) if rec["sira_no_original"] is not None else None
            except (ValueError, TypeError):
                r["sira_no_assigned"] = None  # main'de max+1 ile çözülür
            expanded.append(r)
            continue

        # Çoklu akademisyen bölme
        n = len(names)
        year = rec["year"]
        divisor = Decimal(str(n))

        report["multi_academician"].append({
            "sheet":             rec["sheet"],
            "row":               rec["row_num"],
            "original_sira_no":  rec["sira_no_original"],
            "n":                 n,
            "names":             names,
        })

        for name in names:
            year_max[year] += 1
            new_sira = year_max[year]

            r = dict(rec)
            r["akademisyen_str"] = name

            # Tutarları eşit böl
            orig_price = rec["invoice_price"]
            for field in (
                "invoice_price", "invoice_vat", "withholding_tax",
                "tto_share_amount", "amount_after_tto_share",
                "amount_after_withholding",
            ):
                v = rec.get(field)
                r[field] = _round2(v / divisor) if v is not None else Decimal("0.00")

            # Notes: bölünme bilgisi
            split_note = (
                f"Orijinal fatura {orig_price} TL, {n} kişi arasında eşit "
                f"bölüştürüldü. Orijinal sira_no: {rec['sira_no_original']}"
            )
            existing = r.get("notes") or ""
            r["notes"] = (existing + " | " + split_note).strip(" | ") if existing else split_note

            r["sira_no_assigned"]   = new_sira
            r["is_manually_adjusted"] = False

            expanded.append(r)

    return expanded


# ═══════════════════════════════════════════════════════════════════════════
# BÖLÜM 5 — DB'ye yazma
# ═══════════════════════════════════════════════════════════════════════════

def insert_all(db: Session, records: list[dict]) -> dict:
    """Tüm kayıtları firms → academicians → projects → work_records sırasıyla yazar."""
    firm_cache:  dict[str, int] = {}
    acad_cache:  dict[str, int] = {}
    proj_cache:  dict[str, int] = {}
    year_db_max: dict[int, int] = {}

    inserted = 0

    for rec in records:
        year = rec["year"]

        # Firma
        firm_id = get_or_create_firm(db, rec["firma"], firm_cache)

        # Akademisyen (IBAN varsa ekle)
        acad_id = get_or_create_academician(
            db, rec["akademisyen_str"], rec.get("iban"), acad_cache
        )

        # Proje (sadece 2026)
        project_id: Optional[int] = None
        proj_name = rec.get("project_name")
        if proj_name:
            project_id = get_or_create_project(db, proj_name, proj_cache)

        # sira_no belirleme
        if rec.get("sira_no_assigned") is not None:
            sira_no = rec["sira_no_assigned"]
        else:
            # Fallback: DB max + 1
            if year not in year_db_max:
                year_db_max[year] = get_max_sira_no(db, year)
            year_db_max[year] += 1
            sira_no = year_db_max[year]

        wr = WorkRecord(
            year=year,
            sira_no=sira_no,
            firm_id=firm_id,
            academician_id=acad_id,
            project_id=project_id,
            work_done=rec.get("yapilan_is") or "",
            invoice_price=rec["invoice_price"],
            invoice_vat=rec["invoice_vat"],
            withholding_tax=rec["withholding_tax"],
            tto_share_amount=rec["tto_share_amount"],
            amount_after_tto_share=rec["amount_after_tto_share"],
            amount_after_withholding=rec["amount_after_withholding"],
            payment_status=rec["payment_status"],
            paid_date=rec.get("paid_date"),
            iban_snapshot=rec.get("iban"),
            notes=rec.get("notes"),
            is_manually_adjusted=rec.get("is_manually_adjusted", False),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(wr)
        inserted += 1

    db.commit()

    return {
        "inserted":     inserted,
        "firms":        len(firm_cache),
        "academicians": len(acad_cache),
        "projects":     len(proj_cache),
    }


# ═══════════════════════════════════════════════════════════════════════════
# BÖLÜM 6 — Rapor üretimi
# ═══════════════════════════════════════════════════════════════════════════

def build_report_md(
    report: dict,
    raw_2025: int,
    raw_2026: int,
    db_stats: dict,
) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines: list[str] = [
        "# TTO Otomasyonu — Excel Import Raporu",
        "",
        f"> Oluşturulma: {now}",
        f"> Kaynak: `backend/data/source/TTO_Yapılan_İşler_ve_Ödemeler.xlsx`",
        "",
        "---",
        "",
        "## Özet",
        "",
        f"| Metrik | Değer |",
        f"|---|---|",
        f"| 2025 okunan satır | {raw_2025} |",
        f"| 2026 okunan satır | {raw_2026} |",
        f"| Toplam okunan | {raw_2025 + raw_2026} |",
        f"| **Başarıyla aktarılan kayıt** | **{db_stats['inserted']}** |",
        f"| Oluşturulan tekil firma | {db_stats['firms']} |",
        f"| Oluşturulan tekil akademisyen | {db_stats['academicians']} |",
        f"| Oluşturulan tekil proje | {db_stats['projects']} |",
        "",
        "---",
        "",
    ]

    # 6a — Eksik fiyat (tarih/status dolu)
    items_6a = report["skipped_missing_price"]
    lines += [
        f"## Atlanan: Eksik Fiyat / Şüpheli Kayıt ({len(items_6a)} satır)",
        "",
        "Fiyat boş AMA ödenen_tarih veya payment_status dolu (muhtemelen fiyat unutulmuş).",
        "",
    ]
    if items_6a:
        lines.append("| Sekme | Satır | Açıklama |")
        lines.append("|---|---|---|")
        for x in items_6a:
            lines.append(f"| {x['sheet']} | {x['row']} | {x['reason']} |")
    else:
        lines.append("_(yok)_")
    lines.append("")

    # 6b — Taslak satırlar
    items_6b = report["skipped_draft"]
    lines += [
        f"## Atlanan: Taslak / Kopya Satır ({len(items_6b)} satır)",
        "",
        "Fiyat + tarih + status hepsi boş (muhtemelen şablon/taslak satırlar).",
        "",
    ]
    if items_6b:
        rows_6b = ", ".join(str(x["row"]) for x in items_6b)
        lines.append(f"Satırlar: {rows_6b}")
    else:
        lines.append("_(yok)_")
    lines.append("")

    # 7 — Eksik firma/akademisyen
    items_7 = report["skipped_missing_entity"]
    lines += [
        f"## Atlanan: Eksik Firma / Akademisyen ({len(items_7)} satır)",
        "",
    ]
    if items_7:
        lines.append("| Sekme | Satır | Açıklama |")
        lines.append("|---|---|---|")
        for x in items_7:
            lines.append(f"| {x['sheet']} | {x['row']} | {x['reason']} |")
    else:
        lines.append("_(yok)_")
    lines.append("")

    # 8 — Çoklu akademisyen bölme
    items_8 = report["multi_academician"]
    lines += [
        f"## Çoklu Akademisyen Bölme ({len(items_8)} orijinal satır)",
        "",
    ]
    if items_8:
        lines.append("| Sekme | Satır | Orijinal sira_no | Kişi | İsimler |")
        lines.append("|---|---|---|---|---|")
        for x in items_8:
            lines.append(
                f"| {x['sheet']} | {x['row']} | {x['original_sira_no']} "
                f"| {x['n']} | {', '.join(x['names'])} |"
            )
    else:
        lines.append("_(yok)_")
    lines.append("")

    # 12 — KDV istisnası
    items_12 = report["kdv_exception"]
    lines += [
        f"## KDV İstisnası Uygulanan Satırlar ({len(items_12)} satır)",
        "",
    ]
    if items_12:
        lines.append("| Sekme | Satır | KDV Metni |")
        lines.append("|---|---|---|")
        for x in items_12:
            lines.append(f"| {x['sheet']} | {x['row']} | {x['kdv_text']} |")
    else:
        lines.append("_(yok)_")
    lines.append("")

    return "\n".join(lines)


# ═══════════════════════════════════════════════════════════════════════════
# BÖLÜM 7 — Ana akış
# ═══════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("=" * 60)
    print("TTO Otomasyonu — Excel Import")
    print("=" * 60)

    # ── 1. Excel dosyası var mı? ──────────────────────────────────────────
    if not EXCEL_PATH.exists():
        sys.exit(
            f"\nHATA: Excel dosyası bulunamadı:\n  {EXCEL_PATH}\n"
            "Dosyayı backend/data/source/ klasörüne koy.\n"
        )
    print(f"\n✓ Excel: {EXCEL_PATH}")

    # ── 2. DB boş mu? (kural 13) ─────────────────────────────────────────
    db: Session = SessionLocal()
    try:
        if not check_db_empty(db):
            print(
                "\n⚠️  work_records tablosu BOŞ DEĞİL — import iptal edildi.\n"
                "Bu script bir kerelik çalışır. Tabloyu elle temizlemeden devam etme.\n"
                "Eğer yeniden import gerekiyorsa önce tabloyu boşalt:\n"
                "  DELETE FROM work_records;  -- SQLite'da dikkatli kullan!\n"
            )
            sys.exit(1)
        print("✓ work_records tablosu boş, devam ediliyor...")

        # ── 3. Excel oku ─────────────────────────────────────────────────
        print(f"\n📖 Excel okunuyor...")
        wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)

        if "2025" not in wb.sheetnames or "2026" not in wb.sheetnames:
            sys.exit(
                f"\nHATA: Beklenen sekmeler ('2025', '2026') bulunamadı.\n"
                f"Mevcut sekmeler: {wb.sheetnames}\n"
            )

        # Rapor veri yapısı
        report: dict = {
            "skipped_missing_price":  [],
            "skipped_draft":          [],
            "skipped_missing_entity": [],
            "multi_academician":      [],
            "kdv_exception":          [],
        }

        # ── 4. Sekme parse ────────────────────────────────────────────────
        print("  → 2025 sekmesi ayrıştırılıyor...")
        raw_2025 = parse_sheet_2025(wb["2025"], report)
        print(f"     {len(raw_2025)} geçerli satır (parse sonrası)")

        print("  → 2026 sekmesi ayrıştırılıyor...")
        raw_2026 = parse_sheet_2026(wb["2026"], report)
        print(f"     {len(raw_2026)} geçerli satır (parse sonrası)")

        all_raw = raw_2025 + raw_2026

        # ── 5. Çoklu akademisyen genişletme ──────────────────────────────
        print("\n🔀 Çoklu akademisyen satırları genişletiliyor...")
        expanded = expand_multi_academician(all_raw, report)
        print(f"   {len(all_raw)} ham kayıt → {len(expanded)} genişletilmiş kayıt")

        # ── 6. DB'ye yaz ─────────────────────────────────────────────────
        print("\n💾 Veritabanına yazılıyor...")
        db_stats = insert_all(db, expanded)
        print(f"   ✓ {db_stats['inserted']} kayıt aktarıldı")
        print(f"   ✓ {db_stats['firms']} firma")
        print(f"   ✓ {db_stats['academicians']} akademisyen")
        print(f"   ✓ {db_stats['projects']} proje")

        # ── 7. Rapor ──────────────────────────────────────────────────────
        # raw satır sayıları (DATA_START_ROW'dan max_row'a kadar boş olmayanlar)
        raw_2025_count = wb["2025"].max_row - DATA_START_ROW + 1
        raw_2026_count = wb["2026"].max_row - DATA_START_ROW + 1

        print(f"\n📄 Rapor yazılıyor: {REPORT_PATH}")
        report_md = build_report_md(report, raw_2025_count, raw_2026_count, db_stats)
        REPORT_PATH.write_text(report_md, encoding="utf-8")

        print("\n" + "=" * 60)
        print("ÖZET")
        print("=" * 60)
        print(f"  Atlanan (eksik fiyat):          {len(report['skipped_missing_price'])}")
        print(f"  Atlanan (taslak):               {len(report['skipped_draft'])}")
        print(f"  Atlanan (eksik firma/akad):     {len(report['skipped_missing_entity'])}")
        print(f"  Çoklu-akademisyen bölme:        {len(report['multi_academician'])} orijinal satır")
        print(f"  KDV istisnası:                  {len(report['kdv_exception'])} satır")
        print(f"  Aktarılan kayıt:                {db_stats['inserted']}")
        print(f"\n✅ Import tamamlandı. Rapor: {REPORT_PATH}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
