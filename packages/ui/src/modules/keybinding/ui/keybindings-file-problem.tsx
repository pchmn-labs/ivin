import { useAtomValue } from "@effect/atom-react"
import { Text } from "../../../core/components/text/text.tsx"
import { keybindingsFileProblemAtom } from "../atoms/keybindings.ts"
import { problemMessage } from "../rules/problem-message.ts"
import "./keybindings-file-problem.css"

export function KeybindingsFileProblem() {
  const problem = useAtomValue(keybindingsFileProblemAtom)
  if (problem === null) return null
  return (
    <div className="iv-keybindings-file-problem">
      <Text role="alert" tone="danger">
        {problemMessage(problem)}
      </Text>
    </div>
  )
}
