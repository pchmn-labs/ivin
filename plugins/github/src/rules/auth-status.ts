export interface GhAccount {
  readonly host: string
  readonly login: string
  readonly active: boolean
}

const LOGGED_IN = /Logged in to (\S+) account (\S+)/
const ACTIVE = /Active account:\s*(true|false)/

// `gh auth status` prints to stdout or stderr depending on its version: pass both.
export const parseAuthStatus = (output: string): GhAccount[] => {
  const accounts = new Map<string, GhAccount>()
  let current: string | null = null
  for (const line of output.split("\n")) {
    const logged = LOGGED_IN.exec(line)
    if (logged !== null) {
      const host = logged[1]!
      const login = logged[2]!
      current = `${host}/${login}`
      // The same account can show twice, as an environment token and as a stored login.
      if (!accounts.has(current)) accounts.set(current, { host, login, active: false })
      continue
    }
    const active = ACTIVE.exec(line)
    if (active !== null && current !== null && active[1] === "true") {
      accounts.set(current, { ...accounts.get(current)!, active: true })
    }
    if (/^\S/.test(line) || /Failed to log in/.test(line)) current = null
  }
  return [...accounts.values()]
}

export const isNotLoggedIn = (output: string) => /not logged into any|gh auth login/i.test(output)
