"""
PDF Tools — Tools for the Edital Analyzer sub-agent.
Handles PDF text extraction, PNCP PDF download, and LLM analysis.
"""
import asyncio
import base64
import json
import logging
import re
import time
from typing import Any, Optional

import fitz  # PyMuPDF
import httpx
from openai import AsyncOpenAI

from app.config import get_settings
from app.agent.opportunity_tag import apply_opportunity_tag_rule

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── System Prompt ────────────────────────────────────────────────────────────

EDITAL_ANALYSIS_PROMPT = """Você é um especialista em análise de editais de licitação pública brasileira, com foco em extração detalhada de itens para precificação e busca de fornecedores.

Analise o texto do edital fornecido e extraia as informações mais importantes no formato JSON abaixo. 
Se alguma informação não estiver disponível no texto, use null.

IMPORTANTE:
- Seja preciso e objetivo nas extrações.
- Valores monetários devem ser números (sem "R$" ou pontos de milhar).
- Datas devem estar no formato "DD/MM/AAAA" ou "DD/MM/AAAA HH:MM" quando houver horário.
- ITENS: Extraia TODOS os itens com o máximo de detalhes possível. Esta é a informação MAIS IMPORTANTE do edital. Inclua especificações técnicas completas, marcas de referência, códigos NCM e agrupamento por lotes.
- HABILITAÇÃO TÉCNICA: detalhe EXATAMENTE cada exigência técnica identificada (documento, escopo, quantitativo/percentual, prazo, órgão emissor/conselho, CAT/acervo/registro/atestado quando houver).
- Em "habilitacao.tecnica_texto_integral", transcreva os trechos integrais do edital referentes à qualificação técnica, preservando os parágrafos originais (sem resumir e sem parafrasear).
- NÃO use placeholders genéricos como "documentos de qualificação técnica exigidos". Sempre descreva o que foi exigido.
- Se o edital NÃO exigir qualificação/capacidade técnica, registre explicitamente em "habilitacao.tecnica" algo como: "Não exige atestado de capacidade técnica nem documentos de qualificação técnica."
- Identifique riscos ou cláusulas restritivas que possam dificultar a participação.
- TAG DE OPORTUNIDADE: inclua a tag "Oportunidade" SOMENTE quando a modalidade for DISPENSA e houver indicação explícita de que NÃO existe exigência de qualificação/capacidade técnica (incluindo atestado). Em qualquer outro caso, não inclua essa tag.
- Sempre retorne o campo "tags" como array de strings (vazio quando não houver tags).

Retorne APENAS o JSON, sem markdown ou texto adicional.

Formato JSON esperado:
{
    "objeto_resumo": "Resumo claro e conciso do objeto da contratação (máx 200 caracteres)",
    "objeto_detalhado": "Descrição completa do objeto da licitação",
    "orgao": {
        "nome": "Nome do órgão/entidade contratante",
        "cnpj": "CNPJ se disponível",
        "uf": "Sigla do estado",
        "municipio": "Nome do município",
        "endereco": "Endereço completo se disponível"
    },
    "licitacao": {
        "modalidade": "Modalidade (Pregão Eletrônico, Dispensa, Concorrência, etc.)",
        "modo_disputa": "Modo de disputa (Aberto, Fechado, Aberto-Fechado)",
        "numero_processo": "Número do processo administrativo",
        "numero_edital": "Número do edital",
        "criterio_julgamento": "Menor preço / Técnica e preço / Maior desconto / etc.",
        "tipo_beneficio": "ME/EPP, Ampla participação, etc.",
        "srp": true,
        "exclusivo_me_epp": false
    },
    "valores": {
        "valor_total_estimado": 0.00,
        "valor_maximo_aceitavel": null
    },
    "datas": {
        "publicacao": "DD/MM/AAAA",
        "abertura_propostas": "DD/MM/AAAA HH:MM",
        "encerramento_propostas": "DD/MM/AAAA HH:MM",
        "inicio_disputa": "DD/MM/AAAA HH:MM",
        "prazo_impugnacao": "DD/MM/AAAA",
        "prazo_esclarecimentos": "DD/MM/AAAA"
    },
    "itens": [
        {
            "numero": 1,
            "grupo_lote": "Número ou nome do lote/grupo se aplicável, ou null se item avulso",
            "descricao": "Descrição do item conforme edital",
            "especificacao_tecnica": "Especificação técnica completa e detalhada do item, incluindo dimensões, composição, normas técnicas, etc.",
            "marca_referencia": "Marca(s) de referência citada(s) no edital, ou null",
            "quantidade": 0,
            "unidade": "Unidade de medida",
            "valor_unitario_estimado": 0.00,
            "valor_total_estimado": 0.00,
            "catmat_catser": "Código CATMAT/CATSER se disponível",
            "ncm": "Código NCM se disponível",
            "exclusivo_me_epp": false,
            "amostra_exigida": false,
            "prazo_entrega_item": "Prazo de entrega específico do item se diferente do geral",
            "local_entrega_item": "Local de entrega específico do item se diferente do geral"
        }
    ],
    "habilitacao": {
        "juridica": ["Documentos de habilitação jurídica exigidos"],
        "fiscal": ["Documentos de regularidade fiscal exigidos"],
        "trabalhista": ["Documentos de regularidade trabalhista exigidos"],
        "economica": ["Documentos de qualificação econômico-financeira"],
        "tecnica_texto_integral": [
            "8.5 Qualificação técnica: Será exigido atestado de capacidade técnica emitido por pessoa jurídica de direito público ou privado. O atestado deve comprovar execução de no mínimo 30% do quantitativo do objeto."
        ],
        "tecnica": [
            "Atestado de capacidade técnica compatível com o objeto, emitido por pessoa jurídica de direito público ou privado, comprovando execução de serviço similar em no mínimo 50% do quantitativo.",
            "Registro da empresa e do responsável técnico no CREA/CAU, com certidão de regularidade válida."
        ]
    },
    "entrega": {
        "prazo": "Prazo de entrega/execução",
        "local": "Local de entrega/execução",
        "condicoes": "Condições especiais de entrega/execução"
    },
    "pagamento": {
        "condicoes": "Condições de pagamento",
        "prazo": "Prazo de pagamento após aceite"
    },
    "garantia": {
        "exige_garantia": false,
        "percentual": null,
        "detalhes": null
    },
    "observacoes": [
        "Pontos de atenção, cláusulas restritivas, ou riscos identificados"
    ],
    "contatos": {
        "pregoeiro": "Nome do pregoeiro/responsável se disponível",
        "email": "Email de contato se disponível",
        "telefone": "Telefone se disponível"
    },
    "tags": [
        "Oportunidade"
    ]
}"""

