import { Bookmark, Users, ListChecks, Mail, Heart, Sparkles, Plus, ChevronRight, MoreHorizontal, Pencil, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import type { SmartListKey } from './CandidatesHeader'
import type { SavedView } from '@/hooks/useSavedViews'
import type { CandidateKpis } from '@/hooks/useCandidateKpis'

interface CandidatesSearchesRailProps {
  views: SavedView[]
  activeViewId: string | null
  activeSmartList: SmartListKey | null
  kpis: CandidateKpis | undefined
  isLoading: boolean
  /** Most-recently-saved view id — gets a one-shot lilac fade. */
  justSavedId?: string | null
  onSelectView: (view: SavedView) => void
  onSelectSmartList: (key: SmartListKey) => void
  onCreateView: () => void
  onEditView?: (view: SavedView) => void
  onDuplicateView?: (view: SavedView) => void
  onDeleteView?: (view: SavedView) => void
}


const SECTION_LABEL = 'text-[10px] font-poppins font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]'
const ITEM_BASE =
  'group flex items-center gap-2 w-full h-[30px] px-2 rounded-md text-[12.5px] font-inter text-text-primary transition-colors'
const ITEM_HOVER = 'hover:bg-[#F1F0EC]'
const ITEM_SELECTED = 'bg-[#EDE4FF] !text-virgilio-purple relative before:absolute before:inset-y-1 before:left-0 before:w-[2px] before:bg-virgilio-purple before:rounded-r'

function SmartListItem({
  icon: Icon, label, count, active, onClick, tone,
}: { icon: typeof Users; label: string; count: number | undefined; active: boolean; onClick: () => void; tone?: 'pink' | 'purple' }) {
  return (
    <button type="button" onClick={onClick} className={cn(ITEM_BASE, active ? ITEM_SELECTED : ITEM_HOVER)}>
      <Icon className={cn('h-3.5 w-3.5 shrink-0', tone === 'pink' ? 'text-pastel-pink-foreground' : tone === 'purple' ? 'text-virgilio-purple' : 'text-text-tertiary')} />
      <span className="flex-1 text-left truncate">{label}</span>
      <span className="text-[11px] text-text-tertiary tabular-nums">{count == null ? '—' : count.toLocaleString()}</span>
    </button>
  )
}

function SavedSearchItem({
  view, active, justSaved, onClick, onEdit, onDuplicate, onDelete,
}: {
  view: SavedView
  active: boolean
  justSaved?: boolean
  onClick: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}) {
  const hasMenu = !!(onEdit || onDuplicate || onDelete)
  return (
    <div
      className={cn(
        'group relative flex items-center w-full rounded-md',
        active ? ITEM_SELECTED : ITEM_HOVER,
        justSaved && !active && 'bg-virgilio-purple/8 motion-safe:animate-gio-pulse',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          ITEM_BASE,
          'bg-transparent hover:bg-transparent',
          hasMenu && 'pr-8',
        )}
      >
        <Bookmark className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
        <div className="flex-1 min-w-0 text-left">
          <div className="truncate leading-tight">{view.name}</div>
        </div>
      </button>
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              iconOnly
              icon={MoreHorizontal}
              aria-label={`Actions for ${view.name}`}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6}>
            {onEdit && (
              <DropdownMenuItem onSelect={() => onEdit()}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {onDuplicate && (
              <DropdownMenuItem onSelect={() => onDuplicate()}>
                <Copy className="h-3.5 w-3.5 mr-2" />
                Duplicate
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDelete()} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}


export function CandidatesSearchesRail({
  views, activeViewId, activeSmartList, kpis, isLoading, justSavedId,
  onSelectView, onSelectSmartList, onCreateView,
  onEditView, onDuplicateView, onDeleteView,
}: CandidatesSearchesRailProps) {

  return (
    <aside className="w-[260px] shrink-0 border-r border-virgilio-border bg-surface-primary h-full overflow-y-auto">
      <div className="p-3 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[13px] font-poppins font-semibold tracking-[-0.01em] text-text-primary">Searches</h2>
          <button
            type="button"
            onClick={onCreateView}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[12px] font-poppins font-medium text-virgilio-purple hover:bg-[#F1F0EC] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </div>

        {/* My Searches */}
        <div className="space-y-1">
          <div className={cn(SECTION_LABEL, 'px-2 flex items-center justify-between')}>
            <span>My searches</span>
            <ChevronRight className="h-3 w-3 opacity-40" />
          </div>
          {views.length === 0 ? (
            <div className="px-2 py-2 text-[12px] text-text-tertiary">No saved searches yet.</div>
          ) : (
            views.map(v => (
              <SavedSearchItem key={v.id} view={v} active={v.id === activeViewId} justSaved={v.id === justSavedId} onClick={() => onSelectView(v)} />
            ))
          )}

        </div>

        {/* Smart Lists */}
        <div className="space-y-1">
          <div className={cn(SECTION_LABEL, 'px-2')}>Smart lists</div>
          <SmartListItem icon={Users} label="All candidates" count={kpis?.total} active={activeSmartList === 'all'} onClick={() => onSelectSmartList('all')} />
          <SmartListItem icon={ListChecks} label="In active pipeline" count={kpis?.inActivePipeline} active={activeSmartList === 'active'} onClick={() => onSelectSmartList('active')} />
          <SmartListItem icon={Mail} label="Awaiting outreach" count={kpis?.awaitingOutreach} active={activeSmartList === 'awaiting'} onClick={() => onSelectSmartList('awaiting')} />
          <SmartListItem icon={Heart} label="Favorites" count={kpis?.favorites} active={activeSmartList === 'favorites'} onClick={() => onSelectSmartList('favorites')} tone="pink" />
          <SmartListItem icon={Sparkles} label="New this week" count={kpis?.newThisWeek} active={activeSmartList === 'new'} onClick={() => onSelectSmartList('new')} tone="purple" />
        </div>

        <div className="px-2 pt-3 text-[11px] text-text-tertiary border-t border-virgilio-border">
          Searches refresh every 15 min
        </div>
      </div>
    </aside>
  )
}
