"""
EditalAnalyzer — Sub-agent that orchestrates PDF analysis of bid documents.
Pipeline: receive PDF → extract text → analyze with LLM → save results.
"""
import logging
import os
import time
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import AnalysisTechnicalEvidence, EditalAnalysis, ResultDocument
from app.agent.pdf_tools import extract_pdf_text, download_pncp_pdf, analyze_edital_text
from app.services.pipeline_state import set_pipeline_stage
from app.services.technical_evidence import extract_technical_evidences

logger = logging.getLogger(__name__)
settings = get_settings()


class EditalAnalyzer:
    """Sub-agent for analyzing bid document PDFs."""

    async def analyze_from_upload(
        self,
        pdf_bytes: bytes,
        filename: str,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> EditalAnalysis:
        """
        Analyze a PDF uploaded by the user.
        Pipeline: save PDF → extract text → analyze with LLM → save results.
        """
        # Create analysis record
        analysis = EditalAnalysis(
            user_id=user_id,
            source_type="upload",
            pdf_filename=filename,
            pdf_size_bytes=len(pdf_bytes),
            status="processing",
        )
        db.add(analysis)
        await db.flush()

        try:
            # Save PDF to disk
            upload_dir = settings.pdf_upload_dir
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, f"{analysis.id}_{filename}")
            with open(file_path, "wb") as f:
                f.write(pdf_bytes)
            analysis.pdf_storage_path = file_path

            # Run pipeline
            await self._run_pipeline(analysis, pdf_bytes, db)

        except Exception as e:
            analysis.status = "error"
            analysis.error_message = str(e)[:1000]
            logger.error(f"Upload analysis failed for {filename}: {e}")
            if analysis.result_id:
                await set_pipeline_stage(
                    db,
                    result_id=analysis.result_id,
                    user_id=user_id,
                    stage="analysis_error",
                    stage_error=analysis.error_message,
                    finished=True,
                )

        await db.commit()
        return analysis

    async def analyze_from_pncp(
        self,
        document_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession,
    ) -> EditalAnalysis:
        """
        Analyze a document from the PNCP by downloading its PDF.
        Pipeline: fetch document URL → download → extract text → analyze.
        """
        # Find the document
        doc = await db.get(ResultDocument, document_id)
        if not doc:
            raise ValueError(f"Documento não encontrado: {document_id}")

        if not doc.url:
            raise ValueError("Documento sem URL de download disponível")

        # Create analysis record
        analysis = EditalAnalysis(
            user_id=user_id,
            result_id=doc.result_id,
            document_id=document_id,
            source_type="pncp_download",
            pdf_filename=doc.titulo or f"documento_{doc.sequencial_documento}",
            status="processing",
        )
        db.add(analysis)
        await db.flush()

        try:
            await set_pipeline_stage(
                db,
                result_id=doc.result_id,
                user_id=user_id,
                stage="analysis_processing",
                finished=False,
            )

            # Download PDF from PNCP
            pdf_bytes, content_type = await download_pncp_pdf(doc.url)
            analysis.pdf_size_bytes = len(pdf_bytes)

            # Save PDF to disk
            upload_dir = settings.pdf_upload_dir
            os.makedirs(upload_dir, exist_ok=True)
            safe_name = f"{analysis.id}_{doc.sequencial_documento or 'doc'}.pdf"
            file_path = os.path.join(upload_dir, safe_name)
            with open(file_path, "wb") as f:
                f.write(pdf_bytes)
            analysis.pdf_storage_path = file_path

            # Run pipeline
            await self._run_pipeline(analysis, pdf_bytes, db)

        except Exception as e:
            analysis.status = "error"
            analysis.error_message = str(e)[:1000]
            logger.error(f"PNCP analysis failed for document {document_id}: {e}")
            await set_pipeline_stage(
                db,
                result_id=doc.result_id,
                user_id=user_id,
                stage="analysis_error",
                stage_error=analysis.error_message,
                finished=True,
            )

        await db.commit()
        return analysis

    async def _run_pipeline(
        self,
        analysis: EditalAnalysis,
        pdf_bytes: bytes,
        db: AsyncSession,
    ):
        """Core pipeline: extract text → analyze with LLM → save."""
        start_time = time.time()

        # Step 1: Extract text from PDF
        logger.info(f"Extracting text from PDF ({len(pdf_bytes)} bytes)...")
        extraction = await extract_pdf_text(
            pdf_bytes,
            max_pages=settings.analysis_max_pages,
            ocr_enabled=settings.ocr_enabled,
            ocr_min_chars_per_page=settings.ocr_min_chars_per_page,
            ocr_page_render_dpi=settings.ocr_page_render_dpi,
            ocr_request_timeout_sec=settings.ocr_request_timeout_sec,
            ocr_max_retries=settings.ocr_max_retries,
            ocr_max_concurrency=settings.ocr_max_concurrency,
            ocr_model=settings.openai_ocr_model,
        )
        analysis.extracted_text = extraction["text"]
        analysis.page_count = extraction["page_count"]

        if not extraction["text"].strip():
            raise ValueError(
                "EMPTY_TEXT_AFTER_OCR: Não foi possível extrair texto legível do PDF."
            )

        logger.info(
            "Extracted %s chars from %s/%s pages "
            "(method=%s, ocr_pages=%s, ocr_chars=%s, ocr_ms=%s, ocr_errors=%s)",
            extraction["char_count"],
            extraction["pages_processed"],
            extraction["page_count"],
            extraction.get("extraction_method", "native"),
            extraction.get("ocr_pages_processed", 0),
            extraction.get("ocr_char_count", 0),
            extraction.get("ocr_duration_ms", 0),
            extraction.get("ocr_provider_errors", 0),
        )

        # Step 2: Analyze with LLM
        logger.info("Sending to LLM for analysis...")
        llm_result = await analyze_edital_text(extraction["text"])

        analysis.analysis_data = llm_result["analysis"]
        analysis.llm_model = llm_result["model"]
        analysis.tokens_used = llm_result["tokens_used"]

        total_ms = int((time.time() - start_time) * 1000)
        analysis.processing_time_ms = total_ms

        # Step 3: Mark as completed
        analysis.status = "completed"
        analysis.completed_at = datetime.utcnow()

        evidences = extract_technical_evidences(llm_result["analysis"])
        if evidences:
            await db.execute(
                AnalysisTechnicalEvidence.__table__.delete().where(
                    AnalysisTechnicalEvidence.analysis_id == analysis.id
                )
            )
            for evidence in evidences:
                db.add(
                    AnalysisTechnicalEvidence(
                        analysis_id=analysis.id,
                        result_id=analysis.result_id,
                        user_id=analysis.user_id,
                        clause_ref=evidence.get("clause_ref"),
                        source_text=evidence["source_text"],
                        confidence=float(evidence.get("confidence") or 0.75),
                    )
                )

        if analysis.result_id:
            await set_pipeline_stage(
                db,
                result_id=analysis.result_id,
                user_id=analysis.user_id,
                stage="analysis_completed",
                finished=True,
            )

        logger.info(
            f"Analysis completed in {total_ms}ms — "
            f"model={llm_result['model']}, tokens={llm_result['tokens_used']}"
        )


# Singleton
edital_analyzer = EditalAnalyzer()
