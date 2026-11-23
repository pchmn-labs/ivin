import { RegistryProvider } from "@effect/atom-react"
import { expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { SessionView } from "./session-view.tsx"

const mount = async (extraBranches = 0) => {
  const server = makeFakeServer()
  server.openProject("/p")
  server.sessions.set("s1", makeTestSession({ id: "s1", title: "t" }))
  server.branches.push(
    { name: "main", remote: false, worktreePath: "/p" },
    { name: "feat/login", remote: false, worktreePath: "/p/.worktrees/feat-login" },
    { name: "fix/typo", remote: false, worktreePath: null },
    { name: "origin/main", remote: true, worktreePath: null },
    { name: "origin/feat/login", remote: true, worktreePath: null },
    { name: "origin/feat/new", remote: true, worktreePath: null },
    ...Array.from({ length: extraBranches }, (_, i) => ({
      name: `chore/branch-${String(i).padStart(2, "0")}`,
      remote: false,
      worktreePath: null,
    })),
  )
  server.worktrees.push({ path: "/p/.worktrees/feat-login", branch: "feat/login" })
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )
  return server
}

const row = (label: string) =>
  page.getByTestId("branch-row").filter({ hasText: new RegExp(`^${label}`) })

test("remote branches are fetched on open, and the list marks the current branch and those held by a worktree", async () => {
  const server = await mount()
  const fetch = server.holdNextFetch()
  await page.getByTestId("branch-picker").click()

  await expect.element(page.getByText("Fetching remote branches…")).toBeVisible()
  fetch.release()
  await expect.element(row("origin/feat/new")).toBeVisible()

  await expect.element(row("main").getByLabelText("Current branch")).toBeInTheDocument()
  await expect.element(row("feat/login").getByText("in worktree")).toBeVisible()
  expect(row("fix/typo").getByText(/^in /).query()).toBeNull()
  for (const remote of ["origin/main", "origin/feat/login", "origin/feat/new"]) {
    await expect.element(row(remote)).toHaveAttribute("data-muted")
    expect(row(remote).getByText("in worktree").query()).toBeNull()
    expect(row(remote).getByLabelText("Current branch").query()).toBeNull()
  }
})

test("40 branches scroll inside the menu, and typing filters them; picking one held by a worktree moves the session there", async () => {
  await mount(40)
  await page.getByTestId("branch-picker").click()
  await expect.element(page.getByRole("combobox", { name: "Switch branch" })).toHaveFocus()
  const viewport = document.querySelector<HTMLElement>(".iv-composer-menu__viewport")!
  await expect.element(row("chore/branch-00")).toBeVisible()
  expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight)
  await userEvent.keyboard("login")
  await expect.element(row("fix/typo")).not.toBeInTheDocument()
  await row("feat/login").click()

  await expect.element(page.getByRole("dialog", { name: "Switch branch" })).not.toBeInTheDocument()
  await expect.element(page.getByTestId("session-location").getByText("Worktree")).toBeVisible()
  await expect.element(page.getByTestId("branch-picker")).toHaveTextContent("feat/login")
})

test("a checkout git refuses shows git's message in the open picker", async () => {
  const server = await mount()
  server.failCheckoutWith("error: Your local changes would be overwritten by checkout")
  await page.getByTestId("branch-picker").click()
  await row("fix/typo").click()

  await expect
    .element(page.getByRole("alert").getByText(/^Git refused to check out fix\/typo\./))
    .toBeVisible()
  await expect
    .element(page.getByTestId("branch-picker-git-message"))
    .toHaveTextContent("error: Your local changes would be overwritten by checkout")
  await expect.element(page.getByTestId("branch-picker")).toHaveTextContent("main")
})

test("keyboard only: open, filter, move, pick and Escape, with focus back on the branch button", async () => {
  await mount(40)
  const trigger = page.getByTestId("branch-picker")
  trigger.element().focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByRole("combobox", { name: "Switch branch" })).toHaveFocus()
  await userEvent.keyboard("{Escape}")
  await expect.element(row("main")).not.toBeInTheDocument()
  await expect.element(trigger).toHaveFocus()

  await userEvent.keyboard("{Enter}")
  await userEvent.keyboard("typo")
  await expect.element(row("fix/typo")).toHaveAttribute("data-highlighted")
  await userEvent.keyboard("{Enter}")
  await expect.element(trigger).toHaveTextContent("fix/typo")
  await expect.element(row("main")).not.toBeInTheDocument()
  await expect.element(trigger).toHaveFocus()
})
