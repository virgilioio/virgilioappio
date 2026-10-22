import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ConfirmDestructiveDialog } from '@/components/ui/confirm-destructive'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { jobTeamError } from '@/hooks/useJobAssignments'
import { supabase } from '@/integrations/supabase/client'
import {
  JOB_SEAT_LABEL,
  appName,
  handOverSeats,
  personName,
  personState,
  roleLabel,
  syncNow,
  useApplyBundle,
  useBundles,
  usePeople,
  type Person,
} from '@/lib/os/peopleAccess'

type StepName = 'ats' | 'apps' | 'signout' | 'google'
type Step = { status: 'done' | 'error'; at: string; detail?: string }
type Offboarding = {
  id: string
  started_at: string
  finished_at: string | null
  reactivated_at: string | null
  steps: Partial<Record<StepName, Step>>
}
type Preview = {
  seats: { job_id: string; title: string; status: string; role: string }[]
  apps: { app: string; role: string }[]
  google: { mail: number; calendar: number }
}

const STEPS: { key: StepName; label: string }[] = [
  { key: 'ats', label: 'Removed from job teams and the ATS' },
  { key: 'apps', label: 'Gio Sales and Gio Docs access removed' },
  { key: 'signout', label: 'Signed out, sign-in blocked' },
  { key: 'google', label: 'Google connection revoked' },
]

const NO_ROLE = '__none__'
const NO_ONE = '__no_one__'

function when(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Runs (or resumes) offboarding. The database decides who may; failures stay on the card. */
async function runOffboard(tenantId: string, userId: string) {
  const { data, error } = await supabase.functions.invoke('os-offboard', { body: { tenant_id: tenantId, user_id: userId } })
  if (error) {
    let message = "Couldn't start offboarding. Try again."
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.error) message = body.error
    } catch { /* keep the generic message */ }
    throw new Error(message)
  }
  return data as { ok: boolean }
}

/**
 * The member profile's Danger zone: one-click offboarding (design Part D). The
 * dialog says what changes, lets the admin hand each open or draft job seat to
 * someone else, and asks for the person's name (Pattern 2); the card then lists
 * each step with its result. A step that failed keeps a Retry, which repeats
 * only what isn't done. Bring back lives here too.
 */
