import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { ProjectNotFound } from "./project.ts"
import { SessionNotFound } from "./session.ts"

export const AnnotationTarget = Schema.Union([
  Schema.TaggedStruct("session", { sessionId: Schema.String }),
  Schema.TaggedStruct("project", { projectPath: Schema.String }),
])
export type AnnotationTarget = typeof AnnotationTarget.Type

// A path segment other than GitLab's "-" separator.
const segment = String.raw`[^/]*[^/-][^/]*`
const forgePath = (github: string, gitlab: string) =>
  new RegExp(
    String.raw`^(/${segment}/${segment}/${github}|(?:/${segment}){2,}/-/${gitlab})/([1-9]\d*)(?:/|$)`,
  )
const forgePaths = {
  pr: forgePath("pull", "merge_requests"),
  issue: forgePath("issues", "issues"),
}
export type ForgeKind = keyof typeof forgePaths

export const forgeUrlOf = (kind: ForgeKind, text: string): string | null => {
  if (!URL.canParse(text)) return null
  const url = new URL(text)
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  const match = forgePaths[kind].exec(url.pathname)
  if (match === null) return null
  // Forges match owner and repository names case-insensitively.
  return `${url.origin}${match[1]!.toLowerCase()}/${match[2]}`
}

export const forgeLinkOf = (text: string): { kind: ForgeKind; url: string } | null => {
  for (const kind of ["pr", "issue"] as const) {
    const url = forgeUrlOf(kind, text)
    if (url !== null) return { kind, url }
  }
  return null
}

// Normalised, so that the same pull request or issue always has the same key.
const forgeUrl = (kind: ForgeKind) =>
  Schema.String.check(Schema.makeFilter((url) => forgeUrlOf(kind, url) === url))

export const forgeRelations = {
  // `branch`: the pull request of the session's branch, which the forge's plugin finds itself.
  pr: ["created", "referenced", "reviewed", "branch"],
  // `resolved`: the session's work closes the issue.
  issue: ["created", "referenced", "resolved"],
} as const

const count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))

export const PrAnnotationData = Schema.Struct({
  url: forgeUrl("pr"),
  relation: Schema.Literals(forgeRelations.pr),
  title: Schema.optionalKey(Schema.String),
  state: Schema.optionalKey(Schema.Literals(["open", "draft", "merged", "closed"])),
  checks: Schema.optionalKey(Schema.Literals(["pending", "passing", "failing"])),
  checkCounts: Schema.optionalKey(Schema.Struct({ passed: count, failed: count, pending: count })),
  review: Schema.optionalKey(Schema.Literals(["approved", "changes_requested", "review_required"])),
  // `ready`: the forge would merge it now; `blocked`: something other than a conflict stops it.
  merge: Schema.optionalKey(Schema.Literals(["ready", "blocked", "conflict"])),
  // When the pull request last changed on the forge, as an ISO date.
  activityAt: Schema.optionalKey(Schema.String),
  // Why the last status check failed; gone once one succeeds.
  error: Schema.optionalKey(Schema.String),
})
export type PrAnnotationData = typeof PrAnnotationData.Type

export const IssueAnnotationData = Schema.Struct({
  url: forgeUrl("issue"),
  relation: Schema.Literals(forgeRelations.issue),
})
export type IssueAnnotationData = typeof IssueAnnotationData.Type

// A number without its repository: the forge's plugin turns it into a link.
export const CitationAnnotationData = Schema.Struct({
  kind: Schema.Literals(["issue", "pr"]),
  number: Schema.Int.check(Schema.isGreaterThan(0)),
})
export type CitationAnnotationData = typeof CitationAnnotationData.Type

// The kinds shared by several plugins, each with the data field that is its key.
export const annotationKinds = {
  pr: { data: PrAnnotationData, key: "url" },
  issue: { data: IssueAnnotationData, key: "url" },
  citation: { data: CitationAnnotationData, key: "number" },
} as const
export type AnnotationKinds = typeof annotationKinds
export type AnnotationDataOf<K extends string> = K extends keyof AnnotationKinds
  ? AnnotationKinds[K]["data"]["Type"]
  : Schema.Json

export const Annotation = Schema.Struct({
  id: Schema.String,
  target: AnnotationTarget,
  ns: Schema.String,
  kind: Schema.String,
  data: Schema.Json,
  createdAt: Schema.DateTimeUtcFromMillis,
  updatedAt: Schema.DateTimeUtcFromMillis,
})
export type Annotation = typeof Annotation.Type

export const AnnotationChange = Schema.Union([
  Schema.TaggedStruct("changed", { annotation: Annotation }),
  Schema.TaggedStruct("removed", { id: Schema.String, target: AnnotationTarget }),
])
export type AnnotationChange = typeof AnnotationChange.Type

export class AnnotationNotFound extends Schema.TaggedError<AnnotationNotFound>()(
  "AnnotationNotFound",
  { id: Schema.String },
) {}

export class AnnotationDataInvalid extends Schema.TaggedError<AnnotationDataInvalid>()(
  "AnnotationDataInvalid",
  { kind: Schema.String },
) {}

export const AnnotationRpcs = RpcGroup.make(
  Rpc.make("annotation.add", {
    payload: {
      target: AnnotationTarget,
      ns: Schema.String,
      kind: Schema.String,
      data: Schema.Json,
    },
    success: Annotation,
    error: Schema.Union([SessionNotFound, ProjectNotFound, AnnotationDataInvalid]),
  }),
  Rpc.make("annotation.remove", {
    payload: { id: Schema.String },
    error: AnnotationNotFound,
  }),
  // Oldest first; every kind when `kind` is null.
  Rpc.make("annotation.list", {
    payload: { target: AnnotationTarget, kind: Schema.NullOr(Schema.String) },
    success: Schema.Array(Annotation),
  }),
  // The target's annotations as `changed`, then each change.
  Rpc.make("annotation.watch", {
    payload: { target: AnnotationTarget },
    success: AnnotationChange,
    stream: true,
  }),
)
