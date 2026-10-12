import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'
import { usePossibleDuplicates, type DuplicateGroup, type DuplicateMember } from '@/hooks/usePossibleDuplicates'
import { DuplicateCandidateDialog } from './DuplicateCandidateDialog'
import { performMerge, performNotDuplicatePair } from './mergeActions'
import type { Resolution } from './types'

/**
 * Possible duplicates (Find Phase 1, 2026-10-12): records already in Gio that
 * share an Apollo id, a LinkedIn profile or an email, or a phone and a name.
 * Each pair opens the duplicate dialog in record-to-record mode: merge moves
 * the second record's applications, notes and files onto the keeper; "Not
 * the same person" stops the pair being raised again.
 */
export function PossibleDuplicatesCard({ tenantId }: { tenantId: string | null | undefined }) {
  const queryClient = useQueryClient()
  const { data: groups = [], isLoading } = usePossibleDuplicates(tenantId)
  const [open, setOpen] = useState(false)
  const [review, setReview] = useState<{ group: DuplicateGroup; other: DuplicateMember } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isLoading || groups.length === 0) return null

  const people = groups.reduce((n, g) => n + g.others.length + 1, 0)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['possible-duplicates', tenantId] })
    queryClient.invalidateQueries({ queryKey: ['candidates'] })
    queryClient.invalidateQueries({ queryKey: ['independent-candidates'] })
  }

  const handleMerge = async (resolutions: Record<string, Resolution>) => {
    if (!review) return
    setSubmitting(true)
    try {
      const { data: other } = await supabase
        .from('candidates').select('*').eq('id', review.other.id).single()
      await performMerge({
        existingCandidateId: review.group.keeper.id,
        incoming: other ?? {},
        resolutions,
        mergedCandidateId: review.other.id,
      })
      toast({ title: 'Records merged', description: `${review.other.candidate_name}'s applications, notes and files are now on one record.` })
      setReview(null)
      refresh()
    } catch {
      toast({ title: "Couldn't merge the records", description: 'Nothing changed. Try again in a moment.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleNotDuplicate = async () => {
    if (!review) return
    setSubmitting(true)
    try {
      await performNotDuplicatePair({ candidateId: review.group.keeper.id, otherCandidateId: review.other.id })
      toast({ title: 'Kept as two people', description: "This pair won't be raised again." })
      setReview(null)
      refresh()
    } catch {
      toast({ title: "Couldn't save that", description: 'Try again in a moment.', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="flex items-center justify-between gap-3 bg-surface-primary border border-virgilio-border rounded-2xl shadow-sm px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Copy className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
          <p className="text-[13px] text-text-primary truncate">
            <span className="font-medium tabular-nums">{people}</span> candidates may be the same person as someone else
            <span className="text-text-tertiary"> · {groups.length} {groups.length === 1 ? 'group' : 'groups'}</span>
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Review</Button>
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Possible duplicates</SheetTitle>
            <SheetDescription>
              Records that share an Apollo id, a LinkedIn profile or an email, or a phone and a name. Merge them, or keep them as two people.
            </SheetDescription>
          </SheetHeader>

          <ul className="mt-4 divide-y divide-border/60">
            {groups.map((g) => (
              <li key={g.key} className="py-3 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {g.reasons.map((r) => (
                    <Badge key={r} tone={g.strength === 'strong' ? 'green' : 'yellow'} size="xs">{r}</Badge>
                  ))}
                  {g.others.length > 1 && <Badge tone="neutral" size="xs">{g.others.length + 1} records</Badge>}
                </div>
                <MemberLine member={g.keeper} note="Keeps" />
                {g.others.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3">
                    <MemberLine member={o} />
                    <Button size="sm" variant="secondary" onClick={() => setReview({ group: g, other: o })}>
                      Compare
                    </Button>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>

      {review && (
        <DuplicateCandidateDialog
          isOpen
          mode="records"
          matchReasons={review.group.reasons}
          existingCandidateId={review.group.keeper.id}
          incoming={review.other as unknown as Record<string, unknown>}
          incomingFileName={`${review.other.candidate_name || 'Unnamed candidate'} · the other record`}
          incomingProvenance={`Added ${new Date(review.other.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${review.other.source ? ` · ${review.other.source}` : ''}${review.other.applications ? ` · ${review.other.applications} application${review.other.applications === 1 ? '' : 's'}` : ''}`}
          isSubmitting={submitting}
          onCancel={() => setReview(null)}
          onMerge={handleMerge}
          onNotDuplicate={handleNotDuplicate}
        />
      )}
    </>
  )
}

function MemberLine({ member, note }: { member: DuplicateMember; note?: string }) {
  const detail = [member.role_current, member.company_current].filter(Boolean).join(' at ')
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-text-primary truncate">
        <span className="font-medium">{member.candidate_name || 'Unnamed candidate'}</span>
        {note && <span className="text-text-tertiary text-[11.5px]"> · {note}</span>}
      </p>
      <p className="text-[11.5px] text-text-tertiary truncate">
        {[detail, member.email, member.applications ? `${member.applications} application${member.applications === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}
      </p>
    </div>
  )
}
