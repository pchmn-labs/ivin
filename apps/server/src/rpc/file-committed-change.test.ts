import { Effect } from "effect"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { expect, test, vi } from "vitest"
import { git, useClonedProject } from "./git-fixture.ts"
import { callIn, changesIn, write } from "./test-file-repo.ts"
import { withServer } from "./test-server.ts"

vi.setConfig({ testTimeout: 10_000 })

const commit = (repo: string, files: Record<string, string>) => {
  for (const [path, text] of Object.entries(files)) write(join(repo, path), text)
  git(repo, "add", "--all")
  git(repo, "commit", "--quiet", "-m", Object.keys(files).join(" "))
}

const repo = useClonedProject(({ upstream, project }) => {
  commit(upstream, { "shared.ts": "one\ntwo\n", "gone.ts": "g\n", "renamed.ts": "r\n" })
  git(upstream, "push", "--quiet", "origin", "main")
  git(project, "pull", "--quiet")
  git(project, "switch", "--quiet", "-c", "feature")
})

const committedChangesIn = (projectPath: string) =>
  callIn(projectPath, (client, sessionId) => client["file.listCommittedChanges"]({ sessionId }))

const committedDiffIn = (projectPath: string, path: string) =>
  callIn(projectPath, (client, sessionId) => client["file.readCommittedDiff"]({ sessionId, path }))

const discardIn = (projectPath: string, ...paths: string[]) =>
  callIn(projectPath, (client, sessionId) => client["file.discardChanges"]({ sessionId, paths }))

test("lists what the branch's commits changed since its merge base with origin's default branch, and leaves the uncommitted changes out", async () => {
  commit(repo.project, { "feature.ts": "f\n", "shared.ts": "one\n2\n" })
  git(repo.project, "rm", "--quiet", "gone.ts")
  git(repo.project, "commit", "--quiet", "-m", "remove gone.ts")
  write(join(repo.project, "wip.ts"), "w\n")
  write(join(repo.project, "feature.ts"), "f\nmore\n")

  expect(await committedChangesIn(repo.project)).toEqual({
    kind: "listed",
    base: "origin/main",
    changes: [
      { path: "feature.ts", previousPath: null, status: "added", added: 1, deleted: 0 },
      { path: "gone.ts", previousPath: null, status: "deleted", added: 0, deleted: 1 },
      { path: "shared.ts", previousPath: null, status: "modified", added: 1, deleted: 1 },
    ],
  })
  const diff = await committedDiffIn(repo.project, "feature.ts")
  expect(diff).toMatchObject({ kind: "text", status: "added", added: 1, deleted: 0 })
  expect(await committedDiffIn(repo.project, "wip.ts")).toEqual({ kind: "unchanged" })
})

test("leaves out what origin's default branch gained since, a squash merge included", async () => {
  commit(repo.project, { "feature.ts": "f\n" })
  commit(repo.upstream, { "other.ts": "o\n" })
  git(repo.upstream, "switch", "--quiet", "-c", "side")
  commit(repo.upstream, { "side.ts": "s\n" })
  git(repo.upstream, "switch", "--quiet", "main")
  git(repo.upstream, "merge", "--quiet", "--squash", "side")
  git(repo.upstream, "commit", "--quiet", "-m", "squash")
  git(repo.upstream, "push", "--quiet", "origin", "main")
  git(repo.project, "fetch", "--quiet", "origin")

  expect(await committedChangesIn(repo.project)).toEqual({
    kind: "listed",
    base: "origin/main",
    changes: [{ path: "feature.ts", previousPath: null, status: "added", added: 1, deleted: 0 }],
  })
  expect(await committedDiffIn(repo.project, "side.ts")).toEqual({ kind: "unchanged" })
})

test("says when the branch shares no commit with origin's default branch", async () => {
  git(repo.project, "switch", "--quiet", "--orphan", "lone")
  commit(repo.project, { "lone.ts": "l\n" })
  expect(await committedChangesIn(repo.project)).toEqual({ kind: "no_merge_base" })
  expect(await committedDiffIn(repo.project, "lone.ts")).toEqual({ kind: "no_merge_base" })
})

test("says when the repository has no origin, or origin has no default branch", async () => {
  git(repo.project, "remote", "set-head", "origin", "--delete")
  expect(await committedChangesIn(repo.project)).toEqual({ kind: "no_default_branch" })
  expect(await committedDiffIn(repo.project, "shared.ts")).toEqual({ kind: "no_default_branch" })

  git(repo.project, "remote", "remove", "origin")
  expect(await committedChangesIn(repo.project)).toEqual({ kind: "no_origin" })
})

