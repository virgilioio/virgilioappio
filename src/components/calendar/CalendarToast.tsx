import { useEffect } from 'react'

export interface CalendarToastState {
  id: number
  title: string
  detail?: string
  tone?: 'default' | 'error'
  onUndo?: () => void
  onRetry?: () => void
}

/** Dark toast pinned to the bottom centre of the calendar card. */
export function CalendarToast({
  toast,
  onDismiss,
}: {
  toast: CalendarToastState | null
  onDismiss: () => void
}) {
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(onDismiss, 6500)
    return () => window.clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-3 z-[70] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex max-w-[520px] items-center gap-3"
        style={{
          background: toast.tone === 'error' ? '#3A1214' : '#0d0d09',
          color: '#fffcf9',
          borderRadius: 12,
          padding: '10px 12px 10px 14px',
          boxShadow: '0 18px 44px -16px rgba(13,13,9,0.55)',
        }}
      >
        <div className="min-w-0">
          <div className="font-inter" style={{ fontSize: 12.5, fontWeight: 600 }}>
            {toast.title}
          </div>
          {toast.detail && (
            <div className="font-inter" style={{ fontSize: 11, opacity: 0.72, marginTop: 1 }}>
              {toast.detail}
            </div>
          )}
        </div>
        {toast.onUndo && (
          <button
            type="button"
            onClick={() => {
              toast.onUndo?.()
              onDismiss()
            }}
            className="font-inter flex-shrink-0"
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: '#fffcf9',
              background: 'rgba(255,255,255,0.14)',
              borderRadius: 8,
              padding: '5px 10px',
            }}
          >
            Undo
          </button>
        )}
        {toast.onRetry && (
          <button
            type="button"
            onClick={() => {
              toast.onRetry?.()
              onDismiss()
            }}
            className="font-inter flex-shrink-0"
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: '#fffcf9',
              background: 'rgba(255,255,255,0.14)',
              borderRadius: 8,
              padding: '5px 10px',
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
