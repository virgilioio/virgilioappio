import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { SectionCard, ToggleRow, ChipInput } from '@/components/jobs/wizard/_parts'
import { Switch } from '@/components/ui/switch'
import { AffixInput } from '@/components/ui/affix-input'
import { Skeleton } from '@/components/ui/skeleton'
import { Loadable } from '@/components/ui/loadable'
import { LoadError } from '@/components/empty/LoadError'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJobSettings, type JobSettings } from '@/hooks/useJobSettings'
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates'
import { cn } from '@/lib/utils'

/**
 * The job's screening rules and team notifications (job_settings), shared by the
 * Create Job wizard and the job's Setup page. Every switch saves on change; the
 * Gio Fit bar saves --delay-autosave after typing stops. What each switch does is
 * the database's (see useJobSettings).
 */

interface JobFacts {
  salary_max?: number | null
  salary_period?: string | null
}

function GioChip({ label = 'Gio' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE4FF] px-2.5 py-1 text-[11.5px] font-poppins font-medium text-virgilio-purple">
      <Sparkles className="h-3 w-3" />
      {label}
    </span>
  )
}

/** Rows the size of the real ones while the settings load (§16). */
function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-5" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-1">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-[15px] w-48" />
            <Skeleton className="h-[13px] w-72 max-w-full" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function useSettingsState(jobId: string | null | undefined) {
  const s = useJobSettings(jobId)
  const ready = !!s.settings
  return { ...s, ready }
}

function Body({
  state,
  rows,
  children,
  what,
}: {
  state: ReturnType<typeof useSettingsState>
  rows: number
  children: (settings: JobSettings) => React.ReactNode
  what: string
}) {
  if (state.loadError && !state.settings) {
    return <LoadError what={what} onRetry={() => void state.refetch()} compact />
  }
  return (
    <Loadable loading={!state.ready} skeleton={<RowsSkeleton rows={rows} />}>
      {state.settings ? children(state.settings) : null}
    </Loadable>
  )
}

