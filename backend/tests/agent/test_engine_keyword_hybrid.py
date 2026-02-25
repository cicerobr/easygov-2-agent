import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.agent.engine import _fetch_all_items_for_contract, _filter_by_keywords_hybrid


def _automation(
    *,
    keywords: list[str] | None,
    keywords_exclude: list[str] | None = None,
    search_in_items: bool = True,
):
    return SimpleNamespace(
        keywords=keywords,
        keywords_exclude=keywords_exclude,
        search_in_items=search_in_items,
    )


def _contract(
    *,
    numero: str = "PNCP-1",
    objeto: str = "",
    complementar: str = "",
):
    return {
        "numeroControlePNCP": numero,
        "objetoCompra": objeto,
        "informacaoComplementar": complementar,
        "orgaoEntidade": {"cnpj": "12345678000199"},
        "anoCompra": 2025,
        "sequencialCompra": 10,
    }


class TestHybridKeywordFilter(unittest.IsolatedAsyncioTestCase):
    async def test_object_match_is_case_and_accent_insensitive(self):
        automation = _automation(keywords=["qualificação técnica"])
        contracts = [_contract(objeto="Exigência de QUALIFICACAO TECNICA para o certame")]

        filtered, metrics = await _filter_by_keywords_hybrid(contracts, automation)

        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["keyword_match_scope"], "object")
        self.assertEqual(metrics["item_checks_attempted"], 0)

    async def test_item_match_includes_contract_when_object_does_not_match(self):
        automation = _automation(keywords=["servidor"])
        contracts = [_contract(objeto="Aquisição de mobiliário")]

        with patch(
            "app.agent.engine._match_items_for_contract",
            new=AsyncMock(
                return_value={
                    "include_matches": {"servidor"},
                    "exclude_matches": set(),
                    "evidence": [
                        {
                            "scope": "item",
                            "keyword": "servidor",
                            "item_numero": 3,
                            "snippet": "fornecimento de servidor rack",
                            "field": "descricao",
                        }
                    ],
                }
            ),
        ):
            filtered, metrics = await _filter_by_keywords_hybrid(contracts, automation)

        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["keyword_match_scope"], "item")
        self.assertEqual(metrics["results_matched_by_item"], 1)

    async def test_exclude_keyword_on_item_blocks_contract(self):
        automation = _automation(
            keywords=["software"],
            keywords_exclude=["manutenção"],
            search_in_items=True,
        )
        contracts = [_contract(objeto="Licença de software corporativo")]

        with patch(
            "app.agent.engine._match_items_for_contract",
            new=AsyncMock(
                return_value={
                    "include_matches": set(),
                    "exclude_matches": {"manutenção"},
                    "evidence": [],
                }
            ),
        ):
            filtered, _ = await _filter_by_keywords_hybrid(contracts, automation)

        self.assertEqual(filtered, [])

    async def test_scope_is_both_when_object_and_item_match(self):
        automation = _automation(
            keywords=["software"],
            keywords_exclude=["termo-inexistente"],
            search_in_items=True,
        )
        contracts = [_contract(objeto="Licença de software corporativo")]

        with patch(
            "app.agent.engine._match_items_for_contract",
            new=AsyncMock(
                return_value={
                    "include_matches": {"software"},
                    "exclude_matches": set(),
                    "evidence": [
                        {
                            "scope": "item",
                            "keyword": "software",
                            "item_numero": 1,
                            "snippet": "item de software",
                            "field": "descricao",
                        }
                    ],
                }
            ),
        ):
            filtered, _ = await _filter_by_keywords_hybrid(contracts, automation)

        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["keyword_match_scope"], "both")

    async def test_exclude_only_considers_item_fields(self):
        automation = _automation(
            keywords=None,
            keywords_exclude=["cancelado"],
            search_in_items=True,
        )
        contracts = [_contract(objeto="Aquisição de equipamentos")]

        with patch(
            "app.agent.engine._match_items_for_contract",
            new=AsyncMock(
                return_value={
                    "include_matches": set(),
                    "exclude_matches": {"cancelado"},
                    "evidence": [],
                }
            ),
        ):
            filtered, _ = await _filter_by_keywords_hybrid(contracts, automation)

        self.assertEqual(filtered, [])

    async def test_item_fetch_error_drops_item_dependent_candidate(self):
        automation = _automation(keywords=["servidor"], search_in_items=True)
        contracts = [_contract(objeto="Aquisição de mobiliário")]

        with patch(
            "app.agent.engine._match_items_for_contract",
            new=AsyncMock(side_effect=RuntimeError("timeout")),
        ):
            filtered, metrics = await _filter_by_keywords_hybrid(contracts, automation)

        self.assertEqual(filtered, [])
        self.assertEqual(metrics["item_checks_failed"], 1)


class TestFetchItemsPagination(unittest.IsolatedAsyncioTestCase):
    async def test_fetch_all_items_reads_multiple_pages(self):
        contract = _contract()
        mocked = AsyncMock(
            side_effect=[
                {"data": [{"numeroItem": 1}], "paginasRestantes": 1},
                {"data": [{"numeroItem": 2}], "paginasRestantes": 0},
            ]
        )

        with patch("app.agent.engine.pncp_client.listar_itens_contratacao", new=mocked):
            items = await _fetch_all_items_for_contract(contract, timeout_sec=5)

        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["numeroItem"], 1)
        self.assertEqual(items[1]["numeroItem"], 2)


if __name__ == "__main__":
    unittest.main()
