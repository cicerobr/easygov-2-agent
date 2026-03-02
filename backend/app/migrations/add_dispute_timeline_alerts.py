"""
Add dispute timeline alert deliveries table.
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
                CREATE TABLE IF NOT EXISTS dispute_alert_deliveries (
                    id UUID PRIMARY KEY,
                    result_id UUID NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
                    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                    alert_type VARCHAR NOT NULL,
                    scheduled_for TIMESTAMPTZ NOT NULL,
                    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """
            )
        )

        await conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_dispute_alert_deliveries_result_type_schedule
                ON dispute_alert_deliveries(result_id, alert_type, scheduled_for);
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_dispute_alert_deliveries_user_sent
                ON dispute_alert_deliveries(user_id, sent_at DESC);
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_dispute_alert_deliveries_result
                ON dispute_alert_deliveries(result_id);
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
                        WHERE conname = 'ck_dispute_alert_deliveries_type'
                    ) THEN
                        ALTER TABLE dispute_alert_deliveries
                        ADD CONSTRAINT ck_dispute_alert_deliveries_type
                        CHECK (alert_type IN ('opening_d1', 'opening_d0', 'closing_h2'));
                    END IF;
                END $$;
                """
            )
        )

        print("✅ Dispute timeline alerts migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_migration())
