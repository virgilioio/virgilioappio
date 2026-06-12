import { useState, useRef, useEffect, useCallback } from 'react'
import { Switch } from '@/components/ui/switch'
import { Loader2, Bell, Calendar, GitBranch } from 'lucide-react'
import { PlaceholderHelper } from '@/components/settings/PlaceholderHelper'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useWorkspaceAutomation } from '@/hooks/useWorkspaceAutomation'
import { toast } from 'sonner'
import {
  SubjectTemplateEditor,
  BodyTemplateEditor,
  type SubjectTemplateEditorHandle,
  type BodyTemplateEditorHandle,
} from '@/components/editors'
import { SpecCard } from './shared/SpecCard'
import { SpecRow, NOIR_BTN } from './shared/SpecRow'
import { SpecChip } from './shared/SpecChip'

const DEFAULT_SUBJECT = 'Thank you for applying to {{job.title}} at {{organization.name}}'
const DEFAULT_BODY = `Hi {{candidate.first_name}},\n\nThank you for applying to the {{job.title}} position at {{organization.name}}. We've received your application and our team will review it shortly.\n\nWe'll be in touch if your qualifications match our requirements.\n\nBest regards,\nThe {{organization.name}} Team`

export function AutomationsTab() {
  const { automation, isLoading, isSaving, save, toggle } = useWorkspaceAutomation('application_confirmation_email')
  const { identities, isLoading: identitiesLoading } = useMailIdentities()

  const [enabled, setEnabled] = useState(false)
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [body, setBody] = useState(DEFAULT_BODY)
  const [fromEmail, setFromEmail] = useState('')
  const [lastFocused, setLastFocused] = useState<'subject' | 'body'>('body')
  const [dirty, setDirty] = useState(false)
  const [showInserter, setShowInserter] = useState(false)

  const subjectRef = useRef<SubjectTemplateEditorHandle>(null)
  const bodyRef = useRef<BodyTemplateEditorHandle>(null)

  useEffect(() => {
    if (automation) {
      setEnabled(automation.is_active)
      setSubject(automation.subject || DEFAULT_SUBJECT)
      setBody(automation.body || DEFAULT_BODY)
      setFromEmail(automation.from_email || '')
      setDirty(false)
    }
  }, [automation])

  useEffect(() => {
    if (!fromEmail && identities.length > 0 && !automation?.from_email) {
      setFromEmail(identities[0].email_address)
    }
  }, [identities, fromEmail, automation])

  const handleToggle = async (checked: boolean) => {
    if (checked && !fromEmail) {
      toast.error('Please select a "From" email address first')
      return
    }
    setEnabled(checked)
    try {
      await toggle(checked)
      toast.success(checked ? 'Automation enabled' : 'Automation disabled')
    } catch {
      setEnabled(!checked)
    }
  }

  const handleSave = async () => {
    if (!fromEmail) { toast.error('Please select a "From" email address'); return }
    await save({ subject, body, from_email: fromEmail })
    setDirty(false)
    toast.success('Saved')
  }

  const markDirty = useCallback(() => setDirty(true), [])
  const handleInsert = (placeholder: string) => {
    if (lastFocused === 'subject') subjectRef.current?.insertPlaceholder(placeholder)
    else bodyRef.current?.insertPlaceholder(placeholder)
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#8B8F9E]" /></div>
  }

  return (
    <div className="max-w-[860px]">
      <SpecCard
        title="Application confirmation email"
        description="Automatically sent when candidates submit an application."
        action={<Switch checked={enabled} onCheckedChange={handleToggle} />}
      >
        <div
          className={`flex flex-col gap-3 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}
          style={{ padding: '14px 18px' }}
        >
          {/* From */}
          <div className="flex flex-col gap-1.5">
            <label className="font-inter text-[#5A6072]" style={{ fontSize: 11.5, fontWeight: 600 }}>From</label>
            {identitiesLoading ? (
              <div className="font-inter text-[#8B8F9E]" style={{ fontSize: 12 }}>Loading…</div>
            ) : identities.length === 0 ? (
              <div className="font-inter text-[#8B8F9E]" style={{ fontSize: 12 }}>
                No accounts connected. Connect a Gmail account in Settings → Email & calendar.
              </div>
            ) : (
              <Select value={fromEmail} onValueChange={(v) => { setFromEmail(v); markDirty() }}>
                <SelectTrigger><SelectValue placeholder="Select sender…" /></SelectTrigger>
                <SelectContent>
                  {identities.map(i => (
                    <SelectItem key={i.id} value={i.email_address}>
                      {i.display_name ? `${i.display_name} (${i.email_address})` : i.email_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-1.5">
            <label className="font-inter text-[#5A6072]" style={{ fontSize: 11.5, fontWeight: 600 }}>Subject</label>
            <SubjectTemplateEditor
              ref={subjectRef}
              value={subject}
              onChange={(v) => { setSubject(v); markDirty() }}
              placeholder="Enter email subject…"
              onFocus={() => setLastFocused('subject')}
            />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-inter text-[#5A6072]" style={{ fontSize: 11.5, fontWeight: 600 }}>Body</label>
              <button
                type="button"
                onClick={() => setShowInserter(s => !s)}
                className="font-inter text-[#5B21B6] hover:underline"
                style={{ fontSize: 11 }}
              >
                {showInserter ? 'Hide placeholders' : 'Insert placeholder'}
              </button>
            </div>
            <BodyTemplateEditor
              ref={bodyRef}
              value={body}
              onChange={(v) => { setBody(v); markDirty() }}
              onFocus={() => setLastFocused('body')}
            />
            {showInserter && (
              <div className="mt-2"><PlaceholderHelper onInsert={handleInsert} /></div>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #F1F0EC', padding: '10px 18px' }} className="flex justify-end">
          <button
            type="button"
            className={NOIR_BTN}
            style={{ height: 30, padding: '0 14px', fontSize: 12 }}
            onClick={handleSave}
            disabled={!dirty || isSaving}
          >
            {isSaving && <Loader2 size={12} className="animate-spin" />}
            Save changes
          </button>
        </div>
      </SpecCard>

      <SpecCard title="More automations" description="Coming soon to your workspace.">
        {[
          { icon: Bell, label: 'Applicant notifications', desc: 'Notify candidates as their application progresses.' },
          { icon: Calendar, label: 'Interview reminders', desc: 'Reminder emails before scheduled interviews.' },
          { icon: GitBranch, label: 'Stage alerts', desc: 'Alert your team when a candidate moves stage.' },
        ].map((row, i, arr) => {
          const Icon = row.icon
          return (
            <SpecRow key={row.label} last={i === arr.length - 1} className="opacity-60">
              <Icon size={16} color="#5A6072" />
              <div className="flex-1 min-w-0">
                <div className="font-inter text-[#0d0d09]" style={{ fontSize: 12.5, fontWeight: 600 }}>{row.label}</div>
                <div className="font-inter text-[#8B8F9E]" style={{ fontSize: 11 }}>{row.desc}</div>
              </div>
              <SpecChip tone="gray">Coming soon</SpecChip>
            </SpecRow>
          )
        })}
      </SpecCard>
    </div>
  )
}
