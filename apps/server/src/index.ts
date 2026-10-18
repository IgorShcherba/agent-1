import { once } from "node:events";
import { safeMessage } from "./agent/provider.js";
import { openAgent } from "./agent/runtime.js";
import { createApi } from "./api/server.js";
import { readConfig } from "./config.js";

async function main() {
  const config = readConfig();
  const agent = await openAgent(config.databasePath, config.llm);
  const server = createApi(agent);
  let closing = false;

  async function shutdown(exitCode = 0) {
    if (closing) return;
    closing = true;
    process.exitCode = exitCode;
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      });
    }
    await agent.close();
  }

  const stop = () => {
    void shutdown().catch((error: unknown) => {
      console.error("Shutdown failed:", safeMessage(error, config.llm));
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  void agent.harness.closed.then((end) => {
    if (end.reason === "failed") {
      console.error("Agent storage failed:", safeMessage(end.error, config.llm));
      return shutdown(1);
    }
  });

  try {
    server.listen(config.port, config.host);
    await once(server, "listening");
    console.log(`Pi Durable Bot listening on http://${config.host}:${config.port}`);
    console.log(`Conversation: ${agent.conversationId}`);
  } catch (error) {
    await shutdown(1);
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(safeMessage(error, { apiKey: process.env.LLM_API_KEY?.trim() }));
  process.exitCode = 1;
});
