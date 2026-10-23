import React, { useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { UserPlus, User as UserIcon, Calendar as CalendarIcon, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

import { useJobAssignments, type JobAssignmentRole } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'
import { SectionCard, FieldLabel, FieldHint, MemberAvatar, RoleCard, InfoLink } from './_parts'
import { TeamNotificationsCard } from '@/components/jobs/settings/JobAutomationCards'

interface HiringTeamUi {
  memberSearch: string
}

interface HiringTeamStepProps {
  jobId: string | null
  onNext: () => void
  onBack: () => void
  ui: HiringTeamUi
  onUiChange: (patch: Partial<HiringTeamUi>) => void
  /** Job columns (jobs.reports_to_user_id / coordinator_user_id), saved with the draft. */
  reportsToId: string
  coordinatorId: string
  onReportsToChange: (v: string) => void
  onCoordinatorChange: (v: string) => void
}

const DB_ROLE_LABEL: Record<JobAssignmentRole, string> = {
  sourcer: 'Sourcer',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring manager',
  interviewer: 'Interviewer',
}

const SCOPE_BY_ROLE: Record<JobAssignmentRole, string> = {
  sourcer: 'Sourcer · find + add candidates',
  recruiter: 'Owner · all access',
  hiring_manager: 'HM · view + scorecards',
  interviewer: 'Interviewer · scorecards',
}

export function HiringTeamStep({
  jobId,
  onNext,
  onBack,
  ui,
  onUiChange,
  reportsToId,
  coordinatorId,
  onReportsToChange,
  onCoordinatorChange,
}: HiringTeamStepProps) {
  const { members, isLoading: membersLoading } = useMembers(true)
  const {
    assignments,
    assignUserToJob,
    removeUserFromJob,
    updateAssignmentRole,
    isLoading: assignmentsLoading,
  } = useJobAssignments(jobId || undefined)

  const { memberSearch } = ui
  const setReportsToId = onReportsToChange
  const setCoordinatorId = onCoordinatorChange
  const setMemberSearch = (v: string) => onUiChange({ memberSearch: v })


  const searchRef = useRef<HTMLInputElement>(null)

  const memberOptions = useMemo(
    () =>
      members
        .filter((m) => m.user_id)
        .map((m) => {
          const name =
            `${m.user_first_name ?? ''} ${m.user_last_name ?? ''}`.trim() ||
            m.user_email ||
            'Unnamed'
          return { value: m.user_id!, label: `${name} · ${m.user_email ?? ''}` }
        }),
    [members]
  )

  // Owner pickers show the role each person already holds here: picking them
  // moves that seat, it never adds a second one.
  const ownerOptions = (currentUserId?: string) =>
    memberOptions.map((o) => {
      const seat = o.value !== currentUserId ? assignments.find((a) => a.user_id === o.value) : undefined
      return seat ? { ...o, hint: DB_ROLE_LABEL[seat.role] } : o
    })

  const findMember = (uid?: string) => members.find((m) => m.user_id === uid)
  const nameOf = (uid?: string) => {
    const m = findMember(uid)
    if (!m) return ''
    return (
      `${m.user_first_name ?? ''} ${m.user_last_name ?? ''}`.trim() ||
      m.user_email ||
      'Unnamed'
    )
  }

  // Derive owner ids from assignments
  const recruiterAssignment = assignments.find((a) => a.role === 'recruiter')
  const hmAssignment = assignments.find((a) => a.role === 'hiring_manager')
  const sourcerAssignment = assignments.find((a) => a.role === 'sourcer')

  // Owner setter: swaps the person in the Recruiter / Sourcer /
  // hiring manager slot. One seat per person per job (Allan, 2026-10-22): someone
  // already on the job moves into the role (assignUserToJob changes their seat),
  // so a slot they held before shows as empty.
  const setOwner = async (role: JobAssignmentRole, newUserId: string) => {
    if (!jobId) return
    const current = assignments.find((a) => a.role === role)
    if (current?.user_id === newUserId) return
    if (!newUserId) return
    const m = findMember(newUserId)
    if (!m) return

    try {
      if (current) await removeUserFromJob(current.id)
      await assignUserToJob({
        job_id: jobId,
        user_id: newUserId,
        organization_id: m.organization_id,
        role,
      })
    } catch (e) {
      console.error('setOwner failed:', e)
    }
  }


  // Counts per role for the "Roles on this job" tiles
  const roleCounts = {
    sourcer: assignments.filter((a) => a.role === 'sourcer').length,
    recruiter: assignments.filter((a) => a.role === 'recruiter').length,
    hiring_manager: assignments.filter((a) => a.role === 'hiring_manager').length,
    interviewer: assignments.filter((a) => a.role === 'interviewer').length,
  }

  // Member rows for the TEAM MEMBERS section (excluding the three owner slots)
  const teamRows = useMemo(() => {
    const ownerIds = new Set(
      [recruiterAssignment?.user_id, sourcerAssignment?.user_id, hmAssignment?.user_id].filter(Boolean) as string[]
    )
    const q = memberSearch.trim().toLowerCase()
    return members
      .filter((m) => m.user_id && !ownerIds.has(m.user_id))
      .filter((m) => {
        if (!q) return true
        const haystack = `${m.user_first_name ?? ''} ${m.user_last_name ?? ''} ${m.user_email ?? ''}`.toLowerCase()
        return haystack.includes(q)
      })
      .map((m) => {
        const assignment = assignments.find((a) => a.user_id === m.user_id)
        return { member: m, assignment }
      })
  }, [members, assignments, recruiterAssignment, sourcerAssignment, hmAssignment, memberSearch])


  const togglePanelist = async (
    userId: string,
    organizationId: string,
    current?: { id: string }
  ) => {
    if (!jobId) return
    try {
      if (current) {
        await removeUserFromJob(current.id)
      } else {
        await assignUserToJob({
          job_id: jobId,
          user_id: userId,
          organization_id: organizationId,
          role: 'interviewer',
        })
      }
    } catch {
      /* toast in hook */
    }
  }

  if (!jobId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-secondary">Job must be created before assigning team members.</p>
      </div>
    )
  }

  const loading = membersLoading || assignmentsLoading

  return (
    <div className="space-y-8 pb-4">
      {/* ── OWNERS ──────────────────────────────────────────── */}
      <SectionCard title="Owners">
        <div className="space-y-5">
          <div>
            <FieldLabel required>Recruiter</FieldLabel>
            <div className="mt-2">
              <SearchableSelect
                options={ownerOptions(recruiterAssignment?.user_id)}
                value={recruiterAssignment?.user_id ?? ''}
                onValueChange={(v) => setOwner('recruiter', v)}
                placeholder="Select a Recruiter…"
                searchPlaceholder="Search members…"
                emptyMessage="No members found."
                disabled={loading}
              />
            </div>
            <FieldHint>The primary recruiter: owns the job and gets its candidate notifications. Needed to publish.</FieldHint>
          </div>

          <div>
            <FieldLabel required>Sourcer</FieldLabel>
            <div className="mt-2">
              <SearchableSelect
                options={ownerOptions(sourcerAssignment?.user_id)}
                value={sourcerAssignment?.user_id ?? ''}
                onValueChange={(v) => setOwner('sourcer', v)}
                placeholder="Select a Sourcer…"
                searchPlaceholder="Search members…"
                emptyMessage="No members found."
                disabled={loading}
              />
            </div>
            <FieldHint>Finds the candidates. Needed to publish; add more sourcers below.</FieldHint>
          </div>

          <div>
            <FieldLabel required>Hiring manager</FieldLabel>
            <div className="mt-2">
              <SearchableSelect
                options={ownerOptions(hmAssignment?.user_id)}
                value={hmAssignment?.user_id ?? ''}
                onValueChange={(v) => setOwner('hiring_manager', v)}
                placeholder="Select a hiring manager…"
                searchPlaceholder="Search members…"
                emptyMessage="No members found."
                disabled={loading}
              />
            </div>
            <FieldHint>Owns the bar and the final decision.</FieldHint>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel optional>
                <UserIcon className="h-3.5 w-3.5 text-text-tertiary" />
                Reports to
              </FieldLabel>
              <div className="mt-2">
                <SearchableSelect
                  options={memberOptions}
                  value={reportsToId}
                  onValueChange={setReportsToId}
                  placeholder="Select manager…"
                  searchPlaceholder="Search members…"
                  emptyMessage="No members found."
                />
              </div>
            </div>
            <div>
              <FieldLabel optional>
                <CalendarIcon className="h-3.5 w-3.5 text-text-tertiary" />
                Coordinator
              </FieldLabel>
              <div className="mt-2">
                <Select value={coordinatorId} onValueChange={setCoordinatorId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select coordinator…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__same__">Same as recruiter</SelectItem>
                    {memberOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FieldHint>Schedules + reminders. Defaults to recruiter.</FieldHint>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── TEAM MEMBERS ────────────────────────────────────── */}
      <SectionCard
        title="Team members"
        trailing={
          <Button
            variant="secondary"
            size="sm"
            icon={UserPlus}
            type="button"
            onClick={() => searchRef.current?.focus()}
          >
            Add member
          </Button>
        }
      >
        <div className="relative mb-3 max-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
          <Input
            ref={searchRef}
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="Search team members…"
            className="h-[30px] pl-8 text-[12.5px]"
          />
        </div>
        {teamRows.length === 0 ? (
          <p className="text-[13px] text-text-tertiary py-4 text-center">
            {memberSearch ? 'No members match your search.' : 'No other workspace members available.'}
          </p>
        ) : (

          <ul className="divide-y divide-virgilio-border/60 -mx-1">
            {teamRows.map(({ member, assignment }) => {
              const name = nameOf(member.user_id!)
              const subtitle =
                member.system_role === 'admin'
                  ? 'Admin'
                  : member.organization_name || 'Team'
              const isAssigned = !!assignment
              const role = (assignment?.role as JobAssignmentRole | undefined) ?? 'interviewer'
              return (
                <li
                  key={member.id}
                  className={cn(
                    'flex items-center gap-3 px-1 py-3 transition-opacity',
                    !isAssigned && 'opacity-60'
                  )}
                >
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={() =>
                      togglePanelist(member.user_id!, member.organization_id, assignment)
                    }
                    className="data-[state=checked]:bg-virgilio-purple data-[state=checked]:border-virgilio-purple"
                  />
                  <MemberAvatar name={name} url={member.user_avatar_url} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-poppins font-medium text-text-primary truncate">
                      {name}
                    </p>
                    <p className="text-[12px] text-text-tertiary truncate">{subtitle}</p>
                  </div>
                  <div className="w-[160px] shrink-0">
                    <Select
                      value={isAssigned ? role : ''}
                      onValueChange={(v) => {
                        if (!isAssigned) {
                          assignUserToJob({
                            job_id: jobId!,
                            user_id: member.user_id!,
                            organization_id: member.organization_id,
                            role: v as JobAssignmentRole,
                          }).catch(() => { /* toast in hook */ })
                        } else if (assignment) {
                          updateAssignmentRole(assignment.id, v as JobAssignmentRole).catch(() => { /* toast in hook */ })
                        }
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Pick a role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(['interviewer', 'sourcer', 'recruiter', 'hiring_manager'] as JobAssignmentRole[]).map(
                          (r) => (
                            <SelectItem key={r} value={r}>
                              {DB_ROLE_LABEL[r]}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="hidden md:inline text-[12px] text-text-tertiary w-[180px] shrink-0 truncate">
                    {isAssigned ? SCOPE_BY_ROLE[role] : '—'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>

      {/* ── ROLES ON THIS JOB ───────────────────────────────── */}
      <SectionCard
        title="Roles on this job"
        trailing={<InfoLink>What can each role do?</InfoLink>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <RoleCard
            label="Sourcer"
            description="Find and add candidates to the pipeline."
            count={roleCounts.sourcer}
            tone="lilac"
          />
          <RoleCard
            label="Recruiter"
            description="Source, screen, schedule, send offers."
            count={roleCounts.recruiter}
            tone="lilac"
          />
          <RoleCard
            label="Hiring manager"
            description="Calibrate, review scorecards, decide."
            count={roleCounts.hiring_manager}
            tone="yellow"
            active
          />
          <RoleCard
            label="Interviewer"
            description="Submit scorecards on assigned interviews."
            count={roleCounts.interviewer}
            tone="orange"
          />
          <RoleCard
            label="Coordinator"
            description="Schedule meetings, manage reminders."
            count={coordinatorId && coordinatorId !== '__same__' ? 1 : 0}
            tone="lilac"
          />
        </div>
      </SectionCard>

      {/* ── NOTIFICATIONS (job_settings) ───────────────────── */}
      <TeamNotificationsCard jobId={jobId} />
    </div>
  )
}
