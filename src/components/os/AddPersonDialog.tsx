import { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Info, Mail, Send, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { shakeFirstInvalid } from '@/lib/motion'
import { useMembers } from '@/hooks/useMembers'
import { useOrgContext } from '@/contexts/OrgContext'
import { appName, roleLabel, type Bundle } from '@/lib/os/peopleAccess'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TEAM_DOMAIN = '@virgilio.tech'

type AtsRole = 'admin' | 'member' | 'sales'

/** Every app a job role gives, Gio ATS first: everyone gets the ATS (Member unless the role says Admin). */
function appsFor(bundle: Bundle | undefined) {
  const ats = (bundle?.grants.find((g) => g.app === 'ats')?.role ?? 'member') as AtsRole
  const others = (bundle?.grants ?? []).filter((g) => g.app !== 'ats')
  return { ats, list: [{ app: 'ats', role: ats as string }, ...others] }
}

function FieldLabel({ children, hint, id, htmlFor }: { children: React.ReactNode; hint?: React.ReactNode; id?: string; htmlFor?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <label id={id} htmlFor={htmlFor} className="font-poppins text-[12.5px] font-semibold text-[#1F2230]">
        {children}
      </label>
      {hint && <span className="truncate font-inter text-[11px] text-[#8B8F9E]">{hint}</span>}
    </div>
  )
}

/**
 * Invites someone to Gio, in the action-dialog frame (Allan, 2026-10-26). The
 * ATS invitation is the account: everyone gets Gio ATS (Member, or Admin when
 * the job role says so); the job role's other apps are applied from the
 * person's page once they accept (People & Access grants need an account).
 * In Virgilio's workspace an address outside @virgilio.tech joins as an
 * external user (`members_z_external`), which the email field says up front.
 */
export function AddPersonDialog({
  open,
  onOpenChange,
  bundles,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bundles: Bundle[]
}) {
  const qc = useQueryClient()
  const { organizationId } = useOrgContext()
  const { createMember } = useMembers()
  const emailRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const [email, setEmail] = useState('')
  const [bundleId, setBundleId] = useState('')
  const [error, setError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail('')
      setBundleId('')
      setError(undefined)
      setFormError(null)
    }
  }, [open])

  const typed = email.trim().toLowerCase()
  const outside = EMAIL.test(typed) && !typed.endsWith(TEAM_DOMAIN)
  // An external user never has a job role, other apps or ATS Admin (GEX01/GEX02): the roles step aside.
  // A send error sits under the roles: bring it into view.
  useEffect(() => {
    if (formError) errorRef.current?.scrollIntoView({ block: 'nearest' })
  }, [formError])

  const bundle = outside ? undefined : bundles.find((b) => b.id === bundleId)
  const { ats: atsRole, list: apps } = appsFor(bundle)

  const close = () => {
    if (!sending) onOpenChange(false)
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (sending) return
    if (!EMAIL.test(typed)) {
      setError('Enter a work email, like name@virgilio.tech.')
      shakeFirstInvalid(e.currentTarget)
      emailRef.current?.focus()
      return
    }
    if (!organizationId) {
      setFormError("Your workspace hasn't loaded yet. Try again in a moment.")
      return
    }
    setSending(true)
    setFormError(null)
    try {
      const created = (await createMember({ organization_id: organizationId, system_role: atsRole, email: typed }, { quiet: true })) as
        | { inviteEmailFailed?: boolean }
        | undefined
      await qc.invalidateQueries({ queryKey: ['os-people'] })
      if (created?.inviteEmailFailed) {
        toast(`${typed} was added, but the invitation email didn't go out`, {
          description: 'Resend it from Settings › Members.',
        })
      } else {
        toast(`Invitation sent to ${typed}`, {
          description: outside
            ? 'They join as an external user. Add them to a job so they can see it.'
            : bundle
              ? `Open their page after they accept to apply ${bundle.name}.`
              : 'They join the ATS as a Member with no jobs.',
        })
      }
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setFormError(
        /already exists|pending invitation/i.test(message)
          ? 'This email already has an account or a pending invitation.'
          : "Couldn't send the invitation. Check your connection and try again.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="gio-dialog-overlay fixed inset-0 z-[60]" style={{ background: 'rgba(13,13,9,0.34)' }} />
        <DialogPrimitive.Content
          className="gio-dialog fixed left-1/2 top-1/2 z-[70] flex flex-col overflow-hidden bg-white [translate:-50%_-50%] focus:outline-none"
          // §13: focus starts in the first field; Esc and the backdrop wait while it sends.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            emailRef.current?.focus()
          }}
          onEscapeKeyDown={(e) => {
            if (sending) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (sending) e.preventDefault()
          }}
          style={{
            width: 560,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100dvh - 48px)',
            borderRadius: 18,
            boxShadow: '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
          }}
        >
          <header className="flex shrink-0 items-start gap-[14px]" style={{ padding: '22px 24px 18px', borderBottom: '1px solid #F1F0EC' }}>
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EDE4FF] text-[#6F3FF5]">
              <UserPlus className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="mt-0.5 line-clamp-2 break-words font-poppins text-[17px] font-semibold leading-snug text-text-primary [text-wrap:pretty]">
                Add a person
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 font-inter text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]">
                They get an email invitation. Gio is invite-only, so this is the only way in.
              </DialogPrimitive.Description>
            </div>
          </header>

          <form
            id="add-person"
            noValidate
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            style={{ padding: 24, gap: 6 }}
            onSubmit={(e) => void submit(e)}
          >
            {/* 1 · Work email */}
            <section>
              <FieldLabel htmlFor="add-person-email">Work email</FieldLabel>
              <Input
                id="add-person-email"
                ref={emailRef}
                type="email"
                autoComplete="off"
                value={email}
                disabled={sending}
                aria-invalid={!!error}
                aria-describedby="add-person-email-msg"
                onChange={(e) => {
                  setEmail(e.target.value)
                  setFormError(null)
                  if (error && EMAIL.test(e.target.value.trim())) setError(undefined)
                }}
                placeholder="name@virgilio.tech"
              />
              <p
                id="add-person-email-msg"
                className={`gio-field-message mt-1.5 min-h-[18px] font-inter text-[12px] leading-[1.45] ${error ? 'text-[#B91C1C]' : 'text-[#B45309]'}`}
                role={error ? 'alert' : undefined}
              >
                {error ??
                  (outside ? (
                    <span className="flex items-start gap-1.5">
                      <Info className="mt-[2px] h-3 w-3 shrink-0" aria-hidden />
                      <span>
                        Not a {TEAM_DOMAIN} address: they&apos;ll join as an external user, with the ATS only and just the jobs they&apos;re
                        added to.
                      </span>
                    </span>
                  ) : (
                    ''
                  ))}
              </p>
            </section>

            {/* 2 · Job role */}
            <section>
              <FieldLabel id="add-person-role" hint={outside ? 'Not for external users' : 'Optional · decides their apps'}>
                Job role
              </FieldLabel>
              <div
                role="radiogroup"
                aria-labelledby="add-person-role"
                aria-disabled={outside || undefined}
                className={`flex flex-col gap-1 transition-opacity duration-hover ${outside ? 'pointer-events-none opacity-45' : ''}`}
              >
                {bundles.map((b) => {
                  const selected = !outside && bundleId === b.id
                  const line = appsFor(b)
                    .list.map((g) => `${appName(g.app)} ${roleLabel(g.app, g.role)}`)
                    .join(' · ')
                  return (
                    <button
                      key={b.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={sending || outside}
                      // A second click clears it: the job role is optional.
                      onClick={() => setBundleId(selected ? '' : b.id)}
                      className="gio-pressable flex items-start gap-3 text-left transition-colors duration-hover"
                      style={{
                        padding: '9px 12px',
                        borderRadius: 10,
                        background: selected ? '#F5EFFF' : '#FFFFFF',
                        border: `1px solid ${selected ? '#DFCBFB' : '#EDECE6'}`,
                        boxShadow: selected ? 'inset 0 0 0 1px #DFCBFB' : undefined,
                      }}
                    >
                      <span
                        aria-hidden
                        className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
                        style={{ background: selected ? '#6F3FF5' : '#FFFFFF', border: `1px solid ${selected ? '#6F3FF5' : '#D4D2CA'}` }}
                      >
                        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-poppins text-[13px] font-semibold ${selected ? 'text-[#5B21B6]' : 'text-[#1F2230]'}`}>
                          {b.name}
                        </span>
                        {b.description && <span className="line-clamp-2 block font-inter text-[11.5px] text-[#6B7080]">{b.description}</span>}
                        <span className="mt-0.5 line-clamp-2 block font-inter text-[11.5px] text-[#8B8F9E]">{line}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 3 · What they get */}
            <section className="mt-3 rounded-[12px] border border-[#EDECE6] bg-[#FAFAF7] px-3.5 py-3">
              <p className="font-poppins text-[12px] font-semibold text-[#1F2230]">What they get</p>
              <ul className="mt-1.5 space-y-1 font-inter text-[12.5px] text-[#1F2230]">
                {apps.map((g) => (
                  <li key={g.app} className="flex items-center justify-between gap-3">
                    <span>{appName(g.app)}</span>
                    <span className="text-[#5A6072]">{outside && g.app === 'ats' ? 'External user' : roleLabel(g.app, g.role)}</span>
                  </li>
                ))}
                {!bundle && (
                  <li className="flex items-center justify-between gap-3">
                    <span>Jobs</span>
                    <span className="text-[#5A6072]">{outside ? "Only the ones they're added to" : 'No jobs yet'}</span>
                  </li>
                )}
              </ul>
              {apps.length > 1 && (
                <p className="mt-2 font-inter text-[11.5px] leading-[1.45] text-[#6B7080]">Their other apps switch on from their page once they accept.</p>
              )}
            </section>

            {formError && (
              <p ref={errorRef} className="mt-3 rounded-[10px] border border-[#F3D0CC] bg-[#FEF4F4] px-3 py-2 font-inter text-[12.5px] text-[#B91C1C]" role="alert">
                {formError}
              </p>
            )}
          </form>

          <footer className="flex shrink-0 items-center justify-end gap-3" style={{ padding: '13px 24px', borderTop: '1px solid #F1F0EC', background: '#FAFAF7' }}>
            <div className="hidden min-w-0 flex-1 items-center gap-1.5 sm:flex">
              <Mail className="h-3 w-3 shrink-0 text-[#8B8F9E]" strokeWidth={2} aria-hidden />
              <span className="truncate font-inter text-[11px] text-[#8B8F9E]">Sent by email · they choose their own password</span>
            </div>
            <Button type="button" variant="secondary" size="md" disabled={sending} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" form="add-person" variant="primary" size="md" icon={Send} loading={sending}>
              Send invitation
            </Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
