import { ReactNode, useState, useMemo } from 'react'
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
import { useDashboardLayout, DashboardCardId, ColumnId, getCardSpan } from '@/hooks/useDashboardLayout'
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
const COLUMN_START: Record<ColumnId, number> = { left: 1, center: 2, right: 3 }
const MOBILE_ORDER: DashboardCardId[] = ['agenda', 'tasks', 'app-review', 'onboarding', 'jobs']

const CARD_LABELS: Record<DashboardCardId, string> = {
  'agenda': 'Agenda & Calendar',
  'tasks': 'Tasks',
  'app-review': 'Application Review',
  'onboarding': 'Onboarding Checklist',
  'jobs': 'Jobs Overview',
}

interface GridPlacement {
  cardId: DashboardCardId
  columnId: ColumnId
  gridColumn: string
  gridRow: number
}

function computeGridPlacements(
  columns: Record<ColumnId, DashboardCardId[]>,
  cardRegistry: Record<DashboardCardId, ReactNode>,
  spans: Partial<Record<DashboardCardId, 1 | 2>>,
): GridPlacement[] {
  const placements: GridPlacement[] = []
  // Track row usage per grid column (1-indexed)
  const colRowCursor: Record<number, number> = { 1: 1, 2: 1, 3: 1 }

  // Process columns left → center → right so rows fill naturally
  for (const colId of COLUMN_IDS) {
    const cards = columns[colId].filter(id => cardRegistry[id] !== null)
    const startCol = COLUMN_START[colId]

    for (const cardId of cards) {
      const span = getCardSpan(spans, cardId)

      if (span === 2) {
        // Span-2 cards: anchor at startCol, extend to startCol+1
        // But cap at column 2 max (so it spans cols 2-3)
        const effectiveStart = Math.min(startCol, 2)
        const row = Math.max(colRowCursor[effectiveStart], colRowCursor[effectiveStart + 1])
        placements.push({
          cardId,
          columnId: colId,
          gridColumn: `${effectiveStart} / span 2`,
          gridRow: row,
        })
        colRowCursor[effectiveStart] = row + 1
        colRowCursor[effectiveStart + 1] = row + 1
      } else {
        const row = colRowCursor[startCol]
        placements.push({
          cardId,
          columnId: colId,
          gridColumn: `${startCol} / span 1`,
          gridRow: row,
        })
        colRowCursor[startCol] = row + 1
      }
    }
  }

  return placements
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
    cardSpans,
    isCustomizing,
    findCardColumn,
    saveDragStart,
    moveCardToColumn,
    reorderWithinColumn,
    finalizeLayout,
    cancelDrag,
    hideCard,
    showCard,
    toggleCardSpan,
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

  // --- Desktop / Tablet: CSS Grid with explicit placement ---

  const handleDragStart = (event: DragStartEvent) => {
    saveDragStart()
    setActiveId(String(event.active.id))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeCardId = String(active.id)
    const overId = String(over.id)

    const sourceCol = active.data.current?.columnId as ColumnId | undefined
      ?? findCardColumn(activeCardId)
    if (!sourceCol) return

    let targetCol: ColumnId | null = null
    let targetIndex: number = 0

    if (COLUMN_IDS.includes(overId as ColumnId)) {
      targetCol = overId as ColumnId
      targetIndex = columns[targetCol].length
    } else {
      targetCol = findCardColumn(overId)
      if (targetCol) {
        targetIndex = columns[targetCol].indexOf(overId as DashboardCardId)
      }
    }

    if (!targetCol) return
    if (sourceCol === targetCol) return

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

  const placements = computeGridPlacements(columns, cardRegistry, cardSpans)

  const renderGridContent = () => {
    if (!isCustomizing) {
      return placements.map(({ cardId, gridColumn, gridRow }) => (
        <div
          key={cardId}
          className="min-w-0"
          style={{ gridColumn, gridRow }}
        >
          {cardRegistry[cardId]}
        </div>
      ))
    }

    // In customizing mode, render per-column SortableContexts
    // but place items using CSS Grid positioning
    return COLUMN_IDS.map(colId => {
      const visibleCards = columns[colId].filter(id => cardRegistry[id] !== null)
      const colPlacements = placements.filter(p => p.columnId === colId)

      return (
        <SortableContext key={colId} items={visibleCards} strategy={verticalListSortingStrategy}>
          <DroppableColumn id={colId} isCustomizing={isCustomizing}>
            {colPlacements.map(({ cardId }) => {
              const span = getCardSpan(cardSpans, cardId)
              return (
                <DraggableDashboardCard
                  key={cardId}
                  id={cardId}
                  columnId={colId}
                  isCustomizing={isCustomizing}
                  colSpan={span}
                  onHide={() => hideCard(cardId)}
                  onToggleSpan={() => toggleCardSpan(cardId)}
                >
                  {cardRegistry[cardId]}
                </DraggableDashboardCard>
              )
            })}
          </DroppableColumn>
        </SortableContext>
      )
    })
  }

  // For customizing mode, we still use 3 flex columns for DnD droppable targets
  // For non-customizing mode, we use CSS Grid with explicit placement
  const gridContent = !isCustomizing ? (
    <div
      className="grid gap-6 items-start"
      style={{
        gridTemplateColumns: 'repeat(3, 1fr)',
      }}
    >
      {renderGridContent()}
    </div>
  ) : null

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
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddWidgetOpen(true)}
                    disabled={hiddenCards.length === 0}
                    className="text-muted-foreground hover:text-foreground gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Widget
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetLayout}
                    className="text-muted-foreground hover:text-foreground gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                </>
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
                {renderGridContent()}
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
            gridContent
          )}
        </div>
      </Section>

      <Sheet open={addWidgetOpen} onOpenChange={setAddWidgetOpen}>
        <SheetContent side="right" className="w-[340px] sm:max-w-[380px]">
          <SheetHeader className="pb-4">
            <SheetTitle className="font-poppins text-base font-semibold">Add Widget</SheetTitle>
            <SheetDescription className="font-poppins text-xs text-muted-foreground">
              Choose a widget to add back to your dashboard
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-2 mt-2">
            {hiddenCards.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">All widgets are visible on your dashboard.</p>
            ) : (
              hiddenCards.map(cardId => (
                <div key={cardId} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <span className="text-sm font-medium">{CARD_LABELS[cardId]}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1.5"
                    onClick={() => {
                      showCard(cardId)
                      if (hiddenCards.length <= 1) setAddWidgetOpen(false)
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
