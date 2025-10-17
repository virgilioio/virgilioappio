import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getCreditWarningLevel, formatRefillDate } from '@/utils/sourcingCredits';

interface CreditsData {
  remaining: number;
  limit: number;
}

interface CreditsMeterProps {
  searchCredits: CreditsData;
  collectCredits: CreditsData;
  lastRefill?: string | null;
  nextRefill?: string | null;
  onRefresh?: () => void;
  isLoading?: boolean;
  compact?: boolean; // For header vs full page display
}

export function CreditsMeter({
  searchCredits,
  collectCredits,
  lastRefill,
  nextRefill,
  onRefresh,
  isLoading = false,
  compact = false
}: CreditsMeterProps) {
  const [previousTotal, setPreviousTotal] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const totalRemaining = searchCredits.remaining + collectCredits.remaining;
  const totalLimit = searchCredits.limit + collectCredits.limit;
  const totalPercentage = totalLimit > 0 ? (totalRemaining / totalLimit) * 100 : 0;

  const searchPercentage = searchCredits.limit > 0 
    ? (searchCredits.remaining / searchCredits.limit) * 100 
    : 0;
  const collectPercentage = collectCredits.limit > 0 
    ? (collectCredits.remaining / collectCredits.limit) * 100 
    : 0;

  const overallWarningLevel = getCreditWarningLevel(totalRemaining, totalLimit);
  const searchWarningLevel = getCreditWarningLevel(searchCredits.remaining, searchCredits.limit);
  const collectWarningLevel = getCreditWarningLevel(collectCredits.remaining, collectCredits.limit);

  // Track changes for accessibility announcements
  useEffect(() => {
    if (previousTotal !== null && previousTotal !== totalRemaining) {
      // Value changed - will trigger aria-live announcement
    }
    setPreviousTotal(totalRemaining);
  }, [totalRemaining, previousTotal]);

  const getWarningColor = (level: 'none' | 'warning' | 'critical') => {
    switch (level) {
      case 'critical':
        return 'text-destructive';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getProgressColor = (level: 'none' | 'warning' | 'critical') => {
    switch (level) {
      case 'critical':
        return 'bg-destructive';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return '';
    }
  };

  if (totalLimit === 0) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-md border border-dashed p-2",
        compact && "text-sm"
      )}>
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          {compact ? 'No credits' : 'No sourcing credits allocated'}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size={compact ? "sm" : "default"}
          className={cn(
            "gap-2 min-w-[160px]",
            overallWarningLevel === 'critical' && "border-destructive",
            overallWarningLevel === 'warning' && "border-yellow-500"
          )}
          aria-label={`Sourcing credits: ${totalRemaining} of ${totalLimit} remaining`}
        >
          {overallWarningLevel === 'critical' && (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          {overallWarningLevel === 'warning' && (
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
          )}
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className={cn(
              "text-xs font-normal",
              getWarningColor(overallWarningLevel)
            )}>
              Credits
            </span>
            <span 
              className="font-semibold tabular-nums"
              aria-live="polite"
              aria-atomic="true"
            >
              {totalRemaining}/{totalLimit}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 bg-background z-50">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Sourcing Credits</span>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              disabled={isLoading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={cn(
                "h-3 w-3",
                isLoading && "animate-spin"
              )} />
            </Button>
          )}
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {/* Overall Progress */}
        <div className="px-2 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Total Credits</span>
            <span className={cn(
              "text-sm font-semibold tabular-nums",
              getWarningColor(overallWarningLevel)
            )}>
              {totalRemaining} / {totalLimit}
            </span>
          </div>
          <Progress 
            value={totalPercentage} 
            className="h-2"
            indicatorClassName={getProgressColor(overallWarningLevel)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {totalPercentage.toFixed(0)}% remaining
          </p>
        </div>

        <DropdownMenuSeparator />

        {/* Search Credits */}
        <div className="px-2 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">Search</span>
              {searchWarningLevel === 'critical' && (
                <AlertCircle className="h-3 w-3 text-destructive" />
              )}
              {searchWarningLevel === 'warning' && (
                <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
              )}
            </div>
            <span className={cn(
              "text-sm tabular-nums",
              getWarningColor(searchWarningLevel)
            )}>
              {searchCredits.remaining} / {searchCredits.limit}
            </span>
          </div>
          <Progress 
            value={searchPercentage} 
            className="h-1.5"
            indicatorClassName={getProgressColor(searchWarningLevel)}
          />
        </div>

        {/* Collect Credits */}
        <div className="px-2 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">Collect</span>
              {collectWarningLevel === 'critical' && (
                <AlertCircle className="h-3 w-3 text-destructive" />
              )}
              {collectWarningLevel === 'warning' && (
                <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-500" />
              )}
            </div>
            <span className={cn(
              "text-sm tabular-nums",
              getWarningColor(collectWarningLevel)
            )}>
              {collectCredits.remaining} / {collectCredits.limit}
            </span>
          </div>
          <Progress 
            value={collectPercentage} 
            className="h-1.5"
            indicatorClassName={getProgressColor(collectWarningLevel)}
          />
        </div>

        {/* Refill Information */}
        {(lastRefill || nextRefill) && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-3 space-y-1">
              {lastRefill && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Last refill:</span>
                  <span>{formatRefillDate(lastRefill)}</span>
                </div>
              )}
              {nextRefill && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Next refill:</span>
                  <span className="font-medium">{formatRefillDate(nextRefill)}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Warning Messages */}
        {overallWarningLevel !== 'none' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-muted-foreground cursor-default focus:bg-transparent">
              {overallWarningLevel === 'critical' && (
                <span className="text-destructive">
                  ⚠️ Credits depleted. Contact your administrator to refill.
                </span>
              )}
              {overallWarningLevel === 'warning' && (
                <span className="text-yellow-600 dark:text-yellow-500">
                  ⚠️ Running low on credits. Consider refilling soon.
                </span>
              )}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
