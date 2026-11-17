export type ProcessExit =
  | { readonly error: { readonly message: string; readonly code?: string } }
  | { readonly code: number | null; readonly signal: string | null }

export const describeExit = (
  exit: ProcessExit,
  stderr: string,
  options: { readonly stoppedByIvin?: boolean } = {},
): string => {
  if ("error" in exit) {
    return exit.error.code === "ENOENT"
      ? "Claude Code is not installed, or it is not on the PATH."
      : `Could not start Claude Code: ${exit.error.message}`
  }
  if (options.stoppedByIvin) return "Claude Code was stopped."
  const what = `Claude Code stopped unexpectedly (${exit.signal ?? `exit code ${exit.code}`}).`
  return stderr === "" ? what : `${what} ${stderr}`
}
