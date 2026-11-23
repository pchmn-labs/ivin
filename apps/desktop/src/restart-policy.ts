export type RestartDecision = "restart" | "give-up"

export const createRestartPolicy = (limit = 3, windowMs = 60_000) => {
  const restarts: number[] = []
  return (now: number, answered: boolean): RestartDecision => {
    if (!answered) return "give-up"
    while (restarts[0] !== undefined && now - restarts[0] >= windowMs) restarts.shift()
    if (restarts.length >= limit) return "give-up"
    restarts.push(now)
    return "restart"
  }
}
