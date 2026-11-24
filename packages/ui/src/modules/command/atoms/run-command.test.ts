import { AtomRegistry } from "effect/reactivity"
import { afterEach, expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { notificationManager } from "../../../core/components/notification/notification-manager.ts"
import { CommandFailure } from "../rules/command-failure.ts"
import { commandsAtom } from "./commands.ts"
import { addCommandHandler, runCommand } from "./run-command.ts"

test("a command runs through its last handler, and does nothing once none is left", () => {
  const registry = AtomRegistry.make()
  const ran: Array<string> = []
  const removeFirst = addCommandHandler(registry, "a.b", () => ran.push("first"), null)
  const removeSecond = addCommandHandler(registry, "a.b", () => ran.push("second"), "p")

  expect(runCommand(registry, "a.b")).toBe(true)
  removeSecond()
  expect(runCommand(registry, "a.b")).toBe(true)
  removeFirst()
  expect(runCommand(registry, "a.b")).toBe(false)
  expect(runCommand(registry, "unknown")).toBe(false)
  expect(ran).toEqual(["second", "first"])
})

afterEach(() => vi.restoreAllMocks())

test("a command that fails with a CommandFailure shows its message, with Retry when it can be retried", async () => {
  const registry = AtomRegistry.make()
  const add = vi.spyOn(notificationManager, "add").mockReturnValue("n")
  const retry = vi.fn()
  addCommandHandler(
    registry,
    "a.b",
    () => Promise.reject(new CommandFailure("The session was not archived.", retry)),
    null,
  )

  runCommand(registry, "a.b")

  await vi.waitFor(() => expect(add).toHaveBeenCalledOnce())
  const shown = add.mock.calls[0]![0]
  expect(shown).toMatchObject({ type: "error", description: "The session was not archived." })
  shown.actionProps?.onClick?.({} as never)
  expect(retry).toHaveBeenCalledOnce()
})

test("a command that fails with an error it does not know shows the command's title", async () => {
  const registry = AtomRegistry.make()
  const add = vi.spyOn(notificationManager, "add").mockReturnValue("n")
  registry.set(commandsAtom, [{ id: "a.b", title: "Archive session", pluginId: null }])
  const unhandled = vi.fn()
  process.on("unhandledRejection", unhandled)
  addCommandHandler(registry, "a.b", () => Promise.reject(new Error("raw")), null)

  runCommand(registry, "a.b")

  await vi.waitFor(() => expect(add).toHaveBeenCalledOnce())
  expect(add.mock.calls[0]![0]).toMatchObject({ description: "Archive session failed." })
  await vi.waitFor(() => expect(unhandled).toHaveBeenCalledOnce())
  process.off("unhandledRejection", unhandled)
})

test("a command that throws still counts as run", async () => {
  const registry = AtomRegistry.make()
  vi.spyOn(notificationManager, "add").mockReturnValue("n")
  const unhandled = vi.fn()
  process.on("unhandledRejection", unhandled)
  addCommandHandler(
    registry,
    "a.b",
    () => {
      throw new Error("raw")
    },
    null,
  )

  expect(runCommand(registry, "a.b")).toBe(true)

  await vi.waitFor(() => expect(unhandled).toHaveBeenCalledOnce())
  process.off("unhandledRejection", unhandled)
})

test("a plugin's command that throws is written to the plugin's log, and the app's reporter hears nothing", async () => {
  const { registry, server } = makeTestRegistry()
  vi.spyOn(notificationManager, "add").mockReturnValue("n")
  const unhandled = vi.fn()
  process.on("unhandledRejection", unhandled)
  addCommandHandler(registry, "notes.add", () => Promise.reject(new Error("raw")), "notes")

  runCommand(registry, "notes.add")

  await vi.waitFor(() =>
    expect(server.pluginFailures).toEqual([
      { id: "notes", reason: "Its command notes.add threw: raw" },
    ]),
  )
  expect(unhandled).not.toHaveBeenCalled()
  process.off("unhandledRejection", unhandled)
})