OCR_TRANSCRIPTION_PROMPT = """Transcreva fielmente o conteúdo textual desta página de edital.
Regras:
- Não resuma, não interprete e não traduza.
- Preserve números, unidades, percentuais, datas, CNPJ, cabeçalhos e tabelas em texto corrido.
- Retorne somente o texto transcrito.
"""

TECHNICAL_REQUIREMENTS_ENRICH_PROMPT = """Você é especialista em análise de editais públicos.
Extraia APENAS as exigências de QUALIFICAÇÃO/CAPACIDADE TÉCNICA do texto.

Retorne JSON no formato:
{
  "tecnica": [
    "Descrição específica da exigência técnica (documento, escopo, quantitativo/percentual, conselho/registro, prazo/condição)."
  ]
}

Regras obrigatórias:
- Não use frases genéricas como "documentos de qualificação técnica exigidos".
- Cada item deve conter detalhe concreto do que foi exigido.
- Inclua, quando houver no texto, referência de item/cláusula/anexo do edital.
- Inclua quantitativo mínimo/percentual/prazo/órgão emissor/conselho profissional quando citados.
- Se NÃO houver exigência técnica, retorne exatamente:
  ["Não exige atestado de capacidade técnica nem documentos de qualificação técnica."]
- Retorne somente JSON.
"""

OCR_MAX_IMAGE_SIDE_PX = 2200


# ─── PDF Text Extraction ─────────────────────────────────────────────────────

