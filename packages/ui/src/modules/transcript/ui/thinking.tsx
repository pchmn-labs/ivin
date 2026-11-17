export function Thinking({ text }: { text: string }) {
  return (
    <details>
      <summary>Thinking</summary>
      <p style={{ margin: 0, whiteSpace: "pre-wrap", fontStyle: "italic" }}>{text}</p>
    </details>
  )
}
