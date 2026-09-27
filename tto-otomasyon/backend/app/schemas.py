"""
schemas.py — Pydantic request/response şemaları.

Her tablo için ayrı Create / Update / Response şemaları tanımlıdır.
  - Update şemalarındaki tüm alanlar Optional (kısmi güncelleme).
  - Parasal alanlar: Decimal (float'a düşürülmüyor).
  - payment_status: Literal["Ödendi", "Bekliyor"] (API katmanı validation).
  - is_manually_adjusted: Optional[bool] = False (frontend gönderir).
  - from_attributes=True (Pydantic v2 — SQLAlchemy ORM objelerinden dönüşüm).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Yardımcı tipler
# ---------------------------------------------------------------------------

# Parasal alanlar — Numeric(12, 2) ile uyumlu, float kullanılmıyor
MoneyAmount = Annotated[Decimal, Field(max_digits=12, decimal_places=2)]

# Ödeme durumu — B-3 kararı revize edildi (gerçek Excel verisiyle doğrulandı):
# 2026 sekmesi: "Ödendi" / "Ödenmedi" — "Bekliyor" hiç kullanılmamış.
PaymentStatus = Literal["Ödendi", "Ödenmedi"]


# ===========================================================================
# 1. FIRMS — Firmalar (şartname 5.1)
# ===========================================================================

class FirmCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Firma adı (tekil)")


class FirmUpdate(BaseModel):
    """Tüm alanlar Optional — kısmi güncelleme desteklenir."""
    name: Optional[str] = Field(None, min_length=1)


class FirmResponse(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# 2. ACADEMICIANS — Akademisyenler (şartname 5.2)
# ===========================================================================

class AcademicianCreate(BaseModel):
    full_name: str = Field(..., min_length=1, description="Ad soyad (tekil)")
    iban: Optional[str] = Field(None, description="IBAN — 2026'dan itibaren")
    department: Optional[str] = Field(None, description="Bölüm — ileride eklenebilir")


class AcademicianUpdate(BaseModel):
    """Tüm alanlar Optional — kısmi güncelleme desteklenir."""
    full_name: Optional[str] = Field(None, min_length=1)
    iban: Optional[str] = None
    department: Optional[str] = None


class AcademicianResponse(BaseModel):
    id: int
    full_name: str
    iban: Optional[str] = None
    department: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# 3. PROJECTS — Projeler 2026+ (şartname 5.3)
# ===========================================================================

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Proje adı/kodu")
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Tüm alanlar Optional — kısmi güncelleme desteklenir."""
    name: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# 4. WORK RECORDS — Ana iş/ödeme kayıtları (şartname 5.4)
# ===========================================================================

# ---------------------------------------------------------------------------
# Hesaplama önizlemesi — DB'ye yazmadan sadece hesaplama sonucunu döner
# ---------------------------------------------------------------------------

class PreviewCalculationRequest(BaseModel):
    """POST /api/records/preview-calculation — DB'ye yazmadan hesaplama önizlemesi."""
    year: int = Field(..., ge=2020, description="Kayıt yılı — settings tablosundan oran bulunur")
    invoice_price: MoneyAmount = Field(..., description="Fatura fiyatı")


class PreviewCalculationResponse(BaseModel):
    """Hesaplama zinciri sonuçları (5 adım)."""
    year: int
    invoice_price: MoneyAmount
    invoice_vat: MoneyAmount
    withholding_tax: MoneyAmount
    tto_share_amount: MoneyAmount
    amount_after_tto_share: MoneyAmount
    amount_after_withholding: MoneyAmount
    # Kullanılan oranlar (frontend'de bilgi amaçlı gösterilebilir)
    rates_used: dict


