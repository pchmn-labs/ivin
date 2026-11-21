import { HighlightStyle } from "@codemirror/language"
import { tags } from "@lezer/highlight"

// Classes, not colours, so code-view.css reads the --iv-syntax- tokens of the current theme.
export const highlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.operatorKeyword, tags.modifier, tags.controlKeyword],
    class: "iv-syntax-keyword",
  },
  {
    tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character],
    class: "iv-syntax-string",
  },
  { tag: [tags.comment, tags.meta], class: "iv-syntax-comment" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], class: "iv-syntax-number" },
  { tag: [tags.typeName, tags.className, tags.namespace], class: "iv-syntax-type" },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    class: "iv-syntax-function",
  },
  { tag: [tags.tagName, tags.heading], class: "iv-syntax-tag" },
  { tag: [tags.attributeName, tags.propertyName], class: "iv-syntax-property" },
  { tag: tags.strong, class: "iv-syntax-strong" },
  { tag: tags.emphasis, class: "iv-syntax-emphasis" },
  { tag: tags.link, class: "iv-syntax-link" },
  { tag: tags.invalid, class: "iv-syntax-invalid" },
])
