import { createServer, type ServerResponse } from "node:http";
import type { AgentRuntime } from "../agent/runtime.js";

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

export function createApi(agent: AgentRuntime) {
  return createServer((request, response) => {
    const pathname = (request.url ?? "/").split("?")[0];
    if (pathname !== "/health" && pathname !== "/v1/status") {
      sendJson(response, 404, { error: "not_found" });
      return;
    }

    if (request.method !== "GET") {
      response.setHeader("allow", "GET");
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    if (pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    sendJson(response, 200, {
      version: 1,
      conversationId: String(agent.conversationId),
      agent: agent.configuration,
      capabilities: { chat: false, backgroundTasks: false },
    });
  });
}
