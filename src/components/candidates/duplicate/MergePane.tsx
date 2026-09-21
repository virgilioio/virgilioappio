import { GitMerge, ScanSearch, FileText, Check, User, Mail, Phone, MapPin, Building2, Linkedin, Banknote, Clock, AlignLeft, Tag, Briefcase, CalendarDays, ClipboardList, StickyNote, Paperclip, Plus } from 'lucide-react'
import type { DupField, DuplicateContext, Resolution } from './types'

const FIELD_ICON: Record<string, typeof User> = {
  candidate_name: User,
  email: Mail,
  phone: Phone,
  location_city: MapPin,
  location_state: MapPin,
  location_country: MapPin,
  current_job_title: Briefcase,
  company_current: Building2,
  linkedin_url: Linkedin,
  salary_amount: Banknote,
  salary_currency: Banknote,
  salary_period: Banknote,
  years_experience: Clock,
  profile_summary: AlignLeft,
  source: Tag,
}

const show = (v: any) => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return String(v)
  const s = String(v)
  return s.length > 240 ? `${s.slice(0, 240)}…` : s
}

function SectionLabel({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="min-w-0">
      <h3
        className="font-poppins uppercase text-dup-muted"
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em' }}
      >
        {children}
      </h3>
      {note && (
        <p className="mt-1 font-inter text-dup-subtle break-words" style={{ fontSize: 11.5 }}>
          {note}
        </p>
      )}
    </div>
  )
}

function ConflictCard({
  field,
  value,
  onChange,
  footnote,
  disabled,
}: {
  field: DupField
  value: Resolution
  onChange: (r: Resolution) => void
  footnote?: string
  disabled?: boolean
}) {
  const Icon = FIELD_ICON[field.key] ?? AlignLeft

  const Option = ({ side, text, tag }: { side: Resolution; text: string; tag: string }) => {
    const selected = value === side
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(side)}
        className={`flex w-full min-w-0 items-start gap-2.5 text-left transition-colors ${selected ? 'bg-dup-canvas' : 'bg-dup-paper'} disabled:cursor-not-allowed`}
        style={{ padding: '10px 12px', transitionDuration: '140ms' }}
      >
        <span
          className={`mt-px flex shrink-0 items-center justify-center rounded-full ${selected ? 'bg-dup-ink' : 'border-[1.5px] border-dup-radio bg-dup-paper'}`}
          style={{ width: 15, height: 15 }}
        >
          {selected && <Check size={9} strokeWidth={3} className="text-dup-cream" />}
        </span>
        <span
          className={`min-w-0 flex-1 font-inter text-dup-text break-words ${selected ? 'font-medium' : ''}`}
          style={{ fontSize: 12 }}
        >
          {text}
        </span>
        <span
          className={`shrink-0 font-inter uppercase ${side === 'incoming' ? 'text-dup-purple' : 'text-dup-subtle'}`}
          style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em' }}
        >
          {tag}
        </span>
      </button>
    )
  }

  return (
    <div
      className="min-w-0 overflow-hidden rounded-xl border border-dup-border"
      style={{ boxShadow: '0 1px 2px rgba(13,13,9,.03)' }}
    >
      <div
        className="flex min-w-0 items-center gap-2 border-b border-dup-hairline bg-dup-canvas"
        style={{ padding: '9px 12px' }}
      >
        <Icon size={12.5} className="shrink-0 text-dup-subtle" />
        <span className="min-w-0 truncate font-inter text-dup-text" style={{ fontSize: 11.5, fontWeight: 600 }}>
          {field.label}
        </span>
      </div>
      <Option side="existing" text={show(field.existing)} tag="On file" />
      <div style={{ borderTop: '1px solid hsl(var(--dup-hairline))' }}>
        <Option side="incoming" text={show(field.incoming)} tag="Incoming" />
      </div>
      {footnote && (
        <div
          className="border-t border-dup-hairline bg-dup-paper font-inter text-dup-subtle"
          style={{ padding: '7px 12px', fontSize: 10.5 }}
        >
          {footnote}
        </div>
      )}
    </div>
  )
}

