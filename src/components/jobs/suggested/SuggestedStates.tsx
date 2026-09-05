import * as React from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SoftFind, SoftMagnifier } from '@/components/ui/EmptyIllustrations'
import type { SuggestedFilter } from './suggestedFilters'

const inter = "'Inter', system-ui, sans-serif"
const poppins = "'Poppins', system-ui, sans-serif"

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        padding: '48px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}

const Title = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      marginTop: 16,
      fontFamily: poppins,
      fontSize: 15,
      fontWeight: 600,
      letterSpacing: '-0.02em',
      color: '#0d0d09',
    }}
  >
    {children}
  </div>
)

const Body = ({ children }: { children: React.ReactNode }) => (
  <div style={{ marginTop: 6, maxWidth: 420, fontFamily: inter, fontSize: 12.5, color: '#5A6072' }}>
    {children}
  </div>
)

/** True empty: the matcher ran and found nothing. Never prints a count. */
export function SuggestedEmpty({
  onRefresh,
  onEditRequirements,
}: {
  onRefresh: () => void
  onEditRequirements?: () => void
}) {
  return (
    <Shell>
      <SoftFind />
      <Title>No suggestions for this job yet</Title>
      <Body>
        Gio compared your database against this job's requirements and found no meaningful overlap.
        Broadening the requirements or sourcing new profiles usually changes that.
      </Body>
      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        {onEditRequirements && (
          <Button size="sm" variant="secondary" onClick={onEditRequirements}>
            Review requirements
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRefresh}>
          Run again
        </Button>
      </div>
    </Shell>
  )
}

/** Filtered empty: suggestions exist, the filters hid them all. */
export function SuggestedNoResults({
  total,
  filters,
  onRemoveFilter,
  onClearFilters,
}: {
  total: number
  filters: SuggestedFilter[]
  onRemoveFilter: (id: string) => void
  onClearFilters: () => void
}) {
  return (
    <Shell>
      <SoftMagnifier />
      <Title>No suggestions match your filters</Title>
      <Body>
        {total} {total === 1 ? 'suggestion is' : 'suggestions are'} hidden. Remove a filter to see them.
      </Body>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 6,
          marginTop: 16,
        }}
      >
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onRemoveFilter(f.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 9px',
              borderRadius: 999,
              background: '#EDE4FF',
              border: '1px solid #D7C5FB',
              fontFamily: inter,
              fontSize: 11.5,
              color: '#6F3FF5',
              cursor: 'pointer',
            }}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30"
          >
            <span>{f.label}</span>
            {f.value && <span style={{ color: '#4B2BB0', fontWeight: 600 }}>{f.value}</span>}
            <X size={10} strokeWidth={2.2} />
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <Button size="sm" variant="ghost" onClick={onClearFilters}>
          Clear all filters
        </Button>
      </div>
    </Shell>
  )
}

/** Everything reviewed — the list was cleared by the recruiter, not by filters. */
export function SuggestedCleared({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Shell>
      <SoftFind />
      <Title>You've reviewed every suggestion</Title>
      <Body>Nothing left in this batch. Gio will suggest more as your database grows.</Body>
      <div style={{ marginTop: 18 }}>
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRefresh}>
          Run again
        </Button>
      </div>
    </Shell>
  )
}
