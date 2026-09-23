"""
core/calculations.py — TTO payı / stopaj / KDV hesaplama fonksiyonları.

Şartname madde 6 + kullanıcının paylaştığı Excel formülleri doğrultusunda
netleştirilmiş hesaplama zinciri.

ÖNEMLİ NOTLAR:
  - Tüm hesaplamalar Python Decimal ile yapılır, float'a çevrilmez.
  - Oranlar (tto_share_rate, withholding_rate, vat_rate, invoice_withholding_rate)
    settings tablosundan yıla göre okunur; sabit kod içine gömülmez.
  - is_manually_adjusted: tek global flag — herhangi bir hesaplanan alan
    elle değiştirilirse True. Hangi alanın değiştiği ayrıca takip edilmez (B-8).
  - Yıl bağımsızlığı: 2025 ve 2026 için formüller matematiksel olarak
    özdeştir. Tek fark, tto_share_amount'ın 2025 Excel'inde ayrı bir
    gösterim sütunu olmaması — hesaplama mantığında yıl bazlı dallanma gerekmez.

HESAPLAMA ZİNCİRİ (sırayla):
  1. invoice_vat             = invoice_price * settings.vat_rate
  2. withholding_tax         = invoice_vat * settings.invoice_withholding_rate
  3. tto_share_amount        = invoice_price * settings.tto_share_rate
  4. amount_after_tto_share  = invoice_price - tto_share_amount
  5. amount_after_withholding = amount_after_tto_share * (1 - settings.withholding_rate)
"""

from decimal import ROUND_HALF_UP, Decimal


# ---------------------------------------------------------------------------
# Yardımcı: Decimal yuvarlama (2 ondalık basamak, standart yuvarlama)
# ---------------------------------------------------------------------------
_TWO_PLACES = Decimal("0.01")


def _round2(value: Decimal) -> Decimal:
    """Decimal değeri 2 ondalık basamağa yuvarlar (ROUND_HALF_UP)."""
    return value.quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------------------
# Adım 1: Fatura KDV'si
# ---------------------------------------------------------------------------
def calc_invoice_vat(invoice_price: Decimal, vat_rate: Decimal) -> Decimal:
    """
    invoice_vat = invoice_price * vat_rate

    Örn: 10.000 TL × 0.20 = 2.000 TL KDV
    """
    return _round2(invoice_price * vat_rate)


# ---------------------------------------------------------------------------
# Adım 2: Fatura tevkifatı (KDV üzerinden)
# ---------------------------------------------------------------------------
def calc_withholding_tax(invoice_vat: Decimal, invoice_withholding_rate: Decimal) -> Decimal:
    """
    withholding_tax = invoice_vat * invoice_withholding_rate

    Örn: 2.000 TL KDV × 0.10 = 200 TL tevkifat
    Tevkifat KDV tutarının belirli bir oranı olarak hesaplanır.
    """
    return _round2(invoice_vat * invoice_withholding_rate)


# ---------------------------------------------------------------------------
# Adım 3: TTO payı (TL tutar)
# ---------------------------------------------------------------------------
def calc_tto_share_amount(invoice_price: Decimal, tto_share_rate: Decimal) -> Decimal:
    """
    tto_share_amount = invoice_price * tto_share_rate

    Örn: 10.000 TL × 0.15 = 1.500 TL TTO payı
    """
    return _round2(invoice_price * tto_share_rate)


# ---------------------------------------------------------------------------
# Adım 4: TTO payı kesildikten sonra kalan tutar
# ---------------------------------------------------------------------------
def calc_amount_after_tto_share(
    invoice_price: Decimal, tto_share_amount: Decimal
) -> Decimal:
    """
    amount_after_tto_share = invoice_price - tto_share_amount
                           = invoice_price * (1 - tto_share_rate)  [eşdeğer]

    Örn: 10.000 - 1.500 = 8.500 TL
    """
    return _round2(invoice_price - tto_share_amount)


# ---------------------------------------------------------------------------
# Adım 5: Stopaj kesildikten sonra akademisyene ödenecek net tutar
# ---------------------------------------------------------------------------
def calc_amount_after_withholding(
    amount_after_tto_share: Decimal, withholding_rate: Decimal
) -> Decimal:
    """
    amount_after_withholding = amount_after_tto_share * (1 - withholding_rate)

    Örn: Excel =J18*0,8 → 8.500 × (1 - 0.20) = 6.800 TL net ödeme
    """
    return _round2(amount_after_tto_share * (Decimal("1") - withholding_rate))


# ---------------------------------------------------------------------------
# Tam zincir: tek çağrıyla tüm hesaplanan alanları döner
# ---------------------------------------------------------------------------
def calculate_all(
    invoice_price: Decimal,
    tto_share_rate: Decimal,
    withholding_rate: Decimal,
    vat_rate: Decimal,
    invoice_withholding_rate: Decimal,
) -> dict[str, Decimal]:
    """
    Tüm hesaplama zincirini sırayla çalıştırır.

    Kullanım (router'larda):
        from app.core.calculations import calculate_all
        from app.models import Setting

        setting = db.query(Setting).filter(Setting.valid_year == record.year).first()
        calculated = calculate_all(
            invoice_price=record_data.invoice_price,
            tto_share_rate=setting.tto_share_rate,
            withholding_rate=setting.withholding_rate,
            vat_rate=setting.vat_rate,
            invoice_withholding_rate=setting.invoice_withholding_rate,
        )
        # → calculated["invoice_vat"], calculated["amount_after_withholding"] vb.

    Dönen anahtarlar (tüm Decimal):
        invoice_vat, withholding_tax, tto_share_amount,
        amount_after_tto_share, amount_after_withholding
    """
    invoice_vat = calc_invoice_vat(invoice_price, vat_rate)
    withholding_tax = calc_withholding_tax(invoice_vat, invoice_withholding_rate)
    tto_share_amount = calc_tto_share_amount(invoice_price, tto_share_rate)
    amount_after_tto_share = calc_amount_after_tto_share(invoice_price, tto_share_amount)
    amount_after_withholding = calc_amount_after_withholding(amount_after_tto_share, withholding_rate)

    return {
        "invoice_vat": invoice_vat,
        "withholding_tax": withholding_tax,
        "tto_share_amount": tto_share_amount,
        "amount_after_tto_share": amount_after_tto_share,
        "amount_after_withholding": amount_after_withholding,
    }
