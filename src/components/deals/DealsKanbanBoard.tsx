import { useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Skeleton } from '@/components/ui/skeleton'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { useDealStages, type DealStage } from '@/hooks/useDealStages'
import { useDeals, useDealMutations, type Deal } from '@/hooks/useDeals'
import { CURRENCY_SYMBOLS } from '@/constants/currencies'
import { cn } from '@/lib/utils'
import { DealCard } from './DealCard'
import { DraggableDealCard } from './KanbanPrimitives'

export type DealAmountMode = 'total' | 'weighted' | 'collected' | 'outstanding'

// ---- helpers ----
function computeDisplayAmount(
  deal: Deal,
  mode: DealAmountMode,
  collectedByDeal?: Map<string, number>,
): number | null {
  const base = deal.base_amount ?? deal.amount
  if (mode === 'collected') {
    const c = collectedByDeal?.get(deal.id)
    return c == null ? null : c
  }
  if (mode === 'outstanding') {
    if (base == null) return null
    const c = collectedByDeal?.get(deal.id) ?? 0
    return Math.max(0, base - c)
  }
  if (base == null) return null
  if (mode === 'weighted') {
    const p = deal.probability == null ? 1 : Math.max(0, Math.min(1, Number(deal.probability)))
    return base * p
  }
  return base
}

function computeDisplayCurrency(deal: Deal): string {
  if (deal.base_amount != null && deal.base_currency) return deal.base_currency
  return deal.currency
}

function formatCompactMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? ''
  const abs = Math.abs(amount)
  let body: string
  if (abs >= 1_000_000) body = `${(amount / 1_000_000).toFixed(1)}M`
  else if (abs >= 1_000) body = `${(amount / 1_000).toFixed(1)}k`
  else body = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)
  return `${symbol}${body}`
}

function stageSubtotal(
  deals: Deal[],
  mode: DealAmountMode,
  collectedByDeal?: Map<string, number>,
): string {
  if (!deals.length) return '—'
  const baseCcy = deals.find((d) => d.base_currency)?.base_currency ?? deals[0]?.currency ?? 'USD'
  let total = 0
  for (const d of deals) {
    const v = computeDisplayAmount(d, mode, collectedByDeal)
    if (v != null) total += v
  }
  return `${formatCompactMoney(total, baseCcy)} ${baseCcy}`
}

/** Map any of the various stage color formats (hsl(...), #hex, css token) to a CSS color. */
function stageAccent(stage: DealStage): string {
  if (stage.color && stage.color.trim()) return stage.color
  // Fallback per stage_type so columns are never colorless
  if (stage.stage_type === 'won') return '#12B886'
  if (stage.stage_type === 'lost') return '#EF4444'
  return '#9CA3AF'
}

/** A very light tint for the column body, derived from the accent. */
function stageTintStyle(accent: string): React.CSSProperties {
  // hsl(...) → swap to a low-alpha variant by wrapping in color-mix.
  // Works for hex too via modern browsers.
  return { background: `color-mix(in oklab, ${accent} 8%, #FFFFFF)` }
}

function stageHeaderTint(accent: string): React.CSSProperties {
  return { background: `color-mix(in oklab, ${accent} 12%, #FFFFFF)` }
}

// Stages of type "lost" and the special "Warranty" stage are not shown as columns.
function isBoardStage(stage: DealStage): boolean {
  if (stage.stage_type === 'lost') return false
  if (stage.name.trim().toLowerCase() === 'warranty') return false
  return true
}

// ---- Droppable column body ----
function DroppableColumn({
  id,
  isEmpty,
  children,
}: {
  id: string
  isEmpty: boolean
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex-1 min-h-[120px] rounded-xl px-2 py-2 transition-colors duration-150',
        isOver && 'ring-1 ring-virgilio-purple/40',
      )}
      style={isOver ? { background: 'rgba(111, 63, 245, 0.06)' } : undefined}
    >
      {isEmpty && (
        <div
          className={cn(
            'absolute inset-2 rounded-lg pointer-events-none flex items-center justify-center text-[11px] font-medium',
            isOver ? 'border border-virgilio-purple/40 text-virgilio-purple' : 'border border-dashed border-virgilio-border text-text-tertiary',
          )}
        >
          {isOver ? 'Drop here' : 'No deals in this stage'}
        </div>
      )}
      <div className="relative z-10 flex flex-col gap-2">{children}</div>
    </div>
  )
}

