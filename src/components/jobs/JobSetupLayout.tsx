import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ScreeningRulesCard, AiScreenCard, TeamNotificationsCard } from '@/components/jobs/settings/JobAutomationCards'
import { InlineEmpty } from '@/components/ui/empty-state'
import { CrmJobSetup } from '@/components/jobs/CrmJobSetup'
import {
  Pencil,
  Globe,
  Activity,
  History,
  GitBranch,
  Users,
  Bell,
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
  Hash,
  Lock,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { missingForPublish, isPublishGateError, type SalesTeam } from '@/lib/jobTeam'
import { OpeningsEditor } from './openings/OpeningsEditor'
import { useJobOpenings } from '@/hooks/useJobOpenings'
import { openingsSummary } from '@/lib/jobOpenings'

import { formatDistanceToNowStrict } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useQueryClient } from '@tanstack/react-query'
import { archiveJob, closeJob } from './jobStatusActions'
import { confirmRemoveMember } from './confirmRemoveMember'
import { useToast } from '@/hooks/use-toast'
import { SectionCard } from './wizard/_parts'
import { HiringPlanTab } from './HiringPlanTab'
import { usePermissions } from '@/hooks/usePermissions'
import { OfferApprovalChainConfig } from './OfferApprovalChainConfig'
import { ClientViewSection } from './ClientViewSection'
import { Eye } from 'lucide-react'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'
import { cn } from '@/lib/utils'
import { menuItem, menuPanel, menuSeparator } from '@/lib/menu-classes'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from '@/components/ui/command'
import { supabase } from '@/integrations/supabase/client'


interface JobSetupLayoutProps {
  jobId: string
  jobTitle: string
  job: any
  onEdit: () => void
  onAddTeamMember?: () => void
}

const ROLE_LABEL: Record<string, string> = {
  sourcer: 'Sourcer',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring manager',
  interviewer: 'Interviewer',
}

type SectionId =
  | 'openings'
  | 'hiring-plan'
  | 'auto-rejection'
  | 'ai-screen'
  | 'hiring-team'
  | 'offer-approval'
  | 'client-view'
  | 'notifications'
  | 'danger'

