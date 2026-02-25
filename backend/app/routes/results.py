"""
API Routes — Search Results (Inbox)
"""
import asyncio
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    AnalysisTechnicalEvidence,
    EditalAnalysis,
    ResultItem,
    ResultDocument,
    ResultPipelineState,
    SearchResult,
)
from app.pncp_client import pncp_client
from app.schemas import (
    PaginatedResults,
    PriorityScoreComponent,
    PriorityScoreResponse,
    ResultActionRequest,
    ResultBatchActionRequest,
    ResultItemResponse,
    ResultPipelineKpisResponse,
    ResultPipelineStateResponse,
    SearchResultDetailResponse,
    SearchResultResponse,
)
from app.services.pipeline_state import set_pipeline_stage, stage_from_result_status
from app.services.priority_score import (
    score_deadline_component,
    score_financial_component,
    score_historical_component,
    score_technical_component,
)

router = APIRouter(prefix="/results", tags=["Resultados (Inbox)"])
logger = logging.getLogger(__name__)


async def get_current_user_id(x_user_id: str = Query(..., alias="user_id")) -> uuid.UUID:
    return uuid.UUID(x_user_id)


@router.get("", response_model=PaginatedResults)
async def list_results(
    user_id: uuid.UUID = Depends(get_current_user_id),
    status: str = Query(default="pending", pattern="^(pending|saved|discarded|all)$"),
    automation_id: uuid.UUID | None = None,
    is_read: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List search results (inbox) with filters and pagination."""
    conditions = [SearchResult.user_id == user_id]

    if status != "all":
        conditions.append(SearchResult.status == status)
    if automation_id:
        conditions.append(SearchResult.automation_id == automation_id)
    if is_read is not None:
        conditions.append(SearchResult.is_read == is_read)

    # Count total
    count_query = select(func.count()).select_from(SearchResult).where(and_(*conditions))
    total = (await db.execute(count_query)).scalar() or 0

    # Fetch page
    offset = (page - 1) * page_size
    query = (
        select(SearchResult)
        .where(and_(*conditions))
        .order_by(SearchResult.found_at.desc())
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


@router.get("/stats")
async def get_result_stats(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get result statistics for the dashboard."""
    stats = (await db.execute(
        select(
            func.count().label("total"),
            func.count().filter(SearchResult.status == "pending").label("pending"),
            func.count().filter(SearchResult.status == "saved").label("saved"),
            func.count().filter(SearchResult.status == "discarded").label("discarded"),
            func.count().filter(SearchResult.is_read.is_(False)).label("unread"),
        ).where(SearchResult.user_id == user_id)
    )).one()

    total = stats.total or 0
    pending = stats.pending or 0
    saved = stats.saved or 0
    discarded = stats.discarded or 0
    unread = stats.unread or 0

    return {
        "pending": pending,
        "unread": unread,
        "saved": saved,
        "discarded": discarded,
        "total": total,
    }


@router.get("/kpis", response_model=ResultPipelineKpisResponse)
async def get_pipeline_kpis(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    lifecycle = (
        await db.execute(
            select(
                func.count().label("total"),
                func.count().filter(SearchResult.status == "pending").label("pending"),
                func.count().filter(SearchResult.status == "saved").label("saved"),
                func.count().filter(SearchResult.status == "discarded").label("discarded"),
                func.count().filter(SearchResult.status == "dispute_open").label("dispute_open"),
                func.count().filter(SearchResult.status == "dispute_won").label("dispute_won"),
                func.count().filter(SearchResult.status == "dispute_lost").label("dispute_lost"),
            ).where(SearchResult.user_id == user_id)
        )
    ).one()

    total = lifecycle.total or 0
    pending_total = lifecycle.pending or 0
    saved_total = lifecycle.saved or 0
    discarded_total = lifecycle.discarded or 0
    dispute_open_total = lifecycle.dispute_open or 0
    won_total = lifecycle.dispute_won or 0
    lost_total = lifecycle.dispute_lost or 0
    dispute_total = dispute_open_total + won_total + lost_total
    triaged_total = saved_total + discarded_total + dispute_total
    saved_lifecycle_total = saved_total + dispute_total

    analyses = (
        await db.execute(
            select(
                func.count().label("total"),
                func.count().filter(EditalAnalysis.status == "completed").label("completed"),
                func.count().filter(EditalAnalysis.status == "error").label("errors"),
                func.avg(EditalAnalysis.processing_time_ms).label("avg_processing_ms"),
                func.count()
                .filter(
                    and_(
                        EditalAnalysis.status == "completed",
                        EditalAnalysis.result_id.is_not(None),
                    )
                )
                .label("completed_with_result"),
            ).where(EditalAnalysis.user_id == user_id)
        )
    ).one()

    completed_analyses = analyses.completed or 0
    failed_analyses = analyses.errors or 0
    analysis_total = analyses.total or 0
    avg_processing_ms = float(analyses.avg_processing_ms or 0)
    completed_with_result = analyses.completed_with_result or 0

    evidence_coverage = (
        await db.execute(
            select(func.count(func.distinct(AnalysisTechnicalEvidence.analysis_id))).where(
                AnalysisTechnicalEvidence.user_id == user_id
            )
        )
    ).scalar() or 0

    pending_to_saved_rate = (
        round((saved_lifecycle_total / triaged_total) * 100, 2) if triaged_total else 0
    )
    saved_to_dispute_rate = (
        round((dispute_total / saved_lifecycle_total) * 100, 2) if saved_lifecycle_total else 0
    )
    dispute_win_rate = (
        round((won_total / (won_total + lost_total)) * 100, 2) if (won_total + lost_total) else 0
    )
    analysis_success_rate = (
        round((completed_analyses / analysis_total) * 100, 2) if analysis_total else 0
    )
    technical_evidence_coverage_rate = (
        round((evidence_coverage / completed_with_result) * 100, 2)
        if completed_with_result
        else 0
    )

    return ResultPipelineKpisResponse(
        total_results=total,
        triaged_total=triaged_total,
        pending_total=pending_total,
        dispute_total=dispute_total,
        won_total=won_total,
        lost_total=lost_total,
        pending_to_saved_rate=pending_to_saved_rate,
        saved_to_dispute_rate=saved_to_dispute_rate,
        dispute_win_rate=dispute_win_rate,
        analysis_success_rate=analysis_success_rate,
        analysis_avg_processing_ms=round(avg_processing_ms, 2),
        technical_evidence_coverage_rate=technical_evidence_coverage_rate,
    )


def _has_no_technical_requirement(analysis_data: dict | None) -> bool:
    if not isinstance(analysis_data, dict):
        return False
    habilitacao = analysis_data.get("habilitacao")
    if not isinstance(habilitacao, dict):
        return False
    tecnica = habilitacao.get("tecnica")
    entries: list[str] = []
    if isinstance(tecnica, list):
        entries = [str(item).lower() for item in tecnica]
    elif isinstance(tecnica, str):
        entries = [tecnica.lower()]
    if not entries:
        return False
    markers = (
        "não exige",
        "nao exige",
        "sem exig",
        "dispensad",
    )
    return all(any(marker in item for marker in markers) for item in entries)


@router.get("/{result_id}/priority-score", response_model=PriorityScoreResponse)
async def get_result_priority_score(
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
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    latest_analysis = (
        await db.execute(
            select(EditalAnalysis)
            .where(
                EditalAnalysis.user_id == user_id,
                EditalAnalysis.result_id == result_id,
                EditalAnalysis.status == "completed",
            )
            .order_by(EditalAnalysis.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    evidence_count = 0
    if latest_analysis:
        evidence_count = (
            await db.execute(
                select(func.count()).where(
                    AnalysisTechnicalEvidence.analysis_id == latest_analysis.id,
                    AnalysisTechnicalEvidence.user_id == user_id,
                )
            )
        ).scalar() or 0

    history = (
        await db.execute(
            select(
                func.count().filter(SearchResult.status == "dispute_won").label("won"),
                func.count().filter(SearchResult.status == "dispute_lost").label("lost"),
            ).where(
                SearchResult.user_id == user_id,
                SearchResult.cnpj_orgao == result.cnpj_orgao,
            )
        )
    ).one()
    won = history.won or 0
    lost = history.lost or 0
    win_rate = (won / (won + lost)) if (won + lost) > 0 else None

    deadline_score = score_deadline_component(result.data_encerramento_proposta)
    financial_score = score_financial_component(
        float(result.valor_total_estimado) if result.valor_total_estimado is not None else None
    )
    technical_score = score_technical_component(
        evidence_count=evidence_count,
        has_no_technical_requirement=_has_no_technical_requirement(
            latest_analysis.analysis_data if latest_analysis else None
        ),
        analysis_completed=latest_analysis is not None,
    )
    historical_score = score_historical_component(win_rate)
    total = round(deadline_score + technical_score + financial_score + historical_score, 2)

    recommendation = "monitorar"
    if total >= 75:
        recommendation = "prioridade_alta"
    elif total >= 50:
        recommendation = "avaliar_agora"

    components = [
        PriorityScoreComponent(
            label="Prazo",
            score=round(deadline_score, 2),
            max_score=35,
            reason="Proximidade do encerramento de propostas",
        ),
        PriorityScoreComponent(
            label="Aderência técnica",
            score=round(technical_score, 2),
            max_score=25,
            reason="Cobertura e clareza da qualificação técnica",
        ),
        PriorityScoreComponent(
            label="Atratividade financeira",
            score=round(financial_score, 2),
            max_score=25,
            reason="Faixa de valor estimado do edital",
        ),
        PriorityScoreComponent(
            label="Histórico no órgão",
            score=round(historical_score, 2),
            max_score=15,
            reason="Taxa de vitórias históricas por órgão",
        ),
    ]

    return PriorityScoreResponse(
        result_id=result.id,
        total_score=total,
        recommendation=recommendation,
        components=components,
    )


@router.get("/{result_id}/pipeline-state", response_model=ResultPipelineStateResponse)
async def get_result_pipeline_state(
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
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    state = (
        await db.execute(
            select(ResultPipelineState).where(ResultPipelineState.result_id == result_id)
        )
    ).scalar_one_or_none()

    if not state:
        state = await set_pipeline_stage(
            db,
            result_id=result.id,
            user_id=user_id,
            stage=stage_from_result_status(result.status),
            finished=result.status != "pending",
        )
        await db.commit()
        await db.refresh(state)
    return state


@router.get("/{result_id}", response_model=SearchResultDetailResponse)
async def get_result_detail(
    result_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get full result detail with items and documents.
    Fetches from PNCP API on first access and caches in DB.
    """
    # Load result with relationships
    query = (
        select(SearchResult)
        .options(
            selectinload(SearchResult.items),
            selectinload(SearchResult.documents),
        )
        .where(
            SearchResult.id == result_id,
            SearchResult.user_id == user_id,
        )
    )
    result = (await db.execute(query)).scalar_one_or_none()

    if not result:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    # Mark as read
    if not result.is_read:
        result.is_read = True

    # Fetch item/doc payloads in parallel on first access, then cache in DB.
    fetch_tasks = []
    if not result.items_fetched:
        fetch_tasks.append(_fetch_items_from_pncp(result))
    if not result.documents_fetched:
        fetch_tasks.append(_fetch_documents_from_pncp(result))

    if fetch_tasks:
        fetch_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)
        index = 0

        if not result.items_fetched:
            items_response = fetch_results[index]
            index += 1
            if isinstance(items_response, Exception):
                logger.warning(f"Failed to fetch items from PNCP: {items_response}")
            else:
                _cache_items(result, items_response)
            result.items_fetched = True

        if not result.documents_fetched:
            docs_response = fetch_results[index]
            if isinstance(docs_response, Exception):
                logger.warning(f"Failed to fetch documents from PNCP: {docs_response}")
            else:
                _cache_documents(result, docs_response)
            result.documents_fetched = True

    await db.commit()

    detail = SearchResultDetailResponse.model_validate(result)
    deduped_items = _dedupe_items_for_response(result.items)
    if len(deduped_items) != len(result.items):
        logger.warning(
            "Deduplicated result items for result %s: %s -> %s",
            result.id,
            len(result.items),
            len(deduped_items),
        )
    detail_items = [ResultItemResponse.model_validate(item) for item in deduped_items]
    return detail.model_copy(update={"items": detail_items})


@router.patch("/{result_id}/action", response_model=SearchResultResponse)
async def update_result_status(
    result_id: uuid.UUID,
    action: ResultActionRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Save or discard a result."""
    result = await db.execute(
        select(SearchResult).where(
            SearchResult.id == result_id,
            SearchResult.user_id == user_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Resultado não encontrado")

    item.status = action.action
    item.acted_at = datetime.utcnow()
    item.is_read = True
    await set_pipeline_stage(
        db,
        result_id=item.id,
        user_id=user_id,
        stage=stage_from_result_status(item.status),
        finished=True,
    )
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/batch-action")
async def batch_action(
    data: ResultBatchActionRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Save or discard multiple results at once."""
    now = datetime.utcnow()
    target_results = (
        await db.execute(
            select(SearchResult.id).where(
                and_(
                    SearchResult.id.in_(data.result_ids),
                    SearchResult.user_id == user_id,
                )
            )
        )
    ).scalars().all()

    stmt = (
        update(SearchResult)
        .where(
            and_(
                SearchResult.id.in_(data.result_ids),
                SearchResult.user_id == user_id,
            )
        )
        .values(status=data.action, acted_at=now, is_read=True)
    )
    result = await db.execute(stmt)
    for result_id in target_results:
        await set_pipeline_stage(
            db,
            result_id=result_id,
            user_id=user_id,
            stage=stage_from_result_status(data.action),
            finished=True,
            stage_started_at=now,
        )
    await db.commit()
    return {"updated": result.rowcount}


# ─── PNCP Data Fetchers ──────────────────────────────────────────────────────

async def _fetch_items_from_pncp(result: SearchResult) -> list[dict]:
    logger.info(
        f"Fetching items for {result.cnpj_orgao}/{result.ano_compra}/{result.sequencial_compra}"
    )
    response = await pncp_client.listar_itens_contratacao(
        cnpj=result.cnpj_orgao,
        ano=result.ano_compra,
        sequencial=result.sequencial_compra,
    )
    return response if isinstance(response, list) else response.get("data", [])


async def _fetch_documents_from_pncp(result: SearchResult) -> list[dict]:
    logger.info(
        f"Fetching documents for {result.cnpj_orgao}/{result.ano_compra}/{result.sequencial_compra}"
    )
    response = await pncp_client.consultar_documentos(
        cnpj=result.cnpj_orgao,
        ano=result.ano_compra,
        sequencial=result.sequencial_compra,
    )
    return response if isinstance(response, list) else response.get("data", [])


def _normalize_item_number(value: object) -> int:
    try:
        if value is None:
            return 0
        return int(value)
    except (TypeError, ValueError):
        return 0


def _item_dedupe_key(numero_item: object, descricao: object) -> tuple[str, int | str] | None:
    normalized_numero = _normalize_item_number(numero_item)
    if normalized_numero > 0:
        return ("numero_item", normalized_numero)

    normalized_desc = str(descricao or "").strip().lower()
    if normalized_desc:
        return ("descricao", normalized_desc)

    return None


def _item_quality_score(item: ResultItem) -> int:
    score = 0
    fields = (
        item.descricao,
        item.material_ou_servico,
        item.material_ou_servico_nome,
        item.valor_unitario_estimado,
        item.valor_total,
        item.quantidade,
        item.unidade_medida,
        item.situacao_compra_item_nome,
        item.criterio_julgamento_nome,
        item.tipo_beneficio_nome,
        item.tem_resultado,
        item.orcamento_sigiloso,
        item.item_categoria_nome,
        item.informacao_complementar,
    )
    for value in fields:
        if value is None:
            continue
        if isinstance(value, str):
            if value.strip():
                score += 1
        else:
            score += 1
    return score


def _apply_item_payload(item: ResultItem, item_data: dict):
    item.numero_item = _normalize_item_number(item_data.get("numeroItem"))
    item.descricao = (item_data.get("descricao") or "").strip() or None
    item.material_ou_servico = item_data.get("materialOuServico")
    item.material_ou_servico_nome = item_data.get("materialOuServicoNome")
    item.valor_unitario_estimado = item_data.get("valorUnitarioEstimado")
    item.valor_total = item_data.get("valorTotal")
    item.quantidade = item_data.get("quantidade")
    item.unidade_medida = item_data.get("unidadeMedida")
    item.situacao_compra_item_nome = item_data.get("situacaoCompraItemNome")
    item.criterio_julgamento_nome = item_data.get("criterioJulgamentoNome")
    item.tipo_beneficio_nome = item_data.get("tipoBeneficioNome")
    item.tem_resultado = item_data.get("temResultado")
    item.orcamento_sigiloso = item_data.get("orcamentoSigiloso")
    item.item_categoria_nome = item_data.get("itemCategoriaNome")
    item.informacao_complementar = item_data.get("informacaoComplementar")


def _dedupe_items_for_response(items: list[ResultItem]) -> list[ResultItem]:
    deduped: list[ResultItem] = []
    by_key_index: dict[tuple[str, int | str], int] = {}

    for item in items:
        key = _item_dedupe_key(item.numero_item, item.descricao)
        if key is None:
            deduped.append(item)
            continue

        existing_index = by_key_index.get(key)
        if existing_index is None:
            by_key_index[key] = len(deduped)
            deduped.append(item)
            continue

        existing_item = deduped[existing_index]
        if _item_quality_score(item) > _item_quality_score(existing_item):
            deduped[existing_index] = item

    deduped.sort(key=lambda item: (item.numero_item or 0, (item.descricao or "").strip().lower()))
    return deduped


def _cache_items(result: SearchResult, items_data: list[dict]):
    existing_items_by_key: dict[tuple[str, int | str], ResultItem] = {}
    for existing_item in result.items:
        key = _item_dedupe_key(existing_item.numero_item, existing_item.descricao)
        if key is None:
            continue

        known = existing_items_by_key.get(key)
        if not known or _item_quality_score(existing_item) > _item_quality_score(known):
            existing_items_by_key[key] = existing_item

    added = 0
    updated = 0

    for item_data in items_data:
        dedupe_key = _item_dedupe_key(item_data.get("numeroItem"), item_data.get("descricao"))
        if dedupe_key is not None and dedupe_key in existing_items_by_key:
            _apply_item_payload(existing_items_by_key[dedupe_key], item_data)
            updated += 1
            continue

        db_item = ResultItem(result_id=result.id, numero_item=0)
        _apply_item_payload(db_item, item_data)
        result.items.append(db_item)
        if dedupe_key is not None:
            existing_items_by_key[dedupe_key] = db_item
        added += 1

    logger.info(
        "Cached items for result %s: added=%s updated=%s",
        result.id,
        added,
        updated,
    )


def _cache_documents(result: SearchResult, docs_data: list[dict]):
    existing_keys = {
        (
            doc.sequencial_documento,
            (doc.titulo or "").strip().lower(),
            (doc.url or doc.uri or "").strip(),
        )
        for doc in result.documents
    }
    added = 0

    for doc_data in docs_data:
        seq = doc_data.get("sequencialDocumento")
        titulo = (doc_data.get("titulo") or "").strip()
        resolved_url = (doc_data.get("url") or doc_data.get("uri") or "").strip()
        dedupe_key = (seq, titulo.lower(), resolved_url)
        if dedupe_key in existing_keys:
            continue

        download_url = None
        if seq:
            download_url = (
                f"https://pncp.gov.br/api/pncp/v1/orgaos/{result.cnpj_orgao}"
                f"/compras/{result.ano_compra}/{result.sequencial_compra}"
                f"/arquivos/{seq}"
            )

        db_doc = ResultDocument(
            result_id=result.id,
            sequencial_documento=seq,
            titulo=titulo or None,
            tipo_documento_id=doc_data.get("tipoDocumentoId"),
            tipo_documento_nome=doc_data.get("tipoDocumentoNome"),
            tipo_documento_descricao=doc_data.get("tipoDocumentoDescricao"),
            url=doc_data.get("url") or download_url,
            uri=doc_data.get("uri"),
            status_ativo=doc_data.get("statusAtivo", True),
            data_publicacao_pncp=_parse_datetime(doc_data.get("dataPublicacaoPncp")),
        )
        result.documents.append(db_doc)
        existing_keys.add(dedupe_key)
        added += 1

    logger.info(f"Cached {added} new documents for result {result.id}")


def _parse_datetime(value: str | None) -> datetime | None:
    """Parse PNCP datetime strings."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
