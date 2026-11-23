import { Cause, Effect, Exit, Schema } from "effect"
import { logError } from "../../modules/log/usecases/log-error.ts"

type Report = (what: string, key: string, error: unknown) => void

// A row that no longer matches its schema is reported once per store, not on every read.
export const makeRowDecoding = () => {
  const reported = new Set<string>()
  return <A>(read: (report: Report) => A): Effect.Effect<A> =>
    Effect.suspend(() => {
      const problems: { what: string; key: string; error: unknown }[] = []
      const result = read((what, key, error) => problems.push({ what, key, error }))
      const fresh = problems.filter(({ what, key }) => {
        const id = `${what}:${key}`
        if (reported.has(id)) return false
        reported.add(id)
        return true
      })
      return Effect.forEach(fresh, ({ what, key, error }) =>
        logError(`decode ${what}`, new Error(`${what} ${key} does not match its schema: ${error}`)),
      ).pipe(Effect.as(result))
    })
}

export const rowDecoder = <S extends Schema.Constraint & Schema.ConstraintDecoder<unknown>>(
  schema: S,
  what: string,
) => {
  const decode = Schema.decodeUnknownExit(schema)
  return (input: unknown, key: string, report: Report): S["Type"] | undefined => {
    const exit = decode(input)
    if (Exit.isSuccess(exit)) return exit.value
    report(what, key, Cause.squash(exit.cause))
    return undefined
  }
}
