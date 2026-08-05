# CyberWolf calendar UX implementation plan (corrected)

## Product boundary
CyberWolf is the user-facing planner. Google Calendar remains a read-only incorporated source whose normalized events are ingested into the local CyberWolf refresh artifact. Sophia does not need to operate Google Calendar manually.

## Data flow
1. Preserve the existing normalized-event boundary in `calendar_task_adapter.py`.
2. Normalize local tasks and adapted Google events into one combined local dataset. Keep the original local task ID or Google event ID in `id`; add a source-qualified `source_key` for joins and diagnostics.
3. Preserve source metadata (`source.type`, `event_id`, calendar ID, HTML link, status), ISO start/end values, derived local date/time block, and local completion semantics. Google events default to incomplete and are completed only through CyberWolf's existing local completion state.
4. `daily_refresh_runner.py` writes a deterministic same-origin JSON artifact with `local_tasks`, `calendar_events`, combined `tasks`, and derived `today_tasks`. It remains local-only and does not call Google APIs or create external writes.
5. The browser parser accepts the artifact only when `external_sync: false`; the UI renders the combined task/event data.

## UX
- Agenda is a true single-day planner over combined local + Google data, with all-day items and a 24-hour timeline.
- Calendar month popout uses the same combined dataset, shows day counts, opens a day summary, and `SEE MORE →` selects that date in Agenda.
- Existing completion/relay behavior remains the only external task sync path. No Google Calendar write was added.
- Only the Recovery Day render panel was removed; unrelated task, sync, finance, and shared widgets remain.

## Verification plan
- Python adapter test: local and Google records coexist, preserve source IDs/metadata, and retain completion state.
- Python refresh test: artifact contains both source views and the combined records.
- JavaScript artifact test: parser preserves source metadata and completion values.
- Existing Python and Node suites, JavaScript syntax checks, and `git diff --check`.

## Limitations
- The runner still consumes already-exported normalized calendar JSON; Google OAuth/API ingestion is outside this repository's existing local-only boundary.
- Google event completion is intentionally local/UI state; no Calendar event mutation is performed.
- The checked-in generated artifact is not regenerated with a live external source during this change.
- No commit, push, or deploy was performed.

## Future safe extension
If an approved ingestion job supplies local tasks in addition to calendar JSON, pass them through `build_refresh_payload(..., local_tasks=[...])`; the same artifact/UI schema can consume them without changing the Google sync boundary.

## Exact files changed for this correction
- `calendar_task_adapter.py`
- `daily_refresh_runner.py`
- `dashboard_core.js`
- `dashboard.js`
- `index.html`
- `styles.css`
- `tests/test_calendar_task_adapter.py`
- `tests/test_daily_refresh_runner.py`
- `tests/dashboard_refresh_artifact.test.js`
- `tests/dashboard_core.test.js` (existing agenda helper coverage retained)
- `docs/DAILY_REFRESH_RUNNER.md`
- `docs/CALENDAR_UX_IMPLEMENTATION_PLAN.md`

The dashboard/index/style/core UX edits were already present in the active working tree from the preceding calendar UX slice; this correction preserves them and connects the combined artifact data to that UI.

## Test commands
```bash
python3 -m unittest discover -s tests -v
node tests/dashboard_core.test.js
node tests/dashboard_refresh_artifact.test.js
node --check dashboard.js
node --check dashboard_core.js
git diff --check
```

All commands above pass in the current workspace.
