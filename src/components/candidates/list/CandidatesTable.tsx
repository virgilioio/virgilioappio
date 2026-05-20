import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MoreHorizontal, Eye, Trash2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { IdentityCell, NumericCell, ActionCell } from '@/components/ui/table-cells'
import { TableSkeleton, TableFilteredEmpty, TableEmpty } from '@/components/ui/table-states'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { IndependentCandidate } from '@/hooks/useIndependentCandidates'
import type { AssociationsMap, AssociationDetail } from '@/hooks/useCandidateJobAssociations'

interface CandidatesTableProps {
  candidates: IndependentCandidate[]
  totalCount: number
  associationsMap: AssociationsMap
  isLoading: boolean
  /** True while a boolean/AI search is being committed — show skeleton on top of existing rows. */
  isSearching?: boolean
  hasActiveFilters: boolean
  selectedIds: string[]
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onOpenCandidate: (id: string) => void
  onDelete: (candidate: IndependentCandidate) => void
}

const SOURCE_TONE: Record<string, { letter: string; tone: 'green' | 'blue' | 'purple' | 'orange' | 'neutral' | 'pink' }> = {
  referral: { letter: 'R', tone: 'green' },
  linkedin: { letter: 'L', tone: 'blue' },
  apollo: { letter: 'A', tone: 'orange' },
  careers: { letter: 'C', tone: 'purple' },
  career_page: { letter: 'C', tone: 'purple' },
  manual: { letter: 'M', tone: 'neutral' },
}

function SourceCell({ source }: { source: string | null }) {
  const key = (source ?? 'manual').toLowerCase().replace(/\s+/g, '_')
  const meta = SOURCE_TONE[key] ?? { letter: source?.[0]?.toUpperCase() ?? '—', tone: 'neutral' as const }
  const toneCls = {
    green: 'bg-pastel-green text-pastel-green-foreground',
    blue: 'bg-pastel-blue text-pastel-blue-foreground',
    purple: 'bg-pastel-purple text-pastel-purple-foreground',
    orange: 'bg-pastel-orange text-pastel-orange-foreground',
    pink: 'bg-pastel-pink text-pastel-pink-foreground',
    neutral: 'bg-muted text-muted-foreground',
  }[meta.tone]
  const label = source ? source.charAt(0).toUpperCase() + source.slice(1) : '—'
  return (
    <div className="inline-flex items-center gap-2">
      <span className={cn('inline-flex items-center justify-center h-6 w-6 rounded-md text-[11px] font-poppins font-semibold', toneCls)}>
        {meta.letter}
      </span>
      <span className="text-[12.5px] text-text-secondary">{label}</span>
    </div>
  )
}

function SkillsCell({ skills }: { skills: string[] }) {
  const visible = skills.slice(0, 2)
  const extra = skills.length - visible.length
  if (skills.length === 0) return <span className="text-text-tertiary">—</span>
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map(s => (
        <Badge key={s} tone="lilac" size="xs" shape="square">{s}</Badge>
      ))}
      {extra > 0 && <Badge tone="neutral" size="xs" shape="square">+{extra}</Badge>}
    </div>
  )
}

function PipelineCell({ assocs, onNavigateJob }: { assocs: AssociationDetail[] | undefined; onNavigateJob: (jobId: string) => void }) {
  if (!assocs || assocs.length === 0) {
    return <span className="text-[12.5px] text-text-tertiary">Not in pipeline</span>
  }
  const a = assocs[0]
  const status = (a.pipelineStatus ?? '').toLowerCase()
  const tone =
    status === 'rejected' ? 'red'
    : status === 'hired' ? 'green'
    : status === 'offer' ? 'purple'
    : 'blue'
  const label = a.stageName ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'In pipeline')
  const extra = assocs.length - 1
  return (
    <div className="space-y-0.5 min-w-0">
      <div className="flex items-center gap-2">
        <Badge tone={tone as any} size="xs" dot>{label}</Badge>
        {extra > 0 && <span className="text-[11px] text-text-tertiary">+{extra}</span>}
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onNavigateJob(a.jobId) }}
        className="text-[12px] font-inter text-text-secondary hover:text-virgilio-purple truncate max-w-[200px] text-left"
        title={a.jobTitle}
      >
        {a.jobTitle}
      </button>
    </div>
  )
}

