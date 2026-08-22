import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'

import { RefToggle } from '@/components/references/RefToggle'

/** Shared list row for sections 1–3: grip · body · bin. */
export function RowShell({
  id,
  last,
  onDelete,
  deleteLabel = 'Delete row',
  children,
}: {
  id: string
  last?: boolean
  onDelete: () => void
  deleteLabel?: string
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        translate: CSS.Translate.toString(transform) ?? undefined,
        transition,
        opacity: isDragging ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid #F6F5F1',
      }}
    >
      <button
        type="button"
        aria-label="Reorder"
        className="grid place-items-center shrink-0"
        style={{ cursor: 'grab', background: 'none', border: 'none', padding: 0, color: '#D1D0CB' }}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

      {children}

      <button
        type="button"
        aria-label={deleteLabel}
        onClick={onDelete}
        className="grid place-items-center shrink-0"
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          border: 'none',
          background: 'transparent',
          color: '#B5B9C4',
          cursor: 'pointer',
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

/** Trailing label + toggle group. width 84 for Required, 118 for Ask candidate. */
export function TrailingToggle({
  label,
  checked,
  onChange,
  width,
  disabled,
  accent,
  title,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  width: number
  disabled?: boolean
  /** Ask-candidate uses the deep accent + weight 600 when on. */
  accent?: boolean
  title?: string
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center justify-end shrink-0"
      style={{
        gap: 7,
        width,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'default',
      }}
    >
      <span
        className="font-inter"
        style={{
          fontSize: 11,
          color: checked ? (accent ? '#5B21B6' : '#1F2230') : '#B5B9C4',
          fontWeight: checked && accent ? 600 : 400,
        }}
      >
        {label}
      </span>
      <RefToggle checked={checked} onChange={onChange} disabled={disabled} ariaLabel={label} />
    </span>
  )
}

/** Section title + subtitle + optional action. */
export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3" style={{ marginBottom: 10 }}>
      <div className="min-w-0">
        <h2
          className="font-poppins font-semibold text-[#0d0d09]"
          style={{ fontSize: 18, letterSpacing: '-0.04em' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="font-inter" style={{ fontSize: 12, color: '#5A6072', marginTop: 3 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Quiet informational block. */
export function InfoBlock({ children }: { children: ReactNode }) {
  return (
    <div
      className="font-inter"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 12px',
        background: '#FAFAF7',
        borderRadius: 8,
        fontSize: 11.5,
        color: '#5A6072',
        lineHeight: 1.5,
        marginTop: 12,
      }}
    >
      {children}
    </div>
  )
}
