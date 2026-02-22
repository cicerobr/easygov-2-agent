"""
PNCP API Client — Async HTTP client for the Portal Nacional de Contratações Públicas.
Handles both the Consulta (public queries) and PNCP (maintenance) APIs.
"""
import asyncio
import logging
from datetime import date, datetime
from typing import Any, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class PNCPClient:
    """Async client for PNCP APIs with rate limiting."""

    def __init__(self):
        self.consulta_base = settings.pncp_api_consulta_base_url.rstrip("/")
        self.pncp_base = settings.pncp_api_base_url.rstrip("/")
        self._semaphore = asyncio.Semaphore(int(settings.pncp_rate_limit_per_second))
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                headers={"Accept": "application/json"},
                follow_redirects=True,
            )
        return self._client

    async def _request(self, method: str, url: str, **kwargs) -> dict[str, Any]:
        async with self._semaphore:
            client = await self._get_client()
            try:
                response = await client.request(method, url, **kwargs)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"PNCP API error {e.response.status_code}: {e.response.text[:500]}")
                raise
            except httpx.RequestError as e:
                logger.error(f"PNCP request error: {e}")
                raise

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    # ─── Consulta API (Public) ────────────────────────────────────────────

    async def buscar_contratacoes_publicacao(
        self,
        data_inicial: str,
        data_final: str,
        codigo_modalidade: int,
        pagina: int = 1,
        tamanho_pagina: int = 50,
        uf: Optional[str] = None,
        codigo_municipio_ibge: Optional[str] = None,
        cnpj: Optional[str] = None,
        codigo_modo_disputa: Optional[int] = None,
    ) -> dict[str, Any]:
        """Search contracts by publication date."""
        params = {
            "dataInicial": data_inicial,
            "dataFinal": data_final,
            "codigoModalidadeContratacao": codigo_modalidade,
            "pagina": pagina,
            "tamanhoPagina": tamanho_pagina,
        }
        if uf:
            params["uf"] = uf
        if codigo_municipio_ibge:
            params["codigoMunicipioIbge"] = codigo_municipio_ibge
        if cnpj:
            params["cnpj"] = cnpj
        if codigo_modo_disputa:
            params["codigoModoDisputa"] = codigo_modo_disputa

        url = f"{self.consulta_base}/v1/contratacoes/publicacao"
        return await self._request("GET", url, params=params)

    async def buscar_contratacoes_proposta(
        self,
        data_final: str,
        pagina: int = 1,
        tamanho_pagina: int = 50,
        codigo_modalidade: Optional[int] = None,
        uf: Optional[str] = None,
        codigo_municipio_ibge: Optional[str] = None,
        cnpj: Optional[str] = None,
    ) -> dict[str, Any]:
        """Search contracts with open proposal submission."""
        params = {
            "dataFinal": data_final,
            "pagina": pagina,
            "tamanhoPagina": tamanho_pagina,
        }
        if codigo_modalidade:
            params["codigoModalidadeContratacao"] = codigo_modalidade
        if uf:
            params["uf"] = uf
        if codigo_municipio_ibge:
            params["codigoMunicipioIbge"] = codigo_municipio_ibge
        if cnpj:
            params["cnpj"] = cnpj

        url = f"{self.consulta_base}/v1/contratacoes/proposta"
        return await self._request("GET", url, params=params)

    async def buscar_contratacoes_atualizacao(
        self,
        data_inicial: str,
        data_final: str,
        codigo_modalidade: int,
        pagina: int = 1,
        tamanho_pagina: int = 50,
        uf: Optional[str] = None,
        codigo_municipio_ibge: Optional[str] = None,
        cnpj: Optional[str] = None,
        codigo_modo_disputa: Optional[int] = None,
    ) -> dict[str, Any]:
        """Search contracts by last update date."""
        params = {
            "dataInicial": data_inicial,
            "dataFinal": data_final,
            "codigoModalidadeContratacao": codigo_modalidade,
            "pagina": pagina,
            "tamanhoPagina": tamanho_pagina,
        }
        if uf:
            params["uf"] = uf
        if codigo_municipio_ibge:
            params["codigoMunicipioIbge"] = codigo_municipio_ibge
        if cnpj:
            params["cnpj"] = cnpj
        if codigo_modo_disputa:
            params["codigoModoDisputa"] = codigo_modo_disputa

        url = f"{self.consulta_base}/v1/contratacoes/atualizacao"
        return await self._request("GET", url, params=params)

    async def detalhar_contratacao(
        self, cnpj: str, ano: int, sequencial: int
    ) -> dict[str, Any]:
        """Get full details for a specific contract."""
        url = f"{self.consulta_base}/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}"
        return await self._request("GET", url)

    # ─── PNCP API (Details) ───────────────────────────────────────────────

    async def listar_itens_contratacao(
        self, cnpj: str, ano: int, sequencial: int,
        pagina: int = 1, tamanho_pagina: int = 50,
    ) -> dict[str, Any]:
        """List all items of a contract."""
        url = f"{self.pncp_base}/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens"
        return await self._request("GET", url, params={
            "pagina": pagina, "tamanhoPagina": tamanho_pagina
        })

    async def consultar_documentos(
        self, cnpj: str, ano: int, sequencial: int,
        pagina: int = 1, tamanho_pagina: int = 50,
    ) -> dict[str, Any]:
        """List all documents (editais) for a contract."""
        url = f"{self.pncp_base}/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/arquivos"
        return await self._request("GET", url, params={
            "pagina": pagina, "tamanhoPagina": tamanho_pagina
        })

    async def consultar_resultados_item(
        self, cnpj: str, ano: int, sequencial: int, numero_item: int,
    ) -> dict[str, Any]:
        """Get results for a specific contract item."""
        url = f"{self.pncp_base}/v1/orgaos/{cnpj}/compras/{ano}/{sequencial}/itens/{numero_item}/resultados"
        return await self._request("GET", url)


# Singleton
pncp_client = PNCPClient()
