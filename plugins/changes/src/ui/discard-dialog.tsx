import { useRef } from "react"
import { Button, Dialog, Text, type Change } from "@ivin/plugin-api/ui"
import { discardAllText, discardText } from "../rules/discard-text.ts"
import type { Discarding } from "../rules/discarding.ts"

export function DiscardDialog({
  discarding,
  onCancel,
  onConfirm,
}: {
  discarding: Discarding | null
  onCancel: () => void
  onConfirm: (discarding: Discarding) => void
}) {
  // The dialog keeps its text while it fades out.
  const shown = useRef(discarding)
  if (discarding !== null) shown.current = discarding
  const last = shown.current
  const text =
    last === null
      ? null
      : last.all
        ? discardAllText(last.changes)
        : discardText(last.changes[0] as Change)
  return (
    <Dialog
      open={discarding !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
      title={text?.title ?? ""}
      description={text?.description ?? ""}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => discarding !== null && onConfirm(discarding)}>
            {text?.action}
          </Button>
        </>
      }
    >
      <Text size="xs" tone="faint" mono preWrap>
        {(last?.changes ?? []).map((change) => change.path).join("\n")}
      </Text>
    </Dialog>
  )
}
