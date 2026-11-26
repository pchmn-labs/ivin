import { RegistryProvider } from "@effect/atom-react"
import type { AgentCommand } from "@ivin/contracts/session"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../core/test-builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { SidebarTabs } from "../../../app/sidebar-tabs.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { SessionView } from "./session-view.tsx"

const skill = (
  name: string,
  source: AgentCommand["source"],
  argumentHint: string | null = null,
): AgentCommand => ({ name, description: `Runs ${name}.`, argumentHint, kind: "skill", source })
const command = (name: string): AgentCommand => ({
  name,
  description: `Claude's ${name}.`,
  argumentHint: null,
  kind: "command",
  source: null,
})

const COMMANDS = [
  skill("review-animations", "user"),
  skill("implement", "project", "<issue>"),
  command("review"),
  command("compact"),
]

const field = () => page.getByRole("textbox", { name: "Message" })
const fieldText = () => (field().element() as HTMLElement).innerText
const sheet = () => page.getByTestId("completion-sheet")
const options = () => page.getByRole("option")
const optionNames = () =>
  options()
    .elements()
    .map((option) => option.querySelector(".iv-completion-sheet__label")?.textContent?.slice(1))

const mount = async (
  commands: ReadonlyArray<AgentCommand> | null = COMMANDS,
  beforeRender: (server: ReturnType<typeof makeFakeServer>) => void = () => {},
) => {
  const server = makeFakeServer()
  server.agentCommands = commands
  beforeRender(server)
  server.openProject("/work/ivin")
  server.sessions.set(
    "s1",
    makeTestSession({
      id: "s1",
      title: "Fix the list",
      projectPath: "/work/ivin",
      workingFolder: "/work/ivin",
    }),
  )
  server.openTab("s1")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SidebarTabs />
        <SessionView projectPath="/work/ivin" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )
  await field().click()
  return server
}

test("a / that starts the draft lists the project's skills first, with their tag and description, then the user's and Claude's commands", async () => {
  await mount()
  await userEvent.keyboard("/")

  await expect.element(sheet().getByText("Skills and commands")).toBeVisible()
  await expect.poll(optionNames).toEqual(["implement", "review-animations", "review", "compact"])
  const implement = options().first()
  await expect.element(implement.getByText("Ivin skill")).toBeVisible()
  await expect.element(implement.getByText("<issue>")).toBeVisible()
  await expect.element(implement.getByText("Runs implement.")).toBeVisible()
  await expect.element(options().nth(1).getByText("User skill")).toBeVisible()
  await expect.element(options().nth(2).getByText("Command")).toBeVisible()
})

test("letters narrow the list; Enter puts the pick in the draft without sending, and a second Enter sends it", async () => {
  const server = await mount()
  await userEvent.keyboard("/rev")
  await expect.poll(optionNames).toEqual(["review", "review-animations"])

  await userEvent.keyboard("{Enter}")
  await expect.element(sheet()).not.toBeInTheDocument()
  await expect.poll(fieldText).toBe("/review ")
  expect(server.sentMessages).toEqual([])

  await userEvent.keyboard("{Enter}")
  await vi.waitFor(() => expect(server.sentMessages.map((m) => m.text)).toEqual(["/review "]))
})

test("the keyboard moves through the list, Tab picks, and Escape closes it, with the focus in the field all along", async () => {
  await mount()
  await userEvent.keyboard("/")
  await expect.element(options().first()).toHaveAttribute("aria-selected", "true")
  await userEvent.keyboard("{ArrowDown}{ArrowDown}")
  await expect.element(options().nth(2)).toHaveAttribute("aria-selected", "true")
  await expect.element(field()).toHaveFocus()

  await userEvent.keyboard("{Tab}")
  await expect.poll(fieldText).toBe("/review ")
  await expect.element(field()).toHaveFocus()

  await userEvent.keyboard("{Backspace}{Backspace}")
  await expect.element(sheet()).toBeVisible()
  await userEvent.keyboard("{Escape}")
  await expect.element(sheet()).not.toBeInTheDocument()
  await expect.poll(fieldText).toBe("/revie")
  await expect.element(field()).toHaveFocus()
})

test("a click on a row picks it and leaves the focus in the field", async () => {
  await mount()
  await userEvent.keyboard("/")
  await options().nth(3).click()
  await expect.poll(fieldText).toBe("/compact ")
  await expect.element(field()).toHaveFocus()
})

test("a / in the middle of a sentence or in a path opens nothing", async () => {
  await mount()
  await userEvent.keyboard("see src/a and /rev")
  await expect.element(field()).toHaveTextContent("see src/a and /rev")
  await expect.element(sheet()).not.toBeInTheDocument()
})

test("while the list loads the sheet says so, then shows it", async () => {
  let call: { release: () => void } | undefined
  await mount(COMMANDS, (server) => {
    call = server.holdNextCall("session.listAgentCommands")
  })
  await userEvent.keyboard("/")
  await expect.element(sheet().getByText("Loading skills and commands…")).toBeVisible()

  call?.release()
  await expect.poll(optionNames).toEqual(["implement", "review-animations", "review", "compact"])
})

test("no match says so, and Enter sends the message as typed", async () => {
  const server = await mount()
  await userEvent.keyboard("/zzz")
  await expect
    .element(
      sheet().getByText("No skill or command matches “/zzz”. Enter sends the message as typed."),
    )
    .toBeVisible()

  await userEvent.keyboard("{Enter}")
  await vi.waitFor(() => expect(server.sentMessages.map((m) => m.text)).toEqual(["/zzz"]))
})

test("a list that fails to load says so with Retry, and the field still sends", async () => {
  const server = await mount()
  server.failCalls("session.listAgentCommands")
  await userEvent.keyboard("/")
  const alert = sheet().getByRole("alert")
  await expect
    .element(
      alert.getByText(
        "Could not load Claude's skills and commands. The message still sends as typed.",
      ),
    )
    .toBeVisible()

  server.recoverCalls("session.listAgentCommands")
  await alert.getByRole("button", { name: "Retry" }).click()
  await expect.poll(optionNames).toEqual(["implement", "review-animations", "review", "compact"])
  await expect.element(field()).toHaveFocus()

  server.failCalls("session.listAgentCommands")
  await userEvent.keyboard("{Escape}{Enter}")
  await vi.waitFor(() => expect(server.sentMessages.map((m) => m.text)).toEqual(["/"]))
})

test("the list is asked for again each time the sheet opens, keeping the last one shown meanwhile", async () => {
  const server = await mount()
  await userEvent.keyboard("/")
  await expect.poll(optionNames).toHaveLength(4)
  await userEvent.keyboard("{Backspace}")
  await expect.element(sheet()).not.toBeInTheDocument()

  server.agentCommands = [...COMMANDS, skill("added", "project")]
  const call = server.holdNextCall("session.listAgentCommands")
  await userEvent.keyboard("/")
  await expect.poll(optionNames).toHaveLength(4)
  call.release()
  await expect.poll(optionNames).toContain("added")
})

test("a harness without commands never opens the sheet", async () => {
  await mount(null)
  await userEvent.keyboard("/")
  await expect.element(field()).toHaveTextContent("/")
  await expect.element(sheet()).not.toBeInTheDocument()
})
