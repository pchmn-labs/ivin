import { expectTypeOf, test } from "vitest"
import type {
  Annotation as ContractAnnotation,
  CitationAnnotationData,
  IssueAnnotationData,
  PrAnnotationData,
} from "@ivin/contracts/annotation"
import type { Change, FolderEntry, GitStatusEntry } from "@ivin/contracts/file"
import type {
  OpenProjects as ContractOpenProjects,
  Project as ContractProject,
} from "@ivin/contracts/project"
import type {
  HarnessRunOptions,
  RunOptions,
  Session as ContractSession,
} from "@ivin/contracts/session"
import type { Settings as ContractSettings } from "@ivin/contracts/setting"
import type { Tab as ContractTab } from "@ivin/contracts/tab"
import type {
  ImageData,
  ImageRef,
  SessionUsage,
  TranscriptItem as ContractItem,
} from "@ivin/contracts/transcript"
import type * as Api from "@ivin/plugin-api/ui"

type Item<T extends ContractItem["type"]> = Extract<ContractItem, { type: T }>
type Dateless<T, K extends PropertyKey> = Omit<T, K & keyof T>

test("the plugin API's types match the contracts' they are converted from", () => {
  expectTypeOf<Change>().toEqualTypeOf<Api.Change>()
  expectTypeOf<GitStatusEntry>().toEqualTypeOf<Api.GitStatusEntry>()
  expectTypeOf<FolderEntry>().toEqualTypeOf<Api.FolderEntry>()
  expectTypeOf<RunOptions>().toEqualTypeOf<Api.RunOptions>()
  expectTypeOf<HarnessRunOptions>().toEqualTypeOf<Api.HarnessRunOptions>()
  expectTypeOf<ContractSettings>().toEqualTypeOf<Omit<Api.Settings, "plugins">>()
  expectTypeOf<ContractTab>().toEqualTypeOf<Api.Tab>()
  expectTypeOf<ImageRef>().toEqualTypeOf<Api.ImageRef>()
  expectTypeOf<ImageData>().toEqualTypeOf<Api.ImageData>()
  expectTypeOf<PrAnnotationData>().toEqualTypeOf<Api.PrAnnotationData>()
  expectTypeOf<IssueAnnotationData>().toEqualTypeOf<Api.IssueAnnotationData>()
  expectTypeOf<CitationAnnotationData>().toEqualTypeOf<Api.CitationAnnotationData>()
  expectTypeOf<SessionUsage>().toEqualTypeOf<Api.SessionUsage>()
  expectTypeOf<Item<"message">>().toEqualTypeOf<Api.MessageItem>()
  expectTypeOf<Item<"thinking">>().toEqualTypeOf<Api.ThinkingItem>()
  expectTypeOf<Item<"tool_call">>().toEqualTypeOf<Api.ToolCallItem>()
  expectTypeOf<Item<"approval">>().toEqualTypeOf<Api.ApprovalItem>()
  expectTypeOf<Item<"question">>().toEqualTypeOf<Api.QuestionItem>()
  expectTypeOf<Item<"error">>().toEqualTypeOf<Api.ErrorItem>()
  expectTypeOf<Item<"interruption">>().toEqualTypeOf<Api.InterruptionItem>()
  expectTypeOf<Item<"working_folder">>().toEqualTypeOf<Api.WorkingFolderItem>()
  expectTypeOf<Item<"run_option">>().toEqualTypeOf<Api.RunOptionItem>()
  expectTypeOf<Item<"task">>().toEqualTypeOf<Api.TaskItem>()
})

type SessionDates = "statusChangedAt" | "createdAt" | "lastActivityAt" | "archivedAt"

test("the plugin API's types with dates match the contracts' apart from their dates", () => {
  expectTypeOf<Dateless<ContractSession, SessionDates>>().toEqualTypeOf<
    Dateless<Api.Session, SessionDates>
  >()
  expectTypeOf<ContractSession>().toExtend<Api.Session>()
  expectTypeOf<Dateless<ContractProject, "lastOpenedAt">>().toEqualTypeOf<
    Dateless<Api.Project, "lastOpenedAt">
  >()
  expectTypeOf<Dateless<ContractOpenProjects, "projects">>().toEqualTypeOf<
    Dateless<Api.OpenProjects, "projects">
  >()
  expectTypeOf<ContractOpenProjects>().toExtend<Api.OpenProjects>()
  expectTypeOf<Dateless<ContractAnnotation, "createdAt" | "updatedAt" | "data">>().toEqualTypeOf<
    Dateless<Api.Annotation, "createdAt" | "updatedAt" | "data">
  >()
  expectTypeOf<ContractAnnotation>().toExtend<Api.Annotation>()
})
