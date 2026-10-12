import { useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SidebarBlock } from '@/components/candidates/profile/primitives/ProfileSidebar'
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames'
import { cn } from '@/lib/utils'
import {
  ageLabel, asProvenance, isStale, lastKnown, newestEntry, sourceLabel,
  type FieldProvenanceEntry,
} from '@/lib/fieldProvenance'

/**
 * Where each profile field came from and how old it is, plus "Refresh ·
 * 1 credit" (Find Phase 3, 2026-10-12). Refresh asks Apollo for the person
 * again (no phone) through refresh-candidate-profiles; a recruiter's edits
 * are never replaced, and a job change updates the work history and tells
 * the people who have them in a pipeline or shortlist.
 */

interface CandidateLike {
  id: string
  apollo_id?: string | null
  linkedin_url?: string | null
  email?: string | null
  field_provenance?: unknown
  profile_refreshed_at?: string | null
}

const ROWS: { label: string; fields: string[] }[] = [
  { label: 'Title', fields: ['current_job_title', 'role_current'] },
  { label: 'Company', fields: ['company_current'] },
  { label: 'Location', fields: ['location_city', 'location_state', 'location_country'] },
  { label: 'Email', fields: ['email'] },
  { label: 'Phone', fields: ['phone'] },
  { label: 'LinkedIn', fields: ['linkedin_url'] },
  { label: 'Salary', fields: ['salary_amount'] },
]

const FIELD_NAMES: Record<string, string> = {
  current_job_title: 'title', role_current: 'title', company_current: 'company',
  location_city: 'city', location_state: 'state', location_country: 'country',
  bio: 'headline', salary_amount: 'salary',
}

interface RefreshResponse {
  matched?: boolean
  applied?: string[]
  kept?: Record<string, string>
  job_change?: { kind: 'job' | 'role'; new_title: string | null; new_company: string | null } | null
  credits_used?: number
  already_fresh?: boolean
  error?: string
  error_code?: string
}

function list(names: string[]): string {
  const uniq = [...new Set(names)]
  if (uniq.length <= 1) return uniq[0] ?? ''
  return `${uniq.slice(0, -1).join(', ')} and ${uniq[uniq.length - 1]}`
}

export function DataSourcesBlock({
  candidate,
  onRefreshed,
}: {
  candidate: CandidateLike
  /** Called after a refresh changed something (reload work history and the like). */
  onRefreshed?: () => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const prov = asProvenance(candidate.field_provenance)

  const rows = useMemo(
    () => ROWS
      .map((r) => ({ label: r.label, entry: newestEntry(prov, r.fields) }))
      .filter((r): r is { label: string; entry: FieldProvenanceEntry } => !!r.entry),
    [prov],
  )
  const { getName } = useUserDisplayNames(rows.map((r) => (r.entry.src === 'person' ? r.entry.by : null)))

  const canMatch = !!(candidate.apollo_id || candidate.linkedin_url || candidate.email)
  const refreshedAt = candidate.profile_refreshed_at ? new Date(candidate.profile_refreshed_at) : null

  const refresh = useMutation({
    mutationFn: async (): Promise<RefreshResponse> => {
      const { data, error } = await supabase.functions.invoke('refresh-candidate-profiles', {
        body: { candidate_id: candidate.id },
      })
      if (error) {
        // The function's own message, when it sent one.
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          try { return (await ctx.json()) as RefreshResponse } catch { /* fall through */ }
        }
        throw error
      }
      return data as RefreshResponse
    },
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error_code === 'CREDITS_EXHAUSTED' ? 'No Apollo credits left this cycle' : "Couldn't refresh", {
          description: res.error_code === 'CREDITS_EXHAUSTED' ? 'Credits renew with the Apollo plan.' : res.error,
        })
        return
      }
      queryClient.invalidateQueries({ queryKey: ['independent-candidate', candidate.id] })
      queryClient.invalidateQueries({ queryKey: ['independent-candidates'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed', candidate.id] })

      if (res.already_fresh) {
        toast('Refreshed a few minutes ago', { description: 'No credit used.' })
        return
      }
      if (!res.matched) {
        toast("Apollo couldn't find this person", {
          description: res.credits_used ? `${res.credits_used} credit used.` : 'No credit used.',
        })
        return
      }
      const kept = Object.keys(res.kept ?? {}).map((k) => FIELD_NAMES[k] ?? k)
      const applied = (res.applied ?? []).filter((k) => k !== 'role_current').map((k) => FIELD_NAMES[k] ?? k.replace(/_/g, ' '))
      const keptLine = kept.length ? ` Kept your edits to ${list(kept)}.` : ''
      if (res.job_change) {
        const jc = res.job_change
        toast(jc.kind === 'job' ? `Moved to ${jc.new_company}` : `New role: ${jc.new_title}`, {
          description: `Work history updated, and the pipeline team was told.${keptLine}`,
        })
      } else if (applied.length) {
        toast('Profile refreshed', { description: `Updated ${list(applied)}.${keptLine}` })
      } else {
        toast('Profile is up to date', { description: `Apollo has nothing newer.${keptLine}` })
      }
      if (applied.length || res.job_change) onRefreshed?.()
    },
    onError: () => {
      toast.error("Couldn't refresh", { description: 'Apollo didn’t answer. Try again in a minute.' })
    },
  })

  const button = (
    <Button
      variant="ghost"
      size="xs"
      icon={RefreshCw}
      loading={refresh.isPending}
      disabled={!canMatch}
      onClick={() => refresh.mutate()}
    >
      Refresh · 1 credit
    </Button>
  )

  return (
    <SidebarBlock
      label="Sources"
      action={canMatch ? button : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>{button}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Add a LinkedIn URL or an email so Apollo can find them</TooltipContent>
        </Tooltip>
      )}
    >
      <div>
        {rows.length === 0 ? (
          <p className="font-inter text-[11.5px] text-[#6B7080] py-2">Nothing recorded yet.</p>
        ) : rows.map(({ label, entry }) => {
          const when = lastKnown(entry)
          const age = ageLabel(when)
          const who = entry.src === 'person'
            ? (entry.by && entry.by === user?.id ? 'Edited by you' : entry.by && getName(entry.by) ? `Edited by ${getName(entry.by)}` : 'Edited by a teammate')
            : sourceLabel(entry.src)
          const stale = isStale(when) && entry.src !== 'person'
          return (
            <div key={label} className="flex items-center gap-2 py-1.5 border-b border-[#F6F5F1] last:border-b-0">
              <span className="font-inter text-[11.5px] text-[#5A6072] min-w-[70px]">{label}</span>
              <span className={cn('ml-auto font-inter text-[11.5px] text-right truncate', stale ? 'text-[#B45309]' : 'text-[#6B7080]')}>
                {who}{age ? ` · ${age}` : ''}
              </span>
            </div>
          )
        })}
        <p className="font-inter text-[11.5px] text-[#6B7080] pt-2">
          {refreshedAt
            ? `Checked with Apollo ${ageLabel(refreshedAt)}`
            : 'Not checked with Apollo yet'}
        </p>
      </div>
    </SidebarBlock>
  )
}
