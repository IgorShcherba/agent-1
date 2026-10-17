import { parseArgs } from "node:util";
import { Input, matchesKey, ProcessTerminal, Text, TuiMainScreen } from "@earendil-works/pi-tui";
import { getStatus } from "./client.js";

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: "string" },
      status: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log("Usage: yarn dev:terminal [--url http://127.0.0.1:4310] [--status]");
    console.log("Interactive commands: /status, /help, /quit");
    return;
  }

  const serverUrl = new URL(values.url ?? process.env.AGENT_SERVER_URL ?? "http://127.0.0.1:4310");
  if (serverUrl.protocol !== "http:" && serverUrl.protocol !== "https:") {
    throw new Error("The server URL must use HTTP or HTTPS.");
  }

  if (values.status) {
    console.log(JSON.stringify(await getStatus(serverUrl), null, 2));
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive mode needs a terminal. Use --status for JSON output.");
  }

  const tui = new TuiMainScreen(new ProcessTerminal());
  const status = new Text("Connecting…", 1, 1);
  const help = new Text("/status · /help · /quit", 1, 1);
  const input = new Input({ prompt: "> ", placeholder: "Enter a command" });
  let refreshing = false;

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    status.setText("Connecting…");
    tui.requestRender();
    try {
      const current = await getStatus(serverUrl);
      status.setText(
        `Connected to ${serverUrl.origin}\nConversation: ${current.conversationId}\nChat is not configured yet.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.setText(`Cannot connect to ${serverUrl.origin}\n${message}\nUse /status to retry.`);
    } finally {
      refreshing = false;
      tui.requestRender();
    }
  }

  function quit() {
    tui.stop();
    process.exit(0);
  }

  input.onSubmit = (value) => {
    input.setValue("");
    switch (value.trim()) {
      case "/quit":
      case "/exit":
        quit();
        break;
      case "/status":
        void refresh();
        break;
      case "/help":
        help.setText(
          "/status — reconnect and show status\n/quit — close this client\nChat comes next.",
        );
        break;
      case "":
        break;
      default:
        help.setText("Chat is not configured yet. Use /status, /help, or /quit.");
    }
    tui.requestRender();
  };

  tui.addChild(new Text("Pi Durable Bot", 1, 1));
  tui.addChild(status);
  tui.addChild(help);
  tui.addChild(input);
  tui.setFocus(input);
  tui.addInputListener((data) => {
    if (matchesKey(data, "ctrl+c")) {
      quit();
      return { consume: true };
    }
    return undefined;
  });
  process.once("SIGTERM", quit);
  tui.start();
  await refresh();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
