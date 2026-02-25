import unittest
from unittest.mock import patch

import fitz

from app.agent import pdf_tools


def _build_pdf(page_texts: list[str]) -> bytes:
    doc = fitz.open()
    try:
        for text in page_texts:
            page = doc.new_page()
            if text:
                page.insert_text((72, 72), text)
        return doc.tobytes()
    finally:
        doc.close()


class TestPdfOcrFallback(unittest.IsolatedAsyncioTestCase):
    async def test_native_pdf_does_not_call_ocr(self):
        pdf_bytes = _build_pdf(
            ["Este edital possui texto nativo suficiente para evitar OCR. " * 8]
        )

        async def _fail_if_called(**kwargs):  # pragma: no cover
            raise AssertionError("OCR should not be called for native text page")

        with patch.object(pdf_tools.settings, "openai_api_key", "test-key"):
            with patch("app.agent.pdf_tools._ocr_page_with_openai", new=_fail_if_called):
                result = await pdf_tools.extract_pdf_text(
                    pdf_bytes,
                    max_pages=10,
                    ocr_enabled=True,
                    ocr_min_chars_per_page=80,
                    ocr_max_concurrency=2,
                )

        self.assertEqual(result["extraction_method"], "native")
        self.assertEqual(result["ocr_pages_processed"], 0)
        self.assertGreater(result["char_count"], 0)

    async def test_scanned_pdf_uses_ocr_for_all_pages(self):
        pdf_bytes = _build_pdf(["", ""])

        async def _fake_ocr_page_with_openai(**kwargs):
            return f"OCR PAGE {kwargs['page_number']}"

        with patch.object(pdf_tools.settings, "openai_api_key", "test-key"):
            with patch(
                "app.agent.pdf_tools._ocr_page_with_openai",
                new=_fake_ocr_page_with_openai,
            ):
                result = await pdf_tools.extract_pdf_text(
                    pdf_bytes,
                    max_pages=10,
                    ocr_enabled=True,
                    ocr_min_chars_per_page=1,
                    ocr_max_concurrency=2,
                )

        self.assertEqual(result["extraction_method"], "ocr")
        self.assertEqual(result["ocr_pages_processed"], 2)
        self.assertIn("OCR PAGE 1", result["text"])
        self.assertIn("OCR PAGE 2", result["text"])

    async def test_mixed_pdf_uses_hybrid_extraction(self):
        pdf_bytes = _build_pdf(
            [
                "Texto nativo da página 1 suficiente para não usar OCR. " * 8,
                "",
            ]
        )

        async def _fake_ocr_page_with_openai(**kwargs):
            return "OCR PAGE 2"

        with patch.object(pdf_tools.settings, "openai_api_key", "test-key"):
            with patch(
                "app.agent.pdf_tools._ocr_page_with_openai",
                new=_fake_ocr_page_with_openai,
            ):
                result = await pdf_tools.extract_pdf_text(
                    pdf_bytes,
                    max_pages=10,
                    ocr_enabled=True,
                    ocr_min_chars_per_page=80,
                    ocr_max_concurrency=2,
                )

        self.assertEqual(result["extraction_method"], "hybrid")
        self.assertEqual(result["ocr_pages_processed"], 1)
        self.assertIn("OCR PAGE 2", result["text"])

    async def test_ocr_failure_falls_back_to_native_text(self):
        pdf_bytes = _build_pdf(["texto curto"])

        async def _always_fail(**kwargs):
            raise RuntimeError("provider unavailable")

        with patch.object(pdf_tools.settings, "openai_api_key", "test-key"):
            with patch("app.agent.pdf_tools._ocr_page_with_openai", new=_always_fail):
                result = await pdf_tools.extract_pdf_text(
                    pdf_bytes,
                    max_pages=10,
                    ocr_enabled=True,
                    ocr_min_chars_per_page=80,
                    ocr_max_concurrency=1,
                    ocr_max_retries=1,
                )

        self.assertEqual(result["extraction_method"], "native")
        self.assertEqual(result["ocr_pages_processed"], 0)
        self.assertEqual(result["ocr_provider_errors"], 1)
        self.assertIn("texto curto", result["text"])

    async def test_empty_after_ocr_failure_raises(self):
        pdf_bytes = _build_pdf([""])

        async def _always_fail(**kwargs):
            raise RuntimeError("provider unavailable")

        with patch.object(pdf_tools.settings, "openai_api_key", "test-key"):
            with patch("app.agent.pdf_tools._ocr_page_with_openai", new=_always_fail):
                with self.assertRaises(ValueError) as ctx:
                    await pdf_tools.extract_pdf_text(
                        pdf_bytes,
                        max_pages=10,
                        ocr_enabled=True,
                        ocr_min_chars_per_page=1,
                        ocr_max_concurrency=1,
                        ocr_max_retries=1,
                    )

        self.assertIn("EMPTY_TEXT_AFTER_OCR", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
