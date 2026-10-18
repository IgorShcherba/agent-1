import { checkProvider } from "./agent/check-provider.js";
import { readLlmConfig } from "./agent/provider.js";

try {
  const answer = await checkProvider(readLlmConfig());
  console.log("Provider connection succeeded (streamed Chat Completions).");
  console.log(answer);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Provider connection check failed.");
  process.exitCode = 1;
}
