import type { ReactNode } from 'react'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconTip } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Loadable } from '@/components/ui/loadable'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { SpecCard } from './SpecCard'
import { libraryMenu, type LibraryItem } from './libraryMenu'

export type { LibraryAction, LibraryItem } from './libraryMenu'

/**
 * One list of the recruiting library (Allan, 2026-10-19: one list per kind,
 * no "Platform" and "Mine" split). A SpecCard with the states the rules ask
 * for: a skeleton the size of the rows while loading, crossfading into the
 * rows (Loadable); a failed or 15s-slow load as LoadError with Retry (never
 * an empty list); the flag scene with the add action when there's nothing.
 * Rows carry data-row-id so a delete can collapse them (collapseRows). A row
 * ends in one ⋯ menu (2026-11-18; before, a pencil and a bin): Edit, the
 * row's own actions, then Delete last (libraryMenu), and its name opens Edit.
 */
export function LibraryCard({
  title,
  description,
  what,
  addLabel,
  onAdd,
  loading,
  error,
  onRetry,
  items,
  emptyTitle,
  emptyBody,
  onceKey,
  children,
}: {
  title: string
  description?: ReactNode
  /** For the error line: "pipeline stages", "rejection reasons". */
  what: string
  addLabel?: string
  onAdd?: () => void
  loading: boolean
  error?: unknown
  onRetry: () => void
  items: LibraryItem[]
  emptyTitle: string
  emptyBody?: string
  onceKey?: string
  /** Above the rows, inside the card (e.g. a quick-add field). */
  children?: ReactNode
}) {
  const timedOut = useLoadTimeout(loading)
  const failed = !!error || timedOut
  return (
    <SpecCard
      title={title}
      description={description}
      action={
        addLabel && onAdd ? (
          <Button size="sm" icon={Plus} onClick={onAdd}>
            {addLabel}
          </Button>
        ) : undefined
      }
    >
      {children}
      {failed ? (
        <div className="py-8">
          <LoadError what={what} timedOut={timedOut && !error} onRetry={onRetry} compact />
        </div>
      ) : (
        <Loadable loading={loading} skeleton={<RowsSkeleton />}>
          {items.length === 0 ? (
            <div className="py-6">
              <AnimatedEmpty
                scene="jobs"
                size="compact"
                title={emptyTitle}
                body={emptyBody}
                onceKey={onceKey}
                primary={addLabel && onAdd ? { label: addLabel, icon: <Plus className="h-4 w-4" />, onClick: onAdd } : undefined}
              />
            </div>
          ) : (
            <ul>
              {items.map((item) => (
                <li
                  key={item.id}
                  data-row-id={item.id}
                  className="flex min-h-[48px] items-center gap-3 border-b border-[#F1F0EC] px-[18px] py-2 last:border-b-0"
                >
                  {item.onEdit ? (
                    <button
                      type="button"
                      onClick={item.onEdit}
                      aria-label={`${item.editLabel || 'Edit'} ${item.name}`}
                      className="group/name min-w-0 flex-1 rounded-md text-left"
                    >
                      <p className="truncate font-inter text-[12.5px] font-medium text-[#0d0d09] underline-offset-2 group-hover/name:underline">{item.name}</p>
                      {item.meta && <div className="truncate font-inter text-[11.5px] text-[#6B7080]">{item.meta}</div>}
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-inter text-[12.5px] font-medium text-[#0d0d09]">{item.name}</p>
                      {item.meta && <div className="truncate font-inter text-[11.5px] text-[#6B7080]">{item.meta}</div>}
                    </div>
                  )}
                  {item.chips && <div className="hidden shrink-0 items-center gap-1.5 sm:flex">{item.chips}</div>}
                  {item.aside}
                  <RowMenu item={item} />
                </li>
              ))}
            </ul>
          )}
        </Loadable>
      )}
    </SpecCard>
  )
}

/** The row's ⋯: an actions menu (§19), Delete last and red once pointed at. */
function RowMenu({ item }: { item: LibraryItem }) {
  const rows = libraryMenu(item)
  if (!rows.length) return null
  return (
    <DropdownMenu>
      <IconTip label="Actions">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-[#6B7080] data-[state=open]:bg-[#F1F0EC]" aria-label={`${item.name} actions`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
      </IconTip>
      <DropdownMenuContent align="end" className="w-[272px]">
        {rows.map((row, i) => {
          if (row.kind === 'separator') return <DropdownMenuSeparator key={`sep-${i}`} />
          if (row.kind === 'delete') {
            return (
              <DropdownMenuItem key="delete" data-danger onSelect={row.onSelect}>
                <Trash2 />
                <span className="truncate">{row.label}</span>
              </DropdownMenuItem>
            )
          }
          if (row.kind === 'edit') {
            return (
              <DropdownMenuItem key="edit" onSelect={row.onSelect}>
                <Pencil />
                <span className="truncate">{row.label}</span>
              </DropdownMenuItem>
            )
          }
          const Icon = row.icon
          return (
            <DropdownMenuItem key={row.label} disabled={row.disabled} onSelect={row.onSelect}>
              <Icon />
              <span className="truncate">{row.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RowsSkeleton() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex min-h-[48px] items-center gap-3 border-b border-[#F1F0EC] px-[18px] py-2 last:border-b-0">
          <Skeleton className="h-3.5 w-48 max-w-[50%]" />
          <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-4" />
        </div>
      ))}
    </div>
  )
}
