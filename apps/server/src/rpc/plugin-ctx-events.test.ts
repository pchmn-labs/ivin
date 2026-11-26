import { Effect } from "effect"
import { expect, test, vi } from "vitest"
import { withPluginServer } from "./plugin-ctx-server.ts"
import { packageJson, tempDir, writePlugin } from "./plugin-test-server.ts"
import { until } from "./test-waits.ts"

vi.setConfig({ testTimeout: 60_000 })

test("a server half hears of a session's creation and of each event of its transcript, including those with a field left undefined", async () => {
  const home = tempDir("home")
  writePlugin(home, "listener", {
    "package.json": packageJson({ id: "listener", server: "src/server.ts" }),
    "src/server.ts": `export const activate = (ctx) => {
  const seen = []
  ctx.sessions.onCreated(() => seen.push("created"))
  ctx.transcript.onEvent((_session, event) => seen.push(event.type))
  ctx.commands.register("listener.seen", () => seen)
}`,
  })
  const seen = await withPluginServer(
    home,
    (client) =>
      Effect.gen(function* () {
        yield* until(client["plugin.status"](), (s) => s.some((p) => p.server === "active"))
        const session = yield* client["session.create"]({ projectPath: "/p" })
        yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "hi" })
        return yield* until(
          client["plugin.run"]({ command: "listener.seen", args: null }).pipe(
            Effect.orElseSucceed(() => [] as unknown),
          ),
          (value) => Array.isArray(value) && value.includes("tool_result"),
        )
      }),
    {
      turns: [
        [
          {
            type: "tool_call",
            toolCallId: "t1",
            name: "Bash",
            input: { command: "ls" },
            raw: null,
          },
          { type: "tool_result", toolCallId: "t1", output: "a", isError: false, raw: null },
        ],
      ],
    },
  )
  expect(seen).toContain("created")
  expect(seen).toContain("tool_call")
})
