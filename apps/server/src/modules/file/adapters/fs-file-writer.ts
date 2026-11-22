import { randomUUID } from "node:crypto"
import { chmod, rename, stat, unlink, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"
import { Effect, Layer } from "effect"
import { FileUnwritable, FileWriter } from "../usecases/file-writer.ts"

const unwritable = (error: unknown) =>
  new FileUnwritable({
    reason: ["ENOENT", "ENOTDIR", "EISDIR"].includes((error as NodeJS.ErrnoException).code ?? "")
      ? "missing"
      : "unwritable",
  })

const replace = async (path: string, bytes: Uint8Array) => {
  const mode = await stat(path).then(
    (info) => {
      if (info.isDirectory()) throw Object.assign(new Error("a folder"), { code: "EISDIR" })
      return info.mode & 0o7777
    },
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null
      throw error
    },
  )
  // Beside the file, so the rename stays on one file system.
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.ivin-save`)
  try {
    await writeFile(temporary, bytes, { flag: "wx" })
    if (mode !== null) await chmod(temporary, mode)
    await rename(temporary, path)
  } catch (error) {
    await unlink(temporary).catch(() => undefined)
    throw error
  }
}

export const layerFsFileWriter = Layer.succeed(FileWriter)({
  write: (path, bytes) => Effect.tryPromise({ try: () => replace(path, bytes), catch: unwritable }),
})
