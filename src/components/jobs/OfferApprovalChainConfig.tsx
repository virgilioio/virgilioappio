import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useOfferApprovalChain, ApprovalChainStep } from '@/hooks/useOfferApprovalChain'
import { useMembers } from '@/hooks/useMembers'
import { usePermissions } from '@/hooks/usePermissions'
import { toast } from '@/hooks/use-toast'
import {
  ApprovalCondition,
  ApprovalMode,
  CONDITION_OPTIONS,
  conditionChipLabel,
} from '@/lib/offerApproval'
import {
  ListChecks,
  UserPlus,
  UserCheck,
  UserMinus,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowDownNarrowWide,
  Rows3,
  Filter,
  Check,
  Send,
  Mail,
  Search,
  Plus,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

interface OfferApprovalChainConfigProps {
  jobId: string
  jobTitle: string
}

const ACCESS_LABEL: Record<string, string> = {
  admin: 'Admin',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring manager',
  interviewer: 'Interviewer',
  member: 'Hiring manager',
  sales: 'Limited',
  guest: 'Limited',
}

function initials(first?: string | null, last?: string | null, email?: string | null) {
  const f = (first || '').trim()
  const l = (last || '').trim()
  if (f || l) return `${f[0] || ''}${l[0] || ''}`.toUpperCase()
  return (email || '?').slice(0, 2).toUpperCase()
}

/* ---------- shells ---------- */

function FormCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-[12px] border border-[#E7E8EE] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-poppins font-semibold uppercase text-[12.5px] tracking-[0.06em] text-[#0d0d09]">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 font-inter text-[11.5px] text-[#8B8F9E]">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Toggle({
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
        'relative shrink-0 rounded-full transition-colors',
        disabled && 'opacity-45 cursor-not-allowed'
      )}
      style={{ width: 32, height: 18, backgroundColor: checked ? '#6F3FF5' : '#D1D0CB' }}
    >
      <span
        className="absolute top-[2px] rounded-full bg-white transition-all"
        style={{ width: 14, height: 14, left: checked ? 16 : 2 }}
      />
    </button>
  )
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
  hairline,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  hairline?: boolean
}) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 py-3', hairline && 'border-t')}
      style={hairline ? { borderColor: '#F6F5F1' } : undefined}
    >
      <div className="min-w-0">
        <p className="font-inter font-medium text-[12.5px] text-[#0d0d09]">{title}</p>
        <p className="mt-0.5 font-inter text-[11.5px] leading-[1.5] text-[#8B8F9E]">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

/* ---------- condition select ---------- */

