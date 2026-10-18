import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { decodeStatus } from "../../terminal/src/client.js";
import { checkProvider } from "../src/agent/check-provider.js";
import { createLlm, type LlmConfig, readLlmConfig } from "../src/agent/provider.js";
import { openAgent } from "../src/agent/runtime.js";
import { createApi } from "../src/api/server.js";

const key = "fake-test-key-do-not-use";
type Mode =
  | "success"
  | "auth"
  | "error"
  | "nonstream"
  | "unfinished"
  | "length"
  | "empty"
  | "stall";

async function mockProvider(mode: Mode) {
  const requests: {
    path: string | undefined;
    authorization: string | undefined;
    body: Record<string, unknown>;
  }[] = [];
  const server = createServer(async (request: IncomingMessage, response) => {
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    requests.push({
      path: request.url,
      authorization: request.headers.authorization,
      body: JSON.parse(body),
    });
    if (mode === "auth" || mode === "error") {
      response.writeHead(mode === "auth" ? 401 : 500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: `upstream echoed ${key}` } }));
      return;
    }
    if (mode === "nonstream") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({ choices: [{ message: { content: "hello" }, finish_reason: "stop" }] }),
      );
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
    const event = (delta: unknown, finishReason: string | null) =>
      `data: ${JSON.stringify({ id: "test", object: "chat.completion.chunk", created: 1, model: "callstack/Apex", choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`;
    response.write(event({ role: "assistant", content: mode === "empty" ? "" : "hello" }, null));
    if (mode === "stall") return; // Deadline must cover a stalled response body too.
    if (mode !== "unfinished") response.write(event({}, mode === "length" ? "length" : "stop"));
    response.end("data: [DONE]\n\n");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const config: LlmConfig = {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    modelId: "callstack/Apex",
    apiKey: key,
  };
  return {
    config,
    requests,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

test("configuration defaults, setup mode, and invalid configuration", () => {
  assert.deepEqual(readLlmConfig({}), {
    baseUrl: "https://api.callstack.ai/v1",
    modelId: "callstack/Apex",
  });
  assert.equal(readLlmConfig({ LLM_API_KEY: " " }).apiKey, undefined);
  for (const env of [
    { LLM_BASE_URL: "not-a-url" },
    { LLM_BASE_URL: "https://name:secret@example.com/v1" },
    { LLM_BASE_URL: "https://example.com/v1?key=secret" },
    { LLM_BASE_URL: "file:///tmp/provider" },
    { LLM_MODEL: " " },
    { LLM_API_KEY: "secret\nheader" },
  ]) {
    assert.throws(
      () => readLlmConfig(env),
      (error: unknown) => error instanceof Error && !error.message.includes("secret"),
    );
  }
});

test("probe refuses missing credentials before contacting a provider", async () => {
  await assert.rejects(checkProvider(readLlmConfig({})), /Set LLM_API_KEY/);
});

test("probe sends one authenticated request and parses streamed completion", async () => {
  const mock = await mockProvider("success");
  try {
    assert.equal(await checkProvider(mock.config), "hello");
    assert.equal(mock.requests.length, 1);
    const request = mock.requests[0];
    assert.ok(request);
    assert.equal(request.path, "/v1/chat/completions");
    assert.equal(request.authorization, `Bearer ${key}`);
    assert.equal(request.body.model, "callstack/Apex");
    assert.equal(request.body.stream, true);
    assert.equal(request.body.max_tokens, 512);
    for (const field of [
      "store",
      "stream_options",
      "reasoning_effort",
      "max_completion_tokens",
      "tools",
    ]) {
      assert.equal(Object.hasOwn(request.body, field), false, field);
    }
    const { models, model } = createLlm(mock.config);
    await models.completeSimple(model, {
      messages: [{ role: "user", content: "hello", timestamp: Date.now() }],
    });
    assert.equal(mock.requests[1]?.body.max_tokens, 4096);
  } finally {
    await mock.close();
  }
});

for (const [mode, expected] of [
  ["auth", /authentication/],
  ["error", /500:/],
  ["nonstream", /text\/event-stream/],
  ["unfinished", /finish_reason/],
  ["length", /complete text answer/],
  ["empty", /empty text answer/],
] as const) {
  test(`probe rejects ${mode} responses without retries or leaked credentials`, async () => {
    const mock = await mockProvider(mode);
    try {
      await assert.rejects(checkProvider(mock.config), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, expected);
        assert.equal(error.message.includes(key), false);
        return true;
      });
      assert.equal(mock.requests.length, 1);
    } finally {
      await mock.close();
    }
  });
}

