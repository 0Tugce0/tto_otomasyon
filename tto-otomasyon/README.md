# TTO Otomasyonu

Türkiye TTO (Teknoloji Transfer Ofisi) kapsamında gerçekleştirilen danışmanlık
işlerini ve akademisyen ödemelerini yönetmek için geliştirilmiş, **yerel ağda
(LAN)** çalışan web uygulaması.

- **Backend:** Python 3.12 + FastAPI + SQLite (WAL modu)
- **Frontend:** React 18 + Vite 6 + Tailwind CSS v4
- **Auth:** HttpOnly session cookie (bcrypt şifreleme)
- **Tek port:** API + frontend aynı süreçten (port 8000) servis edilir

---

## İçindekiler

1. [Gereksinimler](#1-gereksinimler)
2. [macOS — Geliştirme Ortamı](#2-macos--geliştirme-ortamı)
3. [Günlük Geliştirme](#3-günlük-geliştirme)
4. [Proje Yapısı](#4-proje-yapısı)
5. [Windows — Üretim Sunucu Kurulumu](#5-windows--üretim-sunucu-kurulumu)
6. [Veritabanı Yönetimi](#6-veritabanı-yönetimi)
7. [Sık Kullanılan Komutlar](#7-sık-kullanılan-komutlar)
8. [Bilinen Sınırlamalar / Henüz Yapılmayanlar](#8-bilinen-sınırlamalar--henüz-yapılmayanlar)
9. [Sorun Giderme](#9-sorun-giderme)

---

## 1. Gereksinimler

| Araç | Minimum | Not |
|---|---|---|
| Python | 3.12 | `python3.12 --version` ile kontrol et |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Git | herhangi | `git --version` |

---

## 2. macOS — Geliştirme Ortamı

### 2.1 Projeyi klonla / kurulum dizinine gir

```bash
cd /Users/tugce/Desktop/TTO/tto-otomasyon
```

### 2.2 Backend kurulumu

```bash
cd backend

# Python 3.12 sanal ortam oluştur
python3.12 -m venv venv

# Sanal ortamı etkinleştir
source venv/bin/activate

# Bağımlılıkları yükle (tüm sürümler pinlenmiş)
pip install -r requirements.txt

# Veritabanını oluştur ve migration'ları uygula
alembic upgrade head
```

> **Not:** `deactivate` komutu ile sanal ortamdan çıkılır.

### 2.3 Frontend kurulumu

```bash
cd ../frontend

# Node bağımlılıklarını yükle
npm install
```

### 2.4 İlk yönetici kullanıcısını oluştur

```bash
cd ../backend
source venv/bin/activate

python - << 'EOF'
import sys; sys.path.insert(0, ".")
from app.database import SessionLocal
from app.models import User
from app.auth import hash_password
from datetime import datetime

db = SessionLocal()
admin = User(
    username="admin",
    password_hash=hash_password("güçlü-şifre-buraya"),
    full_name="TTO Yönetici",
    created_at=datetime.utcnow(),
)
db.add(admin)
db.commit()
print(f"✓ Kullanıcı oluşturuldu: {admin.username} (id={admin.id})")
db.close()
EOF
```

---

## 3. Günlük Geliştirme

### Seçenek A — Ayrı terminaller (önerilen)

**Terminal 1 — Backend:**
```bash
cd /Users/tugce/Desktop/TTO/tto-otomasyon/backend
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```bash
cd /Users/tugce/Desktop/TTO/tto-otomasyon/frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger (API dökümantasyonu): http://localhost:8000/docs
- `/api/*` istekleri Vite proxy ile otomatik backend'e yönlendirilir (CORS gerektirmez)

### Seçenek B — Production build ile tek port

```bash
# Frontend'i derle (backend/app/static/'e yazılır)
cd frontend && npm run build

# Backend'i başlat (hem API hem frontend port 8000'den)
cd ../backend && source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

- Uygulama: http://localhost:8000

---

## 4. Proje Yapısı

```
tto-otomasyon/
├── backend/
│   ├── alembic/              # Migration dosyaları
│   │   └── versions/
│   ├── app/
│   │   ├── core/
│   │   │   ├── calculations.py  # Hesaplama zinciri (KDV, TTO payı, stopaj)
│   │   │   └── config.py        # Uygulama ayarları (.env'den okunur)
│   │   ├── routers/          # FastAPI router'ları (firms, records, vb.)
│   │   ├── static/           # Frontend production build (npm run build çıktısı)
│   │   ├── auth.py           # bcrypt hash + session dependency
│   │   ├── database.py       # SQLAlchemy engine + SessionLocal
│   │   ├── main.py           # FastAPI uygulaması + middleware + SPA routing
│   │   ├── models.py         # SQLAlchemy tabloları
│   │   └── schemas.py        # Pydantic request/response şemaları
│   ├── data/
│   │   ├── tto.db            # SQLite veritabanı (git'e eklenmez)
│   │   └── source/           # Kaynak Excel dosyaları (git'e eklenmez)
│   ├── alembic.ini
│   ├── requirements.txt      # Pinlenmiş Python bağımlılıkları
│   └── venv/                 # Python sanal ortam (git'e eklenmez)
├── frontend/
│   ├── src/
│   │   ├── pages/            # React sayfa bileşenleri
│   │   ├── components/       # Ortak bileşenler
│   │   ├── api/              # Backend API çağrıları
│   │   ├── App.jsx           # React Router tanımları
│   │   └── main.jsx          # React giriş noktası
│   ├── index.html
│   ├── package.json
│   └── vite.config.js        # Vite yapılandırması (outDir, proxy)
├── docs/
│   └── ARCHITECTURE.md       # Mimari kararlar ve notlar
├── scripts/
│   └── excel_import.py       # Tek seferlik Excel aktarım scripti (adım 13)
└── .gitignore
```

---

## 5. Windows — Üretim Sunucu Kurulumu

> 📖 **Detaylı adım adım rehber:** [`docs/WINDOWS_DEPLOYMENT.md`](docs/WINDOWS_DEPLOYMENT.md)
>
> Ön koşullar, NSSM servis kaydı, güvenlik duvarı kuralı, güncelleme senaryosu
> ve sorun giderme dahil kapsamlı kurulum talimatları için yukarıdaki dosyaya bakın.
> Aşağıda yalnızca özet verilmektedir.

### 5.1 Gereksinimler (Windows)

- Python 3.12 — https://python.org (kurulumda "Add to PATH" seçeneğini işaretle)
- Node.js 18+ — https://nodejs.org
- NSSM — https://nssm.cc (servis yönetimi için)

### 5.2 Kurulum adımları

```powershell
# 1. Projeyi sunucu bilgisayara kopyala (USB, ağ paylaşımı vb.)
# Hedef dizin örn: C:\tto-otomasyon

# 2. Backend kurulumu
cd C:\tto-otomasyon\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head

# 3. Frontend derle
cd ..\frontend
npm install
npm run build
# → backend\app\static\ klasörüne yazılır

# 4. İlk yönetici kullanıcısını oluştur (macOS 2.4 bölümüne bakın)
```

### 5.3 NSSM ile Windows Servisi

```powershell
# NSSM'i PATH'e ekle veya tam yoluyla kullan
nssm install TTO-Otomasyon "C:\tto-otomasyon\backend\venv\Scripts\uvicorn.exe"
nssm set TTO-Otomasyon AppParameters "app.main:app --host 0.0.0.0 --port 8000"
nssm set TTO-Otomasyon AppDirectory "C:\tto-otomasyon\backend"
nssm set TTO-Otomasyon DisplayName "TTO Otomasyonu"
nssm set TTO-Otomasyon Description "TTO Yapilan Isler ve Odemeler Web Uygulamasi"
nssm set TTO-Otomasyon Start SERVICE_AUTO_START
nssm start TTO-Otomasyon
```

### 5.4 Sağlık kontrolü

```powershell
# Servis ayaktaysa 200 + JSON döner
curl http://localhost:8000/api/health
# {"status":"ok","service":"tto-otomasyon"}
```

### 5.5 LAN'dan erişim

Sunucu bilgisayarın IP adresini öğren:
```powershell
ipconfig  # → "IPv4 Adresi" satırı, örn. 192.168.1.50
```

Ağdaki diğer bilgisayarlardan: `http://192.168.1.50:8000`

> **Güvenlik:** Windows Güvenlik Duvarı'nda 8000 portuna yerel ağdan
> (Private network) gelen bağlantılara izin ver.

---

## 6. Veritabanı Yönetimi

### Migration çalıştırma

```bash
cd backend && source venv/bin/activate  # macOS
# veya: venv\Scripts\activate           # Windows

alembic upgrade head        # Son migration'ı uygula
alembic history             # Migration geçmişini görüntüle
alembic current             # Mevcut versiyon
alembic downgrade -1        # Bir önceki versiyona geri dön
```

### Yedekleme

`backend/data/tto.db` dosyasını düzenli aralıklarla yedekle:

```bash
# Basit yedekleme örneği (tarihli kopya)
cp backend/data/tto.db "backend/data/tto_$(date +%Y%m%d).db"
```

Windows'ta Görev Zamanlayıcı ile otomatikleştirilebilir
(bkz. `docs/windows_server_setup.md`).

---

## 7. Sık Kullanılan Komutlar

| Komut | Açıklama |
|---|---|
| `uvicorn app.main:app --reload` | Backend geliştirme sunucusu (hot-reload) |
| `npm run dev` | Frontend geliştirme sunucusu |
| `npm run build` | Frontend production derlemesi |
| `alembic upgrade head` | Son migration'ı uygula |
| `alembic revision --autogenerate -m "açıklama"` | Yeni migration oluştur |
| `curl http://localhost:8000/api/health` | Servis sağlık kontrolü |

---

## Konfigürasyon (`.env`)

`backend/.env` dosyası oluşturarak varsayılan ayarları ezebilirsin:

```env
# Üretimde mutlaka değiştir (güçlü, rastgele bir değer kullan)
SECRET_KEY=cok-guclu-ve-rastgele-bir-deger

# Üretimde false yap (CORS ve debug loglarını kapatır)
DEBUG=false
```

> ⚠️ `.env` dosyası `.gitignore`'a eklenmiştir — git'e **eklenmez**.

---

## 8. Bilinen Sınırlamalar / Henüz Yapılmayanlar

Aşağıdaki özellikler planlanmış ancak henüz uygulanmamıştır.

| Özellik | Durum | Adım |
|---|---|---|
| **UI sayfaları + CRUD endpoint'leri** | ✅ Tamamlandı (Adım 14.1–14.4) | Adım 14 |
| **Hesaplama motoru (CRUD bağlantısı)** | ✅ `calculations.py` + `preview-calculation` endpoint bağlandı | Adım 14 |
| **Excel import script'i** | ✅ Tamamlandı, 83 kayıt aktarıldı | Adım 13 |
| **Windows servis (NSSM) kurulumu** | ⏳ Sadece planlandı ve dokümante edildi | Adım 15 |
| **Otomatik yedekleme script'i** | ⏳ Henüz yazılmadı | Adım 15 |

> **Not:** Hesaplama formülleri (KDV, tevkifat, TTO payı, stopaj) gerçek Excel
> dosyasındaki formüllerden doğrulanmıştır (bkz. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md))
> ve `POST /api/records/preview-calculation` endpoint'i aracılığıyla kayıt oluşturma/düzenleme
> formlarına entegre edilmiştir.


---

## 9. Sorun Giderme

### "Ağdaki diğer bilgisayar bağlanamıyor"

**Belirtiler:** `http://192.168.1.50:8000` adresine tarayıcıdan ulaşılamıyor.

**Kontrol listesi:**

```powershell
# 1. Sunucu IP'sini doğrula
ipconfig  # "IPv4 Adresi" satırını not al

# 2. Uvicorn'un 0.0.0.0 ile başlatıldığını doğrula (127.0.0.1 değil)
#    NSSM AppParameters içinde şunu ara:
#    app.main:app --host 0.0.0.0 --port 8000

# 3. Windows Güvenlik Duvarı — 8000 portuna izin ver
netsh advfirewall firewall add rule name="TTO Otomasyon" `
  dir=in action=allow protocol=tcp localport=8000

# 4. Servisin çalıştığını doğrula
curl http://localhost:8000/api/health
```

**Hâlâ bağlanamıyorsa:** Sunucu ve istemci aynı ağda mı? `ping 192.168.1.50`
ile temel bağlantıyı test et. Şirket ağlarında VLAN izolasyonu olabilir.

---

### "Migration hatası — tablo bulunamadı / şema uyuşmazlığı"

**Belirtiler:** `OperationalError: no such table: ...` veya `alembic upgrade head` hatası.

**Teşhis ve çözüm:**

```bash
cd backend
source venv/bin/activate   # macOS
# venv\Scripts\activate    # Windows

# 1. Mevcut durumu kontrol et
alembic current
# Beklenen: fab645720bcb (head)

# 2. Migration geçmişini gör
alembic history

# 3. Eksik migration'ları uygula
alembic upgrade head

# 4. Hâlâ hata varsa — DB'yi sıfırla (⚠️ TÜM VERİ SİLİNİR)
# rm data/tto.db
# alembic upgrade head
```

> ⚠️ `data/tto.db` silinirse **tüm veriler kaybolur**. Önce yedek al:
> `cp data/tto.db data/tto_yedek_$(date +%Y%m%d).db`

---

### "Uvicorn başlamıyor — port kullanımda"

```bash
# 8000 portunu kullanan süreci bul ve durdur
lsof -i :8000          # macOS
netstat -ano | findstr :8000  # Windows

# macOS — süreci sonlandır (PID'i yukarıdan al)
kill -9 <PID>
```

---

### "npm run build sonrası backend static dosyaları görmüyor"

```bash
# frontend/vite.config.js'de outDir doğru mu?
cat frontend/vite.config.js | grep outDir
# Beklenen: '../backend/app/static'

# Dosyalar oluştu mu?
ls backend/app/static/
# index.html ve assets/ klasörü olmalı
```
