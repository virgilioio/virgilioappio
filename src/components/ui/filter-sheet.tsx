import type { ReactNode } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

interface FilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  onClearAll?: () => void
  onApply?: () => void
  children: ReactNode
}

export function FilterSheet({
  open,
  onOpenChange,
  title = 'More Filters',
  description = 'Refine your results with additional filters',
  onClearAll,
  onApply,
  children,
}: FilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[380px] sm:max-w-[420px] flex flex-col p-0"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="font-poppins text-base font-semibold">{title}</SheetTitle>
          <SheetDescription className="font-poppins text-xs">
            {description}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {children}
        </div>

        {/* Sticky footer */}
        <div className="border-t border-border px-6 py-3 flex items-center gap-3">
          {onClearAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-xs text-muted-foreground font-poppins"
            >
              Clear all
            </Button>
          )}
          <Button
            size="sm"
            className="ml-auto text-xs font-poppins"
            onClick={() => {
              onApply?.()
              onOpenChange(false)
            }}
          >
            Apply filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
