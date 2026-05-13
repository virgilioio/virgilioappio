import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AppContainer } from '@/components/layout/AppContainer'
import { Section } from '@/components/layout/Section'
import { PageHeader } from '@/components/layout/PageHeader'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { FilterChipSelect, type FilterChipSelectOption } from '@/components/ui/filter-chip-select'
import { FilterChipPopover, type FilterChipOption } from '@/components/ui/filter-chip-popover'
import { usePermissions } from '@/hooks/usePermissions'
import { useDeals } from '@/hooks/useDeals'
import { DealsKanbanBoard, type DealAmountMode } from '@/components/deals/DealsKanbanBoard'
import { DealFormSheet } from '@/components/deals/DealFormSheet'
import { DealProfileSheet } from '@/components/deals/DealProfileSheet'

const AMOUNT_MODE_OPTIONS: FilterChipSelectOption<DealAmountMode>[] = [
  { value: 'total' as const, label: 'Total' },
  { value: 'collected' as const, label: 'Collected' },
  { value: 'outstanding' as const, label: 'Outstanding' },
]

const NONE = '__none__'

export default function Deals() {
  const { canViewOrganizations } = usePermissions()
  const { data: deals = [] } = useDeals()
  const [creating, setCreating] = useState(false)
  const [openDealId, setOpenDealId] = useState<string | null>(null)
  const [amountMode, setAmountMode] = useState<DealAmountMode>('total')
  const [selectedOwners, setSelectedOwners] = useState<string[]>([])
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([])

  const ownerOptions = useMemo<FilterChipOption[]>(() => {
    const map = new Map<string, { label: string; count: number }>()
    deals.forEach((d) => {
      const key = d.owner_id ?? NONE
      const label = d.owner_id ? (d.owner_name ?? d.owner_email ?? 'Unknown') : 'Unassigned'
      const cur = map.get(key)
      if (cur) cur.count += 1
      else map.set(key, { label, count: 1 })
    })
    return Array.from(map.entries())
      .map(([value, { label, count }]) => ({ value, label, count }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [deals])

  const orgOptions = useMemo<FilterChipOption[]>(() => {
    const map = new Map<string, { label: string; count: number }>()
    deals.forEach((d) => {
      const key = d.organization_id ?? NONE
      const label = d.organization_id ? (d.organization_name ?? 'Unknown') : 'No company'
      const cur = map.get(key)
      if (cur) cur.count += 1
      else map.set(key, { label, count: 1 })
    })
    return Array.from(map.entries())
      .map(([value, { label, count }]) => ({ value, label, count }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [deals])

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
          <PageHeader title="Deals" />

          <div className="flex-1 min-h-0 mt-4">
            <DealsKanbanBoard
              onOpenDeal={setOpenDealId}
              amountMode={amountMode}
              selectedOwners={selectedOwners}
              selectedOrgs={selectedOrgs}
              headerLeft={
                <>
                  <FilterChipSelect
                    label="Amount"
                    value={amountMode}
                    options={AMOUNT_MODE_OPTIONS}
                    onChange={(value) => setAmountMode(value as DealAmountMode)}
                  />
                  <FilterChipPopover
                    label="Owner"
                    options={ownerOptions}
                    selectedValues={selectedOwners}
                    onSelectionChange={setSelectedOwners}
                    searchable
                  />
                  <FilterChipPopover
                    label="Company"
                    options={orgOptions}
                    selectedValues={selectedOrgs}
                    onSelectionChange={setSelectedOrgs}
                    searchable
                  />
                </>
              }
              headerRight={
                <Button onClick={() => setCreating(true)} className="gap-2 whitespace-nowrap">
                  <Plus className="h-4 w-4" />
                  New Deal
                </Button>
              }
            />
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
