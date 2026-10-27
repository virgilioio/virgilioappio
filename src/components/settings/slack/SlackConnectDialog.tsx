import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Check, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SlackLogo } from '@/components/icons/SlackLogo'
import gioAvatar from '@/assets/gio-avatar.png'
import { startSlackConnect } from '@/lib/slack'

/**
 * Connect Slack (2026-10-27): Gio and Slack side by side, what Slack will let
 * Gio do in plain words, then Slack's own sign-in. Admins only; the
 * connection is the workspace's, not one person's.
 */
const ASKS = [
  'Post messages in the channels you pick',
  'Send direct messages to the people you pick, and to a job’s team',
  'See your channels and people, so you can pick them here',
  'Find teammates by their email, so messages can @mention them',
]

export function SlackConnectDialog({
  open,
  onOpenChange,
  tenantId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
}) {
  const [going, setGoing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = async () => {
    setGoing(true)
    setError(null)
    try {
      // Off to Slack; it brings the person back to Settings › Integrations.
      await startSlackConnect(tenantId)
    } catch (e) {
      setGoing(false)
      setError(e instanceof Error ? e.message : 'Couldn’t reach Slack. Try again.')
    }
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && going) return
        if (!o) setError(null)
        onOpenChange(o)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="gio-dialog-overlay fixed inset-0 z-[60]" style={{ background: 'rgba(13,13,9,0.34)' }} />
        <DialogPrimitive.Content
          className="gio-dialog fixed left-1/2 top-1/2 z-[70] flex flex-col overflow-hidden bg-white [translate:-50%_-50%] focus:outline-none"
          style={{
            width: 480,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100dvh - 48px)',
            borderRadius: 18,
            boxShadow: '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-7">
            <div aria-hidden className="flex items-center justify-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#ECEBE6] bg-white">
                <img src={gioAvatar} alt="" className="h-9 w-9 rounded-full" />
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-[#C9C7BF]" />
                <span className="h-1 w-1 rounded-full bg-[#C9C7BF]" />
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#F1F0EC] text-[#5A6072]">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
                <span className="h-1 w-1 rounded-full bg-[#C9C7BF]" />
                <span className="h-1 w-1 rounded-full bg-[#C9C7BF]" />
              </span>
              <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#ECEBE6] bg-white">
                <SlackLogo size={28} />
              </span>
            </div>

            <DialogPrimitive.Title className="mt-5 text-center font-poppins text-[17px] font-semibold leading-snug text-text-primary">
              Connect Slack to Gio
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mx-auto mt-1 max-w-[340px] text-center font-inter text-[13px] leading-[1.5] text-text-secondary">
              You&rsquo;ll sign in to Slack and pick the workspace. Everyone here can then send Gio&rsquo;s updates to it.
            </DialogPrimitive.Description>

            <div className="mt-5 rounded-xl bg-[#F7F6F2] px-4 py-3.5">
              <p className="font-inter text-[12px] font-medium text-text-secondary">Slack will let Gio</p>
              <ul className="mt-2 flex flex-col gap-2">
                {ASKS.map((a) => (
                  <li key={a} className="flex items-start gap-2.5 font-inter text-[13px] leading-[1.45] text-text-primary">
                    <span aria-hidden className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#E5F4EC] text-[#0E7A4D]">
                      <Check className="h-3 w-3" strokeWidth={2.4} />
                    </span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 flex items-center gap-1.5 font-inter text-[12px] text-text-tertiary">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Gio never reads your Slack messages, and never sends pay or salary.
            </p>
            <p role="alert" className="min-h-[18px] pt-1 font-inter text-[12px] text-[#C2372B]">
              {error}
            </p>
          </div>
          <footer className="flex shrink-0 items-center justify-end gap-3" style={{ padding: '13px 24px', borderTop: '1px solid #F1F0EC', background: '#FAFAF7' }}>
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="secondary" size="md" disabled={going}>
                Cancel
              </Button>
            </DialogPrimitive.Close>
            <Button type="button" variant="primary" size="md" loading={going} onClick={() => void connect()}>
              Connect to Slack
            </Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
