// Unlike `Atom.family`, entries are never collected: a key always gets the same value while its atoms are in use.
export const strongFamily = <K, T>(make: (key: K) => T): ((key: K) => T) => {
  const cache = new Map<K, T>()
  return (key) => {
    let value = cache.get(key)
    if (value === undefined) {
      value = make(key)
      cache.set(key, value)
    }
    return value
  }
}
