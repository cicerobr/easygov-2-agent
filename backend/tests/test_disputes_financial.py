import unittest

from fastapi import HTTPException

from app.routes.disputes import _calculate_suggestions
from app.schemas import DisputeItemFinancialInput


class TestDisputeFinancialCalculation(unittest.TestCase):
    def test_calculates_all_margin_scenarios(self):
        payload = DisputeItemFinancialInput(
            preco_fornecedor=100.0,
            mao_obra=40.0,
            materiais_consumo=20.0,
            equipamentos=30.0,
            frete_logistica=10.0,
            aliquota_imposto_percentual=10.0,
        )

        custos_totais, suggestions = _calculate_suggestions(payload)

        self.assertEqual(custos_totais, 200.0)
        self.assertEqual(len(suggestions), 6)

        first = suggestions[0]
        self.assertEqual(first["margem_percentual"], 10.0)
        self.assertEqual(first["preco_venda"], 250.0)
        self.assertEqual(first["imposto_estimado"], 25.0)
        self.assertEqual(first["lucro_liquido_estimado"], 25.0)

    def test_raises_domain_error_when_denominator_is_invalid(self):
        payload = DisputeItemFinancialInput(
            preco_fornecedor=100.0,
            mao_obra=0.0,
            materiais_consumo=0.0,
            equipamentos=0.0,
            frete_logistica=0.0,
            aliquota_imposto_percentual=80.0,
        )

        with self.assertRaises(HTTPException) as ctx:
            _calculate_suggestions(payload)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Não é possível calcular preço de venda", str(ctx.exception.detail))


if __name__ == "__main__":
    unittest.main()
