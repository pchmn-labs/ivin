import { Context, Layer, Stream } from "effect"

export class SettingsFile extends Context.Service<
  SettingsFile,
  {
    readonly path: string
    // The file's text when watched, then after each change; null while it does not exist.
    readonly contents: Stream.Stream<string | null>
  }
>()("ivin/server/SettingsFile") {}

// A file that goes through `texts`, then stays as it is.
export const layerSettingsFileOf = (
  texts: ReadonlyArray<string | null>,
  path = "/home/.ivin/settings.json",
) =>
  Layer.succeed(SettingsFile)({
    path,
    contents: Stream.fromIterable(texts).pipe(Stream.concat(Stream.never)),
  })
