# Phase 5 — Agent Communication (Local Slice)

This phase adds a dependency-free, browser/CommonJS module and a visible dashboard panel for local agent events and handoffs.

## Local input

The dashboard optionally reads same-origin `output/agent_events.json`. It accepts either an array of events or `{ "events": [...] }`. Missing, malformed, or invalid input fails soft to an empty state. No event file is included by default.

The pure module (`agent_communication.js`) provides:

- `normalizeAgentEvent(event)` — validates and normalizes IDs, agent/source names, event types, severity, and timestamps.
- `createHandoffRecord(input)` — validates required handoff fields and emits a deterministic handoff ID.
- `sortAgentEvents(events)` — filters invalid events and sorts newest first with stable ties.
- `renderAgentEventText(event)` — returns plain text; the dashboard assigns it with `textContent` rather than HTML.

## Explicit non-goals

- Discord delivery is **unimplemented** in this local slice.
- Voice APIs/calls are **unimplemented** in this local slice.
- No Google Workspace mutation, relay change, deployment, webhook, or cron job is created.
- The existing task-completion state, localStorage schema, Calendar adapter, relay URLs/payloads, and external delivery paths are unchanged.
- Delegation rate safeguards remain documentation/configuration concerns: `max_concurrent_children=2` and `api_max_retries=1`; this UI slice does not spawn workers or make API calls.
