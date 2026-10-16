import { useRef } from 'react'

import { FormSection } from '@/components/references/FormSection'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { tagLabel, tagsFor, type TplDraft } from '@/lib/sign/templates'
import { Field, TagText } from './parts'

const REMINDERS = [
  { value: '0', label: 'Off' },
  { value: '1', label: 'Every day' },
  { value: '2', label: 'Every 2 days' },
  { value: '3', label: 'Every 3 days' },
]
const EXPIRY = ['7', '14', '30', '60']

export function MessageStep({ d, set }: { d: TplDraft; set: (fn: (d: TplDraft) => TplDraft) => void }) {
  const last = useRef<'subject' | 'body'>('body')
  const sRef = useRef<HTMLInputElement>(null)
  const bRef = useRef<HTMLTextAreaElement>(null)
  const tags = tagsFor(d.kind)
  const first = d.roles.find((r) => r.role === 'signer')

  // Insert {{tag}} where the cursor was in the last field you were in.
  const insert = (k: string) => {
    const t = `{{${k}}}`
    const which = last.current
    const el = which === 'subject' ? sRef.current : bRef.current
    const v = d[which]
    const at = el?.selectionStart ?? v.length
    const end = el?.selectionEnd ?? at
    set((x) => ({ ...x, [which]: v.slice(0, at) + t + v.slice(end) }))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + t.length, at + t.length)
    })
  }

  return (
    <div className="grid max-w-[1000px] grid-cols-[minmax(0,1fr)_minmax(0,420px)] items-start gap-6">
      <div>
        <FormSection title="Message" subtitle="The email each person gets with their signing link. Data tags fill in when it’s sent.">
          <div className="flex flex-col gap-4">
            <Field label="Subject" required htmlFor="tpl-subject">
              <Input
                id="tpl-subject"
                ref={sRef}
                value={d.subject}
                maxLength={200}
                onFocus={() => (last.current = 'subject')}
                onChange={(e) => {
                  const v = e.target.value
                  set((x) => ({ ...x, subject: v }))
                }}
              />
            </Field>
            <Field label="Message" required htmlFor="tpl-body">
              <Textarea
                id="tpl-body"
                ref={bRef}
                rows={6}
                maxLength={5000}
                value={d.body}
                onFocus={() => (last.current = 'body')}
                onChange={(e) => {
                  const v = e.target.value
                  set((x) => ({ ...x, body: v }))
                }}
              />
            </Field>
            <div>
              <p className="mb-1.5 font-inter text-[11.5px] text-text-tertiary">Insert a data tag where your cursor is</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insert(k)}
                    className="gio-pressable rounded-full border border-[#E2D6FC] bg-[#F6F1FE] px-2.5 py-[3px] font-inter text-[12px] text-[#4C1D95] transition-colors duration-hover hover:bg-[#EDE4FF]"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </FormSection>
        <FormSection title="Defaults" subtitle="Used for every envelope sent from this template.">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Reminders">
              <Select value={String(d.reminder_days)} onValueChange={(v) => set((x) => ({ ...x, reminder_days: Number(v) }))}>
                <SelectTrigger className="h-9" aria-label="Reminders">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDERS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Link expires after">
              <Select value={String(d.expiry_days)} onValueChange={(v) => set((x) => ({ ...x, expiry_days: Number(v) }))}>
                <SelectTrigger className="h-9" aria-label="Link expires after">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </FormSection>
      </div>

      <div className="sticky top-0">
        <FormSection title="Preview" subtitle={first ? `What ${first.label.toLowerCase()} gets` : undefined}>
          <div className="font-inter text-[13px] leading-relaxed text-text-primary">
            <div className="flex flex-col gap-0.5 border-b border-[#F0EFEA] pb-3 text-[12px] text-text-tertiary">
              <span>
                <span className="font-medium text-text-primary">Virgilio Technologies</span> via Gio Sign · noreply@app.gogio.io
              </span>
              <span>To: {first?.label ?? 'The first signer'}</span>
              <span className="mt-1.5 text-[14px] font-semibold text-text-primary">
                <TagText text={d.subject || 'No subject yet'} label={(k) => tagLabel(d.kind, k)} />
              </span>
            </div>
            <div className="whitespace-pre-wrap pt-3">
              <TagText text={d.body} label={(k) => tagLabel(d.kind, k)} />
            </div>
            <span className="mt-4 inline-flex h-9 items-center rounded-lg bg-[#0d0d09] px-4 font-poppins text-[13px] font-medium text-[#fffcf9]">Review and sign</span>
            <p className="mt-3 text-[11.5px] text-text-tertiary">
              {d.docs.length} document{d.docs.length === 1 ? '' : 's'} · the link expires in {d.expiry_days} days · they confirm with a code sent to their email
            </p>
          </div>
        </FormSection>
      </div>
    </div>
  )
}
