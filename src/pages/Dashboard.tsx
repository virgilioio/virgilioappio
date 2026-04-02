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
import { WorldClockWidget } from '@/components/dashboard/WorldClockWidget'
import {
  useDashboardLayout,
  DashboardCardId,
  computePlacements,
  computeTabletPlacements,
  WIDGET_REGISTRY,
  SIZE_TO_COLS,
  WidgetSize,
  GridPlacement,
} from '@/hooks/useDashboardLayout'
import { DraggableDashboardCard, DashboardCardOverlay } from '@/components/dashboard/DraggableDashboardCard'
import { MasonryGrid } from '@/components/dashboard/MasonryGrid'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Settings2, RotateCcw, Plus, Info } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
} from '@dnd-kit/sortable'

// ── Placement to masonry items helper ──

function placementsToMasonryItems(placements: GridPlacement[]) {
  return placements.map(p => {
    const m = p.gridColumn.match(/(\d+)\s*\/\s*span\s+(\d+)/)
    const colStart = m ? parseInt(m[1]) - 1 : 0 // convert 1-based to 0-based
    const colSpan = m ? parseInt(m[2]) : 2
    return { id: p.id, colStart, colSpan }
  })
}

function swapPlacements(
  placements: GridPlacement[],
  activeId: string,
  overId: string,
  totalCols: number,
): GridPlacement[] {
  const a = placements.find(p => p.id === activeId)
  const b = placements.find(p => p.id === overId)
  if (!a || !b) return placements

  const parseCol = (gc: string) => {
    const m = gc.match(/(\d+)\s*\/\s*span\s+(\d+)/)
    return m ? parseInt(m[1]) : 1
  }

  const aCol = parseCol(a.gridColumn)
  const bCol = parseCol(b.gridColumn)

  const aNewCol = Math.min(bCol, totalCols - a.colSpan + 1)
  const bNewCol = Math.min(aCol, totalCols - b.colSpan + 1)

  return placements.map(p => {
    if (p.id === activeId) return {
      ...p,
      gridColumn: `${aNewCol} / span ${a.colSpan}`,
      gridRow: b.gridRow,
    }
    if (p.id === overId) return {
      ...p,
      gridColumn: `${bNewCol} / span ${b.colSpan}`,
      gridRow: a.gridRow,
    }
    return p
  })
}

const MOBILE_ORDER: DashboardCardId[] = ['agenda', 'tasks', 'world-clock', 'app-review', 'onboarding', 'jobs']

