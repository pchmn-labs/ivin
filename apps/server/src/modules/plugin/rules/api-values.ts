// The plugin API's dates are `{ epochMilliseconds }`, and its values cross a process boundary as JSON.
export const apiValues = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(apiValues)
  if (typeof value === "object" && value !== null) {
    // A DateTime keeps its time out of its own enumerable fields.
    if ("epochMilliseconds" in value && typeof value.epochMilliseconds === "number") {
      return { epochMilliseconds: value.epochMilliseconds }
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, apiValues(entry)]))
  }
  return value
}
