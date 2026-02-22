"""
LangChain Tools — PNCP API tools for the EasyGov agent.
Each tool wraps a PNCP API endpoint and returns structured data.
"""
import json
from datetime import date, datetime, timedelta
from typing import Optional

from langchain_core.tools import tool

from app.pncp_client import pncp_client


@tool
async def buscar_contratacoes_publicacao(
    data_inicial: str,
    data_final: str,
    codigo_modalidade: int,
    pagina: int = 1,
    uf: Optional[str] = None,
    codigo_municipio_ibge: Optional[str] = None,
    cnpj: Optional[str] = None,
    codigo_modo_disputa: Optional[int] = None,
) -> str:
    """Search for procurement contracts by publication date on the PNCP portal.

    Args:
        data_inicial: Start date in YYYYMMDD format (e.g. '20260101').
        data_final: End date in YYYYMMDD format (e.g. '20260131').
        codigo_modalidade: Procurement modality code (e.g. 6=Pregão Eletrônico, 8=Dispensa).
        pagina: Page number (starts at 1).
        uf: Optional state abbreviation (e.g. 'SP', 'RJ').
        codigo_municipio_ibge: Optional IBGE city code.
        cnpj: Optional CNPJ of the contracting entity.
        codigo_modo_disputa: Optional dispute mode code.

    Returns:
        JSON string with the list of contracts found and pagination info.
    """
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
        return json.dumps(result, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
async def buscar_contratacoes_proposta_aberta(
    data_final: str,
    pagina: int = 1,
    codigo_modalidade: Optional[int] = None,
    uf: Optional[str] = None,
    codigo_municipio_ibge: Optional[str] = None,
    cnpj: Optional[str] = None,
) -> str:
    """Search for procurement contracts with open proposal submission period.

    Args:
        data_final: End date for proposal submission in YYYYMMDD format.
        pagina: Page number (starts at 1).
        codigo_modalidade: Optional modality code (e.g. 6=Pregão Eletrônico, 8=Dispensa).
        uf: Optional state abbreviation (e.g. 'SP', 'RJ').
        codigo_municipio_ibge: Optional IBGE city code.
        cnpj: Optional CNPJ of the contracting entity.

    Returns:
        JSON string with contracts currently accepting proposals.
    """
    try:
        result = await pncp_client.buscar_contratacoes_proposta(
            data_final=data_final,
            pagina=pagina,
            codigo_modalidade=codigo_modalidade,
            uf=uf,
            codigo_municipio_ibge=codigo_municipio_ibge,
            cnpj=cnpj,
        )
        return json.dumps(result, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
async def buscar_contratacoes_atualizacao(
    data_inicial: str,
    data_final: str,
    codigo_modalidade: int,
    pagina: int = 1,
    uf: Optional[str] = None,
    codigo_municipio_ibge: Optional[str] = None,
    cnpj: Optional[str] = None,
    codigo_modo_disputa: Optional[int] = None,
) -> str:
    """Search for procurement contracts updated within a date range.

    Args:
        data_inicial: Start date in YYYYMMDD format.
        data_final: End date in YYYYMMDD format.
        codigo_modalidade: Procurement modality code.
        pagina: Page number (starts at 1).
        uf: Optional state abbreviation.
        codigo_municipio_ibge: Optional IBGE city code.
        cnpj: Optional CNPJ.
        codigo_modo_disputa: Optional dispute mode code.

    Returns:
        JSON string with updated contracts.
    """
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
        return json.dumps(result, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
async def detalhar_contratacao(cnpj: str, ano: int, sequencial: int) -> str:
    """Get full details of a specific procurement contract.

    Args:
        cnpj: CNPJ of the contracting entity.
        ano: Year of the procurement.
        sequencial: Sequential number of the procurement.

    Returns:
        JSON string with complete contract details.
    """
    try:
        result = await pncp_client.detalhar_contratacao(cnpj, ano, sequencial)
        return json.dumps(result, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
async def listar_itens_contratacao(
    cnpj: str, ano: int, sequencial: int, pagina: int = 1
) -> str:
    """List all items/lots of a specific procurement contract.

    Args:
        cnpj: CNPJ of the contracting entity.
        ano: Year of the procurement.
        sequencial: Sequential number of the procurement.
        pagina: Page number.

    Returns:
        JSON string with the list of items.
    """
    try:
        result = await pncp_client.listar_itens_contratacao(cnpj, ano, sequencial, pagina)
        return json.dumps(result, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool
async def consultar_documentos_edital(
    cnpj: str, ano: int, sequencial: int, pagina: int = 1
) -> str:
    """List all documents (edital files, annexes) of a procurement contract.

    Args:
        cnpj: CNPJ of the contracting entity.
        ano: Year of the procurement.
        sequencial: Sequential number of the procurement.
        pagina: Page number.

    Returns:
        JSON string with the list of documents and download info.
    """
    try:
        result = await pncp_client.consultar_documentos(cnpj, ano, sequencial, pagina)
        return json.dumps(result, ensure_ascii=False, default=str)
    except Exception as e:
        return json.dumps({"error": str(e)})


# All tools available to the agent
ALL_TOOLS = [
    buscar_contratacoes_publicacao,
    buscar_contratacoes_proposta_aberta,
    buscar_contratacoes_atualizacao,
    detalhar_contratacao,
    listar_itens_contratacao,
    consultar_documentos_edital,
]
