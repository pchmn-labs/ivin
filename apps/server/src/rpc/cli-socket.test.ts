import { connect, type Socket } from "node:net"
import { expect, test } from "vitest"
import { withCliServer } from "./cli-server.ts"

const open = (socketPath: string) =>
  new Promise<Socket>((resolve, reject) => {
    const socket = connect(socketPath)
    socket.once("connect", () => resolve(socket))
    socket.once("error", reject)
  })

const nextLine = (socket: Socket) =>
  new Promise<unknown>((resolve, reject) => {
    let buffered = ""
    const onData = (chunk: Buffer) => {
      buffered += chunk.toString("utf8")
      const end = buffered.indexOf("\n")
      if (end === -1) return
      socket.off("data", onData)
      resolve(JSON.parse(buffered.slice(0, end)))
    }
    socket.on("data", onData)
    socket.once("close", () => reject(new Error("closed")))
  })

const request = (id: string, tag: string, payload: unknown) =>
  `${JSON.stringify({ _tag: "Request", id, tag, payload, headers: [] })}\n`

const closed = (socket: Socket) =>
  new Promise<void>((resolve) => {
    if (socket.destroyed) resolve()
    socket.once("close", () => resolve())
  })

test("the socket answers an RPC the ivin command calls", async () => {
  const answer = await withCliServer(async (socketPath) => {
    const socket = await open(socketPath)
    socket.write(request("1", "setting.get", { path: null }))
    const line = await nextLine(socket)
    socket.destroy()
    return line
  })

  expect(answer).toMatchObject({ _tag: "Exit", requestId: "1", exit: { _tag: "Success" } })
}, 10_000)

test("the socket refuses an RPC only the window calls", async () => {
  const answer = await withCliServer(async (socketPath) => {
    const socket = await open(socketPath)
    socket.write(request("1", "session.list", { projectPath: "/p" }))
    const line = await nextLine(socket)
    socket.destroy()
    return line
  })

  expect(answer).toMatchObject({ _tag: "Exit", requestId: "1", exit: { _tag: "Failure" } })
}, 10_000)

test("a line that is not JSON is dropped and the next request is answered", async () => {
  const answer = await withCliServer(async (socketPath) => {
    const socket = await open(socketPath)
    socket.write("not json\n")
    socket.write(request("2", "setting.get", { path: null }))
    const line = await nextLine(socket)
    socket.destroy()
    return line
  })

  expect(answer).toMatchObject({ _tag: "Exit", requestId: "2", exit: { _tag: "Success" } })
}, 10_000)

test("a line longer than the limit closes the connection", async () => {
  await withCliServer(async (socketPath) => {
    const socket = await open(socketPath)
    socket.on("error", () => undefined)
    socket.write("x".repeat(2 * 1024 * 1024))
    await closed(socket)
  })
}, 10_000)
