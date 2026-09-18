/**
 * Share with client — the dropdown anchored to the Gio Fit hero's primary button.
 *
 * Same anatomy as the job share menu: 26px icon chip, 12.5px label, 11px
 * description. Two rows — an internal link for teammates, and a public dossier
 * link that is off until somebody publishes it. The footer states the two
 * promises the implementation keeps: public links are always client-ready, and
 * they deactivate themselves.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Eye, Globe, Link2, ShieldOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { copyToClipboardSilent } from '@/utils/clipboard'
import { dossierPublicUrl, type DossierShare } from '@/hooks/useDossierShare'

interface ShareDossierMenuProps {
  open: boolean
  onClose: () => void
  share: DossierShare | null
  isLoading: boolean
  error: string | null
  isRejected: boolean
  rejectedAt?: string | null
  /** Read-only roles may copy the internal link but never publish. */
  canPublish?: boolean
  candidateFirstName: string
  internalUrl: string
  onTogglePublic: (next: boolean) => void
  /** The shared wrapper contains both trigger and menu. */
  wrapperRef: React.RefObject<HTMLDivElement>
  /** Returns focus when Escape closes the menu. */
  triggerRef?: React.RefObject<HTMLElement>
}

const PANEL: React.CSSProperties = {
  position: 'absolute',
  top: 36,
  right: 0,
  zIndex: 80,
  width: 340,
  background: '#fff',
  border: '1px solid #E7E8EE',
  borderRadius: 12,
  boxShadow: '0 18px 44px -12px rgba(13,13,9,0.22), 0 2px 6px rgba(13,13,9,0.05)',
  padding: 6,
  textAlign: 'left',
}

function relative(from: string | null) {
  if (!from) return null
  const diff = Date.now() - new Date(from).getTime()
  if (!Number.isFinite(diff) || diff < 0) return null
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'moments'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function Chip({ tone, children }: { tone: 'neutral' | 'live' | 'done'; children: React.ReactNode }) {
  const skins = {
    neutral: { background: '#F1F0EC', color: '#5A6072' },
    live: { background: '#EDE4FF', color: '#5B21B6' },
    done: { background: '#E4F5EA', color: '#1F7A45' },
  } as const
  return (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...skins[tone],
      }}
    >
      {children}
    </span>
  )
}

function useInlineCopy() {
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])
  const copy = async (value: string, selectTarget?: HTMLElement | null) => {
    const ok = await copyToClipboardSilent(value)
    if (timer.current) window.clearTimeout(timer.current)
    if (!ok) {
      // Never fail silently: select the text so the user can copy it by hand.
      if (selectTarget) {
        const range = document.createRange()
        range.selectNodeContents(selectTarget)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
      setManual(true)
      timer.current = window.setTimeout(() => setManual(false), 4000)
      return
    }
    setManual(false)
    setCopied(true)
    timer.current = window.setTimeout(() => setCopied(false), 1600)
  }
  return { copied, manual, copy }
}

