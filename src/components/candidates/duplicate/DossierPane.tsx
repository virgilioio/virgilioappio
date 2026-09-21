import { Database, Briefcase, CalendarDays, Star, MessageSquare, Paperclip, Mail, GitCommit, Radio, XCircle, AlertTriangle, Info, FileText, Award } from 'lucide-react'
import { format } from 'date-fns'
import { StatusPill } from './StatusPill'
import { PaneLabel, SectionHeading } from './SectionHeading'
import type { DuplicateContext, DupActivity, DupApplication, DupStatus } from './types'

const PRETTY = { textWrap: 'pretty' as never }

const initials = (name?: string | null) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '—'

const shortDate = (iso?: string | null) => {
  if (!iso) return null
  try { return format(new Date(iso), 'MMM d, yyyy') } catch { return null }
}

const relative = (iso?: string | null) => {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  const d = Math.floor(ms / 86400000)
  if (d < 1) return 'today'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  if (m < 12) return `${m}mo ago`
  return `${Math.floor(m / 12)}y ago`
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-dup-border bg-dup-paper ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(13,13,9,.03)' }}
    >
      {children}
    </div>
  )
}

function MetaCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <div
        className="font-inter uppercase text-dup-subtle"
        style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}
      >
        {label}
      </div>
      <div className="font-inter text-dup-text break-words" style={{ fontSize: 11.5 }}>
        {value || '—'}
      </div>
    </div>
  )
}

const ACTIVITY_ICON: Record<DupActivity['kind'], { Icon: typeof Mail; cls: string }> = {
  email: { Icon: Mail, cls: 'text-dup-email' },
  calendar: { Icon: CalendarDays, cls: 'text-dup-purple' },
  file: { Icon: FileText, cls: 'text-dup-blue-dot' },
  scorecard: { Icon: Award, cls: 'text-dup-amber' },
}

function Callout({ tone, children }: { tone: 'live' | 'reject'; children: React.ReactNode }) {
  const live = tone === 'live'
  const Icon = live ? Radio : XCircle
  return (
    <div
      className={`mt-2 flex min-w-0 items-start gap-2 border ${live ? 'border-dup-info-border bg-dup-info-bg' : 'border-dup-reject-border bg-dup-reject-bg'}`}
      style={{ padding: '7px 9px', borderRadius: 7 }}
    >
      <Icon size={12} className={`mt-0.5 shrink-0 ${live ? 'text-dup-blue-fg' : 'text-dup-red-fg'}`} />
      <span
        className={`min-w-0 font-inter break-words ${live ? 'text-dup-blue-fg' : 'text-dup-red-fg'}`}
        style={{ fontSize: 11, ...PRETTY }}
      >
        {children}
      </span>
    </div>
  )
}

function ApplicationRow({ app, last }: { app: DupApplication; last: boolean }) {
  const sub = [app.department, app.location, `Req ${app.req_id}`].filter(Boolean).join(' · ')
  return (
    <div
      className="min-w-0"
      style={{ padding: '11px 13px', borderBottom: last ? undefined : '1px solid hsl(var(--dup-rule))' }}
    >
      <div className="flex min-w-0 items-start" style={{ gap: 9 }}>
        <div className="min-w-0 flex-1">
          <div
            className="font-poppins text-dup-text break-words"
            style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.015em', ...PRETTY }}
          >
            {app.job_title}
          </div>
          {sub && (
            <div className="font-inter text-dup-subtle break-words" style={{ fontSize: 10.5, ...PRETTY }}>
              {sub}
            </div>
          )}
        </div>
        <StatusPill status={app.status} />
      </div>

      <div className="flex min-w-0 flex-wrap items-center" style={{ marginTop: 9, gap: 8 }}>
        {app.stage_name && (
          <span
            className="inline-flex shrink-0 items-center gap-1 bg-dup-hairline font-inter text-dup-chip-fg"
            style={{ height: 21, padding: '0 8px', borderRadius: 6, fontSize: 11, fontWeight: 500 }}
          >
            <GitCommit size={10.5} className="text-dup-subtle" />
            {app.stage_name}
          </span>
        )}
        {app.last_moved_at && (
          <span className="min-w-0 font-inter text-dup-subtle" style={{ fontSize: 11 }}>
            moved {relative(app.last_moved_at)}
          </span>
        )}
        <span
          className="ml-auto inline-flex shrink-0 items-center justify-center rounded-full bg-dup-ink font-poppins text-dup-cream"
          style={{ width: 20, height: 20, fontSize: 9, fontWeight: 600 }}
          title={app.owner_name ?? undefined}
        >
          {app.owner_initials}
        </span>
      </div>

      {app.scheduled_interview && (
        <Callout tone="live">Interview scheduled for {shortDate(app.scheduled_interview.at)}</Callout>
      )}

      {app.open_offer && (
        <Callout tone="live">
          {app.open_offer.expires_at
            ? `Offer open, expires ${shortDate(app.open_offer.expires_at)}`
            : 'Offer open, no expiry recorded'}
        </Callout>
      )}

      {app.status === 'rejected' && (
        <Callout tone="reject">
          {app.rejection_reason || app.rejection_notes || 'Rejected, no reason recorded'}
          {app.rejected_at ? ` · ${shortDate(app.rejected_at)}` : ''}
          {app.rejected_by_name ? ` · by ${app.rejected_by_name}` : ''}
        </Callout>
      )}
    </div>
  )
}

