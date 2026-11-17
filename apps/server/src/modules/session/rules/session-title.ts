const MAX_LENGTH = 60

export const titleFromMessage = (text: string): string => {
  const line = text.trim().split("\n")[0]!.trim()
  return line.length > MAX_LENGTH ? `${line.slice(0, MAX_LENGTH - 1).trimEnd()}…` : line
}
