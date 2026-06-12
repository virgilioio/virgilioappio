import { useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronsUpDown, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useCandidateJobAssociations, type CandidateJobAssociation } from '@/hooks/useCandidateJobAssociations'

interface ApplicationSwitcherProps {
  candidateId: string
  candidateFirstName?: string | null
  currentJobId: string
  currentJobTitle?: string | null
}

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function isClosed(status: string | null) {
  const s = (status || '').toLowerCase()
  return s === 'hired' || s === 'rejected' || s === 'withdrawn'
}

function isActive(status: string | null) {
  return !isClosed(status)
}

function rowStatus(a: CandidateJobAssociation): { tone: 'purple' | 'green' | 'neutral' | 'orange'; label: string } {
  const s = (a.status || '').toLowerCase()
  if (s === 'hired') return { tone: 'green', label: 'Hired' }
  if (s === 'rejected') return { tone: 'neutral', label: 'Rejected' }
  if (s === 'withdrawn') return { tone: 'neutral', label: 'Withdrawn' }
  if (s === 'offer') return { tone: 'purple', label: 'Offer' }
  const stageName = a.current_stage?.custom_stage_name || a.current_stage?.stage?.stage_name || 'Active'
  return { tone: 'purple', label: stageName }
}

function closedDate(a: CandidateJobAssociation): string | null {
  return a.hired_at || a.rejected_at || null
}

export function ApplicationSwitcher({
  candidateId,
  candidateFirstName,
  currentJobId,
  currentJobTitle,
}: ApplicationSwitcherProps) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { jobAssociations } = useCandidateJobAssociations(candidateId)

  const ordered = useMemo(() => {
    const list = [...jobAssociations]
    const current = list.find((a) => a.job_id === currentJobId) || null
    const others = list.filter((a) => a.job_id !== currentJobId)
    const active = others
      .filter((a) => isActive(a.status))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    const closed = others
      .filter((a) => isClosed(a.status))
      .sort((a, b) => (closedDate(b) || b.created_at || '').localeCompare(closedDate(a) || a.created_at || ''))
    return { current, rows: [...(current ? [current] : []), ...active, ...closed] }
  }, [jobAssociations, currentJobId])

  const total = ordered.rows.length || 1
  const firstNameUpper = (candidateFirstName || 'Candidate').toUpperCase()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Switch application"
          className="inline-flex items-center gap-1 px-1 py-0.5 rounded-md hover:bg-[#F6F5F1] transition-colors max-w-[280px] cursor-pointer"
          style={{ padding: '2px 4px', borderRadius: 6 }}
        >
          <span className="font-inter font-semibold text-[12.5px] text-[#1F2230] truncate">
            {currentJobTitle || 'Job'}
          </span>
          <ChevronsUpDown className="h-[11px] w-[11px] text-[#8B8F9E] shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0 w-[330px] bg-white rounded-[12px] border border-[#E7E8EE] overflow-hidden"
        style={{ boxShadow: '0 16px 40px -12px rgba(13,13,9,0.25)' }}
      >
        {/* Header */}
        <div className="px-[14px] pt-[10px] pb-[6px]">
          <h3 className="font-inter font-semibold text-[10px] uppercase tracking-[0.08em] text-[#8B8F9E]">
            {firstNameUpper}'s applications ({total})
          </h3>
        </div>

        {/* Rows */}
        <ul className="divide-y divide-[#F1F0EC] max-h-[360px] overflow-y-auto">
          {ordered.rows.map((a) => {
            const isCurrent = a.job_id === currentJobId
            const chip = rowStatus(a)
            const closed = isClosed(a.status)
            const dateLabel = closed ? fmtDate(closedDate(a) || a.created_at) : fmtDate(a.created_at)
            const datePrefix = closed
              ? (a.status === 'hired' ? 'Hired' : a.status === 'rejected' ? 'Rejected' : 'Closed')
              : 'Applied'
            const dept = a.job?.department || a.job?.organization?.name || null
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    navigate(`/jobs/${a.job_id}/candidates/${candidateId}`)
                  }}
                  className={cn(
                    'w-full text-left flex items-center gap-2.5 px-[14px] py-[10px] transition-colors',
                    isCurrent ? 'bg-[#FAF8FF]' : 'bg-white hover:bg-[#FAFAF7]',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'font-inter text-[12.5px] truncate',
                      isCurrent ? 'font-semibold text-[#1F2230]' : 'font-medium text-[#1F2230]',
                    )}>
                      {a.job?.title || 'Untitled job'}
                    </div>
                    <div className="font-inter text-[11px] text-[#8B8F9E] mt-0.5 truncate">
                      {[dept, dateLabel ? `${datePrefix} ${dateLabel}` : null].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge tone={chip.tone} size="xs" dot>{chip.label}</Badge>
                    {isCurrent && <Check className="h-[13px] w-[13px] text-virgilio-purple" />}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>

        {/* Footer */}
        <Link
          to={`/candidates/${candidateId}`}
          onClick={() => setOpen(false)}
          className="flex items-center justify-between gap-2 px-[14px] py-[10px] border-t border-[#F1F0EC] bg-[#FAFAF7] hover:bg-[#F1F0EC] transition-colors"
        >
          <span className="inline-flex items-center gap-1.5">
            <User className="h-[13px] w-[13px] text-virgilio-purple" />
            <span className="font-inter font-semibold text-[12px] text-virgilio-purple">View independent profile</span>
          </span>
          <ArrowRight className="h-[13px] w-[13px] text-virgilio-purple" />
        </Link>
      </PopoverContent>
    </Popover>
  )
}

export default ApplicationSwitcher
