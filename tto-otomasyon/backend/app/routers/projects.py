"""
routers/projects.py — Proje CRUD (2026+).
DELETE endpoint yok (şartnamede geçmiyor; SET NULL FK var).
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Project, User
from app.schemas import ProjectCreate, ProjectResponse, ProjectUpdate

router = APIRouter()


@router.get("/", response_model=list[ProjectResponse], summary="Proje listesi")
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tüm projeleri isme göre sıralı döner."""
    return db.query(Project).order_by(Project.name).all()


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED, summary="Yeni proje")
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proj = Project(name=body.name.strip(), description=body.description, created_at=datetime.now(timezone.utc))
    db.add(proj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu isimde proje zaten mevcut.")
    db.refresh(proj)
    return proj


@router.get("/{project_id}", response_model=ProjectResponse, summary="Proje detayı")
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Proje bulunamadı.")
    return proj


@router.put("/{project_id}", response_model=ProjectResponse, summary="Proje güncelle")
def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Proje bulunamadı.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(proj, field, value)
    db.commit()
    db.refresh(proj)
    return proj
