import { createModels, createProvider, envApiKeyAuth, type Model } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

export const DEFAULT_LLM_BASE_URL = "https://api.callstack.ai/v1";
export const DEFAULT_LLM_MODEL = "callstack/Apex";
export const PROVIDER_ID = "custom";

export interface LlmConfig {
  baseUrl: string;
  modelId: string;
  apiKey?: string;
}

export type AgentConfiguration =
  | { state: "not_configured" }
  | { state: "configured"; provider: "custom"; modelId: string };

export function readLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  let url: URL;
  try {
    url = new URL(env.LLM_BASE_URL ?? DEFAULT_LLM_BASE_URL);
  } catch {
    throw new Error("LLM_BASE_URL must be an absolute HTTP or HTTPS base URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("LLM_BASE_URL must use HTTP or HTTPS without credentials, query, or fragment.");
  }

  if (/\/chat\/completions\/?$/.test(url.pathname)) {
    throw new Error("LLM_BASE_URL must be the base URL, without /chat/completions.");
  }

  const modelId = (env.LLM_MODEL ?? DEFAULT_LLM_MODEL).trim();
  if (
    !modelId ||
    /\s/.test(modelId) ||
    [...modelId].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  ) {
    throw new Error(
      "LLM_MODEL must be a nonempty model ID without whitespace or control characters.",
    );
  }
  const apiKey = env.LLM_API_KEY?.trim();
  if (apiKey && /\s|[^\x21-\x7e]/.test(apiKey)) {
    throw new Error("LLM_API_KEY must be a Bearer token without whitespace or control characters.");
  }

  return {
    baseUrl: url.href.replace(/\/$/, ""),
    modelId,
    ...(apiKey ? { apiKey } : {}),
  };
}

// Redact the project credential before printing errors or provider output.
// Do not log whole config objects or upstream error objects.
export function safeMessage(value: unknown, config?: { apiKey?: string | undefined }): string {
  const text = value instanceof Error ? value.message : String(value);
  return config?.apiKey ? text.split(config.apiKey).join("[redacted]") : text;
}

export function createLlm(config: LlmConfig) {
  // Auth resolves only this project's key; no global credential files are consulted.
  const models = createModels({
    authContext: {
      env: async (name) => (name === "LLM_API_KEY" ? config.apiKey : undefined),
      fileExists: async () => false,
    },
  });
  const model: Model<"openai-completions"> = {
    id: config.modelId,
    name: config.modelId,
    api: "openai-completions",
    provider: PROVIDER_ID,
    baseUrl: config.baseUrl,
    input: ["text"],
    reasoning: false,
    contextWindow: 262_144,
    maxTokens: 4_096,
    // USD / 1M tokens: https://apex.callstack.com/#pricing.
    // Apex publishes no cache-write rate; this protocol reports no cache writes.
    // Zero here is unused metadata, not a claim of free cache writes.
    cost: { input: 0.5, output: 3, cacheRead: 0.2, cacheWrite: 0 },
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsUsageInStreaming: false,
      supportsFinishReason: true,
      maxTokensField: "max_tokens",
    },
  };
  if (config.apiKey) {
    models.setProvider(
      createProvider({
        id: PROVIDER_ID,
        name: "Custom Chat Completions",
        baseUrl: config.baseUrl,
        auth: { apiKey: envApiKeyAuth("Project LLM API key", ["LLM_API_KEY"]) },
        models: [model],
        api: openAICompletionsApi(),
      }),
    );
  }
  return { models, model };
}
