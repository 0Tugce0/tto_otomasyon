# TTO Otomasyonu — Mimari Belge

> Geliştirme ilerledikçe güncellenir. Orijinal şartname: `tto-otomasyon-plan.md`.

---

## 1. Genel Mimari

```
frontend/ (React + Vite + Tailwind v4)
    ↓ npm run build
backend/app/static/          ← production build çıktısı (B-4)
    ↑ FastAPI StaticFiles / SPA catch-all route
backend/ (FastAPI + SQLAlchemy + SQLite WAL)
    data/tto.db
```

- **Tek port** (8000): API + frontend aynı süreçten servis edilir.
- **Dev modunda** Vite dev server (5173) + uvicorn (8000) ayrı çalışır; `/api` proxy ile yönlendirilir.

---

## 2. Veritabanı

- **SQLite WAL modu** — eşzamanlı okuma/yazma, tek dosya yedekleme.
- **Alembic** migration yönetimi — `render_as_batch=True` (SQLite ALTER TABLE sınırlaması).
- **Naming convention** (`ix_`, `uq_`, `ck_`, `fk_`, `pk_`) — batch mode constraint yeniden oluşturma için.

---

## 3. Kimlik Doğrulama

- HttpOnly session cookie — Starlette `SessionMiddleware` + `itsdangerous`.
- Şifreler `bcrypt.hashpw` / `bcrypt.checkpw` ile hash'lenir (`passlib` kullanılmaz — B-3).
- `get_current_user` dependency: tüm korumalı endpoint'ler `Depends(get_current_user)`.

---

## 4. Hesaplama Zinciri (`core/calculations.py`)

### 4.1 Giriş Değişkenleri

| Değişken | Kaynak |
|---|---|
| `invoice_price` | Kullanıcı girişi |
| `tto_share_rate` | `settings` tablosu (yıla göre) |
| `withholding_rate` | `settings` tablosu |
| `vat_rate` | `settings` tablosu |
| `invoice_withholding_rate` | `settings` tablosu |

### 4.2 Hesaplama Sırası

```
1. invoice_vat              = invoice_price × vat_rate
2. withholding_tax          = invoice_vat × invoice_withholding_rate
3. tto_share_amount         = invoice_price × tto_share_rate
4. amount_after_tto_share   = invoice_price − tto_share_amount
5. amount_after_withholding = amount_after_tto_share × (1 − withholding_rate)
```

> **Örnek** (`invoice_price=10.000`, oranlar: KDV=%20, tevkifat=%10, TTO=%15, stopaj=%20)
>
> | Alan | Hesap | Sonuç |
> |---|---|---|
> | `invoice_vat` | 10.000 × 0.20 | 2.000,00 |
> | `withholding_tax` | 2.000 × 0.10 | 200,00 |
> | `tto_share_amount` | 10.000 × 0.15 | 1.500,00 |
> | `amount_after_tto_share` | 10.000 − 1.500 | 8.500,00 |
> | `amount_after_withholding` | 8.500 × (1−0.20) | 6.800,00 |

### 4.3 Manuel Düzeltme Bayrağı

`is_manually_adjusted` (boolean, tek global flag — B-8 kararı):

- Hesaplanan 5 alandan herhangi biri frontend tarafından el ile değiştirilirse `True` gönderilir.
- Hangi spesifik alanın değiştirildiği ayrıca takip edilmez (MVP kapsamı).
- `True` olduğunda backend değerleri yeniden hesaplamak yerine gelen değerleri saklar.

### 4.4 Yıl Bağımsızlığı

> **2025 ve 2026 hesaplama formülleri matematiksel olarak özdeştir.**
> Yıllar arası tek fark, `tto_share_amount`'ın 2025 öncesinde Excel'de ayrı bir
> giriş/gösterim sütunu olarak yer almamasıdır. Hesaplama mantığında yıl bazlı
> dallanmaya (`if year == 2025`) gerek yoktur — `calculate_all()` her iki yıl
> için de aynı şekilde kullanılır.

