import { useEffect, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useSourcingCredits } from './useSourcingCredits'

export function useSourcingCreditWarnings() {
  const { data: usage } = useSourcingCredits()
  const { toast } = useToast()
  const shownWarnings = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!usage) return

    const collectUsagePercent = usage.collect_percentage || 0

    // Collect/Enrichment credit warnings
    if (collectUsagePercent >= 100 && !shownWarnings.current.has('collect-100')) {
      toast({
        title: 'Monthly collect limit reached',
        description: `You've used all ${usage.collect_credits_limit} collect credits. Profile collection will resume on the 1st of next month.`,
        variant: 'destructive',
        duration: 10000
      })
      shownWarnings.current.add('collect-100')
    } else if (collectUsagePercent >= 95 && !shownWarnings.current.has('collect-95')) {
      toast({
        title: 'Nearly out of collect credits',
        description: `You've used ${usage.collect_credits_used}/${usage.collect_credits_limit} collect credits. Limit will be reached soon.`,
        variant: 'destructive',
        duration: 8000
      })
      shownWarnings.current.add('collect-95')
    } else if (collectUsagePercent >= 80 && !shownWarnings.current.has('collect-80')) {
      toast({
        title: 'High collect credit usage',
        description: `You've used ${usage.collect_credits_used}/${usage.collect_credits_limit} collect credits this month.`,
        duration: 6000
      })
      shownWarnings.current.add('collect-80')
    }
  }, [usage, toast])

  const isCollectDisabled = usage ? (usage.collect_credits_used >= usage.collect_credits_limit) : false

  return {
    isCollectDisabled,
    usage
  }
}
