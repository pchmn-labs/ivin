import { execFileSync } from "node:child_process"
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest"

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "ivin",
  GIT_AUTHOR_EMAIL: "ivin@example.com",
  GIT_COMMITTER_NAME: "ivin",
  GIT_COMMITTER_EMAIL: "ivin@example.com",
  GIT_CONFIG_GLOBAL: "/dev/null",
}

export const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, env: gitEnv, encoding: "utf8" }).trim()

export const commit = (repo: string, file: string, text = file) => {
  writeFileSync(join(repo, file), text)
  git(repo, "add", file)
  git(repo, "commit", "--quiet", "-m", file)
}

interface ClonedProject {
  root: string
  origin: string
  upstream: string
  project: string
}

// Call at a test file's top level. `prepare` must add no linked worktree: its paths are not rewritten.
export const useClonedProject = (prepare: (template: ClonedProject) => void = () => {}) => {
  const paths = (root: string): ClonedProject => ({
    root,
    origin: join(root, "origin.git"),
    upstream: join(root, "upstream"),
    project: join(root, "project"),
  })
  const current = paths("")
  let template = ""

  beforeAll(() => {
    template = realpathSync(mkdtempSync(join(tmpdir(), "ivin-git-template-")))
    const { origin, upstream, project } = paths(template)
    git(template, "init", "--quiet", "--bare", "-b", "main", origin)
    git(template, "init", "--quiet", "-b", "main", upstream)
    commit(upstream, "first.txt")
    git(upstream, "remote", "add", "origin", origin)
    git(upstream, "push", "--quiet", "origin", "main")
    git(template, "clone", "--quiet", origin, project)
    prepare(paths(template))
  })
  afterAll(() => rmSync(template, { recursive: true, force: true }))

  beforeEach(() => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "ivin-git-")))
    cpSync(template, root, { recursive: true })
    Object.assign(current, paths(root))
    // The copied remotes still name the template's folder.
    for (const repo of [current.upstream, current.project]) {
      const config = join(repo, ".git", "config")
      writeFileSync(config, readFileSync(config, "utf8").replaceAll(template, root))
    }
  })
  afterEach(() => rmSync(current.root, { recursive: true, force: true }))

  return current
}
