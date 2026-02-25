"""
Backfill tags in edital_analyses.analysis_data.

Rule:
- Add "Oportunidade" only when the modality is "Dispensa"
  and there is explicit evidence of no requirement for
  atestado/capacidade/qualificação técnica.
- Remove "Oportunidade" in any other case.
"""
import asyncio
import copy
import logging

from sqlalchemy import select

from app.agent.opportunity_tag import apply_opportunity_tag_rule
from app.database import AsyncSessionLocal
from app.models import EditalAnalysis

logger = logging.getLogger(__name__)


async def run_backfill():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(EditalAnalysis).where(EditalAnalysis.analysis_data.is_not(None))
        )
        analyses = result.scalars().all()

        processed = 0
        updated = 0
        skipped = 0

        for analysis in analyses:
            processed += 1
            data = analysis.analysis_data

            if not isinstance(data, dict):
                skipped += 1
                continue

            normalized = copy.deepcopy(data)
            apply_opportunity_tag_rule(normalized)

            if normalized != data:
                analysis.analysis_data = normalized
                updated += 1

        await db.commit()

        logger.info(
            "Backfill completed: processed=%s, updated=%s, skipped=%s",
            processed,
            updated,
            skipped,
        )
        print(
            f"✅ Backfill finalizado: processados={processed}, "
            f"atualizados={updated}, ignorados={skipped}"
        )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_backfill())
