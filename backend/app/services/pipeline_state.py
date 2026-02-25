from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ResultPipelineState

PIPELINE_STAGE_FROM_RESULT_STATUS: dict[str, str] = {
    "pending": "captured",
    "saved": "triaged_saved",
    "discarded": "triaged_discarded",
    "dispute_open": "dispute_open",
    "dispute_won": "dispute_won",
    "dispute_lost": "dispute_lost",
}


def stage_from_result_status(status: str) -> str:
    return PIPELINE_STAGE_FROM_RESULT_STATUS.get(status, "captured")


async def set_pipeline_stage(
    db: AsyncSession,
    *,
    result_id: uuid.UUID,
    user_id: uuid.UUID,
    stage: str,
    stage_error: str | None = None,
    finished: bool = False,
    stage_started_at: datetime | None = None,
) -> ResultPipelineState:
    now = datetime.utcnow()
    state = (
        await db.execute(
            select(ResultPipelineState).where(ResultPipelineState.result_id == result_id)
        )
    ).scalar_one_or_none()

    if not state:
        state = ResultPipelineState(
            result_id=result_id,
            user_id=user_id,
            pipeline_stage=stage,
            stage_started_at=stage_started_at or now,
            stage_finished_at=now if finished else None,
            stage_error=stage_error,
            updated_at=now,
        )
        db.add(state)
        return state

    stage_changed = state.pipeline_stage != stage
    state.pipeline_stage = stage
    if stage_changed or not state.stage_started_at:
        state.stage_started_at = stage_started_at or now
    state.stage_finished_at = now if finished else None
    state.stage_error = stage_error
    state.updated_at = now
    return state
