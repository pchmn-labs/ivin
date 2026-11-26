import { errorTag } from "../../../shared/rules/error-tag.ts"

export const trustFailureMessage = (error: unknown, name: string): string => {
  if (errorTag(error) === "PluginContentChanged") {
    return `The files of “${name}” changed again, so nothing was trusted. Review the new version, then trust it.`
  }
  if (errorTag(error) === "PluginNotFound") {
    return `“${name}” is no longer in this project.`
  }
  return `ivin could not trust “${name}”.`
}
