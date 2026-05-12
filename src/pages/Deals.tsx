import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { PageHeader } from '@/components/layout/PageHeader'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { FilterChipSelect, type FilterChipSelectOption } from '@/components/ui/filter-chip-select'
import { usePermissions } from '@/hooks/usePermissions'
import { DealsKanbanBoard, type DealAmountMode } from '@/components/deals/DealsKanbanBoard'
import { DealFormSheet } from '@/components/deals/DealFormSheet'
import { DealProfileSheet } from '@/components/deals/DealProfileSheet'

const AMOUNT_MODE_OPTIONS: FilterChipSelectOption<DealAmountMode>[] = [
  { value: 'total' as const, label: 'Total' },
  { value: 'collected' as const, label: 'Collected' },
  { value: 'outstanding' as const, label: 'Outstanding' },
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
            <FilterChipSelect
              label="Amount"
              value={amountMode}
              options={AMOUNT_MODE_OPTIONS}
              onChange={setAmountMode}
            />
            <Button onClick={() => setCreating(true)} size="sm" className="gap-1.5 h-8 whitespace-nowrap">
              <Plus className="h-3.5 w-3.5" />
              New Deal
            </Button>
          </PageHeader>

          <div className="flex-1 min-h-0 mt-4">
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
