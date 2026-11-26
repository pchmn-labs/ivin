import { Stream } from "effect"
import { expect, test } from "vitest"
import { withServer } from "./test-server.ts"

const watchWhileFileIs = (texts: ReadonlyArray<string | null>) =>
  withServer(
    (client) => client["keybinding.watch"]().pipe(Stream.take(texts.length), Stream.runCollect),
    { keybindings: texts },
  )

const toggleOnB = { key: "mod+b", command: "sidebar.toggle", when: null }

test("keybinding.watch sends the user's keybindings, and keeps them while the file is invalid", async () => {
  const states = await watchWhileFileIs([
    null,
    `[{ "key": "mod+b", "command": "sidebar.toggle" }]`,
    "[{",
    "[]",
  ])

  expect(states).toEqual([
    { keybindings: [], problem: null },
    { keybindings: [toggleOnB], problem: null },
    { keybindings: [toggleOnB], problem: { reason: "notJson", entry: null } },
    { keybindings: [], problem: null },
  ])
})
