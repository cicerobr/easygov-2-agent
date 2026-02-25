"""
Add hybrid keyword matching support for edital items.
Run once after deployment.
"""
import asyncio

from sqlalchemy import text

from app.database import engine


async def run_migration():
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE search_automations
                ADD COLUMN IF NOT EXISTS search_in_items BOOLEAN NOT NULL DEFAULT TRUE;
                """
            )
        )

        await conn.execute(
            text(
                """
                ALTER TABLE search_results
                ADD COLUMN IF NOT EXISTS keyword_match_scope VARCHAR(16);
                """
            )
        )

        await conn.execute(
            text(
                """
                ALTER TABLE search_results
                ADD COLUMN IF NOT EXISTS keyword_match_evidence_json JSONB;
                """
            )
        )

        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'ck_search_results_keyword_match_scope'
                    ) THEN
                        ALTER TABLE search_results
                        ADD CONSTRAINT ck_search_results_keyword_match_scope
                        CHECK (
                            keyword_match_scope IS NULL
                            OR keyword_match_scope IN ('object', 'item', 'both')
                        );
                    END IF;
                END $$;
                """
            )
        )

        await conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_search_results_user_scope_found_at
                ON search_results(user_id, keyword_match_scope, found_at DESC);
                """
            )
        )

        print("✅ Keyword item search migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_migration())

