export interface UtcDateTime {
  readonly epochMilliseconds: number
}

export type Json =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<Json>
  | { readonly [key: string]: Json }

export interface Project {
  readonly path: string
  readonly name: string
  readonly lastOpenedAt: UtcDateTime
}

export interface OpenProjects {
  readonly projects: ReadonlyArray<Project>
  readonly selectedPath: string | null
}

export interface Tab {
  readonly sessionId: string
  readonly projectPath: string
}

export interface Settings {
  readonly tabs: { readonly stopAgentOnClose: boolean }
  readonly worktrees: { readonly removeOnTabClose: boolean }
  readonly files: { readonly folderIcons: boolean }
  readonly sidebar: { readonly layout: "rail" | "strip" }
  readonly agents: { readonly stopWhenIdleMinutes: number }
  readonly updates: { readonly automaticCheck: boolean }
}

export type SessionStatus =
  | "preparing_worktree"
  | "working"
  | "waiting"
  | "in_background"
  | "idle"
  | "failed"

export type RunOption = "model" | "effort" | "permissionMode"

export interface RunOptions {
  readonly model: string
  readonly effort: string
  readonly permissionMode: string
}

export interface OfferedValue {
  readonly value: string
  readonly name: string
  readonly description: string | null
}

export interface OfferedModel extends OfferedValue {
  readonly efforts: ReadonlyArray<string>
  readonly older: boolean
}

export interface HarnessRunOptions {
  readonly model: { readonly values: ReadonlyArray<OfferedModel>; readonly default: string }
  readonly effort: { readonly values: ReadonlyArray<OfferedValue>; readonly default: string }
  readonly permissionMode: {
    readonly values: ReadonlyArray<OfferedValue>
    readonly default: string
  }
}

export interface ImageRef {
  readonly id: string
  readonly number: number
  readonly mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp"
}

export interface ImageData extends ImageRef {
  readonly base64: string
}

export interface PendingMessage {
  readonly id: string
  readonly text: string
  readonly images: ReadonlyArray<ImageRef>
}

export interface RelaunchFailure {
  readonly previous: RunOptions
  readonly message: string
  readonly error: string | null
}

export interface BackgroundTask {
  readonly taskId: string
  readonly kind: "agent" | "command"
  readonly description: string
}

export interface Session {
  readonly id: string
  readonly projectPath: string
  readonly workingFolder: string
  readonly inWorktree: boolean
  readonly branch: string | null
  readonly started: boolean
  readonly workingFolderDeleted: boolean
  readonly title: string
  readonly harness: "claude" | "codex" | "acp" | "scripted"
  readonly model: string
  readonly effort: string
  readonly permissionMode: string
  readonly relaunchFailure: RelaunchFailure | null
  readonly pendingMessages: ReadonlyArray<PendingMessage>
  readonly unreadMessages: ReadonlyArray<PendingMessage>
  readonly status: SessionStatus
  readonly waitingFor: "approval" | "question" | null
  readonly backgroundTasks: ReadonlyArray<BackgroundTask>
  readonly statusChangedAt: UtcDateTime
  readonly createdAt: UtcDateTime
  readonly lastActivityAt: UtcDateTime
  readonly archivedAt: UtcDateTime | null
  readonly lastImageNumber: number
}

// Null until the session has any usage.
export type SessionUsage = { readonly tokens: number; readonly costUsd: number } | null

export type ChangeStatus = "modified" | "added" | "deleted" | "renamed" | "untracked"

export type GitFileStatus = "modified" | "added" | "untracked" | "deleted" | "conflicted"

export interface Change {
  readonly path: string
  readonly previousPath: string | null
  readonly status: ChangeStatus
  readonly added: number | null
  readonly deleted: number | null
}

export interface GitStatusEntry {
  readonly path: string
  readonly status: GitFileStatus
}

export interface FolderEntry {
  readonly name: string
  readonly kind: "folder" | "file"
  readonly ignored: boolean
}

