import { useEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Users, Search, UserPlus, UserMinus, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MemberAvatar } from './wizard/_parts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { useJobAssignments, type JobAssignmentRole } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'
import { usePermissions } from '@/hooks/usePermissions'
import { useWouldUpgradeSeat } from '@/hooks/useWouldUpgradeSeat'
import { SeatUpgradeConfirmDialog } from '@/components/billing/SeatUpgradeConfirmDialog'

interface HiringTeamManageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  jobTitle: string
}

const ROLE_OPTIONS: { value: JobAssignmentRole; label: string }[] = [
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'interviewer', label: 'Interviewer' },
]
const roleLabel = (r: JobAssignmentRole) =>
  ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r

export function HiringTeamManageDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
}: HiringTeamManageDialogProps) {
  const {
    assignments,
    assignUserToJob,
    removeUserFromJob,
    updateAssignmentRole,
    isLoading: assignmentsLoading,
  } = useJobAssignments(jobId)
  const { members } = useMembers(true)
  const permissions = usePermissions()
  const { wouldUpgrade, paidSeatCount } = useWouldUpgradeSeat()

  const [query, setQuery] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [role, setRole] = useState<JobAssignmentRole>('recruiter')
  const [seatConfirm, setSeatConfirm] = useState<
    { action: () => Promise<void>; memberName: string } | null
  >(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedUserId('')
      setRole('recruiter')
      setSearchOpen(false)
      setTimeout(() => searchRef.current?.focus(), 40)
    }
  }, [open])

  const assignedIds = useMemo(
    () => new Set(assignments.map((a) => a.user_id)),
    [assignments]
  )
  const availableMembers = useMemo(
    () => members.filter((m) => m.user_id && !assignedIds.has(m.user_id!)),
    [members, assignedIds]
  )
  const selectedMember = useMemo(
    () => members.find((m) => m.user_id === selectedUserId) || null,
    [members, selectedUserId]
  )

  const displayName = (m: any) =>
    `${m.user_first_name || ''} ${m.user_last_name || ''}`.trim() ||
    m.user_email ||
    'Member'

  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = availableMembers
    if (!q) return pool.slice(0, 25)
    return pool
      .filter((m) => {
        const name = displayName(m).toLowerCase()
        const email = (m.user_email || '').toLowerCase()
        return name.includes(q) || email.includes(q)
      })
      .slice(0, 25)
  }, [availableMembers, query])

  const assignedRows = useMemo(
    () =>
      assignments.map((a) => {
        const m = members.find((mm) => mm.user_id === a.user_id)
        return {
          assignment: a,
          member: m,
          name: m ? displayName(m) : 'Member',
          email: m?.user_email || '',
          avatarUrl: m?.user_avatar_url || null,
        }
      }),
    [assignments, members]
  )

  const doAssign = async () => {
    if (!selectedMember) return
    try {
      await assignUserToJob({
        job_id: jobId,
        user_id: selectedMember.user_id!,
        organization_id: selectedMember.organization_id,
        role,
      })
      setSelectedUserId('')
      setQuery('')
      setRole('recruiter')
      searchRef.current?.focus()
    } catch (e) {
      /* toast in hook */
    }
  }

  const handleAssignClick = () => {
    if (!selectedMember) return
    if (
      role === 'recruiter' &&
      wouldUpgrade(
        selectedMember.user_id,
        selectedMember.system_role,
        selectedMember.user_type
      )
    ) {
      setSeatConfirm({ action: doAssign, memberName: displayName(selectedMember) })
      return
    }
    void doAssign()
  }

  const handleRoleChange = async (
    assignmentId: string,
    newRole: JobAssignmentRole
  ) => {
    if (newRole === 'recruiter') {
      const a = assignments.find((x) => x.id === assignmentId)
      const m = a ? members.find((mm) => mm.user_id === a.user_id) : null
      if (m && wouldUpgrade(m.user_id, m.system_role, m.user_type)) {
        setSeatConfirm({
          action: async () => {
            await updateAssignmentRole(assignmentId, newRole)
          },
          memberName: displayName(m),
        })
        return
      }
    }
    try {
      await updateAssignmentRole(assignmentId, newRole)
    } catch {
      /* toast in hook */
    }
  }

  const canManage = permissions.canManageJobAssignments

  return (
    <>
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[60] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          style={{ background: 'rgba(13,13,9,0.34)' }}
        />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{
            width: 600,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 48px)',
            background: '#ffffff',
            borderRadius: 18,
            boxShadow:
              '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            Manage the hiring team for {jobTitle}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Choose who can access {jobTitle} and their role on this job.
          </DialogPrimitive.Description>

          {/* HEADER */}
          <header
            className="flex items-start gap-3 shrink-0"
            style={{ padding: '20px 24px 18px', borderBottom: '1px solid #F1F0EC' }}
          >
            <span
              className="flex items-center justify-center shrink-0"
              style={{
                height: 38,
                width: 38,
                background: '#EDE4FF',
                borderRadius: 11,
                color: '#6F3FF5',
              }}
            >
              <Users style={{ height: 17, width: 17 }} strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <div
                className="font-inter"
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '0.09em',
                  color: '#8B8F9E',
                  textTransform: 'uppercase',
                }}
              >
                Job · Hiring team
              </div>
              <h2
                className="font-poppins"
                style={{
                  fontSize: 19,
                  fontWeight: 600,
                  letterSpacing: '-0.035em',
                  color: '#0d0d09',
                  marginTop: 2,
                }}
              >
                Manage the hiring team
                <span style={{ color: '#D7C5FB' }}>.</span>
              </h2>
              <p
                className="font-inter"
                style={{
                  fontSize: 12.5,
                  color: '#5A6072',
                  marginTop: 4,
                  lineHeight: 1.45,
                }}
              >
                Choose who can access <strong style={{ color: '#1F2230', fontWeight: 600 }}>{jobTitle}</strong>{' '}
                and their role on this job.
              </p>
            </div>
            <DialogPrimitive.Close
              className="flex items-center justify-center shrink-0 rounded-md transition-colors hover:bg-[#F6F5F1]"
              style={{ height: 30, width: 30, color: '#8B8F9E', background: 'transparent' }}
              aria-label="Close"
            >
              <X style={{ height: 17, width: 17 }} strokeWidth={2} />
            </DialogPrimitive.Close>
          </header>

          {/* BODY */}
          <div
            className="flex-1 min-h-0 overflow-y-auto"
            style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            {!canManage ? (
              <div
                className="font-inter"
                style={{ fontSize: 13, color: '#5A6072', textAlign: 'center', padding: 24 }}
              >
                You don't have permission to manage job assignments.
              </div>
            ) : (
              <>
                {/* 1 · Add a person */}
                <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div
                    className="font-poppins"
                    style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}
                  >
                    Add a person
                  </div>

                  <div className="flex items-end" style={{ gap: 8 }}>
                    {/* Search field with dropdown */}
                    <Popover
                      open={searchOpen && !selectedMember}
                      onOpenChange={setSearchOpen}
                    >
                      <PopoverAnchor asChild>
                        <div className="relative flex-1 min-w-0">
                      <Search
                        style={{
                          position: 'absolute',
                          left: 11,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          height: 15,
                          width: 15,
                          color: '#8B8F9E',
                          pointerEvents: 'none',
                        }}
                        strokeWidth={2}
                      />
                      {selectedMember ? (
                        <div
                          className="flex items-center"
                          style={{
                            height: 38,
                            paddingLeft: 8,
                            paddingRight: 8,
                            background: '#FAF8FF',
                            border: '1px solid #DFCBFB',
                            borderRadius: 9,
                            gap: 8,
                          }}
                        >
                          <MemberAvatar
                            name={displayName(selectedMember)}
                            url={selectedMember.user_avatar_url}
                            size={22}
                          />
                          <span
                            className="font-poppins truncate"
                            style={{ fontSize: 13, fontWeight: 500, color: '#0d0d09' }}
                          >
                            {displayName(selectedMember)}
                          </span>
                          <span
                            className="font-inter truncate"
                            style={{ fontSize: 11, color: '#8B8F9E' }}
                          >
                            {selectedMember.user_email}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserId('')
                              setQuery('')
                              setTimeout(() => searchRef.current?.focus(), 20)
                            }}
                            className="ml-auto flex items-center justify-center rounded hover:bg-[#EDE4FF]"
                            style={{ height: 22, width: 22, color: '#5B21B6' }}
                            aria-label="Clear selected member"
                          >
                            <X style={{ height: 13, width: 13 }} strokeWidth={2} />
                          </button>
                        </div>
                      ) : (
                        <input
                          ref={searchRef}
                          value={query}
                          onChange={(e) => {
                            setQuery(e.target.value)
                            setSearchOpen(true)
                          }}
                          onFocus={() => setSearchOpen(true)}
                          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                          placeholder="Search members to add…"
                          className="w-full font-inter"
                          style={{
                            height: 38,
                            paddingLeft: 32,
                            paddingRight: 12,
                            background: '#ffffff',
                            border: '1px solid #E0DDD3',
                            borderRadius: 9,
                            fontSize: 13,
                            color: '#1F2230',
                            outline: 'none',
                          }}
                        />
                      )}

                      <PopoverContent
                        align="start"
                        sideOffset={6}
                        className="z-[120] p-1"
                        style={{ width: 'var(--radix-popover-trigger-width)', maxHeight: 240, overflowY: 'auto' }}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                          {filteredResults.length === 0 ? (
                            <div
                              className="font-inter"
                              style={{ padding: '10px 12px', fontSize: 12, color: '#8B8F9E' }}
                            >
                              No matching members.
                            </div>
                          ) : (
                            filteredResults.map((m) => (
                              <button
                                key={m.user_id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  setSelectedUserId(m.user_id!)
                                  setQuery('')
                                  setSearchOpen(false)
                                }}
                                className="w-full flex items-center text-left rounded-md hover:bg-[#FAFAF7]"
                                style={{
                                  padding: '6px 8px',
                                  gap: 9,
                                  background: 'transparent',
                                  border: 0,
                                  cursor: 'pointer',
                                }}
                              >
                                <MemberAvatar
                                  name={displayName(m)}
                                  url={m.user_avatar_url}
                                  size={28}
                                />
                                <div className="min-w-0 flex-1">
                                  <div
                                    className="font-poppins truncate"
                                    style={{ fontSize: 13, fontWeight: 500, color: '#1F2230' }}
                                  >
                                    {displayName(m)}
                                  </div>
                                  <div
                                    className="font-inter truncate"
                                    style={{ fontSize: 11, color: '#8B8F9E' }}
                                  >
                                    {m.user_email || m.organization_name}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                      </PopoverContent>
                    </div>

                    {/* Role select */}
                    <div style={{ width: 160 }}>
                      <Select
                        value={role}
                        onValueChange={(v) => setRole(v as JobAssignmentRole)}
                      >
                        <SelectTrigger
                          style={{ height: 38, background: '#ffffff', borderColor: '#E0DDD3', borderRadius: 9 }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Assign button */}
                    <Button
                      variant="primary"
                      size="md"
                      icon={UserPlus}
                      onClick={handleAssignClick}
                      disabled={!selectedMember || assignmentsLoading}
                    >
                      Assign
                    </Button>
                  </div>
                </section>

                {/* 2 · Assigned */}
                <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="flex items-center justify-between">
                    <div
                      className="font-poppins"
                      style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}
                    >
                      Assigned
                    </div>
                    <span
                      className="font-inter"
                      style={{
                        background: '#F1F0EC',
                        color: '#5A6072',
                        fontSize: 11.5,
                        fontWeight: 500,
                        borderRadius: 999,
                        padding: '3px 10px',
                      }}
                    >
                      {assignments.length} assigned
                    </span>
                  </div>

                  {assignedRows.length === 0 ? (
                    <div
                      className="font-inter"
                      style={{
                        textAlign: 'center',
                        padding: '18px 12px',
                        fontSize: 12.5,
                        color: '#8B8F9E',
                        background: '#FAFAF7',
                        border: '1px dashed #EDECE6',
                        borderRadius: 11,
                      }}
                    >
                      No one assigned yet — add someone above.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {assignedRows.map((row) => (
                        <div
                          key={row.assignment.id}
                          className="flex items-center"
                          style={{
                            gap: 11,
                            padding: '11px 12px',
                            background: '#ffffff',
                            border: '1px solid #EDECE6',
                            borderRadius: 11,
                          }}
                        >
                          <MemberAvatar name={row.name} url={row.avatarUrl} size={34} />
                          <div className="min-w-0 flex-1">
                            <div
                              className="font-poppins truncate"
                              style={{ fontSize: 13, fontWeight: 500, color: '#0d0d09' }}
                            >
                              {row.name}
                            </div>
                            <div
                              className="font-inter truncate"
                              style={{ fontSize: 11, color: '#8B8F9E' }}
                            >
                              {row.email}
                            </div>
                          </div>
                          <div style={{ width: 170 }}>
                            <Select
                              value={row.assignment.role}
                              onValueChange={(v) =>
                                handleRoleChange(row.assignment.id, v as JobAssignmentRole)
                              }
                              disabled={assignmentsLoading}
                            >
                              <SelectTrigger
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
                                {ROLE_OPTIONS.map((o) => {
                                  const selected = o.value === row.assignment.role
                                  return (
                                    <SelectItem
                                      key={o.value}
                                      value={o.value}
                                      className={selected ? 'bg-[#F5EFFF]' : ''}
                                    >
                                      <span className="flex items-center gap-2">
                                        {o.label}
                                        {selected && (
                                          <Check
                                            style={{ height: 13, width: 13, color: '#6F3FF5' }}
                                            strokeWidth={2.5}
                                          />
                                        )}
                                      </span>
                                    </SelectItem>
                                  )
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={UserMinus}
                            onClick={() => removeUserFromJob(row.assignment.id)}
                            disabled={assignmentsLoading}
                            className="text-[#5A6072] hover:text-[#B91C1C]"
                          >
                            Unassign
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>

          {/* FOOTER */}
          <footer
            className="flex items-center shrink-0"
            style={{
              padding: '13px 24px',
              borderTop: '1px solid #F1F0EC',
              background: '#FAFAF7',
              gap: 12,
            }}
          >
            <div
              className="flex items-center font-inter"
              style={{ fontSize: 11.5, color: '#8B8F9E', gap: 6 }}
            >
              <Users style={{ height: 13, width: 13 }} strokeWidth={2} />
              {assignments.length} assigned · {availableMembers.length} available
            </div>
            <div className="ml-auto">
              <Button variant="primary" size="md" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>

    <SeatUpgradeConfirmDialog
      open={!!seatConfirm}
      elevated
      memberName={seatConfirm?.memberName || ''}
      currentPaidSeats={paidSeatCount}
      onConfirm={async () => {
        const action = seatConfirm?.action
        setSeatConfirm(null)
        if (action) await action()
      }}
      onCancel={() => setSeatConfirm(null)}
    />
    </>
  )
}

export default HiringTeamManageDialog
