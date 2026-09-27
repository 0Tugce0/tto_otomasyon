#!/usr/bin/env python3
"""
scripts/create_admin_user.py — TTO Otomasyonu ilk kullanıcı oluşturma

Kullanım:
    backend/venv/bin/python scripts/create_admin_user.py

Kullanıcı adını ve şifreyi interaktif olarak sorar.
Şifre terminal'de görünmez (getpass). Bcrypt ile hash'leyip
users tablosuna ekler.
"""

from __future__ import annotations

import sys
from getpass import getpass
from pathlib import Path
from datetime import datetime, timezone

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy.exc import IntegrityError
from app.database import SessionLocal
from app.models import User
from app.auth import hash_password


def main() -> None:
    print("=" * 50)
    print("TTO Otomasyonu — Kullanıcı Oluşturma")
    print("=" * 50)

    username = input("Kullanıcı adı: ").strip()
    if not username:
        sys.exit("HATA: Kullanıcı adı boş olamaz.")

    full_name = input("Ad Soyad    : ").strip()
    if not full_name:
        sys.exit("HATA: Ad soyad boş olamaz.")

    password = getpass("Şifre       : ")
    if len(password) < 6:
        sys.exit("HATA: Şifre en az 6 karakter olmalı.")

    password_confirm = getpass("Şifre tekrar: ")
    if password != password_confirm:
        sys.exit("HATA: Şifreler eşleşmiyor.")

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            sys.exit(f"HATA: '{username}' kullanıcısı zaten mevcut.")

        user = User(
            username=username,
            password_hash=hash_password(password),
            full_name=full_name,
            created_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.commit()
        print(f"\n✓ Kullanıcı oluşturuldu: {username} (id={user.id})")
    except IntegrityError:
        db.rollback()
        sys.exit(f"HATA: '{username}' kullanıcısı zaten mevcut (IntegrityError).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
