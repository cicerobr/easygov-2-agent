"""
PDF Tools — Tools for the Edital Analyzer sub-agent.
Handles PDF text extraction, PNCP PDF download, and LLM analysis.
"""
import json
import logging
import time
from typing import Any, Optional

import fitz  # PyMuPDF
import httpx
from openai import AsyncOpenAI

from app.config import get_settings

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
- Para requisitos de habilitação, liste os documentos exigidos de forma resumida.
- Identifique riscos ou cláusulas restritivas que possam dificultar a participação.
- TAG DE OPORTUNIDADE: inclua a tag "Oportunidade" no campo "tags" quando NÃO houver exigência de atestado de capacidade técnica ou outros documentos de qualificação técnica. Se houver exigência técnica, não inclua essa tag.
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
        "tecnica": ["Documentos de qualificação técnica exigidos"]
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


# ─── PDF Text Extraction ─────────────────────────────────────────────────────

def extract_pdf_text(pdf_bytes: bytes, max_pages: int = 200) -> dict:
    """
    Extract text from PDF bytes using PyMuPDF.
    
    Returns:
        dict with 'text', 'page_count', and 'truncated' flag.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        pages_to_process = min(total_pages, max_pages)
        
        text_parts = []
        for i in range(pages_to_process):
            page = doc[i]
            text = page.get_text("text")
            if text.strip():
                text_parts.append(f"--- Página {i + 1} ---\n{text}")
        
        doc.close()
        
        full_text = "\n\n".join(text_parts)
        
        return {
            "text": full_text,
            "page_count": total_pages,
            "pages_processed": pages_to_process,
            "truncated": pages_to_process < total_pages,
            "char_count": len(full_text),
        }
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        raise ValueError(f"Falha ao extrair texto do PDF: {str(e)}")


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
    
    # Truncate text if too long (approx 100K chars ≈ 25K tokens)
    max_chars = 100_000
    if len(text) > max_chars:
        text = text[:max_chars] + "\n\n[... TEXTO TRUNCADO POR LIMITE DE TAMANHO ...]"
        logger.warning(f"Text truncated from {len(text)} to {max_chars} chars")
    
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
                _apply_opportunity_tag_rule(analysis)
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


def _apply_opportunity_tag_rule(analysis: dict[str, Any]) -> None:
    """
    Enforce opportunity tag based on technical qualification requirements.
    Rule: add 'Oportunidade' when there is no technical qualification requirement.
    """
    tags_raw = analysis.get("tags")
    if isinstance(tags_raw, list):
        tags = [str(t).strip() for t in tags_raw if str(t).strip()]
    elif isinstance(tags_raw, str) and tags_raw.strip():
        tags = [tags_raw.strip()]
    else:
        tags = []

    has_technical_requirement = _has_technical_requirement(analysis.get("habilitacao"))

    if not has_technical_requirement and "Oportunidade" not in tags:
        tags.append("Oportunidade")
    if has_technical_requirement and "Oportunidade" in tags:
        tags = [t for t in tags if t != "Oportunidade"]

    analysis["tags"] = tags


def _has_technical_requirement(habilitacao: Any) -> bool:
    if not isinstance(habilitacao, dict):
        return False

    tecnica = habilitacao.get("tecnica")
    if tecnica is None:
        return False

    if isinstance(tecnica, str):
        values = [tecnica]
    elif isinstance(tecnica, list):
        values = [str(item) for item in tecnica]
    else:
        return False

    negatives = (
        "nao exig",
        "não exig",
        "nao se aplica",
        "não se aplica",
        "sem exig",
        "dispens",
        "inexist",
        "nenhum",
        "nenhuma",
        "nao ha",
        "não há",
    )
    technical_markers = (
        "atestado",
        "capacidade tecnica",
        "capacidade técnica",
        "qualificacao tecnica",
        "qualificação técnica",
        "acervo tecnico",
        "acervo técnico",
        "responsavel tecnico",
        "responsável técnico",
        "crea",
        "cau",
        "crt",
        "registro profissional",
        "certidao de acervo",
        "certidão de acervo",
    )

    for value in values:
        text = (value or "").strip().lower()
        if not text:
            continue
        if any(marker in text for marker in technical_markers):
            return True
        if any(neg in text for neg in negatives):
            continue
        return True

    return False
