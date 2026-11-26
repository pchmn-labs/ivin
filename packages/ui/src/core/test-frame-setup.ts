import { beforeAll } from "vitest"
import { commands } from "vitest/browser"

declare module "vitest/browser" {
  interface BrowserCommands {
    waitForTestFrame: () => Promise<void>
  }
}

beforeAll(() => commands.waitForTestFrame())
