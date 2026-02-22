"""
API Routes — Search Automations CRUD
"""
import uuid
from datetime import datetime, timedelta, time as dt_time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import SearchAutomation, AutomationRun
from app.schemas import (
    AutomationCreate, AutomationUpdate, AutomationResponse, AutomationRunResponse,
)

router = APIRouter(prefix="/automations", tags=["Automações"])

# TODO: Replace with real auth dependency
TEMP_USER_ID = None  # Will be set via header for now


async def get_current_user_id(x_user_id: str = Query(..., alias="user_id")) -> uuid.UUID:
    """Temporary auth: pass user_id as query param. Replace with JWT auth."""
    return uuid.UUID(x_user_id)


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

    await db.delete(automation)
    await db.commit()


@router.post("/{automation_id}/run", response_model=AutomationRunResponse)
async def trigger_automation_run(
    automation_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger an automation run."""
    from app.agent.engine import run_automation

    result = await db.execute(
        select(SearchAutomation).where(
            SearchAutomation.id == automation_id,
            SearchAutomation.user_id == user_id,
        )
    )
    automation = result.scalar_one_or_none()
    if not automation:
        raise HTTPException(status_code=404, detail="Automação não encontrada")

    run = await run_automation(automation, db)
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
