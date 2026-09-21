import { Database, Briefcase, CalendarDays, ClipboardList, StickyNote, Paperclip, Mail, GitCommit, Radio, XCircle, AlertTriangle, Info, FileText, Award } from 'lucide-react'
import { format } from 'date-fns'
import { StatusPill } from './StatusPill'
import type { DuplicateContext, DupActivity, DupApplication, DupStatus } from './types'

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-poppins uppercase text-dup-muted"
      style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em' }}
    >
      {children}
    </h3>
  )
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
        style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em' }}
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

function ApplicationRow({ app, last }: { app: DupApplication; last: boolean }) {
  return (
    <div
      className="min-w-0 px-3 py-2.5"
      style={{ borderBottom: last ? undefined : '1px solid hsl(var(--dup-rule))' }}
    >
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-poppins text-dup-text break-words" style={{ fontSize: 12.5, fontWeight: 600 }}>
            {app.job_title}
          </div>
          <div className="font-inter text-dup-subtle break-words" style={{ fontSize: 10.5 }}>
            {[app.department, app.location, `Req ${app.req_id}`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <StatusPill status={app.status} />
      </div>

      <div className="mt-2 flex min-w-0 items-center gap-2">
        {app.stage_name && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-dup-hairline font-inter text-dup-muted"
            style={{ padding: '3px 7px', fontSize: 10.5 }}
          >
            <GitCommit size={11} />
            {app.stage_name}
          </span>
        )}
        {app.last_moved_at && (
          <span className="min-w-0 truncate font-inter text-dup-subtle" style={{ fontSize: 11 }}>
            moved {relative(app.last_moved_at)}
          </span>
        )}
        <span
          className="ml-auto inline-flex shrink-0 items-center justify-center rounded-full bg-dup-hairline font-poppins text-dup-muted"
          style={{ width: 20, height: 20, fontSize: 9, fontWeight: 600 }}
          title={app.owner_name ?? undefined}
        >
          {app.owner_initials}
        </span>
      </div>

      {app.scheduled_interview && (
        <div
          className="mt-2 flex min-w-0 items-start gap-2 rounded-lg border border-dup-info-border bg-dup-info-bg"
          style={{ padding: '7px 9px' }}
        >
          <Radio size={12} className="mt-0.5 shrink-0 text-dup-blue-fg" />
          <span className="min-w-0 font-inter text-dup-blue-fg break-words" style={{ fontSize: 11 }}>
            Interview scheduled for {shortDate(app.scheduled_interview.at)}
          </span>
        </div>
      )}

      {app.open_offer && (
        <div
          className="mt-2 flex min-w-0 items-start gap-2 rounded-lg border border-dup-info-border bg-dup-info-bg"
          style={{ padding: '7px 9px' }}
        >
          <Radio size={12} className="mt-0.5 shrink-0 text-dup-blue-fg" />
          <span className="min-w-0 font-inter text-dup-blue-fg break-words" style={{ fontSize: 11 }}>
            {app.open_offer.expires_at
              ? `Offer open, expires ${shortDate(app.open_offer.expires_at)}`
              : 'Offer open, no expiry recorded'}
          </span>
        </div>
      )}

      {app.status === 'rejected' && (
        <div
          className="mt-2 flex min-w-0 items-start gap-2 rounded-lg border border-dup-reject-border bg-dup-reject-bg"
          style={{ padding: '7px 9px' }}
        >
          <XCircle size={12} className="mt-0.5 shrink-0 text-dup-red-fg" />
          <span className="min-w-0 font-inter text-dup-red-fg break-words" style={{ fontSize: 11 }}>
            {app.rejection_reason || app.rejection_notes || 'Rejected, no reason recorded'}
            {app.rejected_at ? ` · ${shortDate(app.rejected_at)}` : ''}
            {app.rejected_by_name ? ` · by ${app.rejected_by_name}` : ''}
          </span>
        </div>
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
    { Icon: ClipboardList, label: 'Scorecards', value: context.counts.scorecards },
    { Icon: StickyNote, label: 'Notes', value: context.counts.notes },
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
      className="flex min-w-0 flex-col gap-4 overflow-y-auto overflow-x-hidden border-r border-dup-hairline bg-dup-canvas"
      style={{ padding: '16px 18px 20px' }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Database size={13} className="shrink-0 text-dup-muted" />
        <SectionLabel>Already in your database</SectionLabel>
      </div>

      {/* identity */}
      <Card>
        <div className="min-w-0 p-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className="flex shrink-0 items-center justify-center rounded-full bg-dup-ink font-poppins text-dup-cream"
              style={{ width: 42, height: 42, fontSize: 14, fontWeight: 600 }}
            >
              {initials(name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-poppins text-dup-text break-words" style={{ fontSize: 14.5, fontWeight: 600 }}>
                {name}
              </div>
              {subtitle && (
                <div className="font-inter text-dup-muted break-words" style={{ fontSize: 11.5 }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          <div
            className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 pt-3"
            style={{ borderTop: '1px solid hsl(var(--dup-rule))' }}
          >
            <MetaCell label="Owner" value={context.owner} />
            <MetaCell label="Source" value={context.source} />
            <MetaCell label="In database since" value={shortDate(context.created_at)} />
            <MetaCell label="Candidate ID" value={String(c.id).slice(0, 8).toUpperCase()} />
          </div>
        </div>
      </Card>

      {/* footprint */}
      <Card>
        <div className="grid min-w-0 grid-cols-3">
          {footprint.map((f, i) => (
            <div
              key={f.label}
              className="min-w-0 px-3 py-2.5"
              style={{
                borderRight: i % 3 === 2 ? undefined : '1px solid hsl(var(--dup-rule))',
                borderBottom: i < 3 ? '1px solid hsl(var(--dup-rule))' : undefined,
              }}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <f.Icon size={11.5} className="shrink-0 text-dup-subtle" />
                <span className="font-poppins text-dup-text" style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.03em' }}>
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
          <div className="mb-2 flex min-w-0 flex-col gap-1">
            <SectionLabel>Applications · {context.applications.length}</SectionLabel>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {legend.map(({ s, n }) => (
                <span key={s} className="inline-flex items-center gap-1 font-inter text-dup-subtle" style={{ fontSize: 10.5 }}>
                  <span className={`inline-block rounded-full ${dotFor(s)}`} style={{ width: 5, height: 5 }} />
                  {n} {s}
                </span>
              ))}
            </div>
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
          <div className="mb-2">
            <SectionLabel>Before you merge · {context.flags.length}</SectionLabel>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            {context.flags.map((flag) => {
              const warn = flag.tone === 'warning'
              const Icon = warn ? AlertTriangle : Info
              return (
                <div
                  key={flag.id}
                  className={`min-w-0 rounded-xl border ${warn ? 'border-dup-warn-border bg-dup-warn-bg' : 'border-dup-flag-border bg-dup-canvas'}`}
                  style={{ padding: '9px 11px' }}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon size={13} className={`mt-0.5 shrink-0 ${warn ? 'text-dup-warn-icon' : 'text-dup-subtle'}`} />
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
                          style={{ fontSize: 11, lineHeight: 1.5 }}
                        >
                          {flag.body}
                        </div>
                      )}
                    </div>
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
          <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
            <SectionLabel>Recent activity</SectionLabel>
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="shrink-0 font-inter text-dup-purple hover:underline"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                Open full profile
              </button>
            )}
          </div>
          <Card>
            {context.activity.map((ev, i) => {
              const { Icon, cls } = ACTIVITY_ICON[ev.kind] ?? ACTIVITY_ICON.file
              return (
                <div
                  key={`${ev.at}-${i}`}
                  className="flex min-w-0 items-start gap-2 px-3 py-2.5"
                  style={{ borderBottom: i === context.activity.length - 1 ? undefined : '1px solid hsl(var(--dup-rule))' }}
                >
                  <Icon size={12.5} className={`mt-0.5 shrink-0 ${cls}`} />
                  <div className="min-w-0">
                    <div className="font-inter text-dup-text break-words" style={{ fontSize: 11.5 }}>{ev.text}</div>
                    <div className="font-inter text-dup-subtle break-words" style={{ fontSize: 10.5 }}>
                      {ev.actor} · {relative(ev.at)}
                    </div>
                  </div>
                </div>
              )
            })}
          </Card>
        </section>
      )}
    </div>
  )
}
