import { useEffect, useState } from 'react'
import { Copy, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/integrations/supabase/client'
import { copyToClipboard } from '@/utils/clipboard'
import { toast } from 'sonner'

/**
 * Mints and shows the client-facing report link. The server decides what the
 * link exposes — Gio flags, internal questions, hold notes and the candidate's
 * self-assessment never leave the workspace.
 */
export function ShareReportDialog({
  open,
  onOpenChange,
  requestId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  requestId?: string | null
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !requestId) return
    let cancelled = false
    setLoading(true)
    setUrl(null)
    supabase.functions
      .invoke('reference-report', { body: { action: 'mint', request_id: requestId } })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error || !data?.url) {
          toast.error('Could not create the share link')
          onOpenChange(false)
          return
        }
        setUrl(data.url)
        setExpiresAt(data.expires_at ?? null)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, requestId, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 520 }}>
        <DialogHeader>
          <DialogTitle>Share report</DialogTitle>
        </DialogHeader>

        <p className="font-inter" style={{ fontSize: 12, color: '#5A6072', lineHeight: 1.6 }}>
          Anyone with this link can read the submitted references. Gio's summary, internal
          questions and the candidate's own notes are not included.
        </p>

        <div
          className="font-inter"
          style={{
            marginTop: 12,
            padding: '10px 12px',
            background: '#FAFAF7',
            border: '1px solid #E7E8EE',
            borderRadius: 10,
            fontSize: 11.5,
            color: '#1F2230',
            wordBreak: 'break-all',
            minHeight: 40,
          }}
        >
          {loading ? 'Creating link…' : (url ?? '—')}
        </div>

        {expiresAt && (
          <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', marginTop: 8 }}>
            Expires{' '}
            {new Date(expiresAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        )}

        <div className="flex items-center" style={{ gap: 8, marginTop: 16 }}>
          <Button
            icon={Copy}
            disabled={!url}
            onClick={() => url && copyToClipboard(url, 'Report link copied')}
          >
            Copy link
          </Button>
          {url && (
            <Button
              variant="ghost"
              icon={ExternalLink}
              onClick={() => window.open(url, '_blank', 'noopener')}
            >
              Open
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ShareReportDialog
