from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://neondb_owner:password@localhost/neondb"

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # PNCP API
    pncp_api_consulta_base_url: str = "https://pncp.gov.br/api/consulta"
    pncp_api_base_url: str = "https://pncp.gov.br/api/pncp"
    pncp_rate_limit_per_second: float = 2.0

    # LLM
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Email (Resend)
    resend_api_key: str = ""
    email_from: str = "EasyGov <noreply@easygov.com.br>"

    # Scheduler
    scheduler_enabled: bool = True

    # PDF Analysis
    pdf_upload_dir: str = "uploads/pdfs"
    pdf_max_size_mb: int = 50
    analysis_max_pages: int = 200

    model_config = {
        "env_file": "../.env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
