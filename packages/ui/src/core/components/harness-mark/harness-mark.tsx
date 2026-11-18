import "./harness-mark.css"

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
  const radians = (angle * Math.PI) / 180
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)]
  const point = (radius: number) =>
    `${(12 + radius * cos).toFixed(2)} ${(12 + radius * sin).toFixed(2)}`
  return `M${point(3)}L${point(9.5)}`
})

export function ClaudeMark({ size = 16 }: { size?: 14 | 16 }) {
  return (
    <svg
      className="iv-harness-mark iv-harness-mark--claude"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {RAYS.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
