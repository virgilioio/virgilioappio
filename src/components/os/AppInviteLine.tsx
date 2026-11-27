import { useEffect, useState } from 'react'
import { CalendarPlus, Check, Copy, Link2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { IconSwap } from '@/components/ui/icon-swap'
import { IconTip } from '@/components/ui/tooltip'
import { copyToClipboardSilent } from '@/utils/clipboard'
import { cn } from '@/lib/utils'
import type { AppKey } from '@/lib/os/peopleAccess'
import {
  RESEND_PAUSE_MS,
  inviteDay,
  inviteRequest,
  inviteSentence,
  useAppInvite,
  useRefreshAppInvite,
} from '@/lib/os/appInvites'

/**
 * Where one person's Gio Sales or Gio Docs invitation stands, under the app's
 * name in Apps and roles (2026-11-27), with what an admin can do about it:
 * Copy link (a working link to send by hand; every link sent keeps working),
 * Email again (paused for a minute after any send, so nobody gets two at once)
 * and Extend (7 more days). Once they've joined there's nothing to do.
 */
export function AppInviteLine({
  tenantId,
  userId,
  app,
  appName,
  editable,
  resending,
  busy,
  onResend,
}: {
  tenantId: string | undefined
  userId: string | null
  app: AppKey
  appName: string
  /** Admin, and not their own profile. */
  editable: boolean
  resending: boolean
  /** Another change on the card is running. */
  busy: boolean
  /** The existing Resend invitation flow (os-sync), with its own toast. */
  onResend: () => Promise<void> | void
}) {
  const invite = useAppInvite(tenantId, userId, app, editable)
  const refresh = useRefreshAppInvite()
  const [working, setWorking] = useState<'link' | 'renew' | null>(null)
  const [link, setLink] = useState<{ url: string; until: string | null } | null>(null)
  const [copied, setCopied] = useState(false)
  const [sentHere, setSentHere] = useState<number | null>(null)
  const [, tick] = useState(0)

  const data = invite.data
  const lastSent = Math.max(sentHere ?? 0, data?.sent_at ? new Date(data.sent_at).getTime() : 0)
  const paused = lastSent > 0 && Date.now() - lastSent < RESEND_PAUSE_MS

  // Wake up when the pause is over so Email again comes back by itself.
  useEffect(() => {
    if (!paused) return
    const t = window.setTimeout(() => tick((n) => n + 1), RESEND_PAUSE_MS - (Date.now() - lastSent) + 50)
    return () => window.clearTimeout(t)
  }, [paused, lastSent])

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(t)
  }, [copied])

  if (!editable) return null

  if (invite.isLoading) {
    return <p className="font-inter text-[11.5px] text-[#6B7080]">Checking the {appName} invitation…</p>
  }
  if (invite.isError) {
    return (
      <p className="font-inter text-[11.5px] text-[#6B7080]">
        Couldn't check the {appName} invitation.{' '}
        <button
          type="button"
          onClick={() => void invite.refetch()}
          className="font-medium text-virgilio-purple transition-colors duration-hover hover:text-text-primary"
        >
          Retry
        </button>
      </p>
    )
  }
  if (!data || data.state === 'joined' || data.state === 'switched_off' || data.state === 'unknown') {
    const text = inviteSentence(appName, data)
    return text ? <p className="font-inter text-[11.5px] text-[#6B7080]">{text}</p> : null
  }

  const open = data.state === 'pending' || data.state === 'expired'

  const copyLink = async () => {
    if (!tenantId || !userId) return
    setWorking('link')
    try {
      const r = await inviteRequest(tenantId, userId, app, 'link')
      if (!r.url) {
        toast(`${appName} has no open invitation to copy. Email it to send one.`)
        return
      }
      setLink({ url: r.url, until: r.expires_at })
      const ok = await copyToClipboardSilent(r.url)
      setCopied(ok)
      toast(ok ? `Link copied. It works until ${inviteDay(r.expires_at)}.` : 'Here is the link: copy it from the card.')
      void refresh(tenantId, userId, app)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setWorking(null)
    }
  }

  const extend = async () => {
    if (!tenantId || !userId) return
    setWorking('renew')
    try {
      const r = await inviteRequest(tenantId, userId, app, 'renew')
      toast(`Invitation extended. It works until ${inviteDay(r.expires_at)}.`)
      void refresh(tenantId, userId, app)
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setWorking(null)
    }
  }

  const emailAgain = async () => {
    await onResend()
    setSentHere(Date.now())
    void refresh(tenantId, userId, app)
  }

  return (
    <div className="mt-0.5">
      <p className={cn('font-inter text-[11.5px]', data.state === 'expired' ? 'text-[#92400E]' : 'text-[#6B7080]')}>
        {inviteSentence(appName, data)}
      </p>
      <div className="-ml-2 mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
        {open && (
          <Button variant="ghost" size="xs" icon={Link2} loading={working === 'link'} disabled={busy || working !== null} onClick={() => void copyLink()}>
            Copy link
          </Button>
        )}
        <Button
          variant="ghost"
          size="xs"
          icon={Send}
          loading={resending}
          disabled={busy || working !== null || paused}
          onClick={() => void emailAgain()}
        >
          {paused ? 'Sent just now' : open ? 'Email again' : 'Email invitation'}
        </Button>
        {open && (
          <Button variant="ghost" size="xs" icon={CalendarPlus} loading={working === 'renew'} disabled={busy || working !== null} onClick={() => void extend()}>
            Extend 7 days
          </Button>
        )}
      </div>
      {link && (
        <div className="mt-1.5 flex min-w-0 max-w-[420px] items-center gap-2 rounded-md bg-[#F7F6F2] px-2 py-1">
          <span className="min-w-0 flex-1 truncate font-inter text-[11.5px] text-[#3A3D48]">{link.url}</span>
          <IconTip label={copied ? 'Copied' : 'Copy link'}>
            <button
              type="button"
              aria-label="Copy link"
              data-swapped={copied || undefined}
              onClick={async () => setCopied(await copyToClipboardSilent(link.url))}
              className="gio-pressable shrink-0 rounded p-1 text-[#6B7080] transition-colors duration-hover hover:text-text-primary"
            >
              <IconSwap swapped={copied} from={<Copy size={13} />} to={<Check size={13} />} />
            </button>
          </IconTip>
        </div>
      )}
    </div>
  )
}
