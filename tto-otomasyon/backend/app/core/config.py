"""
core/config.py — Uygulama yapılandırması.

pydantic-settings ile .env dosyasından okunur.
Varsayılan değerler development için geçerlidir; production'da
.env dosyasıyla veya ortam değişkenleriyle ezilmeli.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Starlette SessionMiddleware için imzalı cookie anahtarı.
    # Production'da mutlaka güçlü, rastgele bir değere değiştirilmeli.
    SECRET_KEY: str = "tto-dev-secret-key-change-in-production"

    # Development modunda CORS ve debug logları aktif.
    DEBUG: bool = True

    # CORS — sadece DEBUG=True iken etkin.
    # Frontend Vite dev server localhost:5173'te çalışır.
    # Production'da frontend zaten aynı origin'den (StaticFiles) servis edilir,
    # dolayısıyla production'da CORS gerekmez.
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Session süresi — saat cinsinden (varsayılan: 8 saat = 1 iş günü).
    # .env'de SESSION_MAX_AGE_HOURS=24 gibi override edilebilir.
    SESSION_MAX_AGE_HOURS: int = 8

    # "Beni Hatırla" işaretlenince kullanılan uzun oturum süresi — gün cinsinden.
    SESSION_REMEMBER_ME_DAYS: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",          # backend/ dizinindeki .env dosyası
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",           # .env'deki fazla anahtarları görmezden gel
    )


# Uygulama genelinde kullanılan tekil settings nesnesi.
settings = Settings()
