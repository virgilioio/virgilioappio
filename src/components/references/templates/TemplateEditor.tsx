import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Eye,
  ListChecks,
  Mail,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ReferencesGlyph } from '@/components/icons/ReferencesGlyph'
import { cn } from '@/lib/utils'
import {
  defaultCandidateEmail,
  defaultRefereeEmail,
  isComplianceReady,
  type ReferenceTemplate,
  type ReferenceTemplateScope,
} from '@/lib/references/templateModel'
import { RefereeFieldsSection } from './sections/RefereeFieldsSection'
import { RequirementsSection } from './sections/RequirementsSection'
import { QuestionsSection } from './sections/QuestionsSection'
import { EmailsSection } from './sections/EmailsSection'
import { TemplateSettingsSection } from './sections/TemplateSettingsSection'
import { ScopeBadge } from './TemplateListTable'
import { useUserDisplayName } from '@/hooks/useUserDisplayNames'
import type { ClientOrg } from './useClientOrganizations'

/** e.g. 12 Aug 2026 */
function formatEditedDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const HAIRLINE = '#E7E8EE'
const MUTED = '#8B8F9E'

type SectionId = 'referees' | 'requirements' | 'questions' | 'emails' | 'settings'

const SECTIONS: { id: SectionId; label: string; icon: typeof Users }[] = [
  { id: 'referees', label: 'Referee fields', icon: Users },
  { id: 'requirements', label: 'Requirements', icon: ListChecks },
  { id: 'questions', label: 'Questions', icon: ListChecks },
  { id: 'emails', label: 'Emails', icon: Mail },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

interface Props {
  template: ReferenceTemplate
  clients: ClientOrg[]
  saving?: boolean
  onBack: () => void
  onSave: (patch: Partial<ReferenceTemplate>) => Promise<void> | void
  onDuplicate: () => void
}

export function TemplateEditor({ template, clients, saving, onBack, onSave, onDuplicate }: Props) {
  const [draft, setDraft] = useState<ReferenceTemplate>(template)
  const [active, setActive] = useState<SectionId>('referees')
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    setDraft(template)
  }, [template.id])

  const patch = (p: Partial<ReferenceTemplate>) => setDraft((d) => ({ ...d, ...p }))

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(template), [draft, template])
  const compliance = isComplianceReady(draft)
  const askedCount = draft.questions.filter((q) => q.ask_candidate_too).length
  const { name: editorName } = useUserDisplayName(template.updated_by)

  const summaries: Record<SectionId, string> = {
    referees: `${draft.referee_fields.length} fields · ${draft.referee_fields.filter((f) => f.required).length} required`,
    requirements: `${draft.min_referees}–${draft.max_referees} referees · ${draft.relationship_rules.length} rule${draft.relationship_rules.length === 1 ? '' : 's'}`,
    questions: `${draft.questions.length} questions · ${askedCount} also asked of the candidate`,
    emails: `Candidate + referee emails${draft.candidate_email?.subject ? '' : ' · subject missing'}`,
    settings: `${draft.candidate_link_days}d / ${draft.referee_link_days}d links · ${draft.reminders?.enabled ? 'reminders on' : 'reminders off'}`,
  }

  const handleSave = async () => {
    await onSave({
      name: draft.name,
      scope: draft.scope,
      client_id: draft.scope === 'client' ? draft.client_id : null,
      is_live: draft.is_live,
      min_referees: draft.min_referees,
      max_referees: draft.max_referees,
      relationship_rules: draft.relationship_rules,
      referee_fields: draft.referee_fields,
      questions: draft.questions,
      candidate_email: draft.candidate_email,
      referee_email: draft.referee_email,
      candidate_link_days: draft.candidate_link_days,
      referee_link_days: draft.referee_link_days,
      reminders: draft.reminders,
      consent_text: draft.consent_text,
      retention_months: draft.retention_months,
      privacy_notice_id: draft.privacy_notice_id,
    })
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 font-inter" style={{ fontSize: 11.5, color: MUTED }}>
        <span>Reference checks</span>
        <ChevronRight className="w-[12px] h-[12px]" strokeWidth={2} />
        <button
          type="button"
          onClick={onBack}
          className="hover:text-[#1F2230] transition-colors"
        >
          Templates
        </button>
        <ChevronRight className="w-[12px] h-[12px]" strokeWidth={2} />
        <span className="text-[#1F2230] truncate">{draft.name || 'Untitled template'}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>
          Templates
        </Button>
        <div
          className="shrink-0 grid place-items-center rounded-[10px] bg-[#0d0d09]"
          style={{ width: 34, height: 34 }}
        >
          <ReferencesGlyph className="w-[18px] h-[18px] fill-[#fffcf9] [&_.accent]:fill-[#D7C5FB]" />
        </div>
        <Input
          value={draft.name}
          onChange={(e) => patch({ name: e.target.value })}
          className="h-[36px] w-[280px] font-poppins font-semibold text-[15px]"
        />

        <label className="flex items-center gap-2 font-inter" style={{ fontSize: 12, color: '#5A6072' }}>
          <Switch checked={draft.is_live} onCheckedChange={(v) => patch({ is_live: v })} />
          Live
        </label>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={Copy} onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button variant="secondary" size="sm" icon={Eye} onClick={() => setPreviewOpen(true)}>
            Preview as candidate
          </Button>
          <Button size="sm" loading={saving} disabled={!dirty} onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </div>

      {/* Meta line */}
      <div className="flex flex-wrap items-center gap-2 font-inter" style={{ fontSize: 11.5, color: MUTED }}>
        <ScopeBadge scope={draft.scope} />
        <span>·</span>
        <span>Used on {template.times_used} checks</span>
        <span>·</span>
        <span>
          Last edited {formatEditedDate(template.updated_at)}
          {editorName ? ` by ${editorName}` : ''}
        </span>
      </div>


      <div className="grid gap-5" style={{ gridTemplateColumns: '272px minmax(0,1fr)' }}>
        {/* Rail */}
        <div className="space-y-3">
          <Card className="p-1.5">
            <div className="space-y-0.5">
              {SECTIONS.map((s) => {
                const Icon = s.icon
                const isActive = active === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActive(s.id)}
                    className={cn(
                      'w-full flex items-start gap-2.5 rounded-lg text-left transition-colors',
                      isActive ? 'bg-[#0d0d09]' : 'hover:bg-[rgba(13,13,9,0.05)]',
                    )}
                    style={{ padding: '8px 10px' }}
                  >
                    <Icon
                      className="w-[15px] h-[15px] mt-[2px] shrink-0"
                      strokeWidth={2}
                      style={{ color: isActive ? '#D7C5FB' : '#5A6072' }}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn('block font-poppins font-medium', isActive ? 'text-[#fffcf9]' : 'text-[#1F2230]')}
                        style={{ fontSize: 12.5, letterSpacing: '-0.01em' }}
                      >
                        {s.label}
                      </span>
                      <span
                        className="block font-inter truncate"
                        style={{ fontSize: 11, color: isActive ? 'rgba(255,252,249,0.65)' : MUTED }}
                      >
                        {summaries[s.id]}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Scope + live */}
          <Card className="relative z-20 p-3 space-y-2.5">
            <p
              className="font-inter font-semibold uppercase"
              style={{ fontSize: 10, letterSpacing: '0.06em', color: MUTED }}
            >
              Scope
            </p>
            <Select
              value={draft.scope}
              onValueChange={(v) => patch({ scope: v as ReferenceTemplateScope, client_id: v === 'client' ? draft.client_id : null })}
            >
              <SelectTrigger className="h-[32px] font-inter text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[80]">
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="client">Client</SelectItem>
                <SelectItem value="personalised">Personalised</SelectItem>
              </SelectContent>
            </Select>
            {draft.scope === 'client' && (
              <Select value={draft.client_id ?? ''} onValueChange={(v) => patch({ client_id: v })}>
                <SelectTrigger className="h-[32px] font-inter text-[12.5px]">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div
              className="flex items-start justify-between gap-3 pt-2.5"
              style={{ borderTop: `1px solid ${HAIRLINE}` }}
            >
              <div className="min-w-0">
                <p className="font-poppins font-medium text-[#1F2230]" style={{ fontSize: 12.5 }}>
                  Live
                </p>
                <p className="font-inter" style={{ fontSize: 11, color: MUTED }}>
                  Only live templates can be used on a new request.
                </p>
              </div>
              <Switch
                checked={draft.is_live}
                onCheckedChange={(v) => patch({ is_live: v })}
                aria-label="Live"
              />
            </div>
          </Card>


          {/* Compliance */}
          <Card
            className="p-3 space-y-1.5"
            style={{
              background: compliance.ready ? '#F0FDF4' : '#FFFBEB',
              borderColor: compliance.ready ? '#BBF7D0' : '#FDE68A',
            }}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck
                className="w-[15px] h-[15px]"
                strokeWidth={2}
                style={{ color: compliance.ready ? '#065F46' : '#92400E' }}
              />
              <p
                className="font-poppins font-medium"
                style={{ fontSize: 12.5, color: compliance.ready ? '#065F46' : '#92400E' }}
              >
                {compliance.ready ? 'Compliance ready' : 'Compliance incomplete'}
              </p>
            </div>
            <p
              className="font-inter leading-relaxed"
              style={{ fontSize: 11.5, color: compliance.ready ? '#065F46' : '#92400E' }}
            >
              {complianceSentence}
            </p>
          </Card>

        </div>

        {/* Section body */}
        <Card className="p-5">
          {active === 'referees' && (
            <RefereeFieldsSection
              fields={draft.referee_fields}
              onChange={(referee_fields) => patch({ referee_fields })}
            />
          )}
          {active === 'requirements' && (
            <RequirementsSection
              min={draft.min_referees}
              max={draft.max_referees}
              rules={draft.relationship_rules}
              onChange={patch}
            />
          )}
          {active === 'questions' && (
            <QuestionsSection questions={draft.questions} onChange={(questions) => patch({ questions })} />
          )}
          {active === 'emails' && (
            <EmailsSection
              candidateEmail={draft.candidate_email ?? defaultCandidateEmail()}
              refereeEmail={draft.referee_email ?? defaultRefereeEmail()}
              onChange={patch}
            />
          )}
          {active === 'settings' && (
            <TemplateSettingsSection
              candidateLinkDays={draft.candidate_link_days}
              refereeLinkDays={draft.referee_link_days}
              reminders={draft.reminders}
              consentText={draft.consent_text}
              retentionMonths={draft.retention_months}
              privacyNoticeId={draft.privacy_notice_id}
              onChange={patch}
            />
          )}
        </Card>
      </div>

      {previewOpen && (
        <CandidatePreview template={draft} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  )
}

/** Read-only look at what the candidate is asked for. */
function CandidatePreview({ template, onClose }: { template: ReferenceTemplate; onClose: () => void }) {
  const asked = template.questions.filter((q) => q.ask_candidate_too)
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-6" style={{ background: 'rgba(13,13,9,0.45)' }}>
      <Card className="w-full max-w-[560px] max-h-[80vh] overflow-auto p-5 space-y-4 bg-[#fffcf9]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              className="font-poppins font-semibold text-[#0d0d09]"
              style={{ fontSize: 18, letterSpacing: '-0.04em' }}
            >
              Preview as candidate
            </h3>
            <p className="font-inter text-[12.5px] text-[#5A6072]">{template.name}</p>
          </div>
          <Button variant="ghost" size="xs" icon={X} iconOnly aria-label="Close preview" onClick={onClose} />
        </div>

        <div className="space-y-1.5">
          <p className="font-poppins font-medium text-[#0d0d09]" style={{ fontSize: 13 }}>
            Referees ({template.min_referees}–{template.max_referees})
          </p>
          {template.referee_fields.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 font-inter"
              style={{ border: `1px solid ${HAIRLINE}`, fontSize: 12.5 }}
            >
              <span className="text-[#1F2230]">
                {f.label || 'Untitled field'}
                {f.required && <span style={{ color: '#9A3412' }}> *</span>}
              </span>
              <span style={{ color: MUTED, fontSize: 11 }}>{f.type}</span>
            </div>
          ))}
        </div>

        {asked.length > 0 && (
          <div className="space-y-1.5">
            <p className="font-poppins font-medium text-[#0d0d09]" style={{ fontSize: 13 }}>
              Self-assessment ({asked.length})
            </p>
            {asked.map((q) => (
              <div
                key={q.id}
                className="rounded-lg px-2.5 py-1.5 font-inter"
                style={{ background: '#FAF8FF', border: `1px solid #EDE4FF`, fontSize: 12.5, color: '#1F2230' }}
              >
                {q.label || 'Untitled question'} <span style={{ color: '#5B21B6', fontSize: 11 }}>· 1–5</span>
              </div>
            ))}
          </div>
        )}

        {template.consent_text && (
          <p
            className="font-inter leading-relaxed rounded-lg p-2.5"
            style={{ fontSize: 11.5, color: '#5A6072', background: '#F6F5F1' }}
          >
            {template.consent_text}
          </p>
        )}
      </Card>
    </div>
  )
}
