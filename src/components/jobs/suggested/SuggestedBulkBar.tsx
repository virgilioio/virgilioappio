import * as React from 'react'
import { Plus, ThumbsDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const inter = "'Inter', system-ui, sans-serif"

/** Replaces the toolbar row while a selection exists. */
export function SuggestedBulkBar({
  count,
  onAdd,
  onDismiss,
  onClear,
  busy,
}: {
  count: number
  onAdd: () => void
  onDismiss: () => void
  onClear: () => void
  busy?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px 8px 14px',
        marginBottom: 12,
        borderRadius: 10,
        background: '#0d0d09',
        color: '#fffcf9',
      }}
    >
      <span style={{ fontFamily: inter, fontSize: 12.5, fontWeight: 600 }}>
        {count} selected
      </span>
      <span style={{ flex: 1 }} />
      <Button size="sm" variant="ghost" icon={X} onDark onClick={onClear}>
        Clear
      </Button>
      <Button size="sm" variant="ghost" icon={ThumbsDown} onDark onClick={onDismiss} disabled={busy}>
        Not a fit
      </Button>
      <Button size="sm" variant="secondary" icon={Plus} loading={busy} onClick={onAdd}>
        Add to pipeline
      </Button>
    </div>
  )
}

export default SuggestedBulkBar
