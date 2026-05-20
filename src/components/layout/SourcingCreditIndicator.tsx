import { Coins, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useSourcingCredits } from '@/hooks/useSourcingCredits'
import { cn } from '@/lib/utils'

export function SourcingCreditIndicator() {
  const { data: usage, isLoading } = useSourcingCredits()

  if (isLoading || !usage) return null

  const collectUsagePercent = usage.collect_percentage || 0

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const lowCredits = collectUsagePercent >= 80

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Sourcing credits"
          className={cn(
            'hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full',
            'bg-white/8 hover:bg-white/12 text-white/85 hover:text-white',
            'font-poppins font-medium text-[11.5px] tracking-[-0.005em] transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/40',
          )}
        >
          <Coins className="h-3.5 w-3.5" />
          <span className="tabular-nums">
            {Math.max(0, (usage.collect_credits_limit || 0) - (usage.collect_credits_used || 0))}
          </span>
          <span className="opacity-70">credits</span>
          {lowCredits && (
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full ml-0.5',
                collectUsagePercent >= 95 ? 'bg-red-400' : 'bg-amber-300',
              )}
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          Sourcing Credits ({currentMonth})
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="p-3 space-y-3">
          {/* Enrichment Credits */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Enrichment</span>
              <span className={cn(
                "font-semibold",
                collectUsagePercent >= 95 && "text-destructive",
                collectUsagePercent >= 80 && collectUsagePercent < 95 && "text-yellow-600"
              )}>
                {usage.collect_credits_used}/{usage.collect_credits_limit}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all rounded-full",
                  collectUsagePercent >= 95 && "bg-destructive",
                  collectUsagePercent >= 80 && collectUsagePercent < 95 && "bg-yellow-500",
                  collectUsagePercent < 80 && "bg-primary"
                )}
                style={{ width: `${collectUsagePercent}%` }}
              />
            </div>
          </div>

          {/* Warning message */}
          {collectUsagePercent >= 80 && (
            <div className={cn(
              "flex items-start gap-2 p-2 rounded-md text-xs",
              collectUsagePercent >= 95 ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-700"
            )}>
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                {collectUsagePercent >= 95 
                  ? "You're at or near your credit limit. Consider upgrading your plan."
                  : "You're approaching your credit limit."
                }
              </span>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
