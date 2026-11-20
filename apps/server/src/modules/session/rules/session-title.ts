const MAX_LENGTH = 60
const IMAGE_MARKER = /\[Image #\d+\]/g

export const titleFromMessage = (text: string): string => {
  const words = text.replace(IMAGE_MARKER, " ").replace(/[ \t]+/g, " ")
  const line =
    words
      .split("\n")
      .map((candidate) => candidate.trim())
      .find((candidate) => candidate !== "") ?? ""
  return line.length > MAX_LENGTH ? `${line.slice(0, MAX_LENGTH - 1).trimEnd()}…` : line
}