// ---- Props ----
interface DealsKanbanBoardProps {
  onOpenDeal: (id: string) => void
  amountMode?: DealAmountMode
  selectedOwners?: string[]
  selectedOrgs?: string[]
  searchQuery?: string
  collectedByDeal?: Map<string, number>
}

export function DealsKanbanBoard({
  onOpenDeal,
  amountMode = 'total',
  selectedOwners = [],
  selectedOrgs = [],
  searchQuery = '',
  collectedByDeal,
}: DealsKanbanBoardProps) {
  const stagesQuery = useDealStages()
  const dealsQuery = useDeals()
  const { moveDeal } = useDealMutations()
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const stages = (stagesQuery.data ?? []).filter(isBoardStage)
  const deals = dealsQuery.data ?? []

  const filteredDeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return deals.filter((d) => {
      if (selectedOwners.length && !selectedOwners.includes(d.owner_id ?? '__none__')) return false
      if (selectedOrgs.length && !selectedOrgs.includes(d.organization_id ?? '__none__')) return false
      if (q) {
        const hay = `${d.title ?? ''} ${d.organization_name ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [deals, selectedOwners, selectedOrgs, searchQuery])

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>()
    stages.forEach((s) => map.set(s.id, []))
    filteredDeals.forEach((d) => {
      if (d.stage_id && map.has(d.stage_id)) map.get(d.stage_id)!.push(d)
    })
    return map
  }, [stages, filteredDeals])

  const isInitialLoading = stagesQuery.isLoading || dealsQuery.isLoading

  if (isInitialLoading) {
    return (
      <div className="flex gap-3 h-full overflow-x-auto pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-[268px] shrink-0 space-y-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  if (!stages.length) {
    return (
      <div className="h-full flex items-center justify-center">
        <GioEmptyState
          title="No stages yet"
          description="Add deal stages in Settings → Workspace → Deal Stages to start tracking your pipeline."
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
    const targetStage = stages.find((s) => s.id === overStageId)
    moveDeal.mutate({ id: dealId, stage_id: overStageId, stage_type: targetStage?.stage_type })
  }

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 h-full overflow-x-auto pb-2">
        {stages.map((stage) => {
          const stageDeals = dealsByStage.get(stage.id) ?? []
          const subtotal = stageSubtotal(stageDeals, amountMode, collectedByDeal)
          const accent = stageAccent(stage)
          return (
            <div
              key={stage.id}
              className="w-[268px] flex-shrink-0 h-full flex flex-col rounded-[14px]"
              style={{
                ...stageTintStyle(accent),
                border: '1px solid #E7E8EE',
              }}
            >
              {/* Header */}
              <div
                className="px-3 pt-2.5 pb-2 rounded-t-[14px] shrink-0"
                style={stageHeaderTint(accent)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: accent }}
                    aria-hidden
                  />
                  <span
                    className="font-poppins font-semibold text-[13px] text-text-primary truncate"
                    style={{ letterSpacing: '-0.02em' }}
                    title={stage.name}
                  >
                    {stage.name}
                  </span>
                  <span
                    className="ml-auto inline-flex items-center justify-center h-[18px] min-w-[18px] px-1.5 rounded-full text-[10.5px] font-semibold tabular-nums"
                    style={{ background: 'rgba(13,13,9,0.06)', color: '#5A6072' }}
                  >
                    {stageDeals.length}
                  </span>
                </div>
                <div
                  className="mt-1 text-[11px] font-medium tabular-nums"
                  style={{ color: '#5A6072' }}
                >
                  {subtotal}
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
                <DroppableColumn id={stage.id} isEmpty={stageDeals.length === 0}>
                  {stageDeals.map((deal) => (
                    <DraggableDealCard key={deal.id} id={deal.id}>
                      <DealCard
                        deal={deal}
                        onClick={() => onOpenDeal(deal.id)}
                        displayAmount={computeDisplayAmount(deal, amountMode, collectedByDeal)}
                        displayCurrency={computeDisplayCurrency(deal)}
                      />
                    </DraggableDealCard>
                  ))}
                </DroppableColumn>
              </div>
            </div>
          )
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDeal ? (
          <div className="w-[252px] rotate-[1deg] opacity-95">
            <DealCard
              deal={activeDeal}
              displayAmount={computeDisplayAmount(activeDeal, amountMode)}
              displayCurrency={computeDisplayCurrency(activeDeal)}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
