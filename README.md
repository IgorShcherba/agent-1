# Pi Durable Bot

A personal assistant built while learning [Pi Durable](https://github.com/earendil-works/pi/tree/main/packages/durable).
The intended product combines chat, background tasks, and proactive follow-ups, with terminal and native SwiftUI clients.

## Current implementation

- A Node server opens a Pi Durable harness on persistent SQLite and exposes health and status endpoints.
- An optional custom Chat Completions provider configures the root conversation. An explicit command checks streamed model connectivity.
- A terminal client built with `@earendil-works/pi-tui` connects to that server and displays its status.
- A minimal iOS 18+ SwiftUI app builds independently in Xcode.
- Docker Compose runs the server with a named data volume.

Chat submission/streaming, tools, background jobs, schedules, notifications, and iOS networking are **not implemented yet**. Ordinary startup submits no test prompts. Without a model key the server runs in setup mode with task scheduling paused. With a key, it configures the conversation and resumes any persisted work. Cloudflare is out of scope.

## Prerequisites

- Node **24.18.0**, pinned in `.nvmrc` and `.node-version`.
- Corepack, with Yarn **4.18.1** selected by `packageManager`.
- Docker with Compose for container development.
- Xcode for the separate iOS app.

If using nvm, run `nvm use` in this directory. Use `corepack yarn` if a `yarn` shim is not available. `.yarnrc.yml` selects `node_modules` installs and ignores inherited `yarnPath` overrides, so a global Yarn installation does not replace this repository's pinned version.

## Run locally

```sh
corepack yarn install
corepack yarn dev:server
```

In another terminal:

```sh
corepack yarn dev:terminal
```

The server listens on `http://127.0.0.1:4310`. Terminal commands are `/status`, `/help`, and `/quit`. Closing the terminal client leaves the server running.

For a noninteractive connection check:

```sh
corepack yarn dev:terminal --status
```

Optional configuration is documented in `.env.example`. Copy it to `.env` to override defaults. Both workspace commands load that root file. `DATA_DIR` is resolved relative to the repository root; the default local database is `data/agent.sqlite`.

## Configure the model provider

Copy `.env.example` to the ignored root `.env`, then set your project-specific `LLM_API_KEY`. Do not paste the key into source code, terminal arguments, or chat. The defaults are:

```dotenv
LLM_BASE_URL=https://api.callstack.ai/v1
LLM_MODEL=callstack/Apex
```

The base URL must exclude `/chat/completions`, credentials, query parameters, and fragments. The model ID is case-sensitive. Only this project's key is used; global provider credentials are not consulted.

With no key, `/health` and `/v1/status` work in setup mode. With a key, status reports `configured`, meaning local configuration only, without validating remote access. Chat and background tasks still report unavailable. The stored root conversation is configured explicitly on each configured startup, including existing databases. Credentials remain in memory/environment and are not part of the stored agent configuration.

Run this command explicitly to make one short model request:

```sh
corepack yarn check:provider
```

It uses Pi's streaming Chat Completions adapter with a 30-second deadline, a 512-token output limit, and no automatic retries. It prints the completed text or an error and does not open the agent database. The endpoint must support `stream: true` with SSE and a terminal `finish_reason`; no protocol fallback is attempted. The check rejects truncated, empty, and incomplete responses.

The text-only model has reasoning disabled, a 262,144-token context window, and a 4,096-token application output cap. Context and pricing metadata come from [Apex's model information](https://apex.callstack.com/models) and [pricing](https://apex.callstack.com/#pricing): $0.50 input, $0.20 cached input, and $3.00 output per million tokens. These rates are metadata for Apex, not authoritative billing for an arbitrary endpoint/model override. Streaming usage extras are disabled for compatibility, so a successful check may not include token counts or cost estimates.

## Run the server in Docker

```sh
corepack yarn docker:up
corepack yarn dev:terminal
corepack yarn docker:logs
corepack yarn docker:down
```

The container opens its own database in the `agent-data` named volume. `docker:down` preserves this volume. Local and Docker modes use separate databases; run one server at a time on the default port. Never open the same Pi storage from two server processes.

Compose forwards only the three `LLM_` configuration variables from the process/root `.env`. The container keeps its own host, port, and data path from the Dockerfile. The key is supplied at runtime and excluded from the build context. To run the explicit probe inside an already-running container: `docker compose exec server node apps/server/dist/check-provider.js`.

Docker publishes the port on loopback only. Authentication and access from a physical iPhone are future work; the scaffold is for local use.

## Open iOS

Open `apps/ios/PiDurableBot.xcodeproj`, select the `PiDurableBot` scheme and an iOS simulator, then Run. Device builds require selecting your signing team and a suitable bundle identifier.

The iOS app currently contains an empty assistant screen. It is not a Yarn workspace; Xcode owns its Swift build.

## Workspace commands

```sh
corepack yarn check       # Biome and TypeScript checks
corepack yarn build       # Compile server and terminal
corepack yarn test        # Local provider/protocol integration tests (includes a 30s timeout)
corepack yarn format      # Format and apply safe lint fixes
corepack yarn start:server
corepack yarn start:terminal
```

## Layout

```text
apps/server/       Pi Durable runtime, HTTP API, SQLite, Dockerfile
apps/terminal/     Terminal client of the server
apps/ios/          SwiftUI app and Xcode project
contracts/         Language-neutral HTTP and event contracts
docs/              Architecture and learning plan
```

Start with [the architecture](docs/architecture.md) and [the learning plan](docs/learning.md).
