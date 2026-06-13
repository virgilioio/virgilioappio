import { useMemo } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import {
  FileText,
  Pencil,
  Sparkles,
  Globe,
  History,
  Info,
  Banknote,
  Users,
  Settings2,
  Check,
  Minus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'
import { useJobPostings } from '@/hooks/useJobPostings'
import { markdownToHtml } from '@/utils/markdown'

const WORK_MODE_LABEL: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
}
const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  temporary: 'Temporary',
}

interface JobOverviewTabProps {
  jobId: string
  job: any
  onEdit: () => void
  onNavigate: (tab: 'pipeline' | 'candidates' | 'postings' | 'job-setup' | 'sourcing') => void
}

function initials(first?: string | null, last?: string | null, email?: string | null) {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (f || l) return `${f[0] || ''}${l[0] || ''}`.toUpperCase() || '?'
  return (email || '?').slice(0, 2).toUpperCase()
}

function fmtDate(iso?: string | null) {
  if (!iso) return null
  try {
    return format(typeof iso === 'string' ? parseISO(iso) : iso, 'MMM d, yyyy')
  } catch {
    return null
  }
}

export function JobOverviewTab({ jobId, job, onEdit, onNavigate }: JobOverviewTabProps) {
  const { assignments } = useJobAssignments(jobId)
  const { members } = useMembers(true)
  const { jobPostings } = useJobPostings(jobId)

  const livePostingsCount = useMemo(
    () => (jobPostings || []).filter((p: any) => p.is_active).length,
    [jobPostings],
  )

  const memberById = useMemo(() => {
    const map = new Map<string, any>()
    for (const m of members) map.set(m.user_id, m)
    return map
  }, [members])

  const team = useMemo(() => {
    const ROLE_LABEL: Record<string, string> = {
      recruiter: 'Recruiter',
      hiring_manager: 'Hiring manager',
      interviewer: 'Interviewer',
    }
    return assignments
      .filter((a) => a.role !== 'interviewer')
      .map((a) => {
        const m = memberById.get(a.user_id)
        return {
          id: a.id,
          name:
            `${m?.user_first_name || ''} ${m?.user_last_name || ''}`.trim() ||
            m?.user_email ||
            'Member',
          email: m?.user_email,
          first: m?.user_first_name,
          last: m?.user_last_name,
          avatar: m?.user_avatar_url,
          role: ROLE_LABEL[a.role] || a.role,
        }
      })
  }, [assignments, memberById])

  const interviewers = useMemo(
    () =>
      assignments
        .filter((a) => a.role === 'interviewer')
        .map((a) => memberById.get(a.user_id))
        .filter(Boolean),
    [assignments, memberById],
  )

  // Description HTML
  const descriptionHtml = useMemo(() => {
    const raw = (job?.description || '').toString().trim()
    if (!raw) return null
    return markdownToHtml(raw)
  }, [job?.description])

  // Required skills
  const skills: string[] = Array.isArray(job?.skills) ? job.skills : []
  const minYears = job?.min_years_experience ?? null
  const maxYears = job?.max_years_experience ?? null
  const yearsLabel =
    minYears != null && maxYears != null
      ? `${minYears}–${maxYears} years`
      : minYears != null
        ? `${minYears}+ years`
        : maxYears != null
          ? `Up to ${maxYears} years`
          : 'Not specified'

  // Compensation
  const fmtMoney = (n: number | null | undefined) => {
    if (n == null) return null
    if (n >= 1000) {
      const k = n / 1000
      return `${Math.round(k)}k`
    }
    return n.toLocaleString()
  }
  const salaryLabel = (() => {
    const lo = fmtMoney(job?.salary_min)
    const hi = fmtMoney(job?.salary_max)
    if (!lo && !hi) return null
    if (lo && hi) return `$${lo} – $${hi}`
    if (lo) return `$${lo}+`
    return `Up to $${hi}`
  })()
  const currency = job?.currency || 'USD'

  // Details rows values
  const postedAt = job?.created_at ? fmtDate(job.created_at) : null
  const postedAgo = job?.created_at
    ? `${differenceInCalendarDays(new Date(), parseISO(job.created_at))} days ago`
    : null

  const targetIso: string | null = job?.target_fill_date ?? null
  const targetLabel = fmtDate(targetIso)
  const targetSub = (() => {
    if (!targetIso) return null
    const days = differenceInCalendarDays(parseISO(targetIso), new Date())
    if (days < 0)
      return { text: `${Math.abs(days)} days past target`, tone: 'amber' as const }
    if (days === 0) return { text: 'due today', tone: 'amber' as const }
    return { text: `${days} days to target — on target`, tone: 'green' as const }
  })()

  const locations: string[] = [
    ...(job?.location ? [job.location] : []),
    ...((job?.additional_locations as string[] | null) || []),
  ]
  const primaryLocation = locations[0] || null
  const extraLocations = locations.slice(1)

  // Reference: department prefix + year + last 3 of UUID
  const ref = useMemo(() => {
    const deptPrefix = (job?.department || 'JOB').toString().slice(0, 3).toUpperCase()
    const year = new Date(job?.created_at || Date.now()).getFullYear()
    const short = (job?.id || '').toString().replace(/-/g, '').slice(-3).toUpperCase() || '000'
    return `${deptPrefix}-${year}-${short}`
  }, [job?.id, job?.department, job?.created_at])

  return (
    <div className="h-full overflow-auto bg-[#F6F5F1]">
      <div className="mx-auto max-w-[1180px] px-[28px] pt-[20px] pb-[32px]">
        <div
          className="grid items-start"
          style={{
            gridTemplateColumns: 'minmax(0, 1fr) 320px',
            gap: 20,
          }}
        >
          {/* LEFT COLUMN ============================================== */}
          <div className="min-w-0 flex flex-col" style={{ gap: 14 }}>
            {/* Card 1 — About the role */}
            <Card>
              <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
                <CardTitle icon={FileText}>About the role</CardTitle>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <Badge tone="lilac" size="sm" icon={Sparkles}>
                    Gio rewrote · {fmtDate(job?.updated_at) || '—'}
                  </Badge>
                  <GhostButton icon={Pencil} onClick={onEdit}>
                    Edit
                  </GhostButton>
                </div>
              </div>

              {descriptionHtml ? (
                <div
                  className="font-inter overview-md"
                  style={{
                    color: '#3A3F4E',
                    fontSize: 13.5,
                    lineHeight: 1.7,
                  }}
                  dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                />
              ) : (
                <p
                  className="font-inter"
                  style={{ color: '#8B8F9E', fontSize: 13, lineHeight: 1.7 }}
                >
                  No description yet. Add one from the Edit Job sheet so candidates and Gio have something to work with.
                </p>
              )}

              <div
                className="flex items-center justify-between"
                style={{
                  marginTop: 18,
                  paddingTop: 12,
                  borderTop: '1px solid #F1F0EC',
                }}
              >
                <div
                  className="inline-flex items-center font-inter"
                  style={{ gap: 6, color: '#8B8F9E', fontSize: 11 }}
                >
                  <Globe size={11} strokeWidth={2} />
                  Shown on {livePostingsCount} live{' '}
                  {livePostingsCount === 1 ? 'posting' : 'postings'} · synced automatically
                </div>
                <GhostButton onClick={() => onNavigate('postings')}>View postings</GhostButton>
              </div>
            </Card>

            {/* Card 2 — Required skills */}
            <Card>
              <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
                <CardTitle icon={Sparkles}>Required skills</CardTitle>
                <Badge tone="lilac" size="sm">
                  Used for AI matching
                </Badge>
              </div>
              {skills.length === 0 ? (
                <p
                  className="font-inter"
                  style={{ color: '#8B8F9E', fontSize: 12.5 }}
                >
                  No skills set yet — add them from the Edit Job sheet.
                </p>
              ) : (
                <div className="flex flex-wrap" style={{ gap: 6 }}>
                  {skills.map((s) => (
                    <Badge key={s} tone="lilac" size="sm">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              <div
                className="flex items-center font-inter"
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: '1px solid #F1F0EC',
                  gap: 6,
                  color: '#5A6072',
                  fontSize: 12.5,
                }}
              >
                <History size={12} strokeWidth={2} />
                Experience:&nbsp;<strong style={{ color: '#1F2230', fontWeight: 600 }}>{yearsLabel}</strong>
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN ============================================ */}
          <div className="flex flex-col" style={{ width: 320, gap: 14 }}>
            {/* Card 1 — Details */}
            <Card padding={18}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <CardTitle icon={Info}>Details</CardTitle>
                <GhostButton iconOnly icon={Pencil} onClick={onEdit} aria-label="Edit details" />
              </div>

              <DetailRow label="Status">
                <span
                  className="inline-flex items-center font-inter"
                  style={{
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#065F46',
                    backgroundColor: '#D1FAE5',
                    padding: '2px 9px',
                    borderRadius: 999,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#12B886',
                    }}
                  />
                  {String(job?.status || '—').replace(/^\w/, (c) => c.toUpperCase())}
                </span>
              </DetailRow>
              <DetailRow label="Department" value={job?.department || '—'} />
              <DetailRow label="Job level" value={job?.job_level || '—'} />
              <DetailRow
                label="Employment type"
                value={EMPLOYMENT_LABEL[job?.employment_type] || '—'}
              />
              <DetailRow
                label="Work mode"
                value={WORK_MODE_LABEL[job?.work_mode] || '—'}
              />
              <DetailRow
                label="Locations"
                value={primaryLocation || '—'}
                sub={
                  extraLocations.length
                    ? `+ ${extraLocations.join(' · ')}`
                    : undefined
                }
              />
              <DetailRow
                label="Posted"
                value={postedAt || '—'}
                sub={postedAgo || undefined}
              />
              <DetailRow
                label="Target hire date"
                value={
                  targetLabel ? (
                    targetLabel
                  ) : (
                    <span style={{ color: '#B5B9C4' }}>—</span>
                  )
                }
                sub={
                  targetSub ? (
                    <span
                      style={{
                        color: targetSub.tone === 'amber' ? '#B45309' : '#0B7A52',
                      }}
                    >
                      {targetSub.text}
                    </span>
                  ) : undefined
                }
              />
              <DetailRow label="Reference" last>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", Menlo, monospace',
                    fontSize: 11.5,
                    color: '#1F2230',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {ref}
                </span>
              </DetailRow>
            </Card>

            {/* Card 2 — Compensation */}
            <Card padding={18}>
              <CardTitle icon={Banknote}>Compensation</CardTitle>
              <div style={{ marginTop: 10 }}>
                {salaryLabel ? (
                  <div className="flex items-baseline" style={{ gap: 6 }}>
                    <span
                      className="font-poppins"
                      style={{
                        fontSize: 22,
                        fontWeight: 600,
                        letterSpacing: '-0.035em',
                        color: '#0d0d09',
                      }}
                    >
                      {salaryLabel}
                    </span>
                    <span
                      className="font-inter"
                      style={{ fontSize: 12.5, fontWeight: 500, color: '#5A6072' }}
                    >
                      {currency} / yr
                    </span>
                  </div>
                ) : (
                  <div
                    className="font-inter"
                    style={{ color: '#8B8F9E', fontSize: 12.5 }}
                  >
                    Salary not set
                  </div>
                )}
              </div>
              <div className="flex flex-col" style={{ marginTop: 10, gap: 6 }}>
                <CompFlag on={!!job?.include_equity} label="Equity included" offLabel="No equity" />
                <CompFlag
                  on={!!job?.include_signing_bonus}
                  label="Signing bonus included"
                  offLabel="No signing bonus"
                />
              </div>
            </Card>

            {/* Card 3 — Hiring team */}
            <Card padding={18}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <CardTitle icon={Users}>Hiring team</CardTitle>
                <GhostButton
                  iconOnly
                  icon={Settings2}
                  onClick={() => onNavigate('job-setup')}
                  aria-label="Manage hiring team"
                />
              </div>

              {team.length === 0 ? (
                <p
                  className="font-inter"
                  style={{ color: '#8B8F9E', fontSize: 12.5, paddingTop: 6 }}
                >
                  No team assigned yet.
                </p>
              ) : (
                <div>
                  {team.map((m, i) => (
                    <div
                      key={m.id}
                      className="flex items-center"
                      style={{
                        gap: 10,
                        padding: '8px 0',
                        borderBottom: i === team.length - 1 ? 'none' : '1px solid #F1F0EC',
                      }}
                    >
                      <Avatar className="h-[26px] w-[26px]">
                        <AvatarImage src={m.avatar || undefined} />
                        <AvatarFallback
                          className="text-[10px] font-poppins font-medium"
                          style={{ backgroundColor: '#EDE4FF', color: '#6F3FF5' }}
                        >
                          {initials(m.first, m.last, m.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div
                          className="font-inter truncate"
                          style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}
                        >
                          {m.name}
                        </div>
                        <div
                          className="font-inter"
                          style={{ fontSize: 10.5, color: '#8B8F9E' }}
                        >
                          {m.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div
                className="flex items-center"
                style={{
                  marginTop: 10,
                  paddingTop: 12,
                  borderTop: '1px solid #F1F0EC',
                  gap: 10,
                }}
              >
                <div className="flex items-center" style={{ marginLeft: 0 }}>
                  {interviewers.slice(0, 4).map((m: any, i: number) => (
                    <Avatar
                      key={m.user_id || i}
                      className="h-[20px] w-[20px] ring-2 ring-white"
                      style={{ marginLeft: i === 0 ? 0 : -6 }}
                    >
                      <AvatarImage src={m.user_avatar_url || undefined} />
                      <AvatarFallback
                        className="text-[9px] font-poppins font-medium"
                        style={{ backgroundColor: '#EDE4FF', color: '#6F3FF5' }}
                      >
                        {initials(m.user_first_name, m.user_last_name, m.user_email)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span
                  className="font-inter"
                  style={{ fontSize: 11, color: '#8B8F9E' }}
                >
                  {interviewers.length === 0
                    ? 'No interviewers on the panel'
                    : `${interviewers.length} interviewer${interviewers.length === 1 ? '' : 's'} on the panel`}
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Local markdown styles scoped to the description body */}
      <style>{`
        .overview-md > * + * { margin-top: 8px; }
        .overview-md h1,.overview-md h2,.overview-md h3 {
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          font-size: 13.5px;
          color: #0d0d09;
          margin: 20px 0 8px;
          letter-spacing: -0.01em;
        }
        .overview-md p { color: #3A3F4E; line-height: 1.7; text-wrap: pretty; }
        .overview-md ul, .overview-md ol { padding-left: 18px; }
        .overview-md li { color: #3A3F4E; line-height: 1.65; margin-top: 6px; font-size: 13px; }
        .overview-md a { color: #6F3FF5; text-decoration: underline; text-underline-offset: 2px; }
        .overview-md strong { color: #0d0d09; font-weight: 600; }
      `}</style>
    </div>
  )
}

// -------------------------------------------------------------- helpers

function Card({
  children,
  padding = 24,
}: {
  children: React.ReactNode
  padding?: number
}) {
  return (
    <section
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(13,13,9,0.03)',
        padding,
      }}
    >
      {children}
    </section>
  )
}

function CardTitle({
  icon: Icon,
  children,
}: {
  icon: any
  children: React.ReactNode
}) {
  return (
    <div
      className="inline-flex items-center font-poppins"
      style={{
        gap: 7,
        fontSize: 14,
        fontWeight: 600,
        color: '#0d0d09',
        letterSpacing: '-0.01em',
      }}
    >
      <Icon size={14} strokeWidth={2} color="#5A6072" />
      {children}
    </div>
  )
}

function GhostButton({
  icon: Icon,
  iconOnly,
  children,
  onClick,
  'aria-label': ariaLabel,
}: {
  icon?: any
  iconOnly?: boolean
  children?: React.ReactNode
  onClick?: () => void
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center font-poppins"
      style={{
        gap: 5,
        height: 26,
        padding: iconOnly ? '0 6px' : '0 9px',
        borderRadius: 8,
        background: 'transparent',
        border: 'none',
        color: '#5A6072',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F1F0EC'
        ;(e.currentTarget as HTMLButtonElement).style.color = '#0d0d09'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
        ;(e.currentTarget as HTMLButtonElement).style.color = '#5A6072'
      }}
    >
      {Icon && <Icon size={12} strokeWidth={2} />}
      {!iconOnly && children}
    </button>
  )
}

function DetailRow({
  label,
  value,
  sub,
  children,
  last,
}: {
  label: string
  value?: React.ReactNode
  sub?: React.ReactNode
  children?: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className="flex items-start justify-between"
      style={{
        gap: 12,
        padding: '9px 0',
        borderBottom: last ? 'none' : '1px solid #F1F0EC',
      }}
    >
      <span
        className="font-inter"
        style={{ fontSize: 11.5, color: '#8B8F9E', flexShrink: 0, paddingTop: 1 }}
      >
        {label}
      </span>
      <div className="text-right min-w-0">
        <div
          className="font-inter"
          style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}
        >
          {children ?? value}
        </div>
        {sub && (
          <div
            className="font-inter"
            style={{ fontSize: 10.5, color: '#8B8F9E', marginTop: 1 }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

function CompFlag({
  on,
  label,
  offLabel,
}: {
  on: boolean
  label: string
  offLabel: string
}) {
  return (
    <div
      className="inline-flex items-center font-inter"
      style={{ gap: 6, fontSize: 12, color: on ? '#065F46' : '#8B8F9E' }}
    >
      {on ? (
        <Check size={12} strokeWidth={2.25} color="#12B886" />
      ) : (
        <Minus size={12} strokeWidth={2} color="#B5B9C4" />
      )}
      {on ? label : offLabel}
    </div>
  )
}
