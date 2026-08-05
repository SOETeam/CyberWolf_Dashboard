"""Run CyberWolf's local 01:00 America/Detroit daily refresh.

The runner composes the existing pure calendar adapter and pure core engine. It
only reads JSON and writes one deterministic local artifact; it never contacts or
mutates Google Calendar, Sheets, or any other external system.
"""
from __future__ import annotations

import argparse
import json
import sys
from copy import deepcopy
from datetime import date, datetime, time
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from calendar_task_adapter import adapt_events, combine_normalized_records
from cyberwolf_core_engine import computed_today, health_score


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT = PROJECT_ROOT / "output" / "cyberwolf_daily_refresh.json"
DETROIT = ZoneInfo("America/Detroit")


def _read_calendar_json(input_path: str | None) -> tuple[list[dict[str, Any]], str]:
    """Read optional normalized Calendar JSON from a file, stdin, or nowhere."""
    if input_path in (None, ""):
        return [], "none"
    if input_path == "-":
        text = sys.stdin.read()
        source = "stdin"
    else:
        path = Path(input_path)
        text = path.read_text(encoding="utf-8")
        source = str(path.resolve())

    payload = json.loads(text)
    if isinstance(payload, list):
        events = payload
    elif isinstance(payload, dict) and isinstance(payload.get("events"), list):
        events = payload["events"]
    elif isinstance(payload, dict) and isinstance(payload.get("calendar_events"), list):
        events = payload["calendar_events"]
    else:
        raise ValueError("calendar JSON must be a list or an object with an 'events' list")
    if not all(isinstance(event, dict) for event in events):
        raise ValueError("calendar events must be JSON objects")
    return events, source


def _refresh_date(value: str | None) -> date:
    if value is None:
        return datetime.now(DETROIT).date()
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("--refresh-date must be an ISO date (YYYY-MM-DD)") from exc


def build_refresh_payload(
    events: list[dict[str, Any]], refresh_date: date, input_source: str,
    local_tasks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build the stable local refresh document from already-read event mappings."""
    adapted = adapt_events(events)
    combined = combine_normalized_records(local_tasks or [], events)
    # The adapter's local_date is the calendar-derived date used by the core's
    # computed Today view. Copy records so neither adapter output nor input changes.
    core_tasks = []
    for task in combined:
        core_task = deepcopy(task)
        if core_task.get("local_date"):
            core_task["due"] = core_task["local_date"]
        core_tasks.append(core_task)

    today_tasks = computed_today(core_tasks, refresh_date)
    refresh_now = datetime.combine(refresh_date, time(1, 0), tzinfo=DETROIT)
    scored_today = []
    for task in today_tasks:
        scored = deepcopy(task)
        scored["health_score"] = health_score(scored, refresh_now)
        scored_today.append(scored)

    return {
        "workflow": "cyberwolf_daily_refresh",
        "workflow_time": "01:00",
        "timezone": "America/Detroit",
        "refresh_date": refresh_date.isoformat(),
        "input_source": input_source,
        "calendar_event_count": len(events),
        "local_task_count": len(local_tasks or []),
        "adapted_task_count": len(adapted),
        "combined_item_count": len(combined),
        "external_sync": False,
        "sync_status": {
            "mode": "local_only",
            "google_calendar": "snapshot_loaded" if events else "no_local_snapshot",
            "health": "not_present_in_local_payload",
            "finance": "not_present_in_local_payload",
            "relay": "unverified",
        },
        "source_status": {
            "google_calendar": "available_from_local_snapshot" if events else "not_available_locally",
            "health": "not_ingested",
            "finance": "not_ingested",
        },
        "source_contracts": {
            "health": {
                "sheet_id": "1_gdlJ-ms-hF3nYUY5KGUhdYvs_G1fBIGTFnEKR2dTrQ",
                "columns": ["Date", "Time", "Category", "Status", "Notes", "Logged By"],
            },
            "finance": {
                "sheet_id": "1F_XnhZq0zZNmvSLGF_VciR19V5sts-RTJay0hAt84CQ",
                "tab": "Expense Summary",
                "columns": ["Date", "Time", "Action", "Amount", "Category", "Description", "Balance", "Logged By"],
            },
        },
        "local_tasks": [task for task in combined if task.get("source_key", "").startswith("local:")],
        "calendar_events": [task for task in combined if task.get("source_key", "").startswith("google_calendar:")],
        "tasks": core_tasks,
        "today_tasks": scored_today,
    }


def write_refresh_artifact(payload: dict[str, Any], output_path: str | Path) -> Path:
    """Write a sorted, indented JSON artifact and return its absolute path."""
    destination = Path(output_path).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return destination


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a local CyberWolf daily refresh artifact; no external sync."
    )
    parser.add_argument(
        "--calendar-input",
        metavar="PATH|-",
        help="optional calendar JSON path; use '-' to read JSON from stdin",
    )
    parser.add_argument(
        "--refresh-date",
        help="local Detroit date (YYYY-MM-DD); defaults to today's Detroit date",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help=f"local JSON artifact path (default: {DEFAULT_OUTPUT})",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        events, input_source = _read_calendar_json(args.calendar_input)
        refresh_date = _refresh_date(args.refresh_date)
        payload = build_refresh_payload(events, refresh_date, input_source)
        destination = write_refresh_artifact(payload, args.output)
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        print(f"daily refresh failed: {exc}", file=sys.stderr)
        return 2

    print(f"Wrote local CyberWolf daily refresh: {destination} (no external sync)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
