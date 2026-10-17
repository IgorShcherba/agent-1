export interface AgentStatus {
  version: 1;
  conversationId: string;
  agent: { state: "not_configured" };
  capabilities: { chat: false; backgroundTasks: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function getStatus(serverUrl: URL): Promise<AgentStatus> {
  const response = await fetch(new URL("/v1/status", serverUrl), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}.`);
  }

  const value: unknown = await response.json();
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.conversationId !== "string" ||
    value.conversationId.length === 0 ||
    !isRecord(value.agent) ||
    value.agent.state !== "not_configured" ||
    !isRecord(value.capabilities) ||
    value.capabilities.chat !== false ||
    value.capabilities.backgroundTasks !== false
  ) {
    throw new Error("The server returned an unsupported status response.");
  }

  return {
    version: 1,
    conversationId: value.conversationId,
    agent: { state: value.agent.state },
    capabilities: { chat: false, backgroundTasks: false },
  };
}
