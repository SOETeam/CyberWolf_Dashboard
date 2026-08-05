import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from calendar_task_adapter import adapt_event, adapt_events, combine_normalized_records


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

    def test_combined_records_keep_local_and_google_records_with_source_keys(self):
        local = [{"id": "local-1", "title": "Write brief", "due": "2026-08-05", "completed": True}]
        google = [{"id": "google-1", "summary": "Client call", "start": {"dateTime": "2026-08-05T10:00:00-04:00"}, "end": {"dateTime": "2026-08-05T11:00:00-04:00"}, "calendarId": "work"}]

        result = combine_normalized_records(local, google)

        self.assertEqual([record["id"] for record in result], ["local-1", "google-1"])
        self.assertEqual(result[0]["source_key"], "local:local-1")
        self.assertTrue(result[0]["completed"])
        self.assertEqual(result[1]["source_key"], "google_calendar:google-1")
        self.assertEqual(result[1]["source"]["calendar_id"], "work")
        self.assertFalse(result[1]["completed"])

    def test_google_source_metadata_is_preserved(self):
        result = adapt_event({
            "id": "g-2", "summary": "Call", "source": {"relay_revision": "v8"},
            "start": {"dateTime": "2026-08-05T10:00:00-04:00"},
        })
        self.assertEqual(result["source"]["relay_revision"], "v8")
        self.assertEqual(result["source"]["type"], "google_calendar")

    def test_combined_records_preserve_future_health_and_finance_source_metadata(self):
        result = combine_normalized_records(
            [], [],
            health_records=[{"id": "h-1", "Date": "2026-08-05", "source": {"type": "health_sheet", "sheet_id": "health-sheet"}}],
            finance_records=[{"id": "f-1", "Date": "2026-08-05", "source": {"type": "finance_sheet", "sheet_id": "finance-sheet"}}],
        )
        self.assertEqual([item["source_key"] for item in result], ["health_sheet:h-1", "finance_sheet:f-1"])
        self.assertEqual(result[0]["source"]["sheet_id"], "health-sheet")
        self.assertEqual(result[1]["source"]["sheet_id"], "finance-sheet")


if __name__ == "__main__":
    unittest.main()
