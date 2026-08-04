"""Small, dependency-free Phase 1 core engine for CyberWolf task records.

The module is deliberately local and deterministic: it computes a Today view from
records already available to the dashboard, scores task health, and attaches sync
metadata without contacting Google Sheets or mutating external state.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timezone
from typing import Any, Iterable, Mapping


Task = Mapping[str, Any]


def _as_date(value: Any) -> date | None:
    """Parse the date portion of an ISO date/datetime value."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not value:
        return None
    text = str(value).strip()
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _version(task: Task) -> int:
    try:
        return int(task.get("_version", 0))
    except (TypeError, ValueError):
        return 0


def computed_today(tasks: Iterable[Task], today: date) -> list[dict[str, Any]]:
    """Return one record per task ID that belongs in a computed Today view.

    A task is included when ``due``, ``date``, or ``scheduled_date`` is *today*,
    or when its due value is a recurring marker (``daily``/``recurring``). Rows
    with no usable ID/date are ignored. Duplicate IDs are collapsed by retaining
    the highest ``_version``; ties retain the first row. Input mappings are not
    modified.
    """
    selected: dict[str, dict[str, Any]] = {}
    recurring = {"daily", "recurring", "every day"}

    for source in tasks:
        task_id = str(source.get("id", source.get("task_id", ""))).strip()
        if not task_id:
            continue
        due_value = source.get("due", source.get("date", source.get("scheduled_date")))
        due_date = _as_date(due_value)
        is_today = due_date == today or str(due_value).strip().lower() in recurring
        if not is_today:
            continue
        candidate = deepcopy(dict(source))
        candidate.setdefault("id", task_id)
        current = selected.get(task_id)
        if current is None or _version(candidate) > _version(current):
            selected[task_id] = candidate

    return list(selected.values())


def health_score(task: Task, now: datetime) -> int:
    """Calculate a deterministic 0--100 task health score (higher is healthier).

    Unfinished high-priority, overdue, and inactive tasks lose points. A
    completed task is always healthy (100). Missing or malformed timestamps do
    not crash the engine and incur no inactivity penalty.
    """
    if task.get("completed") is True or str(task.get("status", "")).lower() in {
        "completed",
        "done",
    }:
        return 100

    priority_penalty = {"p0": 20, "p1": 12, "p2": 6, "p3": 0}.get(
        str(task.get("priority", "")).lower(), 0
    )
    due_value = task.get("due", task.get("date"))
    due = _as_date(due_value)
    today = now.date()
    due_penalty = 0
    if due is not None:
        days_until_due = (due - today).days
        if days_until_due < 0:
            due_penalty = min(45, 25 + abs(days_until_due) * 5)
        elif days_until_due == 0:
            due_penalty = 20
        elif days_until_due <= 2:
            due_penalty = 10

    updated = _as_date(task.get("last_updated", task.get("updated_at")))
    inactivity_penalty = 0 if updated is None else min(25, max(0, (today - updated).days) * 3)
    return max(0, min(100, 100 - priority_penalty - due_penalty - inactivity_penalty))


def with_sync_metadata(
    task: Task, version: int, synced_at: datetime | str | None = None
) -> dict[str, Any]:
    """Return a copy of *task* carrying the Phase 1 sync columns.

    ``_version`` is an integer supplied by the caller. If no timestamp is given,
    the current UTC time is used. This function performs no network or Sheets
    operation.
    """
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        raise ValueError("version must be a positive integer")
    if synced_at is None:
        timestamp = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    elif isinstance(synced_at, datetime):
        timestamp = synced_at.isoformat()
    else:
        timestamp = str(synced_at)
    result = deepcopy(dict(task))
    result["_version"] = version
    result["_synced_at"] = timestamp
    return result


__all__ = ["computed_today", "health_score", "with_sync_metadata"]

if __name__ == "__main__":
    print("CyberWolf Phase 1 core engine loaded; no external sync performed.")
