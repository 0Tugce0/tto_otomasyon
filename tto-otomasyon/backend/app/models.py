"""
models.py — SQLAlchemy ORM modelleri.

Şartname madde 5 (alan alan birebir):
  5.1 firms
  5.2 academicians
  5.3 projects
  5.4 work_records
  5.5 settings
  5.6 users

Onaylanan kararlar:
  - Tüm parasal alanlar: Numeric(12, 2)  — float kullanılmıyor
  - is_manually_adjusted: BOOLEAN, default=False, nullable=False
  - (year, sira_no): UniqueConstraint   — sira_no yıl bazında tekil
  - settings.valid_year: UNIQUE
  - firm_id FK → RESTRICT (NOT NULL, MVP'de silme yok)
  - academician_id FK → RESTRICT (NOT NULL, MVP'de silme yok)
  - project_id FK → SET NULL (nullable, opsiyonel bağ)
  - PRAGMA foreign_keys=ON: database.py'deki event hook ile etkin
  - firms.name / academicians.full_name: COLLATE NOCASE — case-insensitive
    UNIQUE (örn. "Aydos" == "AYDOS"). Bkz. migration 9802634c51c7.
"""

from datetime import datetime, date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


# ---------------------------------------------------------------------------
# 5.1 firms — Firmalar
# ---------------------------------------------------------------------------
class Firm(Base):
    __tablename__ = "firms"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(collation="NOCASE"), nullable=False, unique=True)   # Firma adı, tekil (case-insensitive)
    created_at = Column(DateTime, nullable=False, default=func.now())

    # İlişki
    work_records = relationship("WorkRecord", back_populates="firm")


# ---------------------------------------------------------------------------
# 5.2 academicians — Akademisyenler / Hocalar
# ---------------------------------------------------------------------------
class Academician(Base):
    __tablename__ = "academicians"

    id          = Column(Integer, primary_key=True, index=True)
    full_name   = Column(String(collation="NOCASE"), nullable=False, unique=True)   # Ad soyad, tekil (case-insensitive)
    iban        = Column(String, nullable=True)                  # 2026'dan itibaren
    department  = Column(String, nullable=True)                  # İleride eklenebilir
    created_at  = Column(DateTime, nullable=False, default=func.now())

    # İlişki
    work_records = relationship("WorkRecord", back_populates="academician")


# ---------------------------------------------------------------------------
# 5.3 projects — Projeler (2026+)
# ---------------------------------------------------------------------------
class Project(Base):
    __tablename__ = "projects"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)                 # Proje adı/kodu (unique değil — şartname)
    description = Column(Text, nullable=True)
    created_at  = Column(DateTime, nullable=False, default=func.now())

    # İlişki
    work_records = relationship("WorkRecord", back_populates="project")


# ---------------------------------------------------------------------------
# 5.4 work_records — Ana iş/ödeme kayıtları (Excel'deki her satır)
# ---------------------------------------------------------------------------
class WorkRecord(Base):
    __tablename__ = "work_records"

    __table_args__ = (
        # B-5 kararı: sira_no yıl bazında tekil olmalı
        UniqueConstraint("year", "sira_no", name="uq_work_records_year_sira_no"),
    )

    id               = Column(Integer, primary_key=True, index=True)
    year             = Column(Integer, nullable=False, index=True)  # 2025, 2026, ...
    sira_no          = Column(Integer, nullable=False)               # Otomatik (max+1) — uygulama katmanı

    # FK: firma — RESTRICT (NOT NULL, silme engellenir)
    firm_id          = Column(
        Integer,
        ForeignKey("firms.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    work_done        = Column(Text, nullable=False)                  # Yapılan İş

    # FK: akademisyen — RESTRICT (NOT NULL, silme engellenir)
    academician_id   = Column(
        Integer,
        ForeignKey("academicians.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # FK: proje — SET NULL (nullable, sadece 2026+)
    project_id       = Column(
        Integer,
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # --- Parasal alanlar: Numeric(12, 2) — float kullanılmıyor ---
    invoice_price             = Column(Numeric(12, 2), nullable=False)  # Fatura – Fiyat
    invoice_vat               = Column(Numeric(12, 2), nullable=False)  # Fatura – KDV
    withholding_tax           = Column(Numeric(12, 2), nullable=False)  # Tevkifat
    tto_share_amount          = Column(Numeric(12, 2), nullable=True)   # TTO Payı (TL) — sadece 2026+
    amount_after_tto_share    = Column(Numeric(12, 2), nullable=False)  # TTO payı sonrası tutar
    amount_after_withholding  = Column(Numeric(12, 2), nullable=False)  # Stopaj sonrası net (akademisyene)

    # --- Ödeme bilgileri ---
    paid_date        = Column(Date, nullable=True)                   # Hocaya ödenen tarih
    payment_status   = Column(String, nullable=False)                # "Ödendi" / "Bekliyor" (validation API katmanında)
    iban_snapshot    = Column(String, nullable=True)                  # Ödeme anındaki IBAN (snapshot)
    notes            = Column(Text, nullable=True)

    # --- Manuel düzeltme bayrağı (onaylandı: frontend gönderir) ---
    is_manually_adjusted = Column(Boolean, nullable=False, default=False)

    # --- Zaman damgaları ---
    created_at  = Column(DateTime, nullable=False, default=func.now())
    updated_at  = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    # İlişkiler
    firm        = relationship("Firm", back_populates="work_records")
    academician = relationship("Academician", back_populates="work_records")
    project     = relationship("Project", back_populates="work_records")


# ---------------------------------------------------------------------------
# 5.5 settings — Hesaplama Oranları (yıl bazında)
# ---------------------------------------------------------------------------
class Setting(Base):
    __tablename__ = "settings"

    id               = Column(Integer, primary_key=True, index=True)
    valid_year       = Column(Integer, nullable=False, unique=True)  # B-2: UNIQUE — bir yıl = bir oran
    tto_share_rate   = Column(Numeric(12, 2), nullable=False)        # Örn. 0.15 (%15 TTO payı)
    withholding_rate = Column(Numeric(12, 2), nullable=False)        # Örn. 0.20 (%20 stopaj, kalan %80 ödenir)

    # Ek oranlar — hesaplama zinciri için (düzeltme, adım 10 sonrası)
    vat_rate                  = Column(Numeric(12, 2), nullable=False)  # KDV oranı (örn. 0.20 → %20)
    invoice_withholding_rate  = Column(Numeric(12, 2), nullable=False)  # Faturaya eklenen tevkifat oranı
                                                                        # (KDV üzerinden hesaplanır,
                                                                        #  örn. 0.10 → KDV'nin %10'u)


# ---------------------------------------------------------------------------
# 5.6 users — Uygulama Kullanıcıları
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)  # bcrypt hash (passlib yok, bcrypt.hashpw)
    full_name     = Column(String, nullable=False)
    created_at    = Column(DateTime, nullable=False, default=func.now())
