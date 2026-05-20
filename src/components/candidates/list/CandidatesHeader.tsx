import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { cn } from '@/lib/utils'
import type { CandidateKpis } from '@/hooks/useCandidateKpis'

export type SmartListKey = 'all' | 'active' | 'awaiting' | 'favorites' | 'new'

interface CandidatesHeaderProps {
  kpis: CandidateKpis | undefined
  isLoading: boolean
  activeSmartList: SmartListKey | null
  onSelectSmartList: (key: SmartListKey) => void
  onAddCandidate: () => void
  onImportCSV?: () => void
  onBulkUpload?: () => void
}

interface CounterProps {
  dotClass: string
  value: number | undefined
  label: string
  loading: boolean
  active: boolean
  onClick: () => void
}

function CounterMarker({ dotClass, value, label, loading, active, onClick }: CounterProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 transition-colors',
        active ? 'text-text-primary font-semibold' : 'text-text-secondary hover:text-text-primary',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
      <span className="tabular-nums">{loading ? '—' : (value ?? 0).toLocaleString()}</span>
      <span className="font-normal text-text-tertiary">{label}</span>
    </button>
  )
}

export function CandidatesHeader({
  kpis, isLoading, activeSmartList, onSelectSmartList,
  onAddCandidate, onImportCSV, onBulkUpload,
}: CandidatesHeaderProps) {
  return (
    <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h1 className="font-poppins font-semibold tracking-[-0.04em] text-text-primary text-[28px] leading-tight sm:text-[32px]">
            Candidates<span className="text-virgilio-purple">.</span>
          </h1>
          <Badge tone="neutral" size="sm">
            {isLoading ? '—' : (kpis?.total ?? 0).toLocaleString()}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-text-secondary">
          <CounterMarker
            dotClass="bg-pastel-green-foreground"
            value={kpis?.inActivePipeline}
            label="in active pipeline"
            loading={isLoading}
            active={activeSmartList === 'active'}
            onClick={() => onSelectSmartList('active')}
          />
          <CounterMarker
            dotClass="bg-text-tertiary"
            value={kpis?.awaitingOutreach}
            label="awaiting outreach"
            loading={isLoading}
            active={activeSmartList === 'awaiting'}
            onClick={() => onSelectSmartList('awaiting')}
          />
          <CounterMarker
            dotClass="bg-pastel-pink-foreground"
            value={kpis?.favorites}
            label="favorites"
            loading={isLoading}
            active={activeSmartList === 'favorites'}
            onClick={() => onSelectSmartList('favorites')}
          />
          <CounterMarker
            dotClass="bg-virgilio-purple"
            value={kpis?.newThisWeek}
            label="new this week"
            loading={isLoading}
            active={activeSmartList === 'new'}
            onClick={() => onSelectSmartList('new')}
          />
        </div>
      </div>

      <PermissionGate permission="canManageCandidates">
        <div className="flex items-center gap-2 shrink-0">
          {onImportCSV && (
            <Button variant="secondary" onClick={onImportCSV} className="hidden lg:inline-flex">
              Import CSV
            </Button>
          )}
          {onBulkUpload && (
            <Button variant="secondary" onClick={onBulkUpload} className="hidden lg:inline-flex">
              Bulk upload
            </Button>
          )}
          <Button variant="primary" icon={Users} onClick={onAddCandidate}>Add candidate</Button>
        </div>
      </PermissionGate>
    </header>
  )
}
