import { useState, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { SpecCard } from '@/components/settings/shared/SpecCard'
import { SpecChip, type SpecChipTone } from '@/components/settings/shared/SpecChip'
import { toast } from '@/hooks/use-toast'
import { Member } from '@/hooks/useMembers'
import { MemberDetailSheet } from '@/components/members/MemberDetailSheet'
import { MoreHorizontal, Send, UserCheck, UserX, UserPlus, Trash2, Copy, Briefcase, Search } from 'lucide-react'

export interface EnrichedMember extends Member {
  seatType?: 'paid' | 'free'
  effectiveRole?: 'Owner' | 'Admin' | 'Sales' | 'Recruiter' | 'Hiring Manager' | 'Interviewer'
}

interface MembersTableProps {
  members: EnrichedMember[]
  isLoading: boolean
  onEdit: (member: EnrichedMember) => void
  onDeactivate: (id: string) => void
  onResendInvitation: (memberId: string, email: string) => void
  onDeleteUser: (member: EnrichedMember) => void
  onManageJobAssignments?: (member: EnrichedMember) => void
  onAddNew?: () => void
}

const ROLE_TONE: Record<string, SpecChipTone> = {
  Owner: 'blue',
  Admin: 'blue',
  Sales: 'purple',
  Recruiter: 'purple',
  'Hiring Manager': 'amber',
  Interviewer: 'amber',
}

function getDisplayName(m: EnrichedMember) {
  if (m.user_first_name && m.user_last_name) return `${m.user_first_name} ${m.user_last_name}`
  if (m.user_first_name) return m.user_first_name
  return m.user_email || m.invited_email || 'Unknown User'
}
function getDisplayEmail(m: EnrichedMember) {
  return m.user_email || m.invited_email || ''
}
function getInitials(m: EnrichedMember) {
  const first = m.user_first_name?.[0] || ''
  const last = m.user_last_name?.[0] || ''
  if (first || last) return `${first}${last}`.toUpperCase()
  return (m.user_email || m.invited_email || '?')[0].toUpperCase()
}

export function MembersTable({
  members, isLoading, onEdit, onDeactivate, onResendInvitation,
  onDeleteUser, onManageJobAssignments, onAddNew,
}: MembersTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [seatFilter, setSeatFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [copyingInvite, setCopyingInvite] = useState<string | null>(null)
  const [detailMember, setDetailMember] = useState<EnrichedMember | null>(null)

  const filtered = useMemo(() => members.filter(m => {
    const term = searchTerm.toLowerCase()
    if (term) {
      const hay = `${getDisplayName(m)} ${getDisplayEmail(m)}`.toLowerCase()
      if (!hay.includes(term)) return false
    }
    if (roleFilter !== 'all' && m.effectiveRole !== roleFilter) return false
    if (seatFilter !== 'all' && m.seatType !== seatFilter) return false
    if (statusFilter !== 'all' && m.user_status !== statusFilter) return false
    return true
  }), [members, searchTerm, roleFilter, seatFilter, statusFilter])

  const copyInviteLink = async (m: EnrichedMember) => {
    if (!m.invite_token) {
      toast({ title: 'Error', description: 'No invitation token. Resend the invite first.', variant: 'destructive' })
      return
    }
    setCopyingInvite(m.id)
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/accept-invite/${m.invite_token}`)
      toast({ title: 'Copied', description: 'Invitation link copied' })
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' })
    } finally { setCopyingInvite(null) }
  }

  const handleResend = async (m: EnrichedMember) => {
    const email = m.user_email || m.invited_email
    if (!email) return
    try { await onResendInvitation(m.id, email) } catch (e) { console.error(e) }
  }

  const filterPillBase = 'h-7 px-3 rounded-full border bg-white font-inter text-[11.5px] text-[#5A6072] hover:bg-[#FAFAF7] outline-none focus:ring-2 focus:ring-virgilio-purple/30 cursor-pointer'
  const pillStyle: React.CSSProperties = { borderColor: '#E7E8EE' }

  const renderRole = (m: EnrichedMember) => {
    const role = m.effectiveRole || (m.system_role === 'admin' ? 'Admin' : 'Hiring Manager')
    return <SpecChip tone={ROLE_TONE[role] ?? 'gray'}>{role}</SpecChip>
  }
  const renderSeat = (m: EnrichedMember) => m.seatType ? (
    <SpecChip tone={m.seatType === 'paid' ? 'purple' : 'gray'}>{m.seatType === 'paid' ? 'Paid' : 'Free'}</SpecChip>
  ) : null
  const renderStatus = (m: EnrichedMember) => {
    if (m.user_status === 'active') return <SpecChip tone="green">Active</SpecChip>
    if (m.user_status === 'invited') return <SpecChip tone="amber">Invited</SpecChip>
    return <SpecChip tone="gray">Inactive</SpecChip>
  }

  return (
    <>
      <SpecCard
        title="Team members"
        description="Paid seats: admins, owners & recruiters. Hiring managers and interviewers are free."
        action={onAddNew ? (
          <button
            type="button"
            onClick={onAddNew}
            className="inline-flex items-center gap-1.5 font-inter font-semibold text-[12px] rounded-lg hover:opacity-90 transition-opacity"
            style={{ background: '#0d0d09', color: '#fffcf9', height: 30, padding: '0 12px' }}
          >
            <UserPlus size={14} strokeWidth={2} /> Add member
          </button>
        ) : undefined}
      >
        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-2" style={{ padding: '12px 18px', borderBottom: '1px solid #F1F0EC' }}>
          <div className="relative flex-1 min-w-[180px] max-w-[280px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B8F9E]" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search members…"
              className="h-[30px] pl-8 font-inter text-[12px] rounded-lg"
              style={{ background: '#F6F5F1', border: 'none' }}
            />
          </div>
          <select value={seatFilter} onChange={(e) => setSeatFilter(e.target.value)} className={filterPillBase} style={pillStyle}>
            <option value="all">All seats</option><option value="paid">Paid</option><option value="free">Free</option>
          </select>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={filterPillBase} style={pillStyle}>
            <option value="all">All roles</option><option>Owner</option><option>Admin</option><option>Recruiter</option><option>Hiring Manager</option><option>Interviewer</option><option>Sales</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterPillBase} style={pillStyle}>
            <option value="all">All statuses</option><option value="active">Active</option><option value="invited">Invited</option><option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="font-inter text-[12px] text-[#8B8F9E]" style={{ padding: '18px' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="font-inter text-[12px] text-[#8B8F9E] text-center" style={{ padding: '24px 18px' }}>
            No team members.
          </div>
        ) : (
          filtered.map((m, idx) => {
            const isInactive = m.user_status === 'inactive'
            const isInvited = m.user_status === 'invited'
            const displayName = isInvited ? getDisplayEmail(m) : getDisplayName(m)
            const sub = isInvited ? 'Invite pending' : getDisplayEmail(m)
            return (
              <div
                key={m.id}
                onClick={() => setDetailMember(m)}
                className={`flex items-center gap-3 cursor-pointer hover:bg-[#FAFAF7] transition-colors ${isInactive ? 'opacity-60' : ''}`}
                style={{
                  padding: '10px 18px',
                  borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid #F1F0EC',
                }}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={m.user_avatar_url || undefined} />
                  <AvatarFallback className="text-[10.5px] font-inter font-semibold bg-[#F1F0EC] text-[#5A6072]">
                    {getInitials(m)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-inter font-semibold text-[#1F2230] truncate" style={{ fontSize: 12.5, lineHeight: 1.3 }}>
                    {displayName}
                  </div>
                  {sub && (
                    <div className="font-inter text-[#8B8F9E] truncate" style={{ fontSize: 10.5, lineHeight: 1.3 }}>
                      {sub}
                    </div>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  {renderRole(m)}
                  {renderSeat(m)}
                  {renderStatus(m)}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      aria-label="Member actions"
                      className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-[#F1F0EC] text-[#8B8F9E]"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(m) }}>Edit Member</DropdownMenuItem>
                    {onManageJobAssignments && m.user_status === 'active' && (
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onManageJobAssignments(m) }} className="gap-2">
                        <Briefcase className="h-4 w-4" />Manage Job Access
                      </DropdownMenuItem>
                    )}
                    {m.user_status === 'invited' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleResend(m) }} className="gap-2">
                          <Send className="h-4 w-4" />Resend Invitation
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); copyInviteLink(m) }} disabled={copyingInvite === m.id} className="gap-2">
                          <Copy className="h-4 w-4" />{copyingInvite === m.id ? 'Copying…' : 'Copy Invite Link'}
                        </DropdownMenuItem>
                      </>
                    )}
                    {m.user_status === 'active' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeactivate(m.id) }} className="gap-2">
                          <UserX className="h-4 w-4" />Deactivate Member
                        </DropdownMenuItem>
                      </>
                    )}
                    {m.user_status === 'inactive' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(m) }} className="gap-2">
                          <UserCheck className="h-4 w-4" />Reactivate Member
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDeleteUser(m) }} className="gap-2 text-destructive">
                      <Trash2 className="h-4 w-4" />Delete User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })
        )}
      </SpecCard>

      <MemberDetailSheet
        member={detailMember}
        open={!!detailMember}
        onOpenChange={(open) => { if (!open) setDetailMember(null) }}
        onManageJobs={detailMember && onManageJobAssignments ? () => onManageJobAssignments(detailMember) : undefined}
      />
    </>
  )
}
