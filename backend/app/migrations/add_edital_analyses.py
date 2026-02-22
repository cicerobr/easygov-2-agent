"""
Add edital_analyses table for PDF analysis results.
"""
import asyncio
import logging

from sqlalchemy import text
from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def run_migration():
    async with AsyncSessionLocal() as db:
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS edital_analyses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                result_id UUID REFERENCES search_results(id) ON DELETE SET NULL,
                document_id UUID REFERENCES result_documents(id) ON DELETE SET NULL,
                user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

                source_type VARCHAR NOT NULL CHECK (source_type IN ('upload', 'pncp_download')),
                pdf_filename VARCHAR,
                pdf_storage_path VARCHAR,
                pdf_size_bytes INTEGER,

                status VARCHAR NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'error')),
                error_message TEXT,

                extracted_text TEXT,
                page_count INTEGER,

                analysis_data JSONB,

                llm_model VARCHAR,
                tokens_used INTEGER,
                processing_time_ms INTEGER,

                created_at TIMESTAMPTZ DEFAULT now(),
                completed_at TIMESTAMPTZ
            );
        """))

        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_edital_analyses_user_id
            ON edital_analyses(user_id);
        """))

        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_edital_analyses_status
            ON edital_analyses(status);
        """))

        await db.commit()
        logger.info("Migration completed: edital_analyses table created")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_migration())
