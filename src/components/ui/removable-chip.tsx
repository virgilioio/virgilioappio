import * as React from "react"
import { Badge, type BadgeProps } from "./badge"

/**
 * RemovableChip — thin wrapper around <Badge onRemove>. Use in filter bars,
 * multi-select dropdowns, recipient pickers. Defaults to purple tone so a
 * sequence of active filters reads as a set.
 */
export interface RemovableChipProps extends Omit<BadgeProps, "onRemove" | "children"> {
  onRemove: () => void
  children: React.ReactNode
}

export function RemovableChip({
  tone = "purple",
  size = "sm",
  ...props
}: RemovableChipProps) {
  return <Badge tone={tone} size={size} {...props} />
}
