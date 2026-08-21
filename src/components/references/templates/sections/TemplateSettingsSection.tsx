import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FormField } from '@/components/ui/form-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PRIVACY_NOTICES, defaultReminders, type RefReminders } from '@/lib/references/templateModel'

const HAIRLINE = '#E7E8EE'
const MUTED = '#8B8F9E'

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

  return (
    <div className="space-y-5">
      <div>
        <h3
          className="font-poppins font-semibold text-[#0d0d09]"
          style={{ fontSize: 18, letterSpacing: '-0.04em' }}
        >
          Settings
        </h3>
        <p className="mt-1 font-inter text-[12.5px] text-[#5A6072]">
          Link lifetimes, reminders, consent and retention.
        </p>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <FormField label="Candidate link expiry" helpText="Days the candidate's secure link stays valid.">
          <Input
            type="number"
            min={1}
            value={candidateLinkDays}
            onChange={(e) => onChange({ candidate_link_days: Math.max(1, Number(e.target.value) || 1) })}
            className="h-[34px] font-inter text-[13px]"
          />
        </FormField>
        <FormField label="Referee link expiry" helpText="Days each referee's secure link stays valid.">
          <Input
            type="number"
            min={1}
            value={refereeLinkDays}
            onChange={(e) => onChange({ referee_link_days: Math.max(1, Number(e.target.value) || 1) })}
            className="h-[34px] font-inter text-[13px]"
          />
        </FormField>
      </div>

      <div className="space-y-3" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 16 }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-poppins font-medium text-[#0d0d09]" style={{ fontSize: 13.5 }}>
              Automatic reminders
            </p>
            <p className="font-inter" style={{ fontSize: 11.5, color: MUTED }}>
              Nudges stop as soon as the person completes their part.
            </p>
          </div>
          <Switch checked={rem.enabled} onCheckedChange={(v) => onChange({ reminders: { ...rem, enabled: v } })} />
        </div>

        {rem.enabled && (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <div className="rounded-xl bg-white p-3 space-y-2.5" style={{ border: `1px solid ${HAIRLINE}` }}>
              <p className="font-inter font-medium text-[#1F2230]" style={{ fontSize: 12.5 }}>
                Candidate cadence
              </p>
              <div className="flex items-center gap-2 font-inter text-[12px] text-[#5A6072]">
                First after
                <Input
                  type="number"
                  min={1}
                  value={rem.candidate_first_after_days}
                  onChange={(e) =>
                    onChange({ reminders: { ...rem, candidate_first_after_days: Math.max(1, Number(e.target.value) || 1) } })
                  }
                  className="h-[30px] w-[56px] font-inter text-[12.5px]"
                />
                days, then every
                <Input
                  type="number"
                  min={1}
                  value={rem.candidate_every_days}
                  onChange={(e) =>
                    onChange({ reminders: { ...rem, candidate_every_days: Math.max(1, Number(e.target.value) || 1) } })
                  }
                  className="h-[30px] w-[56px] font-inter text-[12.5px]"
                />
                days
              </div>
            </div>

            <div className="rounded-xl bg-white p-3 space-y-2.5" style={{ border: `1px solid ${HAIRLINE}` }}>
              <p className="font-inter font-medium text-[#1F2230]" style={{ fontSize: 12.5 }}>
                Referee cadence
              </p>
              <div className="flex items-center gap-2 font-inter text-[12px] text-[#5A6072]">
                First after
                <Input
                  type="number"
                  min={1}
                  value={rem.referee_first_after_days}
                  onChange={(e) =>
                    onChange({ reminders: { ...rem, referee_first_after_days: Math.max(1, Number(e.target.value) || 1) } })
                  }
                  className="h-[30px] w-[56px] font-inter text-[12.5px]"
                />
                days, max
                <Input
                  type="number"
                  min={1}
                  value={rem.referee_max}
                  onChange={(e) => onChange({ reminders: { ...rem, referee_max: Math.max(1, Number(e.target.value) || 1) } })}
                  className="h-[30px] w-[56px] font-inter text-[12.5px]"
                />
                reminders
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 16 }}>
        <FormField
          label="Consent text"
          required
          helpText="Shown to the candidate before they submit referees. Their agreement is recorded with a timestamp."
        >
          <Textarea
            value={consentText ?? ''}
            onChange={(e) => onChange({ consent_text: e.target.value })}
            rows={4}
            className="font-inter text-[13px]"
            placeholder="I confirm my referees have agreed to be contacted…"
          />
        </FormField>

        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
          <FormField label="Retention period" helpText="Months reference answers are kept before deletion.">
            <Input
              type="number"
              min={1}
              value={retentionMonths}
              onChange={(e) => onChange({ retention_months: Math.max(1, Number(e.target.value) || 1) })}
              className="h-[34px] font-inter text-[13px]"
            />
          </FormField>
          <FormField label="Privacy notice">
            <Select value={privacyNoticeId ?? ''} onValueChange={(v) => onChange({ privacy_notice_id: v })}>
              <SelectTrigger className="h-[34px] font-inter text-[13px]">
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
