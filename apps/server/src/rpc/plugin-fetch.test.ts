import { Effect } from "effect"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { afterEach, expect, test } from "vitest"
import { encodeFetchRequest } from "@ivin/contracts/plugin-fetch"
import { packageJson, tempDir, withServer, writePlugin } from "./plugin-test-server.ts"

const servers: Server[] = []
afterEach(() => {
  for (const server of servers.splice(0)) server.close()
})

// A loopback server that answers `answer` and records each path it was asked for.
const listen = async (answer: (path: string, port: number) => [number, Record<string, string>]) => {
  const paths: string[] = []
  const server = createServer((request, response) => {
    paths.push(request.url ?? "")
    const [status, headers] = answer(request.url ?? "", port)
    response.writeHead(status, headers).end(status === 200 ? `hi from ${request.url}` : "")
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as AddressInfo).port
  return { port, paths }
}

const uiPlugin = (home: string, id: string, fetch: string[]) =>
  writePlugin(home, id, {
    "package.json": packageJson({ id, ui: "src/ui.tsx", permissions: { fetch } }),
    "src/ui.tsx": "export const activate = () => {}",
  })

test("a UI half's ctx.fetch reaches a declared host, and is refused before any request for another, also after a redirect", async () => {
  const other = await listen(() => [200, {}])
  const declared = await listen((path) =>
    path === "/away" ? [302, { location: `http://localhost:${other.port}/stolen` }] : [200, {}],
  )
  const home = tempDir("home")
  uiPlugin(home, "getter", ["127.0.0.1"])
  uiPlugin(home, "bare", [])

  const result = await withServer(home, (client) =>
    Effect.gen(function* () {
      const fetch = (id: string, path: string) =>
        Effect.promise(() => encodeFetchRequest(`http://127.0.0.1:${declared.port}${path}`)).pipe(
          Effect.flatMap((request) => client["plugin.fetch"]({ id, request })),
        )
      return {
        ok: yield* fetch("getter", "/hello"),
        undeclared: yield* Effect.flip(fetch("bare", "/secret")),
        redirected: yield* Effect.flip(fetch("getter", "/away")),
        log: yield* client["plugin.readLog"]({ id: "bare" }),
      }
    }),
  )

  expect(result.ok).toMatchObject({ status: 200, body: btoa("hi from /hello") })
  expect(result.undeclared.reason).toContain("fetch: 127.0.0.1")
  expect(result.redirected.reason).toContain("fetch: localhost")
  expect(declared.paths).toEqual(["/hello", "/away"])
  expect(other.paths).toEqual([])
  expect(result.log).toEqual([expect.stringContaining("fetch: 127.0.0.1")])
})
