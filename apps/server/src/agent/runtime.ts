import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { openStorage } from "../storage/sqlite.js";
import { type AgentConfiguration, createLlm, type LlmConfig, safeMessage } from "./provider.js";

export async function openAgent(databasePath: string, config: LlmConfig) {
  const { models } = createLlm(config);
  const configuration: AgentConfiguration = config.apiKey
    ? { state: "configured", provider: "custom", modelId: config.modelId }
    : { state: "not_configured" };
  const harness = await Harness.open(
    await openStorage(databasePath),
    {
      models,
      registry: createRegistry(),
      onReport: (error) => console.error("Agent runtime:", safeMessage(error, config)),
    },
    BACKGROUND_CONTEXT,
  );

  try {
    const conversation = await harness.root(BACKGROUND_CONTEXT);
    if (configuration.state === "configured") {
      // root() may return an existing conversation, so configure it explicitly.
      await conversation.configure(
        {
          model: { provider: configuration.provider, modelId: configuration.modelId },
          thinkingLevel: "off",
        },
        BACKGROUND_CONTEXT,
      );
      harness.resume();
    }
    // Setup mode leaves the scheduler paused, including previously unfinished work.
    // Neither branch submits a test prompt on startup.
    return {
      harness,
      configuration,
      conversationId: conversation.id,
      close: () => harness.close(BACKGROUND_CONTEXT),
    };
  } catch (error) {
    await harness.close(BACKGROUND_CONTEXT);
    throw error;
  }
}

export type AgentRuntime = Awaited<ReturnType<typeof openAgent>>;
