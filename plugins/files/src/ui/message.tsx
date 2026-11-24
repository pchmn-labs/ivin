import { Text } from "@ivin/plugin-api/ui"

export function Message({ children }: { children: string }) {
  return (
    <Text size="sm" tone="faint">
      {children}
    </Text>
  )
}
