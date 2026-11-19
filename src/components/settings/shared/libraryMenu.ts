import type { ComponentType, ReactNode } from 'react'

/** One more thing a row can do, listed between Edit and Delete. */
export interface LibraryAction {
  label: string
  icon: ComponentType<{ className?: string }>
  onSelect: () => void
  disabled?: boolean
}

export interface LibraryItem {
  id: string
  name: string
  /** Under the name: a description, a subject line, a stored name. */
  meta?: ReactNode
  /** Right of the name: type and status chips. */
  chips?: ReactNode
  onEdit?: () => void
  /** What Edit is called when all there is to edit is the name ("Rename"). */
  editLabel?: string
  /** Between Edit and Delete: Preview, Duplicate, Make inactive… */
  actions?: LibraryAction[]
  onDelete?: () => void
  /** Extra controls before the menu (e.g. an Active switch). */
  aside?: ReactNode
}

export type LibraryMenuRow =
  | { kind: 'edit'; label: string; onSelect: () => void }
  | { kind: 'action'; label: string; icon: LibraryAction['icon']; onSelect: () => void; disabled?: boolean }
  | { kind: 'separator' }
  | { kind: 'delete'; label: string; onSelect: () => void }

/**
 * A row's ⋯ menu, in order (§19): Edit first, the row's own actions, then
 * Delete last on its own after a divider. Empty when the row can do nothing.
 */
export function libraryMenu(item: Pick<LibraryItem, 'onEdit' | 'editLabel' | 'actions' | 'onDelete'>): LibraryMenuRow[] {
  const rows: LibraryMenuRow[] = []
  if (item.onEdit) rows.push({ kind: 'edit', label: item.editLabel || 'Edit', onSelect: item.onEdit })
  for (const a of item.actions ?? []) {
    rows.push({ kind: 'action', label: a.label, icon: a.icon, onSelect: a.onSelect, disabled: a.disabled })
  }
  if (item.onDelete) {
    if (rows.length) rows.push({ kind: 'separator' })
    rows.push({ kind: 'delete', label: 'Delete', onSelect: item.onDelete })
  }
  return rows
}
