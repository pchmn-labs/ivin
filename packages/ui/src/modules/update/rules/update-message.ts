import type { UpdateFailure } from "@ivin/contracts/update"

const FAILURES: Record<UpdateFailure, string> = {
  network:
    "ivin could not reach GitHub to look for an update. Check your connection, then try again.",
  fingerprint:
    "The downloaded update did not match its fingerprint, so ivin deleted it and kept this version. Try again.",
  notWritable:
    "ivin cannot replace itself where it is installed. Move ivin to a folder you can write to, such as /Applications, then try again.",
}

export const failureMessage = (reason: UpdateFailure): string => FAILURES[reason]

export const restartPrompt = (
  version: string,
  runningAgents: number,
): { readonly title: string; readonly description: string } | null =>
  runningAgents === 0
    ? null
    : {
        title: `Restart ivin to update to ${version}?`,
        description:
          runningAgents === 1
            ? "1 agent is running. It stops now and resumes with your next message in its session."
            : `${runningAgents} agents are running. They stop now and resume with your next message in their session.`,
      }
