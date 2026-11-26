import type { GhAccount } from "./auth-status.ts"

type Value = unknown

const isRecord = (value: Value): value is Record<string, Value> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export type AccountsResult =
  | { readonly accounts: ReadonlyArray<GhAccount> }
  | { readonly error: string }

export const readAccounts = (value: Value): AccountsResult => {
  if (isRecord(value) && typeof value.error === "string") return { error: value.error }
  if (isRecord(value) && Array.isArray(value.accounts)) {
    const accounts = value.accounts.filter(
      (account): account is GhAccount =>
        isRecord(account) &&
        typeof account.host === "string" &&
        typeof account.login === "string" &&
        typeof account.active === "boolean",
    )
    return { accounts }
  }
  return { error: "ivin could not read the accounts gh knows." }
}

export const readLogin = (value: Value): string | null =>
  isRecord(value) && typeof value.login === "string" ? value.login : null

// The empty value is the Select's "gh's active account".
export const accountOptions = (
  accounts: ReadonlyArray<GhAccount>,
  chosen: string | null,
): ReadonlyArray<{ readonly value: string; readonly label: string }> => {
  // Tokens are read for github.com only, so an account on another host could not be used.
  const usable = accounts.filter((account) => account.host === "github.com")
  const known = usable.some((account) => account.login === chosen)
  return [
    { value: "", label: "gh's active account" },
    ...(chosen === null || known ? [] : [{ value: chosen, label: chosen }]),
    ...usable.map((account) => ({ value: account.login, label: account.login })),
  ]
}
