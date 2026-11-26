import { readFileSync } from "node:fs"
import { expect, test } from "vitest"
import type { Json } from "@ivin/plugin-api/server"
import { makeSession, startPlugin, type Start } from "./test-ctx.ts"

const fixture = (name: string) =>
  readFileSync(new URL(`./rules/fixtures/${name}`, import.meta.url), "utf8")

const PR = "https://github.com/pchmn-labs/ivin/pull/5"
const POLL = `github:pr:${PR}`
const REPO = ["gh repo view", fixture("repo-view.json")] as [string, string]

const listed = (fields: Record<string, unknown> = {}) =>
  JSON.stringify([
    {
      url: PR,
      headRepositoryOwner: { login: "pchmn-labs" },
      state: "OPEN",
      isDraft: false,
      title: "Add the thing",
      updatedAt: "2026-11-01T10:00:00Z",
      ...fields,
    },
  ])

const view = (fields: Record<string, unknown> = {}) =>
  JSON.stringify({
    state: "OPEN",
    isDraft: false,
    title: "Add the thing",
    statusCheckRollup: [{ __typename: "CheckRun", status: "COMPLETED", conclusion: "SUCCESS" }],
    reviewDecision: "",
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    updatedAt: "2026-11-02T10:00:00Z",
    ...fields,
  })

const pending = [{ __typename: "CheckRun", status: "IN_PROGRESS", conclusion: null }]

const created = (output: string, command = 'gh pr create --title "x"') => [
  { type: "tool_call", toolCallId: "t1", name: "Bash", input: { command } },
  { type: "tool_result", toolCallId: "t1", output, isError: false },
]

