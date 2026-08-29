import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefToggle } from '@/components/references/RefToggle'
import { SectionHead } from '../rowKit'
import { PRIVACY_NOTICES, defaultReminders, type RefReminders } from '@/lib/references/templateModel'

const MUTED = '#8B8F9E'

const LINK_DAYS = [7, 14, 21, 30]
const RETENTION_MONTHS = [12, 24, 36]

/** Preset cadences — the model stores the numbers, the UI shows the sentence. */
const CANDIDATE_CADENCE: { key: string; label: string; first: number; every: number }[] = [
  { key: '2-3', label: 'After 2 days, then every 3 days', first: 2, every: 3 },
  { key: '3-4', label: 'After 3 days, then every 4 days', first: 3, every: 4 },
  { key: '5-7', label: 'After 5 days, then every 7 days', first: 5, every: 7 },
]

const REFEREE_CADENCE: { key: string; label: string; first: number; max: number }[] = [
  { key: '2-3', label: 'After 2 days, max 3 reminders', first: 2, max: 3 },
  { key: '3-2', label: 'After 3 days, max 2 reminders', first: 3, max: 2 },
  { key: '4-4', label: 'After 4 days, max 4 reminders', first: 4, max: 4 },
]

interface Props {
  candidateLinkDays: number
  refereeLinkDays: number
  reminders: RefReminders | null
  consentText: string | null
  retentionMonths: number
  privacyNoticeId: string | null
  onChange: (patch: {
    candidate_link_days?: number
    referee_link_days?: number
    reminders?: RefReminders
    consent_text?: string
    retention_months?: number
    privacy_notice_id?: string
  }) => void
}

export function TemplateSettingsSection({
  candidateLinkDays,
  refereeLinkDays,
  reminders,
  consentText,
  retentionMonths,
  privacyNoticeId,
  onChange,
}: Props) {
  const rem = reminders ?? defaultReminders()

  const candidateKey =
    CANDIDATE_CADENCE.find(
      (c) => c.first === rem.candidate_first_after_days && c.every === rem.candidate_every_days,
    )?.key ?? CANDIDATE_CADENCE[1].key

  const refereeKey =
    REFEREE_CADENCE.find(
      (c) => c.first === rem.referee_first_after_days && c.max === rem.referee_max,
    )?.key ?? REFEREE_CADENCE[0].key

  return (
    <div className="space-y-5">
      {/* Block A — Links & reminders */}
      <div>
        <SectionHead title="Links & reminders" />

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="Candidate link expires after" required>
            <Select
              value={String(candidateLinkDays)}
              onValueChange={(v) => onChange({ candidate_link_days: Number(v) })}
            >
              <SelectTrigger className="h-[34px] font-inter text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Referee link expires after" required>
            <Select
              value={String(refereeLinkDays)}
              onValueChange={(v) => onChange({ referee_link_days: Number(v) })}
            >
              <SelectTrigger className="h-[34px] font-inter text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINK_DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F6F5F1' }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <p className="font-inter" style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}>
                Automatic reminders
              </p>
              <p className="font-inter" style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                Sent to anyone who hasn't responded.
              </p>
            </div>
            <RefToggle
              checked={rem.enabled}
              onChange={(v) => onChange({ reminders: { ...rem, enabled: v } })}
              ariaLabel="Automatic reminders"
            />
          </div>

          {rem.enabled && (
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
              <FormField label="Remind candidate">
                <Select
                  value={candidateKey}
                  onValueChange={(v) => {
                    const c = CANDIDATE_CADENCE.find((x) => x.key === v)
                    if (!c) return
                    onChange({
                      reminders: {
                        ...rem,
                        candidate_first_after_days: c.first,
                        candidate_every_days: c.every,
                      },
                    })
                  }}
                >
                  <SelectTrigger className="h-[34px] font-inter text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANDIDATE_CADENCE.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Remind referee">
                <Select
                  value={refereeKey}
                  onValueChange={(v) => {
                    const c = REFEREE_CADENCE.find((x) => x.key === v)
                    if (!c) return
                    onChange({
                      reminders: {
                        ...rem,
                        referee_first_after_days: c.first,
                        referee_max: c.max,
                      },
                    })
                  }}
                >
                  <SelectTrigger className="h-[34px] font-inter text-[12.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFEREE_CADENCE.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          )}
        </div>
      </div>

      {/* Block B — Consent & retention */}
      <div>
        <SectionHead
          title="Consent & retention"
          subtitle="Shown to the candidate before any referee is contacted. Required."
        />

        <FormField
          label="Consent text"
          required
          helpText="Recorded with a timestamp when the candidate ticks it."
        >
          <Textarea
            value={consentText ?? ''}
            onChange={(e) => onChange({ consent_text: e.target.value })}
            rows={3}
            className="font-inter text-[12.5px]"
            placeholder="I confirm that I have asked each person listed above for their permission…"
          />
        </FormField>

        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <FormField
            label="Retain responses for"
            required
            helpText="Responses are archived and purged after this period."
          >
            <Select
              value={String(retentionMonths)}
              onValueChange={(v) => onChange({ retention_months: Number(v) })}
            >
              <SelectTrigger className="h-[34px] font-inter text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETENTION_MONTHS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} months
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="Privacy notice"
            required
            helpText="Shown to every referee at the point of collection."
          >
            <Select
              value={privacyNoticeId ?? ''}
              onValueChange={(v) => onChange({ privacy_notice_id: v })}
            >
              <SelectTrigger className="h-[34px] font-inter text-[12.5px]">
                <SelectValue placeholder="Select a privacy notice" />
              </SelectTrigger>
              <SelectContent>
                {PRIVACY_NOTICES.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>
    </div>
  )
}
