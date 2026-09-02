import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { InlineEmpty } from '@/components/ui/empty-state'
import {
  Pencil,
  Globe,
  Activity,
  History,
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
  ChevronDown,
  Check,
  Calendar as CalendarIcon,
  UserRound,
  MoreHorizontal,
  Star,
  Crown,
  User as UserIcon,
  ListChecks,
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
import { OfferApprovalChainConfig } from './OfferApprovalChainConfig'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { supabase } from '@/integrations/supabase/client'


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
  | 'offer-approval'
  | 'notifications'
  | 'danger'

const NAV_CONFIG: Array<{ id: SectionId; label: string; icon: any }> = [
  { id: 'hiring-plan', label: 'Hiring plan', icon: GitBranch },
  { id: 'hiring-team', label: 'Hiring team', icon: Users },
  { id: 'offer-approval', label: 'Offer approval', icon: ListChecks },
]

const NAV_QUICK = [
  { id: 'edit-info', label: 'Edit job info', icon: Pencil },
  { id: 'manage-postings', label: 'Manage postings', icon: Globe },
  { id: 'activity', label: 'Activity log', icon: History },
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

  const { assignments, updateAssignmentRole, removeUserFromJob, assignUserToJob, getAssignments } =
    useJobAssignments(jobId)
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

    try {
      // Demote the current holder rather than removing their access.
      if (existing) {
        await updateAssignmentRole(existing.id, 'interviewer')
      }
      const alreadyOnJob = assignments.find((a) => a.user_id === newUserId)
      if (alreadyOnJob) {
        await updateAssignmentRole(alreadyOnJob.id, role)
      } else {
        await assignUserToJob({ job_id: jobId, user_id: newUserId, role })
      }
      await getAssignments(jobId)
    } catch {
      /* toast in hook */
    }
  }

  // ---- Optional owners (persisted on the job row) ----
  const [reportsToId, setReportsToId] = useState<string>(job?.reports_to_user_id || '')
  const [coordinatorId, setCoordinatorId] = useState<string>(job?.coordinator_user_id || '')

  useEffect(() => {
    setReportsToId(job?.reports_to_user_id || '')
    setCoordinatorId(job?.coordinator_user_id || '')
  }, [job?.reports_to_user_id, job?.coordinator_user_id])

  const saveOptionalOwner = async (
    column: 'reports_to_user_id' | 'coordinator_user_id',
    value: string | null
  ) => {
    if (column === 'reports_to_user_id') setReportsToId(value || '')
    else setCoordinatorId(value || '')
    const { error } = await supabase
      .from('jobs')
      .update({ [column]: value })
      .eq('id', jobId)
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
      // revert
      if (column === 'reports_to_user_id') setReportsToId(job?.reports_to_user_id || '')
      else setCoordinatorId(job?.coordinator_user_id || '')
      return
    }
    toast({
      title: 'Saved',
      description: column === 'reports_to_user_id' ? 'Reports to updated.' : 'Coordinator updated.',
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
      className="h-full overflow-auto bg-[#F6F5F1]"
    >
      <div className="mx-auto max-w-[1280px] px-6 sm:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[224px_minmax(0,1fr)] items-start gap-[26px]">
          {/* Sidebar — flat rail */}
          <aside className="lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100dvh-120px)] lg:overflow-auto">
            <div style={{ padding: '0 10px 12px' }}>
              <div
                className="font-poppins"
                style={{ fontSize: 16, fontWeight: 600, color: '#0d0d09', letterSpacing: '-0.03em' }}
              >
                Job setup<span style={{ color: '#D7C5FB' }}>.</span>
              </div>
              <div
                className="font-inter truncate"
                style={{ fontSize: 11, color: '#8B8F9E', marginTop: 2 }}
              >
                {jobTitle}
              </div>
            </div>

            <NavGroupLabel>Configuration</NavGroupLabel>
            <nav className="flex flex-col gap-px">
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

            <NavGroupLabel>Quick links</NavGroupLabel>
            <nav className="flex flex-col gap-px">
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
              <div
                className="font-inter"
                style={{
                  margin: '14px 10px 0',
                  borderTop: '1px solid #E7E8EE',
                  paddingTop: 10,
                  fontSize: 10.5,
                  color: '#B5B9C4',
                  lineHeight: 1.5,
                }}
              >
                Auto-saved · last edit {lastEdited} ago by {editorName}.
              </div>
            )}
          </aside>


          {/* Main column */}
          <main className="space-y-8 min-w-0">
            {/* Hiring plan */}
            <div data-section="hiring-plan">
              <HiringPlanTab jobId={jobId} readOnly={isReadOnly} hideHeader />
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
              <section className="space-y-5">
                {/* Section heading */}
                <div className="flex items-end justify-between gap-3">
                  <h2
                    className="font-poppins"
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      letterSpacing: '-0.03em',
                      color: '#0d0d09',
                      lineHeight: 1.2,
                    }}
                  >
                    Hiring team
                    <span style={{ color: '#D7C5FB' }}>.</span>
                  </h2>
                  <span
                    className="font-inter"
                    style={{
                      background: '#F1F0EC',
                      color: '#5A6072',
                      fontSize: 11.5,
                      fontWeight: 500,
                      borderRadius: 999,
                      padding: '4px 11px',
                    }}
                  >
                    {teamMembers.length} member{teamMembers.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* OWNERS block */}
                <div className="space-y-2.5">
                  <SubsectionLabel>Owners</SubsectionLabel>
                  <div className="rounded-2xl border border-virgilio-border bg-white p-5 sm:p-6 space-y-5">
                    <OwnerPickerRow
                      label="Primary recruiter"
                      required
                      helper="Owns the job — receives all candidate notifications."
                      value={primaryRecruiterId}
                      members={members}
                      roleLabel="Recruiter"
                      onChange={(v) => updatePrimary('recruiter', v)}
                      disabled={isReadOnly}
                    />
                    <OwnerPickerRow
                      label="Hiring manager"
                      required
                      helper="Owns the bar and the final decision."
                      value={hiringManagerId}
                      members={members}
                      roleLabel="Hiring manager"
                      onChange={(v) => updatePrimary('hiring_manager', v)}
                      disabled={isReadOnly}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                      <CompactOwnerPicker
                        label="Reports to"
                        icon={UserRound}
                        placeholder="Select person"
                        clearLabel="No one in particular"
                        value={reportsToId}
                        members={members}
                        disabled={isReadOnly}
                        onChange={(v) => saveOptionalOwner('reports_to_user_id', v)}
                      />
                      <CompactOwnerPicker
                        label="Coordinator"
                        icon={CalendarIcon}
                        placeholder="Same as recruiter"
                        clearLabel="Same as recruiter"
                        value={coordinatorId}
                        members={members}
                        disabled={isReadOnly}
                        onChange={(v) => saveOptionalOwner('coordinator_user_id', v)}
                      />
                    </div>

                    <p
                      className="font-inter"
                      style={{ fontSize: 12, color: '#8B8F9E', marginTop: -6 }}
                    >
                      Schedules + reminders. Defaults to recruiter.
                    </p>
                  </div>
                </div>

                {/* TEAM MEMBERS block */}
                <div className="space-y-2.5">
                  <div className="flex items-end justify-between gap-3">
                    <SubsectionLabel>Team members</SubsectionLabel>
                    {!isReadOnly && onAddTeamMember && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Plus}
                        onClick={onAddTeamMember}
                      >
                        Add member
                      </Button>
                    )}
                  </div>

                  <div className="rounded-2xl border border-virgilio-border bg-white p-3 sm:p-4">
                    {teamMembers.length === 0 ? (
                      <div
                        className="font-inter"
                        style={{
                          textAlign: 'center',
                          padding: '22px 12px',
                          fontSize: 12.5,
                          color: '#8B8F9E',
                        }}
                      >
                        No team members yet.
                      </div>
                    ) : (
                      <div className="flex flex-col" style={{ gap: 6 }}>
                        {teamMembers.map((m) => (
                          <TeamMemberRow
                            key={m.assignmentId}
                            member={m}
                            readOnly={isReadOnly}
                            onRoleChange={(v) => handleRoleChange(m.assignmentId, v)}
                            onRemove={() => removeUserFromJob(m.assignmentId)}
                            onPromotePrimary={() => updatePrimary('recruiter', m.userId)}
                            onPromoteHM={() => updatePrimary('hiring_manager', m.userId)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>


            {/* Offer approval */}
            <div data-section="offer-approval" className="pt-2">
              <OfferApprovalChainConfig jobId={jobId} jobTitle={jobTitle} />
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
      className={cn('font-inter uppercase', className)}
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        color: '#8B8F9E',
        padding: '0 10px',
        margin: '14px 0 5px',
      }}
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
        'group w-full flex items-center text-left font-inter transition-colors',
        active ? '' : 'hover:bg-[rgba(13,13,9,0.05)]'
      )}
      style={{
        gap: 9,
        padding: '7px 10px',
        borderRadius: 8,
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        background: active ? '#0d0d09' : 'transparent',
        color: active ? '#fffcf9' : '#1F2230',
        opacity: muted && !active ? 0.75 : 1,
        transition: 'background 140ms ease',
      }}
    >
      <Icon
        size={14}
        strokeWidth={2}
        style={{ color: active ? '#fffcf9' : '#5A6072', flexShrink: 0 }}
      />
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

/* ---------- Hiring team sub-parts ---------- */

function SubsectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-poppins"
      style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        color: '#5A6072',
        paddingLeft: 2,
      }}
    >
      {children}
    </div>
  )
}

