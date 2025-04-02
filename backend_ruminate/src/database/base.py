"""
Database base module to prevent circular imports.
"""
from sqlalchemy.orm import declarative_base

Base = declarative_base()
