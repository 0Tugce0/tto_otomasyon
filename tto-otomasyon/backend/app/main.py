"""
main.py — FastAPI uygulama giriş noktası.

Şartname madde 3:
  Backend hem API'yi hem derlenmiş React arayüzünü tek port'tan (8000) servis eder.

Şartname madde 9:
  uvicorn app.main:app --host 0.0.0.0 --port 8000

Onaylanan kararlar:
  - Auth: HttpOnly session cookie (Starlette SessionMiddleware + itsdangerous)
  - CORS: sadece DEBUG=True modunda (Vite dev server → localhost:5173)
  - StaticFiles: app.mount() KULLANILMIYOR — catch-all route ile SPA fallback sağlanıyor (adım 10)
  - Health endpoint: /api/health (auth gerektirmez)

SPA Fallback Stratejisi (adım 10):
  app.mount("/", StaticFiles(html=True)) nested React path'lerini (/academicians/5 gibi)
  404 ile döndürdüğü için kullanılmıyor. Bunun yerine:
    1. /api/* route'ları önce (include_router ile) tanımlanıyor.
    2. /{full_path:path} catch-all route en sona ekleniyor:
       - Dosya mevcutsa        → FileResponse (CSS, JS, asset'ler)
       - Uzantısız path        → index.html (React route)
       - Uzantılı + yok       → 404 (gerçek asset isteği başarısız — /foo.js gibi)
    Bu sıralama sayesinde /api/* hiçbir zaman catch-all'a düşmez.
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import settings
from app.routers import academicians, firms, projects, records
from app.routers import settings as settings_router
from app.routers import auth as auth_router

# ---------------------------------------------------------------------------
# Statik dosyaların konumu (B-4: vite outDir → backend/app/static)
# ---------------------------------------------------------------------------
_STATIC_DIR = Path(__file__).resolve().parent / "static"

# Uzantısı olan ama React route OLMAYAN (gerçek asset) uzantı listesi.
# Bu uzantılarla gelen bir istek için dosya bulunamazsa → 404 döner (index.html değil).
_ASSET_EXTENSIONS = {
    ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".eot", ".map", ".webmanifest",
    ".webp", ".avif", ".txt",
}

# ---------------------------------------------------------------------------
# FastAPI uygulaması
# ---------------------------------------------------------------------------
app = FastAPI(
    title="TTO Otomasyonu",
    description=(
        "TTO Yapılan İşler ve Ödemeler — yerel ağda (LAN) çalışan yönetim sistemi.\n\n"
        "Şartname: tto-otomasyon-plan.md"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# Middleware'ler — SIRA ÖNEMLİ (önce eklenen en dışta çalışır)
# ---------------------------------------------------------------------------

# 1. Session middleware — HttpOnly imzalı cookie
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    session_cookie="tto_session",
    https_only=False,   # LAN'da HTTP kullanılıyor (şartname madde 2)
    same_site="lax",
    max_age=settings.SESSION_MAX_AGE_HOURS * 3600,  # saniye (varsayılan: 8 saat)
)

# 2. CORS — SADECE development modunda (DEBUG=True).
# Production'da React build aynı origin'den servis edilir → CORS gereksiz.
if settings.DEBUG:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,   # ["http://localhost:5173"]
        allow_credentials=True,                # Session cookie için zorunlu
        allow_methods=["*"],
        allow_headers=["*"],
    )

# ---------------------------------------------------------------------------
# API Router'ları — /api/* prefix'i altında, catch-all'dan ÖNCE tanımlanmalı
# ---------------------------------------------------------------------------

# Auth (login / logout / me)
app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])

# İş kayıtları (şartname 7.2, 7.3)
app.include_router(records.router, prefix="/api/records", tags=["records"])

# Akademisyenler + detay (şartname 7.4)
app.include_router(academicians.router, prefix="/api/academicians", tags=["academicians"])

# Firmalar (şartname 7.5)
app.include_router(firms.router, prefix="/api/firms", tags=["firms"])

# Projeler (2026+)
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])

# Ayarlar — TTO payı ve stopaj oranları (şartname 7.6)
app.include_router(settings_router.router, prefix="/api/settings", tags=["settings"])

# ---------------------------------------------------------------------------
# Health endpoint — auth gerektirmez, servis kontrolü için
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["system"], summary="Servis sağlık kontrolü")
def health_check():
    """Auth gerektirmeyen basit sağlık kontrolü. 200 → servis ayakta."""
    return {"status": "ok", "service": "tto-otomasyon"}


# ---------------------------------------------------------------------------
# SPA Fallback — production build'ını servis eder (adım 10)
#
# Bu route tüm /api/* route'larından SONRA tanımlanıyor.
# FastAPI route'ları sırayla kontrol ettiğinden /api/* istekleri
# hiçbir zaman buraya düşmez.
#
# Mantık:
#   1. Dosya static/ altında fiziksel olarak varsa → FileResponse (assets)
#   2. Path'in uzantısı _ASSET_EXTENSIONS içindeyse ama dosya yoksa → 404
#      (örn. /nonexistent-asset.js: gerçek asset isteği, dosya yok)
#   3. Uzantısız path → React route → index.html
#      (örn. /academicians/5, /settings, / kökü)
# ---------------------------------------------------------------------------
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_fallback(full_path: str):
    # Frontend build yoksa → açıklayıcı hata
    index_html = _STATIC_DIR / "index.html"
    if not index_html.is_file():
        raise HTTPException(
            status_code=503,
            detail="Frontend build bulunamadı. 'npm run build' çalıştırın.",
        )

    # 1. Dosya fiziksel olarak mevcut mu? (CSS, JS, resim, favicon vs.)
    candidate = _STATIC_DIR / full_path
    if candidate.is_file():
        return FileResponse(candidate)

    # 2. Asset uzantısı var ama dosya yok → gerçek 404
    #    (/nonexistent-asset.js gibi hatalı asset isteklerini index.html'e yönlendirme)
    suffix = Path(full_path).suffix.lower()
    if suffix in _ASSET_EXTENSIONS:
        raise HTTPException(status_code=404, detail=f"Dosya bulunamadı: /{full_path}")

    # 3. Uzantısız path → React client-side route → index.html dön
    #    React Router tarayıcıda doğru sayfayı render eder.
    return FileResponse(index_html)
