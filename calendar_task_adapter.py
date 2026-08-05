"""Dependency-free adapter from normalized Google Calendar events to task records.

This module is intentionally local and pure: it reads event mappings, returns new
mappings, and performs no Calendar API calls or writes.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable, Mapping


Event = Mapping[str, Any]


def _value(event_part: Any) -> tuple[str | None, bool]:
    """Return the Calendar value and whether it is an all-day date value."""
    if isinstance(event_part, Mapping):
        if event_part.get("dateTime"):
            return str(event_part["dateTime"]), False
        if event_part.get("date"):
            return str(event_part["date"]), True
        return None, False
    if event_part:
        text = str(event_part)
        return text, len(text) == 10 and text[4] == "-" and text[7] == "-"
    return None, False


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _source(event: Event, event_id: str) -> dict[str, str]:
    existing = event.get("source")
    source: dict[str, str] = dict(existing) if isinstance(existing, Mapping) else {}
    source.setdefault("type", "google_calendar")
    source.setdefault("event_id", event_id)
    aliases = {
        "calendar_id": ("calendarId", "calendar_id"),
        "html_link": ("htmlLink", "html_link"),
        "status": ("status",),
        "recurring_event_id": ("recurringEventId", "recurring_event_id"),
    }
    for output_key, keys in aliases.items():
        for key in keys:
            value = event.get(key)
            if value not in (None, ""):
                source[output_key] = str(value)
                break
    return source


def adapt_event(event: Event) -> dict[str, Any] | None:
    """Convert one normalized Calendar event into a deterministic task record.

    Events without an ID are ignored. Google all-day ``end.date`` values remain
    date strings (the API's end-exclusive convention); timed values retain their
    original ISO text while local date/time are derived from each value's offset.
    """
    if not isinstance(event, Mapping):
        return None
    event_id = event.get("id", event.get("event_id"))
    if event_id in (None, ""):
        return None
    event_id = str(event_id).strip()
    if not event_id:
        return None

    start, start_all_day = _value(event.get("start"))
    end, _ = _value(event.get("end"))
    start_dt = _parse_datetime(start)
    end_dt = _parse_datetime(end)

    if start_all_day:
        local_date = start[:10] if start else None
        time_block = "all_day"
    elif start_dt:
        local_date = start_dt.date().isoformat()
        time_block = start_dt.strftime("%H:%M")
        if end_dt:
            time_block += "-" + end_dt.strftime("%H:%M")
    else:
        local_date = start[:10] if start and len(start) >= 10 else None
        time_block = None

    return {
        "id": event_id,
        "event_id": event_id,
        "title": str(event.get("summary", event.get("title", "")) or ""),
        "start": start,
        "end": end,
        "local_date": local_date,
        "time_block": time_block,
        "source": _source(event, event_id),
    }


def adapt_events(events: Iterable[Event]) -> list[dict[str, Any]]:
    """Adapt events in input order, excluding events without usable IDs."""
    result = []
    for event in events or []:
        task = adapt_event(event)
        if task is not None:
            result.append(task)
    return result


def _local_record(task: Event) -> dict[str, Any] | None:
    """Normalize a local task without changing its completion semantics."""
    if not isinstance(task, Mapping):
        return None
    task_id = str(task.get("id", task.get("task_id", "")) or "").strip()
    if not task_id:
        return None
    result = dict(task)
    result["id"] = task_id
    result.setdefault("title", str(result.get("label", "")))
    result.setdefault("source", {"type": "local", "task_id": task_id})
    result.setdefault("source_key", f"local:{task_id}")
    result.setdefault("completed", result.get("status") in {"completed", "done"})
    if result.get("local_date") and not result.get("due"):
        result["due"] = result["local_date"]
    return result


def _future_source_record(record: Event, source_type: str) -> dict[str, Any] | None:
    """Keep a future Sheet row lossless while giving the UI a stable identity."""
    if not isinstance(record, Mapping):
        return None
    record_id = str(record.get("id", record.get("source_id", "")) or "").strip()
    if not record_id:
        # Sheet rows may not have IDs yet; use the source row's stable date/time
        # only when present, without claiming it is a live-ingested record.
        date_value = record.get("Date", record.get("date", ""))
        time_value = record.get("Time", record.get("time", ""))
        record_id = f"{date_value}:{time_value}".strip(":")
    if not record_id:
        return None
    result = dict(record)
    result["id"] = record_id
    result.setdefault("title", str(record.get("Description", record.get("Category", "")) or ""))
    source = dict(result.get("source") or {})
    source.setdefault("type", source_type)
    result["source"] = source
    result.setdefault("source_key", f"{source_type}:{record_id}")
    result.setdefault("sync_status", "future_contract_only")
    return result


def combine_normalized_records(
    local_tasks: Iterable[Event], calendar_events: Iterable[Event],
    health_records: Iterable[Event] | None = None,
    finance_records: Iterable[Event] | None = None,
) -> list[dict[str, Any]]:
    """Return local tasks and read-only Google events in one stable UI dataset.

    The visible ``id`` remains the original local task ID or Google event ID.
    ``source_key`` provides a source-qualified identity for joins when two
    systems happen to use the same ID. No external API or write is performed.
    """
    result: list[dict[str, Any]] = []
    for task in local_tasks or []:
        normalized = _local_record(task)
        if normalized is not None:
            result.append(normalized)
    for event in adapt_events(calendar_events):
        event["source_key"] = f"google_calendar:{event['event_id']}"
        event.setdefault("completed", False)
        event.setdefault("completion_source", "local")
        result.append(event)
    for record in health_records or []:
        normalized = _future_source_record(record, "health_sheet")
        if normalized is not None:
            result.append(normalized)
    for record in finance_records or []:
        normalized = _future_source_record(record, "finance_sheet")
        if normalized is not None:
            result.append(normalized)
    return result


__all__ = ["adapt_event", "adapt_events", "combine_normalized_records"]

if __name__ == "__main__":
    print("CyberWolf calendar task adapter loaded; no external sync performed.")
