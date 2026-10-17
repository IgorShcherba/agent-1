# Pi Durable Bot

A personal assistant built while learning [Pi Durable](https://github.com/earendil-works/pi/tree/main/packages/durable).
The intended product combines chat, background tasks, and proactive follow-ups, with terminal and native SwiftUI clients.

## Current scaffold

- A Node server opens a Pi Durable harness on persistent SQLite and exposes health and status endpoints.
- A terminal client built with `@earendil-works/pi-tui` connects to that server and displays its status.
- A minimal iOS 18+ SwiftUI app builds independently in Xcode.
- Docker Compose runs the server with a named data volume.

Model calls, chat submission/streaming, tools, background jobs, schedules, notifications, and iOS networking are **not implemented yet**. Starting this scaffold makes no model requests and requires no model-provider credentials. Cloudflare is out of scope.

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

## Run the server in Docker

```sh
corepack yarn docker:up
corepack yarn dev:terminal
corepack yarn docker:logs
corepack yarn docker:down
```

The container opens its own database in the `agent-data` named volume. `docker:down` preserves this volume. Local and Docker modes use separate databases; run one server at a time on the default port. Never open the same Pi storage from two server processes.

Docker publishes the port on loopback only. Authentication and access from a physical iPhone are future work; the scaffold is for local use.

## Open iOS

Open `apps/ios/PiDurableBot.xcodeproj`, select the `PiDurableBot` scheme and an iOS simulator, then Run. Device builds require selecting your signing team and a suitable bundle identifier.

The iOS app currently contains an empty assistant screen. It is not a Yarn workspace; Xcode owns its Swift build.

## Workspace commands

```sh
corepack yarn check       # Biome and TypeScript checks
corepack yarn build       # Compile server and terminal
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
