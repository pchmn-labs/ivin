import type { FileList } from "@ivin/contracts/file"
import { Effect, Stream } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

const sameList = (a: FileList, b: FileList) =>
  a.truncated === b.truncated &&
  a.paths.length === b.paths.length &&
  a.paths.every((path, index) => path === b.paths[index])

// The working folder's listed files, read again after each batch of changes on disk.
const family = Atom.family((key: string) => {
  const [sessionId = ""] = key.split("\n")
  return serverRuntime.atom(
    Stream.unwrap(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return Stream.merge(Stream.make(undefined), client["file.watch"]({ sessionId })).pipe(
          Stream.buffer({ capacity: 1, strategy: "sliding" }),
          Stream.mapEffect(() => client["file.listFiles"]({ sessionId })),
          // Most changes edit a file without adding one; a new list would re-render every answer.
          Stream.changesWith(sameList),
          Stream.map(({ paths, truncated }) => ({ paths: new Set(paths), truncated })),
        )
      }),
    ),
  )
})

export const listedFilesOf = (sessionId: string, workingFolder: string) =>
  family(`${sessionId}\n${workingFolder}`)