async def extract_pdf_text(
    pdf_bytes: bytes,
    max_pages: int = 200,
    ocr_enabled: Optional[bool] = None,
    ocr_min_chars_per_page: Optional[int] = None,
    ocr_page_render_dpi: Optional[int] = None,
    ocr_request_timeout_sec: Optional[int] = None,
    ocr_max_retries: Optional[int] = None,
    ocr_max_concurrency: Optional[int] = None,
    ocr_model: Optional[str] = None,
) -> dict[str, Any]:
    """
    Extract text from PDF with native text first and OCR fallback for scanned pages.

    Error codes:
    - PDF_EXTRACTION_ERROR
    - OCR_PROVIDER_ERROR
    - EMPTY_TEXT_AFTER_OCR
    """
    ocr_enabled = settings.ocr_enabled if ocr_enabled is None else ocr_enabled
    ocr_min_chars_per_page = (
        settings.ocr_min_chars_per_page
        if ocr_min_chars_per_page is None
        else ocr_min_chars_per_page
    )
    ocr_page_render_dpi = (
        settings.ocr_page_render_dpi
        if ocr_page_render_dpi is None
        else ocr_page_render_dpi
    )
    ocr_request_timeout_sec = (
        settings.ocr_request_timeout_sec
        if ocr_request_timeout_sec is None
        else ocr_request_timeout_sec
    )
    ocr_max_retries = settings.ocr_max_retries if ocr_max_retries is None else ocr_max_retries
    ocr_max_concurrency = (
        settings.ocr_max_concurrency if ocr_max_concurrency is None else ocr_max_concurrency
    )
    ocr_model = ocr_model or settings.openai_ocr_model

    doc: Optional[fitz.Document] = None
    client: Optional[AsyncOpenAI] = None
    ocr_start = 0.0

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        pages_to_process = min(total_pages, max_pages)

        native_by_page: dict[int, str] = {}
        final_by_page: dict[int, str] = {}
        pages_needing_ocr: list[int] = []

        for page_index in range(pages_to_process):
            page = doc[page_index]
            native_text = (page.get_text("text") or "").strip()
            native_by_page[page_index] = native_text

            if ocr_enabled and _should_ocr_page(native_text, ocr_min_chars_per_page):
                pages_needing_ocr.append(page_index)
            else:
                final_by_page[page_index] = native_text

        ocr_pages_processed = 0
        native_char_count = sum(len(text) for text in native_by_page.values())
        ocr_char_count = 0
        ocr_provider_errors = 0

        if ocr_enabled and pages_needing_ocr:
            ocr_start = time.time()
            if settings.openai_api_key:
                client = AsyncOpenAI(
                    api_key=settings.openai_api_key,
                    timeout=ocr_request_timeout_sec,
                )
            else:
                logger.warning(
                    "OCR requested but OPENAI_API_KEY is not configured; "
                    "falling back to native extraction when available."
                )

            chunk_size = max(1, int(ocr_max_concurrency))
            for chunk_start in range(0, len(pages_needing_ocr), chunk_size):
                chunk_indexes = pages_needing_ocr[chunk_start: chunk_start + chunk_size]
                tasks = []
                for page_index in chunk_indexes:
                    if client is None:
                        tasks.append(asyncio.sleep(0, result=RuntimeError("OCR client unavailable")))
                        continue
                    image_data_url = _render_page_to_png_base64(
                        doc[page_index],
                        target_dpi=ocr_page_render_dpi,
                        max_side_px=OCR_MAX_IMAGE_SIDE_PX,
                    )
                    tasks.append(
                        _ocr_page_with_retry(
                            client=client,
                            image_data_url=image_data_url,
                            page_number=page_index + 1,
                            model=ocr_model,
                            max_retries=ocr_max_retries,
                        )
                    )

                results = await asyncio.gather(*tasks, return_exceptions=True)
                for page_index, result in zip(chunk_indexes, results):
                    if isinstance(result, Exception):
                        ocr_provider_errors += 1
                        fallback_text = native_by_page.get(page_index, "")
                        final_by_page[page_index] = fallback_text
                        logger.warning(
                            "OCR_PROVIDER_ERROR on page %s: %s",
                            page_index + 1,
                            result,
                        )
                        continue

                    ocr_text = _normalize_ocr_text(result)
                    if ocr_text:
                        final_by_page[page_index] = ocr_text
                        ocr_pages_processed += 1
                        ocr_char_count += len(ocr_text)
                    else:
                        final_by_page[page_index] = native_by_page.get(page_index, "")

        text_parts: list[str] = []
        pages_from_native = 0
        pages_from_ocr = 0

        for page_index in range(pages_to_process):
            page_text = (final_by_page.get(page_index) or "").strip()
            if not page_text:
                continue
            text_parts.append(f"--- Página {page_index + 1} ---\n{page_text}")

            native_page_text = native_by_page.get(page_index, "")
            if page_text == native_page_text:
                pages_from_native += 1
            else:
                pages_from_ocr += 1

        full_text = "\n\n".join(text_parts)
        if not full_text.strip():
            raise ValueError(
                "EMPTY_TEXT_AFTER_OCR: Não foi possível extrair texto legível "
                "do PDF (extração nativa + OCR)."
            )

        if pages_from_ocr == 0:
            extraction_method = "native"
        elif pages_from_native == 0:
            extraction_method = "ocr"
        else:
            extraction_method = "hybrid"

        ocr_duration_ms = int((time.time() - ocr_start) * 1000) if ocr_start else 0

        return {
            "text": full_text,
            "page_count": total_pages,
            "pages_processed": pages_to_process,
            "truncated": pages_to_process < total_pages,
            "char_count": len(full_text),
            "extraction_method": extraction_method,
            "ocr_pages_processed": ocr_pages_processed,
            "native_char_count": native_char_count,
            "ocr_char_count": ocr_char_count,
            "ocr_duration_ms": ocr_duration_ms,
            "ocr_provider_errors": ocr_provider_errors,
        }

    except ValueError:
        raise
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        raise ValueError(f"PDF_EXTRACTION_ERROR: Falha ao extrair texto do PDF: {str(e)}")
    finally:
        if doc is not None:
            doc.close()
        if client is not None:
            await client.close()


