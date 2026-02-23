"""
Add performance indexes for inbox/detail queries.
Run once after deployment.
"""
import asyncio

from sqlalchemy import text

from app.database import engine


async def run_migration():
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_search_results_user_found_at
            ON search_results(user_id, found_at);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_search_results_user_status_found_at
            ON search_results(user_id, status, found_at);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_search_results_user_is_read
            ON search_results(user_id, is_read);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_result_documents_result_id
            ON result_documents(result_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_result_items_result_id
            ON result_items(result_id);
        """))

        print("✅ Performance indexes migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_migration())
