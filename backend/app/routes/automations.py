"""
API Routes — Search Automations CRUD
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta, time as dt_time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, get_db
from app.models import (
    AnalysisTechnicalEvidence,
    AutomationRun,
    DisputeEvent,
    DisputeFeedback,
    DisputeItemFinancial,
    EditalAnalysis,
    Notification,
    ResultDocument,
    ResultItem,
    ResultPipelineState,
    SearchAutomation,
    SearchResult,
)
from app.schemas import (
    AutomationCreate,
    AutomationLearningSuggestionResponse,
    AutomationResponse,
    AutomationRunResponse,
    AutomationUpdate,
)

router = APIRouter(prefix="/automations", tags=["Automações"])
logger = logging.getLogger(__name__)

# TODO: Replace with real auth dependency
TEMP_USER_ID = None  # Will be set via header for now


async def get_current_user_id(x_user_id: str = Query(..., alias="user_id")) -> uuid.UUID:
    """Temporary auth: pass user_id as query param. Replace with JWT auth."""
    return uuid.UUID(x_user_id)


async def _execute_automation_run_in_background(automation_id: uuid.UUID, run_id: uuid.UUID):
    from app.agent.engine import run_automation

    try:
        async with AsyncSessionLocal() as task_db:
            automation = (
                await task_db.execute(
                    select(SearchAutomation).where(SearchAutomation.id == automation_id)
                )
            ).scalar_one_or_none()
            if not automation:
                return

            run = (
                await task_db.execute(
                    select(AutomationRun).where(
                        AutomationRun.id == run_id,
                        AutomationRun.automation_id == automation_id,
                    )
                )
            ).scalar_one_or_none()
            if not run:
                return

            await run_automation(automation, task_db, run=run)
    except Exception as exc:
        logger.exception(
            "Unexpected failure while processing automation run in background "
            "(automation_id=%s, run_id=%s): %s",
            automation_id,
            run_id,
            exc,
        )
        async with AsyncSessionLocal() as task_db:
            run = (
                await task_db.execute(
                    select(AutomationRun).where(AutomationRun.id == run_id)
                )
            ).scalar_one_or_none()
            if run and run.status == "running":
                run.status = "error"
                run.error_message = f"Falha inesperada: {str(exc)[:450]}"
                run.finished_at = datetime.utcnow()
                await task_db.commit()


@router.get("", response_model=list[AutomationResponse])
async def list_automations(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all automations for the current user."""
    result = await db.execute(
        select(SearchAutomation)
        .where(SearchAutomation.user_id == user_id)
        .order_by(SearchAutomation.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=AutomationResponse, status_code=201)
async def create_automation(
    data: AutomationCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new search automation."""
    # Parse daily_times if provided
    daily_times = None
    if data.daily_times:
        daily_times = [dt_time.fromisoformat(t) for t in data.daily_times]

    automation = SearchAutomation(
        user_id=user_id,
        name=data.name,
        search_type=data.search_type,
        modalidade_ids=data.modalidade_ids,
        uf=data.uf,
        codigo_municipio_ibge=data.codigo_municipio_ibge,
        cnpj_orgao=data.cnpj_orgao,
        codigo_modo_disputa=data.codigo_modo_disputa,
        keywords=data.keywords,
        keywords_exclude=data.keywords_exclude,
        search_in_items=data.search_in_items,
        valor_minimo=data.valor_minimo,
        valor_maximo=data.valor_maximo,
        schedule_type=data.schedule_type,
        interval_hours=data.interval_hours,
        daily_times=daily_times,
        active_window_start=dt_time.fromisoformat(data.active_window_start),
        active_window_end=dt_time.fromisoformat(data.active_window_end),
        timezone=data.timezone,
        # Schedule first run
        next_run_at=datetime.utcnow() + timedelta(minutes=1),
    )
    db.add(automation)
    await db.commit()
    await db.refresh(automation)
    return automation


@router.get("/{automation_id}", response_model=AutomationResponse)
async def get_automation(
    automation_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific automation."""
    result = await db.execute(
        select(SearchAutomation).where(
            SearchAutomation.id == automation_id,
            SearchAutomation.user_id == user_id,
        )
    )
    automation = result.scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automação não encontrada")
    return automation


@router.put("/{automation_id}", response_model=AutomationResponse)
async def update_automation(
    automation_id: uuid.UUID,
    data: AutomationUpdate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing automation."""
    result = await db.execute(
        select(SearchAutomation).where(
            SearchAutomation.id == automation_id,
            SearchAutomation.user_id == user_id,
        )
    )
    automation = result.scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automação não encontrada")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "daily_times" and value:
            value = [dt_time.fromisoformat(t) for t in value]
        if key == "active_window_start" and value:
            value = dt_time.fromisoformat(value)
        if key == "active_window_end" and value:
            value = dt_time.fromisoformat(value)
        setattr(automation, key, value)

    automation.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(automation)
    return automation


@router.delete("/{automation_id}", status_code=204)
async def delete_automation(
    automation_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete an automation and all its results."""
    result = await db.execute(
        select(SearchAutomation).where(
            SearchAutomation.id == automation_id,
            SearchAutomation.user_id == user_id,
        )
    )
    automation = result.scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automação não encontrada")

    try:
        result_ids_subquery = select(SearchResult.id).where(
            SearchResult.automation_id == automation_id,
            SearchResult.user_id == user_id,
        )

        await db.execute(
            delete(DisputeItemFinancial).where(
                DisputeItemFinancial.result_id.in_(result_ids_subquery)
            )
        )
        await db.execute(
            delete(ResultPipelineState).where(
                ResultPipelineState.result_id.in_(result_ids_subquery)
            )
        )
        await db.execute(
            delete(DisputeEvent).where(DisputeEvent.result_id.in_(result_ids_subquery))
        )
        await db.execute(
            delete(DisputeFeedback).where(DisputeFeedback.result_id.in_(result_ids_subquery))
        )
        await db.execute(
            delete(AnalysisTechnicalEvidence).where(
                AnalysisTechnicalEvidence.result_id.in_(result_ids_subquery)
            )
        )
        await db.execute(
            delete(EditalAnalysis).where(EditalAnalysis.result_id.in_(result_ids_subquery))
        )
        await db.execute(
            delete(ResultDocument).where(ResultDocument.result_id.in_(result_ids_subquery))
        )
        await db.execute(
            delete(ResultItem).where(ResultItem.result_id.in_(result_ids_subquery))
        )
        await db.execute(
            delete(SearchResult).where(
                SearchResult.automation_id == automation_id,
                SearchResult.user_id == user_id,
            )
        )
        await db.execute(delete(AutomationRun).where(AutomationRun.automation_id == automation_id))
        await db.execute(delete(Notification).where(Notification.automation_id == automation_id))
        await db.execute(
            delete(SearchAutomation).where(
                SearchAutomation.id == automation_id,
                SearchAutomation.user_id == user_id,
            )
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao excluir automação e seus dados relacionados: {exc}",
        ) from exc


@router.post("/{automation_id}/run", response_model=AutomationRunResponse)
async def trigger_automation_run(
    automation_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger an automation run asynchronously."""

    result = await db.execute(
        select(SearchAutomation).where(
            SearchAutomation.id == automation_id,
            SearchAutomation.user_id == user_id,
        )
    )
    automation = result.scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automação não encontrada")

    run = AutomationRun(
        automation_id=automation.id,
        status="running",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    asyncio.create_task(_execute_automation_run_in_background(automation.id, run.id))
    return run


@router.get("/{automation_id}/runs", response_model=list[AutomationRunResponse])
async def list_automation_runs(
    automation_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    limit: int = Query(default=20, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List execution history for an automation."""
    result = await db.execute(
        select(AutomationRun)
        .join(SearchAutomation)
        .where(
            AutomationRun.automation_id == automation_id,
            SearchAutomation.user_id == user_id,
        )
        .order_by(AutomationRun.started_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get(
    "/{automation_id}/learning-suggestions",
    response_model=AutomationLearningSuggestionResponse,
)
async def get_automation_learning_suggestions(
    automation_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    automation = (
        await db.execute(
            select(SearchAutomation).where(
                SearchAutomation.id == automation_id,
                SearchAutomation.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automação não encontrada")

    dispute_stats = (
        await db.execute(
            select(
                func.count().filter(SearchResult.status == "dispute_open").label("open"),
                func.count().filter(SearchResult.status == "dispute_won").label("won"),
                func.count().filter(SearchResult.status == "dispute_lost").label("lost"),
            ).where(
                SearchResult.automation_id == automation_id,
                SearchResult.user_id == user_id,
            )
        )
    ).one()

    open_count = dispute_stats.open or 0
    won_count = dispute_stats.won or 0
    lost_count = dispute_stats.lost or 0
    disputed_count = open_count + won_count + lost_count
    win_rate = round((won_count / (won_count + lost_count)) * 100, 2) if (won_count + lost_count) else 0

    reasons = (
        await db.execute(
            select(DisputeFeedback.loss_reason, func.count().label("qty"))
            .join(SearchResult, SearchResult.id == DisputeFeedback.result_id)
            .where(
                SearchResult.automation_id == automation_id,
                SearchResult.user_id == user_id,
                DisputeFeedback.loss_reason.is_not(None),
            )
            .group_by(DisputeFeedback.loss_reason)
            .order_by(func.count().desc())
            .limit(5)
        )
    ).all()
    top_loss_reasons = [str(row.loss_reason) for row in reasons if row.loss_reason]

    suggestions: list[str] = []
    if win_rate < 30:
        suggestions.append("Refine palavras-chave para reduzir editais com baixa aderência.")
    if lost_count > won_count:
        suggestions.append("Revisar competitividade de preço por item antes de entrar em disputa.")
    if any("prazo" in reason.lower() for reason in top_loss_reasons):
        suggestions.append("Priorizar editais com maior antecedência até o encerramento.")
    if any("técnic" in reason.lower() or "tecnic" in reason.lower() for reason in top_loss_reasons):
        suggestions.append("Aplicar validação técnica obrigatória antes de iniciar disputa.")
    if not suggestions:
        suggestions.append("Manter estratégia atual e ampliar cobertura de órgãos com maior taxa de vitória.")

    return AutomationLearningSuggestionResponse(
        automation_id=automation_id,
        disputed_count=disputed_count,
        won_count=won_count,
        lost_count=lost_count,
        win_rate=win_rate,
        top_loss_reasons=top_loss_reasons,
        suggested_actions=suggestions,
    )
