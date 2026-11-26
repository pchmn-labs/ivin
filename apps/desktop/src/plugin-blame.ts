export interface PluginActivity {
  readonly at: number
  readonly id: string
  readonly phase: "activating" | "activated"
}

export const RECENT_ACTIVITY_MS = 10_000

export const pluginsToBlame = (events: readonly PluginActivity[], frozenAt: number): string[] => {
  const last = new Map<string, PluginActivity>()
  for (const event of events) last.set(event.id, event)
  const stuck = [...last.values()].filter((event) => event.phase === "activating")
  if (stuck.length > 0) return stuck.map((event) => event.id)
  const recent = events.filter(
    (event) => event.at <= frozenAt && frozenAt - event.at <= RECENT_ACTIVITY_MS,
  )
  return [...new Set(recent.map((event) => event.id))]
}

export const mergeDisabledPlugins = (
  fileText: string | null,
  blamed: readonly string[],
): string[] => {
  let held: string[] = []
  try {
    const value: unknown = fileText === null ? [] : JSON.parse(fileText)
    if (Array.isArray(value)) held = value.filter((id): id is string => typeof id === "string")
  } catch {
    // A malformed file is rewritten from the blamed ids alone.
  }
  return [...new Set([...held, ...blamed])]
}
