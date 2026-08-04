import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from calendar_task_adapter import adapt_event, adapt_events


FIXTURE = Path(__file__).parent / "fixtures" / "calendar_events.json"


class CalendarTaskAdapterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.events = json.loads(FIXTURE.read_text())

    def test_fixture_adapts_timed_event_using_timestamp_offset(self):
        task = adapt_event(self.events[0])

        self.assertEqual(
            task,
            {
                "id": "evt-timed-1",
                "event_id": "evt-timed-1",
                "title": "Timezone-aware planning",
                "start": "2026-08-05T23:30:00-04:00",
                "end": "2026-08-06T00:45:00-04:00",
                "local_date": "2026-08-05",
                "time_block": "23:30-00:45",
                "source": {
                    "type": "google_calendar",
                    "event_id": "evt-timed-1",
                    "calendar_id": "work@example.com",
                    "html_link": "https://calendar.google.com/event?eid=evt-timed-1",
                    "status": "confirmed",
                },
            },
        )

    def test_fixture_adapts_all_day_event_as_all_day(self):
        task = adapt_event(self.events[1])

        self.assertEqual(task["local_date"], "2026-08-06")
        self.assertEqual(task["time_block"], "all_day")
        self.assertEqual(task["start"], "2026-08-06")
        self.assertEqual(task["end"], "2026-08-07")

    def test_missing_optional_fields_are_deterministic(self):
        task = adapt_event(self.events[2])

        self.assertEqual(task["title"], "")
        self.assertIsNone(task["end"])
        self.assertEqual(task["local_date"], "2026-08-07")
        self.assertEqual(task["time_block"], "09:00")
        self.assertEqual(task["source"], {"type": "google_calendar", "event_id": "evt-minimal-1"})

    def test_batch_is_stable_and_does_not_mutate_input(self):
        source = json.loads(FIXTURE.read_text())
        before = json.loads(json.dumps(source))

        first = adapt_events(source)
        second = adapt_events(source)

        self.assertEqual(first, second)
        self.assertEqual(source, before)
        self.assertEqual([task["event_id"] for task in first], [
            "evt-timed-1", "evt-all-day-1", "evt-minimal-1"
        ])

    def test_event_without_id_is_ignored(self):
        self.assertIsNone(adapt_event({"summary": "not usable", "start": {"date": "2026-08-01"}}))
        self.assertEqual(adapt_events([{"summary": "not usable"}]), [])


if __name__ == "__main__":
    unittest.main()