export type AnnotationTarget =
  | { readonly _tag: "session"; readonly sessionId: string }
  | { readonly _tag: "project"; readonly projectPath: string }

export interface PrAnnotationData {
  readonly url: string
  readonly relation: "created" | "referenced" | "reviewed"
  readonly title?: string
  readonly state?: "open" | "draft" | "merged" | "closed"
  readonly checks?: "pending" | "passing" | "failing"
}

export interface IssueAnnotationData {
  readonly url: string
  readonly relation: "created" | "referenced" | "resolved"
}

export interface CitationAnnotationData {
  readonly kind: "issue" | "pr"
  readonly number: number
}

export interface Annotation {
  readonly id: string
  readonly target: AnnotationTarget
  readonly ns: string
  readonly kind: string
  readonly data: Json
  readonly createdAt: UtcDateTime
  readonly updatedAt: UtcDateTime
}

export interface AnnotationKinds {
  readonly pr: PrAnnotationData
  readonly issue: IssueAnnotationData
  readonly citation: CitationAnnotationData
}

// The data of a kind the API defines has that kind's shape; any other kind's is JSON.
export type AnnotationDataOf<K extends string> = K extends keyof AnnotationKinds
  ? AnnotationKinds[K]
  : Json

export interface QuestionOption {
  readonly label: string
  readonly description: string
}

export interface Question {
  readonly question: string
  readonly header: string
  readonly options: ReadonlyArray<QuestionOption>
  readonly multiSelect: boolean
}

export interface QuestionAnswer {
  readonly question: string
  readonly choices: ReadonlyArray<string>
}

interface ItemFields {
  readonly id: string
  readonly sessionId: string
  readonly position: number
  readonly at: number
}

export interface MessageItem extends ItemFields {
  readonly type: "message"
  readonly parentToolCallId?: string | undefined
  readonly role: "user" | "assistant"
  readonly text: string
  readonly images: ReadonlyArray<ImageRef>
  readonly steer: boolean
}

export interface ThinkingItem extends ItemFields {
  readonly type: "thinking"
  readonly parentToolCallId?: string | undefined
  readonly text: string
}

export interface ToolCallItem extends ItemFields {
  readonly type: "tool_call"
  readonly parentToolCallId?: string | undefined
  readonly toolCallId: string
  readonly name: string
  readonly kind: "command" | "read" | "edit" | "search" | "skill" | "agent" | "other"
  readonly input: unknown
  readonly status: "running" | "done" | "error"
  readonly output: string | null
}

export interface ApprovalItem extends ItemFields {
  readonly type: "approval"
  readonly requestId: string
  readonly toolCallId: string | null
  readonly name: string
  readonly input: unknown
  readonly decision: "allow" | "deny" | "unanswered" | null
}

export interface QuestionItem extends ItemFields {
  readonly type: "question"
  readonly requestId: string
  readonly toolCallId: string | null
  readonly questions: ReadonlyArray<Question>
  readonly status: "open" | "answered" | "declined" | "unanswered"
  readonly answers: ReadonlyArray<QuestionAnswer>
}

export interface ErrorItem extends ItemFields {
  readonly type: "error"
  readonly message: string
}

export interface InterruptionItem extends ItemFields {
  readonly type: "interruption"
}

export interface WorkingFolderItem extends ItemFields {
  readonly type: "working_folder"
  readonly path: string
  readonly inWorktree: boolean
  readonly branch: string | null
  readonly cause: "creation" | "choice" | "adoption" | "branch_picker" | "pick"
  readonly worktreesIgnored: boolean
}

export interface RunOptionItem extends ItemFields {
  readonly type: "run_option"
  readonly option: RunOption
  readonly from: string
  readonly to: string
  readonly fromName: string
  readonly toName: string
}

export type TranscriptItem =
  | MessageItem
  | ThinkingItem
  | ToolCallItem
  | ApprovalItem
  | QuestionItem
  | ErrorItem
  | InterruptionItem
  | WorkingFolderItem
  | RunOptionItem
