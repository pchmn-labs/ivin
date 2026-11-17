export const MODELS = ["opus", "sonnet", "haiku"] as const
export type Model = (typeof MODELS)[number]
export const DEFAULT_MODEL: Model = "sonnet"
