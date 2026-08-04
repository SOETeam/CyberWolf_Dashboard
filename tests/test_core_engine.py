import sys
import unittest
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from cyberwolf_core_engine import computed_today, health_score, with_sync_metadata


class CoreEngineTests(unittest.TestCase):
    def test_computed_today_deduplicates_by_id_and_keeps_latest_version(self):
        tasks = [
            {"id": "a", "due": "2026-08-04", "title": "old", "_version": 1},
            {"id": "a", "due": "2026-08-04", "title": "new", "_version": 2},
            {"id": "b", "due": "daily", "title": "recurring"},
            {"id": "c", "due": "2026-08-05", "title": "tomorrow"},
            {"id": "", "due": "2026-08-04", "title": "invalid"},
        ]

        result = computed_today(tasks, date(2026, 8, 4))

        self.assertEqual([task["id"] for task in result], ["a", "b"])
        self.assertEqual(result[0]["title"], "new")
        self.assertEqual(len({task["id"] for task in result}), len(result))

    def test_health_score_is_bounded_and_penalizes_stale_overdue_priority(self):
        now = datetime(2026, 8, 4, 12, 0)
        healthy = {
            "id": "a",
            "priority": "p3",
            "due": "2026-08-10",
            "last_updated": "2026-08-04",
        }
        urgent = {
            "id": "b",
            "priority": "p0",
            "due": "2026-08-01",
            "last_updated": "2026-07-20",
        }
        completed = {"id": "c", "completed": True, "priority": "p0", "due": "2026-07-01"}

        self.assertGreater(health_score(healthy, now), health_score(urgent, now))
        self.assertLess(health_score(urgent, now), 25)
        self.assertEqual(health_score(completed, now), 100)
        self.assertTrue(all(0 <= health_score(task, now) <= 100 for task in (healthy, urgent, completed)))

    def test_sync_metadata_adds_version_and_timestamp_without_mutating_input(self):
        task = {"id": "a", "title": "Keep me"}

        result = with_sync_metadata(task, 7, "2026-08-04T12:00:00+00:00")

        self.assertEqual(
            result,
            {
                "id": "a",
                "title": "Keep me",
                "_version": 7,
                "_synced_at": "2026-08-04T12:00:00+00:00",
            },
        )
        self.assertEqual(task, {"id": "a", "title": "Keep me"})

    def test_sync_metadata_rejects_invalid_versions(self):
        with self.assertRaisesRegex(ValueError, "positive integer"):
            with_sync_metadata({"id": "a"}, 0, "2026-08-04T12:00:00+00:00")


if __name__ == "__main__":
    unittest.main()
