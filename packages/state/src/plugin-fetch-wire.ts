import type { PluginFetchRequest, PluginFetchResponse } from "@ivin/contracts/plugin-fetch"

// How `ctx.fetch` crosses to the server and back, from either half.
const toBase64 = (bytes: Uint8Array) => {
  let text = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(text)
}

const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0))

export const encodeFetchRequest = async (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<PluginFetchRequest> => {
  const request = new Request(input, init)
  const body = request.body === null ? null : toBase64(new Uint8Array(await request.arrayBuffer()))
  return { url: request.url, method: request.method, headers: [...request.headers], body }
}

export const decodeFetchRequest = (request: PluginFetchRequest) => ({
  url: request.url,
  method: request.method,
  headers: request.headers,
  body: request.body === null ? null : fromBase64(request.body),
})

export const encodeFetchResponse = async (
  url: string,
  response: Response,
): Promise<PluginFetchResponse> => ({
  url,
  status: response.status,
  statusText: response.statusText,
  headers: [...response.headers],
  body: toBase64(new Uint8Array(await response.arrayBuffer())),
})

export const decodeFetchResponse = (answer: PluginFetchResponse): Response => {
  // A null-body status refuses any body, even an empty one.
  const empty = [101, 103, 204, 205, 304].includes(answer.status)
  const response = new Response(empty ? null : fromBase64(answer.body), {
    status: answer.status,
    statusText: answer.statusText,
    headers: answer.headers.map(([name, value]) => [name, value]),
  })
  Object.defineProperty(response, "url", { value: answer.url })
  return response
}
