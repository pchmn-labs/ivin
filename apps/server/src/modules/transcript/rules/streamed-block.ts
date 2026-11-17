import type { HarnessDelta, HarnessEvent, TranscriptDelta } from "@ivin/contracts/transcript"
import type { ItemState } from "./derive-items.ts"

export interface StreamedBlock {
  readonly kind: HarnessDelta["kind"]
  readonly itemId: string
  readonly position: number
  // The block's text joins the open assistant message instead of creating an item.
  readonly joinsOpenMessage: boolean
}

export const applyDelta = (
  block: StreamedBlock | null,
  itemState: ItemState,
  sequence: number,
  delta: HarnessDelta,
  newId: () => string,
): {
  readonly block: StreamedBlock
  readonly change: Omit<TranscriptDelta, "type" | "sessionId">
} => {
  const kind = delta.kind === "thinking" ? "thinking" : "message"
  if (block && block.kind === delta.kind) {
    return {
      block,
      change: { itemId: block.itemId, position: block.position, kind, text: delta.text },
    }
  }
  const open = delta.kind === "assistant_text" ? itemState.openMessage : null
  const opened: StreamedBlock = open
    ? { kind: delta.kind, itemId: open.id, position: open.position, joinsOpenMessage: true }
    : { kind: delta.kind, itemId: newId(), position: sequence + 1, joinsOpenMessage: false }
  const text = open ? `\n\n${delta.text}` : delta.text
  return { block: opened, change: { itemId: opened.itemId, position: opened.position, kind, text } }
}

export const finishedEventId = (
  block: StreamedBlock | null,
  type: "assistant_text" | "thinking",
): string | undefined =>
  block && block.kind === type && !block.joinsOpenMessage ? block.itemId : undefined

// Status and usage change no item, so they leave a streamed block waiting for its finished event.
export const blockAfterEvent = (
  block: StreamedBlock | null,
  event: HarnessEvent,
): StreamedBlock | null => {
  if (event.type === "usage") return block
  if (event.type === "status") {
    return event.status === "idle" && block?.joinsOpenMessage ? null : block
  }
  return null
}
