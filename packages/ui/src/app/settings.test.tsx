import { RegistryContext, RegistryProvider } from "@effect/atom-react"
import { builtinPlugins } from "../core/test-builtin-plugins.ts"
import { useContext, useEffect } from "react"
import type { AtomRegistry } from "effect/reactivity"
import { ShellCommandNotOurs, ShellFoldersRefused } from "@ivin/contracts/cli"
import { defaultSettings, type PluginSetting } from "@ivin/contracts/setting"
import { DateTime } from "effect"
import { afterEach, expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { contributionsAtom } from "../modules/plugin/atoms/contributions.ts"
import {
  settingsPageOpenAtom,
  settingsSectionAtom,
} from "../modules/setting/atoms/settings-page.ts"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { App } from "./app.tsx"

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
const stopAgent = () => page.getByRole("switch", { name: "Stop the agent when its tab closes" })
const removeWorktree = () =>
  page.getByRole("switch", { name: "Remove a merged worktree when its tab closes" })
const idleLimit = () => page.getByRole("textbox", { name: "Stop an idle agent after" })
const sections = () => page.getByRole("navigation", { name: "Settings sections" })

let registryOfApp: AtomRegistry.AtomRegistry
function CaptureRegistry() {
  const registry = useContext(RegistryContext)
  useEffect(() => {
    registryOfApp = registry
  }, [registry])
  return null
}

const mountApp = async () => {
  const server = makeFakeServer({
    project: { path: "/dev/ivin", name: "ivin", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  await page.viewport(1280, 800)
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <CaptureRegistry />
      <App plugins={builtinPlugins} />
    </RegistryProvider>,
  )
  await expect.element(page.getByTestId("project-name")).toHaveTextContent("ivin")
  return server
}

const showSection = (key: string) => {
  registryOfApp.set(settingsSectionAtom, key)
  registryOfApp.set(settingsPageOpenAtom, true)
}
const openSection = async (key: string, title: string) => {
  showSection(key)
  await expect.element(page.getByRole("heading", { name: title })).toBeVisible()
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
  await openSection("tabs", "Tabs")
  await expect.element(stopAgent()).toBeChecked()

  server.setUserSettings({
    settings: { ...defaultSettings, tabs: { ...defaultSettings.tabs, stopAgentOnClose: false } },
    problem: null,
  })
  await expect.element(stopAgent()).not.toBeChecked()
})

test("a broken settings.json shows what is wrong and what to do, with the switches disabled", async () => {
  const server = await mountApp()
  await openSection("tabs", "Tabs")
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
  await openSection("tabs", "Tabs")
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
  await openSection("tabs", "Tabs")
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

const openAgents = () => openSection("agents", "Agents")

test("the idle limit shows its value in minutes, Enter saves a new one, and 0 is accepted as the limit that never stops agents", async () => {
  await mountApp()
  await openAgents()
  await expect.element(idleLimit()).toHaveValue("10")
  await expect.element(page.getByText("minutes", { exact: true })).toBeVisible()

  await idleLimit().fill("30")
  await userEvent.keyboard("{Enter}")
  await expect.element(idleLimit()).toHaveValue("30")

  await userEvent.keyboard("{Escape}")
  await userEvent.keyboard(`{${mod}>},{/${mod}}`)
  await expect.element(idleLimit()).toHaveValue("30")

  await idleLimit().fill("0")
  await userEvent.keyboard("{Enter}")
  await expect.element(idleLimit()).toHaveValue("0")
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
})

test("a value that is not a whole number is refused next to the field, keeps what was typed, and nothing is saved", async () => {
  const server = await mountApp()
  await openAgents()

  await idleLimit().fill("1.5")
  await userEvent.keyboard("{Enter}")
  await expect
    .element(page.getByRole("alert").getByText("Enter a whole number of minutes, 0 or more."))
    .toBeVisible()
  await expect.element(idleLimit()).toHaveValue("1.5")
  await expect.element(idleLimit()).toBeInvalid()

  await idleLimit().fill("-3")
  await expect
    .element(page.getByRole("alert").getByText("Enter a whole number of minutes, 0 or more."))
    .toBeVisible()

  await userEvent.keyboard("{Escape}")
  await expect.element(idleLimit()).toHaveValue("10")
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
  expect(server.errorReports).toEqual([])
})

test("a failed write of the idle limit shows its message, keeps the typed value, and Retry saves it", async () => {
  const server = await mountApp()
  await openAgents()
  server.failNextCall("setting.set")

  await idleLimit().fill("45")
  await userEvent.keyboard("{Enter}")
  const alert = page.getByRole("alert")
  await expect.element(alert.getByText("The setting was not saved.")).toBeVisible()
  await expect.element(idleLimit()).toHaveValue("45")

  await alert.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
  await expect.element(idleLimit()).toHaveValue("45")
})

test("the idle limit follows a change made outside the page and is disabled while settings.json is broken", async () => {
  const server = await mountApp()
  await openAgents()

  server.setUserSettings({
    settings: { ...defaultSettings, agents: { stopWhenIdleMinutes: 5 } },
    problem: null,
  })
  await expect.element(idleLimit()).toHaveValue("5")

  server.setUserSettings({
    settings: { ...defaultSettings, agents: { stopWhenIdleMinutes: 5 } },
    problem: { reason: "invalidSetting", setting: "agents.stopWhenIdleMinutes" },
  })
  await expect.element(idleLimit()).toBeDisabled()
  await expect
    .element(
      page
        .getByRole("alert")
        .getByText(
          "agents.stopWhenIdleMinutes in ~/.ivin/settings.json takes a whole number of minutes, 0 or more.",
        ),
    )
    .toBeVisible()
})

const openCommandLine = () => openSection("commandLine", "Command line")

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

test("an ivin that is not ivin's link is reported, not replaced; a link in a folder off the shell's PATH says to add the folder", async () => {
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

  server.shell.nextInstall = {
    folder: "/Users/me/.local/bin",
    path: "/Users/me/.local/bin/ivin",
    onPath: false,
  }
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

const prsSettings: PluginSetting[] = [
  {
    pluginId: "prs",
    pluginName: "Session PRs",
    key: "foldThreshold",
    type: "number",
    default: 2,
    title: "Fold after",
    description: "Pull requests listed before the rest fold.",
    value: 2,
    ignored: false,
  },
  {
    pluginId: "prs",
    pluginName: "Session PRs",
    key: "compact",
    type: "boolean",
    default: false,
    title: "Compact rows",
    description: "Tighter rows.",
    value: true,
    ignored: false,
  },
  {
    pluginId: "prs",
    pluginName: "Session PRs",
    key: "label",
    type: "string",
    default: "PR",
    title: "Label",
    description: "The word before a number.",
    value: "PR",
    ignored: true,
  },
  {
    pluginId: "prs",
    pluginName: "Session PRs",
    key: "layout",
    type: "string",
    default: "rail",
    values: ["rail", "strip"],
    title: "Layout",
    description: "How rows sit.",
    value: "rail",
    ignored: false,
  },
]

test("a plugin's settings show in a section built from its manifest, and a change is written", async () => {
  const server = await mountApp()
  server.setUserSettings({ settings: defaultSettings, problem: null, pluginSettings: prsSettings })
  await openSection("plugin:prs", "Session PRs")

  await expect.element(page.getByRole("heading", { name: "Session PRs" })).toBeVisible()
  await expect.element(page.getByText("Pull requests listed before the rest fold.")).toBeVisible()
  await expect.element(page.getByRole("textbox", { name: "Fold after" })).toHaveValue("2")
  await expect.element(page.getByRole("switch", { name: "Compact rows" })).toBeChecked()
  await expect.element(page.getByText("prs.foldThreshold")).toBeVisible()

  await userEvent.click(page.getByRole("switch", { name: "Compact rows" }))
  await expect.element(page.getByRole("switch", { name: "Compact rows" })).not.toBeChecked()

  const fold = page.getByRole("textbox", { name: "Fold after" })
  await userEvent.clear(fold)
  await userEvent.type(fold, "5{Enter}")
  await expect.element(fold).toHaveValue("5")
  await userEvent.clear(fold)
  await userEvent.type(fold, "many")
  await expect.element(page.getByText("Enter a number.")).toBeVisible()
})

test("a plugin setting whose value in the file is the wrong type says its default is used", async () => {
  const server = await mountApp()
  server.setUserSettings({ settings: defaultSettings, problem: null, pluginSettings: prsSettings })
  await openSection("plugin:prs", "Session PRs")

  await expect
    .element(
      page.getByText(
        "prs.label in ~/.ivin/settings.json takes a string. Its default is used until you fix it.",
      ),
    )
    .toBeVisible()
  await expect.element(page.getByText(/prs.layout in ~\/.ivin/)).not.toBeInTheDocument()
})

test("a plugin's own settings.section replaces the generated one", async () => {
  const server = await mountApp()
  const registry = registryOfApp
  server.setUserSettings({ settings: defaultSettings, problem: null, pluginSettings: prsSettings })
  registry.set(contributionsAtom, [
    ...registry.get(contributionsAtom),
    {
      id: "prs/settings",
      pluginId: "prs",
      slot: "settings.section",
      component: () => <p>Custom PR settings</p>,
      order: 0,
      replaces: undefined,
      tool: undefined,
      title: undefined,
      badge: undefined,
    },
  ])
  showSection("plugin:prs")

  await expect.element(page.getByText("Custom PR settings")).toBeVisible()
  await expect.element(page.getByRole("textbox", { name: "Fold after" })).not.toBeInTheDocument()
})

const DAY = 86_400_000
const daysField = () => page.getByRole("textbox", { name: "Delete images older than" })

const openImages = async () => {
  const server = await mountApp()
  server.seedStoredImages([
    { id: "old", sessionId: "s-old", bytes: 2.5 * 1024 * 1024, sentAt: Date.now() - 40 * DAY },
    {
      id: "new",
      sessionId: "s-new",
      bytes: Math.round(1.2 * 1024 * 1024),
      sentAt: Date.now() - 2 * DAY,
    },
  ])
  await openSection("images", "Images")
  return server
}

test("the Images section shows the space the sent images take; deleting the images older than N days asks first with the space it frees, then shows the new size", async () => {
  await openImages()
  await expect.element(page.getByText("3.7 MB")).toBeVisible()
  await expect.element(page.getByText("2 images")).toBeVisible()
  await expect.element(page.getByText("1 image · 2.5 MB")).toBeVisible()

  await page.getByRole("button", { name: "Delete…", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect
    .element(dialog.getByRole("heading"))
    .toHaveTextContent("Delete 1 image sent more than 30 days ago?")
  await expect.element(dialog.getByText(/This frees 2\.5 MB\./)).toBeVisible()
  await dialog.getByRole("button", { name: "Delete images" }).click()

  await expect.element(page.getByText("1.2 MB")).toBeVisible()
  await expect.element(page.getByText("No image is older than 30 days.")).toBeVisible()
  await expect.element(page.getByRole("button", { name: "Delete…", exact: true })).toBeDisabled()
})

test("a smaller number of days takes more images, Cancel deletes nothing, and a number of days that is not a whole number of 1 or more is refused next to the field", async () => {
  await openImages()

  await daysField().fill("1")
  // The inactive sessions' row below shows the same two images.
  await expect.element(page.getByText("2 images · 3.7 MB").first()).toBeVisible()
  await page.getByRole("button", { name: "Delete…", exact: true }).click()
  await expect
    .element(page.getByRole("dialog").getByRole("heading"))
    .toHaveTextContent("Delete 2 images sent more than 1 day ago?")
  await page.getByRole("button", { name: "Cancel" }).click()

  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
  await expect.element(page.getByText("3.7 MB", { exact: true })).toBeVisible()

  await daysField().fill("0")
  await expect.element(page.getByText("Enter a whole number of days, 1 or more.")).toBeVisible()
  await expect.element(page.getByRole("button", { name: "Delete…", exact: true })).toBeDisabled()
})

test("Delete all asks first with the space it frees, then says no image is stored", async () => {
  await openImages()

  await page.getByRole("button", { name: "Delete all…" }).click()
  const dialog = page.getByRole("dialog")
  await expect.element(dialog.getByRole("heading")).toHaveTextContent("Delete all 2 images?")
  await expect.element(dialog.getByText(/This frees 3\.7 MB\./)).toBeVisible()
  await dialog.getByRole("button", { name: "Delete all images" }).click()

  await expect.element(page.getByText("No image is stored.")).toBeVisible()
  await expect.element(page.getByRole("button", { name: "Delete all…" })).toBeDisabled()
})

test("a delete that fails says so under its row, and Retry deletes", async () => {
  const server = await openImages()
  server.failNextCall("transcript.deleteImages")

  await page.getByRole("button", { name: "Delete all…" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Delete all images" }).click()

  await expect.element(page.getByText("The images could not be deleted. Try again.")).toBeVisible()
  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByText("No image is stored.")).toBeVisible()
})

test("deleting the images of inactive sessions asks first with the space it frees, then shows the new size", async () => {
  await openImages()
  await expect.element(page.getByText("2 images · 3.7 MB")).toBeVisible()

  await page.getByRole("button", { name: "Delete the images of inactive sessions…" }).click()
  const dialog = page.getByRole("dialog")
  await expect
    .element(dialog.getByRole("heading"))
    .toHaveTextContent("Delete 2 images of inactive sessions?")
  await expect.element(dialog.getByText(/This frees 3\.7 MB\./)).toBeVisible()
  await dialog.getByRole("button", { name: "Delete images" }).click()

  await expect.element(page.getByText("No inactive session has an image.")).toBeVisible()
  await expect.element(page.getByText("No image is stored.")).toBeVisible()
})
