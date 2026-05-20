import { Users, ListChecks, Mail, Heart, Sparkles, MoreHorizontal, Upload, FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
        'group inline-flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-lg transition-colors',
        'text-[13px] font-poppins font-medium tracking-[-0.005em]',
        active
          ? 'bg-virgilio-purple/10 text-virgilio-purple'
          : 'hover:bg-[#F1F0EC] text-text-primary',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', active ? 'text-virgilio-purple' : toneClass)} />
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
        <div className="mt-2 flex flex-wrap items-center gap-1">
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
            <Button variant="secondary" onClick={onImportCSV} className="hidden lg:inline-flex">
              Import CSV
            </Button>
          )}
          {onBulkUpload && (
            <Button variant="secondary" onClick={onBulkUpload} className="hidden lg:inline-flex">
              Bulk upload
            </Button>
          )}
          <Button variant="primary" onClick={onAddCandidate}>+ Add candidate</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" iconOnly={MoreHorizontal} aria-label="More actions" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8}>
              {onImportCSV && (
                <DropdownMenuItem onSelect={onImportCSV} className="lg:hidden">
                  <Upload className="h-4 w-4" />
                  Import CSV
                </DropdownMenuItem>
              )}
              {onBulkUpload && (
                <DropdownMenuItem onSelect={onBulkUpload} className="lg:hidden">
                  <FileUp className="h-4 w-4" />
                  Bulk upload
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={onAddCandidate} className="lg:hidden">
                <Users className="h-4 w-4" />
                Add candidate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PermissionGate>
    </header>
  )
}
