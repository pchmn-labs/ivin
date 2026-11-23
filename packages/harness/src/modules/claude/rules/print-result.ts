import * as Schema from "effect/Schema"

const PrintResult = Schema.Struct({
  type: Schema.Literal("result"),
  is_error: Schema.Boolean,
  result: Schema.optionalKey(Schema.String),
})

const decode = Schema.decodeUnknownOption(Schema.fromJsonString(PrintResult))

// Tools off and no settings, hooks, skills or MCP servers loaded: the call only answers the prompt.
export const completeTextArgs = [
  "-p",
  "--model",
  "haiku",
  "--output-format",
  "json",
  "--tools",
  "",
  "--no-session-persistence",
  "--disable-slash-commands",
  "--setting-sources",
  "",
  "--strict-mcp-config",
] as const

export const printResultOf = (
  stdout: string,
): { ok: true; text: string } | { ok: false; message: string } => {
  const decoded = decode(stdout.trim())
  if (decoded._tag === "None") {
    return { ok: false, message: `Claude Code printed no result: ${stdout.trim().slice(0, 500)}` }
  }
  const { is_error, result = "" } = decoded.value
  return is_error ? { ok: false, message: result } : { ok: true, text: result }
}
