import { useAtomValue } from "@effect/atom-react"
import { Text } from "../../../core/components/text/text.tsx"
import { keybindingsFileProblemAtom, unreadableKeysAtom } from "../atoms/keybindings.ts"
import { problemMessage, unreadableKeysMessage } from "../rules/problem-message.ts"
import "./keybindings-file-problem.css"

export function KeybindingsFileProblem() {
  const problem = useAtomValue(keybindingsFileProblemAtom)
  const unreadable = useAtomValue(unreadableKeysAtom)
  const message =
    problem !== null
      ? problemMessage(problem)
      : unreadable.length > 0
        ? unreadableKeysMessage(unreadable)
        : null
  if (message === null) return null
  return (
    <div className="iv-keybindings-file-problem">
      <Text role="alert" tone="danger">
        {message}
      </Text>
    </div>
  )
}
