import unittest

from app.agent.engine import _extract_buying_unit_info


class TestBuyingUnitExtraction(unittest.TestCase):
    def test_prefers_direct_contract_field(self):
        contract = {
            "codigoUnidadeCompradora": "UCG-001",
            "unidadeOrgao": {"codigoUnidade": "UO-002", "nomeUnidade": "Secretaria X"},
            "codigoUnidadeOrgao": "UO-003",
        }

        codigo, nome = _extract_buying_unit_info(contract)
        self.assertEqual(codigo, "UCG-001")
        self.assertEqual(nome, "Secretaria X")

    def test_uses_unidade_orgao_code_as_fallback(self):
        contract = {
            "unidadeOrgao": {"codigoUnidade": "UO-002", "nomeUnidade": "Secretaria Y"},
        }

        codigo, nome = _extract_buying_unit_info(contract)
        self.assertEqual(codigo, "UO-002")
        self.assertEqual(nome, "Secretaria Y")

    def test_uses_codigo_unidade_orgao_as_last_fallback(self):
        contract = {"codigoUnidadeOrgao": "UO-003"}

        codigo, nome = _extract_buying_unit_info(contract)
        self.assertEqual(codigo, "UO-003")
        self.assertIsNone(nome)

    def test_handles_missing_fields(self):
        codigo, nome = _extract_buying_unit_info({})
        self.assertIsNone(codigo)
        self.assertIsNone(nome)


if __name__ == "__main__":
    unittest.main()
