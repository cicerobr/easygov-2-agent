import unittest
from datetime import datetime, timedelta, timezone

from app.services.pipeline_state import stage_from_result_status
from app.services.priority_score import (
    score_deadline_component,
    score_financial_component,
    score_historical_component,
    score_technical_component,
)


class TestPipelineAndScoring(unittest.TestCase):
    def test_stage_mapping_from_result_status(self):
        self.assertEqual(stage_from_result_status("pending"), "captured")
        self.assertEqual(stage_from_result_status("saved"), "triaged_saved")
        self.assertEqual(stage_from_result_status("discarded"), "triaged_discarded")
        self.assertEqual(stage_from_result_status("dispute_open"), "dispute_open")
        self.assertEqual(stage_from_result_status("dispute_won"), "dispute_won")
        self.assertEqual(stage_from_result_status("dispute_lost"), "dispute_lost")

    def test_deadline_score_near_term_is_higher(self):
        now = datetime.now(timezone.utc)
        high = score_deadline_component(now + timedelta(hours=10))
        medium = score_deadline_component(now + timedelta(days=3))
        low = score_deadline_component(now + timedelta(days=15))
        self.assertGreater(high, medium)
        self.assertGreater(medium, low)

    def test_financial_score_by_value_buckets(self):
        self.assertGreater(
            score_financial_component(3_000_000), score_financial_component(50_000)
        )
        self.assertGreater(
            score_financial_component(700_000), score_financial_component(120_000)
        )

    def test_technical_score_prefers_explicit_low_requirement(self):
        score_no_req = score_technical_component(
            evidence_count=0,
            has_no_technical_requirement=True,
            analysis_completed=True,
        )
        score_with_evidence = score_technical_component(
            evidence_count=2,
            has_no_technical_requirement=False,
            analysis_completed=True,
        )
        self.assertGreater(score_no_req, score_with_evidence)

    def test_historical_score_bounds(self):
        self.assertEqual(score_historical_component(None), 8.0)
        self.assertEqual(score_historical_component(0.0), 0.0)
        self.assertEqual(score_historical_component(1.0), 15.0)


if __name__ == "__main__":
    unittest.main()

