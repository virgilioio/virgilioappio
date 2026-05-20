import { Bell, Share2, Download, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SavedView } from '@/hooks/useSavedViews'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { toast } from '@/hooks/use-toast'

interface SavedSearchToolbarProps {
  activeView: SavedView | null
  smartListLabel: string | null
  resultsCount: number
  totalCount: number
  isDirty: boolean
  onSaveChanges: () => void
  onResetChanges: () => void
  onSaveAsNew: () => void
  onExport: () => void
}

export function SavedSearchToolbar({
  activeView, smartListLabel, resultsCount, totalCount,
  isDirty, onSaveChanges, onResetChanges, onSaveAsNew, onExport,
}: SavedSearchToolbarProps) {
  const title = activeView?.name ?? smartListLabel ?? 'All candidates'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[12px] font-poppins text-text-tertiary">
          {activeView ? 'My searches' : 'Smart list'}
        </span>
        <ChevronRight className="h-3 w-3 text-text-tertiary" />
        <span className="text-[13.5px] font-poppins font-medium text-text-primary truncate">{title}</span>
        <span className="ml-2 text-[12px] font-poppins text-text-tertiary tabular-nums">
          {resultsCount.toLocaleString()} {resultsCount === 1 ? 'result' : 'results'}
          {totalCount !== resultsCount && (
            <span className="text-text-tertiary/70"> of {totalCount.toLocaleString()}</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {isDirty && activeView && (
          <>
            <span className="inline-flex items-center h-7 px-2.5 rounded-md bg-virgilio-purple/10 text-virgilio-purple text-[11.5px] font-poppins font-medium">
              Editing search
            </span>
            <Button size="sm" variant="ghost" onClick={onResetChanges}>Reset</Button>
            <Button size="sm" variant="secondary" onClick={onSaveChanges}>Save changes</Button>
          </>
        )}
        {isDirty && !activeView && (
          <Button size="sm" variant="secondary" onClick={onSaveAsNew}>Save as search</Button>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" icon={Bell}>Alert me</Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 text-[12.5px] font-inter text-text-secondary">
            <div className="font-poppins font-medium text-text-primary mb-1">Alerts coming soon</div>
            We'll notify you when new candidates match this saved search.
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          variant="ghost"
          icon={Share2}
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href)
            toast({ title: 'Link copied' })
          }}
        >
          Share
        </Button>
        <Button size="sm" variant="ghost" icon={Download} onClick={onExport}>Export</Button>
      </div>
    </div>
  )
}
