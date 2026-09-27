# Windows Sunucu Kurulum Rehberi — TTO Otomasyonu

> **Durum:** Bu belge planlama aşamasındadır. Gerçek Windows sunucu
> temin edildiğinde uygulanacaktır. Mac geliştirme ortamında test
> edilmemiştir; komutlar Windows komut satırı (cmd) ve PowerShell
> sözdiziminde verilmiştir.

---

## İçindekiler

1. [Ön Koşullar](#1-ön-koşullar)
2. [Proje Dosyalarını Sunucuya Taşıma](#2-proje-dosyalarını-sunucuya-taşıma)
3. [Backend Kurulumu](#3-backend-kurulumu)
4. [Frontend Build](#4-frontend-build)
5. [NSSM ile Windows Servisi Kurma](#5-nssm-ile-windows-servisi-kurma)
6. [Windows Güvenlik Duvarı Kuralı](#6-windows-güvenlik-duvarı-kuralı)
7. [Servis Durumu Kontrolü](#7-servis-durumu-kontrolü)
8. [Güncelleme Senaryosu](#8-güncelleme-senaryosu)
9. [Sorun Giderme](#9-sorun-giderme)

---

## 1. Ön Koşullar

Sunucuda aşağıdakiler kurulu olmalıdır. Kurulum sırasında **"Add to PATH"**
seçeneğini işaretleyin.

### Python 3.12

- İndirme: https://www.python.org/downloads/windows/
- Önerilen: `python-3.12.x-amd64.exe` (64-bit)
- Kurulum sırasında **"Add Python to PATH"** kutucuğunu işaretleyin.
- Doğrulama:
  ```cmd
  python --version
  ```
  → `Python 3.12.x` çıktısı beklenir.

### Node.js LTS

- İndirme: https://nodejs.org/en/download (LTS sürümü — 20.x veya üstü)
- Kurulum sırasında "Automatically install the necessary tools" seçeneğini
  işaretleyin.
- Doğrulama:
  ```cmd
  node --version
  npm --version
  ```

### Git (opsiyonel — ZIP ile taşıyorsanız gerekmez)

- İndirme: https://git-scm.com/download/win
- "Git Bash Here" ve "Git from the command line" seçeneklerini işaretleyin.

### NSSM (Non-Sucking Service Manager)

- İndirme: https://nssm.cc/download
- `nssm-2.24.zip` (veya güncel sürüm) indirin.
- `nssm.exe` dosyasını `C:\nssm\` klasörüne çıkarın.
- Bu klasörü sistem `PATH`'ine ekleyin:
  - Denetim Masası → Sistem → Gelişmiş sistem ayarları → Ortam Değişkenleri
  - `Path` değişkenine `C:\nssm\win64\` ekleyin.
- Doğrulama:
  ```cmd
  nssm version
  ```

> **Not:** NSSM yerine Windows Task Scheduler da kullanılabilir, ancak NSSM
> otomatik yeniden başlatma ve log yönlendirmesi için daha uygundur.

---

## 2. Proje Dosyalarını Sunucuya Taşıma

### Yöntem A — Git Clone (önerilen, güncellemeler için kolaylık sağlar)

```cmd
cd C:\
git clone https://github.com/KULLANICI/tto-otomasyon.git
cd tto-otomasyon
```

### Yöntem B — ZIP ile manuel taşıma

1. Geliştirme makinesinde `.gitignore`'a göre hassas dosyaları **dışarıda
   bırakarak** proje kök klasörünü ZIP'leyin:
   - `venv/` dahil etmeyin (sunucuda yeniden oluşturulacak)
   - `backend/data/source/` dahil etmeyin (Excel kaynak dosyaları)
   - `backend/data/tto.db` dahil etmeyin (varsa mevcut DB — ayrıca aktarın)
   - `node_modules/` dahil etmeyin
2. ZIP'i sunucuya kopyalayın (USB, paylaşımlı klasör veya SCP).
3. `C:\tto-otomasyon\` altına açın.

> **DB Aktarımı:** Geliştirme makinesindeki `backend/data/tto.db` dosyasını
> sunucuya ayrıca kopyalayın. WAL dosyaları (`tto.db-wal`, `tto.db-shm`)
> varsa önce WAL checkpoint yapın:
> ```cmd
> sqlite3 backend\data\tto.db "PRAGMA wal_checkpoint(FULL);"
> ```
> Ardından yalnızca `tto.db` dosyasını kopyalayın.

---

## 3. Backend Kurulumu

Tüm komutları `C:\tto-otomasyon\backend\` dizininde çalıştırın.

```cmd
cd C:\tto-otomasyon\backend
```

### 3.1 Sanal ortam oluşturma

```cmd
python -m venv venv
```

### 3.2 Bağımlılıkları yükleme

```cmd
venv\Scripts\pip install -r requirements.txt
```

### 3.3 Ortam değişkenlerini ayarlama

`backend\.env` dosyasını oluşturun (örnek `backend\.env.example`'dan kopyalayın):

```
SECRET_KEY=guclu-ve-benzersiz-bir-anahtar-buraya-yazin
DEBUG=false
DATABASE_URL=sqlite:///./data/tto.db
SESSION_MAX_AGE_HOURS=8
```

> **Önemli:** `SECRET_KEY` değerini geliştirme ortamından FARKLI bir değere
> ayarlayın. Güçlü bir anahtar üretmek için:
> ```cmd
> venv\Scripts\python -c "import secrets; print(secrets.token_hex(32))"
> ```

### 3.4 Veri dizini

`backend\data\` klasörünü oluşturun (yoksa):

```cmd
mkdir backend\data
```

`tto.db` dosyasını buraya kopyalayın (adım 2'deki aktarım).
Eğer sıfırdan başlıyorsanız bir sonraki adım DB'yi oluşturacak.

### 3.5 Veritabanı migration

```cmd
venv\Scripts\alembic upgrade head
```

Beklenen çıktı:
```
INFO  [alembic.runtime.migration] Running upgrade  -> <revision>, Initial migration
```

Doğrulama:
```cmd
venv\Scripts\alembic current
```
→ `(head)` çıktısı beklenir.

### 3.6 İlk admin kullanıcısı (sıfırdan başlıyorsanız)

```cmd
venv\Scripts\python ..\scripts\create_admin_user.py
```

Komut kullanıcı adı ve şifre soracaktır. Excel import için:

```cmd
venv\Scripts\python ..\scripts\excel_import.py
```

---

## 4. Frontend Build

```cmd
cd C:\tto-otomasyon\frontend
npm install
npm run build
```

Build çıktısı otomatik olarak `backend\app\static\` dizinine yazılır
(`vite.config.js`'teki `outDir` ayarı gereği).

Doğrulama — `backend\app\static\index.html` dosyasının oluştuğunu kontrol edin:

```cmd
dir ..\backend\app\static\
```

---

## 5. NSSM ile Windows Servisi Kurma

> **Yönetici yetkisi gereklidir.** Komut istemini (cmd) sağ tıklayıp
> "Yönetici olarak çalıştır" ile açın.

### 5.1 Servisi kaydet

```cmd
nssm install TTOOtomasyon
```

Bu komut bir GUI penceresi açacaktır. Alternatif olarak tamamen komut satırından:

```cmd
nssm install TTOOtomasyon "C:\tto-otomasyon\backend\venv\Scripts\python.exe" "-m uvicorn app.main:app --host 0.0.0.0 --port 8000"
```

### 5.2 Çalışma dizini

```cmd
nssm set TTOOtomasyon AppDirectory "C:\tto-otomasyon\backend"
```

### 5.3 Log dosyaları

```cmd
nssm set TTOOtomasyon AppStdout "C:\tto-otomasyon\logs\tto_stdout.log"
nssm set TTOOtomasyon AppStderr "C:\tto-otomasyon\logs\tto_stderr.log"
nssm set TTOOtomasyon AppRotateFiles 1
nssm set TTOOtomasyon AppRotateBytes 10485760
```

Log klasörünü oluşturun:

```cmd
mkdir C:\tto-otomasyon\logs
```

### 5.4 Ortam değişkenleri (servis kapsamında)

```cmd
nssm set TTOOtomasyon AppEnvironmentExtra "PYTHONUNBUFFERED=1"
```

Uvicorn loglarının anlık yazılması için `PYTHONUNBUFFERED=1` gereklidir.

### 5.5 Otomatik başlatma (Windows açılışında)

```cmd
nssm set TTOOtomasyon Start SERVICE_AUTO_START
```

### 5.6 Servisi başlat

```cmd
nssm start TTOOtomasyon
```

### 5.7 Doğrulama

```cmd
nssm status TTOOtomasyon
```
→ `SERVICE_RUNNING` çıktısı beklenir.

Tarayıcıdan kontrol: `http://localhost:8000/api/health`
→ `{"status":"ok","service":"tto-otomasyon"}` beklenir.

---

## 6. Windows Güvenlik Duvarı Kuralı

> **Amaç:** 8000 portuna sadece yerel ağdan (LAN) erişime izin vermek,
> internetten erişimi engellemek.

### 6.1 PowerShell ile kural ekleme

```powershell
New-NetFirewallRule `
  -DisplayName "TTO Otomasyon - LAN" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 8000 `
  -RemoteAddress LocalSubnet `
  -Action Allow
```

`LocalSubnet`: Windows'un yerel ağı (örn. `192.168.1.0/24`) otomatik tanımasını sağlar.

### 6.2 Belirli bir subnet için (örnek)

```powershell
New-NetFirewallRule `
  -DisplayName "TTO Otomasyon - LAN 192.168.1.x" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 8000 `
  -RemoteAddress "192.168.1.0/24" `
  -Action Allow
```

Kendi ağ aralığınıza göre `192.168.1.0/24` değerini değiştirin.

### 6.3 Kuralı doğrulama

```powershell
Get-NetFirewallRule -DisplayName "TTO Otomasyon*" | Select-Object DisplayName, Enabled, Direction, Action
```

---

## 7. Servis Durumu Kontrolü

### Komut satırı

```cmd
nssm status TTOOtomasyon
```

Olası çıktılar:
| Çıktı | Anlamı |
|---|---|
| `SERVICE_RUNNING` | Servis çalışıyor ✓ |
| `SERVICE_STOPPED` | Servis durdu |
| `SERVICE_START_PENDING` | Başlatılıyor |

### Windows Hizmetler penceresi

1. `Win + R` → `services.msc` → Enter
2. Listede **TTOOtomasyon** servisini bulun.
3. Sağ tıklayıp Başlat / Durdur / Yeniden Başlat yapılabilir.

### API sağlık kontrolü

```cmd
curl http://localhost:8000/api/health
```

### Log kontrolü

```cmd
type C:\tto-otomasyon\logs\tto_stdout.log
type C:\tto-otomasyon\logs\tto_stderr.log
```

---

## 8. Güncelleme Senaryosu

Yeni kod geldiğinde (hata düzeltmesi veya yeni özellik):

### 8.1 Servisi durdur

```cmd
nssm stop TTOOtomasyon
```

### 8.2 Kodu güncelle

**Git ile:**
```cmd
cd C:\tto-otomasyon
git pull origin main
```

**Manuel ZIP ile:**
- Yeni ZIP'i aynı dizine açın (eski dosyaların üzerine yazın).
- `backend\data\tto.db` dosyasının üzerine yazılmadığından emin olun.

### 8.3 Bağımlılıkları güncelle (gerekirse)

```cmd
cd C:\tto-otomasyon\backend
venv\Scripts\pip install -r requirements.txt
```

### 8.4 Migration çalıştır

```cmd
venv\Scripts\alembic upgrade head
```

Migration yoksa (zaten `head`'deyse) bu komut sessizce tamamlanır.

### 8.5 Frontend'i yeniden build et (UI değiştiyse)

```cmd
cd C:\tto-otomasyon\frontend
npm install
npm run build
```

### 8.6 Servisi yeniden başlat

```cmd
nssm start TTOOtomasyon
```

### 8.7 Doğrulama

```cmd
nssm status TTOOtomasyon
curl http://localhost:8000/api/health
```

---

## 9. Sorun Giderme

### Servis başlamıyorsa

**Adım 1 — Log dosyalarını inceleyin:**
```cmd
type C:\tto-otomasyon\logs\tto_stderr.log
```

Sık karşılaşılan hatalar:

| Hata Mesajı | Olası Neden | Çözüm |
|---|---|---|
| `ModuleNotFoundError: No module named 'uvicorn'` | `pip install` tamamlanmadı | `venv\Scripts\pip install -r requirements.txt` tekrar çalıştırın |
| `ERROR: [Errno 98] Address already in use` | 8000 portu başka bir uygulama tarafından kullanılıyor | `netstat -ano \| findstr :8000` ile süreci bulun ve sonlandırın |
| `sqlalchemy.exc.OperationalError` | DB dosyası bulunamadı veya migration yapılmamış | `backend\data\tto.db` varlığını kontrol edin; `alembic upgrade head` çalıştırın |
| `SECRET_KEY` hatası / `KeyError` | `.env` dosyası eksik | `backend\.env` dosyasını oluşturun |

**Adım 2 — Servisi manuel çalıştırarak doğrulayın:**

Servisi önce durdurun, ardından doğrudan çalıştırın:

```cmd
nssm stop TTOOtomasyon
cd C:\tto-otomasyon\backend
venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Hata mesajı doğrudan konsolda görünecektir.

**Adım 3 — NSSM ayarlarını doğrulayın:**

```cmd
nssm dump TTOOtomasyon
```

Uygulama yolu ve çalışma dizininin doğru olduğunu kontrol edin.

---

### İkinci bilgisayar bağlanamıyorsa

1. **Sunucunun IP adresini öğrenin:**
   ```cmd
   ipconfig
   ```
   `IPv4 Address` satırını not edin (örn. `192.168.1.50`).

2. **İstemci bilgisayardan ping atın:**
   ```cmd
   ping 192.168.1.50
   ```
   Yanıt gelmiyorsa aynı ağda değilsiniz ya da ICMP engelleniyor.

3. **Güvenlik duvarı kuralını kontrol edin (sunucuda):**
   ```powershell
   Get-NetFirewallRule -DisplayName "TTO Otomasyon*"
   ```
   Kural yoksa adım 6'yı tekrar uygulayın.

4. **8000 portunu test edin (istemciden):**
   ```cmd
   curl http://192.168.1.50:8000/api/health
   ```

5. **Sunucudaki uvicorn'un `0.0.0.0`'da dinlediğini doğrulayın:**
   NSSM ayarında `--host 0.0.0.0` olmalıdır (`127.0.0.1` değil).
   ```cmd
   nssm dump TTOOtomasyon
   ```

---

### Migration hatası

```cmd
cd C:\tto-otomasyon\backend
venv\Scripts\alembic current
```

- **Hiçbir şey çıkmıyorsa:** `alembic upgrade head` çalıştırın.
- **"Target database is not up to date":** `alembic upgrade head` çalıştırın.
- **"Can't locate revision":** Migration dosyaları eksik. `alembic\versions\` klasörünü kontrol edin.

---

### Otomatik Yedekleme (Gelecek Adım)

> ⏳ `scripts/backup.py` henüz yazılmamıştır (Adım 15 kapsamında planlanmıştır).
>
> Geçici çözüm olarak, Windows Görev Zamanlayıcı ile her gece `tto.db` dosyasını
> kopyalayan bir `.bat` betiği kullanılabilir:
>
> ```bat
> @echo off
> set DATE=%date:~10,4%-%date:~4,2%-%date:~7,2%
> copy C:\tto-otomasyon\backend\data\tto.db C:\yedekler\tto_%DATE%.db
> ```

---

*Son güncelleme: Adım 15 — Windows servis kurulum planı*
