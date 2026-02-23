"""
Backfill tags in edital_analyses.analysis_data.

Rule:
- Add "Oportunidade" when there is no technical qualification requirement.
- Remove "Oportunidade" when technical qualification requirement exists.
"""
import asyncio
import copy
import logging
from typing import Any

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import EditalAnalysis

logger = logging.getLogger(__name__)


def _apply_opportunity_tag_rule(analysis: dict[str, Any]) -> None:
    tags_raw = analysis.get("tags")
    if isinstance(tags_raw, list):
        tags = [str(t).strip() for t in tags_raw if str(t).strip()]
    elif isinstance(tags_raw, str) and tags_raw.strip():
        tags = [tags_raw.strip()]
    else:
        tags = []

    has_technical_requirement = _has_technical_requirement(analysis.get("habilitacao"))

    if not has_technical_requirement and "Oportunidade" not in tags:
        tags.append("Oportunidade")
    if has_technical_requirement and "Oportunidade" in tags:
        tags = [t for t in tags if t != "Oportunidade"]

    analysis["tags"] = tags


def _has_technical_requirement(habilitacao: Any) -> bool:
    if not isinstance(habilitacao, dict):
        return False

    tecnica = habilitacao.get("tecnica")
    if tecnica is None:
        return False

    if isinstance(tecnica, str):
        values = [tecnica]
    elif isinstance(tecnica, list):
        values = [str(item) for item in tecnica]
    else:
        return False

    negatives = (
        "nao exig",
        "não exig",
        "nao se aplica",
        "não se aplica",
        "sem exig",
        "dispens",
        "inexist",
        "nenhum",
        "nenhuma",
        "nao ha",
        "não há",
    )
    technical_markers = (
        "atestado",
        "capacidade tecnica",
        "capacidade técnica",
        "qualificacao tecnica",
        "qualificação técnica",
        "acervo tecnico",
        "acervo técnico",
        "responsavel tecnico",
        "responsável técnico",
        "crea",
        "cau",
        "crt",
        "registro profissional",
        "certidao de acervo",
        "certidão de acervo",
    )

    for value in values:
        text = (value or "").strip().lower()
        if not text:
            continue
        if any(marker in text for marker in technical_markers):
            return True
        if any(neg in text for neg in negatives):
            continue
        return True

    return False


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
            _apply_opportunity_tag_rule(normalized)

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
