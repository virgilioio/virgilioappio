import { useEffect, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { creditsRenewLabel, useSourcingCredits } from './useSourcingCredits'

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
        title: 'Apollo credits used up',
        description: `This cycle's ${usage.collect_credits_limit.toLocaleString()} Apollo credits are used. Collecting resumes on ${creditsRenewLabel(usage)}, when Apollo renews them.`,
        variant: 'destructive',
        duration: 10000
      })
      shownWarnings.current.add('collect-100')
    } else if (collectUsagePercent >= 95 && !shownWarnings.current.has('collect-95')) {
      toast({
        title: 'Nearly out of Apollo credits',
        description: `${usage.collect_credits_used.toLocaleString()} of ${usage.collect_credits_limit.toLocaleString()} Apollo credits used this cycle. They renew on ${creditsRenewLabel(usage)}.`,
        variant: 'destructive',
        duration: 8000
      })
      shownWarnings.current.add('collect-95')
    } else if (collectUsagePercent >= 80 && !shownWarnings.current.has('collect-80')) {
      toast({
        title: 'Apollo credits running low',
        description: `${usage.collect_credits_used.toLocaleString()} of ${usage.collect_credits_limit.toLocaleString()} Apollo credits used this cycle.`,
        duration: 6000
      })
      shownWarnings.current.add('collect-80')
    }
  }, [usage, toast])

  const isCollectDisabled = usage ? (usage.collect_credits_used >= usage.collect_credits_limit) : false
  const renewsOn = creditsRenewLabel(usage)

  return {
    isCollectDisabled,
    renewsOn,
    usage
  }
}
