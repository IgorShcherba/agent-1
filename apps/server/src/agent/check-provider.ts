import { createLlm, type LlmConfig, safeMessage } from "./provider.js";

export const PROVIDER_CHECK_TIMEOUT_MS = 30_000;

// Uses the same provider as the harness, but never opens agent storage.
export async function checkProvider(config: LlmConfig): Promise<string> {
  if (!config.apiKey) {
    throw new Error("Set LLM_API_KEY in the ignored root .env or process environment first.");
  }
  const { models, model } = createLlm(config);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_CHECK_TIMEOUT_MS);
  let status: number | undefined;
  let receivedEvent = false;
  try {
    const result = await models.completeSimple(
      model,
      { messages: [{ role: "user", content: "Reply with a short hello.", timestamp: Date.now() }] },
      {
        maxTokens: 512,
        maxRetries: 0,
        timeoutMs: PROVIDER_CHECK_TIMEOUT_MS,
        signal: controller.signal,
        onResponse: (response) => {
          status = response.status;
          const type = response.headers["content-type"]?.split(";")[0]?.trim().toLowerCase();
          if (type !== "text/event-stream") {
            throw new Error("Expected a text/event-stream response for stream: true.");
          }
        },
        onProviderStreamEvent: () => {
          receivedEvent = true;
        },
      },
    );
    if (controller.signal.aborted || result.stopReason === "aborted") {
      throw new Error("Provider check timed out after 30 seconds.");
    }
    if (result.stopReason === "error") {
      const detail = result.errorMessage ?? "Unknown provider error.";
      if (/401|403/.test(detail)) {
        throw new Error(
          "Provider rejected authentication (HTTP 401/403). Check LLM_API_KEY and model access.",
        );
      }
      throw new Error(
        `Provider check failed${status ? ` (HTTP ${status})` : ""}: ${safeMessage(detail, config)} Check LLM_BASE_URL, model access, and streamed Chat Completions support.`,
      );
    }
    if (!receivedEvent || result.stopReason !== "stop") {
      throw new Error(
        `Provider check did not return a complete text answer (stop reason: ${result.stopReason}).`,
      );
    }
    const text = result.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (!text) throw new Error("Provider returned an empty text answer.");
    return safeMessage(text, config);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("Provider check timed out after 30 seconds.");
    throw new Error(safeMessage(error, config));
  } finally {
    clearTimeout(timer);
  }
}
