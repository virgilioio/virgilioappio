import { CreditCard, TrendingUp, Clock } from 'lucide-react'
import { useSourcingCredits } from '@/hooks/useSourcingCredits'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'

export function SourcingCreditIndicator() {
  const { data: usage, isLoading } = useSourcingCredits()
  const navigate = useNavigate()

  if (isLoading || !usage) return null

  const showUpgrade = (usage.search_percentage > 80 || usage.collect_percentage > 80) 
    && usage.subscription_tier !== 'business' // business is top tier

  const tierLabels: Record<string, string> = {
    launch: 'Launch',
    growth: 'Growth',
    business: 'Business'
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <CreditCard className="h-4 w-4 mr-2" />
          Credits
          {showUpgrade && (
            <Badge variant="destructive" className="ml-2">
              Low
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Sourcing Credits</span>
          <Badge variant="outline">{tierLabels[usage.subscription_tier]}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="p-3 space-y-4">
          {/* Search Credits */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">Search</span>
              <span className="text-muted-foreground">
                {usage.search_credits_used} / {usage.search_credits_limit}
              </span>
            </div>
            <Progress value={usage.search_percentage} className="h-2" />
          </div>

          {/* Enrichment Credits */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">Enrichment</span>
              <span className="text-muted-foreground">
                {usage.collect_credits_used} / {usage.collect_credits_limit}
              </span>
            </div>
            <Progress value={usage.collect_percentage} className="h-2" />
          </div>

          {/* Next Reset */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Resets on {format(new Date(usage.next_reset), 'MMM d, yyyy')}
            </span>
          </div>

          {showUpgrade && (
            <>
              <DropdownMenuSeparator />
              <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-md">
                <p className="text-xs text-orange-900 dark:text-orange-200 mb-2">
                  Running low on credits? Upgrade for more capacity.
                </p>
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => navigate('/settings/billing')}
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Upgrade Plan
                </Button>
              </div>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
