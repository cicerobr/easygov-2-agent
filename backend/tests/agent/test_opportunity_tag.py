import unittest

from app.agent.opportunity_tag import apply_opportunity_tag_rule


class TestOpportunityTagRule(unittest.TestCase):
    def test_adds_tag_for_dispensa_with_explicit_no_technical_requirement(self):
        analysis = {
            "licitacao": {"modalidade": "Dispensa de Licitação"},
            "habilitacao": {
                "tecnica": [
                    "Não exige atestado de capacidade técnica nem documentos de qualificação técnica."
                ]
            },
            "tags": [],
        }

        apply_opportunity_tag_rule(analysis)
        self.assertIn("Oportunidade", analysis["tags"])

    def test_removes_tag_when_atestado_is_required(self):
        analysis = {
            "licitacao": {"modalidade": "Dispensa"},
            "habilitacao": {
                "tecnica": [
                    "Atestado de capacidade técnica comprovando execução de 50% do objeto."
                ]
            },
            "tags": ["Oportunidade"],
        }

        apply_opportunity_tag_rule(analysis)
        self.assertNotIn("Oportunidade", analysis["tags"])

    def test_removes_tag_for_generic_technical_qualification_requirement(self):
        analysis = {
            "licitacao": {"modalidade": "Dispensa"},
            "habilitacao": {
                "tecnica": [
                    "Documentos de qualificação técnica exigidos conforme item 12 do edital."
                ]
            },
            "tags": ["Oportunidade"],
        }

        apply_opportunity_tag_rule(analysis)
        self.assertNotIn("Oportunidade", analysis["tags"])

    def test_keeps_tag_off_when_technical_section_is_unknown(self):
        analysis = {
            "licitacao": {"modalidade": "Dispensa"},
            "habilitacao": {"tecnica": []},
            "tags": ["Oportunidade"],
        }

        apply_opportunity_tag_rule(analysis)
        self.assertNotIn("Oportunidade", analysis["tags"])

    def test_never_adds_tag_for_non_dispensa(self):
        analysis = {
            "licitacao": {"modalidade": "Pregão Eletrônico"},
            "habilitacao": {
                "tecnica": [
                    "Não exige atestado de capacidade técnica nem documentos de qualificação técnica."
                ]
            },
            "tags": [],
        }

        apply_opportunity_tag_rule(analysis)
        self.assertNotIn("Oportunidade", analysis["tags"])

    def test_conflicting_technical_info_prefers_safe_removal(self):
        analysis = {
            "licitacao": {"modalidade": "Dispensa"},
            "habilitacao": {
                "tecnica": [
                    "Não exige atestado de capacidade técnica.",
                    "Exige registro no CREA do responsável técnico.",
                ]
            },
            "tags": ["Oportunidade"],
        }

        apply_opportunity_tag_rule(analysis)
        self.assertNotIn("Oportunidade", analysis["tags"])


if __name__ == "__main__":
    unittest.main()
