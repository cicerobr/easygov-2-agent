import unittest

from app.agent.pdf_tools import (
    _choose_best_technical_entries,
    _extract_full_technical_qualification_paragraphs,
    _extract_technical_requirements_from_text_heuristic,
    _needs_technical_detail_enrichment,
)


class TestTechnicalEnrichmentHeuristics(unittest.TestCase):
    def test_needs_enrichment_when_tecnica_missing(self):
        analysis = {"habilitacao": {}}
        self.assertTrue(_needs_technical_detail_enrichment(analysis))

    def test_needs_enrichment_for_generic_placeholder(self):
        analysis = {
            "habilitacao": {
                "tecnica": ["Documentos de qualificação técnica exigidos conforme edital."]
            }
        }
        self.assertTrue(_needs_technical_detail_enrichment(analysis))

    def test_does_not_enrich_for_explicit_no_requirement(self):
        analysis = {
            "habilitacao": {
                "tecnica": [
                    "Não exige atestado de capacidade técnica nem documentos de qualificação técnica."
                ]
            }
        }
        self.assertFalse(_needs_technical_detail_enrichment(analysis))

    def test_does_not_enrich_for_detailed_requirement(self):
        analysis = {
            "habilitacao": {
                "tecnica": [
                    "Atestado de capacidade técnica emitido por pessoa jurídica, comprovando execução de 50% do objeto.",
                    "Registro no CREA do responsável técnico com certidão válida.",
                ]
            }
        }
        self.assertFalse(_needs_technical_detail_enrichment(analysis))

    def test_enriches_when_generic_and_detailed_entries_are_mixed(self):
        analysis = {
            "habilitacao": {
                "tecnica": [
                    "Documentos de qualificação técnica exigidos conforme edital.",
                    "Atestado de capacidade técnica com comprovação de execução de 30% do objeto.",
                ]
            }
        }
        self.assertTrue(_needs_technical_detail_enrichment(analysis))

    def test_prefers_more_detailed_entries_when_merging(self):
        existing = [
            "Documentos de qualificação técnica exigidos conforme edital.",
        ]
        candidate = [
            "Atestado de capacidade técnica emitido por pessoa jurídica, comprovando execução de 50% do objeto.",
            "Registro no CREA do responsável técnico, com certidão válida.",
        ]

        merged = _choose_best_technical_entries(existing, candidate)
        self.assertEqual(merged, candidate)

    def test_heuristic_extracts_technical_clauses_from_source_text(self):
        source_text = """
        8.5 Qualificação técnica:
        Será exigido atestado de capacidade técnica emitido por pessoa jurídica de direito público ou privado.
        O atestado deve comprovar execução de no mínimo 30% do quantitativo do objeto.
        Também será exigido registro da empresa no CREA com certidão válida.
        """

        extracted = _extract_technical_requirements_from_text_heuristic(source_text)
        self.assertGreaterEqual(len(extracted), 2)
        self.assertTrue(any("atestado de capacidade tecnica" in item.lower() for item in extracted))
        self.assertTrue(any("crea" in item.lower() for item in extracted))

    def test_extracts_full_paragraphs_from_technical_section(self):
        source_text = """
        8.5 Qualificação técnica:
        Será exigido atestado de capacidade técnica emitido por pessoa jurídica de direito público ou privado,
        comprovando execução de no mínimo 30% do quantitativo do objeto.

        Deverá ser apresentado registro da empresa e do responsável técnico no CREA, com certidão válida.

        8.6 Qualificação econômico-financeira:
        Balanço patrimonial do último exercício social.
        """

        extracted = _extract_full_technical_qualification_paragraphs(source_text)
        joined = " ".join(extracted).lower()
        self.assertIn("qualificação técnica", joined)
        self.assertIn("atestado de capacidade técnica", joined)
        self.assertIn("30% do quantitativo", joined)
        self.assertIn("registro da empresa e do responsável técnico no crea", joined)
        self.assertNotIn("balanço patrimonial", joined)

    def test_falls_back_to_technical_heading_paragraphs_when_no_structured_heading(self):
        source_text = """
        Quanto à qualificação técnica, o edital exige atestado de capacidade técnica para comprovação de aptidão técnica.
        Também exige CAT emitida pelo CREA para o responsável técnico.
        """

        extracted = _extract_full_technical_qualification_paragraphs(source_text)
        self.assertGreaterEqual(len(extracted), 1)
        joined = " ".join(extracted).lower()
        self.assertIn("qualificação técnica", joined)
        self.assertIn("atestado de capacidade técnica", joined)
        self.assertIn("cat emitida pelo crea", joined)

    def test_stops_extraction_at_next_numbered_section_even_without_known_marker(self):
        source_text = """
        8.5 Qualificação técnica:
        Será exigido atestado de capacidade técnica com comprovação de 30% do objeto.
        Registro no CREA do responsável técnico.

        8.6 Condições gerais de execução:
        A contratada deve iniciar a execução em até 5 dias.
        """

        extracted = _extract_full_technical_qualification_paragraphs(source_text)
        joined = " ".join(extracted).lower()
        self.assertIn("atestado de capacidade técnica", joined)
        self.assertIn("registro no crea", joined)
        self.assertNotIn("condições gerais de execução", joined)
        self.assertNotIn("iniciar a execução em até 5 dias", joined)


if __name__ == "__main__":
    unittest.main()
