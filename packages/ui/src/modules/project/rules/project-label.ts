export const projectLabel = (name: string, waiting: number): string =>
  waiting === 0 ? name : `${name} · ${waiting} waiting for you`
