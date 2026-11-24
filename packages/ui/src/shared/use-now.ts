import { useSyncExternalStore } from "react"

const tickMs = 30_000

let now = Date.now()
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<() => void>()

const refresh = () => {
  now = Date.now()
  for (const listener of listeners) listener()
}

const syncTimer = () => {
  const shouldRun = listeners.size > 0 && document.visibilityState !== "hidden"
  if (shouldRun && timer === undefined) {
    refresh()
    timer = setInterval(refresh, tickMs)
  } else if (!shouldRun && timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
}

const subscribe = (listener: () => void) => {
  if (listeners.size === 0) document.addEventListener("visibilitychange", syncTimer)
  listeners.add(listener)
  syncTimer()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) document.removeEventListener("visibilitychange", syncTimer)
    syncTimer()
  }
}

export const useNow = () => useSyncExternalStore(subscribe, () => now)
