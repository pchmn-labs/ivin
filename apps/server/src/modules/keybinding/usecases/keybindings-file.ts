import { Context, Layer, Stream } from "effect"

export class KeybindingsFile extends Context.Service<
  KeybindingsFile,
  {
    // The file's text when watched, then after each change; null while it does not exist.
    readonly contents: Stream.Stream<string | null>
  }
>()("ivin/server/KeybindingsFile") {}

// A file that goes through `texts`, then stays as it is.
export const layerKeybindingsFileOf = (texts: ReadonlyArray<string | null>) =>
  Layer.succeed(KeybindingsFile)({
    contents: Stream.fromIterable(texts).pipe(Stream.concat(Stream.never)),
  })
