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
from app.models import EditalAnalysis, ResultDocument
from app.agent.pdf_tools import extract_pdf_text, download_pncp_pdf, analyze_edital_text

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
        extraction = extract_pdf_text(pdf_bytes, max_pages=settings.analysis_max_pages)
        analysis.extracted_text = extraction["text"]
        analysis.page_count = extraction["page_count"]

        if not extraction["text"].strip():
            raise ValueError(
                "Não foi possível extrair texto do PDF. "
                "O documento pode ser uma imagem escaneada sem OCR."
            )

        logger.info(
            f"Extracted {extraction['char_count']} chars from "
            f"{extraction['pages_processed']}/{extraction['page_count']} pages"
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

        logger.info(
            f"Analysis completed in {total_ms}ms — "
            f"model={llm_result['model']}, tokens={llm_result['tokens_used']}"
        )


# Singleton
edital_analyzer = EditalAnalyzer()
