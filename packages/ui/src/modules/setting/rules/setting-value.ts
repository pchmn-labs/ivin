// Undefined when no setting or section has that path.
export const settingValue = (settings: object, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        typeof value === "object" && value !== null && Object.hasOwn(value, key)
          ? (value as Record<string, unknown>)[key]
          : undefined,
      settings,
    )
