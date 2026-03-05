import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { FormField } from '@/components/ui/form-field'
import { useOfferApprovalChain, ApprovalChainStep } from '@/hooks/useOfferApprovalChain'
import { useMembers } from '@/hooks/useMembers'
import { usePermissions } from '@/hooks/usePermissions'
import { GripVertical, Trash2, ShieldCheck, Plus } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

interface OfferApprovalChainConfigProps {
  jobId: string
  jobTitle: string
}

function SortableApproverItem({
  step,
  index,
  canConfigure,
  isBusy,
  onRemove,
}: {
  step: ApprovalChainStep
  index: number
  canConfigure: boolean
  isBusy: boolean
  onRemove: (stepId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const getRoleBadgeVariant = (role: string | null) => {
    switch (role) {
      case 'admin': return 'destructive' as const
      case 'recruiter': return 'default' as const
      case 'hiring_manager': return 'secondary' as const
      case 'interviewer': return 'outline' as const
      default: return 'secondary' as const
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center justify-between p-4 border border-border rounded-md bg-background',
        isDragging && 'opacity-50'
      )}
    >
      <div className="flex items-center gap-4">
        {canConfigure && (
          <button
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="flex items-center justify-center h-7 w-7 rounded-full bg-accent text-accent-foreground text-sm font-semibold">
          {index + 1}
        </span>
        <div>
          <div className="font-medium text-text-primary">{step.approver_name}</div>
          {step.approver_email && (
            <div className="text-sm text-text-secondary">{step.approver_email}</div>
          )}
        </div>
        {step.approver_role && (
          <Badge variant={getRoleBadgeVariant(step.approver_role)}>
            {step.approver_role}
          </Badge>
        )}
      </div>

      {canConfigure && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(step.id)}
          disabled={isBusy}
          title="Remove approver"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export function OfferApprovalChainConfig({ jobId, jobTitle }: OfferApprovalChainConfigProps) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const {
    isLoading,
    isEnabled,
    steps,
    toggleChain,
    addApprover,
    removeApprover,
    reorderSteps,
    isToggling,
    isAdding,
    isRemoving,
    isReordering,
  } = useOfferApprovalChain(jobId)
  const { members, isLoading: membersLoading } = useMembers(true)
  const permissions = usePermissions()

  const canConfigure = permissions.isPlatformAdmin || permissions.isWorkspaceOwner || permissions.isAdmin

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  if (!permissions.canViewJobAssignments) return null

  if (isLoading || membersLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-text-primary">Offer Approval Chain</h2>
        </div>
        <div className="bg-surface-primary border border-border rounded-brand p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  const approverUserIds = new Set(steps.map(s => s.approver_user_id))
  const availableMembers = members.filter(m => {
    if (!m.user_id || approverUserIds.has(m.user_id)) return false
    if (m.user_status !== 'active') return false
    return true
  })

  const memberOptions = availableMembers.map(member => {
    const firstName = member.user_first_name || ''
    const lastName = member.user_last_name || ''
    const displayName = `${firstName} ${lastName}`.trim() || member.user_email || 'Unnamed User'
    return {
      value: member.user_id!,
      label: displayName,
      badge: member.member_role,
    }
  })

  const handleAddApprover = () => {
    if (!selectedUserId) return
    addApprover(selectedUserId)
    setSelectedUserId('')
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = steps.findIndex(s => s.id === active.id)
    const newIndex = steps.findIndex(s => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(steps, oldIndex, newIndex)
    reorderSteps(reordered.map(s => s.id))
  }

  const isBusy = isAdding || isRemoving || isReordering

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-text-primary">Offer Approval Chain</h2>
        <p className="text-sm text-text-secondary">
          Configure the approval chain for offers on "{jobTitle}". When enabled, offers must be approved in order before they can be sent.
        </p>
      </div>

      {/* Toggle Section */}
      <div className="bg-surface-primary border border-border rounded-brand p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-text-secondary" />
            <div>
              <p className="font-medium text-text-primary">Enable offer approval</p>
              <p className="text-sm text-text-secondary">
                Require approval before offers can be sent to candidates
              </p>
            </div>
          </div>
          {canConfigure ? (
            <Switch
              checked={isEnabled}
              onCheckedChange={toggleChain}
              disabled={isToggling}
            />
          ) : (
            <Badge variant={isEnabled ? 'default' : 'secondary'}>
              {isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          )}
        </div>
      </div>

      {/* Approvers List - only show when enabled */}
      {isEnabled && (
        <>
          {/* Add Approver */}
          {canConfigure && (
            <div className="bg-surface-primary border border-border rounded-brand p-6">
              <h3 className="text-lg font-medium text-text-primary mb-4">Add Approver</h3>
              <div className="space-y-4">
                <FormField label="Select a member to add as approver">
                  <SearchableSelect
                    options={memberOptions}
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                    placeholder="Search for a member..."
                    searchPlaceholder="Type to search members..."
                    emptyMessage="No available members found."
                    disabled={isBusy}
                  />
                </FormField>
                <Button
                  onClick={handleAddApprover}
                  disabled={!selectedUserId || isBusy}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Approver
                </Button>
              </div>
            </div>
          )}

          {/* Approval Chain Steps */}
          <div className="bg-surface-primary border border-border rounded-brand p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-text-primary">Approval Order</h3>
              <Badge variant="secondary">
                {steps.length} {steps.length === 1 ? 'approver' : 'approvers'}
              </Badge>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-8 text-text-secondary">
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No approvers configured yet.</p>
                {canConfigure && (
                  <p className="text-sm mt-1">Use the form above to add approvers.</p>
                )}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={steps.map(s => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {steps.map((step, index) => (
                      <SortableApproverItem
                        key={step.id}
                        step={step}
                        index={index}
                        canConfigure={canConfigure}
                        isBusy={isBusy}
                        onRemove={removeApprover}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}
    </div>
  )
}
