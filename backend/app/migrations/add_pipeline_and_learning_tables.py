"""
Add pipeline state, technical evidence, dispute timeline and feedback tables.
Run once after deployment.
"""
import asyncio

from sqlalchemy import text

from app.database import engine


async def run_migration():
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS result_pipeline_states (
                id UUID PRIMARY KEY,
                result_id UUID NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                pipeline_stage VARCHAR NOT NULL DEFAULT 'captured',
                stage_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                stage_finished_at TIMESTAMPTZ,
                stage_error TEXT,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_result_pipeline_states_result_id UNIQUE (result_id),
                CONSTRAINT ck_result_pipeline_states_stage CHECK (
                    pipeline_stage IN (
                        'captured',
                        'triaged_saved',
                        'triaged_discarded',
                        'analysis_processing',
                        'analysis_completed',
                        'analysis_error',
                        'dispute_open',
                        'dispute_won',
                        'dispute_lost'
                    )
                )
            );
        """))

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_result_pipeline_states_user_stage
            ON result_pipeline_states(user_id, pipeline_stage);
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS dispute_events (
                id UUID PRIMARY KEY,
                result_id UUID NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                event_type VARCHAR NOT NULL,
                actor_type VARCHAR NOT NULL DEFAULT 'human',
                payload JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT ck_dispute_events_type CHECK (
                    event_type IN (
                        'dispute_started',
                        'financial_saved',
                        'dispute_won',
                        'dispute_lost',
                        'feedback_submitted'
                    )
                ),
                CONSTRAINT ck_dispute_events_actor CHECK (
                    actor_type IN ('human', 'system')
                )
            );
        """))

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_dispute_events_result_created
            ON dispute_events(result_id, created_at);
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS dispute_feedbacks (
                id UUID PRIMARY KEY,
                result_id UUID NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                loss_reason TEXT,
                winner_price_delta NUMERIC,
                suggested_filter_adjustments JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_dispute_feedbacks_result_id UNIQUE (result_id)
            );
        """))

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_dispute_feedbacks_user_id
            ON dispute_feedbacks(user_id);
        """))

        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS analysis_technical_evidences (
                id UUID PRIMARY KEY,
                analysis_id UUID NOT NULL REFERENCES edital_analyses(id) ON DELETE CASCADE,
                result_id UUID REFERENCES search_results(id) ON DELETE SET NULL,
                user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                clause_ref VARCHAR,
                source_text TEXT NOT NULL,
                confidence DOUBLE PRECISION NOT NULL DEFAULT 0.75,
                is_human_validated BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """))

        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_analysis_technical_evidences_analysis_id
            ON analysis_technical_evidences(analysis_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_analysis_technical_evidences_result_id
            ON analysis_technical_evidences(result_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_analysis_technical_evidences_user_id
            ON analysis_technical_evidences(user_id);
        """))

        print("✅ Pipeline and learning tables migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_migration())