function AiFitCell({ assocs }: { assocs: AssociationDetail[] | undefined }) {
  const score = (assocs?.[0] as any)?.aiFitScore as number | null | undefined
  if (score == null) return <span className="text-text-tertiary">—</span>
  const color = score >= 85 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-text-secondary'
  return (
    <div className="flex items-center gap-2">
      <span className={cn('font-poppins font-semibold text-[13.5px] tabular-nums', color)}>{score}</span>
      <svg width="24" height="12" viewBox="0 0 24 12" className={color} fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="0,9 6,7 12,4 18,5 24,2" />
      </svg>
    </div>
  )
}

function relativeTime(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000
  if (d < 1) return 'today'
  if (d < 7) return `${Math.floor(d)}d`
  if (d < 30) return `${Math.floor(d / 7)}w`
  if (d < 365) return `${Math.floor(d / 30)}mo`
  return `${Math.floor(d / 365)}y`
}

function isNew(iso: string): boolean {
  return (Date.now() - new Date(iso).getTime()) / 86400000 <= 7
}

export function CandidatesTable({
  candidates, totalCount, associationsMap, isLoading, isSearching, hasActiveFilters,
  selectedIds, onToggleSelect, onToggleSelectAll, onOpenCandidate, onDelete,
}: CandidatesTableProps) {
  const navigate = useNavigate()
  const allSelected = useMemo(
    () => candidates.length > 0 && candidates.every(c => selectedIds.includes(c.id)),
    [candidates, selectedIds],
  )

  if (isLoading || isSearching) return <TableSkeleton rows={8} columns={9} />
  if (candidates.length === 0) {
    return hasActiveFilters
      ? <TableFilteredEmpty colSpan={9} onClearFilters={() => { /* handled by parent */ }} />
      : <TableEmpty colSpan={9} title="No candidates yet" description="Add your first candidate to get started." />
  }

  return (
    <Table density="default">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} aria-label="Select all" />
          </TableHead>
          <TableHead>Candidate</TableHead>
          <TableHead>Skills</TableHead>
          <TableHead>Pipeline / Job</TableHead>
          <TableHead>AI Fit</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Added</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((c) => {
          const skills = (c.standardized_skills?.length ? c.standardized_skills : c.skills) ?? []
          const assocs = associationsMap.get(c.id)
          const isFav = !!(assocs?.some(a => (a as any).isFavorite))
          const loc = [c.location_city, c.location_country].filter(Boolean).join(', ') || '—'
          const selected = selectedIds.includes(c.id)
          return (
            <TableRow
              key={c.id}
              interactive
              className={cn('cursor-pointer group', selected && 'bg-[#FAF8FF]')}
              onClick={() => onOpenCandidate(c.id)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(c.id)} aria-label={`Select ${c.candidate_name}`} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 min-w-0">
                  <IdentityCell
                    name={
                      <span className="inline-flex items-center gap-1.5">
                        <span className="truncate">{c.candidate_name}</span>
                        {isFav && <Heart className="h-3 w-3 text-pastel-pink-foreground fill-pastel-pink-foreground" />}
                        {isNew(c.created_at) && <Badge tone="green" size="xs" shape="pill">New</Badge>}
                      </span>
                    }
                    sub={c.current_job_title || c.company_current || c.email || '—'}
                  />
                </div>
              </TableCell>
              <TableCell><SkillsCell skills={skills} /></TableCell>
              <TableCell><PipelineCell assocs={assocs} onNavigateJob={(jobId) => navigate(`/jobs/${jobId}`)} /></TableCell>
              <TableCell><AiFitCell assocs={assocs} /></TableCell>
              <TableCell><span className="text-[12.5px] text-text-secondary">{loc}</span></TableCell>
              <TableCell><SourceCell source={c.source} /></TableCell>
              <TableCell>
                <span className="text-[12.5px] text-text-secondary tabular-nums">{relativeTime(c.created_at)}</span>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()} className="w-[32px] text-right">
                <ActionCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="xs" iconOnly icon={MoreHorizontal} aria-label="Candidate actions" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onSelect={() => onOpenCandidate(c.id)}>
                        <Eye className="h-3.5 w-3.5" /> <span>View profile</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => onDelete(c)}
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ActionCell>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
