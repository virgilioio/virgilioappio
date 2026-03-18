import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'

interface MobileFilterDrawerProps {
  children: React.ReactNode
  activeFilterCount?: number
  onClearAll?: () => void
}

export function MobileFilterDrawer({ children, activeFilterCount = 0, onClearAll }: MobileFilterDrawerProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (!isMobile) {
    return <>{children}</>
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 h-8 rounded-full font-poppins text-sm"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
        {activeFilterCount > 0 && (
          <Badge variant="purple" className="h-5 min-w-[20px] px-1.5 text-[10px] ml-0.5">
            {activeFilterCount}
          </Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[85vw] sm:max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-poppins text-base">Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 mt-4">
            {children}
          </div>
          <div className="flex items-center gap-2 mt-6 pt-4 border-t">
            {onClearAll && activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { onClearAll(); setOpen(false) }}
                className="gap-1 text-xs text-muted-foreground hover:text-foreground font-poppins"
              >
                <X className="h-3 w-3" />
                Clear all
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => setOpen(false)}
              className="ml-auto font-poppins"
            >
              Apply
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
