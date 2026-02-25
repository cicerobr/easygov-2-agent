"""
LangChain tools for PNCP access.

LangChain 1.x migration notes:
- Typed input contracts via Pydantic schemas (`args_schema`).
- Stable output envelope for deterministic downstream handling.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Optional

from langchain_core.tools import tool
from pydantic import BaseModel, Field

from app.pncp_client import pncp_client


def _safe_data(data: Any) -> Any:
    return json.loads(json.dumps(data, ensure_ascii=False, default=str))


def _meta(source: str) -> dict[str, str]:
    return {
        "source": source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _ok(source: str, data: Any) -> dict[str, Any]:
    return {
        "ok": True,
        "data": _safe_data(data),
        "error": None,
        "meta": _meta(source),
    }


def _error(source: str, exc: Exception) -> dict[str, Any]:
    return {
        "ok": False,
        "data": None,
        "error": {
            "code": "PNCP_TOOL_ERROR",
            "message": str(exc),
        },
        "meta": _meta(source),
    }


class BuscarContratacoesPublicacaoInput(BaseModel):
    data_inicial: str = Field(..., pattern=r"^\d{8}$")
    data_final: str = Field(..., pattern=r"^\d{8}$")
    codigo_modalidade: int
    pagina: int = Field(default=1, ge=1)
    uf: Optional[str] = Field(default=None, min_length=2, max_length=2)
    codigo_municipio_ibge: Optional[str] = None
    cnpj: Optional[str] = None
    codigo_modo_disputa: Optional[int] = None


@tool(args_schema=BuscarContratacoesPublicacaoInput)
async def buscar_contratacoes_publicacao(
    data_inicial: str,
    data_final: str,
    codigo_modalidade: int,
    pagina: int = 1,
    uf: Optional[str] = None,
    codigo_municipio_ibge: Optional[str] = None,
    cnpj: Optional[str] = None,
    codigo_modo_disputa: Optional[int] = None,
) -> dict[str, Any]:
    """Busca contratações por data de publicação no PNCP."""
    try:
        result = await pncp_client.buscar_contratacoes_publicacao(
            data_inicial=data_inicial,
            data_final=data_final,
            codigo_modalidade=codigo_modalidade,
            pagina=pagina,
            uf=uf,
            codigo_municipio_ibge=codigo_municipio_ibge,
            cnpj=cnpj,
            codigo_modo_disputa=codigo_modo_disputa,
        )
        return _ok("buscar_contratacoes_publicacao", result)
    except Exception as e:
        return _error("buscar_contratacoes_publicacao", e)


class BuscarContratacoesPropostaAbertaInput(BaseModel):
    data_final: str = Field(..., pattern=r"^\d{8}$")
    pagina: int = Field(default=1, ge=1)
    codigo_modalidade: Optional[int] = None
    uf: Optional[str] = Field(default=None, min_length=2, max_length=2)
    codigo_municipio_ibge: Optional[str] = None
    cnpj: Optional[str] = None


@tool(args_schema=BuscarContratacoesPropostaAbertaInput)
async def buscar_contratacoes_proposta_aberta(
    data_final: str,
    pagina: int = 1,
    codigo_modalidade: Optional[int] = None,
    uf: Optional[str] = None,
    codigo_municipio_ibge: Optional[str] = None,
    cnpj: Optional[str] = None,
) -> dict[str, Any]:
    """Busca contratações com prazo aberto para envio de propostas."""
    try:
        result = await pncp_client.buscar_contratacoes_proposta(
            data_final=data_final,
            pagina=pagina,
            codigo_modalidade=codigo_modalidade,
            uf=uf,
            codigo_municipio_ibge=codigo_municipio_ibge,
            cnpj=cnpj,
        )
        return _ok("buscar_contratacoes_proposta_aberta", result)
    except Exception as e:
        return _error("buscar_contratacoes_proposta_aberta", e)


class BuscarContratacoesAtualizacaoInput(BaseModel):
    data_inicial: str = Field(..., pattern=r"^\d{8}$")
    data_final: str = Field(..., pattern=r"^\d{8}$")
    codigo_modalidade: int
    pagina: int = Field(default=1, ge=1)
    uf: Optional[str] = Field(default=None, min_length=2, max_length=2)
    codigo_municipio_ibge: Optional[str] = None
    cnpj: Optional[str] = None
    codigo_modo_disputa: Optional[int] = None


@tool(args_schema=BuscarContratacoesAtualizacaoInput)
async def buscar_contratacoes_atualizacao(
    data_inicial: str,
    data_final: str,
    codigo_modalidade: int,
    pagina: int = 1,
    uf: Optional[str] = None,
    codigo_municipio_ibge: Optional[str] = None,
    cnpj: Optional[str] = None,
    codigo_modo_disputa: Optional[int] = None,
) -> dict[str, Any]:
    """Busca contratações atualizadas em uma faixa de datas."""
    try:
        result = await pncp_client.buscar_contratacoes_atualizacao(
            data_inicial=data_inicial,
            data_final=data_final,
            codigo_modalidade=codigo_modalidade,
            pagina=pagina,
            uf=uf,
            codigo_municipio_ibge=codigo_municipio_ibge,
            cnpj=cnpj,
            codigo_modo_disputa=codigo_modo_disputa,
        )
        return _ok("buscar_contratacoes_atualizacao", result)
    except Exception as e:
        return _error("buscar_contratacoes_atualizacao", e)


class DetalharContratacaoInput(BaseModel):
    cnpj: str
    ano: int
    sequencial: int


@tool(args_schema=DetalharContratacaoInput)
async def detalhar_contratacao(cnpj: str, ano: int, sequencial: int) -> dict[str, Any]:
    """Detalha uma contratação específica no PNCP."""
    try:
        result = await pncp_client.detalhar_contratacao(cnpj, ano, sequencial)
        return _ok("detalhar_contratacao", result)
    except Exception as e:
        return _error("detalhar_contratacao", e)


class ListarItensContratacaoInput(BaseModel):
    cnpj: str
    ano: int
    sequencial: int
    pagina: int = Field(default=1, ge=1)


@tool(args_schema=ListarItensContratacaoInput)
async def listar_itens_contratacao(
    cnpj: str, ano: int, sequencial: int, pagina: int = 1
) -> dict[str, Any]:
    """Lista os itens de uma contratação."""
    try:
        result = await pncp_client.listar_itens_contratacao(cnpj, ano, sequencial, pagina)
        return _ok("listar_itens_contratacao", result)
    except Exception as e:
        return _error("listar_itens_contratacao", e)


class ConsultarDocumentosEditalInput(BaseModel):
    cnpj: str
    ano: int
    sequencial: int
    pagina: int = Field(default=1, ge=1)


@tool(args_schema=ConsultarDocumentosEditalInput)
async def consultar_documentos_edital(
    cnpj: str, ano: int, sequencial: int, pagina: int = 1
) -> dict[str, Any]:
    """Lista os documentos de um edital/contratação."""
    try:
        result = await pncp_client.consultar_documentos(cnpj, ano, sequencial, pagina)
        return _ok("consultar_documentos_edital", result)
    except Exception as e:
        return _error("consultar_documentos_edital", e)


ALL_TOOLS = [
    buscar_contratacoes_publicacao,
    buscar_contratacoes_proposta_aberta,
    buscar_contratacoes_atualizacao,
    detalhar_contratacao,
    listar_itens_contratacao,
    consultar_documentos_edital,
]

