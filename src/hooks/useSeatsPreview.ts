import { useMemo } from 'react'
import { useBillingStatus } from './useBillingStatus'
import { useStripePricing } from './useStripePricing'

export function useSeatsPreview(roleToAdd?: 'admin' | 'member') {
  const { data: billing } = useBillingStatus()
  const { data: pricing } = useStripePricing()

  return useMemo(() => {
    if (!billing || !pricing) {
      return {
        currentSeats: 0,
        newSeats: 0,
        willIncreaseBilling: false,
        monthlyCostIncrease: 0,
        yearlyCostIncrease: 0,
        isBillableRole: false,
      }
    }

    const currentSeats = billing.seat_quantity || 0
    const isBillableRole = roleToAdd === 'admin' || roleToAdd === 'recruiter'
    const newSeats = isBillableRole ? currentSeats + 1 : currentSeats
    const willIncreaseBilling = isBillableRole

    const monthlyCostIncrease = isBillableRole ? (pricing.monthly?.amount || 0) : 0
    const yearlyCostIncrease = isBillableRole ? (pricing.yearly?.amount || 0) : 0

    return {
      currentSeats,
      newSeats,
      willIncreaseBilling,
      monthlyCostIncrease,
      yearlyCostIncrease,
      isBillableRole,
      isFreeTier: !isBillableRole,
    }
  }, [billing, pricing, roleToAdd])
}
