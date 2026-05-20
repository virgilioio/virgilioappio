import type { ReactNode } from 'react'
import { Mail, Tag, BookmarkPlus, Archive, Users, X, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BulkActionBarProps {
  selectedCount: number
  totalCount: number
  allFilteredSelected: boolean
  onSelectAllFiltered: () => void
  onClearSelection: () => void
  onAddToJob: () => void
  onEmail: () => void
  onTag: () => void
  onAddToSearch: () => void
  onArchive: () => void
  /** Optional render override for the Tag button (used to wrap it in a Popover trigger). */
  tagButtonSlot?: ReactNode
  /** Optional render override for the Add to job button (used to wrap it in a Popover trigger). */
  addToJobButtonSlot?: ReactNode
}

export function BulkActionBar({
  selectedCount, totalCount, allFilteredSelected,
  onSelectAllFiltered, onClearSelection,
  onAddToJob, onEmail, onTag, onAddToSearch, onArchive,
  tagButtonSlot,
  addToJobButtonSlot,
}: BulkActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 h-12 px-4 rounded-xl bg-[#0d0d09] text-white">
      <div className="flex items-center gap-3 text-[13px] font-poppins font-medium">
        <span className="inline-flex items-center gap-2">
          <Users className="h-4 w-4 opacity-80" />
          {selectedCount} {selectedCount === 1 ? 'candidate' : 'candidates'} selected
        </span>
        {!allFilteredSelected && totalCount > selectedCount && (
          <>
            <span className="text-white/30">·</span>
            <button onClick={onSelectAllFiltered} className="text-white/80 hover:text-white underline-offset-2 hover:underline">
              Select all {totalCount.toLocaleString()}
            </button>
          </>
        )}
        <span className="text-white/30">·</span>
        <button onClick={onClearSelection} className="text-white/60 hover:text-white">Clear</button>
      </div>
      <div className="flex items-center gap-1">
        {addToJobButtonSlot ?? <Button onDark size="sm" variant="ghost" icon={Users} onClick={onAddToJob}>Add to job</Button>}
        <Button onDark size="sm" variant="ghost" icon={Mail} onClick={onEmail}>Email</Button>
        {tagButtonSlot ?? <Button onDark size="sm" variant="ghost" icon={Tag} onClick={onTag}>Tag</Button>}
        <Button onDark size="sm" variant="ghost" icon={BookmarkPlus} onClick={onAddToSearch}>Add to search</Button>
        <Button onDark size="sm" variant="ghost" icon={Archive} onClick={onArchive} className="!text-red-300 hover:!text-red-200">
          Archive
        </Button>
        <button onClick={onClearSelection} className="ml-1 h-7 w-7 rounded-md hover:bg-white/10 inline-flex items-center justify-center" aria-label="Clear selection">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
