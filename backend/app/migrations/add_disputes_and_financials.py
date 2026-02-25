"""
Add disputes workflow fields and financial table.
Run once after deployment.
"""
import asyncio

from sqlalchemy import text

from app.database import engine


async def run_migration():
    async with engine.begin() as conn:
        # Add dispute fields to search_results
        await conn.execute(text("""
            ALTER TABLE search_results
            ADD COLUMN IF NOT EXISTS codigo_unidade_compradora VARCHAR;
        """))
        await conn.execute(text("""
            ALTER TABLE search_results
            ADD COLUMN IF NOT EXISTS nome_unidade_compradora VARCHAR;
        """))
        await conn.execute(text("""
            ALTER TABLE search_results
            ADD COLUMN IF NOT EXISTS dispute_started_at TIMESTAMPTZ;
        """))
        await conn.execute(text("""
            ALTER TABLE search_results
            ADD COLUMN IF NOT EXISTS dispute_finished_at TIMESTAMPTZ;
        """))

        # Replace status check constraint to include dispute statuses.
        await conn.execute(text("""
            DO $$
            DECLARE c RECORD;
            BEGIN
                FOR c IN
                    SELECT conname
                    FROM pg_constraint
                    WHERE conrelid = 'search_results'::regclass
                      AND contype = 'c'
                      AND pg_get_constraintdef(oid) ILIKE '%status%'
                LOOP
                    EXECUTE format('ALTER TABLE search_results DROP CONSTRAINT IF EXISTS %I', c.conname);
                END LOOP;
            END $$;
        """))
        await conn.execute(text("""
            ALTER TABLE search_results
            ADD CONSTRAINT ck_search_results_status
            CHECK (status IN ('pending', 'saved', 'discarded', 'dispute_open', 'dispute_won', 'dispute_lost'));
        """))

        # Create dispute financial table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS dispute_item_financials (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                result_id UUID NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
                result_item_id UUID NOT NULL REFERENCES result_items(id) ON DELETE CASCADE,
                preco_fornecedor NUMERIC NOT NULL DEFAULT 0,
                mao_obra NUMERIC NOT NULL DEFAULT 0,
                materiais_consumo NUMERIC NOT NULL DEFAULT 0,
                equipamentos NUMERIC NOT NULL DEFAULT 0,
                frete_logistica NUMERIC NOT NULL DEFAULT 0,
                aliquota_imposto_percentual NUMERIC NOT NULL DEFAULT 0,
                custos_totais NUMERIC NOT NULL DEFAULT 0,
                precos_sugeridos_json JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
        """))

        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_dispute_item_financials_result_item_id
            ON dispute_item_financials(result_item_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_dispute_item_financials_result_id
            ON dispute_item_financials(result_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_dispute_item_financials_user_id
            ON dispute_item_financials(user_id);
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_search_results_user_dispute_status_found_at
            ON search_results(user_id, status, found_at DESC);
        """))

        print("✅ Disputes and financial migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_migration())
