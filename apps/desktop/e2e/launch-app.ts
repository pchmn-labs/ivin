import {
  _electron as electron,
  type ElectronApplication,
  expect,
  type Page,
} from "@playwright/test"
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

export interface LaunchOptions {
  readonly fakeClaudeBin?: string
  readonly harness?: "scripted" | "scripted-approval"
  // Replaces the app's PATH, to show it needs nothing from it.
  readonly path?: string
  // False shows the window, as a user's launch does.
  readonly background?: boolean
}

export const packagedLaunch = (userDataDir: string, options: LaunchOptions = {}) => {
  if (!existsSync(packagedExecutable)) {
    throw new Error(`Packaged app not found at ${packagedExecutable}: run pnpm package first`)
  }
  const common = {
    ...process.env,
    IVIN_HOME: join(userDataDir, ".ivin"),
    ...(options.background === false ? {} : { IVIN_BACKGROUND: "1" }),
  }
  return {
    executablePath: packagedExecutable,
    args: [`--user-data-dir=${userDataDir}`],
    env: options.fakeClaudeBin
      ? {
          ...common,
          IVIN_HARNESS: "claude",
          // ivin installs its skill there: never in the real ~/.claude.
          CLAUDE_CONFIG_DIR: claudeConfigDir(userDataDir),
          PATH: `${options.fakeClaudeBin}${delimiter}${process.env["PATH"] ?? ""}`,
        }
      : {
          ...common,
          IVIN_HARNESS: options.harness ?? "scripted",
          ...(options.path !== undefined && { PATH: options.path }),
        },
  }
}

export const launchPackagedApp = (
  userDataDir: string,
  options: LaunchOptions = {},
): Promise<ElectronApplication> => electron.launch(packagedLaunch(userDataDir, options))

// The settings page is the one place that names the server's version.
export const openServerVersion = async (window: Page) => {
  const sections = window.getByRole("navigation", { name: "Settings sections" })
  // A key pressed before the window has loaded its keybindings is lost, so press it again.
  await expect(async () => {
    await window.keyboard.press(process.platform === "darwin" ? "Meta+Comma" : "Control+Comma")
    await expect(sections).toBeVisible({ timeout: 1000 })
  }).toPass()
  return window.getByTestId("server-version")
}
