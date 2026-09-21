import { useRef } from 'react'
import { GitMerge, ScanSearch, FileText, Check, User, Mail, Phone, MapPin, Building2, Linkedin, Banknote, Clock, AlignLeft, Tag, Briefcase, CalendarDays, ClipboardList, StickyNote, Paperclip, Plus } from 'lucide-react'
import { PaneLabel, SectionHeading } from './SectionHeading'
import type { DupField, DuplicateContext, Resolution } from './types'

const PRETTY = { textWrap: 'pretty' as never }

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
  const groupRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return
    e.preventDefault()
    const next: Resolution = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 'incoming' : 'existing'
    if (!disabled) onChange(next)
    const btn = groupRef.current?.querySelector<HTMLButtonElement>(`[data-side="${next}"]`)
    btn?.focus()
  }

  const Option = ({ side, text, tag, topBorder }: { side: Resolution; text: string; tag: string; topBorder?: boolean }) => {
    const selected = value === side
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        data-side={side}
        name={`dup-${field.key}`}
        disabled={disabled}
        onClick={() => onChange(side)}
        className={`flex w-full min-w-0 items-center border-0 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dup-purple disabled:cursor-not-allowed ${selected ? 'bg-dup-canvas' : 'bg-dup-paper'}`}
        style={{
          padding: '10px 12px',
          gap: 10,
          transitionDuration: '140ms',
          borderTop: topBorder ? '1px solid hsl(var(--dup-hairline))' : undefined,
        }}
      >
        <span
          className={`flex shrink-0 items-center justify-center rounded-full ${selected ? 'bg-dup-ink' : 'border-[1.5px] border-dup-radio bg-dup-paper'}`}
          style={{ width: 15, height: 15 }}
        >
          {selected && <Check size={9} strokeWidth={3.2} className="text-dup-cream" />}
        </span>
        <span
          className="min-w-0 flex-1 font-inter text-dup-text break-words"
          style={{ fontSize: 12, fontWeight: selected ? 500 : 400, lineHeight: 1.4, ...PRETTY }}
        >
          {text}
        </span>
        <span
          className={`shrink-0 font-inter uppercase ${side === 'incoming' ? 'text-dup-purple' : 'text-dup-subtle'}`}
          style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}
        >
          {tag}
        </span>
      </button>
    )
  }

  return (
    <div
      className="min-w-0 overflow-hidden border border-dup-border bg-dup-paper"
      style={{ borderRadius: 11, boxShadow: '0 1px 2px rgba(13,13,9,.03)' }}
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
      <div role="radiogroup" aria-label={field.label} ref={groupRef} onKeyDown={onKeyDown}>
        <Option side="existing" text={show(field.existing)} tag="On file" />
        <Option side="incoming" text={show(field.incoming)} tag="Incoming" topBorder />
      </div>
      {footnote && (
        <div
          className="border-t border-dup-hairline bg-dup-paper font-inter text-dup-subtle"
          style={{ padding: '8px 12px', fontSize: 10.5 }}
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
  first,
  children,
}: {
  Icon: typeof User
  label: string
  value: string
  tag?: string
  tagTone?: 'muted' | 'purple'
  first?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="min-w-0" style={{ borderTop: first ? undefined : '1px solid hsl(var(--dup-rule))' }}>
      <div className="flex min-w-0 items-baseline" style={{ padding: '8px 0', gap: 9 }}>
        <Icon size={12} className="shrink-0 text-dup-faint" style={{ position: 'relative', top: 2 }} />
        <span className="shrink-0 font-inter text-dup-subtle" style={{ width: 96, fontSize: 11 }}>
          {label}
        </span>
        <span
          className="min-w-0 flex-1 font-inter text-dup-text break-words"
          style={{ fontSize: 11.5, lineHeight: 1.4, ...PRETTY }}
        >
          {value}
        </span>
        {tag && (
          <span
            className={`shrink-0 font-inter uppercase ${tagTone === 'purple' ? 'text-dup-purple' : 'text-dup-subtle'}`}
            style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}
          >
            {tag}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function KeptRow({ Icon, text, first }: { Icon: typeof User; text: string; first?: boolean }) {
  return (
    <div
      className="flex min-w-0"
      style={{ padding: '7px 0', gap: 9, borderTop: first ? undefined : '1px solid hsl(var(--dup-rule))' }}
    >
      <Icon size={12} className="shrink-0 text-dup-faint" style={{ marginTop: 2 }} />
      <span
        className="min-w-0 font-inter text-dup-text break-words"
        style={{ fontSize: 11.5, lineHeight: 1.45, ...PRETTY }}
      >
        {text}
      </span>
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
  const identical = context.fields.filter((f) => f.classification === 'identical')
  const gaps = context.fields.filter((f) => f.classification === 'gap')
  const hasSkills = context.skills.new.length > 0
  const settled = [...identical, ...gaps]
  const counts = context.counts

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col gap-5 overflow-y-auto overflow-x-hidden overscroll-contain bg-dup-paper"
      style={{ padding: '16px 20px 22px' }}
    >
      <PaneLabel icon={<GitMerge size={12.5} className="shrink-0 text-dup-subtle" />}>The merge</PaneLabel>

      {/* provenance */}
      <div
        className="min-w-0 border border-dup-border bg-dup-paper"
        style={{ borderRadius: 11, padding: '12px 13px', boxShadow: '0 1px 2px rgba(13,13,9,.03)' }}
      >
        <div className="flex min-w-0 items-start" style={{ gap: 8 }}>
          <ScanSearch size={13} className="shrink-0 text-dup-subtle" style={{ marginTop: 1 }} />
          <span
            className="min-w-0 font-inter text-dup-text break-words"
            style={{ fontSize: 11.5, lineHeight: 1.45, ...PRETTY }}
          >
            {context.match.reasons.length
              ? `${context.match.reasons.join('. ')}.`
              : 'A close match was found on the details entered.'}
          </span>
        </div>
        <div
          className="flex min-w-0 items-start"
          style={{ gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid hsl(var(--dup-rule))' }}
        >
          <FileText size={13} className="shrink-0 text-dup-subtle" style={{ marginTop: 1 }} />
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
        <section className="min-w-0">
          <SectionHeading
            title="Needs your decision"
            count={conflicts.length}
            note="The two records disagree here. Pick the value that survives."
          />
          <div className="mt-2 flex min-w-0 flex-col" style={{ gap: 10 }}>
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
          </div>
        </section>
      )}

      {/* settled */}
      {(settled.length > 0 || hasSkills) && (
        <section className="min-w-0">
          <SectionHeading
            title="Applied automatically"
            count={settled.length + (hasSkills ? 1 : 0)}
            note="No conflict, so Gio has already settled these."
          />
          <div className="mt-2 min-w-0">
            {settled.map((f, i) => (
              <LedgerRow
                key={f.key}
                Icon={FIELD_ICON[f.key] ?? AlignLeft}
                label={f.label}
                value={show(f.classification === 'gap' ? f.incoming : f.existing)}
                tag={f.classification === 'gap' ? 'Filled' : 'Identical'}
                tagTone={f.classification === 'gap' ? 'purple' : 'muted'}
                first={i === 0}
              />
            ))}
            {hasSkills && (
              <LedgerRow
                Icon={Tag}
                label="Skills"
                value={`${context.skills.total} after merge — union of both records`}
                tag={`${context.skills.new.length} new`}
                tagTone="purple"
                first={settled.length === 0}
              >
                <div
                  className="flex min-w-0 flex-wrap"
                  style={{ marginTop: 10, paddingLeft: 21, paddingBottom: 8, gap: 6 }}
                >
                  {context.skills.new.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full bg-dup-purple-soft font-inter text-dup-purple-deep"
                      style={{ height: 23, padding: '0 9px', fontSize: 11, fontWeight: 500 }}
                    >
                      <Plus size={9.5} strokeWidth={2.5} />
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
        <SectionHeading title="Kept on the record" />
        <div className="mt-2 min-w-0">
          <KeptRow Icon={Briefcase} first text={`All ${counts.applications} applications, with their stages and outcomes`} />
          <KeptRow Icon={ClipboardList} text="Full stage history and time in stage" />
          <KeptRow Icon={CalendarDays} text={`${counts.interviews} interviews and ${counts.scorecards} scorecards`} />
          <KeptRow Icon={StickyNote} text={`${counts.notes} notes and ${counts.emails} emails`} />
          <KeptRow
            Icon={Paperclip}
            text={
              incomingFileName
                ? `${counts.files} files — the new resume is added as a version, nothing overwritten`
                : `${counts.files} files, nothing overwritten`
            }
          />
        </div>
      </section>
    </div>
  )
}
