import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { useNow } from "./use-now.ts"

const Clock = () => <span data-testid="clock">{useNow()}</span>

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: hidden ? "hidden" : "visible",
  })
  document.dispatchEvent(new Event("visibilitychange"))
}

beforeEach(() => vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] }))
afterEach(() => {
  setHidden(false)
  vi.useRealTimers()
})

test("50 relative times run one timer, and none while the window is hidden", async () => {
  const setIntervalSpy = vi.spyOn(globalThis, "setInterval")
  const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval")
  const screen = await render(
    <>
      {Array.from({ length: 50 }, (_, i) => (
        <Clock key={i} />
      ))}
    </>,
  )
  await expect.element(screen.getByTestId("clock").first()).toBeInTheDocument()
  await vi.waitFor(() => expect(setIntervalSpy).toHaveBeenCalledTimes(1))
  expect(vi.getTimerCount()).toBe(1)

  setHidden(true)
  expect(vi.getTimerCount()).toBe(0)
  expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
})

test("showing the window again updates the time at once and restarts the one timer", async () => {
  const screen = await render(<Clock />)
  await expect.element(screen.getByTestId("clock")).toBeInTheDocument()
  const shown = () => Number(screen.getByTestId("clock").element().textContent)
  const before = shown()
  setHidden(true)
  vi.setSystemTime(before + 10 * 60_000)
  expect(shown()).toBe(before)
  setHidden(false)
  await expect.element(screen.getByTestId("clock")).toHaveTextContent(String(before + 10 * 60_000))
  expect(vi.getTimerCount()).toBe(1)
})
