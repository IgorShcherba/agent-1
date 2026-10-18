# API contracts

Both clients communicate with the same server. This directory holds language-neutral schemas; it is not a Yarn workspace.

| Endpoint | Response | Purpose |
| --- | --- | --- |
| `GET /health` | `{ "status": "ok" }` | Server and opened runtime availability |
| `GET /v1/status` | [`status.schema.json`](status.schema.json) | Persistent root conversation and currently implemented capabilities |

The `agent` status is either `{ "state": "not_configured" }` or `{ "state": "configured", "provider": "custom", "modelId": "callstack/Apex" }`. Configured means the server has valid local configuration; it does not verify credentials or remote availability. Credentials and the base URL are never included. Chat and background-task capabilities remain `false`.

Only these two GET endpoints exist in the scaffold. Unknown routes return 404; other methods on known routes return 405. Responses are JSON and disable caching.

Conversation IDs are opaque strings in the client protocol; the server converts Pi's internal numeric IDs at the API boundary.

Chat commands and streamed events will receive explicit contracts before either client implements them. Keep protocol changes coordinated across server, terminal, and Swift models. The initial terminal decoder validates the status fields it consumes; schema-based code generation can follow when the protocol grows.
