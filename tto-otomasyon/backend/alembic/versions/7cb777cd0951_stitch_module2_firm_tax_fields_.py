"""stitch module2 firm tax fields academician faculty work_record extras

"Yeni Kayıt" formu (Stitch — modül 2) için additive alanlar. Mevcut
hesaplama zincirine (core/calculations.py) veya var olan hiçbir kolonun
anlamına dokunulmaz — hepsi nullable, geçmiş 83 kayıt etkilenmez:

  - firms: tax_no, tax_office, contact_email ("Hızlı Firma Ekle" modalı)
  - academicians: faculty (department'tan ayrı, "Fakülte")
  - work_records: other_funds ("Diğer Fon & Harçlar", opsiyonel 6. kesinti),
    firm_collection_status ("Tahsil Edildi"/"Tahsil Edilmedi" — YENİ 1. aşama;
    mevcut payment_status artık kavramsal olarak 2. aşama: TTO → Akademisyen),
    request_date ("Talep Tarihi")

Revision ID: 7cb777cd0951
Revises: fa8403c7bd35
Create Date: 2026-09-29 15:40:53.151576

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7cb777cd0951'
down_revision: Union[str, Sequence[str], None] = 'fa8403c7bd35'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('firms', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tax_no', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('tax_office', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('contact_email', sa.String(), nullable=True))

    with op.batch_alter_table('academicians', schema=None) as batch_op:
        batch_op.add_column(sa.Column('faculty', sa.String(), nullable=True))

    with op.batch_alter_table('work_records', schema=None) as batch_op:
        batch_op.add_column(sa.Column('other_funds', sa.Numeric(precision=12, scale=2), nullable=True))
        batch_op.add_column(sa.Column('firm_collection_status', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('request_date', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('work_records', schema=None) as batch_op:
        batch_op.drop_column('request_date')
        batch_op.drop_column('firm_collection_status')
        batch_op.drop_column('other_funds')

    with op.batch_alter_table('academicians', schema=None) as batch_op:
        batch_op.drop_column('faculty')

    with op.batch_alter_table('firms', schema=None) as batch_op:
        batch_op.drop_column('contact_email')
        batch_op.drop_column('tax_office')
        batch_op.drop_column('tax_no')