function LedgerRow({
  Icon,
  label,
  value,
  tag,
  tagTone = 'muted',
  last,
  children,
}: {
  Icon: typeof User
  label: string
  value: string
  tag?: string
  tagTone?: 'muted' | 'purple'
  last?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="min-w-0" style={{ borderBottom: last ? undefined : '1px solid hsl(var(--dup-rule))' }}>
      <div className="flex min-w-0 items-start gap-2 py-2">
        <Icon size={12} className="mt-0.5 shrink-0 text-dup-faint" />
        <span
          className="shrink-0 font-inter text-dup-subtle"
          style={{ width: 96, fontSize: 11 }}
        >
          {label}
        </span>
        <span className="min-w-0 flex-1 font-inter text-dup-text break-words" style={{ fontSize: 11.5 }}>
          {value}
        </span>
        {tag && (
          <span
            className={`shrink-0 font-inter uppercase ${tagTone === 'purple' ? 'text-dup-purple' : 'text-dup-subtle'}`}
            style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em' }}
          >
            {tag}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

export function MergePane({
  context,
  resolutions,
  setResolution,
  incomingFileName,
  incomingProvenance,
  disabled,
}: {
  context: DuplicateContext
  resolutions: Record<string, Resolution>
  setResolution: (key: string, r: Resolution) => void
  incomingFileName: string | null
  incomingProvenance: string | null
  disabled?: boolean
}) {
  const conflicts = context.fields.filter((f) => f.classification === 'conflict')
  const settled = context.fields.filter((f) => f.classification !== 'conflict')
  const counts = context.counts

  return (
    <div
      className="flex min-w-0 flex-col gap-5 overflow-y-auto overflow-x-hidden bg-dup-paper"
      style={{ padding: '16px 20px 22px' }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <GitMerge size={13} className="shrink-0 text-dup-muted" />
        <h3
          className="font-poppins uppercase text-dup-muted"
          style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em' }}
        >
          The merge
        </h3>
      </div>

      {/* provenance */}
      <div
        className="min-w-0 rounded-xl border border-dup-border"
        style={{ boxShadow: '0 1px 2px rgba(13,13,9,.03)' }}
      >
        <div className="flex min-w-0 items-start gap-2" style={{ padding: '10px 12px' }}>
          <ScanSearch size={13} className="mt-0.5 shrink-0 text-dup-subtle" />
          <span className="min-w-0 font-inter text-dup-text break-words" style={{ fontSize: 11.5 }}>
            {context.match.reasons.length
              ? `Why we think this is a match: ${context.match.reasons.join(', ')}.`
              : 'A close match was found on the details entered.'}
          </span>
        </div>
        <div
          className="flex min-w-0 items-start gap-2"
          style={{ padding: '10px 12px', borderTop: '1px solid hsl(var(--dup-rule))' }}
        >
          <FileText size={13} className="mt-0.5 shrink-0 text-dup-subtle" />
          <div className="min-w-0">
            <div className="font-inter text-dup-text break-words" style={{ fontSize: 11.5 }}>
              {incomingFileName || 'Details entered by hand'}
            </div>
            {incomingProvenance && (
              <div className="font-inter text-dup-subtle break-words" style={{ fontSize: 10.5 }}>
                {incomingProvenance}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* conflicts */}
      {conflicts.length > 0 && (
        <section className="flex min-w-0 flex-col gap-2.5">
          <SectionLabel note="The two records disagree here. Pick the value that survives.">
            Needs your decision · {conflicts.length}
          </SectionLabel>
          {conflicts.map((f) => (
            <ConflictCard
              key={f.key}
              field={f}
              disabled={disabled}
              value={resolutions[f.key] ?? 'existing'}
              onChange={(r) => setResolution(f.key, r)}
              footnote={
                f.key === 'phone'
                  ? 'The other is kept as a secondary number either way.'
                  : f.key === 'email'
                  ? 'The other is kept as a secondary address either way.'
                  : undefined
              }
            />
          ))}
        </section>
      )}

      {/* settled */}
      {(settled.length > 0 || context.skills.new.length > 0) && (
        <section className="min-w-0">
          <SectionLabel note="No conflict, so Gio has already settled these.">
            Applied automatically · {settled.length + (context.skills.new.length ? 1 : 0)}
          </SectionLabel>
          <div className="mt-2 min-w-0">
            {settled.map((f, i) => (
              <LedgerRow
                key={f.key}
                Icon={FIELD_ICON[f.key] ?? AlignLeft}
                label={f.label}
                value={show(f.classification === 'gap' ? f.incoming : f.existing)}
                tag={f.classification === 'gap' ? 'Filled' : 'Identical'}
                tagTone={f.classification === 'gap' ? 'purple' : 'muted'}
                last={i === settled.length - 1 && context.skills.new.length === 0}
              />
            ))}
            {context.skills.new.length > 0 && (
              <LedgerRow
                Icon={Tag}
                label="Skills"
                value={`${context.skills.total} after merge — union of both records`}
                tag={`${context.skills.new.length} new`}
                tagTone="purple"
                last
              >
                <div className="flex min-w-0 flex-wrap gap-1.5 pb-2" style={{ paddingLeft: 21 }}>
                  {context.skills.new.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-md bg-dup-purple-soft font-inter text-dup-purple-deep"
                      style={{ padding: '2px 7px', fontSize: 10.5 }}
                    >
                      <Plus size={9} strokeWidth={2.5} />
                      {s}
                    </span>
                  ))}
                </div>
              </LedgerRow>
            )}
          </div>
        </section>
      )}

      {/* kept */}
      <section className="min-w-0">
        <SectionLabel>Kept on the record</SectionLabel>
        <div className="mt-2 min-w-0">
          <LedgerRow Icon={Briefcase} label="Applications" value={`All ${counts.applications}, with their stages and outcomes`} />
          <LedgerRow Icon={ClipboardList} label="Stage history" value="Full stage history and time in stage" />
          <LedgerRow Icon={CalendarDays} label="Interviews" value={`${counts.interviews} interviews and ${counts.scorecards} scorecards`} />
          <LedgerRow Icon={StickyNote} label="Notes" value={`${counts.notes} notes and ${counts.emails} emails`} />
          <LedgerRow
            Icon={Paperclip}
            label="Files"
            value={
              incomingFileName
                ? `${counts.files} on file — the new resume is added as a version, nothing overwritten`
                : `${counts.files} on file, untouched`
            }
            last
          />
        </div>
      </section>
    </div>
  )
}
