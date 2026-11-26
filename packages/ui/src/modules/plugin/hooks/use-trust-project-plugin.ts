import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { ProjectPlugin } from "@ivin/contracts/plugin"
import { Cause } from "effect"
import { AsyncResult } from "effect/reactivity"
import { setFullTrustOf } from "../atoms/set-full-trust.ts"
import { trustKey, trustProjectPluginOf } from "../atoms/trust-project-plugin.ts"
import { trustFailureMessage } from "../rules/trust-failure-message.ts"

export const FULL_TRUST_WARNING =
  "Every change to this project's plugins runs at once, including one that arrives with a git pull. Only for a project you control."

export const FULL_TRUST_FAILURE = "ivin could not turn on full trust for this project."

// The hash handed back is the one on screen: a plugin that changed since fails with `PluginContentChanged`.
export function useTrustProjectPlugin(project: string, plugin: ProjectPlugin) {
  const family = trustProjectPluginOf(trustKey(project, plugin.id))
  const result = useAtomValue(family)
  const trust = useAtomSet(family)
  return {
    trust: () => trust({ project, id: plugin.id, hash: plugin.hash }),
    trusting: result.waiting,
    failure: AsyncResult.isFailure(result)
      ? trustFailureMessage(Cause.squash(result.cause), plugin.name)
      : null,
  }
}

export function useSetFullTrust(project: string) {
  const result = useAtomValue(setFullTrustOf(project))
  const set = useAtomSet(setFullTrustOf(project))
  return {
    set,
    setting: result.waiting,
    failure: AsyncResult.isFailure(result) ? FULL_TRUST_FAILURE : null,
  }
}
