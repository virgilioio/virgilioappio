import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronDown, Eye, Info, Lock, Send, SquarePen, TriangleAlert } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { FormSheet } from '@/components/references/FormSheet'
import { FormSection } from '@/components/references/FormSection'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { UnsavedGuard } from '@/components/ui/unsaved-guard'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DateTimePickerVirgilio } from '@/components/ui/datetime-picker-virgilio'
import { cn } from '@/lib/utils'
import { undoToast } from '@/lib/undoToast'
import { shortDateTime } from '@/lib/sign/status'
import { DATA_TAGS, okEmail, tagLabel, useOfferForms } from '@/lib/sign/templates'
import {
  offerSendRefusal,
  sendEnvelope,
  sendErrorMessage,
  templateFit,
  undoSend,
  useOfferGate,
  useSendPreview,
  useSendTemplates,
  type SendSource,
  type SendTemplate,
  type TemplateFit,
} from '@/lib/sign/send'
import { FilledPreview } from './FilledPreview'
import { TemplateSelect } from './TemplateSelect'
import { FromOffer } from './send/FromOffer'
import { useTemplateFit } from './send/fit'
import { CoverageRing } from './send/parts'
import { EditTemplateSheet } from './templates/EditTemplateSheet'
import { Field, Seg, TagText } from './templates/parts'

const tomorrowAt9 = () => {
  const d = new Date(Date.now() + 86_400_000)
  d.setHours(9, 0, 0, 0)
  return d
}

export interface SendDraft {
  templateId: string | null
  people: Record<string, { name: string; email: string }>
  subject: string | null
  body: string | null
  when: 'now' | 'schedule'
  at: Date
}
const blank = (): SendDraft => ({ templateId: null, people: {}, subject: null, body: null, when: 'now', at: tomorrowAt9() })

/**
 * Send for signature from a record (a candidate on a job, or a member). The
 * sender picks a template; the documents, fields and data come from the
 * template and the record and can't be changed here. They fill in who signs,
 * may edit the email, and send now (5 seconds to Undo) or schedule it.
 */
