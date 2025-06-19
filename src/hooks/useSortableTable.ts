
import { useState, useMemo } from 'react'

export type SortDirection = 'asc' | 'desc' | null

export interface SortConfig {
  key: string | null
  direction: SortDirection
}

export function useSortableTable<T>(data: T[], defaultSort?: { key: string; direction: SortDirection }) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: defaultSort?.key || null,
    direction: defaultSort?.direction || null
  })

  const sortedData = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return data
    }

    return [...data].sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.key!)
      const bValue = getNestedValue(b, sortConfig.key!)

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1

      // Handle different data types
      let comparison = 0
      
      // Numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      }
      // Dates
      else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime()
      }
      // Date strings
      else if (isDateString(aValue) && isDateString(bValue)) {
        comparison = new Date(aValue).getTime() - new Date(bValue).getTime()
      }
      // Strings
      else {
        comparison = String(aValue).localeCompare(String(bValue))
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison
    })
  }, [data, sortConfig])

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc'
    
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc'
      } else if (sortConfig.direction === 'desc') {
        direction = null
      }
    }
    
    setSortConfig({ key: direction ? key : null, direction })
  }

  return { sortedData, sortConfig, requestSort }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

function isDateString(value: any): boolean {
  if (typeof value !== 'string') return false
  const date = new Date(value)
  return !isNaN(date.getTime()) && value.includes('-')
}