function OwnerPickerRow({
  label,
  required,
  helper,
  value,
  members,
  roleLabel,
  onChange,
  disabled,
}: {
  label: string
  required?: boolean
  helper?: string
  value: string
  members: any[]
  roleLabel: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = members.find((m) => m.user_id === value)
  const name =
    selected
      ? `${selected.user_first_name || ''} ${selected.user_last_name || ''}`.trim() ||
        selected.user_email ||
        'Member'
      : ''

  return (
    <div>
      <div
        className="font-poppins"
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: '#1F2230',
          marginBottom: 6,
          letterSpacing: '-0.005em',
        }}
      >
        {label}
        {required && <span style={{ color: '#DC2626', marginLeft: 4 }}>*</span>}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="w-full flex items-center text-left transition-colors"
            style={{
              gap: 12,
              padding: '10px 14px 10px 12px',
              borderRadius: 12,
              border: '1px solid #E7E8EE',
              background: '#ffffff',
              minHeight: 60,
            }}
            onMouseEnter={(e) => {
              if (!disabled) e.currentTarget.style.borderColor = '#D7C5FB'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E7E8EE'
            }}
          >
            {selected ? (
              <>
                <Avatar className="h-9 w-9 shrink-0">
                  {selected.user_avatar_url ? (
                    <AvatarImage src={selected.user_avatar_url} alt="" />
                  ) : null}
                  <AvatarFallback className="text-[11px] bg-virgilio-purple text-white">
                    {getInitials(
                      selected.user_first_name,
                      selected.user_last_name,
                      selected.user_email
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div
                    className="font-poppins truncate"
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: '#1F2230',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {name}
                  </div>
                  <div
                    className="font-inter truncate"
                    style={{ fontSize: 11.5, color: '#8B8F9E', marginTop: 1 }}
                  >
                    {roleLabel}
                    {selected.user_email ? ` · ${selected.user_email}` : ''}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div
                  className="shrink-0 rounded-full inline-flex items-center justify-center"
                  style={{ height: 36, width: 36, background: '#F1F0EC', color: '#8B8F9E' }}
                >
                  <UserRound size={16} />
                </div>
                <div
                  className="font-inter flex-1"
                  style={{ fontSize: 13, color: '#8B8F9E' }}
                >
                  Select {label.toLowerCase()}
                </div>
              </>
            )}
            <ChevronDown size={16} style={{ color: '#8B8F9E', flexShrink: 0 }} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          style={{ width: 'var(--radix-popover-trigger-width)', maxWidth: 480 }}
        >
          <Command>
            <CommandInput placeholder="Search members…" />
            <CommandList>
              <CommandEmpty>No members found.</CommandEmpty>
              <CommandGroup>
                {members.map((m) => {
                  const n =
                    `${m.user_first_name || ''} ${m.user_last_name || ''}`.trim() ||
                    m.user_email ||
                    'Member'
                  return (
                    <CommandItem
                      key={m.user_id}
                      value={`${n} ${m.user_email || ''}`}
                      onSelect={() => {
                        onChange(m.user_id)
                        setOpen(false)
                      }}
                      className="gap-2.5"
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        {m.user_avatar_url ? <AvatarImage src={m.user_avatar_url} alt="" /> : null}
                        <AvatarFallback className="text-[10px] bg-virgilio-purple text-white">
                          {getInitials(m.user_first_name, m.user_last_name, m.user_email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-medium truncate">{n}</div>
                        {m.user_email && (
                          <div className="text-[11px] text-text-tertiary truncate">
                            {m.user_email}
                          </div>
                        )}
                      </div>
                      {m.user_id === value && <Check size={14} className="text-virgilio-purple" />}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {helper && (
        <p
          className="font-inter"
          style={{ fontSize: 12, color: '#8B8F9E', marginTop: 8, paddingLeft: 2 }}
        >
          {helper}
        </p>
      )}
    </div>
  )
}

function OptionalOwnerField({
  label,
  icon: Icon,
  placeholder,
}: {
  label: string
  icon: any
  placeholder: string
}) {
  return (
    <div>
      <div
        className="font-poppins"
        style={{
          fontSize: 12.5,
          fontWeight: 500,
          color: '#1F2230',
          marginBottom: 6,
          letterSpacing: '-0.005em',
        }}
      >
        {label}{' '}
        <span
          className="font-inter"
          style={{ fontSize: 11.5, fontWeight: 400, color: '#8B8F9E' }}
        >
          (optional)
        </span>
      </div>
      <button
        type="button"
        className="w-full flex items-center text-left transition-colors"
        style={{
          gap: 10,
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #E7E8EE',
          background: '#ffffff',
          height: 44,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#D7C5FB')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E7E8EE')}
      >
        <Icon size={15} style={{ color: '#8B8F9E', flexShrink: 0 }} />
        <span
          className="font-inter flex-1 truncate"
          style={{ fontSize: 13, color: '#1F2230' }}
        >
          {placeholder}
        </span>
        <ChevronDown size={14} style={{ color: '#8B8F9E', flexShrink: 0 }} />
      </button>
    </div>
  )
}


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

interface TeamMemberRowProps {
  member: {
    assignmentId: string
    userId: string
    role: 'recruiter' | 'hiring_manager' | 'interviewer' | string
    name: string
    email?: string | null
    avatarUrl?: string | null
    title?: string | null
    first?: string
    last?: string
  }
  readOnly: boolean
  onRoleChange: (role: 'recruiter' | 'hiring_manager' | 'interviewer') => void
  onRemove: () => void
  onPromotePrimary: () => void
  onPromoteHM: () => void
}

function TeamMemberRow({
  member: m,
  readOnly,
  onRoleChange,
  onRemove,
  onPromotePrimary,
  onPromoteHM,
}: TeamMemberRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div
      className="relative bg-white"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.2fr) auto',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        border: '1px solid #E7E8EE',
        borderRadius: 10,
      }}
    >
      {/* Identity */}
      <div className="flex items-center min-w-0" style={{ gap: 10 }}>
        <Avatar className="shrink-0" style={{ height: 26, width: 26 }}>
          {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-[10.5px] bg-virgilio-purple text-white">
            {getInitials(m.first, m.last, m.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div
            className="font-inter truncate"
            style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}
          >
            {m.name}
          </div>
          <div
            className="font-inter truncate"
            style={{ fontSize: 10.5, color: '#8B8F9E', marginTop: 1 }}
          >
            {m.title || 'Panel · Team'}
          </div>
        </div>
      </div>

      {/* Role select */}
      <div className="min-w-0">
        <Select
          value={m.role}
          onValueChange={(v) => onRoleChange(v as any)}
          disabled={readOnly}
        >
          <SelectTrigger
            className="text-[12.5px] w-full"
            style={{
              height: 34,
              background: '#ffffff',
              borderColor: '#E0DDD3',
              borderRadius: 8,
            }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recruiter">Recruiter</SelectItem>
            <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
            <SelectItem value="interviewer">Interviewer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Permissions/scope */}
      <div
        className="font-inter truncate min-w-0"
        style={{ fontSize: 11, color: '#5A6072' }}
      >
        {ROLE_LABEL[m.role] || 'Member'} · scorecards
      </div>

      {/* … menu */}
      <div className="shrink-0">
        {!readOnly && (
          <button
            type="button"
            aria-label="Row menu"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{
              height: 28,
              width: 28,
              color: '#8B8F9E',
              background: menuOpen ? '#F1F0EC' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!menuOpen) e.currentTarget.style.background = '#F1F0EC'
            }}
            onMouseLeave={(e) => {
              if (!menuOpen) e.currentTarget.style.background = 'transparent'
            }}
          >
            <MoreHorizontal style={{ height: 15, width: 15 }} strokeWidth={2} />
          </button>
        )}
      </div>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% - 2px)',
              right: 12,
              zIndex: 50,
              width: 226,
              background: '#fff',
              border: '1px solid #EDECE6',
              borderRadius: 12,
              boxShadow:
                '0 16px 40px -8px rgba(13,13,9,0.24), 0 0 0 1px rgba(13,13,9,0.03)',
              padding: 5,
            }}
          >
            <div
              style={{
                padding: '7px 10px 8px',
                borderBottom: '1px solid #F1F0EC',
                marginBottom: 4,
              }}
            >
              <div
                className="font-poppins truncate"
                style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}
              >
                {m.name}
              </div>
              {m.email && (
                <div
                  className="font-inter truncate"
                  style={{ fontSize: 10.5, color: '#8B8F9E', marginTop: 1 }}
                >
                  {m.email}
                </div>
              )}
            </div>

            <MenuItem
              icon={UserIcon}
              label="View profile"
              onClick={() => {
                setMenuOpen(false)
                window.dispatchEvent(
                  new CustomEvent('member:view-profile', { detail: m.userId })
                )
              }}
            />
            <MenuItem
              icon={Star}
              label="Set as primary recruiter"
              onClick={() => {
                setMenuOpen(false)
                onPromotePrimary()
              }}
            />
            <MenuItem
              icon={Crown}
              label="Set as hiring manager"
              onClick={() => {
                setMenuOpen(false)
                onPromoteHM()
              }}
            />
            <MenuItem
              icon={Bell}
              label="Notification preferences"
              meta="For this job only"
              onClick={() => {
                setMenuOpen(false)
                window.dispatchEvent(
                  new CustomEvent('member:notification-prefs', { detail: m.userId })
                )
              }}
            />
            <div style={{ height: 1, background: '#F1F0EC', margin: '4px 0' }} />
            <MenuItem
              icon={Trash2}
              label="Remove from job"
              danger
              onClick={() => {
                setMenuOpen(false)
                onRemove()
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  meta,
  danger,
  onClick,
}: {
  icon: any
  label: string
  meta?: string
  danger?: boolean
  onClick: () => void
}) {
  const color = danger ? '#B91C1C' : '#1F2230'
  const glyph = danger ? '#B91C1C' : '#5A6072'
  const hoverBg = danger ? '#FEF2F2' : '#FAFAF7'
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center"
      style={{
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon style={{ height: 14, width: 14, color: glyph, flexShrink: 0 }} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <div
          className="font-inter truncate"
          style={{ fontSize: 12.5, fontWeight: 500, color }}
        >
          {label}
        </div>
        {meta && (
          <div
            className="font-inter truncate"
            style={{ fontSize: 10.5, color: '#8B8F9E', marginTop: 1 }}
          >
            {meta}
          </div>
        )}
      </div>
    </button>
  )
}

export default JobSetupLayout
