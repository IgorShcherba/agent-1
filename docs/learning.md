# Learning and implementation plan

## References

1. [Pi Durable introduction](https://earendil.com/posts/pi-durable/).
2. [Pi Durable README](https://github.com/earendil-works/pi/tree/main/packages/durable).
3. [Original vacation planner](https://github.com/earendil-works/pi/tree/v1.0.0/packages/coding-agent/src/experimental/vacation): trace `research` through its background task, child conversation, and report back.
4. [Background subagents example](https://github.com/earendil-works/pi/blob/main/packages/durable/test/examples/23-subagent-background.ts): persistent named workers, steering, cancellation, and restart behavior.
5. [Recovery example](https://github.com/earendil-works/pi/blob/main/packages/durable/test/examples/13-recovery.ts) and [late-join example](https://github.com/earendil-works/pi/blob/main/packages/durable/test/examples/21-late-join.ts).

The vacation demo's searches are simulated. Its v1.0.0 API also differs from our pinned v1.3.0 packages, including the tool result change from `content` to `output`. Use the installed declarations and release notes when adapting examples.

## Milestones

1. **Scaffold:** Yarn workspaces, persistent empty harness, server health/status, terminal connection, Docker, and a native iOS shell.
2. **Chat:** choose a provider and model; define submission and streaming contracts; add the first terminal conversation.
3. **Tools and recovery:** add one real read-only tool and verify recovery through an interrupted run and client reconnect.
4. **Background work:** adapt the vacation research/report pattern; expose progress, steering, and explicit cancellation.
5. **Proactive follow-ups:** persistent schedules, overdue behavior, preferences, and useful notifications.
6. **SwiftUI client:** connect to the same API, display history and active tasks, reconnect, and add push notifications.

The terminal is the first working client so we can learn and inspect the runtime before expanding the mobile interface.
