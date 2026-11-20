import { creature } from "../rules/creature.ts"
import "./project-creature.css"

export function ProjectCreature({ name, size = 20 }: { name: string; size?: 12 | 16 | 20 }) {
  const { hue, cells } = creature(name)
  return (
    <svg
      className="iv-project-creature"
      data-hue={hue}
      width={size}
      height={size}
      viewBox="0 0 8 8"
      aria-hidden="true"
    >
      {cells.map(({ x, y }) => (
        <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  )
}