def _should_ocr_page(native_text: str, threshold: int) -> bool:
    return len((native_text or "").strip()) < max(0, threshold)


def _render_page_to_png_base64(
    page: fitz.Page,
    target_dpi: int,
    max_side_px: int,
) -> str:
    rect = page.rect
    width_points = max(1.0, float(rect.width))
    height_points = max(1.0, float(rect.height))

    effective_dpi = float(max(72, target_dpi))
    longest_side_px = max(width_points, height_points) * effective_dpi / 72.0
    if longest_side_px > max_side_px:
        effective_dpi = max_side_px * 72.0 / max(width_points, height_points)

    scale = effective_dpi / 72.0
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    image_bytes = pix.tobytes("png")
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _normalize_ocr_text(text: str) -> str:
    lines = [line.rstrip() for line in (text or "").splitlines()]
    collapsed: list[str] = []
    prev_blank = False
    for line in lines:
        is_blank = not line.strip()
        if is_blank and prev_blank:
            continue
        collapsed.append(line)
        prev_blank = is_blank
    return "\n".join(collapsed).strip()


async def _ocr_page_with_retry(
    client: AsyncOpenAI,
    image_data_url: str,
    page_number: int,
    model: str,
    max_retries: int,
) -> str:
    attempts = max(1, max_retries + 1)
    last_error: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        try:
            return await _ocr_page_with_openai(
                client=client,
                image_data_url=image_data_url,
                page_number=page_number,
                model=model,
            )
        except Exception as e:
            last_error = e
            if attempt >= attempts:
                break
            await asyncio.sleep(0.5 * attempt)

    raise RuntimeError(
        f"OCR_PROVIDER_ERROR: falha ao processar OCR da página {page_number}: {last_error}"
    )


async def _ocr_page_with_openai(
    client: AsyncOpenAI,
    image_data_url: str,
    page_number: int,
    model: str,
) -> str:
    response = await client.chat.completions.create(
        model=model,
        temperature=0,
        max_tokens=4000,
        messages=[
            {"role": "system", "content": OCR_TRANSCRIPTION_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"Transcreva fielmente o texto da página {page_number}. "
                            "Não inclua explicações."
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": image_data_url}},
                ],
            },
        ],
    )

    content = response.choices[0].message.content
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
                if text:
                    parts.append(str(text))
        return "\n".join(parts)

    return ""


# ─── PNCP PDF Download ───────────────────────────────────────────────────────

async def download_pncp_pdf(url: str) -> tuple[bytes, str]:
    """
    Download a PDF file from PNCP.
    
    Returns:
        Tuple of (pdf_bytes, content_type)
    """
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        
        content_type = response.headers.get("content-type", "")
        pdf_bytes = response.content
        
        if len(pdf_bytes) == 0:
            raise ValueError("PDF vazio retornado pelo PNCP")
        
        logger.info(f"Downloaded PDF from PNCP: {len(pdf_bytes)} bytes")
        return pdf_bytes, content_type


