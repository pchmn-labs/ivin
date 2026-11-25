import type { ServerContext } from "@ivin/plugin-api/server"

export const makePluginContext = () => {
  const controller = new AbortController()
  const disposers: Array<() => void> = []
  const ctx: ServerContext = { signal: controller.signal }
  return {
    ctx,
    register: (disposer: () => void) => {
      disposers.push(disposer)
    },
    // The caller logs what the disposers threw against the plugin.
    dispose: (): unknown[] => {
      controller.abort()
      const failures: unknown[] = []
      for (const disposer of disposers.splice(0).reverse()) {
        try {
          disposer()
        } catch (error) {
          failures.push(error)
        }
      }
      return failures
    },
  }
}
