import { expect, test } from "vitest"
import { pendingText, withRelaunchMessage, withUnreadMessages } from "./draft.ts"

const draft = (text: string) => ({ text, images: [] })

test("unread messages fill an empty draft, follow typed text, and are added once", () => {
  expect(withUnreadMessages(draft(""), "one")).toEqual(draft("one"))
  expect(withUnreadMessages(draft("typed"), "one")).toEqual(draft("typed\n\none"))
  const once = withUnreadMessages(draft("typed"), "one")
  expect(withUnreadMessages(once, "one")).toBe(once)
})

test("the message of a failed relaunch comes back only into an empty draft", () => {
  expect(withRelaunchMessage(draft(""), { message: "fix it" })).toEqual(draft("fix it"))
  const typed = draft("typed")
  expect(withRelaunchMessage(typed, { message: "fix it" })).toBe(typed)
})

test("a pending message shows its text, or its image markers when it has none", () => {
  expect(pendingText({ id: "m1", text: "hi", images: [] })).toBe("hi")
  expect(
    pendingText({
      id: "m2",
      text: "",
      images: [
        { id: "a", number: 1, mediaType: "image/png" },
        { id: "b", number: 2, mediaType: "image/png" },
      ],
    }),
  ).toBe("[Image #1] [Image #2]")
})