test("discarding fails with git's message when git cannot write the index, and refuses a path outside", async () => {
  write(join(repo.project, "shared.ts"), "changed\n")
  writeFileSync(join(repo.project, ".git/index.lock"), "")

  const failure = await withServer((client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath: repo.project })
      return yield* client["file.discardChanges"]({ sessionId: id, paths: ["shared.ts"] }).pipe(
        Effect.flip,
      )
    }),
  )
  expect(failure._tag).toBe("GitFailed")
  expect(failure._tag === "GitFailed" && failure.gitMessage).toContain("index.lock")
  expect(await discardIn(repo.project, "../outside.ts")).toBe("PathOutsideWorkingFolder")
})

test("discarding several paths restores every tracked file, staged changes and a rename included, deletes every untracked one, and leaves a path it was not given", async () => {
  write(join(repo.project, "shared.ts"), "changed\n")
  git(repo.project, "add", "shared.ts")
  write(join(repo.project, "shared.ts"), "changed again\n")
  rmSync(join(repo.project, "gone.ts"))
  git(repo.project, "mv", "renamed.ts", "moved.ts")
  write(join(repo.project, "notes.md"), "n\n")
  write(join(repo.project, "added.ts"), "a\n")
  git(repo.project, "add", "added.ts")
  write(join(repo.project, "later.md"), "written after the dialog opened\n")

  expect(
    await discardIn(repo.project, "shared.ts", "gone.ts", "moved.ts", "notes.md", "added.ts"),
  ).toBeUndefined()
  expect(readFileSync(join(repo.project, "shared.ts"), "utf8")).toBe("one\ntwo\n")
  expect(readFileSync(join(repo.project, "gone.ts"), "utf8")).toBe("g\n")
  expect(readFileSync(join(repo.project, "renamed.ts"), "utf8")).toBe("r\n")
  expect(existsSync(join(repo.project, "moved.ts"))).toBe(false)
  expect(existsSync(join(repo.project, "notes.md"))).toBe(false)
  expect(existsSync(join(repo.project, "added.ts"))).toBe(false)
  expect(await changesIn(repo.project)).toMatchObject({ changes: [{ path: "later.md" }] })
})

test("a path is a file name, not a pattern: discarding [id].ts leaves i.ts", async () => {
  write(join(repo.project, "[id].ts"), "page\n")
  write(join(repo.project, "i.ts"), "kept\n")
  write(join(repo.project, "s*.ts"), "star\n")
  write(join(repo.project, "shared.ts"), "edited\n")

  expect(await discardIn(repo.project, "[id].ts", "s*.ts")).toBeUndefined()
  expect(existsSync(join(repo.project, "[id].ts"))).toBe(false)
  expect(existsSync(join(repo.project, "i.ts"))).toBe(true)
  expect(readFileSync(join(repo.project, "shared.ts"), "utf8")).toBe("edited\n")
})

test("a branch with no commit yet has no committed changes", async () => {
  git(repo.project, "switch", "--quiet", "--orphan", "fresh")
  expect(await committedChangesIn(repo.project)).toEqual({
    kind: "listed",
    base: "origin/main",
    changes: [],
  })
})

// Lists the committed changes of one session, once before each step and once after the last.
const committedChangesAcross = (projectPath: string, steps: ReadonlyArray<() => void>) =>
  withServer((client) =>
    Effect.gen(function* () {
      const { id } = yield* client["session.create"]({ projectPath })
      const list = client["file.listCommittedChanges"]({ sessionId: id })
      const listings = [yield* list]
      for (const step of steps) {
        step()
        listings.push(yield* list)
      }
      return listings
    }),
  )

const pathsOf = (listing: unknown) =>
  (listing as { changes: ReadonlyArray<{ path: string }> }).changes.map((change) => change.path)

test("a new commit gives a new committed listing in the same server", async () => {
  commit(repo.project, { "first.ts": "1\n" })

  const [before, after] = await committedChangesAcross(repo.project, [
    () => commit(repo.project, { "second.ts": "2\n" }),
  ])

  expect(pathsOf(before)).toEqual(["first.ts"])
  expect(pathsOf(after)).toEqual(["first.ts", "second.ts"])
})

test("a fetch that moves origin's default branch gives a new committed listing", async () => {
  commit(repo.project, { "feature.ts": "f\n" })

  const [before, after] = await committedChangesAcross(repo.project, [
    () => {
      git(repo.project, "push", "--quiet", "origin", "feature:main")
      git(repo.project, "fetch", "--quiet", "origin")
    },
  ])

  expect(pathsOf(before)).toEqual(["feature.ts"])
  expect(pathsOf(after)).toEqual([])
})

test("origin's default branch moved to another branch gives a new committed listing", async () => {
  commit(repo.upstream, { "release.ts": "r\n" })
  git(repo.upstream, "push", "--quiet", "origin", "main:release")
  git(repo.project, "fetch", "--quiet", "origin")
  commit(repo.project, { "feature.ts": "f\n" })

  const [before, after] = await committedChangesAcross(repo.project, [
    () => git(repo.project, "remote", "set-head", "origin", "release"),
  ])

  expect(before).toMatchObject({ kind: "listed", base: "origin/main" })
  expect(after).toMatchObject({ kind: "listed", base: "origin/release" })
})