class WorkRecordCreate(BaseModel):
    """
    Yeni kayıt oluşturma.
    sira_no dahil değil — backend yıl bazında otomatik atar (B-5 kararı).
    is_manually_adjusted frontend tarafından gönderilir (onaylandı).
    """
    year: int = Field(..., ge=2020, description="Kayıt yılı (2025, 2026 ...)")
    firm_id: int = Field(..., description="Firma ID (NOT NULL — B-7)")
    work_done: str = Field(..., min_length=1, description="Yapılan iş açıklaması")
    academician_id: int = Field(..., description="Akademisyen ID (NOT NULL)")
    project_id: Optional[int] = Field(None, description="Proje ID — sadece 2026+")

    # Parasal alanlar — Decimal, max 12 hane 2 ondalık
    invoice_price:            MoneyAmount = Field(..., description="Fatura fiyatı")
    invoice_vat:              MoneyAmount = Field(..., description="Fatura KDV")
    withholding_tax:          MoneyAmount = Field(..., description="Tevkifat")
    tto_share_amount:         Optional[MoneyAmount] = Field(None, description="TTO Payı TL — 2026+")
    amount_after_tto_share:   MoneyAmount = Field(..., description="TTO payı sonrası tutar")
    amount_after_withholding: MoneyAmount = Field(..., description="Stopaj sonrası net (akademisyene)")

    paid_date:      Optional[date] = Field(None, description="Ödeme tarihi")
    payment_status: PaymentStatus  = Field(..., description="'Ödendi' veya 'Bekliyor'")
    iban_snapshot:  Optional[str]  = Field(None, description="Ödeme anındaki IBAN snapshot")
    notes:          Optional[str]  = None

    # is_manually_adjusted: frontend gönderir, backend güvenmez ama kabul eder
    is_manually_adjusted: bool = Field(False, description="Kullanıcı hesaplanan değeri el ile değiştirdi mi")


class WorkRecordUpdate(BaseModel):
    """
    Kısmi güncelleme — tüm alanlar Optional.
    payment_status güncellenirse hâlâ Literal validation uygulanır.
    """
    year:             Optional[int]          = None
    firm_id:          Optional[int]          = None
    work_done:        Optional[str]          = Field(None, min_length=1)
    academician_id:   Optional[int]          = None
    project_id:       Optional[int]          = None

    invoice_price:            Optional[MoneyAmount] = None
    invoice_vat:              Optional[MoneyAmount] = None
    withholding_tax:          Optional[MoneyAmount] = None
    tto_share_amount:         Optional[MoneyAmount] = None
    amount_after_tto_share:   Optional[MoneyAmount] = None
    amount_after_withholding: Optional[MoneyAmount] = None

    paid_date:      Optional[date]          = None
    payment_status: Optional[PaymentStatus] = None
    iban_snapshot:  Optional[str]           = None
    notes:          Optional[str]           = None
    is_manually_adjusted: Optional[bool]    = None


class WorkRecordResponse(BaseModel):
    """
    Tam kayıt response — sira_no dahil, ilişkili objeler nested.
    firm / academician / project ilişkileri ORM'den eager load edilir.
    """
    id:       int
    year:     int
    sira_no:  int

    # FK ID'leri de dahil (filtering/reference için kullanışlı)
    firm_id:        int
    academician_id: int
    project_id:     Optional[int] = None

    work_done: str

    # Parasal
    invoice_price:            MoneyAmount
    invoice_vat:              MoneyAmount
    withholding_tax:          MoneyAmount
    tto_share_amount:         Optional[MoneyAmount] = None
    amount_after_tto_share:   MoneyAmount
    amount_after_withholding: MoneyAmount

    paid_date:      Optional[date] = None
    payment_status: PaymentStatus
    iban_snapshot:  Optional[str] = None
    notes:          Optional[str] = None
    is_manually_adjusted: bool

    # Nested ilişkiler (ORM'den lazy/eager load)
    firm:        FirmResponse
    academician: AcademicianResponse
    project:     Optional[ProjectResponse] = None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Akademisyen detay sayfası için özel şemalar (şartname madde 7.4)
# ---------------------------------------------------------------------------

