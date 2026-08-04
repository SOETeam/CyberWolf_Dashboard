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
    source: dict[str, str] = {"type": "google_calendar", "event_id": event_id}
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


__all__ = ["adapt_event", "adapt_events"]

if __name__ == "__main__":
    print("CyberWolf calendar task adapter loaded; no external sync performed.")
