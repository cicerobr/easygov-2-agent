"""
API Routes — Search Results (Inbox)
"""
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import SearchResult, ResultItem, ResultDocument
from app.pncp_client import pncp_client
from app.schemas import (
    SearchResultResponse, SearchResultDetailResponse,
    PaginatedResults, ResultActionRequest, ResultBatchActionRequest,
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
    pending = (await db.execute(
        select(func.count()).select_from(SearchResult).where(
            SearchResult.user_id == user_id, SearchResult.status == "pending"
        )
    )).scalar() or 0

    unread = (await db.execute(
        select(func.count()).select_from(SearchResult).where(
            SearchResult.user_id == user_id, SearchResult.is_read == False
        )
    )).scalar() or 0

    saved = (await db.execute(
        select(func.count()).select_from(SearchResult).where(
            SearchResult.user_id == user_id, SearchResult.status == "saved"
        )
    )).scalar() or 0

    discarded = (await db.execute(
        select(func.count()).select_from(SearchResult).where(
            SearchResult.user_id == user_id, SearchResult.status == "discarded"
        )
    )).scalar() or 0

    return {
        "pending": pending,
        "unread": unread,
        "saved": saved,
        "discarded": discarded,
        "total": pending + saved + discarded,
    }


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

    # Fetch items from PNCP if not cached
    if not result.items_fetched:
        await _fetch_and_cache_items(result, db)

    # Fetch documents from PNCP if not cached
    if not result.documents_fetched:
        await _fetch_and_cache_documents(result, db)

    await db.commit()

    # Reload with fresh data
    await db.refresh(result)
    result_reloaded = (await db.execute(
        select(SearchResult)
        .options(
            selectinload(SearchResult.items),
            selectinload(SearchResult.documents),
        )
        .where(SearchResult.id == result_id)
    )).scalar_one()

    return result_reloaded


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
    await db.commit()
    return {"updated": result.rowcount}


# ─── PNCP Data Fetchers ──────────────────────────────────────────────────────

async def _fetch_and_cache_items(result: SearchResult, db: AsyncSession):
    """Fetch items from PNCP API and cache in DB."""
    try:
        logger.info(
            f"Fetching items for {result.cnpj_orgao}/{result.ano_compra}/{result.sequencial_compra}"
        )
        response = await pncp_client.listar_itens_contratacao(
            cnpj=result.cnpj_orgao,
            ano=result.ano_compra,
            sequencial=result.sequencial_compra,
        )

        # The API can return a list directly or a paginated dict
        items_data = response if isinstance(response, list) else response.get("data", [])

        for item_data in items_data:
            db_item = ResultItem(
                result_id=result.id,
                numero_item=item_data.get("numeroItem", 0),
                descricao=item_data.get("descricao"),
                material_ou_servico=item_data.get("materialOuServico"),
                material_ou_servico_nome=item_data.get("materialOuServicoNome"),
                valor_unitario_estimado=item_data.get("valorUnitarioEstimado"),
                valor_total=item_data.get("valorTotal"),
                quantidade=item_data.get("quantidade"),
                unidade_medida=item_data.get("unidadeMedida"),
                situacao_compra_item_nome=item_data.get("situacaoCompraItemNome"),
                criterio_julgamento_nome=item_data.get("criterioJulgamentoNome"),
                tipo_beneficio_nome=item_data.get("tipoBeneficioNome"),
                tem_resultado=item_data.get("temResultado"),
                orcamento_sigiloso=item_data.get("orcamentoSigiloso"),
                item_categoria_nome=item_data.get("itemCategoriaNome"),
                informacao_complementar=item_data.get("informacaoComplementar"),
            )
            db.add(db_item)

        result.items_fetched = True
        logger.info(f"Cached {len(items_data)} items for result {result.id}")

    except Exception as e:
        logger.warning(f"Failed to fetch items from PNCP: {e}")
        result.items_fetched = True  # Mark as attempted to avoid repeated failures


async def _fetch_and_cache_documents(result: SearchResult, db: AsyncSession):
    """Fetch documents from PNCP API and cache in DB."""
    try:
        logger.info(
            f"Fetching documents for {result.cnpj_orgao}/{result.ano_compra}/{result.sequencial_compra}"
        )
        response = await pncp_client.consultar_documentos(
            cnpj=result.cnpj_orgao,
            ano=result.ano_compra,
            sequencial=result.sequencial_compra,
        )

        # The API can return a list directly or a paginated dict
        docs_data = response if isinstance(response, list) else response.get("data", [])

        for doc_data in docs_data:
            # Build download URL
            seq = doc_data.get("sequencialDocumento")
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
                titulo=doc_data.get("titulo"),
                tipo_documento_id=doc_data.get("tipoDocumentoId"),
                tipo_documento_nome=doc_data.get("tipoDocumentoNome"),
                tipo_documento_descricao=doc_data.get("tipoDocumentoDescricao"),
                url=doc_data.get("url") or download_url,
                uri=doc_data.get("uri"),
                status_ativo=doc_data.get("statusAtivo", True),
                data_publicacao_pncp=_parse_datetime(doc_data.get("dataPublicacaoPncp")),
            )
            db.add(db_doc)

        result.documents_fetched = True
        logger.info(f"Cached {len(docs_data)} documents for result {result.id}")

    except Exception as e:
        logger.warning(f"Failed to fetch documents from PNCP: {e}")
        result.documents_fetched = True  # Mark as attempted to avoid repeated failures


def _parse_datetime(value: str | None) -> datetime | None:
    """Parse PNCP datetime strings."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