// A session that already holds the PR as a created one, with the plugin started on it.
const withCreatedPr = async (extra: Start = {}) => {
  const session = makeSession("s1", { branch: "feat/x" })
  const plugin = await startPlugin({
    sessions: [session],
    storage: { "branch:s1": { branch: "feat/x" } },
    annotations: [
      { ns: "github", sessionId: "s1", kind: "pr", data: { url: PR, relation: "created" } },
    ],
    ...extra,
  })
  await plugin.tick("github:sweep")
  return plugin
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

test("a new session's branch PR is attached with its state, and its status poll starts", async () => {
  const plugin = await startPlugin({
    replies: [REPO, ["gh pr list", listed()]],
  })
  const session = plugin.addSession("s1", { branch: "feat/x", workingFolder: "/shop/wt" })
  plugin.sessionCreated(session)
  await expect.poll(() => plugin.prAnnotations("s1").length).toBe(1)
  expect(plugin.prAnnotations("s1")[0]).toEqual({
    url: PR,
    relation: "branch",
    state: "open",
    title: "Add the thing",
    activityAt: "2026-11-01T10:00:00Z",
  })
  expect(plugin.pollKeys()).toContain(POLL)
  const list = plugin.calls.find((c) => c.args.includes("list"))!
  expect(list.args).toContain("feat/x")
  expect(list.options?.cwd).toBe("/shop/wt")
})

test("a PR from a fork with the same branch name does not attach", async () => {
  const plugin = await startPlugin({
    replies: [REPO, ["gh pr list", listed({ headRepositoryOwner: { login: "someone" } })]],
  })
  plugin.sessionCreated(plugin.addSession("s1", { branch: "feat/x" }))
  await expect.poll(() => plugin.storage.get("branch:s1")).toEqual({ branch: "feat/x" })
  expect(plugin.prAnnotations("s1")).toEqual([])
})

test("the default branch and no branch have no PR, and a null branch asks nothing", async () => {
  const plugin = await startPlugin({ replies: [REPO, ["gh pr list", listed()]] })
  plugin.sessionCreated(plugin.addSession("main-session", { branch: "main" }))
  plugin.sessionCreated(plugin.addSession("detached", { branch: null }))
  await expect.poll(() => plugin.storage.get("branch:main-session")).toEqual({ branch: "main" })
  await expect.poll(() => plugin.storage.get("branch:detached")).toEqual({ branch: null })
  expect(plugin.annotations).toEqual([])
  expect(plugin.calls.some((c) => c.args.includes("list"))).toBe(false)
})

test("a branch is looked up again only when it changes, and a restart does not ask again", async () => {
  const plugin = await startPlugin({ replies: [REPO, ["gh pr list", listed()]] })
  const session = plugin.addSession("s1", { branch: "feat/x" })
  plugin.sessionCreated(session)
  await expect.poll(() => plugin.prAnnotations("s1").length).toBe(1)
  const lists = () => plugin.calls.filter((c) => c.args.includes("list")).length
  plugin.updateSession("s1", { title: "renamed" })
  await settle()
  expect(lists()).toBe(1)
  plugin.updateSession("s1", { branch: "feat/y" })
  await expect.poll(lists).toBe(2)

  const restarted = await startPlugin({
    sessions: [makeSession("s1", { branch: "feat/y" })],
    storage: { "branch:s1": { branch: "feat/y" } },
    replies: [REPO, ["gh pr list", listed()]],
  })
  await restarted.tick("github:sweep")
  expect(restarted.calls.some((c) => c.args.includes("list"))).toBe(false)
})

test("a session whose branch changed while ivin was closed is looked up at activation", async () => {
  const plugin = await startPlugin({
    sessions: [makeSession("s1", { branch: "feat/new" })],
    storage: { "branch:s1": { branch: "feat/old" } },
    replies: [REPO, ["gh pr list", listed()]],
  })
  await expect.poll(() => plugin.prAnnotations("s1").length).toBe(1)
})

test("a PR the agent creates with gh is attached as created and polled", async () => {
  const plugin = await startPlugin()
  const session = plugin.addSession("s1")
  for (const event of created(`Creating pull request\n${PR}\n`)) plugin.emit(session, event)
  await expect.poll(() => plugin.prAnnotations("s1").length).toBe(1)
  expect(plugin.prAnnotations("s1")[0]).toMatchObject({ url: PR, relation: "created" })
  expect(plugin.pollKeys()).toContain(POLL)
})

test("a PR the GitHub MCP tool creates is attached too", async () => {
  const plugin = await startPlugin()
  const session = plugin.addSession("s1")
  plugin.emit(session, {
    type: "tool_call",
    toolCallId: "m1",
    name: "mcp__github__create_pull_request",
    input: { title: "x" },
  })
  plugin.emit(session, {
    type: "tool_result",
    toolCallId: "m1",
    output: JSON.stringify({ html_url: PR }),
    isError: false,
  })
  await expect.poll(() => plugin.prAnnotations("s1").length).toBe(1)
})

test("PRs the agent only reads, and a failed creation, are ignored", async () => {
  const plugin = await startPlugin()
  const session = plugin.addSession("s1")
  for (const event of created(`${PR}\n`, "gh pr view 5 --json state")) plugin.emit(session, event)
  plugin.emit(session, {
    type: "tool_call",
    toolCallId: "g",
    name: "mcp__github__get_pull_request",
    input: {},
  })
  plugin.emit(session, { type: "tool_result", toolCallId: "g", output: PR, isError: false })
  plugin.emit(session, {
    type: "tool_call",
    toolCallId: "e",
    name: "Bash",
    input: { command: "gh pr create" },
  })
  plugin.emit(session, {
    type: "tool_result",
    toolCallId: "e",
    output: `${PR}\nfailed`,
    isError: true,
  })
  await settle()
  expect(plugin.annotations).toEqual([])
})

test("the status poll writes the PR's fields and speeds up while checks are pending", async () => {
  const plugin = await withCreatedPr({
    replies: [[`gh pr view ${PR}`, view({ statusCheckRollup: pending })]],
  })
  expect(plugin.pollKeys()).toContain(POLL)
  await plugin.tick(POLL)
  expect(plugin.prAnnotations("s1")[0]).toMatchObject({
    relation: "created",
    state: "open",
    checks: "pending",
    checkCounts: { passed: 0, failed: 0, pending: 1 },
    merge: "ready",
  })
  expect(plugin.pollEvery(POLL)).toBe(45_000)
  plugin.reply(`gh pr view ${PR}`, view())
  await plugin.tick(POLL)
  expect(plugin.prAnnotations("s1")[0]).toMatchObject({ checks: "passing" })
  expect(plugin.pollEvery(POLL)).toBe(180_000)
})

test("a merged PR is written once more, then never fetched again, even after a restart", async () => {
  const plugin = await withCreatedPr({ replies: [[`gh pr view ${PR}`, view({ state: "MERGED" })]] })
  await plugin.tick(POLL)
  expect(plugin.prAnnotations("s1")[0]).toMatchObject({ state: "merged" })
  expect(plugin.pollStopped(POLL)).toBe(true)
  await plugin.tick("github:sweep")
  expect(plugin.pollStopped(POLL)).toBe(true)
  const fetches = plugin.calls.filter((c) => c.args.includes("view")).length

  const restarted = await startPlugin({
    sessions: [makeSession("s1", { branch: "feat/x" })],
    storage: { "branch:s1": { branch: "feat/x" } },
    annotations: [
      {
        ns: "github",
        sessionId: "s1",
        kind: "pr",
        data: { url: PR, relation: "created", state: "merged" },
      },
    ],
  })
  await restarted.tick("github:sweep")
  expect(restarted.pollKeys()).not.toContain(POLL)
  expect(fetches).toBe(1)
})

test("an unknown mergeability keeps the last known value", async () => {
  const plugin = await withCreatedPr({
    replies: [[`gh pr view ${PR}`, view({ mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" })]],
  })
  await plugin.tick(POLL)
  expect(plugin.prAnnotations("s1")[0]).toMatchObject({ merge: "conflict" })
  plugin.reply(`gh pr view ${PR}`, view({ mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" }))
  await plugin.tick(POLL)
  expect(plugin.prAnnotations("s1")[0]).toMatchObject({ merge: "conflict" })
})

test.each([
  [
    "gh is missing",
    new Error("spawn gh ENOENT"),
    "gh is not installed, so the pull request's status cannot be read.",
  ],
  [
    "gh is not logged in",
    { exitCode: 4, stderr: "To get started with GitHub CLI, please run:  gh auth login" },
    "gh is not logged in. Run gh auth login.",
  ],
  [
    "the rate limit is reached",
    { exitCode: 1, stderr: "GraphQL: API rate limit already exceeded" },
    "GitHub's rate limit is reached. The status is read again at the next check.",
  ],
  [
    "GitHub cannot be reached",
    { exitCode: 1, stderr: "error connecting to api.github.com" },
    "GitHub could not be reached. The status is read again at the next check.",
  ],
  ["anything else", { exitCode: 1, stderr: "boom happened" }, "gh failed: boom happened"],
])(
  "when %s, the message is stored beside the last known fields and the next success clears it",
  async (_name, failure, message) => {
    const plugin = await withCreatedPr({
      replies: [[`gh pr view ${PR}`, view({ statusCheckRollup: pending })]],
    })
    await plugin.tick(POLL)
    plugin.reply(`gh pr view ${PR}`, failure)
    await plugin.tick(POLL)
    expect(plugin.prAnnotations("s1")[0]).toMatchObject({ checks: "pending", error: message })
    expect(plugin.pollStopped(POLL)).toBe(false)
    plugin.reply(`gh pr view ${PR}`, view())
    await plugin.tick(POLL)
    expect(plugin.prAnnotations("s1")[0]).not.toHaveProperty("error")
    expect(plugin.prAnnotations("s1")[0]).toMatchObject({ checks: "passing" })
  },
)

test("a PR the user removed from the session is not written back, and its poll stops", async () => {
  const plugin = await withCreatedPr({ replies: [[`gh pr view ${PR}`, view()]] })
  plugin.annotations.length = 0
  await plugin.tick(POLL)
  expect(plugin.annotations).toEqual([])
  expect(plugin.pollStopped(POLL)).toBe(true)
  expect(plugin.calls.some((c) => c.args.includes("view"))).toBe(false)
})

test("a link written by the CLI gets polled, and its status keeps the CLI's relation", async () => {
  const plugin = await startPlugin({
    sessions: [makeSession("s1")],
    storage: { "branch:s1": { branch: null } },
    annotations: [
      { ns: "cli", sessionId: "s1", kind: "pr", data: { url: PR, relation: "reviewed" } },
    ],
    replies: [[`gh pr view ${PR}`, view()]],
  })
  await plugin.tick("github:sweep")
  expect(plugin.pollKeys()).toContain(POLL)
  await plugin.tick(POLL)
  expect(plugin.prAnnotations("s1")[0]).toMatchObject({ relation: "reviewed", state: "open" })
})

test("a PR several sessions hold is polled once and written on each", async () => {
  const plugin = await startPlugin({
    sessions: [makeSession("s1"), makeSession("s2")],
    storage: { "branch:s1": { branch: null }, "branch:s2": { branch: null } },
    annotations: [
      { ns: "cli", sessionId: "s1", kind: "pr", data: { url: PR, relation: "created" } },
      { ns: "cli", sessionId: "s2", kind: "pr", data: { url: PR, relation: "referenced" } },
    ],
    replies: [[`gh pr view ${PR}`, view()]],
  })
  await plugin.tick("github:sweep")
  await plugin.tick("github:sweep")
  expect(plugin.pollKeys().filter((key) => key === POLL)).toHaveLength(1)
  await plugin.tick(POLL)
  expect(plugin.prAnnotations("s1")[0]).toMatchObject({ relation: "created" })
  expect(plugin.prAnnotations("s2")[0]).toMatchObject({ relation: "referenced" })
})

const citationSession = (data: Json, replies: Start["replies"]) =>
  startPlugin({
    sessions: [makeSession("s1")],
    storage: { "branch:s1": { branch: null } },
    annotations: [{ ns: "ivin", sessionId: "s1", kind: "citation", data }],
    replies: [REPO, ...(replies ?? [])],
  })

test("a cited number that is an issue becomes a referenced issue annotation, once", async () => {
  const plugin = await citationSession({ kind: "issue", number: 12 }, [
    [
      "gh api repos/pchmn-labs/ivin/issues/12",
      JSON.stringify({ html_url: "https://github.com/pchmn-labs/ivin/issues/12" }),
    ],
  ])
  await plugin.tick("github:sweep")
  const issues = () => plugin.annotations.filter((a) => a.kind === "issue")
  expect(issues().map((a) => a.data)).toEqual([
    { url: "https://github.com/pchmn-labs/ivin/issues/12", relation: "referenced" },
  ])
  await plugin.tick("github:sweep")
  expect(plugin.calls.filter((c) => c.args[0] === "api")).toHaveLength(1)
})

test("a cited number that is a pull request becomes a referenced PR and is polled", async () => {
  const plugin = await citationSession({ kind: "issue", number: 5 }, [
    [
      "gh api repos/pchmn-labs/ivin/issues/5",
      JSON.stringify({ html_url: PR.replace("pull", "issues"), pull_request: { url: "x" } }),
    ],
  ])
  // gh answers a pull request's issue URL with the pull's own `html_url`.
  plugin.reply(
    "gh api repos/pchmn-labs/ivin/issues/5",
    JSON.stringify({ html_url: PR, pull_request: { url: "x" } }),
  )
  await plugin.tick("github:sweep")
  expect(plugin.prAnnotations("s1")[0]).toMatchObject({ url: PR, relation: "referenced" })
  expect(plugin.pollKeys()).toContain(POLL)
})

test("a citation that fails to resolve is tried again at the next sweep", async () => {
  const plugin = await citationSession({ kind: "pr", number: 5 }, [
    ["gh api", { exitCode: 1, stderr: "error connecting to api.github.com" }],
  ])
  await plugin.tick("github:sweep")
  plugin.reply("gh api", JSON.stringify({ html_url: PR, pull_request: {} }))
  await plugin.tick("github:sweep")
  expect(plugin.prAnnotations("s1")).toHaveLength(1)
})

test("an account chosen for a project gives gh its token and the agent too", async () => {
  const plugin = await startPlugin({
    sessions: [makeSession("s1", { branch: "feat/x" })],
    replies: [
      ["git -C /shop config --local ivin.githubUser", "alice\n"],
      ["gh auth token --hostname github.com --user alice", "tok-alice\n"],
      REPO,
      ["gh pr list", listed()],
    ],
  })
  await plugin.tick("github:sweep")
  const gh = plugin.calls.filter((c) => c.program === "gh" && c.args[0] !== "auth")
  expect(gh.length).toBeGreaterThan(0)
  for (const call of gh) expect(call.options?.env).toEqual({ GH_TOKEN: "tok-alice" })
  expect(await plugin.beforeSpawn("s1")).toEqual({ env: { GH_TOKEN: "tok-alice" } })
})

test("with no account chosen, gh runs as it is and the agent's environment is left alone", async () => {
  const plugin = await startPlugin({
    sessions: [makeSession("s1", { branch: "feat/x" })],
    replies: [
      ["git -C /shop config --local ivin.githubUser", { exitCode: 1 }],
      REPO,
      ["gh pr list", listed()],
    ],
  })
  await plugin.tick("github:sweep")
  for (const call of plugin.calls.filter((c) => c.program === "gh")) {
    expect(call.options?.env).toBeUndefined()
  }
  expect(await plugin.beforeSpawn("s1")).toBeUndefined()
  expect(await plugin.beforeSpawn("unknown")).toBeUndefined()
})

test("setting a project's account writes the repo's local git config and the next call uses it", async () => {
  const plugin = await startPlugin({
    sessions: [makeSession("s1")],
    replies: [
      ["git", { exitCode: 0 }],
      ["gh auth token --hostname github.com --user bob", "tok-bob\n"],
    ],
  })
  await plugin.runCommand("github.setProjectAccount", { projectPath: "/shop", login: "bob" })
  expect(plugin.calls.at(-1)).toMatchObject({
    program: "git",
    args: ["-C", "/shop", "config", "--local", "ivin.githubUser", "bob"],
  })
  expect(await plugin.beforeSpawn("s1")).toEqual({ env: { GH_TOKEN: "tok-bob" } })
  expect(
    await plugin.runCommand("github.setProjectAccount", { projectPath: "/shop", login: null }),
  ).toEqual({ login: null })
  expect(plugin.calls.at(-1)?.args).toEqual([
    "-C",
    "/shop",
    "config",
    "--local",
    "--unset",
    "ivin.githubUser",
  ])
  expect(await plugin.beforeSpawn("s1")).toBeUndefined()
})

test("unsetting an account that was never set is not a failure, a failing git is", async () => {
  const plugin = await startPlugin({ replies: [["git", { exitCode: 5 }]] })
  await expect(
    plugin.runCommand("github.setProjectAccount", { projectPath: "/shop", login: null }),
  ).resolves.toEqual({ login: null })
  plugin.reply("git", { exitCode: 128, stderr: "fatal: not a git repository" })
  await expect(
    plugin.runCommand("github.setProjectAccount", { projectPath: "/shop", login: "bob" }),
  ).rejects.toThrow("not a git repository")
  await expect(
    plugin.runCommand("github.setProjectAccount", { projectPath: "/shop", login: "--evil" }),
  ).rejects.toThrow()
})

test("the project's account is read from its local git config", async () => {
  const plugin = await startPlugin({
    replies: [["git -C /shop config --local ivin.githubUser", "alice\n"]],
  })
  expect(await plugin.runCommand("github.projectAccount", { projectPath: "/shop" })).toEqual({
    login: "alice",
  })
  expect(await plugin.runCommand("github.projectAccount", { projectPath: "/blog" })).toEqual({
    login: null,
  })
})

test("the accounts gh knows are listed, and a gh that cannot run is an error", async () => {
  const plugin = await startPlugin({
    replies: [["gh auth status", fixture("auth-status.stdout.txt")]],
  })
  expect(await plugin.runCommand("github.accounts")).toEqual({
    accounts: [
      { host: "github.com", login: "pchmn", active: true },
      { host: "github.com", login: "paulchemin-silbo", active: false },
    ],
  })
  plugin.reply("gh auth status", {
    exitCode: 1,
    stderr: "You are not logged into any GitHub hosts. To log in, run: gh auth login",
  })
  expect(await plugin.runCommand("github.accounts")).toEqual({ accounts: [] })
  plugin.reply("gh auth status", new Error("spawn gh ENOENT"))
  expect(await plugin.runCommand("github.accounts")).toEqual({
    error: "gh is not installed, so the pull request's status cannot be read.",
  })
})
