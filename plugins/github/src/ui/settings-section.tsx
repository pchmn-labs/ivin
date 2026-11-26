import { useEffect, useState } from "react"
import {
  EmptyMessage,
  ErrorMessage,
  Select,
  SettingList,
  SettingRow,
  Text,
  useProjects,
  useRunServerCommand,
  type Project,
} from "@ivin/plugin-api/ui"
import type { GhAccount } from "../rules/auth-status.ts"
import {
  accountOptions,
  readAccounts,
  readLogin,
  type AccountsResult,
} from "../rules/command-results.ts"

function ProjectRow({
  project,
  accounts,
}: {
  project: Project
  accounts: ReadonlyArray<GhAccount>
}) {
  const run = useRunServerCommand()
  const [login, setLogin] = useState<string | null | undefined>(undefined)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    void run("github.projectAccount", { projectPath: project.path }).then((result) => {
      if (!current) return
      if ("failure" in result) setFailure(result.failure)
      else setLogin(readLogin(result.value))
    })
    return () => {
      current = false
    }
  }, [project.path])

  const choose = async (value: string) => {
    const next = value === "" ? null : value
    const result = await run("github.setProjectAccount", { projectPath: project.path, login: next })
    if ("failure" in result) {
      setFailure(result.failure)
      return
    }
    setFailure(null)
    setLogin(readLogin(result.value))
  }

  return (
    <SettingRow
      title={project.name}
      description="The gh account that ivin and this project's agents use."
      control={
        <Select
          label={`gh account for ${project.name}`}
          value={login ?? ""}
          onChange={(value) => void choose(value)}
          options={accountOptions(accounts, login ?? null)}
          disabled={login === undefined && failure === null}
        />
      }
      below={failure === null ? undefined : <ErrorMessage message={failure} />}
    />
  )
}

export function SettingsSection() {
  const { projects } = useProjects()
  const run = useRunServerCommand()
  const [result, setResult] = useState<AccountsResult | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    void run("github.accounts").then((answer) => {
      if (!current) return
      setResult("failure" in answer ? { error: answer.failure } : readAccounts(answer.value))
    })
    return () => {
      current = false
    }
  }, [attempt])

  return (
    <>
      <Text tone="muted">
        Pull requests are read, and agents run gh, with the account gh uses unless a project picks
        another.
      </Text>
      {result !== null && "error" in result ? (
        <ErrorMessage
          message={result.error}
          onRetry={() => {
            setResult(null)
            setAttempt((n) => n + 1)
          }}
        />
      ) : result !== null && result.accounts.length === 0 ? (
        <EmptyMessage>No account is logged in to gh. Run gh auth login in a terminal.</EmptyMessage>
      ) : result !== null ? (
        <SettingList>
          {projects.map((project) => (
            <ProjectRow key={project.path} project={project} accounts={result.accounts} />
          ))}
        </SettingList>
      ) : null}
    </>
  )
}
