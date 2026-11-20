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

const mount = async () => {
  const server = makeFakeServer()
  server.sessions.set("s1", makeTestSession({ id: "s1", title: "t" }))
  server.branches.push(
    { name: "main", remote: false, worktreePath: "/p" },
    { name: "feat/login", remote: false, worktreePath: "/p/.worktrees/feat-login" },
    { name: "fix/typo", remote: false, worktreePath: null },
    { name: "origin/main", remote: true, worktreePath: null },
    { name: "origin/feat/login", remote: true, worktreePath: null },
    { name: "origin/feat/new", remote: true, worktreePath: null },
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
  await expect.element(row("feat/login")).toHaveAttribute("data-mark", "worktree")
  await expect.element(row("feat/login").getByText("in worktree")).toBeVisible()
  await expect.element(row("fix/typo")).not.toHaveAttribute("data-mark")
  for (const remote of ["origin/main", "origin/feat/login", "origin/feat/new"]) {
    await expect.element(row(remote)).toHaveAttribute("data-remote")
    await expect.element(row(remote)).not.toHaveAttribute("data-mark")
    expect(row(remote).getByText("in worktree").query()).toBeNull()
    expect(row(remote).getByLabelText("Current branch").query()).toBeNull()
  }
})

test("typing filters the branches, and picking one held by a worktree moves the session there", async () => {
  await mount()
  await page.getByTestId("branch-picker").click()
  await expect.element(page.getByRole("combobox", { name: "Branch" })).toHaveFocus()
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
