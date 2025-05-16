# new_backend_ruminate/domain/__init__.py
"""
Import every ORM model so that Base.metadata is fully populated
before Alembic autogenerate interrogates it.
"""

from .models.conversation import Conversation  # noqa: F401
from .models.message import Message            # noqa: F401
# add future models here, one per line
