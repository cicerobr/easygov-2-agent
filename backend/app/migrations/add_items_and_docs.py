"""
Migration script to add result_items table and update result_documents and search_results tables.
Run this once to apply the schema changes.
"""
import asyncio
from sqlalchemy import text
from app.database import engine


async def run_migration():
    async with engine.begin() as conn:
        # Add items_fetched and documents_fetched columns to search_results
        await conn.execute(text("""
            ALTER TABLE search_results
            ADD COLUMN IF NOT EXISTS items_fetched BOOLEAN DEFAULT FALSE;
        """))
        await conn.execute(text("""
            ALTER TABLE search_results
            ADD COLUMN IF NOT EXISTS documents_fetched BOOLEAN DEFAULT FALSE;
        """))

        # Add new columns to result_documents
        await conn.execute(text("""
            ALTER TABLE result_documents
            ADD COLUMN IF NOT EXISTS sequencial_documento INTEGER;
        """))
        await conn.execute(text("""
            ALTER TABLE result_documents
            ADD COLUMN IF NOT EXISTS tipo_documento_id INTEGER;
        """))
        await conn.execute(text("""
            ALTER TABLE result_documents
            ADD COLUMN IF NOT EXISTS tipo_documento_nome VARCHAR;
        """))
        await conn.execute(text("""
            ALTER TABLE result_documents
            ADD COLUMN IF NOT EXISTS tipo_documento_descricao VARCHAR;
        """))
        await conn.execute(text("""
            ALTER TABLE result_documents
            ADD COLUMN IF NOT EXISTS url VARCHAR;
        """))
        await conn.execute(text("""
            ALTER TABLE result_documents
            ADD COLUMN IF NOT EXISTS uri VARCHAR;
        """))
        await conn.execute(text("""
            ALTER TABLE result_documents
            ADD COLUMN IF NOT EXISTS status_ativo BOOLEAN DEFAULT TRUE;
        """))
        await conn.execute(text("""
            ALTER TABLE result_documents
            ADD COLUMN IF NOT EXISTS data_publicacao_pncp TIMESTAMP WITH TIME ZONE;
        """))

        # Create result_items table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS result_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                result_id UUID NOT NULL REFERENCES search_results(id) ON DELETE CASCADE,
                numero_item INTEGER NOT NULL,
                descricao TEXT,
                material_ou_servico VARCHAR,
                material_ou_servico_nome VARCHAR,
                valor_unitario_estimado NUMERIC,
                valor_total NUMERIC,
                quantidade NUMERIC,
                unidade_medida VARCHAR,
                situacao_compra_item_nome VARCHAR,
                criterio_julgamento_nome VARCHAR,
                tipo_beneficio_nome VARCHAR,
                tem_resultado BOOLEAN,
                orcamento_sigiloso BOOLEAN,
                item_categoria_nome VARCHAR,
                informacao_complementar TEXT
            );
        """))

        # Create index for faster lookups
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_result_items_result_id
            ON result_items(result_id);
        """))

        print("✅ Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_migration())
