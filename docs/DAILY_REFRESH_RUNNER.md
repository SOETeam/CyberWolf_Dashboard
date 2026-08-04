# CyberWolf local daily refresh runner

`daily_refresh_runner.py` is the local-only implementation of the CyberWolf daily
refresh workflow. It models the `01:00 America/Detroit` run and composes:

- `calendar_task_adapter.py` to adapt normalized Calendar event JSON;
- `cyberwolf_core_engine.py` to compute the Detroit-date Today view and health scores.

It reads JSON and writes a deterministic JSON artifact. It does **not** use OAuth,
Google APIs, Google Calendar, Sheets, network calls, or any external mutation.
No Hermes cron job is registered by this project.

## Exact invocation with a file

From `/root/CyberWolf_Dashboard`:

```bash
python3 daily_refresh_runner.py \
  --calendar-input tests/fixtures/daily_refresh_calendar_events.json \
  --refresh-date 2026-08-06
```

The default output is:

```text
/root/CyberWolf_Dashboard/output/cyberwolf_daily_refresh.json
```

Use `--output /some/local/path.json` to choose another local artifact path. Supplying
`--refresh-date` makes reruns byte-for-byte deterministic for the same input. If it
is omitted, the current date in `America/Detroit` is used.

## Exact invocation from stdin

```bash
cat tests/fixtures/daily_refresh_calendar_events.json | \
  python3 daily_refresh_runner.py \
    --calendar-input - \
    --refresh-date 2026-08-06 \
    --output output/cyberwolf_daily_refresh.stdin.json
```

The input may be a JSON list of events, or an object with an `events` or
`calendar_events` list. Omitting `--calendar-input` is also valid and produces an
empty local refresh (`calendar_event_count: 0`).

## Verification

Run the runner test and all existing tests from the project root:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
node tests/dashboard_core.test.js
```

The runner test exercises both file input and stdin input, asserts the local
artifact contents, and reruns the same command to verify deterministic output.

## Artifact shape

The artifact includes `workflow`, `workflow_time`, `timezone`, `refresh_date`, input
counts, `external_sync: false`, adapted `tasks`, and scored `today_tasks`. It is a
local output file only; writing it is not a claim of external synchronization.

## Safety boundary

The runner has no Google credentials/API imports and no scheduler registration. A
future scheduler may invoke this command locally, but adding or enabling that
scheduler is outside this artifact and was intentionally not performed here.
