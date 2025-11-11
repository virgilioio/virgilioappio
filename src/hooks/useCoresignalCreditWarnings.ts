import { useEffect, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useCoresignalUsage } from './useCoresignalUsage'

export function useCoresignalCreditWarnings() {
  const { data: usage } = useCoresignalUsage()
  const { toast } = useToast()
  const shownWarnings = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!usage) return

    const searchUsagePercent = usage.search_percentage || 0
    const collectUsagePercent = usage.collect_percentage || 0
    
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' })
    
    // Search credit warnings
    if (searchUsagePercent >= 100 && !shownWarnings.current.has('search-100')) {
      toast({
        title: 'Monthly credit limit reached',
        description: `You've used all ${usage.search_credits_limit} search credits. Searches will resume on the 1st of next month.`,
        variant: 'destructive',
        duration: 10000
      })
      shownWarnings.current.add('search-100')
    } else if (searchUsagePercent >= 95 && !shownWarnings.current.has('search-95')) {
      toast({
        title: 'Nearly out of search credits',
        description: `You've used ${usage.search_credits_used}/${usage.search_credits_limit} search credits. Limit will be reached soon.`,
        variant: 'destructive',
        duration: 8000
      })
      shownWarnings.current.add('search-95')
    } else if (searchUsagePercent >= 80 && !shownWarnings.current.has('search-80')) {
      toast({
        title: 'High search credit usage',
        description: `You've used ${usage.search_credits_used}/${usage.search_credits_limit} search credits this month. Consider optimizing queries.`,
        duration: 6000
      })
      shownWarnings.current.add('search-80')
    }

    // Collect credit warnings
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

  const isSearchDisabled = usage ? (usage.search_credits_used >= usage.search_credits_limit) : false
  const isCollectDisabled = usage ? (usage.collect_credits_used >= usage.collect_credits_limit) : false

  return {
    isSearchDisabled,
    isCollectDisabled,
    usage
  }
}
