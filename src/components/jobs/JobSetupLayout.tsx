import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { InlineEmpty } from '@/components/ui/empty-state'
import {
  Pencil,
  Globe,
  Activity,
  GitBranch,
  Users,
  Bell,
  Sparkles,
  ShieldAlert,
  Archive,
  XCircle,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { SectionCard, ToggleRow } from './wizard/_parts'
import { HiringPlanTab } from './HiringPlanTab'
import { usePermissions } from '@/hooks/usePermissions'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'
import { useJobs } from '@/hooks/useJobs'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'

interface JobSetupLayoutProps {
  jobId: string
  jobTitle: string
  job: any
  onEdit: () => void
  onAddTeamMember?: () => void
}

const ROLE_LABEL: Record<string, string> = {
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring manager',
  interviewer: 'Interviewer',
}

type SectionId =
  | 'hiring-plan'
  | 'auto-rejection'
  | 'ai-screen'
  | 'hiring-team'
  | 'notifications'
  | 'danger'

const NAV_CONFIG: Array<{ id: SectionId; label: string; icon: any }> = [
  { id: 'hiring-plan', label: 'Hiring plan', icon: GitBranch },
  { id: 'hiring-team', label: 'Hiring team', icon: Users },
]

const NAV_QUICK = [
  { id: 'edit-info', label: 'Edit job info', icon: Pencil },
  { id: 'manage-postings', label: 'Manage postings', icon: Globe },
  { id: 'activity', label: 'Activity log', icon: Activity },
] as const

function getInitials(first?: string | null, last?: string | null, email?: string | null) {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (f || l) return `${f[0] || ''}${l[0] || ''}`.toUpperCase() || '?'
  return (email || '?').slice(0, 2).toUpperCase()
}

export function JobSetupLayout({ jobId, jobTitle, job, onEdit, onAddTeamMember }: JobSetupLayoutProps) {
  const { isAdmin, isWorkspaceOwner, isPlatformAdmin } = usePermissions()
  const isReadOnly = !(isAdmin || isWorkspaceOwner || isPlatformAdmin)
  const { toast } = useToast()
  const { archiveJob, updateJob } = useJobs()

  const { assignments, updateAssignmentRole, removeUserFromJob } = useJobAssignments(jobId)
  const { members } = useMembers(true)

  const memberOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.user_id,
        label:
          `${m.user_first_name || ''} ${m.user_last_name || ''}`.trim() ||
          m.user_email ||
          'Member',
        description: m.user_email || undefined,
      })),
    [members]
  )

  // Primary recruiter / Hiring manager are derived from first matching assignment
  const primaryRecruiterId =
    assignments.find((a) => a.role === 'recruiter')?.user_id || ''
  const hiringManagerId =
    assignments.find((a) => a.role === 'hiring_manager')?.user_id || ''

  const teamMembers = assignments.map((a) => {
    const m = members.find((mm) => mm.user_id === a.user_id)
    const first = m?.user_first_name || ''
    const last = m?.user_last_name || ''
    return {
      assignmentId: a.id,
      userId: a.user_id,
      role: a.role,
      name: `${first} ${last}`.trim() || m?.user_email || 'Member',
      email: m?.user_email,
      avatarUrl: m?.user_avatar_url || null,
      title: (m as any)?.user_title || (m as any)?.job_title || null,
      first,
      last,
    }
  })

  // Local-only state for settings without dedicated columns yet.
  // TODO: persist into jobs.settings JSONB once column lands.
  const [rules, setRules] = useState({
    outsideLocations: true,
    salaryAbove25: true,
    sameCandidate90: false,
  })
  const [aiScreen, setAiScreen] = useState({
    autoScore: true,
    autoReject: true,
    autoRejectThreshold: 35,
    generateSummary: true,
  })
  const [notifications, setNotifications] = useState({
    notifyOwners: true,
    dailyDigest: true,
    notifyOnStageMove: false,
  })

  const stubSave = (label: string) =>
    toast({ title: 'Saved', description: `${label} updated.` })

  // Scroll spy
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<SectionId>('hiring-plan')
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const onScroll = () => {
      const headers = Array.from(
        root.querySelectorAll<HTMLElement>('[data-section]')
      )
      const top = root.scrollTop + 100
      let current: SectionId = 'hiring-plan'
      for (const h of headers) {
        if (h.offsetTop <= top) current = (h.dataset.section as SectionId) || current
      }
      setActive(current)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => root.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: SectionId) => {
    const root = scrollRef.current
    if (!root) return
    const el = root.querySelector<HTMLElement>(`[data-section="${id}"]`)
    if (el) root.scrollTo({ top: Math.max(0, el.offsetTop - 16), behavior: 'smooth' })
  }

  // Quick-link handlers
  const handleQuick = (id: string) => {
    if (id === 'edit-info') onEdit()
    else if (id === 'manage-postings') {
      // The Postings tab lives at sibling-tab level; emit a custom nav event
      window.dispatchEvent(new CustomEvent('job-detail:nav', { detail: 'postings' }))
    } else if (id === 'activity') {
      window.dispatchEvent(new CustomEvent('job-detail:nav', { detail: 'activity' }))
    }
  }

  // Hiring-team primary updates
  const updatePrimary = async (role: 'recruiter' | 'hiring_manager', newUserId: string) => {
    if (!newUserId) return
    const existing = assignments.find((a) => a.role === role)
    if (existing && existing.user_id === newUserId) return
    // Optimistic: not implementing add/swap here since hook signature varies.
    toast({
      title: 'Coming soon',
      description: `${role === 'recruiter' ? 'Primary recruiter' : 'Hiring manager'} swap will be wired in the next pass.`,
    })
  }

  const handleRoleChange = async (
    assignmentId: string,
    role: 'recruiter' | 'hiring_manager' | 'interviewer'
  ) => {
    try {
      await updateAssignmentRole(assignmentId, role)
    } catch {
      /* toast in hook */
    }
  }

  // Close / Archive dialogs
  const [showClose, setShowClose] = useState(false)
  const [showArchive, setShowArchive] = useState(false)

  const doClose = async () => {
    try {
      await updateJob(jobId, { status: 'closed' } as any)
      toast({ title: 'Job closed', description: `${jobTitle} is no longer accepting applications.` })
    } catch {
      /* toast in hook */
    } finally {
      setShowClose(false)
    }
  }
  const doArchive = async () => {
    try {
      await archiveJob(jobId)
      toast({ title: 'Job archived', description: `${jobTitle} moved to archive.` })
    } catch {
      /* toast in hook */
    } finally {
      setShowArchive(false)
    }
  }

  const lastEdited = job?.updated_at
    ? formatDistanceToNowStrict(new Date(job.updated_at), { addSuffix: false })
    : null
  const editorName = job?.last_edited_by_name || 'you'

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto bg-[#FAFAF7]"
    >
      <div className="mx-auto max-w-[1280px] px-6 sm:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100dvh-120px)] lg:overflow-auto">
            <div className="rounded-2xl border border-virgilio-border bg-white p-4">
              <div className="px-2 pt-1 pb-3">
                <div className="font-poppins font-semibold tracking-[-0.04em] text-[18px] text-text-primary">
                  Job setup<span className="text-virgilio-purple">.</span>
                </div>
                <div className="text-[12px] text-text-tertiary truncate">{jobTitle}</div>
              </div>

              <NavGroupLabel>Configuration</NavGroupLabel>
              <nav className="space-y-1">
                {NAV_CONFIG.map((item) => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={active === item.id}
                    onClick={() => scrollTo(item.id)}
                  />
                ))}
              </nav>

              <NavGroupLabel className="mt-4">Quick links</NavGroupLabel>
              <nav className="space-y-1">
                {NAV_QUICK.map((item) => (
                  <NavItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    muted
                    onClick={() => handleQuick(item.id)}
                  />
                ))}
              </nav>

              {lastEdited && (
                <div className="mt-4 rounded-xl bg-[#EDE4FF] px-3 py-3">
                  <div className="text-[10px] font-poppins font-semibold tracking-[0.14em] uppercase text-virgilio-purple">
                    Auto-saved
                  </div>
                  <div className="mt-1 text-[12px] text-text-primary leading-snug">
                    Last edit {lastEdited} ago by {editorName}.
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Main column */}
          <main className="space-y-8 min-w-0">
            {/* Hiring plan */}
            <div data-section="hiring-plan">
              <SectionCard
                title="Hiring plan · stages"
                trailing={
                  <span className="text-[12px] text-text-tertiary">
                    Drag to reorder · auto-saves
                  </span>
                }
              >
                <HiringPlanTab jobId={jobId} readOnly={isReadOnly} hideHeader />
              </SectionCard>
            </div>

            {/* Auto-rejection */}
            <div data-section="auto-rejection">
              <SectionCard title="Auto-rejection rules">
                <ToggleRow
                  label="Outside listed locations"
                  hint="Reject candidates not in the job's open regions."
                  checked={rules.outsideLocations}
                  onChange={(v) => {
                    setRules((r) => ({ ...r, outsideLocations: v }))
                    stubSave('Outside listed locations')
                  }}
                  disabled={isReadOnly}
                />
                <ToggleRow
                  label="Salary expectation >25% above range"
                  hint="Reject and keep on file."
                  checked={rules.salaryAbove25}
                  onChange={(v) => {
                    setRules((r) => ({ ...r, salaryAbove25: v }))
                    stubSave('Salary rule')
                  }}
                  disabled={isReadOnly}
                />
                <ToggleRow
                  label="Same candidate, last 90 days"
                  hint="Auto-reject re-applicants for the same role."
                  checked={rules.sameCandidate90}
                  onChange={(v) => {
                    setRules((r) => ({ ...r, sameCandidate90: v }))
                    stubSave('Same-candidate rule')
                  }}
                  disabled={isReadOnly}
                />
              </SectionCard>
            </div>

            {/* AI auto-screen */}
            <div data-section="ai-screen">
              <SectionCard
                title="AI auto-screen"
                trailing={
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EDE4FF] px-2.5 py-1 text-[11.5px] font-poppins font-medium text-virgilio-purple">
                    <Sparkles className="h-3 w-3" />
                    Gio
                  </span>
                }
              >
                <ToggleRow
                  label="Auto-score every application"
                  hint="Scores 0–100 based on required skills and experience."
                  checked={aiScreen.autoScore}
                  onChange={(v) => {
                    setAiScreen((s) => ({ ...s, autoScore: v }))
                    stubSave('Auto-score')
                  }}
                  disabled={isReadOnly}
                />
                <div className="flex items-start justify-between gap-4 py-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-poppins font-medium text-text-primary">
                      Auto-reject scores below
                    </div>
                    <p className="text-[12px] text-text-tertiary mt-0.5">
                      Sends a polite rejection email. Reviewable in the Rejected tab.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 items-center rounded-lg border border-virgilio-border bg-white pl-2.5 pr-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={aiScreen.autoRejectThreshold}
                        onChange={(e) =>
                          setAiScreen((s) => ({
                            ...s,
                            autoRejectThreshold: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          }))
                        }
                        onBlur={() => stubSave('Auto-reject threshold')}
                        className="w-12 bg-transparent text-[13px] tabular-nums outline-none text-text-primary"
                        disabled={isReadOnly || !aiScreen.autoReject}
                      />
                      <span className="text-[12px] text-text-tertiary pl-0.5 pr-1.5">/100</span>
                    </div>
                    <ToggleSwitch
                      checked={aiScreen.autoReject}
                      onChange={(v) => {
                        setAiScreen((s) => ({ ...s, autoReject: v }))
                        stubSave('Auto-reject')
                      }}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
                <ToggleRow
                  label="Generate AI candidate summary"
                  hint="3-paragraph summary attached to each candidate profile."
                  checked={aiScreen.generateSummary}
                  onChange={(v) => {
                    setAiScreen((s) => ({ ...s, generateSummary: v }))
                    stubSave('AI summary')
                  }}
                  disabled={isReadOnly}
                />
              </SectionCard>
            </div>

            {/* Hiring team */}
            <div data-section="hiring-team">
              <SectionCard
                title="Hiring team · roles"
                trailing={
                  <span className="text-[12px] text-text-tertiary">
                    {teamMembers.length} member{teamMembers.length === 1 ? '' : 's'}
                  </span>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <RoleSelect
                    label="Primary recruiter"
                    required
                    helper="Owns the job — receives all candidate notifications."
                    value={primaryRecruiterId}
                    options={memberOptions}
                    onChange={(v) => updatePrimary('recruiter', v)}
                    disabled={isReadOnly}
                  />
                  <RoleSelect
                    label="Hiring manager"
                    required
                    helper="Owns the bar and the final decision."
                    value={hiringManagerId}
                    options={memberOptions}
                    onChange={(v) => updatePrimary('hiring_manager', v)}
                    disabled={isReadOnly}
                  />
                </div>

                <div className="pt-2 border-t border-virgilio-border" />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-poppins font-semibold tracking-[0.12em] uppercase text-text-secondary">
                      Team members
                    </div>
                    <p className="text-[12px] text-text-tertiary mt-0.5">
                      Interviewers, coordinators, and observers.
                    </p>
                  </div>
                  {!isReadOnly && onAddTeamMember && (
                    <Button variant="secondary" size="sm" icon={Plus} onClick={onAddTeamMember}>
                      Add member
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {teamMembers.length === 0 ? (
                    <InlineEmpty text="No team members yet." />
                  ) : (
                    teamMembers.map((m) => (
                      <div
                        key={m.assignmentId}
                        className="flex items-center gap-3 rounded-xl border border-virgilio-border bg-white px-3 py-2.5"
                      >
                        <Avatar className="h-8 w-8">
                          {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="text-[11px] bg-virgilio-purple text-white">
                            {getInitials(m.first, m.last, m.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-poppins font-medium text-text-primary truncate">
                            {m.name}
                          </div>
                          <div className="text-[11.5px] text-text-tertiary truncate">
                            {m.title || m.email || '—'}
                          </div>
                        </div>
                        <div className="w-[180px]">
                          <Select
                            value={m.role}
                            onValueChange={(v) =>
                              handleRoleChange(m.assignmentId, v as any)
                            }
                            disabled={isReadOnly}
                          >
                            <SelectTrigger className="h-8 text-[13px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ROLE_LABEL).map(([v, label]) => (
                                <SelectItem key={v} value={v}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {!isReadOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={Trash2}
                            aria-label="Remove member"
                            onClick={() => removeUserFromJob(m.assignmentId)}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>

            {/* Notifications */}
            <div data-section="notifications">
              <SectionCard
                title="Notifications"
                trailing={
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] text-text-tertiary">
                    <Bell className="h-3 w-3" />
                    Workspace + Slack
                  </span>
                }
              >
                <ToggleRow
                  label="Notify owners on new applications"
                  hint="Slack DM + email to recruiter + HM"
                  checked={notifications.notifyOwners}
                  onChange={(v) => {
                    setNotifications((n) => ({ ...n, notifyOwners: v }))
                    stubSave('New-application notifications')
                  }}
                  disabled={isReadOnly}
                />
                <ToggleRow
                  label="Daily digest at 9:00 AM"
                  hint="Activity summary to recruiter only"
                  checked={notifications.dailyDigest}
                  onChange={(v) => {
                    setNotifications((n) => ({ ...n, dailyDigest: v }))
                    stubSave('Daily digest')
                  }}
                  disabled={isReadOnly}
                />
                <ToggleRow
                  label="Notify hiring team when stage moves"
                  hint="Slack channel #hiring-design"
                  checked={notifications.notifyOnStageMove}
                  onChange={(v) => {
                    setNotifications((n) => ({ ...n, notifyOnStageMove: v }))
                    stubSave('Stage-move notifications')
                  }}
                  disabled={isReadOnly}
                />
              </SectionCard>
            </div>

            {/* Danger */}
            {!isReadOnly && (
              <div data-section="danger">
                <SectionCard title="Close or archive this job">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-[#FFF1EC] inline-flex items-center justify-center">
                      <ShieldAlert className="h-5 w-5 text-[#9A4D00]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-poppins font-medium text-text-primary">
                        Close or archive this job
                      </div>
                      <p className="text-[12.5px] text-text-tertiary mt-0.5">
                        Closing stops new applications. Archiving moves it out of the active list — candidates stay in the talent pool.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={XCircle}
                        onClick={() => setShowClose(true)}
                      >
                        Close job
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Archive}
                        onClick={() => setShowArchive(true)}
                      >
                        Archive
                      </Button>
                    </div>
                  </div>
                </SectionCard>
              </div>
            )}

            <div className="h-12" />
          </main>
        </div>
      </div>

      <AlertDialog open={showClose} onOpenChange={setShowClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this job?</AlertDialogTitle>
            <AlertDialogDescription>
              Closing stops new applications. You can reopen it later from the job actions menu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doClose}>Close job</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showArchive} onOpenChange={setShowArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this job?</AlertDialogTitle>
            <AlertDialogDescription>
              Archiving moves the job out of the active list. Candidates stay in the talent pool.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ---------- Sidebar bits ---------- */

function NavGroupLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'px-2 pt-2 pb-1.5 text-[10.5px] font-inter font-semibold tracking-[0.14em] uppercase text-[#8B8F9E]',
        className
      )}
    >
      {children}
    </div>
  )
}

function NavItem({
  icon: Icon,
  label,
  active,
  muted,
  onClick,
}: {
  icon: any
  label: string
  active?: boolean
  muted?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full flex items-center gap-2.5 rounded-lg px-2.5 h-9 text-left text-[13px] font-poppins font-medium tracking-[-0.005em] transition-colors',
        active
          ? 'bg-[#0d0d09] text-[#fffcf9]'
          : muted
          ? 'text-text-tertiary hover:bg-[#F1F0EC] hover:text-text-primary'
          : 'text-text-primary hover:bg-[#F1F0EC]'
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', active ? 'text-[#fffcf9]' : '')} />
      <span className="truncate">{label}</span>
    </button>
  )
}

/* ---------- Role select (compact) ---------- */

function RoleSelect({
  label,
  required,
  helper,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  required?: boolean
  helper?: string
  value: string
  options: Array<{ value: string; label: string; description?: string }>
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-1 text-[13px] font-poppins font-medium text-text-primary mb-1.5">
        {label}
        {required && <span className="text-destructive">*</span>}
      </div>
      <SearchableSelect
        options={options}
        value={value}
        onValueChange={onChange}
        placeholder="Select member"
        searchPlaceholder="Search members…"
        disabled={disabled}
      />
      {helper && <p className="text-[12px] text-text-tertiary mt-1.5">{helper}</p>}
    </div>
  )
}

/* ---------- Inline switch (matches ToggleRow visual) ---------- */

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30',
        checked ? 'bg-pastel-green-foreground' : 'bg-virgilio-border',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

export default JobSetupLayout