test("setup and configured startups make no requests; existing root is reconfigured", async () => {
  const mock = await mockProvider("success");
  const directory = await mkdtemp(join(tmpdir(), "pi-provider-test-"));
  const database = join(directory, "agent.sqlite");
  try {
    const setup = await openAgent(database, { baseUrl: mock.config.baseUrl, modelId: "old-model" });
    const id = setup.conversationId;
    assert.deepEqual(setup.configuration, { state: "not_configured" });
    assert.equal((await setup.harness.inspect(BACKGROUND_CONTEXT)).scheduling, "paused");
    assert.equal(
      (await (await setup.harness.root(BACKGROUND_CONTEXT)).agent(BACKGROUND_CONTEXT)).model,
      undefined,
    );
    await setup.close();

    const configured = await openAgent(database, mock.config);
    const server = createApi(configured);
    try {
      assert.equal(configured.conversationId, id);
      assert.equal((await configured.harness.inspect(BACKGROUND_CONTEXT)).scheduling, "running");
      const root = await configured.harness.root(BACKGROUND_CONTEXT);
      assert.deepEqual((await root.agent(BACKGROUND_CONTEXT)).model, {
        provider: "custom",
        modelId: "callstack/Apex",
      });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const response = await fetch(`http://127.0.0.1:${address.port}/v1/status`);
      const text = await response.text();
      assert.equal(text.includes(key), false);
      assert.deepEqual(decodeStatus(JSON.parse(text)).agent, {
        state: "configured",
        provider: "custom",
        modelId: "callstack/Apex",
      });
      assert.equal(mock.requests.length, 0);
    } finally {
      server.closeAllConnections();
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
      await configured.close();
    }
    const updated = await openAgent(database, { ...mock.config, modelId: "changed-model" });
    assert.equal(updated.conversationId, id);
    assert.deepEqual(
      (await (await updated.harness.root(BACKGROUND_CONTEXT)).agent(BACKGROUND_CONTEXT)).model,
      { provider: "custom", modelId: "changed-model" },
    );
    await updated.close();
    const reopenedSetup = await openAgent(database, {
      baseUrl: mock.config.baseUrl,
      modelId: "changed-model",
    });
    assert.deepEqual(reopenedSetup.configuration, { state: "not_configured" });
    assert.equal((await reopenedSetup.harness.inspect(BACKGROUND_CONTEXT)).scheduling, "paused");
    await reopenedSetup.close();
    assert.equal((await readFile(database)).includes(Buffer.from(key)), false);
    assert.equal(mock.requests.length, 0);
  } finally {
    await mock.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("terminal decoder supports both setup states and rejects invalid configured metadata", () => {
  const status = {
    version: 1,
    conversationId: "1",
    capabilities: { chat: false, backgroundTasks: false },
  };
  assert.deepEqual(decodeStatus({ ...status, agent: { state: "not_configured" } }).agent, {
    state: "not_configured",
  });
  for (const agent of [
    { state: "configured" },
    { state: "configured", provider: "unknown", modelId: "apex" },
    { state: "configured", provider: "custom", modelId: "" },
  ]) {
    assert.throws(() => decodeStatus({ ...status, agent }), /unsupported status/);
  }
});

test("probe deadline aborts a stalled stream body after 30 seconds", {
  timeout: 35_000,
}, async () => {
  const mock = await mockProvider("stall");
  const start = Date.now();
  try {
    await assert.rejects(checkProvider(mock.config), /timed out after 30 seconds/);
    assert.ok(Date.now() - start < 33_000);
    assert.equal(mock.requests.length, 1);
  } finally {
    await mock.close();
  }
});
