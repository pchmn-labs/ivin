export interface FrameBatch<A> {
  readonly push: (value: A) => void
  // Removes pending values that match, so a later flush does not apply them.
  readonly drop: (matches: (value: A) => boolean) => void
}

export const makeFrameBatch = <A>(options: {
  readonly schedule: (run: () => void) => void
  readonly flush: (values: ReadonlyArray<A>) => void
}): FrameBatch<A> => {
  let pending: Array<A> = []
  const run = () => {
    const values = pending
    pending = []
    if (values.length > 0) options.flush(values)
  }
  return {
    push: (value) => {
      if (pending.length === 0) options.schedule(run)
      pending.push(value)
    },
    drop: (matches) => {
      pending = pending.filter((value) => !matches(value))
    },
  }
}
