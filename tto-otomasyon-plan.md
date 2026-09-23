# TTO Otomasyonu — Proje Planı ve Teknik Şartname

## 1. Proje Amacı

Şu anda Excel'de tutulan "TTO Yapılan İşler ve Ödemeler" tablosunu (firma, yapılan iş, akademisyen, fatura/vergi/stopaj hesapları, ödeme durumu) yerel ağda (LAN) çalışan, internete kapalı bir web uygulamasına taşımak.

Temel hedefler:
- Veri girişini Excel yerine doğrudan uygulama üzerinden yapmak.
- Bir akademisyenin ismine tıklandığında, o kişiye ait tüm işleri/firmaları/ödeme geçmişini tek ekranda görmek (Excel'de tek tek arama yapmak yerine).
- 2 farklı Windows bilgisayardan erişim (yalnızca yerel ağ üzerinden, internete açık değil, herkese açık değil).
- Geçmiş Excel verisinin (2025 sarı başlıklar + 2026 gri başlıklar) kayıpsız aktarılması.
- İleride kolayca geliştirilip genişletilebilir bir temel bırakmak.

## 2. Kullanım Senaryosu

- 2 kullanıcı (ör. TTO'da çalışan 2 kişi). Her ikisi de aynı veriye erişip kayıt ekleyebilir/düzenleyebilir.
- Bir bilgisayar **sunucu** rolünde çalışır: arka planda API + veritabanı burada durur, bilgisayar açıldığında otomatik başlar.
- Her iki bilgisayar da tarayıcıdan aynı adrese girer: `http://<sunucu-bilgisayarın-yerel-IP'si>:8000`
- Uygulama tamamen yerel ağda kalır, dışa (internete) açılmaz, herkese açık değildir. Basit kullanıcı adı/şifre ile korunur.

## 3. Mimari

```
[Bilgisayar 1: Sunucu]                         [Bilgisayar 2: İstemci]
 ┌───────────────────────┐                      ┌────────────────────┐
 │  FastAPI (backend)     │ <──── LAN / Wi-Fi ──>│   Web Tarayıcı      │
 │  + SQLite (tto.db)     │      http://IP:8000  │   (Chrome/Edge)     │
 │  + React (frontend,    │                      └────────────────────┘
 │    derlenmiş statik    │
 │    dosyalar backend    │      ┌────────────────────┐
 │    tarafından servis   │ <───>│   Bilgisayar 1'in   │
 │    edilir)             │      │   kendi tarayıcısı  │
 └───────────────────────┘      └────────────────────┘
```

- Backend hem API'yi hem de derlenmiş React arayüzünü tek bir process olarak servis eder (tek port, tek uygulama, kurulumu basitleştirmek için).
- Veritabanı tek bir SQLite dosyasıdır (`data/tto.db`), WAL (Write-Ahead Logging) modunda çalıştırılır — bu, aynı anda okuma/yazma yapan birkaç bağlantıyı güvenli şekilde destekler.
- Sunucu bilgisayarda Windows başlangıcında otomatik başlayacak şekilde bir servis/kısayol kurulur (NSSM veya Görev Zamanlayıcı ile).

## 4. Teknoloji Yığını

| Katman | Teknoloji | Not |
|---|---|---|
| Backend / API | Python 3.11+, FastAPI, Uvicorn | Hafif, hızlı geliştirme, otomatik `/docs` (Swagger) arayüzü gelir |
| ORM / DB erişimi | SQLAlchemy | Migration için Alembic |
| Veritabanı | SQLite (WAL modu) | Kurulum gerektirmez, tek dosya, kolay yedeklenir |
| Frontend | React + Vite, Tailwind CSS | Basit, hızlı, akademisyen bazlı görünüm ve tablo filtrelerine uygun |
| Kimlik doğrulama | Basit kullanıcı adı/şifre (bcrypt hash), oturum token'ı (JWT ya da session cookie) | Herkese açık olmadığı için karmaşık bir auth sistemine gerek yok, ama en az bir giriş ekranı olmalı |
| Çalıştırma | Windows'ta arka planda servis (NSSM veya Görev Zamanlayıcı ile başlangıçta otomatik başlatma) | Sunucu bilgisayar açıldığında uygulama kendiliğinden ayağa kalkmalı |

## 5. Veri Modeli

### 5.1 `firms` (Firmalar)
| Alan | Tip | Açıklama |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT, unique | Firma adı |
| created_at | DATETIME | |

### 5.2 `academicians` (Akademisyenler / Hocalar)
| Alan | Tip | Açıklama |
|---|---|---|
| id | INTEGER PK | |
| full_name | TEXT, unique | Ad soyad |
| iban | TEXT, nullable | 2026'dan itibaren mevcut |
| department | TEXT, nullable | İleride eklenebilir |
| created_at | DATETIME | |

### 5.3 `projects` (Projeler — 2026+)
| Alan | Tip | Açıklama |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | Proje adı/kodu |
| description | TEXT, nullable | |
| created_at | DATETIME | |

### 5.4 `work_records` (Ana iş/ödeme kayıtları — Excel'deki her satır)
| Alan | Tip | Açıklama |
|---|---|---|
| id | INTEGER PK | |
| year | INTEGER | 2025, 2026, ... — hangi tabloya ait olduğunu ayırt eder |
| sira_no | INTEGER | O yıl içindeki sıra no (Excel'deki "Sıra No") |
| firm_id | INTEGER, FK → firms.id | |
| work_done | TEXT | "Yapılan İş" |
| academician_id | INTEGER, FK → academicians.id | |
| project_id | INTEGER, FK → projects.id, nullable | Sadece 2026+ kayıtlarda dolu |
| invoice_price | DECIMAL | Firmaya Kesilecek Fatura – Fiyat |
| invoice_vat | DECIMAL | Firmaya Kesilecek Fatura – KDV |
| withholding_tax | DECIMAL | Faturaya Eklenen/Eklenecek Vergi (Tevkifat) |
| tto_share_amount | DECIMAL, nullable | TTO Payı (TL) — sadece 2026+'da ayrı kolon olarak var |
| amount_after_tto_share | DECIMAL | TTO Payı Kesildikten Sonra Hesaplanan Tutar |
| amount_after_withholding | DECIMAL | Stopaj Kesildikten Sonra (Akademisyene) Ödenecek Tutar |
| paid_date | DATE, nullable | Hocaya Ödenen Tarih |
| payment_status | TEXT | "Ödendi" / "Bekliyor" vb. (Excel'deki "Durum" / "Ödeme/Fatura Durumu") |
| iban_snapshot | TEXT, nullable | Ödeme anındaki IBAN (akademisyenin IBAN'ı değişse bile o kayda ait IBAN sabit kalsın diye) |
| notes | TEXT, nullable | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### 5.5 `settings` (Hesaplama Oranları)
| Alan | Tip | Açıklama |
|---|---|---|
| id | INTEGER PK | |
| valid_year | INTEGER | Bu oranın geçerli olduğu yıl |
| tto_share_rate | DECIMAL | Örn. 0.15 (%15) |
| withholding_rate | DECIMAL | Örn. 0.20 (%20 stopaj → kalan %80 ödenir) |

### 5.6 `users` (Uygulama Kullanıcıları)
| Alan | Tip | Açıklama |
|---|---|---|
| id | INTEGER PK | |
| username | TEXT, unique | |
| password_hash | TEXT | bcrypt |
| full_name | TEXT | |
| created_at | DATETIME | |

## 6. Hesaplama Mantığı

Kullanıcı tercihi: **hesaplamalar otomatik yapılsın, ama satır bazında elle düzeltilebilsin.**

- `amount_after_tto_share` (TTO payı kesildikten sonra) varsayılan olarak şu şekilde hesaplanır:
  `amount_after_tto_share = invoice_price - (invoice_price * settings.tto_share_rate)`
  (2026 kayıtlarında `tto_share_amount` ayrı girildiyse, oradan da türetilebilir; iki değer birbirini doğrulamak için karşılaştırılabilir.)
- `amount_after_withholding` (stopaj sonrası, akademisyene ödenecek net tutar) varsayılan olarak:
  `amount_after_withholding = amount_after_tto_share * (1 - settings.withholding_rate)`
  (Örn. Excel'deki `=J18*0,8` formülü, %20 stopaj kesintisinden sonra kalan %80'i gösteriyor.)
- Kullanıcı arayüzde bu iki alanı **her zaman elle değiştirebilmeli** — form, hesaplanan değeri "öneri" olarak dolduracak ama kilitlemeyecek. Elle değiştirilen bir değer varsa, kayıtta bu açıkça işaretlenir (ör. `is_manually_adjusted` alanı eklenebilir — opsiyonel, ileride eklenebilir).
- Oranlar (`tto_share_rate`, `withholding_rate`) sabit kod içine gömülmez; `settings` tablosunda, yıla göre tutulur — çünkü oranlar zamanla değişebilir.

## 7. Uygulama Sayfaları / Özellikler (MVP)

1. **Giriş ekranı** — kullanıcı adı / şifre.
2. **Kayıt listesi (ana sayfa)** — tüm `work_records`, filtrelenebilir (yıl, firma, akademisyen, ödeme durumu), aranabilir, sıralanabilir. Excel'deki tabloya en yakın görünüm.
3. **Yeni kayıt ekleme / kayıt düzenleme formu** — firma, akademisyen ve proje alanları için otomatik tamamlama (var olan kayıttan seç ya da yeni ekle); fatura/vergi/tutar alanları; hesaplanan tutarlar otomatik dolar, elle değiştirilebilir.
4. **Akademisyen detay sayfası** — bir akademisyene tıklanınca: o kişiye ait tüm `work_records` kayıtları (firma, iş, tarih, tutar, durum), toplam kazanılan/ödenen tutar özeti, ödenmemiş kayıtlar vurgusu.
5. **Firma detay sayfası** (opsiyonel, kolay eklenebilir) — bir firmaya tıklanınca o firmayla yapılan tüm işler.
6. **Ayarlar sayfası** — TTO payı oranı, stopaj oranı gibi değerlerin yıl bazında düzenlenmesi.
7. **Excel'den içe aktarma aracı** — bir kerelik, `scripts/excel_import.py` ile mevcut Excel verisini veritabanına aktarma (komut satırından çalıştırılır, UI'da olması şart değil).

## 8. Klasör Yapısı

```
tto-otomasyon/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI giriş noktası, frontend build'ini de serve eder
│   │   ├── database.py            # SQLAlchemy engine/session, SQLite WAL ayarı
│   │   ├── models.py              # SQLAlchemy modelleri (firms, academicians, projects, work_records, settings, users)
│   │   ├── schemas.py             # Pydantic şemaları (request/response)
│   │   ├── auth.py                # Basit login / token doğrulama
│   │   ├── routers/
│   │   │   ├── firms.py
│   │   │   ├── academicians.py
│   │   │   ├── projects.py
│   │   │   ├── records.py         # work_records CRUD + hesaplama mantığı
│   │   │   └── settings.py
│   │   └── core/
│   │       ├── config.py
│   │       └── calculations.py    # TTO payı / stopaj hesaplama fonksiyonları
│   ├── requirements.txt
│   ├── alembic/                   # DB migration'ları
│   └── data/
│       └── tto.db                 # SQLite veritabanı dosyası (git'e eklenmez)
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── RecordsList.jsx
│   │   │   ├── RecordForm.jsx
│   │   │   ├── AcademicianDetail.jsx
│   │   │   ├── FirmDetail.jsx
│   │   │   └── Settings.jsx
│   │   ├── components/
│   │   ├── api/                   # backend'e istek atan yardımcı fonksiyonlar
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── scripts/
│   └── excel_import.py            # Mevcut Excel'i (2025 + 2026 sekmeleri) veritabanına aktarır
├── docs/
│   └── ARCHITECTURE.md            # Bu dosyanın bir kopyası / güncel hâli
├── .gitignore
└── README.md                      # Kurulum ve çalıştırma talimatları
```

## 9. Kurulum ve Çalıştırma (Sunucu Bilgisayarda)

1. Backend bağımlılıkları kurulur (`pip install -r requirements.txt`), veritabanı migration'ları çalıştırılır (Alembic).
2. Frontend `npm run build` ile derlenir, çıktısı backend'in serve ettiği statik klasöre kopyalanır (tek uygulama, tek port).
3. Uygulama `uvicorn app.main:app --host 0.0.0.0 --port 8000` ile başlatılır (`0.0.0.0` sayesinde yerel ağdaki diğer bilgisayar da erişebilir).
4. Windows'ta bu komutun bilgisayar açıldığında otomatik çalışması için NSSM (uygulamayı Windows servisi yapar) veya Görev Zamanlayıcı kullanılır.
5. Windows Güvenlik Duvarı'nda 8000 portu için **yalnızca yerel ağdan** gelen bağlantılara izin verilir (dışarıya kapalı kalması için router/modem üzerinde port yönlendirmesi yapılmaz).
6. İkinci bilgisayardan uygulamaya ulaşmak için **öncelikle sunucu bilgisayarın Windows ağ adı** kullanılmalı: `http://<sunucu-bilgisayar-adi>:8000` (Windows'un NetBIOS/mDNS özelliği sayesinde, IP değişse bile bu adres çalışmaya devam eder). Yedek/garanti önlem olarak router üzerinden bu bilgisayara **DHCP Reservation** (MAC adresine göre sabit IP ataması) da yapılmalı — bkz. Bölüm 13.

## 10. Excel'den Veri Aktarımı

- `scripts/excel_import.py`, mevcut Excel dosyasını (2025 sarı başlıklı sekme + 2026 gri başlıklı sekme) okur.
- Firma ve akademisyen isimlerini normalize ederek `firms` / `academicians` tablolarına tekilleştirilmiş şekilde ekler (aynı isim birden fazla satırda geçiyorsa tek kayıt oluşturur).
- Her satırı `work_records` tablosuna, `year` alanına göre (2025/2026) ilgili sütun eşlemesiyle aktarır.
- Aktarım sonrası bir özet rapor (kaç satır aktarıldı, hatalı/eksik satır var mı) konsola yazdırılır.
- Bu script **bir kerelik** çalıştırılır; sonrasında tüm veri girişi doğrudan uygulama üzerinden yapılır.

## 11. Güvenlik ve Erişim

- Uygulama internete açılmaz; sadece yerel ağda (LAN) çalışır.
- Basit kullanıcı adı/şifre girişi zorunlu (herkese açık olmaması isteniyor).
- Şifreler veritabanında düz metin değil, hash'lenmiş (bcrypt) tutulur.
- Düzenli otomatik yedekleme: `data/tto.db` dosyasının günlük/haftalık olarak başka bir klasöre (ör. bulut senkronize bir klasöre ya da harici diske) kopyalanması önerilir — basit bir zamanlanmış görevle otomatikleştirilebilir.

## 12. Geliştirme Fazları

**Faz 1 (MVP):**
- Veritabanı ve modellerin kurulması
- Excel içe aktarma script'i
- Kayıt listesi, yeni kayıt ekleme/düzenleme formu
- Akademisyen detay sayfası
- Basit giriş ekranı

**Faz 2:**
- Firma detay sayfası
- Filtreleme/arama geliştirmeleri (tarih aralığı, ödeme durumu vb.)
- Ayarlar sayfası (oran yönetimi)
- Dashboard / özet istatistikler (toplam ödenen, bekleyen tutar vb.)

**Faz 3 (ileride):**
- Raporlama / Excel'e dışa aktarma
- Bildirim/hatırlatma (ödenmemiş kayıtlar için)
- Kullanıcı bazlı yetkilendirme (ör. sadece görüntüleme vs. düzenleme yetkisi)

## 13. Bilinen Riskler ve Çözümleri

Bu mimarinin (LAN client-server + SQLite) doğası gereği taşıdığı 3 risk ve alınacak önlemler:

### 13.1 Statik IP Bağımlılığı
- **Risk:** Sunucu bilgisayarın yerel IP'si DHCP ile otomatik atanıyorsa, bilgisayar her yeniden başladığında IP değişebilir ve diğer bilgisayar bağlanamaz hâle gelir.
- **Ana çözüm:** Frontend'de ve dokümantasyonda IP yerine **Windows bilgisayar adı** kullanılmalı: `http://<sunucu-bilgisayar-adi>:8000`. Windows'un NetBIOS/mDNS özelliği sayesinde bu adres, IP değişse bile çalışmaya devam eder — ekstra ayar gerektirmez.
- **Ek güvence:** Router/modem arayüzünden sunucu bilgisayarın MAC adresine göre **DHCP Reservation** (sabit IP ataması) yapılmalı. Bu, hem hostname çözümlemesi bir sebeple çalışmazsa yedek olur hem de ağ yöneticisi (router) tarafında merkezi ve güvenilir bir sabitleme sağlar (bilgisayarın kendi ağ ayarından elle sabitlemekten daha az hataya açıktır).
- **README'ye eklenmesi gereken not:** Kurulum sonrası hem hostname hem de (varsa) sabit IP ile bağlantı test edilmeli.

### 13.2 Sunucu Bilgisayarın Açık Kalma Zorunluluğu
- **Risk:** Sistem yerel ağda çalıştığı için, sunucu bilgisayar kapalıyken diğer bilgisayar erişemez.
- **Öneri:** Sunucu rolü, günlük kullanılan bir çalışma bilgisayarına değil, mümkünse **ayrı ve sürekli açık kalan bir cihaza** verilmeli (ör. ucuz bir mini PC/NUC, ya da ofiste zaten sürekli açık duran eski bir masaüstü). Bu, hem "biri erken çıkarsa diğeri çalışamaz" riskini ortadan kaldırır hem de günlük kullanım (yeniden başlatma, uyku moduna geçme vb.) kaynaklı kesintileri azaltır.
- **Asgari önlem (ayrı cihaz mümkün değilse):** Sunucu bilgisayarda güç ayarlarından "uyku moduna geçme" kapatılmalı, ve hangi bilgisayarın sunucu olduğu, mesai boyunca kapatılmayacağı açıkça kararlaştırılmalı.

### 13.3 Tek Dosyalı Veritabanı (SQLite) Yedekleme Disiplini
- **Risk:** Tüm veri tek bir `tto.db` dosyasında tutulduğu için, bu dosyanın kaybolması/bozulması tüm veriyi riske atar.
- **Çözüm — 3 katmanlı otomatik yedekleme:**
  1. **Günlük otomatik yedek:** Windows Görev Zamanlayıcı ile günde bir kez (ör. mesai sonunda) çalışan bir script, veritabanının yedeğini alır. Ham dosya kopyalama yerine **SQLite'ın kendi backup mekanizması** kullanılmalı (ör. `sqlite3 tto.db ".backup yedek.db"` komutu ya da SQLAlchemy/Python üzerinden eşdeğeri) — çünkü uygulama o an dosyaya yazıyor olabilir, ham kopyalama yarım/bozuk bir yedek üretebilir.
  2. **Yedek rotasyonu:** Son 30 günün yedekleri tutulur, daha eskiler otomatik silinir.
  3. **Ofsite/bulut kopya:** Yedek dosyası ayrıca bilgisayardaki bir bulut-senkronize klasöre (OneDrive/Google Drive vb.) de kopyalanmalı — böylece sunucu bilgisayar arızalansa/çalınsa bile veri kaybolmaz.
- **Bu script, `scripts/backup_db.py` (veya `.ps1`) olarak projeye eklenmeli** ve README'de kurulum adımlarına dahil edilmeli.

---

*Bu doküman, TTO Otomasyonu projesinin Antigravity üzerinde geliştirilmesi için hazırlanmış teknik şartnamedir. Uygulama geliştirilirken yukarıdaki mimari, veri modeli, klasör yapısı ve risk/çözüm listesi temel alınmalıdır.*
