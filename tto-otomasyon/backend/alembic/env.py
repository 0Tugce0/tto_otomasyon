"""
Alembic env.py — migration ortamı yapılandırması.

Önemli kararlar:
  - render_as_batch=True: SQLite'ın sınırlı ALTER TABLE desteği için.
    Sütun/constraint değişikliklerini "tablo yeniden oluştur" yöntemiyle uygular.
    database.py'deki naming_convention ile birlikte çalışır.
  - DATABASE_URL ve Base.metadata doğrudan app.database'den import edilir
    — alembic.ini'deki sqlalchemy.url geçersiz kılınır; tek kaynak of truth.
  - sys.path: backend/ dizini eklenerek `app.*` import'ları çalışır.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# ---------------------------------------------------------------------------
# sys.path: backend/ dizinini ekle — app.database, app.models import edilebilsin
# ---------------------------------------------------------------------------
# Bu dosya: backend/alembic/env.py → parent → backend/
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

# ---------------------------------------------------------------------------
# App modüllerini import et
# ---------------------------------------------------------------------------
# models.py'nin import edilmesi zorunlu — aksi hâlde autogenerate tabloları göremez.
from app.database import Base, DATABASE_URL  # noqa: E402
import app.models  # noqa: F401, E402  — tüm modellerin Base.metadata'ya kayıt olması için

# ---------------------------------------------------------------------------
# Alembic Config nesnesi — alembic.ini'ye erişim sağlar
# ---------------------------------------------------------------------------
config = context.config

# Logging yapılandırması (alembic.ini'den)
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# DATABASE_URL'yi app.database'den alarak alembic.ini'yi geçersiz kıl
config.set_main_option("sqlalchemy.url", str(DATABASE_URL))

# Autogenerate için hedef metadata
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Offline migration (--sql modunda, gerçek DB bağlantısı olmadan)
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """SQL script üret, DB'ye bağlanmadan migration çalıştır."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # SQLite ALTER TABLE için batch mode
    )
    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# Online migration (gerçek DB bağlantısıyla — normal kullanım)
# ---------------------------------------------------------------------------
def run_migrations_online() -> None:
    """DB'ye bağlanarak migration uygula."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # Migration için bağlantı havuzu gerekmiyor
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,       # SQLite batch mode — ALTER TABLE desteği
            compare_type=True,          # Sütun tipi değişikliklerini de algıla
            compare_server_default=True,  # Server default değişikliklerini algıla
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
