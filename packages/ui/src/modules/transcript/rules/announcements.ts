import type { TranscriptItem } from "@ivin/contracts/transcript"

const SPOKEN_LENGTH = 150

const forSpeech = (text: string): string => {
  const plain = text
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (plain.length <= SPOKEN_LENGTH) return plain
  const cut = plain.slice(0, SPOKEN_LENGTH)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export const turnEndAnnouncement = (items: ReadonlyArray<TranscriptItem>): string | null => {
  const last = items.findLast(
    (item) =>
      item.type === "message" && item.role === "assistant" && item.parentToolCallId === undefined,
  )
  if (last?.type !== "message") return null
  const text = forSpeech(last.text)
  return text === "" ? null : text
}

export const approvalAnnouncement = (title: string, input: string): string =>
  forSpeech(`${title} needs your approval: ${input.split("\n", 1)[0] ?? ""}`)
