import unittest

from app.services.technical_evidence import extract_technical_evidences


class TestTechnicalEvidenceExtraction(unittest.TestCase):
    def test_uses_integral_technical_entries_with_high_confidence(self):
        analysis = {
            "habilitacao": {
                "tecnica_texto_integral": [
                    "8.5 Qualificação técnica: Exige atestado de capacidade técnica para 30% do objeto."
                ]
            }
        }

        evidences = extract_technical_evidences(analysis)
        self.assertEqual(len(evidences), 1)
        self.assertEqual(evidences[0]["confidence"], 0.92)
        self.assertIn("8.5", evidences[0]["source_text"])

    def test_falls_back_to_tecnica_when_integral_not_available(self):
        analysis = {
            "habilitacao": {
                "tecnica": [
                    "Atestado de capacidade técnica emitido por pessoa jurídica de direito público."
                ]
            }
        }

        evidences = extract_technical_evidences(analysis)
        self.assertEqual(len(evidences), 1)
        self.assertEqual(evidences[0]["confidence"], 0.78)

    def test_deduplicates_entries(self):
        analysis = {
            "habilitacao": {
                "tecnica_texto_integral": [
                    "Item 9.1 - Exige registro no CREA.",
                    "Item 9.1 - Exige registro no CREA.",
                ]
            }
        }

        evidences = extract_technical_evidences(analysis)
        self.assertEqual(len(evidences), 1)


if __name__ == "__main__":
    unittest.main()

