import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readLlmConfig } from "./agent/provider.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

export function readConfig() {
  const port = Number(process.env.PORT ?? "4310");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return {
    llm: readLlmConfig(),
    host: process.env.HOST ?? "127.0.0.1",
    port,
    databasePath: resolve(repositoryRoot, process.env.DATA_DIR ?? "data", "agent.sqlite"),
  };
}
