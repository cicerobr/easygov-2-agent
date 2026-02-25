"""
API Routes — Disputas
"""
from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DisputeEvent, DisputeFeedback, DisputeItemFinancial, ResultItem, SearchResult
from app.schemas import (
    DisputeFeedbackRequest,
    DisputeFeedbackResponse,
    DisputeFinishRequest,
    DisputeFinishResponse,
    DisputeItemFinancialInput,
    DisputeItemFinancialResponse,
    DisputeItemFinancialRow,
    DisputeStartResponse,
    DisputeStatsResponse,
    DisputeTimelineEventResponse,
    PaginatedResults,
)
from app.services.pipeline_state import set_pipeline_stage

router = APIRouter(prefix="/disputes", tags=["Disputas"])

MARGIN_TARGETS = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35]
TAB_TO_STATUS = {
    "em_disputa": "dispute_open",
    "vencidos": "dispute_won",
    "perdidos": "dispute_lost",
}
DISPUTE_STATUSES = tuple(TAB_TO_STATUS.values())


def get_current_user_id(x_user_id: str = Query(..., alias="user_id")) -> uuid.UUID:
    return uuid.UUID(x_user_id)


def _round2(value: float) -> float:
    return round(float(value) + 1e-9, 2)


def _can_start_dispute(status: str) -> bool:
    return status == "saved"


def _can_finish_dispute(status: str) -> bool:
    return status == "dispute_open"


def _finish_action_to_status(action: str) -> str:
    return "dispute_won" if action == "won" else "dispute_lost"


def _calculate_suggestions(payload: DisputeItemFinancialInput) -> tuple[float, list[dict]]:
    custos_totais = (
        payload.preco_fornecedor
        + payload.mao_obra
        + payload.materiais_consumo
        + payload.equipamentos
        + payload.frete_logistica
    )
    taxa_imposto = payload.aliquota_imposto_percentual / 100

    suggestions: list[dict] = []
    for margin in MARGIN_TARGETS:
        denominator = 1 - taxa_imposto - margin
        if denominator <= 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Não é possível calcular preço de venda para essa combinação de "
                    "alíquota e margem."
                ),
            )

        preco_venda = custos_totais / denominator
        imposto_estimado = preco_venda * taxa_imposto
        lucro_liquido_estimado = preco_venda - imposto_estimado - custos_totais
        suggestions.append(
            {
                "margem_percentual": _round2(margin * 100),
                "preco_venda": _round2(preco_venda),
                "imposto_estimado": _round2(imposto_estimado),
                "lucro_liquido_estimado": _round2(lucro_liquido_estimado),
            }
        )

    return _round2(custos_totais), suggestions


def _financial_to_response(financial: DisputeItemFinancial) -> DisputeItemFinancialResponse:
    raw = financial.precos_sugeridos_json or []
    if isinstance(raw, dict):
        raw = [raw]
    suggestions = [
        {
            "margem_percentual": _round2(float(item.get("margem_percentual", 0))),
            "preco_venda": _round2(float(item.get("preco_venda", 0))),
            "imposto_estimado": _round2(float(item.get("imposto_estimado", 0))),
            "lucro_liquido_estimado": _round2(float(item.get("lucro_liquido_estimado", 0))),
        }
        for item in raw
        if isinstance(item, dict)
    ]
    return DisputeItemFinancialResponse(
        id=financial.id,
        result_id=financial.result_id,
        result_item_id=financial.result_item_id,
        preco_fornecedor=_round2(float(financial.preco_fornecedor)),
        mao_obra=_round2(float(financial.mao_obra)),
        materiais_consumo=_round2(float(financial.materiais_consumo)),
        equipamentos=_round2(float(financial.equipamentos)),
        frete_logistica=_round2(float(financial.frete_logistica)),
        aliquota_imposto_percentual=_round2(float(financial.aliquota_imposto_percentual)),
        custos_totais=_round2(float(financial.custos_totais)),
        precos_sugeridos=suggestions,
        updated_at=financial.updated_at,
    )


