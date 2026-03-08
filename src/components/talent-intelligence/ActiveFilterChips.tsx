import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { useTalentIntelligenceFilters } from '@/contexts/TalentIntelligenceFilterContext'
import { format } from 'date-fns'

const FILTER_LABELS: Record<string, string> = {
  roles: 'Role',
  functionalAreas: 'Area',
  specializations: 'Spec',
  seniorities: 'Seniority',
  skills: 'Skill',
  countries: 'Country',
  states: 'State',
  cities: 'City',
}

function formatCurrency(v: number) {
  if (v >= 1000) return `$${Math.round(v / 1000)}k`
  return `$${v}`
}

export function ActiveFilterChips() {
  const { filters, removeArrayFilterValue, clearFilter, clearAll, hasActiveFilters } = useTalentIntelligenceFilters()

  if (!hasActiveFilters) return null

  const arrayKeys = ['roles', 'functionalAreas', 'specializations', 'seniorities', 'skills', 'countries', 'states', 'cities'] as const

  return (
    <div className="flex flex-wrap items-center gap-2">
      {arrayKeys.map(key =>
        filters[key].map(val => (
          <Badge
            key={`${key}-${val}`}
            variant="purple"
            className="gap-1 pr-1 text-xs font-poppins"
          >
            <span className="text-muted-foreground">{FILTER_LABELS[key]}:</span> {val}
            <button
              onClick={() => removeArrayFilterValue(key, val)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))
      )}

      {(filters.experienceMin !== null || filters.experienceMax !== null) && (
        <Badge variant="purple" className="gap-1 pr-1 text-xs font-poppins">
          <span className="text-muted-foreground">Exp:</span>
          {filters.experienceMin ?? 0}–{filters.experienceMax ?? '∞'} yrs
          <button
            onClick={() => { clearFilter('experienceMin'); clearFilter('experienceMax') }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {(filters.salaryMin !== null || filters.salaryMax !== null) && (
        <Badge variant="purple" className="gap-1 pr-1 text-xs font-poppins">
          <span className="text-muted-foreground">Salary:</span>
          {formatCurrency(filters.salaryMin ?? 0)}–{formatCurrency(filters.salaryMax ?? 999999)}
          <button
            onClick={() => { clearFilter('salaryMin'); clearFilter('salaryMax') }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {(filters.dateFrom || filters.dateTo) && (
        <Badge variant="purple" className="gap-1 pr-1 text-xs font-poppins">
          <span className="text-muted-foreground">Date:</span>
          {filters.dateFrom ? format(filters.dateFrom, 'MMM d, yyyy') : 'Start'}
          {' – '}
          {filters.dateTo ? format(filters.dateTo, 'MMM d, yyyy') : 'Now'}
          <button
            onClick={() => { clearFilter('dateFrom'); clearFilter('dateTo') }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground">
        Clear all
      </Button>
    </div>
  )
}
