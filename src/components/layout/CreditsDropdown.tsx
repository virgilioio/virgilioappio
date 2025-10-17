import { Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useOrgCredits } from '@/hooks/useOrgCredits'
import { Skeleton } from '@/components/ui/skeleton'

export function CreditsDropdown() {
  const { credits, isLoading } = useOrgCredits()

  // Determine plan type
  const getPlanType = () => {
    if (!credits) return 'Free Trial'
    const totalLimit = credits.search.limit + credits.collect.limit
    if (totalLimit <= 15) return 'Free Trial'
    if (totalLimit <= 50) return 'Basic'
    return 'Pro'
  }

  if (!credits || (credits.search.limit === 0 && credits.collect.limit === 0)) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-10 w-10 relative"
        >
          <Coins className="h-4 w-4" />
          <span className="sr-only">View credits</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-64 p-4 bg-background z-50"
      >
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">
              {getPlanType()}
            </div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Credits Available
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">Search:</span>
                <span className="text-sm font-medium text-foreground">
                  {credits.search.remaining}/{credits.search.limit}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">Collect:</span>
                <span className="text-sm font-medium text-foreground">
                  {credits.collect.remaining}/{credits.collect.limit}
                </span>
              </div>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
