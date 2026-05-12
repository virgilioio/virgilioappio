import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import DroppableStage from '@/components/jobs/DroppableStage'
import { useDealStages, type DealStage } from '@/hooks/useDealStages'
import { useDeals, useDealMutations, type Deal } from '@/hooks/useDeals'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import { DealCard } from './DealCard'
import { DraggableDealCard } from './KanbanPrimitives'

function getHeaderBgClass(stage: DealStage): string {
  if (stage.stage_type === 'won') return 'bg-success/20'
  if (stage.stage_type === 'lost') return 'bg-secondary/20'
  // open stages — cycle through pastels by position for visual variety
  const pastels = ['bg-pastel-blue/20', 'bg-pastel-purple/20', 'bg-warning/20', 'bg-pastel-orange/20']
  return pastels[(stage.position ?? 0) % pastels.length]
}

function formatStageTotal(deals: Deal[]): string {
  if (!deals.length) return ''
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
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
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
      <Card className="h-full flex flex-col">
        <CardContent className="flex-1 min-h-0 p-3">
          <div className="flex gap-3 h-full overflow-x-auto pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-72 shrink-0 space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stages.length) {
    return (
      <Card className="h-full flex items-center justify-center">
        <GioEmptyState
          title="No stages yet"
          description="Add deal stages in Settings → Workspace → Deal Stages to start tracking your pipeline."
        />
      </Card>
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
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 min-h-0 p-3">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 h-full overflow-x-auto pb-2">
            {stages.map((stage) => {
              const stageDeals = dealsByStage.get(stage.id) ?? []
              const total = formatStageTotal(stageDeals)
              const tint = getHeaderBgClass(stage)
              return (
                <Card
                  key={stage.id}
                  className="w-[calc(100vw-3rem)] sm:w-72 flex-shrink-0 h-full flex flex-col snap-center sm:snap-align-none"
                >
                  <CardHeader className={`pb-2 rounded-t-md shrink-0 ${tint}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <CardTitle className="text-base font-medium truncate max-w-[160px]" title={stage.name}>
                          {stage.name}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs">
                          {stageDeals.length}
                        </Badge>
                      </div>
                      {total && (
                        <span className="text-[11px] font-medium text-text-secondary shrink-0">{total}</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className={`${tint} rounded-b-md flex-1 overflow-y-auto`}>
                    <DroppableStage
                      id={stage.id}
                      isEmpty={stageDeals.length === 0}
                      tintClass={tint}
                    >
                      {stageDeals.length === 0 && (
                        <div className="text-xs text-text-tertiary">No deals in this stage</div>
                      )}
                      <div className="space-y-2">
                        {stageDeals.map((deal) => (
                          <DraggableDealCard key={deal.id} id={deal.id}>
                            <DealCard deal={deal} onClick={() => onOpenDeal(deal.id)} />
                          </DraggableDealCard>
                        ))}
                      </div>
                    </DroppableStage>
                  </CardContent>
                </Card>
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
      </CardContent>
    </Card>
  )
}
