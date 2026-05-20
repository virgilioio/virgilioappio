import { Users, ListChecks, Mail, Heart, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface KpiChipProps {
  icon: typeof Users
  label: string
  value: number | undefined
  active: boolean
  loading: boolean
  onClick: () => void
  tone?: 'default' | 'pink' | 'purple'
}

function KpiChip({ icon: Icon, label, value, active, loading, onClick, tone = 'default' }: KpiChipProps) {
  const toneClass = {
    default: 'text-text-secondary',
    pink: 'text-pastel-pink-foreground',
    purple: 'text-virgilio-purple',
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group inline-flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-lg transition-colors',
        'text-[13px] font-poppins font-medium tracking-[-0.005em]',
        active ? 'bg-virgilio-purple/10 text-virgilio-purple' : 'hover:bg-[#F1F0EC] text-text-primary',
      )}
    >
      <Icon className={cn('h-4 w-4', active ? 'text-virgilio-purple' : toneClass)} />
      <span className="tabular-nums">{loading ? '—' : (value ?? 0).toLocaleString()}</span>
      <span className="text-text-tertiary font-normal">{label}</span>
    </button>
  )
}

export function CandidatesHeader({
  kpis, isLoading, activeSmartList, onSelectSmartList,
  onAddCandidate, onImportCSV, onBulkUpload,
}: CandidatesHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-h1 text-text-primary">Candidates</h1>
          <span className="font-poppins text-[15px] text-text-tertiary tabular-nums">
            {isLoading ? '—' : (kpis?.total ?? 0).toLocaleString()}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <KpiChip
            icon={ListChecks}
            label="in active pipeline"
            value={kpis?.inActivePipeline}
            active={activeSmartList === 'active'}
            loading={isLoading}
            onClick={() => onSelectSmartList('active')}
          />
          <KpiChip
            icon={Mail}
            label="awaiting outreach"
            value={kpis?.awaitingOutreach}
            active={activeSmartList === 'awaiting'}
            loading={isLoading}
            onClick={() => onSelectSmartList('awaiting')}
          />
          <KpiChip
            icon={Heart}
            label="favorites"
            value={kpis?.favorites}
            active={activeSmartList === 'favorites'}
            loading={isLoading}
            onClick={() => onSelectSmartList('favorites')}
            tone="pink"
          />
          <KpiChip
            icon={Sparkles}
            label="new this week"
            value={kpis?.newThisWeek}
            active={activeSmartList === 'new'}
            loading={isLoading}
            onClick={() => onSelectSmartList('new')}
            tone="purple"
          />
        </div>
      </div>

      <PermissionGate permission="canManageCandidates">
        <div className="flex items-center gap-2 shrink-0">
          {onImportCSV && (
            <Button variant="secondary" onClick={onImportCSV} className="hidden sm:inline-flex">
              Import CSV
            </Button>
          )}
          {onBulkUpload && (
            <Button variant="secondary" onClick={onBulkUpload} className="hidden sm:inline-flex">
              Bulk upload
            </Button>
          )}
          <Button onClick={onAddCandidate}>+ Add candidate</Button>
        </div>
      </PermissionGate>
    </div>
  )
}
