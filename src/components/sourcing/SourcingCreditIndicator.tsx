import { Coins, TrendingUp, Clock, Sparkles, Users, AlertTriangle } from 'lucide-react'
import { useSourcingCredits } from '@/hooks/useSourcingCredits'
import {
  DropdownMenu,
  DropdownMenuContent,
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

  const isLow = usage.collect_percentage > 80
  const totalAvailable = (usage.collect_credits_limit - usage.collect_credits_used) + (usage.bonus_credits_available || 0)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative h-8 gap-1.5 px-2">
          <Coins className="h-4 w-4" />
          <span className="text-xs font-medium">{totalAvailable}</span>
          {isLow && (
            <Badge variant="destructive" className="h-4 px-1 text-[10px]">
              Low
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Enrichment Credits</span>
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {usage.seat_quantity} seat{usage.seat_quantity !== 1 ? 's' : ''}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="p-3 space-y-4">
          {/* Monthly Pool Credits */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">Monthly Pool</span>
              <span className="text-muted-foreground">
                {usage.collect_credits_used} / {usage.collect_credits_limit}
              </span>
            </div>
            <Progress value={usage.collect_percentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {usage.billing_interval === 'year' ? '120' : '100'} credits per seat/month
            </p>
          </div>

          {/* Bonus Credits */}
          {(usage.bonus_credits_available || 0) > 0 && (
            <div className="flex items-center justify-between bg-muted/50 rounded-md p-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm">Bonus credits</span>
              </div>
              <span className="font-medium text-sm">
                {(usage.bonus_credits_available || 0).toLocaleString()}
              </span>
            </div>
          )}

          {/* Next Reset */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              Resets on {format(new Date(usage.next_reset), 'MMM d, yyyy')}
            </span>
          </div>

          {isLow && (
            <>
              <DropdownMenuSeparator />
              <div className="bg-destructive/10 p-3 rounded-md">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-destructive">
                    Running low on credits. Purchase add-on bundles to avoid interruption.
                  </p>
                </div>
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => navigate('/settings?tab=billing')}
                >
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Buy More Credits
                </Button>
              </div>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
