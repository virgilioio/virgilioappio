import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

export interface CandidateFilters {
  statuses: string[]
  sources: string[]
  countries: string[]
  states: string[]
  cities: string[]
  seniorityLevels: string[]
  functionalAreas: string[]
  specializations: string[]
  skills: string[]
  enrichmentStatuses: string[]
  experienceMin: number | null
  experienceMax: number | null
  salaryMin: number | null
  salaryMax: number | null
  dateFrom: Date | null
  dateTo: Date | null
}

const EMPTY_FILTERS: CandidateFilters = {
  statuses: [],
  sources: [],
  countries: [],
  states: [],
  cities: [],
  seniorityLevels: [],
  functionalAreas: [],
  specializations: [],
  skills: [],
  enrichmentStatuses: [],
  experienceMin: null,
  experienceMax: null,
  salaryMin: null,
  salaryMax: null,
  dateFrom: null,
  dateTo: null,
}

type ArrayFilterKey = 'statuses' | 'sources' | 'countries' | 'states' | 'cities' | 'seniorityLevels' | 'functionalAreas' | 'specializations' | 'skills' | 'enrichmentStatuses'
type NumericFilterKey = 'experienceMin' | 'experienceMax' | 'salaryMin' | 'salaryMax'
type DateFilterKey = 'dateFrom' | 'dateTo'

interface CandidateFilterContextValue {
  filters: CandidateFilters
  setArrayFilter: (key: ArrayFilterKey, values: string[]) => void
  toggleArrayFilter: (key: ArrayFilterKey, value: string) => void
  removeArrayFilterValue: (key: ArrayFilterKey, value: string) => void
  setNumericFilter: (key: NumericFilterKey, value: number | null) => void
  setDateFilter: (key: DateFilterKey, value: Date | null) => void
  clearAll: () => void
  clearFilter: (key: keyof CandidateFilters) => void
  activeFilterCount: number
  hasActiveFilters: boolean
}

const CandidateFilterContext = createContext<CandidateFilterContextValue | null>(null)

export function CandidateFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<CandidateFilters>(EMPTY_FILTERS)

  const setArrayFilter = useCallback((key: ArrayFilterKey, values: string[]) => {
    setFilters(prev => ({ ...prev, [key]: values }))
  }, [])

  const toggleArrayFilter = useCallback((key: ArrayFilterKey, value: string) => {
    setFilters(prev => {
      const current = prev[key]
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [key]: next }
    })
  }, [])

  const removeArrayFilterValue = useCallback((key: ArrayFilterKey, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].filter(v => v !== value),
    }))
  }, [])

  const setNumericFilter = useCallback((key: NumericFilterKey, value: number | null) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const setDateFilter = useCallback((key: DateFilterKey, value: Date | null) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const clearAll = useCallback(() => setFilters(EMPTY_FILTERS), [])

  const clearFilter = useCallback((key: keyof CandidateFilters) => {
    setFilters(prev => ({ ...prev, [key]: EMPTY_FILTERS[key] }))
  }, [])

  const activeFilterCount = useMemo(() => {
    let count = 0
    const arrayKeys: ArrayFilterKey[] = ['statuses', 'sources', 'countries', 'states', 'cities', 'seniorityLevels', 'functionalAreas', 'specializations', 'skills', 'enrichmentStatuses']
    for (const k of arrayKeys) count += filters[k].length
    if (filters.experienceMin !== null) count++
    if (filters.experienceMax !== null) count++
    if (filters.salaryMin !== null) count++
    if (filters.salaryMax !== null) count++
    if (filters.dateFrom !== null) count++
    if (filters.dateTo !== null) count++
    return count
  }, [filters])

  const value = useMemo(() => ({
    filters,
    setArrayFilter,
    toggleArrayFilter,
    removeArrayFilterValue,
    setNumericFilter,
    setDateFilter,
    clearAll,
    clearFilter,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
  }), [filters, setArrayFilter, toggleArrayFilter, removeArrayFilterValue, setNumericFilter, setDateFilter, clearAll, clearFilter, activeFilterCount])

  return (
    <CandidateFilterContext.Provider value={value}>
      {children}
    </CandidateFilterContext.Provider>
  )
}

export function useCandidateFilters() {
  const ctx = useContext(CandidateFilterContext)
  if (!ctx) throw new Error('useCandidateFilters must be used within CandidateFilterProvider')
  return ctx
}
