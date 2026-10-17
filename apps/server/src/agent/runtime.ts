import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { openStorage } from "../storage/sqlite.js";

export async function openAgent(databasePath: string) {
  const harness = await Harness.open(
    await openStorage(databasePath),
    {
      models: createModels(),
      registry: createRegistry(),
      onReport: (error) => console.error("Agent runtime:", error),
    },
    BACKGROUND_CONTEXT,
  );

  try {
    const conversation = await harness.root(BACKGROUND_CONTEXT);
    // Providers, extensions, and message submission are the next learning milestone.
    // Opening the scaffold never makes a model request.
    harness.resume();

    return {
      harness,
      conversationId: conversation.id,
      close: () => harness.close(BACKGROUND_CONTEXT),
    };
  } catch (error) {
    await harness.close(BACKGROUND_CONTEXT);
    throw error;
  }
}

export type AgentRuntime = Awaited<ReturnType<typeof openAgent>>;