export function SendSheet({
  open,
  onOpenChange,
  source,
  recordLabel,
  isAdmin,
  restore,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: SendSource
  recordLabel: string
  isAdmin: boolean
  /** Reopen with what was entered before (after Undo). */
  restore?: SendDraft | null
}) {
  const qc = useQueryClient()
  const [d, setD] = useState<SendDraft>(blank)
  const [dirty, setDirty] = useState(false)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const templates = useSendTemplates(open ? source : null)
  const preview = useSendPreview(open ? d.templateId : null, source)
  const tpl = templates.data?.find((t) => t.id === d.templateId) ?? null
  const kind = source.type === 'member' ? 'member' : 'candidate'
  const isOffer = source.type === 'ats_offer'
  // The offer gate, before a template is even picked (the preview carries it too).
  const gate = useOfferGate(open && isOffer ? source.id : null)
  const blocked = isOffer && gate.data && !gate.data.ok ? offerSendRefusal(gate.data.reason) : null
  const [editing, setEditing] = useState<string | null>(null)
  const offerFormId = isOffer ? source.formId : null
  const fit = useTemplateFit(tpl, isOffer, offerFormId)
  const offerForm = useOfferForms().data?.find((f) => f.id === offerFormId)?.name ?? null
  const [showPreview, setShowPreview] = useState(false)

  // Templates in three groups: linked to this offer's form, any offer, other forms (not sendable).
  // From a candidate (another agreement), only unlinked templates show.
  const groups = useMemo(() => {
    const all = (templates.data ?? []).filter((t) => (isOffer ? true : !t.offer_form_id))
    const by: Record<TemplateFit, SendTemplate[]> = { linked: [], any: [], other_form: [] }
    for (const t of all) by[templateFit(t, source)].push(t)
    return by
  }, [templates.data, isOffer, source])
  const sendable = useMemo(() => [...groups.linked, ...groups.any], [groups])

  useEffect(() => {
    if (!open) return
    setD(restore ?? blank())
    setDirty(!!restore)
    setAsking(false)
    setBusy(false)
    setError(null)
    setTouched({})
  }, [open, restore])

  // One sendable template: pick it. For an offer, a single linked one wins.
  useEffect(() => {
    if (!open || d.templateId) return
    const pick = groups.linked.length === 1 ? groups.linked[0] : sendable.length === 1 ? sendable[0] : null
    if (pick) setD((x) => ({ ...x, templateId: pick.id }))
  }, [open, groups.linked, sendable, d.templateId])
  useEffect(() => {
    if (!open) {
      setEditing(null)
      setShowPreview(false)
    }
  }, [open])

  // Prefill people from the record once the preview arrives (keeps anything typed).
  useEffect(() => {
    if (!preview.data) return
    setD((x) => {
      const people = { ...x.people }
      for (const r of preview.data!.roles) {
        if (!r.fixed && !people[r.id]) people[r.id] = { name: r.name ?? '', email: r.email ?? '' }
      }
      return { ...x, people }
    })
  }, [preview.data])

  const set = (fn: (x: SendDraft) => SendDraft) => {
    setD(fn)
    setDirty(true)
    setError(null)
  }

  const roles = useMemo(() => preview.data?.roles ?? [], [preview.data])
  const missing = useMemo(() => preview.data?.missing ?? [], [preview.data])
  const issue = useMemo(() => {
    if (blocked) return blocked
    if (!d.templateId) return 'Pick a template to continue'
    if (fit.blocked) return 'This template can’t be sent with this offer'
    if (preview.isLoading) return 'Loading the record…'
    if (preview.isError) return sendErrorMessage(preview.error)
    if (preview.data?.gate && !preview.data.gate.ok) return offerSendRefusal(preview.data.gate.reason)
    if (missing.length) return `Missing from the ${isOffer ? 'offer' : 'record'}: ${missing.join(', ')}`
    for (const r of roles) {
      if (r.fixed) continue
      const p = d.people[r.id]
      if (!p?.name.trim()) return `Add a name for ${r.label}`
      if (!okEmail(p.email.trim())) return `Add a valid email for ${r.label}`
    }
    if (d.subject !== null && !d.subject.trim()) return 'Add a subject'
    if (d.when === 'schedule' && d.at.getTime() <= Date.now() + 60_000) return 'Pick a time in the future'
    return null
  }, [d, preview.isLoading, preview.isError, preview.error, preview.data?.gate, missing, roles, blocked, isOffer, fit.blocked])

  const close = () => {
    if (busy) return
    if (dirty) setAsking(true)
    else onOpenChange(false)
  }

  const firstName = (() => {
    const r = roles.find((x) => x.role === 'signer' && !x.fixed)
    return (r && d.people[r.id]?.name.trim()) || 'them'
  })()

  const send = async () => {
    if (issue || busy || !d.templateId) return
    setBusy(true)
    setError(null)
    const sent = d
    try {
      const id = await sendEnvelope({
        templateId: d.templateId,
        source,
        people: roles
          .filter((r) => !r.fixed)
          .map((r) => ({ role_id: r.id, name: d.people[r.id].name.trim(), email: d.people[r.id].email.trim().toLowerCase() })),
        sendAt: d.when === 'schedule' ? d.at : null,
        subject: d.subject !== null && d.subject.trim() !== tpl?.subject ? d.subject.trim() : null,
        body: d.body !== null && d.body !== tpl?.body ? d.body : null,
      })
      await qc.invalidateQueries({ queryKey: ['sign'] })
      setDirty(false)
      onOpenChange(false)
      if (sent.when === 'schedule') {
        toast.success(`Scheduled for ${shortDateTime(sent.at.toISOString())}`, {
          description: `${tpl?.name ?? 'The agreement'} goes to ${firstName} then.`,
        })
      } else {
        undoToast(
          `Sending to ${firstName}`,
          async () => {
            try {
              const ok = await undoSend(id)
              await qc.invalidateQueries({ queryKey: ['sign'] })
              if (!ok) {
                toast.error('Too late to undo', { description: 'It has already gone out.' })
                return
              }
              window.dispatchEvent(new CustomEvent('gio-sign-reopen', { detail: { sourceId: source.id, draft: sent } }))
            } catch {
              toast.error('Couldn’t undo the send')
            }
          },
          'You have 5 seconds to undo. The email goes out within a minute.',
        )
      }
    } catch (e) {
      setError(sendErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const label = (k: string) => tagLabel(kind, k)
  const primaryLabel =
    d.when === 'schedule' ? `Schedule for ${shortDateTime(d.at.toISOString())}` : 'Send for signature'

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      width={660}
      eyebrow={kind === 'member' ? 'Member agreement' : 'Send for signature'}
      title={kind === 'member' ? 'Send agreement' : isOffer ? 'Send offer for signature' : 'Send an agreement'}
      subtitle={
        isOffer && offerForm ? (
          <>
            {recordLabel} · offer form <span className="font-semibold text-text-primary">{offerForm}</span>
          </>
        ) : (
          recordLabel
        )
      }
      footer={
        <div className="relative flex w-full items-center gap-2.5">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <p
            key={error ?? issue ?? 'ready'}
            className={cn('gio-swap-in min-w-0 flex-1 truncate font-inter text-[11.5px]', error ? 'text-virgilio-error' : 'text-text-tertiary')}
          >
            {error ?? issue ?? `${roles.length} ${roles.length === 1 ? 'person' : 'people'} · ${tpl?.docs ?? 0} document${tpl?.docs === 1 ? '' : 's'}`}
          </p>
          <Button icon={d.when === 'schedule' ? CalendarClock : Send} onClick={send} disabled={!!issue} loading={busy}>
            {primaryLabel}
          </Button>
          <UnsavedGuard
            open={asking}
            onKeep={() => setAsking(false)}
            onDiscard={() => {
              setAsking(false)
              setDirty(false)
              onOpenChange(false)
            }}
          />
        </div>
      }
    >
      {/* Why it can't go yet (offers only) */}
      {blocked && (
        <p className="flex gap-2 rounded-lg bg-[#FCF1DC] p-2.5 font-inter text-[12px] leading-snug text-[#7A4A06]">
          <Lock className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          {blocked}
        </p>
      )}

      {/* Template */}
      <FormSection
        title="Template"
        subtitle={
          isOffer
            ? 'Templates linked to this offer’s form are listed first.'
            : kind === 'member'
            ? 'The documents, fields and who signs come from the template.'
            : 'Agreements that work with any candidate. They don’t need offer approval.'
        }
        action={
          isAdmin && d.templateId ? (
            <Button variant="ghost" size="sm" icon={SquarePen} onClick={() => setEditing(d.templateId)}>
              Edit template
            </Button>
          ) : undefined
        }
        bare
      >
        {templates.isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        ) : templates.isError ? (
          <p className="font-inter text-[12.5px] text-virgilio-error">
            Couldn’t load templates.{' '}
            <button type="button" className="underline" onClick={() => templates.refetch()}>
              Retry
            </button>
          </p>
        ) : !sendable.length && !groups.other_form.length ? (
          <p className="font-inter text-[12.5px] leading-relaxed text-text-secondary">
            There are no {kind} templates yet.{' '}
            {isAdmin ? (
              <Link to="/sign/templates" className="font-medium text-virgilio-purple underline-offset-2 hover:underline">
                Create one in Sign › Templates
              </Link>
            ) : (
              'Ask an admin to create one in Sign.'
            )}
          </p>
        ) : (
          <TemplateSelect
            templates={templates.data ?? []}
            offerFormId={isOffer ? source.formId : null}
            mode={isOffer ? 'offer' : 'other'}
            kind={kind}
            value={d.templateId}
            onChange={(id) => id !== d.templateId && set((x) => ({ ...x, templateId: id, subject: null, body: null }))}
          />
        )}
      </FormSection>

      <Collapsible open={!!tpl}>
        <CollapsibleContent>
          {tpl && (
            <FormSection
              title={isOffer ? 'From the offer' : 'From the record'}
              subtitle={
                isOffer
                  ? 'Filled into the document when it’s sent. To change a value, edit the offer.'
                  : 'Filled into the document when it’s sent. To change a value, change the record.'
              }
              action={fit.linked && !fit.blocked && fit.cov && fit.cov.total > 0 ? <CoverageRing mapped={fit.cov.mapped.length} total={fit.cov.total} /> : undefined}
            >
              <div className="flex flex-col gap-2">
                <FromOffer
                  tpl={tpl}
                  kind={kind}
                  isOffer={isOffer}
                  offerFormId={offerFormId}
                  preview={preview.data}
                  previewLoading={preview.isLoading}
                  previewError={preview.isError ? preview.error : null}
                  onEditTemplate={isAdmin ? () => setEditing(tpl.id) : undefined}
                />
              </div>
            </FormSection>
          )}

          {tpl && !fit.blocked && (
            <>
              {/* The documents, filled in */}
              {!preview.isError && preview.data && (
                <FormSection
                  title="Preview"
                  subtitle="Every page, in order, with the values filled in and where each person signs."
                  action={
                    <Button variant="ghost" size="sm" icon={Eye} onClick={() => setShowPreview((v) => !v)} aria-expanded={showPreview}>
                      {showPreview ? 'Hide preview' : 'Show preview'}
                    </Button>
                  }
                >
                  {showPreview ? (
                    <div className="rounded-xl border border-[#E7E8EE] bg-[#F4F3EF] p-4">
                      <FilledPreview
                        templateId={d.templateId}
                        values={preview.data.values}
                        people={Object.fromEntries(Object.entries(d.people).map(([k, v]) => [k, { name: v.name }]))}
                        width={480}
                      />
                    </div>
                  ) : (
                    <p className="font-inter text-[12.5px] text-text-tertiary">
                      {tpl?.written
                        ? `${tpl.docs} document${tpl.docs === 1 ? '' : 's'}, ${tpl.written} written in Gio and filled in when sent.`
                        : `${tpl?.pages ?? 0} page${tpl?.pages === 1 ? '' : 's'} across ${tpl?.docs ?? 0} document${tpl?.docs === 1 ? '' : 's'}.`}
                    </p>
                  )}
                </FormSection>
              )}

              {/* People */}
              {!preview.isError && roles.length > 0 && (
                <FormSection title="Who signs" subtitle={tpl && roles.length > 1 ? 'In this order; each person gets the email after the one before signs.' : undefined}>
                  <div className="flex flex-col gap-3">
                    {roles.map((r, i) => (
                      <div key={r.id} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 font-inter text-[12.5px] font-medium text-text-primary">
                          <span className="w-4 text-center text-[11.5px] tabular-nums text-text-tertiary">{i + 1}</span>
                          <span aria-hidden className="h-3 w-3 rounded" style={{ background: r.color }} />
                          {r.label}
                          <span className="font-normal text-text-tertiary">
                            · {r.role === 'cc' ? 'Gets a copy' : r.role === 'approver' ? 'Approves' : 'Signs'}
                          </span>
                        </div>
                        {r.fixed ? (
                          <p className="ml-6 flex items-center gap-1.5 font-inter text-[12.5px] text-text-secondary">
                            <Lock className="h-3 w-3 text-text-tertiary" strokeWidth={2} aria-hidden />
                            {r.name} · {r.email}
                          </p>
                        ) : (
                          <div className="ml-6 grid grid-cols-2 gap-2">
                            <Input
                              aria-label={`${r.label} name`}
                              placeholder="Full name"
                              maxLength={120}
                              className="h-9"
                              value={d.people[r.id]?.name ?? ''}
                              onChange={(e) => {
                                const v = e.target.value
                                set((x) => ({ ...x, people: { ...x.people, [r.id]: { ...(x.people[r.id] ?? { email: '' }), name: v } } }))
                              }}
                            />
                            <Input
                              aria-label={`${r.label} email`}
                              placeholder="Email"
                              type="email"
                              className="h-9"
                              value={d.people[r.id]?.email ?? ''}
                              aria-invalid={!!touched[r.id] && !!d.people[r.id]?.email && !okEmail(d.people[r.id].email.trim())}
                              onBlur={() => setTouched((t) => ({ ...t, [r.id]: true }))}
                              onChange={(e) => {
                                const v = e.target.value
                                set((x) => ({ ...x, people: { ...x.people, [r.id]: { ...(x.people[r.id] ?? { name: '' }), email: v } } }))
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </FormSection>
              )}

              {/* Email */}
              {tpl && (
                <FormSection title="Email">
                  <Collapsible>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1 font-inter text-[12.5px] text-text-primary">
                        <p className="truncate font-medium">
                          <TagText text={d.subject ?? tpl.subject} label={label} />
                        </p>
                        <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-text-secondary">
                          <TagText text={d.body ?? tpl.body} label={label} />
                        </p>
                      </div>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" iconRight={ChevronDown} className="[&[data-state=open]_svg]:rotate-180 [&_svg]:transition-transform [&_svg]:duration-200">
                          Edit email
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="flex flex-col gap-3 pt-3">
                      <Field label="Subject" htmlFor="send-subject">
                        <Input
                          id="send-subject"
                          maxLength={200}
                          value={d.subject ?? tpl.subject}
                          onChange={(e) => {
                            const v = e.target.value
                            set((x) => ({ ...x, subject: v }))
                          }}
                        />
                      </Field>
                      <Field label="Message" htmlFor="send-body" help="Tags like {{name}} fill in from the record. The documents don’t change.">
                        <Textarea
                          id="send-body"
                          rows={5}
                          maxLength={5000}
                          value={d.body ?? tpl.body}
                          onChange={(e) => {
                            const v = e.target.value
                            set((x) => ({ ...x, body: v }))
                          }}
                        />
                      </Field>
                    </CollapsibleContent>
                  </Collapsible>
                </FormSection>
              )}

              {/* When */}
              {tpl && (
                <FormSection title="When">
                  <div className="flex flex-col gap-3">
                    <Seg
                      label="When to send"
                      value={d.when}
                      onChange={(v) => set((x) => ({ ...x, when: v as SendDraft['when'] }))}
                      options={[
                        { value: 'now', label: 'Send now', icon: Send },
                        { value: 'schedule', label: 'Schedule', icon: CalendarClock },
                      ]}
                    />
                    {d.when === 'schedule' && (
                      <DateTimePickerVirgilio
                        value={d.at}
                        minDate={new Date()}
                        onChange={(at) => set((x) => ({ ...x, at }))}
                      />
                    )}
                    <p className="font-inter text-[11.5px] text-text-tertiary">
                      {d.when === 'schedule'
                        ? 'Sends at that time, your time.'
                        : 'Sends right away, with 5 seconds to undo.'}
                    </p>
                  </div>
                </FormSection>
              )}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
      {editing && <EditTemplateSheet templateId={editing} onClose={() => setEditing(null)} />}
    </FormSheet>
  )
}
