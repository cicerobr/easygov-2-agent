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
    item_check_limit_per_run: int = 120
    item_fetch_concurrency: int = 5
    item_fetch_timeout_sec: int = 12

    # LLM
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_ocr_model: str = "gpt-4.1-mini"
    langsmith_tracing: bool = False
    langsmith_api_key: str = ""
    langsmith_project: str = "easygov"

    # Email (Resend)
    resend_api_key: str = ""
    email_from: str = "EasyGov <noreply@easygov.com.br>"

    # Scheduler
    scheduler_enabled: bool = True

    # PDF Analysis
    pdf_upload_dir: str = "uploads/pdfs"
    pdf_max_size_mb: int = 50
    analysis_max_pages: int = 200
    ocr_enabled: bool = True
    ocr_min_chars_per_page: int = 80
    ocr_page_render_dpi: int = 200
    ocr_request_timeout_sec: int = 45
    ocr_max_retries: int = 2
    ocr_max_concurrency: int = 2

    model_config = {
        "env_file": "../.env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
