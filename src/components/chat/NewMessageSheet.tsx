import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { InlineEmpty } from '@/components/ui/empty-state'
import { Search } from 'lucide-react'

interface NewMessageSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * NewMessageSheet — placeholder recipient picker for the Chat compose entry.
 * Real picker (candidate search + channel selection) lands in a later step.
 */
export function NewMessageSheet({ open, onOpenChange }: NewMessageSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-virgilio-border">
          <SheetTitle className="font-poppins text-[16px] tracking-[-0.02em]">
            New message
          </SheetTitle>
        </SheetHeader>
        <div className="p-5 space-y-4">
          <label className="flex items-center gap-2 h-9 px-3 rounded-[9px] bg-[#F6F5F1]">
            <Search className="h-3.5 w-3.5 text-[#8B8F9E]" />
            <input
              type="text"
              placeholder="Search candidates"
              className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-[#8B8F9E]"
            />
          </label>
          <InlineEmpty text="Recipient picker coming soon" />
        </div>
      </SheetContent>
    </Sheet>
  )
}
