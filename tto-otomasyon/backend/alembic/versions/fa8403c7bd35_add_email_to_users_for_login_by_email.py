"""add email to users for login-by-email

Login sayfası tasarımı (Stitch — modül 1) "Kullanıcı Adı veya E-Posta"
alanı kullanıyor. users.email opsiyonel (NULL'a izin verir — mevcut admin
kullanıcısının e-postası yok), case-insensitive UNIQUE (COLLATE NOCASE,
firms.name / academicians.full_name ile aynı desen — bkz. 9802634c51c7).

Revision ID: fa8403c7bd35
Revises: 9802634c51c7
Create Date: 2026-09-29 15:25:46.613367

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa8403c7bd35'
down_revision: Union[str, Sequence[str], None] = '9802634c51c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('email', sa.String(collation='NOCASE'), nullable=True))
        batch_op.create_unique_constraint(batch_op.f('uq_users_email'), ['email'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('uq_users_email'), type_='unique')
        batch_op.drop_column('email')
