# new_backend/infrastructure/db/meta.py
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):                       # single declarative root
    pass