# ─── LLM Analysis ────────────────────────────────────────────────────────────

async def analyze_edital_text(text: str, model: str = None) -> dict:
    """
    Send extracted text to OpenAI LLM for structured analysis.
    
    Returns:
        dict with 'analysis' (parsed JSON), 'model', 'tokens_used', 'duration_ms'
    """
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY não configurada")
    
    model = model or settings.openai_model or "gpt-4o-mini"
    
    original_text = text
    # Truncate text if too long (approx 120K chars ≈ 30K tokens)
    max_chars = 120_000
    if len(text) > max_chars:
        original_len = len(text)
        text = text[:max_chars] + "\n\n[... TEXTO TRUNCADO POR LIMITE DE TAMANHO ...]"
        logger.warning("Text truncated from %s to %s chars", original_len, max_chars)
    
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    
    start_time = time.time()
    
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": EDITAL_ANALYSIS_PROMPT},
                {"role": "user", "content": f"Analise o seguinte edital:\n\n{text}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=16000,
        )
        
        duration_ms = int((time.time() - start_time) * 1000)
        
        content = response.choices[0].message.content
        tokens_used = response.usage.total_tokens if response.usage else 0
        
        # Parse JSON response
        try:
            analysis = json.loads(content)
            if isinstance(analysis, dict):
                await _enrich_technical_requirements_if_needed(
                    analysis=analysis,
                    source_text=original_text,
                    model=model,
                    client=client,
                )
                apply_opportunity_tag_rule(analysis)
        except json.JSONDecodeError:
            logger.error(f"LLM returned invalid JSON: {content[:500]}")
            analysis = {"raw_response": content, "parse_error": True}
        
        return {
            "analysis": analysis,
            "model": model,
            "tokens_used": tokens_used,
            "duration_ms": duration_ms,
        }
        
    except Exception as e:
        duration_ms = int((time.time() - start_time) * 1000)
        logger.error(f"LLM analysis error: {e}")
        raise ValueError(f"Falha na análise LLM: {str(e)}")
    finally:
        await client.close()


async def _enrich_technical_requirements_if_needed(
    analysis: dict[str, Any],
    source_text: str,
    model: str,
    client: AsyncOpenAI,
) -> None:
    habilitacao = analysis.get("habilitacao")
    existing_entries = _to_string_list(
        habilitacao.get("tecnica") if isinstance(habilitacao, dict) else None
    )
    integral_entries = _extract_full_technical_qualification_paragraphs(source_text)

    def _attach_integral_entries(candidates: list[str]) -> None:
        payload = integral_entries or candidates
        if not payload:
            return
        current_habilitacao = analysis.get("habilitacao")
        if not isinstance(current_habilitacao, dict):
            current_habilitacao = {}
            analysis["habilitacao"] = current_habilitacao
        current_habilitacao["tecnica_texto_integral"] = payload

    if _is_only_explicit_no_technical_requirement(existing_entries):
        _attach_integral_entries(existing_entries)
        return

    should_enrich = _needs_technical_detail_enrichment(analysis)
    if (
        not should_enrich
        and any(_has_concrete_technical_detail(entry) for entry in existing_entries)
    ):
        _attach_integral_entries(existing_entries)
        return

    text_for_enrichment = _build_technical_enrichment_context(source_text)
    try:
        enriched = await _extract_technical_requirements_with_llm(
            client=client,
            text=text_for_enrichment,
            model=model,
        )
    except Exception as e:
        logger.warning("Technical requirements enrichment failed: %s", e)
        return

    tecnica = enriched.get("tecnica")
    if not isinstance(tecnica, list):
        return

    clean_tecnica = [str(item).strip() for item in tecnica if str(item).strip()]
    if not clean_tecnica:
        return

    selected_tecnica = _choose_best_technical_entries(existing_entries, clean_tecnica)
    if not any(_has_concrete_technical_detail(entry) for entry in selected_tecnica):
        heuristic_tecnica = _extract_technical_requirements_from_text_heuristic(source_text)
        if heuristic_tecnica:
            selected_tecnica = _choose_best_technical_entries(
                selected_tecnica,
                heuristic_tecnica,
            )

    if not selected_tecnica:
        _attach_integral_entries(existing_entries)
        return

    habilitacao = analysis.get("habilitacao")
    if not isinstance(habilitacao, dict):
        habilitacao = {}
        analysis["habilitacao"] = habilitacao
    habilitacao["tecnica"] = selected_tecnica
    _attach_integral_entries(selected_tecnica)


