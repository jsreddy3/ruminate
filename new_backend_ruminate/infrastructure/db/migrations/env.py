"""
Alembic env.py wired to the runtime engine.

 * `target_metadata` points at new_backend.infrastructure.db.meta.Base.metadata
 * Online migrations re-use the already-initialised AsyncEngine.
 * Offline migrations build a URL from the settings object.
"""

from __future__ import annotations
import asyncio
from logging.config import fileConfig
from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import AsyncEngine

from new_backend_ruminate.config import settings
from new_backend_ruminate.infrastructure.db import bootstrap  # <─ the module
from new_backend_ruminate.infrastructure.db.meta import Base
import new_backend_ruminate.domain # noqa: E402, F401

# --------------------------------------------------------------------- #
# Logging                                                               #
# --------------------------------------------------------------------- #
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The metadata that Alembic autogenerate will examine
target_metadata = Base.metadata


# --------------------------------------------------------------------- #
# Offline mode                                                          #
# --------------------------------------------------------------------- #
def run_migrations_offline() -> None:
    """Emit SQL to stdout (or --output) without a live DB connection."""
    url = settings().db_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


# --------------------------------------------------------------------- #
# Online mode (async)                                                   #
# --------------------------------------------------------------------- #
def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against the live AsyncEngine."""
    # Ensure the global engine is bootstrapped exactly once
    await bootstrap.init_engine(settings())

    connectable: AsyncEngine = bootstrap.engine  # already created by init_engine
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
