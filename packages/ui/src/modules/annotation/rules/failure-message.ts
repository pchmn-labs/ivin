import type { ActionFailure } from "@ivin/plugin-api/ui"
import { errorTag } from "../../../shared/rules/error-tag.ts"

// An annotation that is already gone is the outcome the user asked for.
export const removeAnnotationFailure = (error: unknown): ActionFailure | undefined =>
  errorTag(error) === "AnnotationNotFound"
    ? undefined
    : { text: "It could not be removed. Try again.", retryable: true }
