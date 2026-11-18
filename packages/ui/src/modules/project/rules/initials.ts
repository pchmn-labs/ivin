export function initials(name: string): string {
  const words = name.split(/[\s\-_.]+/).filter((word) => word !== "")
  const letters =
    words.length >= 2 ? `${words[0]![0]}${words[1]![0]}` : (words[0]?.slice(0, 2) ?? "")
  return letters === "" ? "?" : letters.toUpperCase()
}
