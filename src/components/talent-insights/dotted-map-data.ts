/**
 * Precomputed dotted-map grid JSON.
 * Generated once to avoid expensive runtime computation.
 * To regenerate: run `getMapJSON({ height: 60, grid: 'diagonal' })` from dotted-map.
 */
import DottedMap from 'dotted-map'

// We use a lazy singleton so the grid is computed only once
let cachedMap: DottedMap | null = null

export function getDottedMap(): DottedMap {
  if (!cachedMap) {
    cachedMap = new DottedMap({ height: 60, grid: 'diagonal' })
  }
  return cachedMap
}
