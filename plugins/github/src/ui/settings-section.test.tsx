import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { UiHostProvider, type Json, type UiHost } from "@ivin/plugin-api/ui"
import { testUiHost } from "../../../../packages/ui/src/app/test-ui-host.ts"
import { activatePlugin } from "../../../../packages/ui/src/app/test-plugin-mount.ts"
import { testDateTime } from "../../../../packages/ui/src/core/test-session.ts"
import { activate } from "../ui.tsx"

const projects = [
  { path: "/shop", name: "shop", lastOpenedAt: testDateTime(0), folders: [], workspace: false },
  { path: "/blog", name: "blog", lastOpenedAt: testDateTime(0), folders: [], workspace: false },
]

const accounts = [
  { host: "github.com", login: "ada", active: true },
  { host: "github.com", login: "ada-work", active: false },
]

const mount = async (
  answers: Record<string, (args: Json) => { value: Json } | { failure: string }>,
) => {
  const calls: Array<{ command: string; args: Json | undefined }> = []
  const Section = activatePlugin(activate, "github")("settings.section")
  const host: UiHost = {
    ...testUiHost,
    useProjects: () => ({ projects, selectedPath: "/shop" }),
    useRunServerCommand: () => async (command, args) => {
      calls.push({ command, args })
      return answers[command]!(args ?? null)
    },
  }
  await render(
    <UiHostProvider host={host}>
      <Section />
    </UiHostProvider>,
  )
  return calls
}

test("choosing an account for a project saves it, and a failure shows under the row", async () => {
  let failing = false
  const calls = await mount({
    "github.accounts": () => ({ value: { accounts } }),
    "github.projectAccount": (args) => ({
      value: { login: (args as { projectPath: string }).projectPath === "/blog" ? "ada" : null },
    }),
    "github.setProjectAccount": (args) =>
      failing ? { failure: "git could not save the account." } : { value: args },
  })

  await expect.element(page.getByLabelText("gh account for blog")).toHaveValue("ada")
  await page.getByLabelText("gh account for shop").selectOptions("ada-work")
  expect(calls.at(-1)).toEqual({
    command: "github.setProjectAccount",
    args: { projectPath: "/shop", login: "ada-work" },
  })

  failing = true
  await page.getByLabelText("gh account for shop").selectOptions("")
  await expect.element(page.getByText("git could not save the account.")).toBeVisible()
})

test("with no account in gh, one message says to log in, and a gh error is shown", async () => {
  await mount({ "github.accounts": () => ({ value: { accounts: [] } }) })
  await expect.element(page.getByText(/Run gh auth login/)).toBeVisible()
  expect(page.getByLabelText("gh account for shop").query()).toBeNull()
})