export function ScreeningRulesCard({
  jobId,
  job,
  readOnly,
}: {
  jobId: string | null
  job?: JobFacts | null
  readOnly?: boolean
}) {
  const state = useSettingsState(jobId)
  const { templates } = useRejectionEmailTemplates('organization')
  const activeTemplates = templates.filter((t) => t.is_active !== false)
  const salaryReady = job?.salary_max != null && !!job?.salary_period

  return (
    <SectionCard title="Auto-rejection rules">
      <Body state={state} rows={3} what="the screening rules">
        {(s) => (
          <div className="divide-y divide-virgilio-border/60">
            <div className="pb-3 space-y-3">
              <ToggleRow
                label="Outside the hiring countries"
                hint="Rejects applications from other countries. Candidates who don’t say where they live are kept."
                checked={s.reject_outside_countries}
                onChange={(v) => state.update({ reject_outside_countries: v })}
                disabled={readOnly}
              />
              <div>
                <ChipInput
                  values={s.hiring_countries}
                  onChange={(next) => state.update({ hiring_countries: next })}
                  placeholder="Add a country…"
                  tone="purple"
                  disabled={readOnly}
                />
                <p
                  className={cn(
                    'mt-1.5 min-h-[18px] text-[12px]',
                    s.reject_outside_countries && s.hiring_countries.length === 0 ? 'text-[#B54708]' : 'text-text-tertiary',
                  )}
                >
                  {s.hiring_countries.length === 0
                    ? s.reject_outside_countries
                      ? 'Add the countries this job hires in; with none, nobody is rejected.'
                      : 'The countries this job hires in. Remote roles can leave this empty.'
                    : 'Hiring countries, filled from the job’s locations.'}
                </p>
              </div>
            </div>
            <div className="py-3">
              <ToggleRow
                label={`Salary expectation over ${s.salary_margin_pct}% above the range`}
                hint={
                  salaryReady
                    ? 'Compares the candidate’s ask per month with the top of the range. Candidates who don’t give a salary are kept.'
                    : 'Needs the top of the salary range and its pay period, in Job information.'
                }
                checked={s.reject_salary_above}
                onChange={(v) => state.update({ reject_salary_above: v })}
                disabled={readOnly}
              />
            </div>
            <div className="py-3">
              <div className="flex items-start justify-between gap-4 py-1">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-poppins font-medium text-text-primary">Same candidate, last 90 days</p>
                  <p className="text-[12px] text-text-tertiary mt-0.5">
                    Someone who applied to this job in the last 90 days can’t apply again.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[#F1F0EC] px-2.5 py-1 text-[11.5px] font-poppins font-medium text-text-secondary">
                  Always on
                </span>
              </div>
            </div>
            <div className="pt-3 space-y-2">
              <p className="text-[12.5px] text-text-secondary">
                Gio’s rejections email the candidate at 9:00 the next morning, from the recruiter’s mailbox.
                Restore them in the Rejected tab before then and nothing is sent.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] text-text-tertiary">Email</span>
                <Select
                  value={s.reject_template_id ?? '__default__'}
                  onValueChange={(v) => state.update({ reject_template_id: v === '__default__' ? null : v })}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-9 w-[280px] max-w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Workspace default</SelectItem>
                    {activeTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </Body>
    </SectionCard>
  )
}

/** The Gio Fit bar: typing never saves per keystroke; it saves after a pause. */
function ThresholdInput({
  value,
  disabled,
  onSave,
}: {
  value: number
  disabled?: boolean
  onSave: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const timer = useRef<number | null>(null)
  useEffect(() => setDraft(String(value)), [value])
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
  const commit = (text: string) => {
    const n = Math.max(0, Math.min(100, Math.round(Number(text) || 0)))
    if (n !== value) onSave(n)
    setDraft(String(n))
  }
  return (
    <AffixInput
      aria-label="Gio Fit bar"
      inputMode="numeric"
      numeric
      suffix="/100"
      value={draft}
      disabled={disabled}
      wrapperClassName="w-[104px]"
      onChange={(e) => {
        const text = e.target.value.replace(/[^\d]/g, '').slice(0, 3)
        setDraft(text)
        if (timer.current) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => commit(text), 600)
      }}
      onBlur={() => {
        if (timer.current) window.clearTimeout(timer.current)
        commit(draft)
      }}
    />
  )
}

export function AiScreenCard({ jobId, readOnly }: { jobId: string | null; readOnly?: boolean }) {
  const state = useSettingsState(jobId)
  return (
    <SectionCard title="AI auto-screen" trailing={<GioChip />}>
      <Body state={state} rows={3} what="the AI screening">
        {(s) => (
          <div className="divide-y divide-virgilio-border/60">
            <div className="pb-3">
              <ToggleRow
                label="Auto-score every application"
                hint="Gio Fit scores each applicant 0–100 against the job’s skills and experience."
                checked={s.auto_score}
                onChange={(v) => state.update({ auto_score: v })}
                disabled={readOnly}
              />
            </div>
            <div className="py-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`bar-${jobId}`}
                  className="text-[13px] font-poppins font-medium text-text-primary cursor-pointer"
                >
                  Auto-reject scores below
                </label>
                <p className="text-[12px] text-text-tertiary mt-0.5">
                  {s.auto_score
                    ? 'Only the first score, and only while they’re still in Application review. Reviewable in the Rejected tab.'
                    : 'Needs auto-scoring on.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ThresholdInput
                  value={s.auto_reject_threshold}
                  disabled={readOnly || !s.auto_reject_below || !s.auto_score}
                  onSave={(v) => state.update({ auto_reject_threshold: v })}
                />
                <Switch
                  id={`bar-${jobId}`}
                  checked={s.auto_reject_below && s.auto_score}
                  disabled={readOnly || !s.auto_score}
                  onCheckedChange={(v) => state.update({ auto_reject_below: v })}
                />
              </div>
            </div>
            <div className="pt-3">
              <ToggleRow
                label="Generate AI candidate summary"
                hint="Gio’s summary on each applicant’s profile, written when their résumé is read."
                checked={s.ai_summary}
                onChange={(v) => state.update({ ai_summary: v })}
                disabled={readOnly}
              />
            </div>
          </div>
        )}
      </Body>
    </SectionCard>
  )
}

export function TeamNotificationsCard({ jobId, readOnly }: { jobId: string | null; readOnly?: boolean }) {
  const state = useSettingsState(jobId)
  return (
    <SectionCard title="Notifications">
      <Body state={state} rows={3} what="the notifications">
        {(s) => (
          <div className="divide-y divide-virgilio-border/60">
            <div className="py-1">
              <ToggleRow
                label="Notify the team on new applications"
                hint="In the bell for recruiters, hiring managers, the reporting manager and the coordinator, grouped per hour."
                checked={s.notify_applications}
                onChange={(v) => state.update({ notify_applications: v })}
                disabled={readOnly}
              />
            </div>
            <div className="py-1">
              <ToggleRow
                label="Daily digest at 9:00"
                hint="The last day’s applications, moves and Gio’s rejections, for the same people, to everyone who turns on Daily digest in Settings › Notifications."
                checked={s.daily_digest}
                onChange={(v) => state.update({ daily_digest: v })}
                disabled={readOnly}
              />
            </div>
            <div className="py-1">
              <ToggleRow
                label="Notify the team when candidates move stages"
                hint="In the bell, for everyone on the team except whoever moved them."
                checked={s.notify_stage_moves}
                onChange={(v) => state.update({ notify_stage_moves: v })}
                disabled={readOnly}
              />
            </div>
          </div>
        )}
      </Body>
    </SectionCard>
  )
}
