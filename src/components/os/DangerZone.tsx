import { useState } from 'react'
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
import { supabase } from '@/integrations/supabase/client'
import {
  appName,
  personName,
  roleLabel,
  syncNow,
  useApplyBundle,
  useBundles,
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

const JOB_SEAT: Record<string, string> = {
  recruiter: 'Recruiter',
  sourcer: 'Sourcer',
  hiring_manager: 'Hiring manager',
  interviewer: 'Interviewer',
}

const NO_ROLE = '__none__'

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
 * One-click offboarding (design Part D). Shows what will change and asks for
 * the person's name (Pattern 2), then lists each step with its result. A step
 * that failed keeps a Retry, which repeats only what isn't done.
 */
export function OffboardCard({ person, tenantId, canOffboard }: { person: Person; tenantId: string; canOffboard: boolean }) {
  const qc = useQueryClient()
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
              Leaves {p.seats.length} job {p.seats.length === 1 ? 'team' : 'teams'}:{' '}
              {p.seats.map((s) => `${s.title} (${JOB_SEAT[s.role] ?? s.role})`).join(', ')}. Seat someone else first if
              those jobs need them.
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
    <section className="rounded-[12px] border border-[#E7E8EE] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[#EFEEEA] px-4 py-3">
        <h2 className="font-poppins text-[13.5px] font-semibold tracking-[-0.02em] text-[#1F2230]">Offboarding</h2>
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
                  Bring {name.split(' ')[0]} back
                </Button>
              )}
            </div>
          </>
        ) : offboarded ? (
          <>
            <p className="font-inter text-[12.5px] text-text-tertiary">Offboarded.</p>
            {canOffboard && (
              <Button className="mt-3" variant="secondary" size="sm" icon={UserPlus} onClick={() => setBackOpen(true)}>
                Bring {name.split(' ')[0]} back
              </Button>
            )}
          </>
        ) : broughtBack ? (
          <>
            <p className="font-inter text-[12px] text-text-tertiary">
              Brought back {when(broughtBack)}. Offboarding removes all their access again in one step.
            </p>
            {canOffboard && (
              <Button className="mt-3" variant="danger" size="sm" icon={UserMinus} onClick={() => setOpen(true)}>
                Offboard {name.split(' ')[0]}
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="font-inter text-[12px] text-text-tertiary">
              Removes all their access in one step: job teams, Gio ATS, Gio Sales, Gio Docs, sign-in and Google.
            </p>
            {canOffboard && (
              <Button className="mt-3" variant="danger" size="sm" icon={UserMinus} onClick={() => setOpen(true)}>
                Offboard {name.split(' ')[0]}
              </Button>
            )}
          </>
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
              Bring {name.split(' ')[0]} back
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
        confirmLabel={`Offboard ${name.split(" ")[0]}`}
        typeToConfirm={name}
        onConfirm={async () => {
          try {
            const res = await runOffboard(tenantId, userId)
            toast(res.ok ? `${name} is offboarded` : `${name} is offboarded in the ATS. Some steps need a retry.`)
          } finally {
            refresh()
          }
        }}
      />
    </section>
  )
}