export function DossierPane({
  context,
  onOpenProfile,
}: {
  context: DuplicateContext
  onOpenProfile?: () => void
}) {
  const c = context.candidate
  const name = c.candidate_name ?? 'This candidate'
  const location = [c.location_city, c.location_state, c.location_country].filter(Boolean).join(', ')
  const subtitle = [
    [c.current_job_title, c.company_current].filter(Boolean).join(' at '),
    location,
  ].filter(Boolean).join(' · ')

  const legend = (['active', 'offered', 'rejected', 'hired', 'withdrawn'] as DupStatus[])
    .map((s) => ({ s, n: context.applications.filter((a) => a.status === s).length }))
    .filter((x) => x.n > 0)

  const footprint: Array<{ Icon: typeof Briefcase; label: string; value: number }> = [
    { Icon: Briefcase, label: 'Applications', value: context.counts.applications },
    { Icon: CalendarDays, label: 'Interviews', value: context.counts.interviews },
    { Icon: Star, label: 'Scorecards', value: context.counts.scorecards },
    { Icon: MessageSquare, label: 'Notes', value: context.counts.notes },
    { Icon: Paperclip, label: 'Files', value: context.counts.files },
    { Icon: Mail, label: 'Emails', value: context.counts.emails },
  ]

  const dotFor = (s: DupStatus) =>
    s === 'active' ? 'bg-dup-blue-dot'
    : s === 'offered' ? 'bg-dup-purple'
    : s === 'rejected' ? 'bg-dup-red-dot'
    : s === 'hired' ? 'bg-dup-green-dot'
    : 'bg-dup-faint'

  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-contain border-r border-dup-hairline bg-dup-canvas"
      style={{ padding: '16px 18px 20px' }}
    >
      <PaneLabel icon={<Database size={12.5} className="shrink-0 text-dup-subtle" />}>
        Already in your database
      </PaneLabel>

      {/* identity */}
      <Card>
        <div className="min-w-0" style={{ padding: 14 }}>
          <div className="flex min-w-0 items-start" style={{ gap: 11 }}>
            <span
              className="flex shrink-0 items-center justify-center rounded-full bg-dup-ink font-poppins text-dup-cream"
              style={{ width: 42, height: 42, fontSize: 14, fontWeight: 600 }}
            >
              {initials(name)}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="font-poppins text-dup-text break-words"
                style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.025em' }}
              >
                {name}
              </div>
              {subtitle && (
                <div
                  className="font-inter text-dup-muted break-words"
                  style={{ fontSize: 11.5, lineHeight: 1.4, ...PRETTY }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <div
            className="grid"
            style={{
              marginTop: 13,
              paddingTop: 13,
              borderTop: '1px solid hsl(var(--dup-rule))',
              gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
              gap: '9px 12px',
            }}
          >
            <MetaCell label="Owner" value={context.owner} />
            <MetaCell label="Source" value={context.source} />
            <MetaCell label="In database since" value={shortDate(context.created_at)} />
            <MetaCell label="Candidate ID" value={String(c.id).slice(0, 8).toUpperCase()} />
          </div>
        </div>
      </Card>

      {/* footprint */}
      <Card className="overflow-hidden">
        <div className="grid min-w-0" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          {footprint.map((f, i) => (
            <div
              key={f.label}
              className="min-w-0"
              style={{
                padding: '11px 12px',
                borderLeft: i % 3 === 0 ? undefined : '1px solid hsl(var(--dup-rule))',
                borderTop: i >= 3 ? '1px solid hsl(var(--dup-rule))' : undefined,
              }}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <f.Icon size={11.5} className="shrink-0 text-dup-subtle" />
                <span
                  className="font-poppins text-dup-text"
                  style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.03em' }}
                >
                  {f.value}
                </span>
              </div>
              <div className="font-inter text-dup-subtle" style={{ fontSize: 10.5 }}>{f.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* applications */}
      {context.applications.length > 0 && (
        <section className="min-w-0">
          <SectionHeading title="Applications" count={context.applications.length} />
          <div className="flex min-w-0 flex-wrap items-center" style={{ marginTop: 6, marginBottom: 9, gap: 7 }}>
            {legend.map(({ s, n }, i) => (
              <span key={s} className="inline-flex items-center gap-2" style={{ fontSize: 11 }}>
                {i > 0 && <span className="text-dup-legend-divider">·</span>}
                <span className="inline-flex items-center gap-1 font-inter text-dup-muted">
                  <span className={`inline-block rounded-full ${dotFor(s)}`} style={{ width: 5, height: 5 }} />
                  {`${n} ${s}`}
                </span>
              </span>
            ))}
          </div>
          <Card>
            {context.applications.map((app, i) => (
              <ApplicationRow key={app.association_id} app={app} last={i === context.applications.length - 1} />
            ))}
          </Card>
        </section>
      )}

      {/* flags */}
      {context.flags.length > 0 && (
        <section className="min-w-0">
          <SectionHeading title="Before you merge" count={context.flags.length} />
          <div className="flex min-w-0 flex-col" style={{ marginTop: 8, gap: 8 }}>
            {[...context.flags]
              .sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'warning' ? -1 : 1))
              .map((flag) => {
                const warn = flag.tone === 'warning'
                const Icon = warn ? AlertTriangle : Info
                return (
                  <div
                    key={flag.id}
                    className={`flex min-w-0 border ${warn ? 'border-dup-warn-border bg-dup-warn-bg' : 'border-dup-flag-border bg-dup-canvas'}`}
                    style={{ padding: '10px 12px', borderRadius: 10, gap: 9 }}
                  >
                    <Icon size={13} className={`shrink-0 ${warn ? 'text-dup-warn-icon' : 'text-dup-subtle'}`} style={{ marginTop: 1 }} />
                    <div className="min-w-0">
                      <div
                        className={`font-inter break-words ${warn ? 'text-dup-warn-title' : 'text-dup-text'}`}
                        style={{ fontSize: 11.5, fontWeight: 600 }}
                      >
                        {flag.title}
                      </div>
                      {flag.body && (
                        <div
                          className="font-inter text-dup-muted break-words"
                          style={{ fontSize: 11, lineHeight: 1.5, ...PRETTY }}
                        >
                          {flag.body}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      )}

      {/* activity */}
      {context.activity.length > 0 && (
        <section className="min-w-0">
          <SectionHeading
            title="Recent activity"
            action={
              onOpenProfile ? (
                <button
                  type="button"
                  onClick={onOpenProfile}
                  title="Open full profile"
                  aria-label="Open full profile"
                  className="shrink-0 border-0 bg-transparent p-0 font-inter text-dup-purple hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dup-purple"
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  Open full profile
                </button>
              ) : undefined
            }
          />
          <Card className="mt-2">
            <div style={{ padding: '4px 13px' }}>
              {context.activity.slice(0, 4).map((ev, i) => {
                const { Icon, cls } = ACTIVITY_ICON[ev.kind] ?? ACTIVITY_ICON.file
                return (
                  <div
                    key={`${ev.at}-${i}`}
                    className="flex min-w-0 items-start"
                    style={{
                      padding: '10px 0',
                      gap: 9,
                      borderTop: i === 0 ? undefined : '1px solid hsl(var(--dup-rule))',
                    }}
                  >
                    <Icon size={12.5} className={`shrink-0 ${cls}`} style={{ marginTop: 1 }} />
                    <div className="min-w-0">
                      <div
                        className="font-inter text-dup-text break-words"
                        style={{ fontSize: 11.5, lineHeight: 1.45, ...PRETTY }}
                      >
                        {ev.text}
                      </div>
                      <div className="font-inter text-dup-subtle break-words" style={{ fontSize: 10.5 }}>
                        {`${ev.actor} · ${relative(ev.at)}`}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}
