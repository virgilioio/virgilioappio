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
import { useDashboardLayout, DashboardCardId } from '@/hooks/useDashboardLayout'
import { DraggableDashboardCard, DashboardCardOverlay } from '@/components/dashboard/DraggableDashboardCard'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Settings2, RotateCcw } from 'lucide-react'
import {
  DndContext,
  closestCorners,
  PointerSensor,
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

export default function Dashboard() {
  const { profile, isLoading } = useUserProfile()
  const permissions = usePermissions()
  const { isLoading: orgLoading, hasOrganizationContext } = useOrgContext()
  const { data: sourcingProjects } = useSourcingProjects()
  const { hasRecruiterRole, isPrivileged } = useUserJobRoles()
  const { cardOrder, isCustomizing, reorderCards, resetLayout, toggleCustomizing } = useDashboardLayout()
  const isMobile = useIsMobile()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Fallback loader if context isn't ready
  if (orgLoading || !hasOrganizationContext) {
    return <WorkspaceProvisioningLoader status="finalizing" />
  }

  const hasJobContent = permissions.canViewJobs || permissions.canCreateJobs
  const hasSeenValue = (sourcingProjects?.length ?? 0) > 0

  // Card registry — maps IDs to rendered components
  const cardRegistry: Record<DashboardCardId, ReactNode> = {
    'agenda': <UpcomingActivities />,
    'tasks': <TasksOverview />,
    'app-review': hasJobContent ? <ApplicationReviewCard /> : null,
    'onboarding': <OnboardingChecklist isDeemphasized={!hasSeenValue} />,
    'jobs': hasJobContent ? <div className="hidden sm:block"><JobsOverview permissions={permissions} /></div> : null,
  }

  // Filter out null cards
  const visibleCards = cardOrder.filter(id => cardRegistry[id] !== null)

  // On mobile, use fixed order and no DnD
  const mobileOrder: DashboardCardId[] = ['agenda', 'tasks', 'app-review', 'onboarding', 'jobs']
  const displayOrder = isMobile ? mobileOrder.filter(id => cardRegistry[id] !== null) : visibleCards

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderCards(String(active.id), String(over.id))
  }

  const gridContent = displayOrder.map(cardId => {
    if (isMobile || !isCustomizing) {
      return (
        <div key={cardId} className="space-y-6 min-w-0">
          {cardRegistry[cardId]}
        </div>
      )
    }
    return (
      <DraggableDashboardCard key={cardId} id={cardId} isCustomizing={isCustomizing}>
        {cardRegistry[cardId]}
      </DraggableDashboardCard>
    )
  })

  return (
    <div>
      <Section container className="py-6 sm:py-8 lg:py-12 animate-fade-in">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <WelcomeHeader profile={profile} isLoading={isLoading} />
            </div>
            {!isMobile && (
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
            )}
          </div>

          {/* Trial countdown banner */}
          <TrialCountdownBanner />

          {/* Dashboard grid */}
          {!isMobile && isCustomizing ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={displayOrder} strategy={rectSortingStrategy}>
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 items-start">
                  {gridContent}
                </div>
              </SortableContext>
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
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {gridContent}
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
