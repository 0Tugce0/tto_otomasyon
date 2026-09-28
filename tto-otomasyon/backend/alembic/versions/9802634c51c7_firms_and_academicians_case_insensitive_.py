"""firms and academicians case-insensitive unique names

firms.name ve academicians.full_name UNIQUE kısıtları COLLATE NOCASE
ile yeniden tanımlanır — SQLite'ta case-insensitive UNIQUE için standart
yöntem budur. "Aydos" ve "AYDOS" artık aynı satır olarak görülür.

Sadece kısıt/kolon tanımı değişir, mevcut veriye dokunulmaz. Migration
öncesi SELECT LOWER(name), COUNT(*) ... HAVING COUNT(*)>1 ile kontrol
edildi — hem firms hem academicians'ta case-insensitive mükerrer YOK,
bu migration güvenle uygulanabilir.

Revision ID: 9802634c51c7
Revises: fab645720bcb
Create Date: 2026-09-27 17:12:30.687526

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9802634c51c7'
down_revision: Union[str, Sequence[str], None] = 'fab645720bcb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('firms', schema=None) as batch_op:
        batch_op.alter_column(
            'name',
            existing_type=sa.String(),
            type_=sa.String(collation='NOCASE'),
            existing_nullable=False,
        )

    with op.batch_alter_table('academicians', schema=None) as batch_op:
        batch_op.alter_column(
            'full_name',
            existing_type=sa.String(),
            type_=sa.String(collation='NOCASE'),
            existing_nullable=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('academicians', schema=None) as batch_op:
        batch_op.alter_column(
            'full_name',
            existing_type=sa.String(collation='NOCASE'),
            type_=sa.String(),
            existing_nullable=False,
        )

    with op.batch_alter_table('firms', schema=None) as batch_op:
        batch_op.alter_column(
            'name',
            existing_type=sa.String(collation='NOCASE'),
            type_=sa.String(),
            existing_nullable=False,
        )
