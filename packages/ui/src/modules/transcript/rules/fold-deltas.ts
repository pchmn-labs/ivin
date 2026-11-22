import type { TranscriptItem, TranscriptDelta } from "@ivin/contracts/transcript"

export const foldDeltas = (
  held: (id: string) => TranscriptItem | undefined,
  deltas: ReadonlyArray<TranscriptDelta>,
  now: number,
): ReadonlyArray<TranscriptItem> => {
  const folded = new Map<string, TranscriptItem>()
  for (const delta of deltas) {
    const current = folded.get(delta.itemId) ?? held(delta.itemId)
    if (current === undefined) {
      const base = {
        id: delta.itemId,
        sessionId: delta.sessionId,
        position: delta.position,
        at: now,
      }
      folded.set(
        delta.itemId,
        delta.kind === "message"
          ? { ...base, type: "message", role: "assistant", text: delta.text, images: [], steer: false }
          : { ...base, type: "thinking", text: delta.text },
      )
    } else if (current.type === "message" || current.type === "thinking") {
      folded.set(delta.itemId, { ...current, text: current.text + delta.text })
    }
  }
  return [...folded.values()]
}
