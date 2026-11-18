import { expect, test } from "vitest"
import { problemMessage, unreadableKeysMessage } from "./problem-message.ts"

test("the message names what is wrong in the file and says the previous keybindings stay", () => {
  expect(problemMessage({ reason: "notJson", entry: null })).toBe(
    "~/.ivin/keybindings.json is not valid JSON. The previous keybindings stay in use until it is fixed.",
  )
  expect(problemMessage({ reason: "invalidEntry", entry: 2 })).toMatch(
    /^Keybinding 2 in ~\/\.ivin\/keybindings\.json needs a "key" and a "command"\./,
  )
})

test("the keys that cannot be read are named", () => {
  expect(unreadableKeysMessage(["hyper+b", "mod+k mod+s"])).toBe(
    '~/.ivin/keybindings.json has keys ivin cannot read, which do nothing: "hyper+b", "mod+k mod+s".',
  )
})