---

## 5. SPA Routing (`main.py`)

`app.mount()` yerine akıllı catch-all route kullanılıyor:

```
GET /{full_path:path}
  ├── Dosya _STATIC_DIR'de var?       → FileResponse (asset)
  ├── Uzantı ∈ asset uzantıları?      → 404 (hatalı asset isteği)
  └── Uzantısız path?                 → index.html (React route)
```

**Sıralama garantisi:** Tüm `/api/*` route'ları catch-all'dan önce tanımlanır.
FastAPI route'ları sırayla kontrol eder, dolayısıyla `/api/*` asla catch-all'a düşmez.

---

## 6. Önemli Kararlar Özeti

| ID | Karar | Seçim |
|---|---|---|
| B-1 | Kurulum dizini | `/Users/tugce/Desktop/TTO/tto-otomasyon/` |
| B-2 | `settings.valid_year` | UNIQUE |
| B-3 | `payment_status` | DB'de TEXT, API'de `Literal["Ödendi","Ödenmedi"]` — gerçek Excel verisiyle doğrulandı |
| B-4 | Frontend build hedefi | `vite.config.js` `outDir` → `backend/app/static` |
| B-5 | `sira_no` | Otomatik (yıl bazlı `max(sira_no)+1`) |
| B-6 | Auth | HttpOnly session cookie (in-memory, `itsdangerous`) |
| B-7 | `firm_id` | NOT NULL |
| B-8 | `is_manually_adjusted` | Tek global flag (alan bazında takip yok) |
| FK | `project_id` → SET NULL, `firm_id`/`academician_id` → RESTRICT | — |

---

## 7. Adım 13 İçin Excel Import Notları

> Bu notlar gerçek Excel dosyası (`TTO_Yapılan_İşler_ve_Ödemeler.xlsx`) incelenerek oluşturulmuştur.
> Aksiyon adım 13'te alınacak, şu an kod değişikliği gerekmez.

### 7.1 payment_status Doğrulaması

`payment_status` değerleri gerçek Excel verisiyle doğrulanmıştır:
- 2026 sekmesi: **`Ödendi`** / **`Ödenmedi`** kullanılıyor — `Bekliyor` hiç geçmiyor.
- Schemas.py güncellendi: `Literal["Ödendi", "Ödenmedi"]`.

### 7.2 2025 Sekmesi — "Durum" Sütunu

> ⚠️ **Adım 13'te kullanıcı onayı alınacak.**

2025 sekmesinde `Durum` sütunu `payment_status` değil, serbest metin notlarıdır.
Örnekler: `"Gider pusulası kesildi"`, `"Her birine ayrı ayrı 14450 TL ödendi..."`

Excel import script'i bu sütunu şu şekilde işlemeli:
- `work_records.notes` alanına aktar (`payment_status`'a değil).
- `payment_status` değeri `paid_date` alanının dolu/boş olmasına göre türetilmeli:
  - `paid_date` doluysa → `"Ödendi"`
  - `paid_date` boşsa → `"Ödenmedi"`
- **Adım 13'te kullanıcı onayı alınacak** (bu mantık varsayım, doğrulanmalı).

### 7.3 2026 Sekmesi — KDV İstisnası

> ⚠️ **Adım 13'te kullanıcı onayı alınacak.**

2026 sekmesinde en az bir satırda KDV sütunu sayısal değer yerine metin içeriyor:
> `"İstisna 302 - 11/1-a(2) Hizmet İhracı"`

Excel import script'i bu tür satırları şu şekilde işlemeli (iki seçenek, adım 13'te onaylanacak):
- **Seçenek A:** `invoice_vat = 0`, istisna açıklaması `notes` alanına eklenir.
- **Seçenek B:** Satır `"manuel inceleme gerekli"` olarak işaretlenir, import raporuna eklenir.
