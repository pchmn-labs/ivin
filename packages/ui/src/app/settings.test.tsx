import { RegistryProvider } from "@effect/atom-react"
import { ShellCommandNotOurs, ShellFoldersRefused } from "@ivin/contracts/cli"
import { defaultSettings } from "@ivin/contracts/setting"
import { DateTime } from "effect"
import { afterEach, expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { App } from "./app.tsx"

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const stopAgent = () => page.getByRole("switch", { name: "Stop the agent when its tab closes" })
const removeWorktree = () =>
  page.getByRole("switch", { name: "Remove a merged worktree when its tab closes" })
const sections = () => page.getByRole("navigation", { name: "Settings sections" })

const mountApp = async () => {
  const server = makeFakeServer({
    project: { path: "/dev/ivin", name: "ivin", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  await page.viewport(1280, 800)
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <App />
    </RegistryProvider>,
  )
  await expect.element(page.getByTestId("project-name")).toHaveTextContent("ivin")
  return server
}

const openSettingsFile = vi.fn<() => Promise<string | null>>()
afterEach(() => openSettingsFile.mockReset())
Object.defineProperty(window, "ivin", {
  configurable: true,
  value: { pickFolder: () => Promise.resolve(null), openSettingsFile },
})

test("⌘, opens the page on its first section, and Escape closes it with the focus back where it was", async () => {
  await mountApp()
  const toggle = page.getByRole("button", { name: "Toggle sidebar" })
  ;(toggle.element() as HTMLElement).focus()

  await userEvent.keyboard(`{${mod}>},{/${mod}}`)
  await expect.element(sections().getByRole("button", { name: "Tabs" })).toHaveFocus()
  await expect.element(page.getByRole("heading", { name: "Tabs" })).toBeVisible()
  await expect.element(stopAgent()).toBeChecked()
  await expect.element(page.getByTestId("project-name")).not.toBeVisible()

  await userEvent.keyboard("{Escape}")
  await expect.element(stopAgent()).not.toBeInTheDocument()
  await expect.element(toggle).toHaveFocus()
})

test("the gear in the sidebar's top row opens the page, and the back arrow closes it", async () => {
  await mountApp()
  const gear = page.getByRole("button", { name: "Settings" })
  await gear.click()
  await expect.element(page.getByRole("heading", { name: "Tabs" })).toBeVisible()

  await page.getByRole("button", { name: "Back to sessions" }).click()
  await expect.element(page.getByRole("heading", { name: "Tabs" })).not.toBeInTheDocument()
  await expect.element(gear).toHaveFocus()
})

test("the keyboard alone reaches each section and changes its setting", async () => {
  await mountApp()
  await userEvent.keyboard(`{${mod}>},{/${mod}}`)
  await expect.element(sections().getByRole("button", { name: "Tabs" })).toHaveFocus()

  await userEvent.keyboard("{ArrowDown}")
  await expect.element(sections().getByRole("button", { name: "Worktrees" })).toHaveFocus()
  await expect.element(page.getByRole("heading", { name: "Worktrees" })).toBeVisible()

  ;(removeWorktree().element() as HTMLElement).focus()
  await userEvent.keyboard(" ")
  await expect.element(removeWorktree()).not.toBeChecked()

  await userEvent.keyboard("{Escape}")
  await userEvent.keyboard(`{${mod}>},{/${mod}}`)
  await expect.element(sections().getByRole("button", { name: "Worktrees" })).toHaveFocus()
  await expect.element(removeWorktree()).not.toBeChecked()
})

test("a change made outside the page, by the CLI or in the file, shows on its switch", async () => {
  const server = await mountApp()
  await page.getByRole("button", { name: "Settings" }).click()
  await expect.element(stopAgent()).toBeChecked()

  server.setUserSettings({
    settings: { ...defaultSettings, tabs: { stopAgentOnClose: false } },
    problem: null,
  })
  await expect.element(stopAgent()).not.toBeChecked()
})

test("a broken settings.json shows what is wrong and what to do, with the switches disabled", async () => {
  const server = await mountApp()
  await page.getByRole("button", { name: "Settings" }).click()
  server.setUserSettings({
    settings: defaultSettings,
    problem: { reason: "notJson", setting: null },
  })

  const alert = page.getByRole("alert")
  await expect.element(alert.getByText("~/.ivin/settings.json is not valid JSON.")).toBeVisible()
  await expect
    .element(alert.getByText(/Fix the file and this page updates as soon as it is valid/))
    .toBeVisible()
  await expect.element(stopAgent()).toBeDisabled()
  await expect.element(stopAgent()).toBeChecked()

  openSettingsFile.mockResolvedValue(null)
  await alert.getByRole("button", { name: "Open settings.json" }).click()
  expect(openSettingsFile).toHaveBeenCalledOnce()

  server.setUserSettings({ settings: defaultSettings, problem: null })
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
  await expect.element(stopAgent()).toBeEnabled()
})

test("a failed write shows its message next to the switch, keeps the choice, and Retry saves it", async () => {
  const server = await mountApp()
  await page.getByRole("button", { name: "Settings" }).click()
  server.failNextCall("setting.set")

  await stopAgent().click()
  const alert = page.getByRole("alert")
  await expect.element(alert.getByText("The setting was not saved.")).toBeVisible()
  await expect.element(stopAgent()).not.toBeChecked()

  await alert.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
  await expect.element(stopAgent()).not.toBeChecked()
  expect(server.errorReports.map((report) => report.action)).toContain("setting.set")
})

test("Open settings.json opens the file, and says so when it could not", async () => {
  const server = await mountApp()
  await page.getByRole("button", { name: "Settings" }).click()
  const open = sections().getByRole("button", { name: "Open settings.json" })

  openSettingsFile.mockResolvedValue("could not open settings.json: no application")
  await open.click()
  const alert = page.getByRole("alert")
  await expect.element(alert.getByText("~/.ivin/settings.json did not open.")).toBeVisible()
  expect(server.errorReports.map((report) => report.action)).toContain("settings.openFile")

  openSettingsFile.mockResolvedValue(null)
  await alert.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
  expect(openSettingsFile).toHaveBeenCalledTimes(2)
})

const openCommandLine = async () => {
  await page.getByRole("button", { name: "Settings" }).click()
  await sections().getByRole("button", { name: "Command line" }).click()
  await expect.element(page.getByRole("heading", { name: "Command line" })).toBeVisible()
}

test("Install links ivin into the shell and shows where, then offers to reinstall", async () => {
  await mountApp()
  await openCommandLine()
  await expect
    .element(page.getByText("Not installed. Your agents can run it; your shell cannot."))
    .toBeVisible()

  await page.getByRole("button", { name: "Install" }).click()

  await expect.element(page.getByText("/usr/local/bin/ivin")).toBeVisible()
  await expect.element(page.getByRole("button", { name: "Reinstall" })).toBeVisible()
  await expect.element(page.getByText(/is not on your shell's PATH/)).not.toBeInTheDocument()
})

test("a link in a folder off the shell's PATH says to add the folder", async () => {
  const server = await mountApp()
  server.shell.nextInstall = {
    folder: "/Users/me/.local/bin",
    path: "/Users/me/.local/bin/ivin",
    onPath: false,
  }
  await openCommandLine()

  await page.getByRole("button", { name: "Install" }).click()

  await expect.element(page.getByText("/Users/me/.local/bin/ivin")).toBeVisible()
  await expect
    .element(
      page.getByText(
        "/Users/me/.local/bin is not on your shell's PATH: add it, then open a new terminal.",
      ),
    )
    .toBeVisible()
})

test("with no folder writable, the page names each folder and its reason, and Retry installs", async () => {
  const server = await mountApp()
  const installed = server.shell.nextInstall
  server.shell.nextInstall = new ShellFoldersRefused({
    folders: [
      { path: "/usr/local/bin", reason: "permissionDenied" },
      { path: "/Users/me/.local/bin", reason: "readOnly" },
    ],
  })
  await openCommandLine()

  await page.getByRole("button", { name: "Install" }).click()
  const alert = page.getByRole("alert")
  await expect
    .element(
      alert.getByText(
        "Not installed. /usr/local/bin: ivin is not allowed to write there. /Users/me/.local/bin: its disk is read-only.",
      ),
    )
    .toBeVisible()

  server.shell.nextInstall = installed
  await alert.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
  await expect.element(page.getByText("/usr/local/bin/ivin")).toBeVisible()
})

test("an ivin that is not ivin's link is reported, not replaced", async () => {
  const server = await mountApp()
  server.shell.nextInstall = new ShellCommandNotOurs({ path: "/usr/local/bin/ivin" })
  await openCommandLine()

  await page.getByRole("button", { name: "Install" }).click()

  await expect
    .element(
      page
        .getByRole("alert")
        .getByText(
          "Not installed: /usr/local/bin/ivin already exists and is not ivin's. Remove it, then try again.",
        ),
    )
    .toBeVisible()
  await expect.element(page.getByRole("button", { name: "Install" })).toBeVisible()
})

test("an install already in place shows when the section opens", async () => {
  const server = await mountApp()
  server.shell.installed = { folder: "/usr/local/bin", path: "/usr/local/bin/ivin", onPath: true }
  await openCommandLine()

  await expect.element(page.getByText("/usr/local/bin/ivin")).toBeVisible()
  await expect.element(page.getByRole("button", { name: "Reinstall" })).toBeVisible()
})

test("the cli.installInShell command opens the Command line section and installs", async () => {
  const server = await mountApp()
  server.setUserKeybindings({
    keybindings: [{ key: "mod+shift+i", command: "cli.installInShell", when: null }],
    problem: null,
  })

  await userEvent.keyboard(`{${mod}>}{Shift>}I{/Shift}{/${mod}}`)

  await expect.element(page.getByRole("heading", { name: "Command line" })).toBeVisible()
  await expect.element(page.getByText("/usr/local/bin/ivin")).toBeVisible()
  await expect.element(sections().getByRole("button", { name: "Command line" })).toHaveFocus()
})
