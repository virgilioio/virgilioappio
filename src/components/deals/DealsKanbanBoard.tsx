import { useMemo, useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { useDealStages, type DealStage } from '@/hooks/useDealStages'
import { useDeals, useDealMutations, type Deal } from '@/hooks/useDeals'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import { DealCard } from './DealCard'
import { DraggableDealCard, DroppableDealStage } from './KanbanPrimitives'

function stageBadgeClasses(stage: DealStage): string {
  if (stage.stage_type === 'won') return 'bg-virgilio-success/10 text-virgilio-success border-0'
  if (stage.stage_type === 'lost') return 'bg-virgilio-error/10 text-virgilio-error border-0'
  return 'bg-virgilio-purple/10 text-virgilio-purple border-0'
}

function formatStageTotal(deals: Deal[]): string {
  if (!deals.length) return ''
  // Group by currency, show dominant
  const byCcy: Record<string, number> = {}
  deals.forEach((d) => {
    if (d.amount == null) return
    byCcy[d.currency] = (byCcy[d.currency] ?? 0) + Number(d.amount)
  })
  const entries = Object.entries(byCcy).sort((a, b) => b[1] - a[1])
  if (!entries.length) return ''
  const [ccy, total] = entries[0]
  const symbol = CURRENCY_SYMBOLS[ccy] ?? ''
  return `${symbol}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(total)}`
}

interface DealsKanbanBoardProps {
  onOpenDeal: (id: string) => void
}

export function DealsKanbanBoard({ onOpenDeal }: DealsKanbanBoardProps) {
  const stagesQuery = useDealStages()
  const dealsQuery = useDeals()
  const { moveDeal } = useDealMutations()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  const stages = stagesQuery.data ?? []
  const deals = dealsQuery.data ?? []

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>()
    stages.forEach((s) => map.set(s.id, []))
    deals.forEach((d) => {
      if (d.stage_id && map.has(d.stage_id)) {
        map.get(d.stage_id)!.push(d)
      }
    })
    return map
  }, [stages, deals])

  const isInitialLoading = stagesQuery.isLoading || dealsQuery.isLoading

  if (isInitialLoading) {
    return (
      <div className="flex gap-3 h-full overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (!stages.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <GioEmptyState
          title="No stages yet"
          description="Add deal stages in Settings → Workspace → Deal Stages to start tracking your pipeline."
        />
      </div>
    )
  }

  if (!deals.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <GioEmptyState
          title="No deals yet"
          description="Create your first deal to begin tracking your sales pipeline."
        />
      </div>
    )
  }

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const dealId = String(e.active.id)
    const overStageId = e.over ? String(e.over.id) : null
    if (!overStageId) return
    const deal = deals.find((d) => d.id === dealId)
    if (!deal || deal.stage_id === overStageId) return
    moveDeal.mutate({ id: dealId, stage_id: overStageId })
  }

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 h-full overflow-x-auto pb-2">
        {stages.map((stage) => {
          const stageDeals = dealsByStage.get(stage.id) ?? []
          const total = formatStageTotal(stageDeals)
          return (
            <div key={stage.id} className="w-72 shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-2 py-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge className={stageBadgeClasses(stage)}>{stage.name}</Badge>
                  <span className="text-xs text-virgilio-muted shrink-0">{stageDeals.length}</span>
                </div>
                {total && (
                  <span className="text-[11px] font-medium text-virgilio-muted shrink-0">{total}</span>
                )}
              </div>

              <DroppableDealStage id={stage.id} isEmpty={!stageDeals.length} className="flex-1">
                {stageDeals.map((deal) => (
                  <DraggableDealCard key={deal.id} id={deal.id}>
                    <DealCard deal={deal} onClick={() => onOpenDeal(deal.id)} />
                  </DraggableDealCard>
                ))}
              </DroppableDealStage>
            </div>
          )
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeal ? (
          <div className="w-72 rotate-1 opacity-95">
            <DealCard deal={activeDeal} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
