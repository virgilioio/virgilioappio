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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 gap-2 hidden sm:inline-flex font-poppins">
          <Coins className="h-4 w-4" />
          <span className="text-sm">Credits</span>
          {collectUsagePercent >= 95 && (
            <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center">
              !
            </Badge>
          )}
          {collectUsagePercent >= 80 && collectUsagePercent < 95 && (
            <Badge className="h-5 w-5 p-0 flex items-center justify-center bg-yellow-500 text-white hover:bg-yellow-600">
              !
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 shadow-calendly border-virgilio-border">
        <DropdownMenuLabel className="font-poppins font-semibold text-virgilio-text">
          Sourcing Credits ({currentMonth})
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-virgilio-border" />
        
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
