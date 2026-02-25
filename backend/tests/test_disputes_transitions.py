import unittest

from app.routes.disputes import (
    _can_finish_dispute,
    _can_start_dispute,
    _finish_action_to_status,
)


class TestDisputeTransitions(unittest.TestCase):
    def test_start_dispute_only_allows_saved(self):
        self.assertTrue(_can_start_dispute("saved"))
        self.assertFalse(_can_start_dispute("pending"))
        self.assertFalse(_can_start_dispute("discarded"))
        self.assertFalse(_can_start_dispute("dispute_open"))

    def test_finish_dispute_only_allows_open_status(self):
        self.assertTrue(_can_finish_dispute("dispute_open"))
        self.assertFalse(_can_finish_dispute("saved"))
        self.assertFalse(_can_finish_dispute("dispute_won"))
        self.assertFalse(_can_finish_dispute("dispute_lost"))

    def test_finish_action_maps_to_expected_status(self):
        self.assertEqual(_finish_action_to_status("won"), "dispute_won")
        self.assertEqual(_finish_action_to_status("lost"), "dispute_lost")


if __name__ == "__main__":
    unittest.main()