async def _extract_technical_requirements_with_llm(
    client: AsyncOpenAI,
    text: str,
    model: str,
) -> dict[str, Any]:
    response = await client.chat.completions.create(
        model=model,
        temperature=0,
        response_format={"type": "json_object"},
        max_tokens=3000,
        messages=[
            {"role": "system", "content": TECHNICAL_REQUIREMENTS_ENRICH_PROMPT},
            {
                "role": "user",
                "content": (
                    "Extraia as exigências de qualificação/capacidade técnica do edital abaixo:\n\n"
                    f"{text}"
                ),
            },
        ],
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)


def _needs_technical_detail_enrichment(analysis: dict[str, Any]) -> bool:
    habilitacao = analysis.get("habilitacao")
    if not isinstance(habilitacao, dict):
        return True

    tecnica = habilitacao.get("tecnica")
    raw_entries = _to_string_list(tecnica)
    if not raw_entries:
        return True

    entries = _normalize_technical_entries(raw_entries)
    if not entries:
        return True

    if _is_only_explicit_no_technical_requirement(entries):
        return False

    # If any entry is generic/placeholder, force enrichment to get concrete details.
    if any(_is_generic_technical_entry(entry) for entry in raw_entries):
        return True

    # If entries do not contain concrete requirement evidence, enrich.
    if not any(_has_concrete_technical_detail(entry) for entry in entries):
        return True

    return False


def _build_technical_enrichment_context(source_text: str, max_chars: int = 120_000) -> str:
    text = (source_text or "").strip()
    if len(text) <= max_chars:
        return text

    lines = text.splitlines()
    selected_indexes: set[int] = set()
    context_window = 3

    for idx, line in enumerate(lines):
        normalized_line = _normalize_text(line)
        if any(marker in normalized_line for marker in _technical_context_markers()):
            start = max(0, idx - context_window)
            end = min(len(lines), idx + context_window + 1)
            selected_indexes.update(range(start, end))

    if selected_indexes:
        selected_lines = [lines[i] for i in sorted(selected_indexes)]
        focused = "\n".join(selected_lines).strip()
        if focused:
            return focused[:max_chars]

    # Fallback: keep head and tail, as requirements often appear in annexes.
    half = max_chars // 2
    return f"{text[:half]}\n\n[...]\n\n{text[-half:]}"


def _to_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return [str(value).strip()] if str(value).strip() else []