class WorkRecordInAcademicianResponse(BaseModel):
    """
    AcademicianDetailResponse içinde kullanılan work_record şeması.
    academician alanı yok — zaten academician context'inde bulunuyoruz.
    firm ve project nested olarak dahil.
    """
    id:      int
    year:    int
    sira_no: int

    firm_id:    int
    firm:       FirmResponse
    work_done:  str
    project_id: Optional[int] = None
    project:    Optional[ProjectResponse] = None

    invoice_price:            MoneyAmount
    invoice_vat:              MoneyAmount
    withholding_tax:          MoneyAmount
    tto_share_amount:         Optional[MoneyAmount] = None
    amount_after_tto_share:   MoneyAmount
    amount_after_withholding: MoneyAmount

    paid_date:      Optional[date] = None
    payment_status: PaymentStatus
    iban_snapshot:  Optional[str] = None
    notes:          Optional[str] = None
    is_manually_adjusted: bool

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AcademicianSummary(BaseModel):
    """
    Akademisyen detay sayfası — özet istatistikler (şartname madde 7.4).
    amount_after_withholding üzerinden hesaplanır (akademisyene ödenecek net tutar).
    """
    total_earned:   MoneyAmount  # Tüm kayıtların amount_after_withholding toplamı
    total_paid:     MoneyAmount  # "Ödendi" statüsündeki kayıtların toplamı
    pending_amount: MoneyAmount  # "Bekliyor" kayıtların toplamı
    pending_count:  int          # "Bekliyor" kayıt sayısı


class AcademicianDetailResponse(BaseModel):
    """
    Akademisyen detay sayfası tam response (şartname madde 7.4):
      - Akademisyen bilgisi
      - İlgili tüm work_records (firm + project nested)
      - Özet istatistikler
    """
    id:         int
    full_name:  str
    iban:       Optional[str] = None
    department: Optional[str] = None
    created_at: datetime

    work_records: list[WorkRecordInAcademicianResponse]
    summary:      AcademicianSummary

    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# 5. SETTINGS — Hesaplama Oranları (şartname 5.5)
# ===========================================================================

class SettingCreate(BaseModel):
    valid_year:               int         = Field(..., ge=2020, description="Oranın geçerli olduğu yıl (tekil)")
    tto_share_rate:           MoneyAmount = Field(..., description="TTO payı oranı — örn. 0.15 (%15)")
    withholding_rate:         MoneyAmount = Field(..., description="Stopaj oranı — örn. 0.20 (%20)")
    vat_rate:                 MoneyAmount = Field(..., description="KDV oranı — örn. 0.20 (%20)")
    invoice_withholding_rate: MoneyAmount = Field(..., description="Fatura tevkifat oranı (KDV üzerinden) — örn. 0.10")


class SettingUpdate(BaseModel):
    """Tüm alanlar Optional — kısmi güncelleme desteklenir."""
    valid_year:               Optional[int]         = None
    tto_share_rate:           Optional[MoneyAmount] = None
    withholding_rate:         Optional[MoneyAmount] = None
    vat_rate:                 Optional[MoneyAmount] = None
    invoice_withholding_rate: Optional[MoneyAmount] = None


class SettingResponse(BaseModel):
    id:                       int
    valid_year:               int
    tto_share_rate:           MoneyAmount
    withholding_rate:         MoneyAmount
    vat_rate:                 MoneyAmount
    invoice_withholding_rate: MoneyAmount

    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# 6. USERS — Uygulama Kullanıcıları (şartname 5.6)
# ===========================================================================

class UserCreate(BaseModel):
    username:  str = Field(..., min_length=2, description="Kullanıcı adı (tekil)")
    password:  str = Field(..., min_length=6, description="Düz metin şifre — backend bcrypt ile hash'ler")
    full_name: str = Field(..., min_length=1)


class UserUpdate(BaseModel):
    """Tüm alanlar Optional — kısmi güncelleme desteklenir."""
    username:  Optional[str] = Field(None, min_length=2)
    password:  Optional[str] = Field(None, min_length=6)
    full_name: Optional[str] = Field(None, min_length=1)


class UserResponse(BaseModel):
    """password_hash asla response'a dahil edilmez."""
    id:         int
    username:   str
    full_name:  str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# 7. AUTH — Giriş (şartname madde 7.1, adım 8 için hazır)
# ===========================================================================

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    message: str = "Giriş başarılı"
    user: UserResponse
