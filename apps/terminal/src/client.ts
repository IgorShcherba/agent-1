export type AgentConfiguration =
  | { state: "not_configured" }
  | { state: "configured"; provider: "custom"; modelId: string };

export interface AgentStatus {
  version: 1;
  conversationId: string;
  agent: AgentConfiguration;
  capabilities: { chat: false; backgroundTasks: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function decodeConfiguration(value: unknown): AgentConfiguration | undefined {
  if (!isRecord(value)) return undefined;
  if (value.state === "not_configured") return { state: "not_configured" };
  if (
    value.state === "configured" &&
    value.provider === "custom" &&
    typeof value.modelId === "string" &&
    value.modelId.length > 0
  ) {
    return { state: "configured", provider: "custom", modelId: value.modelId };
  }
  return undefined;
}

export function decodeStatus(value: unknown): AgentStatus {
  const agent = isRecord(value) ? decodeConfiguration(value.agent) : undefined;
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.conversationId !== "string" ||
    value.conversationId.length === 0 ||
    !agent ||
    !isRecord(value.capabilities) ||
    value.capabilities.chat !== false ||
    value.capabilities.backgroundTasks !== false
  ) {
    throw new Error("The server returned an unsupported status response.");
  }

  return {
    version: 1,
    conversationId: value.conversationId,
    agent,
    capabilities: { chat: false, backgroundTasks: false },
  };
}

export async function getStatus(serverUrl: URL): Promise<AgentStatus> {
  const response = await fetch(new URL("/v1/status", serverUrl), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Server returned HTTP ${response.status}.`);
  return decodeStatus(await response.json());
}