export default function Dashboard() {
  const { profile, isLoading } = useUserProfile()
  const permissions = usePermissions()
  const { isLoading: orgLoading, hasOrganizationContext } = useOrgContext()
  const { data: sourcingProjects } = useSourcingProjects()
  const { hasRecruiterRole, isPrivileged } = useUserJobRoles()
  const {
    visibleWidgets,
    hiddenCards,
    isCustomizing,
    saveDragStart,
    reorderWidgets,
    finalizeLayout,
    cancelDrag,
    hideCard,
    showCard,
    cycleWidgetSize,
    resetLayout,
    toggleCustomizing,
  } = useDashboardLayout()
  const isMobile = useIsMobile()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [addWidgetOpen, setAddWidgetOpen] = useState(false)
  const [cachedPlacements, setCachedPlacements] = useState<GridPlacement[]>([])
  const [lastStructuralKey, setLastStructuralKey] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } })
  )

  if (orgLoading || !hasOrganizationContext) {
    return <WorkspaceProvisioningLoader status="finalizing" />
  }

  const hasJobContent = permissions.canViewJobs || permissions.canCreateJobs
  const hasSeenValue = (sourcingProjects?.length ?? 0) > 0

  // Size-aware card renderer: returns ReactNode for a given widget
  const widgetSizeMap = Object.fromEntries(visibleWidgets.map(w => [w.id, w.size])) as Record<DashboardCardId, WidgetSize>

  const renderCard = (id: DashboardCardId): ReactNode => {
    const widgetSize = widgetSizeMap[id] ?? 'small'
    switch (id) {
      case 'agenda': return <UpcomingActivities />
      case 'tasks': return <TasksOverview />
      case 'app-review': return hasJobContent ? <ApplicationReviewCard size={widgetSize} /> : null
      case 'onboarding': return <OnboardingChecklist isDeemphasized={!hasSeenValue} />
      case 'jobs': return hasJobContent ? <div className="hidden sm:block"><JobsOverview permissions={permissions} size={widgetSize} /></div> : null
      case 'world-clock': return <WorldClockWidget />
      default: return null
    }
  }

  // For null-checks (visibility filtering), we need a simple registry
  const cardRegistry: Record<DashboardCardId, ReactNode> = {
    'agenda': <UpcomingActivities />,
    'tasks': <TasksOverview />,
    'app-review': hasJobContent ? true as unknown as ReactNode : null,
    'onboarding': <OnboardingChecklist isDeemphasized={!hasSeenValue} />,
    'jobs': hasJobContent ? true as unknown as ReactNode : null,
    'world-clock': <WorldClockWidget />,
  }

  // ── Mobile: flat stacked list, no DnD ──
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
                <div key={cardId} className="min-w-0">{renderCard(cardId)}</div>
              ))}
            </div>
          </div>
        </Section>
      </div>
    )
  }

  // ── Desktop / Tablet ──

  // Filter to only widgets with non-null content
  const renderableWidgets = visibleWidgets.filter(w => cardRegistry[w.id] !== null)

  const isTablet = typeof window !== 'undefined' && window.innerWidth < 1280
  const gridCols = isTablet ? 4 : 6

  // Structural key: changes on add/remove/resize but NOT on reorder
  const structuralKey = renderableWidgets.map(w => `${w.id}:${w.size}`).sort().join(',')

  // Recompute placements only when structure changes (size, visibility), not order swaps
  if (structuralKey !== lastStructuralKey) {
    const newPlacements = isTablet
      ? computeTabletPlacements(renderableWidgets)
      : computePlacements(renderableWidgets)
    setCachedPlacements(newPlacements)
    setLastStructuralKey(structuralKey)
  }

  const handleDragStart = (event: DragStartEvent) => {
    saveDragStart()
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) {
      cancelDrag()
      return
    }

    // Swap placements directly — no full repack
    setCachedPlacements(prev => swapPlacements(prev, String(active.id), String(over.id), gridCols))

    // Update order values in the hook for persistence
    reorderWidgets(String(active.id), String(over.id))
    finalizeLayout()
  }

  const handleDragCancel = () => {
    setActiveId(null)
    cancelDrag()
  }

  const renderGrid = () => {
    if (!isCustomizing) {
      return cachedPlacements.map(({ id, gridColumn, gridRow }) => (
        <div
          key={id}
          className="min-w-0"
          style={{ gridColumn, gridRow }}
        >
          {renderCard(id)}
        </div>
      ))
    }

    // Customizing mode: same grid placement but with draggable wrappers
    return cachedPlacements.map(({ id, gridColumn, gridRow }) => {
      const widget = renderableWidgets.find(w => w.id === id)!
      return (
        <div key={id} style={{ gridColumn, gridRow, transition: 'all 200ms ease' }} className="min-w-0">
          <DraggableDashboardCard
            id={id}
            isCustomizing
            currentSize={widget.size}
            onHide={() => hideCard(id)}
            onCycleSize={!WIDGET_REGISTRY[id].fixed ? () => cycleWidgetSize(id) : undefined}
          >
            {renderCard(id)}
          </DraggableDashboardCard>
        </div>
      )
    })
  }

  const gridStyle = {
    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
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
                {isCustomizing ? 'Done editing' : 'Customize dashboard'}
              </Button>
            </div>
          </div>

          <TrialCountdownBanner />

          {isCustomizing && (
            <Alert variant="info">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Drag cards to reorder, resize with the column button, or hide with ✕. Click <strong>Done editing</strong> when finished.
              </AlertDescription>
            </Alert>
          )}

          {isCustomizing ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={renderableWidgets.map(w => w.id)} strategy={rectSortingStrategy}>
                <div className="grid gap-5 items-start" style={gridStyle}>
                  {renderGrid()}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
                {activeId && cardRegistry[activeId as DashboardCardId] ? (
                  <DashboardCardOverlay>
                    <div className="min-w-0">
                      {renderCard(activeId as DashboardCardId)}
                    </div>
                  </DashboardCardOverlay>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="grid gap-5 items-start" style={gridStyle}>
              {renderGrid()}
            </div>
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
                  <span className="text-sm font-medium">{WIDGET_REGISTRY[cardId].label}</span>
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
