import React, { useMemo, useState } from 'react'
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
import { Sliders, UserPlus, User as UserIcon, Calendar as CalendarIcon } from 'lucide-react'
import { useJobAssignments, type JobAssignmentRole } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'
import { SectionCard, FieldLabel, FieldHint, ToggleRow, MemberAvatar, RoleCard, InfoLink } from './_parts'

interface HiringTeamStepProps {
  jobId: string | null
  onNext: () => void
  onBack: () => void
}

const DB_ROLE_LABEL: Record<JobAssignmentRole, string> = {
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring manager',
  interviewer: 'Interviewer',
}

const SCOPE_BY_ROLE: Record<JobAssignmentRole, string> = {
  recruiter: 'Owner · all access',
  hiring_manager: 'HM · view + scorecards',
  interviewer: 'Interviewer · scorecards',
}

export function HiringTeamStep({ jobId, onNext, onBack }: HiringTeamStepProps) {
  const { members, isLoading: membersLoading } = useMembers(true)
  const {
    assignments,
    assignUserToJob,
    removeUserFromJob,
    updateAssignmentRole,
    isLoading: assignmentsLoading,
  } = useJobAssignments(jobId || undefined)

  // Local-only fields (no backend column yet)
  const [reportsToId, setReportsToId] = useState<string>('')
  const [coordinatorId, setCoordinatorId] = useState<string>('__same__')
  const [notifyOnApplications, setNotifyOnApplications] = useState(true)
  const [dailyDigest, setDailyDigest] = useState(true)
  const [notifyStageMoves, setNotifyStageMoves] = useState(false)

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

  // Generic owner setter — swaps the single recruiter / hiring_manager slot.
  // Handles the case where the target user already has a different role on the job
  // (would otherwise collide on the unique (job, user, role) constraint).
  const setOwner = async (role: JobAssignmentRole, newUserId: string) => {
    if (!jobId) return
    const current = assignments.find((a) => a.role === role)
    if (current?.user_id === newUserId) return
    if (!newUserId) return
    const m = findMember(newUserId)
    if (!m) return

    try {
      const existingForUser = assignments.find((a) => a.user_id === newUserId)

      // Free the slot only if a *different* user holds it.
      if (current && current.user_id !== newUserId) {
        await removeUserFromJob(current.id)
      }

      if (existingForUser && existingForUser.role !== role) {
        // Promote/demote in place — no insert, no collision.
        await updateAssignmentRole(existingForUser.id, role)
      } else if (!existingForUser) {
        await assignUserToJob({
          job_id: jobId,
          user_id: newUserId,
          organization_id: m.organization_id,
          role,
        })
      }
    } catch (e) {
      console.error('setOwner failed:', e)
    }
  }


  // Counts per role for the "Roles on this job" tiles
  const roleCounts = {
    recruiter: assignments.filter((a) => a.role === 'recruiter').length,
    hiring_manager: assignments.filter((a) => a.role === 'hiring_manager').length,
    interviewer: assignments.filter((a) => a.role === 'interviewer').length,
  }

  // Member rows for the TEAM MEMBERS section (excluding the two owner slots)
  const teamRows = useMemo(() => {
    const ownerIds = new Set(
      [recruiterAssignment?.user_id, hmAssignment?.user_id].filter(Boolean) as string[]
    )
    return members
      .filter((m) => m.user_id && !ownerIds.has(m.user_id))
      .map((m) => {
        const assignment = assignments.find((a) => a.user_id === m.user_id)
        return { member: m, assignment }
      })
  }, [members, assignments, recruiterAssignment, hmAssignment])

  const togglePanelist = async (
    userId: string,
    organizationId: string,
    current?: { id: string }
  ) => {
    if (!jobId) return
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
            <FieldLabel required>Primary recruiter</FieldLabel>
            <div className="mt-2">
              <SearchableSelect
                options={memberOptions}
                value={recruiterAssignment?.user_id ?? ''}
                onValueChange={(v) => setOwner('recruiter', v)}
                placeholder="Select a recruiter…"
                searchPlaceholder="Search members…"
                emptyMessage="No members found."
                disabled={loading}
              />
            </div>
            <FieldHint>Owns the job — receives all candidate notifications.</FieldHint>
          </div>

          <div>
            <FieldLabel required>Hiring manager</FieldLabel>
            <div className="mt-2">
              <SearchableSelect
                options={memberOptions}
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
          <Button variant="secondary" size="sm" icon={UserPlus} type="button">
            Add member
          </Button>
        }
      >
        {teamRows.length === 0 ? (
          <p className="text-[13px] text-text-tertiary py-4 text-center">
            No other workspace members available.
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
                          // Assign first, then set role via assignment role later
                          assignUserToJob({
                            job_id: jobId!,
                            user_id: member.user_id!,
                            organization_id: member.organization_id,
                            role: v as JobAssignmentRole,
                          })
                        } else if (assignment) {
                          updateAssignmentRole(assignment.id, v as JobAssignmentRole)
                        }
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Pick a role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(['interviewer', 'recruiter', 'hiring_manager'] as JobAssignmentRole[]).map(
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
                  <button
                    type="button"
                    aria-label="Member access settings"
                    className="rounded-md p-1.5 text-text-tertiary hover:bg-virgilio-border/40 hover:text-text-primary transition-colors"
                  >
                    <Sliders className="h-4 w-4" />
                  </button>
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
          <RoleCard
            label="Sourcer"
            description="Source-only — can't see entire pipeline."
            count={0}
            tone="green"
          />
          <RoleCard
            label="Observer"
            description="View-only, no actions."
            count={0}
            tone="green"
          />
        </div>
      </SectionCard>

      {/* ── NOTIFICATIONS ───────────────────────────────────── */}
      <SectionCard title="Notifications">
        <div className="divide-y divide-virgilio-border/60">
          <div className="py-1">
            <ToggleRow
              label="Notify owners on new applications"
              hint="Slack DM + email to recruiter + HM"
              checked={notifyOnApplications}
              onChange={setNotifyOnApplications}
            />
          </div>
          <div className="py-1">
            <ToggleRow
              label="Daily digest at 9:00 AM"
              hint="Activity summary to recruiter only"
              checked={dailyDigest}
              onChange={setDailyDigest}
            />
          </div>
          <div className="py-1">
            <ToggleRow
              label="Notify hiring team when stage moves"
              hint="Slack channel #hiring-design"
              checked={notifyStageMoves}
              onChange={setNotifyStageMoves}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