const NAV_CONFIG: Array<{ id: SectionId; label: string; icon: any }> = [
  { id: 'openings', label: 'Openings', icon: Hash },
  { id: 'hiring-plan', label: 'Hiring plan', icon: GitBranch },
  { id: 'hiring-team', label: 'Hiring team', icon: Users },
  { id: 'offer-approval', label: 'Offer approval', icon: ListChecks },
  { id: 'client-view', label: 'Client view', icon: Eye },
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
  const queryClient = useQueryClient()

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
  /** The role someone already holds on this job, shown in the owner pickers. */
  const seatOf = (userId: string) => {
    const role = assignments.find((a) => a.user_id === userId)?.role
    return role ? ROLE_LABEL[role] : undefined
  }

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

  // J12 (Block B §16, Pattern 1): asks before taking someone off the team.
  const handleRemoveMember = async (m: (typeof teamMembers)[number]) => {
    const ok = await confirmRemoveMember(m.name, jobTitle)
    if (!ok) return
    try {
      await removeUserFromJob(m.assignmentId, { quiet: true })
      toast({ title: `${m.name} removed from the hiring team` })
    } catch {
      toast({ title: `Couldn’t remove ${m.name}. Nothing changed; try again.`, variant: 'destructive' })
    }
  }

  // Scroll spy
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<SectionId>('openings')
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const onScroll = () => {
      const headers = Array.from(
        root.querySelectorAll<HTMLElement>('[data-section]')
      )
      const top = root.scrollTop + 100
      let current: SectionId = 'openings'
      for (const h of headers) {
        if (h.offsetTop <= top) current = (h.dataset.section as SectionId) || current
      }
      setActive(current)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => root.removeEventListener('scroll', onScroll)
  }, [])

  // Deep link support: /jobs/:id/setup#hiring-team lands on the section.
  const [highlightSection, setHighlightSection] = useState<SectionId | null>(null)
  useEffect(() => {
    const hash = (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '')
    if (!hash) return
    const valid: SectionId[] = ['openings', 'hiring-plan', 'hiring-team', 'offer-approval']
    if (!valid.includes(hash as SectionId)) return
    const t = setTimeout(() => {
      scrollTo(hash as SectionId)
      setHighlightSection(hash as SectionId)
    }, 120)
    const clear = setTimeout(() => setHighlightSection(null), 2200)
    return () => {
      clearTimeout(t)
      clearTimeout(clear)
    }
  }, [])

  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent).detail as SectionId
      scrollTo(id)
      setHighlightSection(id)
      setTimeout(() => setHighlightSection(null), 2200)
    }
    window.addEventListener('job-setup:scroll', h)
    return () => window.removeEventListener('job-setup:scroll', h)
  })

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
      if (existing) await updateAssignmentRole(existing.id, 'interviewer')
      // One seat per person: someone already on the job moves into the role
      // (assignUserToJob changes their seat), so the slot they held empties.
      await assignUserToJob({
        job_id: jobId,
        user_id: newUserId,
        role,
        organization_id: job?.organization_id,
      })
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
    role: 'sourcer' | 'recruiter' | 'hiring_manager' | 'interviewer'
  ) => {
    try {
      await updateAssignmentRole(assignmentId, role)
    } catch {
      /* toast in hook */
    }
  }

  // Publish gate (mirrors jobs_publish_gate in the database)
  const missingRoles = missingForPublish(job, assignments as any)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  useEffect(() => {
    const h = (e: Event) => {
      const msg = (e as CustomEvent).detail as string
      setPublishError(msg)
      scrollTo('hiring-team')
      setHighlightSection('hiring-team')
      setTimeout(() => setHighlightSection(null), 2200)
    }
    window.addEventListener('job-setup:publish-blocked', h)
    return () => window.removeEventListener('job-setup:publish-blocked', h)
  })
  const doPublish = async () => {
    setPublishing(true)
    setPublishError(null)
    const { error } = await supabase.from('jobs').update({ status: 'open' } as any).eq('id', jobId)
    setPublishing(false)
    if (error) {
      setPublishError(error.message)
      toast({ title: "Couldn't publish", description: error.message, variant: 'destructive' })
      if (isPublishGateError(error.message)) {
        scrollTo('hiring-team')
        setHighlightSection('hiring-team')
        setTimeout(() => setHighlightSection(null), 2200)
      }
      return
    }
    toast({ title: 'Job published', description: `${jobTitle} is now open.` })
    window.dispatchEvent(new CustomEvent('job-detail:refresh'))
  }
  const salesTeam = (job?.sales_team ?? null) as SalesTeam
  const [crmSetupOpen, setCrmSetupOpen] = useState(false)

  // J10/J11 (Block B §16, Pattern 1 + Undo): close and archive are status
  // changes; each asks once and the toast offers Undo.
  const jobRef = { id: jobId, title: jobTitle, status: job?.status, organization_id: job?.organization_id }
  const doClose = () => void closeJob(jobRef, { queryClient })
  const doArchive = () => void archiveJob(jobRef, { queryClient })

  const lastEdited = job?.updated_at
    ? formatDistanceToNowStrict(new Date(job.updated_at), { addSuffix: false })
    : null
  const editorName = job?.last_edited_by_name || 'you'

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto bg-[#F6F5F1]"
    >
      <CrmJobSetup jobId={job?.sales_deal_id ? jobId : null} open={crmSetupOpen} onClose={() => { setCrmSetupOpen(false); window.dispatchEvent(new CustomEvent('job-detail:refresh')) }} />
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
            {/* Openings */}
            <div data-section="openings" id="openings">
              <OpeningsSection jobId={jobId} readOnly={isReadOnly} />
            </div>

            {/* Hiring plan */}
            <div data-section="hiring-plan" style={{ marginTop: 24 }}>
              <HiringPlanTab jobId={jobId} readOnly={isReadOnly} hideHeader />
            </div>


            {/* Screening rules and AI auto-screen (job_settings) */}
            <div data-section="auto-rejection">
              <ScreeningRulesCard jobId={jobId} job={job} readOnly={isReadOnly} />
            </div>

            <div data-section="ai-screen">
              <AiScreenCard jobId={jobId} readOnly={isReadOnly} />
            </div>

            {/* Hiring team */}
            <div
              data-section="hiring-team"
              className="transition-colors duration-700"
              style={{
                background: highlightSection === 'hiring-team' ? '#EFE9FE' : 'transparent',
                borderRadius: 16,
                padding: highlightSection === 'hiring-team' ? 12 : 0,
                margin: highlightSection === 'hiring-team' ? -12 : 0,
              }}
            >
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

                {job?.status === 'draft' && (
                  <div className="rounded-2xl border border-virgilio-border bg-white p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-inter text-[13px] font-medium text-text-primary">This job is a draft</p>
                      <p className="font-inter text-[12px] text-text-secondary">
                        {publishError
                          ? publishError
                          : missingRoles.length > 0
                            ? `Assign ${missingRoles.join(', ')} before publishing.`
                            : 'The hiring team is complete — ready to publish.'}
                      </p>
                    </div>
                    {!isReadOnly && (
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {job?.sales_deal_id && (
                          <Button size="sm" variant="outline" onClick={() => setCrmSetupOpen(true)}>
                            Set up step by step
                          </Button>
                        )}
                        <Button size="sm" onClick={doPublish} loading={publishing} disabled={missingRoles.length > 0}>
                          Publish job
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {job?.sales_deal_id && (
                  <div className="space-y-2.5">
                    <SubsectionLabel>From the deal</SubsectionLabel>
                    <div className="rounded-2xl border border-virgilio-border bg-white p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                      {([['Sales', salesTeam?.sales], ['Engagement Specialist', salesTeam?.es]] as const).map(([label, people]) => (
                        <div key={label} className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-inter text-[12px] font-medium text-text-primary">{label}</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span aria-label="Locked" className="text-text-tertiary"><Lock className="h-3 w-3" /></span>
                              </TooltipTrigger>
                              <TooltipContent>Set on the deal in Gio Sales</TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="mt-1.5 rounded-lg border border-virgilio-border bg-surface-secondary px-3 py-2 font-inter text-[12.5px] text-text-primary">
                            {people && people.length > 0
                              ? people.map((p) => p.name || p.email).join(', ')
                              : <span className="text-text-tertiary">Not set yet</span>}
                          </div>
                          <p className="mt-1 font-inter text-[11px] text-text-tertiary">
                            From Gio Sales · {job?.sales_deal_title || 'Deal'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                      seatOf={seatOf}
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
                      seatOf={seatOf}
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
                            onRemove={() => void handleRemoveMember(m)}
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

            {/* Client view */}
            <div data-section="client-view" className="pt-2">
              <ClientViewSection jobId={jobId} readOnly={isReadOnly} />
            </div>

            {/* Notifications */}
            <div data-section="notifications">
              <TeamNotificationsCard jobId={jobId} readOnly={isReadOnly} />
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
                        onClick={doClose}
                      >
                        Close job
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Archive}
                        onClick={doArchive}
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
  seatOf,
  onChange,
  disabled,
}: {
  label: string
  required?: boolean
  helper?: string
  value: string
  members: any[]
  roleLabel: string
  /** The role someone already holds on the job; picking them moves that seat. */
  seatOf?: (userId: string) => string | undefined
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
                      {m.user_id !== value && seatOf?.(m.user_id) && (
                        <CommandShortcut>{seatOf(m.user_id)}</CommandShortcut>
                      )}
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

function CompactOwnerPicker({
  label,
  icon: Icon,
  placeholder,
  clearLabel,
  value,
  members,
  disabled,
  onChange,
}: {
  label: string
  icon: any
  placeholder: string
  clearLabel: string
  value: string
  members: any[]
  disabled?: boolean
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = members.find((m) => m.user_id === value)
  const selectedName = selected
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
        {label}{' '}
        <span
          className="font-inter"
          style={{ fontSize: 11.5, fontWeight: 400, color: '#8B8F9E' }}
        >
          (optional)
        </span>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'w-full flex items-center text-left transition-colors',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
            style={{
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #E7E8EE',
              background: '#ffffff',
              height: 44,
            }}
            onMouseEnter={(e) => {
              if (!disabled) e.currentTarget.style.borderColor = '#D7C5FB'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E7E8EE'
            }}
          >
            {selected ? (
              <Avatar className="h-6 w-6 shrink-0">
                {selected.user_avatar_url ? (
                  <AvatarImage src={selected.user_avatar_url} alt="" />
                ) : null}
                <AvatarFallback className="text-[9px] bg-virgilio-purple text-white">
                  {getInitials(
                    selected.user_first_name,
                    selected.user_last_name,
                    selected.user_email
                  )}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Icon size={15} style={{ color: '#8B8F9E', flexShrink: 0 }} />
            )}
            <span
              className="font-inter flex-1 truncate"
              style={{ fontSize: 13, color: selected ? '#1F2230' : '#8B8F9E' }}
            >
              {selected ? selectedName : placeholder}
            </span>
            <ChevronDown size={14} style={{ color: '#8B8F9E', flexShrink: 0 }} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0"
          align="start"
          style={{ width: 'var(--radix-popover-trigger-width)', minWidth: 260, maxWidth: 420 }}
        >
          <Command>
            <CommandInput placeholder="Search members…" />
            <CommandList>
              <CommandEmpty>No members found.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value={clearLabel}
                  onSelect={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                  className="gap-2.5"
                >
                  <div
                    className="shrink-0 rounded-full inline-flex items-center justify-center"
                    style={{ height: 28, width: 28, background: '#F1F0EC', color: '#8B8F9E' }}
                  >
                    <Icon size={13} />
                  </div>
                  <span className="text-[12.5px] flex-1">{clearLabel}</span>
                  {!value && <Check size={14} className="text-virgilio-purple" />}
                </CommandItem>
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
    </div>
  )
}




interface TeamMemberRowProps {
  member: {
    assignmentId: string
    userId: string
    role: 'sourcer' | 'recruiter' | 'hiring_manager' | 'interviewer' | string
    name: string
    email?: string | null
    avatarUrl?: string | null
    title?: string | null
    first?: string
    last?: string
  }
  readOnly: boolean
  onRoleChange: (role: 'sourcer' | 'recruiter' | 'hiring_manager' | 'interviewer') => void
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
            <SelectItem value="sourcer">Sourcer</SelectItem>
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
            data-state="open"
            className={cn('absolute right-3 top-[calc(100%-2px)] z-50 w-[240px] origin-top-right', menuPanel)}
          >
            <div className="px-2 pb-1 pt-1.5">
              <div className="truncate font-inter text-[14px] font-medium leading-5 text-foreground">
                {m.name}
              </div>
              {m.email && (
                <div className="truncate font-inter text-[12px] leading-4 [color:hsl(var(--menu-group-color))]">
                  {m.email}
                </div>
              )}
            </div>
            <div className={menuSeparator} />

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
            <div className={menuSeparator} />
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
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        menuItem,
        'hover:bg-[hsl(var(--menu-hover))]',
        meta && 'items-start',
        danger && 'text-destructive'
      )}
    >
      <Icon aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {meta && (
          <span className="block truncate text-[12px] leading-4 [color:hsl(var(--menu-group-color))]">
            {meta}
          </span>
        )}
      </span>
    </button>
  )
}

export default JobSetupLayout


function OpeningsSection({ jobId, readOnly }: { jobId: string; readOnly: boolean }) {
  const { openings } = useJobOpenings(jobId)
  const { n, open } = openingsSummary(openings)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-poppins" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: '#0d0d09' }}>
          Openings<span style={{ color: '#D7C5FB' }}>.</span>
        </h2>
        <Badge tone="neutral" size="sm">
          {n} {n === 1 ? 'opening' : 'openings'} · {open} open
        </Badge>
      </div>
      <SectionCard title="Openings">
        <p className="-mt-2 font-inter text-[12px] text-text-tertiary">
          One opening per hire. Offers reserve an opening by Req ID; marking a candidate hired fills it.
        </p>
        <OpeningsEditor mode="setup" jobId={jobId} readOnly={readOnly} />
      </SectionCard>
    </div>
  )
}