export function DangerZone({ person, tenantId, isSelf }: { person: Person; tenantId: string; isSelf: boolean }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const people = usePeople(tenantId)
  const [handover, setHandover] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [backOpen, setBackOpen] = useState(false)
  const [backRole, setBackRole] = useState<string>(person.bundle_id ?? NO_ROLE)
  const [backBusy, setBackBusy] = useState(false)
  const [backError, setBackError] = useState<string | null>(null)
  const bundles = useBundles(tenantId)
  const applyBundle = useApplyBundle(tenantId)
  const userId = person.user_id
  const name = personName(person)
  const first = name.split(' ')[0]
  const canOffboard = !!userId && !isSelf

  const latest = useQuery({
    queryKey: ['os-offboarding', tenantId, userId],
    enabled: !!userId,
    queryFn: async (): Promise<Offboarding | null> => {
      const { data, error } = await supabase
        .from('os_offboardings')
        .select('id, started_at, finished_at, reactivated_at, steps')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId!)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data as Offboarding | null) ?? null
    },
  })

  const preview = useQuery({
    queryKey: ['os-offboard-preview', tenantId, userId],
    enabled: open && !!userId,
    queryFn: async (): Promise<Preview> => {
      const { data, error } = await supabase.rpc('os_offboard_preview', { _tenant_id: tenantId, _user_id: userId! })
      if (error) throw error
      return data as unknown as Preview
    },
  })

  // Seats on open and draft jobs can go to someone else; closed jobs keep their history.
  const liveSeats = useMemo(
    () => (preview.data?.seats ?? []).filter((s) => s.status === 'open' || s.status === 'draft'),
    [preview.data],
  )
  const teams = useQuery({
    queryKey: ['os-offboard-teams', liveSeats.map((s) => s.job_id).join(',')],
    enabled: open && liveSeats.length > 0,
    queryFn: async () => {
      const ids = liveSeats.map((s) => s.job_id)
      const [seats, jobs] = await Promise.all([
        supabase.from('job_assignments').select('job_id, user_id').in('job_id', ids).is('deleted_at', null),
        supabase.from('jobs').select('id, organization_id').in('id', ids),
      ])
      if (seats.error) throw seats.error
      if (jobs.error) throw jobs.error
      const onJob = new Map<string, Set<string>>()
      for (const r of seats.data ?? []) {
        if (!onJob.has(r.job_id)) onJob.set(r.job_id, new Set())
        onJob.get(r.job_id)!.add(r.user_id)
      }
      return { onJob, orgOf: new Map((jobs.data ?? []).map((j) => [j.id, j.organization_id as string])) }
    },
  })
  const teammates = useMemo(
    () =>
      (people.data ?? [])
        .filter((p) => p.user_id && p.user_id !== userId && personState(p) === 'active')
        .sort((a, b) => personName(a).localeCompare(personName(b))),
    [people.data, userId],
  )

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['os-offboarding', tenantId, userId] })
    void qc.invalidateQueries({ queryKey: ['os-people', tenantId] })
    void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
  }

  if (!userId) return null
  const run = latest.data && !latest.data.reactivated_at ? latest.data : null
  const broughtBack = latest.data?.reactivated_at ?? null
  const offboarded = person.profile_status === 'offboarded'

  // Bring back: ATS membership and sign-in first, then the chosen job role,
  // which restores Gio Sales and Gio Docs access through the usual sending.
  const bringBack = async () => {
    if (backBusy) return
    setBackBusy(true)
    setBackError(null)
    try {
      const { error } = await supabase.functions.invoke('os-offboard', {
        body: { tenant_id: tenantId, user_id: userId, action: 'reactivate' },
      })
      if (error) {
        let message = "Couldn't bring them back. Try again."
        try {
          const body = await (error as { context?: Response }).context?.json()
          if (body?.error) message = body.error
        } catch { /* keep the generic message */ }
        throw new Error(message)
      }
      const bundle = (bundles.data ?? []).find((b) => b.id === backRole)
      if (bundle) {
        try {
          await applyBundle.mutateAsync({ person: { ...person, grants: [] }, bundle })
        } catch {
          toast(`${name} is back in the ATS, but the job role didn't apply. Apply it from this page.`)
        }
      } else {
        await syncNow(tenantId)
      }
      toast(`${name} is back`)
      setBackOpen(false)
    } catch (e) {
      setBackError((e as Error).message)
    } finally {
      setBackBusy(false)
      refresh()
    }
  }
  const failed = run ? STEPS.filter((s) => run.steps[s.key]?.status !== 'done') : []

  const retry = async () => {
    setRetrying(true)
    try {
      const res = await runOffboard(tenantId, userId)
      if (res.ok) toast(`${name} is offboarded`)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setRetrying(false)
      refresh()
    }
  }

  const p = preview.data
  const description = (
    <span className="block space-y-2">
      <span className="block">
        They lose access to Gio ATS, Gio Sales and Gio Docs, are signed out, and their Google connection is revoked.
        Their candidates, notes, deals and pages stay, under their name.
      </span>
      {preview.isLoading ? (
        <span className="block text-text-tertiary">Checking what they have…</span>
      ) : p ? (
        <span className="block">
          {p.seats.length > 0 && (
            <span className="block">
              Leaves {p.seats.length} open or draft job {p.seats.length === 1 ? 'team' : 'teams'}, and any closed ones.
              {liveSeats.length > 0 ? ' Pick who takes their seat below.' : ''}
            </span>
          )}
          {p.apps.length > 0 && (
            <span className="block">Loses {p.apps.map((a) => `${appName(a.app)} ${roleLabel(a.app, a.role)}`).join(' and ')}.</span>
          )}
          {p.apps.some((a) => a.app === 'sales') && (
            <span className="block">Hand over their open deals in Gio Sales › Team &amp; roles › Reassign deals.</span>
          )}
        </span>
      ) : null}
    </span>
  )

  return (
    <section aria-labelledby="danger-zone" className="rounded-[12px] border border-[#F1CFCB] bg-white">
      <header className="border-b border-[#F7E3E0] px-4 py-3">
        <h2 id="danger-zone" className="font-poppins text-[13.5px] font-semibold tracking-[-0.02em] text-[#C2372B]">
          Danger zone
        </h2>
      </header>
      <div className="px-4 py-3">
        {run ? (
          <>
            <p className="font-inter text-[12px] text-text-tertiary">
              {run.finished_at ? `Offboarded ${when(run.finished_at)}` : `Started ${when(run.started_at)}`}
            </p>
            <ul className="mt-2 space-y-1.5">
              {STEPS.map((s) => {
                const st = run.steps[s.key]
                return (
                  <li key={s.key} className="flex items-start gap-2 font-inter text-[12.5px]">
                    {st?.status === 'done' ? (
                      <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#12B886]" />
                    ) : (
                      <span aria-hidden className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#F59E0B]" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-text-primary">{s.label}</span>
                      {st?.status !== 'done' && (
                        <span className="block text-[11.5px] text-[#B91C1C]">{st?.detail ?? 'Not done yet.'}</span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {failed.length > 0 && canOffboard && (
                <Button variant="secondary" size="sm" loading={retrying} onClick={() => void retry()}>
                  Retry
                </Button>
              )}
              {offboarded && canOffboard && (
                <Button variant="secondary" size="sm" icon={UserPlus} onClick={() => setBackOpen(true)}>
                  Bring {first} back
                </Button>
              )}
            </div>
          </>
        ) : offboarded ? (
          <>
            <p className="font-inter text-[12.5px] text-text-tertiary">Offboarded.</p>
            {canOffboard && (
              <Button className="mt-3" variant="secondary" size="sm" icon={UserPlus} onClick={() => setBackOpen(true)}>
                Bring {first} back
              </Button>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="min-w-[240px] flex-1">
              <p className="font-inter text-[13px] font-medium text-text-primary">Offboard {first}</p>
              <p className="mt-0.5 font-inter text-[12px] text-text-tertiary">
                {broughtBack ? `Brought back ${when(broughtBack)}. ` : ''}
                {isSelf
                    ? "You can't offboard yourself. Another admin can."
                    : 'Removes all their access in one step: job teams, Gio ATS, Gio Sales, Gio Docs, sign-in and Google. Their work stays, under their name.'}
              </p>
            </div>
            {canOffboard && (
              <Button variant="danger" size="sm" icon={UserMinus} onClick={() => { setHandover({}); setOpen(true) }}>
                Offboard {first}
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={backOpen} onOpenChange={(next) => !backBusy && setBackOpen(next)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Bring {name} back?</DialogTitle>
            <DialogDescription>
              They can sign in again and get the apps in the job role you pick. Seat them on job teams again from each
              job, and they reconnect Google themselves.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <FormField label="Job role" helpText="Decides which apps they get back and their role in each.">
              <Select value={backRole} onValueChange={setBackRole} disabled={backBusy}>
                <SelectTrigger aria-label="Job role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROLE}>No job role (ATS Member only)</SelectItem>
                  {(bundles.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <p className="min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role="alert">
              {backError}
            </p>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="secondary" size="md" disabled={backBusy} onClick={() => setBackOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" icon={UserPlus} loading={backBusy} onClick={() => void bringBack()}>
              Bring {first} back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDestructiveDialog
        open={open}
        onOpenChange={setOpen}
        variant="remove"
        title={`Offboard ${name}?`}
        description={description}
        confirmLabel={`Offboard ${first}`}
        typeToConfirm={name}
        onConfirm={async () => {
          // Seats first, so no open job is left without its TA or Sourcer.
          const picks = liveSeats
            .filter((s) => handover[s.job_id] && handover[s.job_id] !== NO_ONE)
            .map((s) => ({
              job_id: s.job_id,
              role: s.role,
              organization_id: teams.data?.orgOf.get(s.job_id) ?? '',
              to_user_id: handover[s.job_id],
            }))
          if (picks.length > 0) {
            try {
              await handOverSeats(picks, user!.id)
            } catch (err) {
              throw new Error(`Couldn't hand over their seats, so nothing changed. ${jobTeamError(err, '')}`.trim())
            }
          }
          try {
            const res = await runOffboard(tenantId, userId)
            toast(res.ok ? `${name} is offboarded` : `${name} is offboarded in the ATS. Some steps need a retry.`)
          } finally {
            refresh()
          }
        }}
      >
        {liveSeats.length > 0 && (
          <div>
            <p className="font-inter text-[12px] text-text-tertiary">Who takes their seat</p>
            <ul className="mt-1.5 max-h-[220px] space-y-1.5 overflow-y-auto pr-1">
              {liveSeats.map((s) => {
                const onJob = teams.data?.onJob.get(s.job_id)
                const options = teammates.filter((t) => !onJob?.has(t.user_id!))
                return (
                  <li key={s.job_id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-inter text-[13px] text-text-primary">{s.title}</span>
                      <span className="block font-inter text-[12px] text-text-tertiary">
                        {JOB_SEAT_LABEL[s.role] ?? s.role} · {s.status === 'open' ? 'Open' : 'Draft'}
                      </span>
                    </span>
                    <Select
                      value={handover[s.job_id] ?? NO_ONE}
                      onValueChange={(v) => setHandover((h) => ({ ...h, [s.job_id]: v }))}
                      disabled={teams.isLoading}
                    >
                      <SelectTrigger className="h-8 w-[150px] text-[12.5px]" aria-label={`Who takes their seat on ${s.title}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_ONE}>No one</SelectItem>
                        {options.map((t) => (
                          <SelectItem key={t.user_id!} value={t.user_id!}>
                            {personName(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </ConfirmDestructiveDialog>
    </section>
  )
}