export function ShareDossierMenu({
  open,
  onClose,
  share,
  isLoading,
  error,
  isRejected,
  rejectedAt,
  canPublish = true,
  candidateFirstName,
  internalUrl,
  onTogglePublic,
  wrapperRef,
  triggerRef,
}: ShareDossierMenuProps) {
  const urlRef = useRef<HTMLElement | null>(null)
  const internalCopy = useInlineCopy()
  const publicCopy = useInlineCopy()

  useEffect(() => {
    if (!open) return
    const close = () => {
      close()
      triggerRef?.current?.focus()
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const onClick = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose, triggerRef, wrapperRef])

  if (!open) return null

  const live = Boolean(share?.isPublic) && !isRejected
  const url = share ? dossierPublicUrl(share.token) : ''
  const viewed = relative(share?.lastViewedAt ?? null)
  const deactivatedAt = share?.deactivatedAt ?? rejectedAt
  const deactivatedOn = deactivatedAt
    ? new Date(deactivatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const description = isRejected
    ? 'Unavailable while the candidate is rejected'
    : !canPublish
      ? 'You do not have permission to publish this dossier'
      : live
        ? 'Anyone with the link can view — no Gio account needed'
        : 'Off — the link resolves to an unavailable page'

  return (
    <div style={PANEL}>
      {/* Row 1 — internal link */}
      <button
        type="button"
        onClick={() => void internalCopy.copy(internalUrl)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '7px 10px',
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        onMouseEnter={(event) => { event.currentTarget.style.background = '#F6F5F1' }}
        onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}
      >
        <Chip tone={internalCopy.copied ? 'done' : 'neutral'}>
          {internalCopy.copied ? <Check size={13} strokeWidth={2.1} /> : <Link2 size={13} strokeWidth={2.1} />}
        </Chip>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}>
            {internalCopy.manual ? 'Press ⌘C to copy' : internalCopy.copied ? 'Copied to clipboard' : 'Copy internal link'}
          </span>
          <span style={{ display: 'block', marginTop: 1, fontFamily: 'Inter, sans-serif', fontSize: 11, lineHeight: 1.4, color: '#8B8F9E' }}>
            Opens in Gio · teammates with access to this job
          </span>
        </span>
      </button>

      {/* Row 2 — public dossier */}
      <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid #F1F0EC' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0 10px 8px' }}>
          <Chip tone={live ? 'live' : 'neutral'}><Globe size={13} strokeWidth={2.1} /></Chip>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 12.5, fontWeight: 600, color: isRejected || !canPublish ? '#8B8F9E' : '#1F2230' }}>
              Public dossier
            </span>
            <span style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 11, lineHeight: 1.45, color: '#8B8F9E' }}>
              {isLoading && !share ? 'Preparing the link…' : description}
            </span>
          </span>
          <Switch
            checked={live}
            disabled={isRejected || !canPublish || !share || isLoading}
            onCheckedChange={onTogglePublic}
            aria-label="Public dossier"
            aria-pressed={live}
            className="h-[22px] w-[38px] border-0 p-0 [&>span]:ml-[3px] [&>span]:h-4 [&>span]:w-4 [&>span]:shadow-[0_1px_2px_rgba(13,13,9,0.2)] data-[state=checked]:[&>span]:translate-x-4"
            style={{
              background: isRejected || !canPublish || !share || isLoading ? '#E7E5DC' : live ? '#6F3FF5' : '#D5D3CA',
              borderColor: 'transparent',
              opacity: isRejected || !canPublish || !share || isLoading ? 0.7 : 1,
              transition: 'background 140ms ease',
            }}
          />
        </div>

        {isRejected && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              margin: '0 10px 8px',
              padding: '9px 10px',
              background: '#FFFBEB',
              border: '1px solid #FDE9B5',
              borderRadius: 9,
            }}
          >
            <ShieldOff size={13} strokeWidth={2} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: 11, lineHeight: 1.5, color: '#7A4A08', textWrap: 'pretty' }}>
              <strong>Deactivated automatically</strong>
              {deactivatedOn ? ` on ${deactivatedOn}` : ''}, when {candidateFirstName} was rejected. Reactivate her on this job to share again.
            </p>
          </div>
        )}

        {live && share && (
          <div style={{ margin: '0 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <code
                ref={urlRef}
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontSize: 10.5,
                  background: '#FBFAF7',
                  border: '1px solid #EFEEE8',
                  borderRadius: 7,
                  padding: '7px 9px',
                  color: '#5A6072',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {url}
              </code>
              <Button
                variant="secondary"
                size="sm"
                icon={publicCopy.copied ? Check : Copy}
                onClick={() => void publicCopy.copy(url, urlRef.current)}
              >
                {publicCopy.manual ? 'Press ⌘C' : publicCopy.copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '9px 10px 4px', fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#8B8F9E' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Eye size={11} />Viewed {share.viewCount} {share.viewCount === 1 ? 'time' : 'times'}{viewed ? ` · last ${viewed} ago` : ''}</span>
              <span style={{ color: '#D1D5DB' }}>·</span>
              <span>Client-ready view</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p style={{ margin: '8px 10px 0', fontFamily: 'Inter, sans-serif', fontSize: 11, color: '#B42318' }} role="alert">
          {error}
        </p>
      )}

      <p
        style={{
          margin: '6px 0 0',
          padding: '9px 10px 4px',
          borderTop: '1px solid #F1F0EC',
          fontFamily: 'Inter, sans-serif',
          fontSize: 10.5,
          lineHeight: 1.5,
          color: '#8B8F9E',
          textWrap: 'pretty',
        }}
      >
        Public links always serve the client-ready view — no weights, no scoring mechanics, no compensation.
        They deactivate on their own when the candidate is rejected or the job closes.
      </p>
    </div>
  )
}
