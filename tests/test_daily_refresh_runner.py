import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "daily_refresh_calendar_events.json"
RUNNER = ROOT / "daily_refresh_runner.py"


class DailyRefreshRunnerTests(unittest.TestCase):
    def test_payload_contains_combined_local_and_calendar_views_without_losing_google_identity(self):
        from daily_refresh_runner import build_refresh_payload
        payload = build_refresh_payload(
            [{"id": "g-1", "summary": "Calendar event", "start": {"dateTime": "2026-08-06T09:00:00-04:00"}}],
            __import__("datetime").date(2026, 8, 6),
            "fixture",
            local_tasks=[{"id": "local-1", "title": "Local task", "due": "2026-08-06", "completed": True}],
        )
        self.assertEqual([task["id"] for task in payload["tasks"]], ["local-1", "g-1"])
        self.assertEqual(payload["calendar_events"][0]["source_key"], "google_calendar:g-1")
        self.assertEqual(payload["local_tasks"][0]["source_key"], "local:local-1")
        self.assertTrue(payload["tasks"][0]["completed"])

    def test_fixture_produces_deterministic_local_artifact(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "refresh.json"
            command = [
                sys.executable,
                str(RUNNER),
                "--calendar-input",
                str(FIXTURE),
                "--refresh-date",
                "2026-08-06",
                "--output",
                str(output_path),
            ]
            first = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=True)
            first_bytes = output_path.read_bytes()
            first_payload = json.loads(first_bytes)

            second = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=True)
            second_bytes = output_path.read_bytes()
            second_payload = json.loads(second_bytes)

        self.assertEqual(first_bytes, second_bytes)
        self.assertEqual(first_payload, second_payload)
        self.assertEqual(first_payload["workflow"], "cyberwolf_daily_refresh")
        self.assertEqual(first_payload["workflow_time"], "01:00")
        self.assertEqual(first_payload["timezone"], "America/Detroit")
        self.assertFalse(first_payload["external_sync"])
        self.assertEqual(first_payload["calendar_event_count"], 3)
        self.assertEqual(first_payload["adapted_task_count"], 3)
        self.assertEqual([task["id"] for task in first_payload["today_tasks"]], ["evt-all-day-1"])
        self.assertEqual(first_payload["today_tasks"][0]["health_score"], 80)
        self.assertIn(str(output_path), first.stdout)
        self.assertEqual(second.stderr, "")

    def test_stdin_is_supported_without_external_side_effects(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "stdin-refresh.json"
            result = subprocess.run(
                [
                    sys.executable,
                    str(RUNNER),
                    "--calendar-input",
                    "-",
                    "--refresh-date",
                    "2026-08-06",
                    "--output",
                    str(output_path),
                ],
                cwd=ROOT,
                input=FIXTURE.read_text(),
                capture_output=True,
                text=True,
                check=True,
            )
            payload = json.loads(output_path.read_text())

        self.assertEqual(payload["input_source"], "stdin")
        self.assertEqual(payload["today_tasks"][0]["title"], "Release day")
        self.assertIn("no external sync", result.stdout.lower())


if __name__ == "__main__":
    unittest.main()