function ConditionSelect({
  value,
  disabled,
  onChange,
}: {
  value: ApprovalCondition
  disabled?: boolean
  onChange: (c: ApprovalCondition) => void
}) {
  const [open, setOpen] = useState(false)
  const isAlways = value === 'always'
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 font-inter text-[11.5px] transition-colors',
            disabled && 'opacity-60 cursor-not-allowed'
          )}
          style={{
            height: 26,
            backgroundColor: isAlways ? '#FFFFFF' : '#F6F2FF',
            border: `1px solid ${isAlways ? '#E0DDD3' : '#D7C5FB'}`,
            color: isAlways ? '#5A6072' : '#5B2FD1',
          }}
        >
          {!isAlways && <Filter className="h-3 w-3" style={{ color: '#6F3FF5' }} />}
          {conditionChipLabel(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="p-[5px] rounded-[12px]" style={{ width: 240 }}>
        <p className="px-2 pt-1.5 pb-2 font-inter text-[10px] uppercase tracking-[0.08em] text-[#8B8F9E]">
          Require this approval
        </p>
        {CONDITION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              onChange(opt.value)
              setOpen(false)
            }}
            className="w-full flex items-center justify-between gap-2 rounded-[8px] px-2 text-left font-inter text-[12.5px] text-[#0d0d09] hover:bg-[#F1F0EC]"
            style={{ height: 30 }}
          >
            <span>{opt.menuLabel}</span>
            {value === opt.value && <Check className="h-3.5 w-3.5" style={{ color: '#6F3FF5' }} />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/* ---------- chain row ---------- */

function ChainRow({
  step,
  index,
  total,
  mode,
  canEdit,
  onCondition,
  onMove,
  onRemove,
}: {
  step: ApprovalChainStep
  index: number
  total: number
  mode: ApprovalMode
  canEdit: boolean
  onCondition: (c: ApprovalCondition) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const sequential = mode === 'sequential'
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
    disabled: !canEdit || !sequential,
  })
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : undefined }}
      className="grid"
      {...(canEdit && sequential ? { ...attributes, ...listeners } : {})}
    >
      <div className="grid" style={{ gridTemplateColumns: '26px 1fr' }}>
        <div className="flex flex-col items-center">
          {sequential ? (
            <div
              className="flex items-center justify-center rounded-full font-poppins font-semibold"
              style={{ width: 24, height: 24, backgroundColor: '#0d0d09', color: '#fffcf9', fontSize: 11 }}
            >
              {index + 1}
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded-full"
              style={{ width: 24, height: 24, backgroundColor: '#EDEBE4' }}
            >
              <UserCheck className="h-3 w-3" style={{ color: '#5A6072' }} />
            </div>
          )}
          {sequential && <div className="flex-1 w-[1.5px]" style={{ backgroundColor: '#E0DDD3' }} />}
        </div>

        <div
          className="grid items-center gap-2 bg-white mb-2 rounded-[10px]"
          style={{
            border: '1px solid #E7E8EE',
            padding: '10px 10px 10px 12px',
            gridTemplateColumns: '1fr auto auto',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="font-inter text-[10.5px]">
                {initials(null, null, step.approver_name || step.approver_email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-inter font-medium text-[12.5px] text-[#0d0d09] truncate">
                  {step.approver_name}
                </p>
                {(step.approver_role === 'sales' || step.approver_role === 'guest') && (
                  <span
                    className="rounded-full px-1.5 font-inter text-[10px]"
                    style={{ backgroundColor: '#F1F0EC', color: '#8B8F9E' }}
                  >
                    Limited access
                  </span>
                )}
              </div>
              <p className="font-inter text-[10.5px] text-[#8B8F9E] truncate">
                {[ACCESS_LABEL[step.approver_role || ''] || 'Member', step.approver_email]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>

          <ConditionSelect value={step.condition} disabled={!canEdit} onChange={onCondition} />

          {canEdit ? (
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-[8px] hover:bg-[#F1F0EC]"
                  style={{ width: 26, height: 26 }}
                  aria-label="Row menu"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" style={{ color: '#5A6072' }} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="p-[5px]"
                style={{
                  width: 200,
                  border: '1px solid #EDECE6',
                  borderRadius: 12,
                  boxShadow: '0 16px 40px -8px rgba(13,13,9,0.24)',
                }}
              >
                {sequential && (
                  <>
                    <MenuItem icon={ArrowUp} label="Move earlier" disabled={index === 0} onClick={() => onMove(-1)} />
                    <MenuItem
                      icon={ArrowDown}
                      label="Move later"
                      disabled={index === total - 1}
                      onClick={() => onMove(1)}
                    />
                    <div className="my-1 h-px" style={{ backgroundColor: '#F1F0EC' }} />
                  </>
                )}
                <MenuItem
                  icon={Mail}
                  label="Send a test request"
                  onClick={() => {
                    setMenuOpen(false)
                    toast({ title: 'Test request sent', description: `${step.approver_name} received a test approval request.` })
                  }}
                />
                <div className="my-1 h-px" style={{ backgroundColor: '#F1F0EC' }} />
                <MenuItem icon={UserMinus} label="Remove from chain" danger onClick={onRemove} />
              </PopoverContent>
            </Popover>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: any
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 rounded-[8px] px-2 text-left font-inter text-[12.5px]',
        disabled ? 'opacity-40 cursor-not-allowed' : danger ? 'hover:bg-[#FEF2F2]' : 'hover:bg-[#F1F0EC]'
      )}
      style={{ height: 30, color: danger ? '#B91C1C' : '#0d0d09' }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

/* ---------- add approver ---------- */

function AddApproverPopover({
  members,
  existingIds,
  onAdd,
}: {
  members: any[]
  existingIds: Set<string>
  onAdd: (userId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members
      .filter((m) => m.user_id && m.user_status === 'active')
      .map((m) => ({
        id: m.user_id as string,
        name:
          `${m.user_first_name || ''} ${m.user_last_name || ''}`.trim() || m.user_email || 'Member',
        email: m.user_email as string | null,
        access: ACCESS_LABEL[m.system_role || ''] || 'Member',
      }))
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q))
  }, [members, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" icon={UserPlus}>
          Add approver
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="p-[5px]"
        style={{
          width: 300,
          border: '1px solid #EDECE6',
          borderRadius: 12,
          boxShadow: '0 16px 40px -8px rgba(13,13,9,0.24)',
        }}
      >
        <div className="relative px-1 pt-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: '#8B8F9E' }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspace users…"
            className="w-full rounded-[8px] pl-8 pr-2 font-inter text-[12.5px] outline-none"
            style={{ height: 32, backgroundColor: '#FAFAF7', border: '1px solid #EDECE6' }}
          />
        </div>
        <p className="px-2 pt-2.5 pb-1 font-inter text-[10px] uppercase tracking-[0.08em] text-[#8B8F9E]">
          Users with ATS access
        </p>
        <div className="overflow-y-auto" style={{ maxHeight: 264 }}>
          {rows.length === 0 ? (
            <p className="py-5 text-center font-inter text-[12px] text-[#8B8F9E]">
              No one matches “{query}”.
            </p>
          ) : (
            rows.map((r) => {
              const added = existingIds.has(r.id)
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={added}
                  onClick={() => {
                    onAdd(r.id)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left',
                    added ? 'cursor-default' : 'hover:bg-[#F1F0EC]'
                  )}
                >
                  <Avatar className="h-[26px] w-[26px]">
                    <AvatarFallback className="font-inter text-[10px]">
                      {initials(null, null, r.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-inter font-medium text-[12.5px] text-[#0d0d09] truncate">{r.name}</p>
                    <p className="font-inter text-[10.5px] text-[#8B8F9E] truncate">
                      {[r.email, r.access].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {added ? (
                    <span className="font-inter text-[11px] text-[#5A6072]" style={{ opacity: 0.55 }}>
                      Added
                    </span>
                  ) : (
                    <Plus className="h-3.5 w-3.5" style={{ color: '#5A6072' }} />
                  )}
                </button>
              )
            })
          )}
        </div>
        <div className="mt-1 pt-2 px-2 pb-1 border-t" style={{ borderColor: '#F1F0EC' }}>
          <p className="font-inter text-[10.5px] text-[#B5B9C4]">
            Only workspace members can approve. Invite someone from Settings → Members.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ---------- main ---------- */

export function OfferApprovalChainConfig({ jobId, jobTitle }: OfferApprovalChainConfigProps) {
  const {
    isLoading,
    isEnabled,
    steps,
    mode,
    rules,
    toggleChain,
    addApprover,
    removeApprover,
    reorderSteps,
    setMode,
    setRules,
    setStepCondition,
  } = useOfferApprovalChain(jobId)
  const { members, isLoading: membersLoading } = useMembers(true)
  const permissions = usePermissions()

  const canEdit = permissions.isPlatformAdmin || permissions.isWorkspaceOwner || permissions.isAdmin
  const sequential = mode === 'sequential'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  )

  if (!permissions.canViewJobAssignments) return null

  if (isLoading || membersLoading) {
    return (
      <div className="bg-white rounded-[12px] border border-[#E7E8EE] p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-3.5 w-1/3 rounded bg-[#F1F0EC]" />
          <div className="h-10 rounded bg-[#F1F0EC]" />
        </div>
      </div>
    )
  }

  const existingIds = new Set(steps.map((s) => s.approver_user_id))

  const handleMove = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= steps.length) return
    reorderSteps(arrayMove(steps, index, target).map((s) => s.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = steps.findIndex((s) => s.id === active.id)
    const newIndex = steps.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorderSteps(arrayMove(steps, oldIndex, newIndex).map((s) => s.id))
  }

  const headerBadge = !isEnabled
    ? { label: 'Approval off', bg: '#FEF3C7', color: '#92400E' }
    : {
        label: `${steps.length} ${steps.length === 1 ? 'approver' : 'approvers'} · ${sequential ? 'in order' : 'all at once'}`,
        bg: '#F1F0EC',
        color: '#5A6072',
      }

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <h2
          className="font-poppins font-semibold text-[18px] text-[#0d0d09]"
          style={{ letterSpacing: '-0.025em' }}
        >
          Offer approval<span style={{ color: '#D7C5FB' }}>.</span>
        </h2>
        <span
          className="rounded-full px-2.5 py-1 font-inter text-[11px]"
          style={{ backgroundColor: headerBadge.bg, color: headerBadge.color }}
        >
          {headerBadge.label}
        </span>
      </div>

      {!canEdit && (
        <p className="font-inter text-[11.5px] text-[#8B8F9E]">
          Only workspace admins can change the approval chain.
        </p>
      )}

      {/* Requirement */}
      <FormCard title="Approval requirement">
        <ToggleRow
          title="Require approval before an offer is sent"
          description="Offers stay in Draft until every required approver signs off. Admins configure this; recruiters can't bypass it."
          checked={isEnabled}
          onChange={toggleChain}
          disabled={!canEdit}
        />
        {isEnabled && (
          <div className="flex items-start justify-between gap-4 pt-3 border-t" style={{ borderColor: '#F1F0EC' }}>
            <div className="min-w-0">
              <p className="font-inter font-medium text-[12.5px] text-[#0d0d09]">Approval order</p>
              <p className="mt-0.5 font-inter text-[11.5px] leading-[1.5] text-[#8B8F9E]">
                {sequential
                  ? 'Each approver is asked only after the one before them approves.'
                  : 'Everyone is asked at the same time — the offer unlocks when all have approved.'}
              </p>
            </div>
            <div
              className="inline-flex shrink-0 items-center gap-1"
              style={{ backgroundColor: '#F1F0EC', borderRadius: 9, padding: 3 }}
            >
              {([
                { value: 'sequential' as ApprovalMode, label: 'In order', icon: ArrowDownNarrowWide },
                { value: 'parallel' as ApprovalMode, label: 'All at once', icon: Rows3 },
              ]).map((opt) => {
                const active = mode === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setMode(opt.value)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 font-inter',
                      !canEdit && 'cursor-not-allowed opacity-60'
                    )}
                    style={{
                      backgroundColor: active ? '#FFFFFF' : 'transparent',
                      boxShadow: active ? '0 1px 2px rgba(13,13,9,0.08)' : undefined,
                      fontSize: 12,
                      fontWeight: active ? 600 : 500,
                      color: active ? '#0d0d09' : '#5A6072',
                    }}
                  >
                    <opt.icon className="h-3.5 w-3.5" style={{ color: active ? '#6F3FF5' : '#8B8F9E' }} />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </FormCard>

      {/* Chain */}
      {isEnabled && (
        <FormCard
          title="Approval chain"
          subtitle={
            sequential
              ? 'Runs top to bottom. Drag or use the row menu to reorder.'
              : "Order doesn't matter — all requests go out together."
          }
          action={
            canEdit ? (
              <AddApproverPopover members={members} existingIds={existingIds} onAdd={(id) => addApprover(id)} />
            ) : undefined
          }
        >
          {steps.length === 0 ? (
            <div className="flex flex-col items-center text-center" style={{ padding: '26px 0' }}>
              <div
                className="flex items-center justify-center rounded-[10px]"
                style={{ width: 34, height: 34, backgroundColor: '#F6F2FF' }}
              >
                <ListChecks className="h-4 w-4" style={{ color: '#6F3FF5' }} />
              </div>
              <p className="mt-2.5 font-poppins font-semibold text-[13px] text-[#0d0d09]">No approvers yet</p>
              <p className="mt-1 font-inter text-[11.5px] text-[#8B8F9E]">
                Offers for this job will send without a sign-off step.
              </p>
            </div>
          ) : (
            <>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  {steps.map((step, index) => (
                    <ChainRow
                      key={step.id}
                      step={step}
                      index={index}
                      total={steps.length}
                      mode={mode}
                      canEdit={canEdit}
                      onCondition={(c) => setStepCondition(step.id, c)}
                      onMove={(dir) => handleMove(index, dir)}
                      onRemove={() => removeApprover(step.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {/* Terminal node */}
              <div className="grid items-center" style={{ gridTemplateColumns: '26px 1fr' }}>
                <div className="flex justify-center">
                  <div
                    className="flex items-center justify-center rounded-full"
                    style={{ width: 24, height: 24, backgroundColor: '#12B886' }}
                  >
                    <Send className="h-3 w-3 text-white" />
                  </div>
                </div>
                <p className="font-inter text-[11.5px] text-[#0d0d09]">
                  Offer letter released to the candidate{' '}
                  <span style={{ color: '#8B8F9E' }}>· e-signature via DocuSign</span>
                </p>
              </div>
            </>
          )}
        </FormCard>
      )}

      {/* Rules */}
      {isEnabled && (
        <FormCard title="Approval rules">
          <ToggleRow
            title="Remind approvers after 24 hours"
            description="Email + Slack nudge to anyone who hasn't responded."
            checked={rules.remind24h}
            disabled={!canEdit}
            onChange={(v) => setRules({ ...rules, remind24h: v })}
          />
          <ToggleRow
            hairline
            title="Auto-escalate after 3 days"
            description="Passes the request to the approver's manager and flags it on the job dashboard."
            checked={rules.autoEscalate}
            disabled={!canEdit}
            onChange={(v) => setRules({ ...rules, autoEscalate: v })}
          />
          <ToggleRow
            hairline
            title="Workspace admins can override the chain"
            description="Lets an admin release an offer without full sign-off. The override is recorded in the audit log."
            checked={rules.adminOverride}
            disabled={!canEdit}
            onChange={(v) => setRules({ ...rules, adminOverride: v })}
          />
          <ToggleRow
            hairline
            title="Notify the chain when the offer goes out"
            description="Everyone who approved gets a copy of the final offer."
            checked={rules.notifyChain}
            disabled={!canEdit}
            onChange={(v) => setRules({ ...rules, notifyChain: v })}
          />
        </FormCard>
      )}
    </section>
  )
}
