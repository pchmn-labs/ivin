/// <reference types="@vitest/browser-playwright" />
import { afterEach, expect, test } from "vitest"
import { cdp } from "vitest/browser"
import { render } from "vitest-browser-react"
import { SessionMark } from "../../modules/session/ui/session-mark.tsx"
import { Icon } from "../components/icon/icon.tsx"

const reduceMotion = (on: boolean) =>
  cdp().send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: on ? "reduce" : "no-preference" }],
  })

afterEach(() => reduceMotion(false))

const animation = (element: Element) => {
  const style = getComputedStyle(element)
  return { iterations: style.animationIterationCount, duration: style.animationDuration }
}

test("under reduced motion, the spinning icon and the Working ring keep turning, and other animations stop", async () => {
  await reduceMotion(true)
  expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true)
  await render(
    <>
      <Icon name="loader" />
      <SessionMark status="working" harness="claude" />
      <SessionMark status="in_background" harness="claude" />
    </>,
  )
  const turning = {
    iterations: "infinite",
    duration: expect.not.stringMatching(/^0\.01ms|^1e-05s/),
  }
  expect(animation(document.querySelector(".iv-icon--spin")!)).toEqual(turning)
  expect(
    animation(document.querySelector('[data-status="working"] .iv-session-mark__overlay')!),
  ).toEqual(turning)
  expect(
    animation(document.querySelector('[data-status="in_background"] .iv-session-mark__overlay')!)
      .iterations,
  ).toBe("1")
})
