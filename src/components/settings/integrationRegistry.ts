import { ComponentType } from 'react'

export type IntegrationCategory = 'productivity' | 'communication' | 'sourcing'

export interface IntegrationDefinition {
  id: string
  name: string
  description: string
  category: IntegrationCategory
  /** Lucide icon name, or 'custom' to use logoComponent/logoSrc */
  icon?: string
  /** Path to a logo image (imported asset) */
  logoSrc?: string
  /** React component rendered as logo */
  logoComponent?: ComponentType<{ className?: string; size?: number }>
  /** The detail/config component rendered when user clicks Configure */
  detailComponent: ComponentType
  /** Images for the detail dialog carousel */
  images?: string[]
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  productivity: 'Productivity',
  communication: 'Communication',
  sourcing: 'Sourcing',
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
  count: 0,
}))

export const STATUS_OPTIONS = [
  { value: 'connected', label: 'Connected', count: 0 },
  { value: 'not_connected', label: 'Not Connected', count: 0 },
]
