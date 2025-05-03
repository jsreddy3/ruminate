# new_backend/config.py
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class _Settings(BaseSettings):
    """
    Runtime configuration.

    All variables can be supplied as environment variables or in a .env file
    sitting at the project root.  Field names map 1-to-1 to env-var names
    unless an alias is declared.
    """

    # ------------------------------------------------------------------ #
    # Database (PostgreSQL only for production; SQLite allowed in tests) #
    # ------------------------------------------------------------------ #
    db_host: str = "localhost"
    db_port: int = 5433
    db_user: str = "postgres"
    db_password: str = "postgres"
    db_name: str = "ruminate"
    db_url: Optional[str] = None                 # full DSN wins if provided
    pool_size: int = 5
    max_overflow: int = 10
    sql_echo: bool = False

    # ------------------------------------------------------------------ #
    # LLM provider                                                       #
    # ------------------------------------------------------------------ #
    openai_api_key: str
    openai_model: str = "gpt-4o"

    # ------------------------------------------------------------------ #
    # Misc                                                                #
    # ------------------------------------------------------------------ #
    env: str = "dev"                            # dev | staging | prod
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ------------------------------------------------------------------ #
    # Derived properties                                                 #
    # ------------------------------------------------------------------ #
    @validator("db_url", always=True)
    def _assemble_url(cls, v, values):
        if v:                                   # already a full DSN
            return v
        if values.get("env") == "test":         # pytest overrides later
            path = Path.cwd() / "test.sqlite"
            return f"sqlite+aiosqlite:///{path}"
        return (
            "postgresql+asyncpg://"
            f"{values['db_user']}:{values['db_password']}"
            f"@{values['db_host']}:{values['db_port']}/{values['db_name']}"
        )

    @property
    def db_dialect(self) -> str:
        """Return the database dialect based on the db_url."""
        url = self.db_url or ""
        if url.startswith("sqlite"):
            return "sqlite"
        if url.startswith("postgresql"):
            return "postgresql"
        return None


@lru_cache
def settings() -> _Settings:
    """Singleton accessor; import this everywhere."""
    return _Settings()
