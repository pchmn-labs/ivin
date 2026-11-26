import type { PrAnnotationData } from "@ivin/plugin-api/server"

const RANK: Record<PrAnnotationData["relation"], number> = {
  branch: 0,
  referenced: 1,
  reviewed: 2,
  created: 3,
}

// The relation that says the most about how the session came to the PR.
export const strongerRelation = (
  a: PrAnnotationData["relation"],
  b: PrAnnotationData["relation"],
): PrAnnotationData["relation"] => (RANK[b] > RANK[a] ? b : a)

const sorted = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(sorted)
    : typeof value === "object" && value !== null
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, sorted(item)]),
        )
      : value

export const sameData = (a: unknown, b: unknown): boolean =>
  JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const readPrData = (data: unknown): PrAnnotationData | null =>
  isRecord(data) && typeof data.url === "string" && typeof data.relation === "string"
    ? (data as unknown as PrAnnotationData)
    : null
