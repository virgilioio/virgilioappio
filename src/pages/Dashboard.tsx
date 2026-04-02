import { ReactNode, useState } from 'react'
import { WelcomeHeader } from '@/components/dashboard/WelcomeHeader'
import { UpcomingActivities } from '@/components/dashboard/UpcomingActivities'
import { JobsOverview } from '@/components/dashboard/JobsOverview'
import { TrialCountdownBanner } from '@/components/dashboard/TrialCountdownBanner'
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'
import { TasksOverview } from '@/components/dashboard/TasksOverview'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePermissions } from '@/hooks/usePermissions'
import { Section } from '@/components/layout/Section'
import { useOrgContext } from '@/contexts/OrgContext'
import { WorkspaceProvisioningLoader } from '@/components/onboarding/WorkspaceProvisioningLoader'
import { useSourcingProjects } from '@/hooks/useSourcingProjects'
import { useUserJobRoles } from '@/hooks/useUserJobRoles'
import { ApplicationReviewCard } from '@/components/dashboard/ApplicationReviewCard'
import { useDashboardLayout, DashboardCardId, ColumnId } from '@/hooks/useDashboardLayout'
import { DraggableDashboardCard, DashboardCardOverlay } from '@/components/dashboard/DraggableDashboardCard'
import { DroppableColumn } from '@/components/dashboard/DroppableColumn'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Settings2, RotateCcw, Plus } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'

const COLUMN_IDS: ColumnId[] = ['left', 'center', 'right']
const MOBILE_ORDER: DashboardCardId[] = ['agenda', 'tasks', 'app-review', 'onboarding', 'jobs']

const CARD_LABELS: Record<DashboardCardId, string> = {
  'agenda': 'Agenda & Calendar',
  'tasks': 'Tasks',
  'app-review': 'Application Review',
  'onboarding': 'Onboarding Checklist',
  'jobs': 'Jobs Overview',
}

