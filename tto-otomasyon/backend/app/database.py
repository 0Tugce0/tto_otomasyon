"""
database.py — SQLAlchemy engine/session yapılandırması.

Şartname madde 3:
  Veritabanı tek bir SQLite dosyasıdır (data/tto.db), WAL modunda çalışır.

Şartname madde 4 (teknoloji):
  SQLAlchemy ORM + Alembic migration.

Kararlar (onaylandı):
  - WAL modu: engine event hook ile her bağlantıda PRAGMA journal_mode=WAL
    ve PRAGMA foreign_keys=ON ayarlanır.
  - check_same_thread=False: FastAPI'nin async/threaded yapısı için gerekli.
  - Yol: pathlib.Path ile platform bağımsız (Mac/Windows uyumlu).
"""

from pathlib import Path
from sqlalchemy import MetaData, create_engine, event, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# ---------------------------------------------------------------------------
# Yol — platform bağımsız (Mac / Windows uyumlu)
# ---------------------------------------------------------------------------
# Bu dosyanın konumu: backend/app/database.py
# DB dosyası:         backend/data/tto.db
_BASE_DIR = Path(__file__).resolve().parent.parent  # → backend/
_DATA_DIR = _BASE_DIR / "data"
_DATA_DIR.mkdir(exist_ok=True)  # data/ klasörü yoksa oluştur
DATABASE_PATH = _DATA_DIR / "tto.db"

DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
engine = create_engine(
    DATABASE_URL,
    connect_args={
        "check_same_thread": False,  # FastAPI multi-thread erişimi için
    },
    # echo=True,  # Geliştirme sırasında SQL logları için açılabilir
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, connection_record):
    """Her yeni SQLite bağlantısında WAL modu ve FK desteğini etkinleştirir.

    connect_args ile değil, event hook ile ayarlanır — böylece Alembic
    migration bağlantıları dahil HER bağlantı bu ayarları alır.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")   # Write-Ahead Logging
    cursor.execute("PRAGMA foreign_keys=ON")    # FK kısıtları aktif
    cursor.execute("PRAGMA synchronous=NORMAL") # WAL ile güvenli, daha hızlı
    cursor.close()


# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ---------------------------------------------------------------------------
# Naming convention — Alembic batch mode için constraint isimlerini
# öngörülebilir kılar (SQLite ALTER TABLE sınırlı destek).
# Adım 6 notu: render_as_batch=True ile birlikte çalışır.
# ---------------------------------------------------------------------------
_NAMING_CONVENTION: dict = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


# ---------------------------------------------------------------------------
# Declarative base — tüm SQLAlchemy modelleri bunu miras alır
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=_NAMING_CONVENTION)


# ---------------------------------------------------------------------------
# FastAPI dependency: istek başına DB session
# ---------------------------------------------------------------------------
def get_db():
    """FastAPI endpoint'lerinde `Depends(get_db)` ile kullanılır."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
