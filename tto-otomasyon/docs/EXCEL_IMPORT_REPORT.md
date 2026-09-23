# TTO Otomasyonu — Excel Import Raporu

> Oluşturulma: 2026-09-18 22:36:28
> Kaynak: `backend/data/source/TTO_Yapılan_İşler_ve_Ödemeler.xlsx`

---

## Özet

| Metrik | Değer |
|---|---|
| 2025 okunan satır | 84 |
| 2026 okunan satır | 57 |
| Toplam okunan | 141 |
| **Başarıyla aktarılan kayıt** | **83** |
| Oluşturulan tekil firma | 54 |
| Oluşturulan tekil akademisyen | 22 |
| Oluşturulan tekil proje | 4 |

---

## Atlanan: Eksik Fiyat / Şüpheli Kayıt (4 satır)

Fiyat boş AMA ödenen_tarih veya payment_status dolu (muhtemelen fiyat unutulmuş).

| Sekme | Satır | Açıklama |
|---|---|---|
| 2025 | 27 | Fiyat boş, tarih dolu (2025-07-30). Eksik veri. |
| 2025 | 28 | Fiyat boş, tarih dolu (2025-07-31). Eksik veri. |
| 2026 | 8 | Fiyat boş | tarih=None | status='Ödendi'. Eksik veri. |
| 2026 | 9 | Fiyat boş | tarih=None | status='Ödendi'. Eksik veri. |

## Atlanan: Taslak / Kopya Satır (38 satır)

Fiyat + tarih + status hepsi boş (muhtemelen şablon/taslak satırlar).

Satırlar: 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59

## Atlanan: Eksik Firma / Akademisyen (0 satır)

_(yok)_

## Çoklu Akademisyen Bölme (1 orijinal satır)

| Sekme | Satır | Orijinal sira_no | Kişi | İsimler |
|---|---|---|---|---|
| 2025 | 24 | 22 | 4 | Sezgin Yaşa, Salih Yılmaz, Mehmet Emin Özdemir, Eren Yurdakul |

## KDV İstisnası Uygulanan Satırlar (1 satır)

| Sekme | Satır | KDV Metni |
|---|---|---|
| 2026 | 13 | İstisna 302 - 11/1-a(2) Hizmet İhracı (KDV Muafiyeti) |