def _timeline_event_payload(event: DisputeEvent) -> DisputeTimelineEventResponse:
    return DisputeTimelineEventResponse(
        event_type=event.event_type,
        actor_type=event.actor_type,
        created_at=event.created_at,
        payload=event.payload,
    )


def _item_dedupe_key(item: ResultItem) -> tuple[str, int | str] | None:
    if item.numero_item and item.numero_item > 0:
        return ("numero_item", int(item.numero_item))

    normalized_desc = (item.descricao or "").strip().lower()
    if normalized_desc:
        return ("descricao", normalized_desc)

    return None


@router.get("", response_model=PaginatedResults)
async def list_disputes(
    user_id: uuid.UUID = Depends(get_current_user_id),
    tab: str = Query(default="em_disputa", pattern="^(em_disputa|vencidos|perdidos)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    status = TAB_TO_STATUS[tab]
    conditions = [SearchResult.user_id == user_id, SearchResult.status == status]

    total = (
        await db.execute(select(func.count()).select_from(SearchResult).where(and_(*conditions)))
    ).scalar() or 0

    offset = (page - 1) * page_size
    query = (
        select(SearchResult)
        .where(and_(*conditions))
        .order_by(SearchResult.dispute_started_at.desc(), SearchResult.found_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    results = (await db.execute(query)).scalars().all()
    total_pages = (total + page_size - 1) // page_size

    return PaginatedResults(
        data=results,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/stats", response_model=DisputeStatsResponse)
async def get_dispute_stats(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stats = (
        await db.execute(
            select(
                func.count().filter(SearchResult.status == "dispute_open").label("em_disputa"),
                func.count().filter(SearchResult.status == "dispute_won").label("vencidos"),
                func.count().filter(SearchResult.status == "dispute_lost").label("perdidos"),
            ).where(SearchResult.user_id == user_id)
        )
    ).one()

    em_disputa = stats.em_disputa or 0
    vencidos = stats.vencidos or 0
    perdidos = stats.perdidos or 0

    return DisputeStatsResponse(
        em_disputa=em_disputa,
        vencidos=vencidos,
        perdidos=perdidos,
        total=em_disputa + vencidos + perdidos,
    )


@router.post("/{result_id}/start", response_model=DisputeStartResponse)
async def start_dispute(
    result_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = (
        await db.execute(
            select(SearchResult).where(
                SearchResult.id == result_id,
                SearchResult.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if not result:
        raise HTTPException(status_code=404, detail="Edital não encontrado")
    if not _can_start_dispute(result.status):
        raise HTTPException(
            status_code=400,
            detail="Somente editais salvos podem ser enviados para disputa.",
        )

    now = datetime.utcnow()
    result.status = "dispute_open"
    result.dispute_started_at = now
    result.dispute_finished_at = None
    result.acted_at = now
    await set_pipeline_stage(
        db,
        result_id=result.id,
        user_id=user_id,
        stage="dispute_open",
        finished=True,
        stage_started_at=now,
    )
    db.add(
        DisputeEvent(
            result_id=result.id,
            user_id=user_id,
            event_type="dispute_started",
            actor_type="human",
            payload={"status": "dispute_open"},
            created_at=now,
        )
    )

    await db.commit()
    await db.refresh(result)
    return result


@router.post("/{result_id}/finish", response_model=DisputeFinishResponse)
async def finish_dispute(
    result_id: uuid.UUID,
    body: DisputeFinishRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = (
        await db.execute(
            select(SearchResult).where(
                SearchResult.id == result_id,
                SearchResult.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if not result:
        raise HTTPException(status_code=404, detail="Edital não encontrado")
    if not _can_finish_dispute(result.status):
        raise HTTPException(
            status_code=400,
            detail="Somente editais em disputa podem ser finalizados.",
        )

    now = datetime.utcnow()
    result.status = _finish_action_to_status(body.action)
    result.dispute_finished_at = now
    result.acted_at = now
    await set_pipeline_stage(
        db,
        result_id=result.id,
        user_id=user_id,
        stage=result.status,
        finished=True,
        stage_started_at=now,
    )
    db.add(
        DisputeEvent(
            result_id=result.id,
            user_id=user_id,
            event_type="dispute_won" if body.action == "won" else "dispute_lost",
            actor_type="human",
            payload={"status": result.status},
            created_at=now,
        )
    )

    await db.commit()
    await db.refresh(result)
    return result


@router.get("/{result_id}/financial-items", response_model=list[DisputeItemFinancialRow])
async def list_dispute_financial_items(
    result_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = (
        await db.execute(
            select(SearchResult).where(
                SearchResult.id == result_id,
                SearchResult.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if not result:
        raise HTTPException(status_code=404, detail="Edital não encontrado")
    if result.status not in DISPUTE_STATUSES:
        raise HTTPException(status_code=400, detail="Edital não está no fluxo de disputas.")

    items = (
        await db.execute(
            select(ResultItem)
            .where(ResultItem.result_id == result_id)
            .order_by(ResultItem.numero_item.asc())
        )
    ).scalars().all()

    financials = (
        await db.execute(
            select(DisputeItemFinancial).where(
                DisputeItemFinancial.result_id == result_id,
                DisputeItemFinancial.user_id == user_id,
            )
        )
    ).scalars().all()
    by_item_id = {str(fin.result_item_id): fin for fin in financials}

    rows: list[DisputeItemFinancialRow] = []
    dedupe_index_by_key: dict[tuple[str, int | str], int] = {}
    for item in items:
        fin = by_item_id.get(str(item.id))
        row = DisputeItemFinancialRow(
            result_item_id=item.id,
            numero_item=item.numero_item,
            descricao=item.descricao,
            quantidade=float(item.quantidade) if item.quantidade is not None else None,
            unidade_medida=item.unidade_medida,
            financial=_financial_to_response(fin) if fin else None,
        )
        key = _item_dedupe_key(item)
        if key is None:
            rows.append(row)
            continue

        existing_index = dedupe_index_by_key.get(key)
        if existing_index is None:
            dedupe_index_by_key[key] = len(rows)
            rows.append(row)
            continue

        existing_row = rows[existing_index]
        # Prefer keeping the row that already has saved financial data.
        if existing_row.financial is None and row.financial is not None:
            rows[existing_index] = row

    rows.sort(key=lambda row: (row.numero_item or 0, (row.descricao or "").strip().lower()))
    return rows


@router.put(
    "/{result_id}/financial-items/{result_item_id}",
    response_model=DisputeItemFinancialResponse,
)
async def upsert_dispute_financial_item(
    result_id: uuid.UUID,
    result_item_id: uuid.UUID,
    body: DisputeItemFinancialInput,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = (
        await db.execute(
            select(SearchResult).where(
                SearchResult.id == result_id,
                SearchResult.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=404, detail="Edital não encontrado")
    if result.status not in DISPUTE_STATUSES:
        raise HTTPException(status_code=400, detail="Edital não está no fluxo de disputas.")

    item = (
        await db.execute(
            select(ResultItem).where(
                ResultItem.id == result_item_id,
                ResultItem.result_id == result_id,
            )
        )
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item do edital não encontrado")

    custos_totais, suggestions = _calculate_suggestions(body)
    now = datetime.utcnow()

    financial = (
        await db.execute(
            select(DisputeItemFinancial).where(
                DisputeItemFinancial.result_item_id == result_item_id
            )
        )
    ).scalar_one_or_none()

    if financial:
        financial.preco_fornecedor = body.preco_fornecedor
        financial.mao_obra = body.mao_obra
        financial.materiais_consumo = body.materiais_consumo
        financial.equipamentos = body.equipamentos
        financial.frete_logistica = body.frete_logistica
        financial.aliquota_imposto_percentual = body.aliquota_imposto_percentual
        financial.custos_totais = custos_totais
        financial.precos_sugeridos_json = suggestions
        financial.updated_at = now
    else:
        financial = DisputeItemFinancial(
            user_id=user_id,
            result_id=result_id,
            result_item_id=result_item_id,
            preco_fornecedor=body.preco_fornecedor,
            mao_obra=body.mao_obra,
            materiais_consumo=body.materiais_consumo,
            equipamentos=body.equipamentos,
            frete_logistica=body.frete_logistica,
            aliquota_imposto_percentual=body.aliquota_imposto_percentual,
            custos_totais=custos_totais,
            precos_sugeridos_json=suggestions,
            updated_at=now,
        )
        db.add(financial)

    db.add(
        DisputeEvent(
            result_id=result_id,
            user_id=user_id,
            event_type="financial_saved",
            actor_type="human",
            payload={"result_item_id": str(result_item_id)},
            created_at=now,
        )
    )

    await db.commit()
    await db.refresh(financial)
    return _financial_to_response(financial)


@router.get("/{result_id}/timeline", response_model=list[DisputeTimelineEventResponse])
async def get_dispute_timeline(
    result_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = (
        await db.execute(
            select(SearchResult).where(
                SearchResult.id == result_id,
                SearchResult.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if not result:
        raise HTTPException(status_code=404, detail="Edital não encontrado")
    if result.status not in DISPUTE_STATUSES:
        raise HTTPException(status_code=400, detail="Edital não está no fluxo de disputas.")

    events = (
        await db.execute(
            select(DisputeEvent)
            .where(DisputeEvent.result_id == result_id, DisputeEvent.user_id == user_id)
            .order_by(DisputeEvent.created_at.asc())
        )
    ).scalars().all()
    if events:
        return [_timeline_event_payload(event) for event in events]

    fallback: list[DisputeTimelineEventResponse] = []
    if result.dispute_started_at:
        fallback.append(
            DisputeTimelineEventResponse(
                event_type="dispute_started",
                actor_type="system",
                created_at=result.dispute_started_at,
                payload={"status": "dispute_open"},
            )
        )
    financial_updates = (
        await db.execute(
            select(DisputeItemFinancial)
            .where(
                DisputeItemFinancial.result_id == result_id,
                DisputeItemFinancial.user_id == user_id,
            )
            .order_by(DisputeItemFinancial.updated_at.asc())
        )
    ).scalars().all()
    for fin in financial_updates:
        fallback.append(
            DisputeTimelineEventResponse(
                event_type="financial_saved",
                actor_type="system",
                created_at=fin.updated_at,
                payload={"result_item_id": str(fin.result_item_id)},
            )
        )
    if result.dispute_finished_at and result.status in ("dispute_won", "dispute_lost"):
        fallback.append(
            DisputeTimelineEventResponse(
                event_type="dispute_won" if result.status == "dispute_won" else "dispute_lost",
                actor_type="system",
                created_at=result.dispute_finished_at,
                payload={"status": result.status},
            )
        )
    return sorted(fallback, key=lambda item: item.created_at)


@router.post("/{result_id}/feedback", response_model=DisputeFeedbackResponse)
async def submit_dispute_feedback(
    result_id: uuid.UUID,
    body: DisputeFeedbackRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = (
        await db.execute(
            select(SearchResult).where(
                SearchResult.id == result_id,
                SearchResult.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=404, detail="Edital não encontrado")
    if result.status not in ("dispute_won", "dispute_lost"):
        raise HTTPException(
            status_code=400,
            detail="O feedback só pode ser registrado após o encerramento da disputa.",
        )

    now = datetime.utcnow()
    feedback = (
        await db.execute(
            select(DisputeFeedback).where(
                DisputeFeedback.result_id == result_id,
                DisputeFeedback.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if feedback:
        feedback.loss_reason = body.loss_reason
        feedback.winner_price_delta = body.winner_price_delta
        feedback.suggested_filter_adjustments = body.suggested_filter_adjustments
        feedback.updated_at = now
    else:
        feedback = DisputeFeedback(
            result_id=result_id,
            user_id=user_id,
            loss_reason=body.loss_reason,
            winner_price_delta=body.winner_price_delta,
            suggested_filter_adjustments=body.suggested_filter_adjustments,
            updated_at=now,
        )
        db.add(feedback)

    db.add(
        DisputeEvent(
            result_id=result_id,
            user_id=user_id,
            event_type="feedback_submitted",
            actor_type="human",
            payload={"loss_reason": body.loss_reason},
            created_at=now,
        )
    )

    await db.commit()
    await db.refresh(feedback)
    return feedback
