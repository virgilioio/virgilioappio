import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { PageHeader } from '@/components/layout/PageHeader'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { usePermissions } from '@/hooks/usePermissions'
import { DealsKanbanBoard, type DealAmountMode } from '@/components/deals/DealsKanbanBoard'
import { DealFormSheet } from '@/components/deals/DealFormSheet'
import { DealProfileSheet } from '@/components/deals/DealProfileSheet'
import { cn } from '@/lib/utils'

const AMOUNT_MODES: { value: DealAmountMode; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'collected', label: 'Collected' },
  { value: 'outstanding', label: 'Outstanding' },
]

export default function Deals() {
  const { canViewOrganizations } = usePermissions()
  const [creating, setCreating] = useState(false)
  const [openDealId, setOpenDealId] = useState<string | null>(null)
  const [amountMode, setAmountMode] = useState<DealAmountMode>('total')

  if (!canViewOrganizations) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <GioEmptyState
          title="No access"
          description="You don't have permission to view the CRM."
        />
      </div>
    )
  }

  return (
    <div className="h-[100dvh] flex flex-col">
      <Section className="flex-1 min-h-0 flex flex-col">
        <AppContainer variant="default" className="flex-1 min-h-0 flex flex-col">
          <PageHeader title="Deals">
            <Button onClick={() => setCreating(true)} size="sm" className="gap-1.5 h-8 whitespace-nowrap">
              <Plus className="h-3.5 w-3.5" />
              New Deal
            </Button>
          </PageHeader>

          {/* Amount-mode chips: switch what the cards & column totals show */}
          <div className="mt-4 flex items-center gap-1" role="tablist" aria-label="Amount view">
            {AMOUNT_MODES.map((m) => {
              const active = amountMode === m.value
              return (
                <Button
                  key={m.value}
                  size="sm"
                  variant="ghost"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setAmountMode(m.value)}
                  className={cn(
                    '!rounded-full h-7 px-3 text-xs',
                    active
                      ? 'bg-foreground text-background hover:bg-foreground'
                      : 'text-text-secondary hover:bg-transparent'
                  )}
                >
                  {m.label}
                </Button>
              )
            })}
          </div>

          <div className="flex-1 min-h-0 mt-3">
            <DealsKanbanBoard onOpenDeal={setOpenDealId} amountMode={amountMode} />
          </div>
        </AppContainer>
      </Section>

      <DealFormSheet open={creating} onOpenChange={setCreating} />
      <DealProfileSheet
        dealId={openDealId}
        open={!!openDealId}
        onOpenChange={(o) => !o && setOpenDealId(null)}
      />
    </div>
  )
}
