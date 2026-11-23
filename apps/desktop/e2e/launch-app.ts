import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test"
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const releaseDir = join(dirname(fileURLToPath(import.meta.url)), "../release")

export const packagedExecutable =
  process.platform === "darwin"
    ? join(releaseDir, "mac-arm64/ivin.app/Contents/MacOS/ivin")
    : join(releaseDir, "linux-unpacked/ivin")

export const makeTempDir = (prefix: string): string =>
  mkdtempSync(join(tmpdir(), `ivin-${prefix}-`))

export const fakeClaudeCommand = "fake-claude-bin"

// A directory holding an executable named `claude`, to put first on PATH.
export const makeFakeClaudeBin = (): string => {
  const dir = join(makeTempDir("claude"), fakeClaudeCommand)
  mkdirSync(dir)
  const executable = join(dir, "claude")
  copyFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "fixtures/fake-claude.cjs"),
    executable,
  )
  chmodSync(executable, 0o755)
  return dir
}

export const claudeConfigDir = (userDataDir: string) => join(userDataDir, "claude")

export const launchPackagedApp = (
  userDataDir: string,
  options: {
    readonly fakeClaudeBin?: string
    readonly harness?: "scripted" | "scripted-approval"
    // Replaces the app's PATH, to show it needs nothing from it.
    readonly path?: string
  } = {},
): Promise<ElectronApplication> => {
  if (!existsSync(packagedExecutable)) {
    throw new Error(`Packaged app not found at ${packagedExecutable}: run pnpm package first`)
  }
  return electron.launch({
    executablePath: packagedExecutable,
    args: [`--user-data-dir=${userDataDir}`],
    env: options.fakeClaudeBin
      ? {
          ...process.env,
          IVIN_HOME: join(userDataDir, ".ivin"),
          IVIN_BACKGROUND: "1",
          IVIN_HARNESS: "claude",
          // ivin installs its skill there: never in the real ~/.claude.
          CLAUDE_CONFIG_DIR: claudeConfigDir(userDataDir),
          PATH: `${options.fakeClaudeBin}${delimiter}${process.env["PATH"] ?? ""}`,
        }
      : {
          ...process.env,
          IVIN_HOME: join(userDataDir, ".ivin"),
          IVIN_BACKGROUND: "1",
          IVIN_HARNESS: options.harness ?? "scripted",
          ...(options.path !== undefined && { PATH: options.path }),
        },
  })
}

// The settings page is the one place that names the server's version.
export const openServerVersion = async (window: Page) => {
  await window.keyboard.press(process.platform === "darwin" ? "Meta+Comma" : "Control+Comma")
  return window.getByTestId("server-version")
}
