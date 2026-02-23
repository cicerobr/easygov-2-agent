"""
API Routes — Edital PDF Analysis
"""
import logging
import math
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EditalAnalysis, ResultDocument
from app.schemas import (
    EditalAnalysisResponse,
    EditalAnalysisListResponse,
    AnalyzeFromPncpRequest,
    AnalyzeBatchFromPncpRequest,
)
from app.agent.pdf_analyzer import edital_analyzer
from app.config import get_settings

router = APIRouter(prefix="/analysis", tags=["Análise de Editais"])
logger = logging.getLogger(__name__)
settings = get_settings()


def get_current_user_id(user_id: str = Query(..., alias="user_id")) -> uuid.UUID:
    return uuid.UUID(user_id)


# ─── Upload & Analyze ────────────────────────────────────────────────────────

@router.post("/upload", response_model=EditalAnalysisResponse)
async def upload_and_analyze(
    file: UploadFile = File(...),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF file and analyze it."""
    # Validate file
    if not file.filename:
        raise HTTPException(400, "Nome do arquivo é obrigatório")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Apenas arquivos PDF são aceitos")

    # Read file
    pdf_bytes = await file.read()

    max_bytes = settings.pdf_max_size_mb * 1024 * 1024
    if len(pdf_bytes) > max_bytes:
        raise HTTPException(400, f"Arquivo excede o limite de {settings.pdf_max_size_mb}MB")

    if len(pdf_bytes) == 0:
        raise HTTPException(400, "Arquivo vazio")

    # Analyze
    analysis = await edital_analyzer.analyze_from_upload(
        pdf_bytes=pdf_bytes,
        filename=file.filename,
        user_id=user_id,
        db=db,
    )

    return analysis


@router.post("/upload-batch", response_model=list[EditalAnalysisResponse])
async def upload_and_analyze_batch(
    files: list[UploadFile] = File(...),
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload multiple PDF files and analyze them."""
    if len(files) > 10:
        raise HTTPException(400, "Máximo de 10 arquivos por vez")

    results = []
    for file in files:
        if not file.filename or not file.filename.lower().endswith(".pdf"):
            continue

        pdf_bytes = await file.read()
        max_bytes = settings.pdf_max_size_mb * 1024 * 1024
        if len(pdf_bytes) > max_bytes or len(pdf_bytes) == 0:
            continue

        analysis = await edital_analyzer.analyze_from_upload(
            pdf_bytes=pdf_bytes,
            filename=file.filename,
            user_id=user_id,
            db=db,
        )
        results.append(analysis)

    return results


# ─── Analyze from PNCP ───────────────────────────────────────────────────────

@router.post("/from-pncp", response_model=EditalAnalysisResponse)
async def analyze_from_pncp(
    body: AnalyzeFromPncpRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Download a document from PNCP and analyze it."""
    analysis = await edital_analyzer.analyze_from_pncp(
        document_id=body.document_id,
        user_id=user_id,
        db=db,
    )
    return analysis


@router.post("/batch-from-pncp", response_model=list[EditalAnalysisResponse])
async def analyze_batch_from_pncp(
    body: AnalyzeBatchFromPncpRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Download and analyze multiple documents from PNCP."""
    if len(body.document_ids) > 10:
        raise HTTPException(400, "Máximo de 10 documentos por vez")

    results = []
    for doc_id in body.document_ids:
        try:
            analysis = await edital_analyzer.analyze_from_pncp(
                document_id=doc_id,
                user_id=user_id,
                db=db,
            )
            results.append(analysis)
        except Exception as e:
            logger.error(f"Failed to analyze document {doc_id}: {e}")

    return results


# ─── List & Get Analyses ─────────────────────────────────────────────────────

@router.get("", response_model=EditalAnalysisListResponse)
async def list_analyses(
    user_id: uuid.UUID = Depends(get_current_user_id),
    status: str = Query(default="all", pattern="^(all|pending|processing|completed|error)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List all analyses for the user."""
    query = select(EditalAnalysis).where(EditalAnalysis.user_id == user_id)

    if status != "all":
        query = query.where(EditalAnalysis.status == status)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Paginate
    query = query.order_by(desc(EditalAnalysis.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    analyses = result.scalars().all()

    return EditalAnalysisListResponse(
        data=analyses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/stats")
async def get_analysis_stats(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get analysis statistics."""
    stats = (await db.execute(
        select(
            func.count().label("total"),
            func.count().filter(EditalAnalysis.status == "completed").label("completed"),
            func.count().filter(EditalAnalysis.status == "processing").label("processing"),
            func.count().filter(EditalAnalysis.status == "error").label("errors"),
        ).where(EditalAnalysis.user_id == user_id)
    )).one()

    return {
        "total": stats.total or 0,
        "completed": stats.completed or 0,
        "processing": stats.processing or 0,
        "errors": stats.errors or 0,
    }


@router.get("/by-result/{result_id}", response_model=EditalAnalysisResponse | None)
async def get_analysis_by_result(
    result_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the most recent completed analysis for a result, or null if none."""
    query = (
        select(EditalAnalysis)
        .where(
            EditalAnalysis.result_id == result_id,
            EditalAnalysis.user_id == user_id,
            EditalAnalysis.status == "completed",
        )
        .order_by(desc(EditalAnalysis.created_at))
        .limit(1)
    )
    result = await db.execute(query)
    analysis = result.scalar_one_or_none()
    return analysis


@router.get("/{analysis_id}", response_model=EditalAnalysisResponse)
async def get_analysis(
    analysis_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific analysis result."""
    analysis = await db.get(EditalAnalysis, analysis_id)
    if not analysis or analysis.user_id != user_id:
        raise HTTPException(404, "Análise não encontrada")
    return analysis


@router.delete("/{analysis_id}")
async def delete_analysis(
    analysis_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete an analysis."""
    analysis = await db.get(EditalAnalysis, analysis_id)
    if not analysis or analysis.user_id != user_id:
        raise HTTPException(404, "Análise não encontrada")

    await db.delete(analysis)
    await db.commit()
    return {"ok": True}