export default function Dashboard() {
  const { profile, isLoading } = useUserProfile()
  const permissions = usePermissions()
  const { isLoading: orgLoading, hasOrganizationContext } = useOrgContext()
  const { data: sourcingProjects } = useSourcingProjects()
  const { hasRecruiterRole, isPrivileged } = useUserJobRoles()
  const {
    columns,
    hiddenCards,
    isCustomizing,
    findCardColumn,
    saveDragStart,
    moveCardToColumn,
    reorderWithinColumn,
    finalizeLayout,
    cancelDrag,
    hideCard,
    showCard,
    resetLayout,
    toggleCustomizing,
  } = useDashboardLayout()
  const isMobile = useIsMobile()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addWidgetOpen, setAddWidgetOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  if (orgLoading || !hasOrganizationContext) {
    return <WorkspaceProvisioningLoader status="finalizing" />
  }

  const hasJobContent = permissions.canViewJobs || permissions.canCreateJobs
  const hasSeenValue = (sourcingProjects?.length ?? 0) > 0

  const cardRegistry: Record<DashboardCardId, ReactNode> = {
    'agenda': <UpcomingActivities />,
    'tasks': <TasksOverview />,
    'app-review': hasJobContent ? <ApplicationReviewCard /> : null,
    'onboarding': <OnboardingChecklist isDeemphasized={!hasSeenValue} />,
    'jobs': hasJobContent ? <div className="hidden sm:block"><JobsOverview permissions={permissions} /></div> : null,
  }

  // --- Mobile: flat stacked list, no DnD ---
  if (isMobile) {
    const mobileCards = MOBILE_ORDER.filter(id => cardRegistry[id] !== null)
    return (
      <div>
        <Section container className="py-6 sm:py-8 lg:py-12 animate-fade-in">
          <div className="space-y-6">
            <WelcomeHeader profile={profile} isLoading={isLoading} />
            <TrialCountdownBanner />
            <div className="flex flex-col gap-6">
              {mobileCards.map(cardId => (
                <div key={cardId} className="min-w-0">{cardRegistry[cardId]}</div>
              ))}
            </div>
          </div>
        </Section>
      </div>
    )
  }

  // --- Desktop / Tablet: multi-column DnD ---

  const handleDragStart = (event: DragStartEvent) => {
    saveDragStart()
    setActiveId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeCardId = String(active.id)
    const overId = String(over.id)

    // Determine source column from sortable data
    const sourceCol = active.data.current?.columnId as ColumnId | undefined
      ?? findCardColumn(activeCardId)
    if (!sourceCol) return

    // Determine target column: over could be a column id or a card id
    let targetCol: ColumnId | null = null
    let targetIndex: number = 0

    if (COLUMN_IDS.includes(overId as ColumnId)) {
      // Dropped over a column droppable (empty area)
      targetCol = overId as ColumnId
      targetIndex = columns[targetCol].length
    } else {
      // Dropped over another card
      targetCol = findCardColumn(overId)
      if (targetCol) {
        targetIndex = columns[targetCol].indexOf(overId as DashboardCardId)
      }
    }

    if (!targetCol) return
    if (sourceCol === targetCol) return // within-column handled by sortable

    // Move card to target column
    moveCardToColumn(activeCardId, targetCol, targetIndex)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) {
      cancelDrag()
      return
    }

    const activeCardId = String(active.id)
    const overId = String(over.id)

    // If over is a card in the same column, do within-column reorder
    const activeCol = findCardColumn(activeCardId)
    const overCol = COLUMN_IDS.includes(overId as ColumnId) ? overId as ColumnId : findCardColumn(overId)

    if (activeCol && overCol && activeCol === overCol && activeCardId !== overId && !COLUMN_IDS.includes(overId as ColumnId)) {
      reorderWithinColumn(activeCol, activeCardId, overId)
    }

    finalizeLayout()
  }

  const handleDragCancel = () => {
    setActiveId(null)
    cancelDrag()
  }

  const renderColumn = (colId: ColumnId) => {
    const visibleCards = columns[colId].filter(id => cardRegistry[id] !== null)

    if (!isCustomizing) {
      return (
        <div key={colId} className="flex flex-col gap-6 min-w-0">
          {visibleCards.map(cardId => (
            <div key={cardId} className="min-w-0">{cardRegistry[cardId]}</div>
          ))}
        </div>
      )
    }

    return (
      <SortableContext key={colId} items={visibleCards} strategy={verticalListSortingStrategy}>
        <DroppableColumn id={colId} isCustomizing={isCustomizing}>
          {visibleCards.map(cardId => (
            <DraggableDashboardCard key={cardId} id={cardId} columnId={colId} isCustomizing={isCustomizing} onHide={() => hideCard(cardId)}>
              {cardRegistry[cardId]}
            </DraggableDashboardCard>
          ))}
        </DroppableColumn>
      </SortableContext>
    )
  }

  return (
    <div>
      <Section container className="py-6 sm:py-8 lg:py-12 animate-fade-in">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <WelcomeHeader profile={profile} isLoading={isLoading} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isCustomizing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetLayout}
                  className="text-muted-foreground hover:text-foreground gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
              <Button
                variant={isCustomizing ? 'secondary' : 'ghost'}
                size="sm"
                onClick={toggleCustomizing}
                className="gap-1.5"
              >
                <Settings2 className="h-3.5 w-3.5" />
                {isCustomizing ? 'Done' : 'Customize'}
              </Button>
            </div>
          </div>

          <TrialCountdownBanner />

          {isCustomizing ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 items-start">
                {COLUMN_IDS.map(colId => renderColumn(colId))}
              </div>
              <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                {activeId && cardRegistry[activeId as DashboardCardId] ? (
                  <DashboardCardOverlay>
                    <div className="min-w-0">
                      {cardRegistry[activeId as DashboardCardId]}
                    </div>
                  </DashboardCardOverlay>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 items-start">
              {COLUMN_IDS.map(colId => renderColumn(colId))}
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
