export interface ServerContext {
  // Aborted when the plugin is deactivated.
  readonly signal: AbortSignal
}

export type ServerPlugin = (ctx: ServerContext) => void | Promise<void>

export const defineServer = (activate: ServerPlugin): ServerPlugin => activate
