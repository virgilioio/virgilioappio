import * as React from "react"
import { Badge, type BadgeProps } from "./badge"

/**
 * OverflowMore — `+N more` chip used at the end of badge clusters
 * (skill chips, filter chips). Always neutral, no dot.
 *
 *   <Badge tone="purple">Design systems</Badge>
 *   <Badge tone="blue">Figma</Badge>
 *   <Badge tone="green">SaaS</Badge>
 *   <OverflowMore count={4} />
 */
export interface OverflowMoreProps extends Omit<BadgeProps, "tone" | "dot" | "icon" | "count" | "children"> {
  count: number
  label?: string
}

export function OverflowMore({ count, label = "more", ...props }: OverflowMoreProps) {
  if (count <= 0) return null
  return (
    <Badge tone="neutral" {...props}>
      +{count} {label}
    </Badge>
  )
}
