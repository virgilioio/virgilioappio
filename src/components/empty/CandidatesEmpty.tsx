import * as React from 'react'
import { AnimatedEmpty, type EmptyScene, type EmptyStateAction } from './AnimatedEmpty'

/**
 * CandidatesEmpty — AnimatedEmpty with the paper plane, for lists that hold
 * candidates. Kept so existing call sites don't change. Pass `filtered` when filters
 * or a search hide every row: the picture becomes the search scene (§17).
 */
export type CandidatesEmptyAction = EmptyStateAction

export function CandidatesEmpty({
  filtered = false,
  ...props
}: Omit<React.ComponentProps<typeof AnimatedEmpty>, 'scene'> & { filtered?: boolean }) {
  const scene: EmptyScene = filtered ? 'search' : 'candidates'
  return <AnimatedEmpty scene={scene} {...props} />
}
