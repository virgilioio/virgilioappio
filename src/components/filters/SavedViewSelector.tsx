import { useState, useCallback } from 'react'
import { Bookmark, ChevronDown, Plus, Pencil, Trash2, Star, StarOff, MoreHorizontal, Save } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { SaveViewDialog } from './SaveViewDialog'
import type { SavedView, PageContext } from '@/hooks/useSavedViews'
import { useSavedViews } from '@/hooks/useSavedViews'

interface SavedViewSelectorProps {
  pageContext: PageContext
  currentFilters: Record<string, unknown>
  onApplyView: (filters: Record<string, unknown>) => void
  activeViewId: string | null
  onActiveViewChange: (viewId: string | null) => void
  extraState?: Record<string, unknown>
  className?: string
}

export function SavedViewSelector({
  pageContext,
  currentFilters,
  onApplyView,
  activeViewId,
  onActiveViewChange,
  extraState,
  className,
}: SavedViewSelectorProps) {
  const { views, createView, updateView, deleteView } = useSavedViews(pageContext)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<SavedView | null>(null)

  const activeView = views.find(v => v.id === activeViewId) ?? null

  const handleSelectView = useCallback((view: SavedView) => {
    onApplyView(view.filters as Record<string, unknown>)
    onActiveViewChange(view.id)
    setPopoverOpen(false)
  }, [onApplyView, onActiveViewChange])

  const handleSaveNew = useCallback((name: string, isDefault: boolean) => {
    createView.mutate(
      { name, filters: currentFilters, extra_state: extraState, is_default: isDefault },
      {
        onSuccess: (data) => {
          onActiveViewChange(data.id)
          setSaveDialogOpen(false)
        },
      }
    )
  }, [createView, currentFilters, extraState, onActiveViewChange])

  const handleUpdateCurrent = useCallback(() => {
    if (!activeView) return
    updateView.mutate({ id: activeView.id, filters: currentFilters, extra_state: extraState })
  }, [activeView, updateView, currentFilters, extraState])

  const handleRename = useCallback((name: string) => {
    if (!renameTarget) return
    updateView.mutate(
      { id: renameTarget.id, name },
      { onSuccess: () => setRenameTarget(null) }
    )
  }, [renameTarget, updateView])

  const handleToggleDefault = useCallback((view: SavedView) => {
    updateView.mutate({ id: view.id, is_default: !view.is_default })
  }, [updateView])

  const handleDelete = useCallback((view: SavedView) => {
    deleteView.mutate(view.id, {
      onSuccess: () => {
        if (activeViewId === view.id) onActiveViewChange(null)
      },
    })
  }, [deleteView, activeViewId, onActiveViewChange])

  return (
    <>
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        {/* View selector */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 h-8 text-sm font-poppins font-medium transition-all duration-150 whitespace-nowrap',
                'hover:bg-accent/30',
                activeView
                  ? 'bg-accent/40 border-accent-foreground/20 text-accent-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Bookmark className="h-3.5 w-3.5" />
              {activeView ? activeView.name : 'Views'}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-[280px] p-0 overflow-hidden" sideOffset={6}>
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <span className="text-xs font-poppins font-semibold text-foreground uppercase tracking-wider">Saved Views</span>
            </div>

            <div className="max-h-[280px] overflow-y-auto px-1 pb-1">
              {views.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-muted-foreground font-poppins">No saved views yet</p>
                  <p className="text-[11px] text-muted-foreground/70 font-inter mt-1">Apply filters and save your first view</p>
                </div>
              ) : (
                views.map(view => (
                  <div
                    key={view.id}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-colors group',
                      'hover:bg-accent/30',
                      activeViewId === view.id && 'bg-accent/20',
                    )}
                    onClick={() => handleSelectView(view)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-inter text-foreground truncate">{view.name}</span>
                        {view.is_default && (
                          <Star className="h-3 w-3 text-warning fill-warning shrink-0" />
                        )}
                      </div>
                    </div>

                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent/40">
                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px] z-[200]">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setRenameTarget(view); setPopoverOpen(false) }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleDefault(view) }}>
                          {view.is_default ? <StarOff className="h-3.5 w-3.5 mr-2" /> : <Star className="h-3.5 w-3.5 mr-2" />}
                          {view.is_default ? 'Remove default' : 'Set as default'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleDelete(view) }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>

            {/* Footer actions */}
            <div className="border-t border-border px-3 py-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs font-poppins gap-1.5"
                onClick={() => { setSaveDialogOpen(true); setPopoverOpen(false) }}
              >
                <Plus className="h-3.5 w-3.5" />
                Save as new
              </Button>
              {activeView && (
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs font-poppins gap-1.5"
                  onClick={() => { handleUpdateCurrent(); setPopoverOpen(false) }}
                >
                  <Save className="h-3.5 w-3.5" />
                  Update view
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Save new dialog */}
      <SaveViewDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveNew}
        mode="create"
        isLoading={createView.isPending}
      />

      {/* Rename dialog */}
      <SaveViewDialog
        open={!!renameTarget}
        onOpenChange={(v) => { if (!v) setRenameTarget(null) }}
        onSave={(name) => handleRename(name)}
        initialName={renameTarget?.name ?? ''}
        mode="rename"
        isLoading={updateView.isPending}
      />
    </>
  )
}