def _normalize_text(value: str) -> str:
    return (
        value.lower()
        .replace("á", "a")
        .replace("à", "a")
        .replace("â", "a")
        .replace("ã", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("ç", "c")
    )


def _technical_context_markers() -> tuple[str, ...]:
    return (
        "qualificacao tecnica",
        "capacidade tecnica",
        "atestado",
        "acervo tecnico",
        "certidao de acervo",
        "cat ",
        "registro profissional",
        "responsavel tecnico",
        "crea",
        "cau",
        "crt",
        "cft",
        "experiencia tecnica",
        "aptidao tecnica",
    )


def _is_explicit_no_technical_requirement(value: str) -> bool:
    text = _normalize_text(value)
    has_negative = any(
        marker in text
        for marker in (
            "nao exig",
            "nao ha exig",
            "sem exig",
            "dispensad",
            "nao sera obrigatorio",
            "nao obrigatorio",
        )
    )
    has_technical_context = any(marker in text for marker in _technical_context_markers())
    return has_negative and has_technical_context


def _is_generic_technical_entry(value: str) -> bool:
    text = _normalize_text(value)
    placeholder_markers = (
        "documentos de qualificacao tecnica exigidos",
        "qualificacao tecnica exigida",
        "conforme edital",
        "ver edital",
        "itens do edital",
        "item do edital",
        "etc",
    )
    return any(marker in text for marker in placeholder_markers) or len(text) < 40


def _has_concrete_technical_detail(value: str) -> bool:
    text = _normalize_text(value)
    if _is_generic_technical_entry(value):
        return False
    if _is_explicit_no_technical_requirement(value):
        return False

    has_marker = any(marker in text for marker in _technical_context_markers())
    has_numeric_detail = bool(re.search(r"\d", text)) or "%" in text
    has_clause_reference = bool(
        re.search(r"\b(item|subitem|clausula|anexo|secao|capitulo)\b", text)
    )
    return has_marker or has_numeric_detail or has_clause_reference or len(text) >= 120


def _is_only_explicit_no_technical_requirement(entries: list[str]) -> bool:
    return bool(entries) and all(
        _is_explicit_no_technical_requirement(entry) for entry in entries
    )


def _normalize_technical_entries(entries: list[str]) -> list[str]:
    unique_entries: list[str] = []
    seen: set[str] = set()
    for raw in entries:
        entry = str(raw).strip()
        if not entry:
            continue
        normalized = _normalize_text(entry)
        if normalized in seen:
            continue
        seen.add(normalized)
        unique_entries.append(entry)

    if not unique_entries:
        return []

    has_positive_requirement = any(
        not _is_explicit_no_technical_requirement(entry) for entry in unique_entries
    )
    filtered = unique_entries
    if has_positive_requirement:
        filtered = [
            entry
            for entry in unique_entries
            if not _is_explicit_no_technical_requirement(entry)
        ]

    if any(_has_concrete_technical_detail(entry) for entry in filtered):
        filtered = [entry for entry in filtered if not _is_generic_technical_entry(entry)]

    return filtered or unique_entries


def _dedupe_text_entries(entries: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for raw in entries:
        entry = str(raw).strip()
        if not entry:
            continue
        normalized = _normalize_text(entry)
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(entry)
    return deduped


def _technical_detail_score(entries: list[str]) -> int:
    score = 0
    for entry in entries:
        if _is_explicit_no_technical_requirement(entry):
            score += 1
        if _is_generic_technical_entry(entry):
            score -= 2
        if _has_concrete_technical_detail(entry):
            score += 5
        elif any(marker in _normalize_text(entry) for marker in _technical_context_markers()):
            score += 2
        score += min(len(entry), 180) // 90
    return score


def _choose_best_technical_entries(
    existing_entries: list[str],
    candidate_entries: list[str],
) -> list[str]:
    normalized_existing = _normalize_technical_entries(existing_entries)
    normalized_candidate = _normalize_technical_entries(candidate_entries)

    if not normalized_candidate:
        return normalized_existing
    if not normalized_existing:
        return normalized_candidate

    existing_only_no = _is_only_explicit_no_technical_requirement(normalized_existing)
    candidate_only_no = _is_only_explicit_no_technical_requirement(normalized_candidate)

    if existing_only_no and not candidate_only_no:
        return normalized_candidate
    if candidate_only_no and not existing_only_no:
        return normalized_existing

    if _technical_detail_score(normalized_candidate) >= _technical_detail_score(
        normalized_existing
    ):
        return normalized_candidate
    return normalized_existing


def _extract_technical_requirements_from_text_heuristic(
    source_text: str,
    max_items: int = 10,
) -> list[str]:
    lines = source_text.splitlines()
    raw_candidates: list[str] = []

    for idx, line in enumerate(lines):
        clean_line = " ".join((line or "").split()).strip()
        if len(clean_line) < 35:
            continue
        normalized = _normalize_text(clean_line)
        if not any(marker in normalized for marker in _technical_context_markers()):
            continue

        candidate = clean_line
        if idx + 1 < len(lines):
            next_line = " ".join((lines[idx + 1] or "").split()).strip()
            if next_line and not next_line.startswith("--- Página"):
                candidate = f"{candidate} {next_line}".strip()

        raw_candidates.append(candidate[:500])

    normalized_candidates = _normalize_technical_entries(raw_candidates)
    if len(normalized_candidates) > max_items:
        normalized_candidates = normalized_candidates[:max_items]
    return [_normalize_text(entry) for entry in normalized_candidates]


def _extract_full_technical_qualification_paragraphs(
    source_text: str,
    max_paragraphs: int = 40,
) -> list[str]:
    if not source_text or not source_text.strip():
        return []

    lines = source_text.splitlines()
    section_ranges = _find_technical_section_ranges(lines)
    collected: list[str] = []

    for start, end in section_ranges:
        block = "\n".join(lines[start:end]).strip()
        if not block:
            continue
        collected.extend(_split_text_into_paragraphs(block))

    if not collected:
        for paragraph in _split_text_into_paragraphs(source_text):
            normalized = _normalize_text(paragraph)
            if any(marker in normalized for marker in _technical_heading_markers()):
                collected.append(paragraph)

    normalized_collected = _dedupe_text_entries(collected)
    if len(normalized_collected) > max_paragraphs:
        normalized_collected = normalized_collected[:max_paragraphs]
    return normalized_collected


def _find_technical_section_ranges(lines: list[str]) -> list[tuple[int, int]]:
    if not lines:
        return []

    ranges: list[tuple[int, int]] = []
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        if not _is_technical_section_heading(line):
            idx += 1
            continue

        start = idx
        start_level = _extract_numbered_heading_level(line)
        idx += 1
        while idx < len(lines):
            current_line = lines[idx]
            current_level = _extract_numbered_heading_level(current_line)

            if (
                start_level is not None
                and current_level is not None
                and current_level > start_level
            ):
                idx += 1
                continue

            if (
                start_level is not None
                and current_level is not None
                and current_level <= start_level
                and _is_section_heading(current_line)
            ):
                break

            if _is_non_technical_section_heading(current_line):
                break
            idx += 1

        end = idx
        if end > start:
            ranges.append((start, end))

    return _merge_overlapping_ranges(ranges)


def _is_technical_section_heading(line: str) -> bool:
    text = " ".join((line or "").split()).strip()
    if not text or text.startswith("--- Página"):
        return False
    if not _is_section_heading(text):
        return False
    normalized = _normalize_text(text)
    if not any(
        marker in normalized for marker in _technical_heading_markers()
    ):
        return False

    return True


def _is_non_technical_section_heading(line: str) -> bool:
    text = " ".join((line or "").split()).strip()
    if not text or text.startswith("--- Página"):
        return False

    if not _is_section_heading(text):
        return False

    normalized = _normalize_text(text)
    if any(marker in normalized for marker in _technical_heading_markers()):
        return False

    non_technical_markers = (
        "habilitacao juridica",
        "regularidade fiscal",
        "regularidade trabalhista",
        "qualificacao economico-financeira",
        "proposta",
        "julgamento",
        "pagamento",
        "entrega",
        "garantia",
        "penalidade",
        "recurso",
        "impugnacao",
        "objeto",
        "disposicoes gerais",
        "anexo",
    )
    if any(marker in normalized for marker in non_technical_markers):
        return True

    return True


def _merge_overlapping_ranges(ranges: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if not ranges:
        return []

    sorted_ranges = sorted(ranges, key=lambda pair: pair[0])
    merged: list[tuple[int, int]] = [sorted_ranges[0]]

    for start, end in sorted_ranges[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end:
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))
    return merged


def _extract_numbered_heading_level(line: str) -> int | None:
    text = " ".join((line or "").split()).strip()
    if not text:
        return None
    match = re.match(r"^(\d+(?:\.\d+)*)[\)\].:-]?\s+", text)
    if not match:
        return None
    return len(match.group(1).split("."))


def _is_section_heading(line: str) -> bool:
    text = " ".join((line or "").split()).strip()
    if not text or text.startswith("--- Página"):
        return False
    if re.match(r"^\d+(\.\d+)*[\)\].:-]?\s+", text):
        return True
    if text.endswith(":") and len(text) <= 140:
        return True
    return len(text) <= 140 and text.isupper()


def _technical_heading_markers() -> tuple[str, ...]:
    return (
        "qualificacao tecnica",
        "habilitacao tecnica",
        "qualificacao tecnico-profissional",
        "qualificacao tecnico operacional",
    )


def _split_text_into_paragraphs(text: str) -> list[str]:
    paragraphs: list[str] = []
    current: list[str] = []

    for raw_line in text.splitlines():
        line = (raw_line or "").strip()
        if not line or line.startswith("--- Página"):
            if current:
                paragraph = " ".join(current).strip()
                if paragraph:
                    paragraphs.append(paragraph)
                current = []
            continue

        current.append(line)

    if current:
        paragraph = " ".join(current).strip()
        if paragraph:
            paragraphs.append(paragraph)

    return paragraphs
